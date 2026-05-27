// =============================================================================
// ImportWizard — multi-step CSV import flow powered by the infer-import-mapping
// Edge Function.
//
// Flow:
//   1. Pick target entity (Properties / Transactions) + upload CSV
//   2. Parse header + 5 sample rows client-side
//   3. Call Edge Function → AI proposes a column mapping
//   4. User reviews/edits the mapping (per-target-field dropdowns)
//   5. Deterministic client-side transform across every row → bulk insert
//   6. Summary screen
// =============================================================================
import { useState, useMemo } from "react";
import { Upload, CheckCircle, AlertCircle, Loader, ArrowRight, ArrowLeft, Sparkles, X, MessageCircle } from "lucide-react";
import { supabase } from "../supabase.js";
import { useToast } from "../toast.jsx";
import { createProperty } from "../db/properties.js";
import { createTransaction } from "../db/transactions.js";
import { iS } from "../shared.jsx";
import { PROPERTIES, TRANSACTIONS } from "../mockData.js";

// Display labels for inferred targets in the review step.
const TARGET_LABELS = {
  properties:   "Properties",
  transactions: "Transactions",
};
const TARGET_DESCRIPTIONS = {
  properties:   "Rentals — addresses, purchase prices, loan details",
  transactions: "Income and expense entries with dates and amounts",
};

// Minimal CSV parser. Handles quoted fields, escaped quotes (""), and \r\n.
// Not RFC-4180-complete — sufficient for QuickBooks / Stessa / Excel exports.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* swallow */ }
      else cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ""));
}

// Parse the first sheet of an .xlsx / .xls workbook into the same string[][]
// shape parseCSV returns. SheetJS is heavy (~600KB) so we dynamic-import it
// only when an Excel file is dropped — CSV imports never pay the bundle cost.
async function parseExcel(file) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  // `raw: false` makes XLSX format dates/numbers as strings (matches CSV path).
  // `defval: ""` fills sparse cells with empty strings so column counts stay aligned.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  // sheet_to_json may return rows of mixed types if some cells are numbers —
  // coerce everything to string here so downstream normalizers see uniform input.
  return rows
    .map(r => r.map(c => c == null ? "" : String(c)))
    .filter(r => r.some(cell => cell.trim() !== ""));
}

// Detect which row in the first ~10 rows is the actual header.
// Most accounting/PM exports (QuickBooks, Stessa, Buildium, AppFolio) put a
// report title + date range on rows 1-3 and the real headers below them.
// Score each candidate by how text-y it is, then return the highest scorer.
function detectHeaderRow(rows) {
  if (rows.length < 2) return 0;
  const scanCount = Math.min(10, rows.length);
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < scanCount; i++) {
    const row = rows[i];
    const nonEmpty = row.filter(c => c.trim() !== "");
    if (nonEmpty.length < 2) continue;
    let score = nonEmpty.length;
    for (const cell of nonEmpty) {
      const s = cell.trim();
      // Numeric / currency / paren-negative — looks like data, not a label.
      if (/^[\(\)$,.\d\s\-]+$/.test(s) && /\d/.test(s)) score -= 2;
      // Date — also data.
      else if (/^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(s)) score -= 2;
      // Very long cell — probably a report banner sentence ("Jan 1 - Dec 31").
      else if (s.length > 50) score -= 1;
    }
    // Bonus if the row after this one has numeric data — that's the shape
    // we expect for "header row immediately followed by transactions".
    const next = rows[i + 1] || [];
    if (next.some(c => /\d/.test(c) && c.trim() !== "")) score += 2;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

// Drop rows that look like injected subtotals / group totals — common in
// QuickBooks, Buildium, and Stessa exports. Conservative: only drops when
// a "Total"/"Subtotal" keyword is present AND the row is mostly empty
// (real transactions almost always have date + payee filled in).
function isSubtotalRow(row) {
  const cells = row.map(c => c.trim());
  const nonEmpty = cells.filter(c => c !== "");
  if (nonEmpty.length === 0) return true;
  const hasTotalKeyword = cells.some(c => /^(sub)?total\b/i.test(c) || /\btotal:?$/i.test(c));
  if (!hasTotalKeyword) return false;
  return nonEmpty.length <= Math.max(2, Math.floor(cells.length / 2));
}

// Compose all the gremlin-cleanup passes in the right order:
//   1. Strip the UTF-8 BOM from every cell (QuickBooks/Excel artifact).
//   2. Detect which row is the actual header, skip banner/title rows above.
//   3. Drop subtotal rows mixed into the data.
//   4. Trim header whitespace.
//   5. Drop columns whose header is empty AND every data cell is empty
//      (Excel report exports pad the left and right edges).
// Returns { rows, skippedHeader, skippedSubtotal } so the UI can show the
// user what we filtered automatically — silent filtering breaks trust.
function preprocessRows(rows) {
  if (rows.length === 0) return { rows, skippedHeader: 0, skippedSubtotal: 0 };
  // Strip BOM from every cell once — it's only ever a parsing artifact.
  const noBom = rows.map(r => r.map(c => c.replace(/^﻿/, "")));
  const headerIdx = detectHeaderRow(noBom);
  const afterHeader = noBom.slice(headerIdx);
  const [rawHeader, ...rest] = afterHeader;
  let skippedSubtotal = 0;
  const filteredData = rest.filter(r => {
    if (isSubtotalRow(r)) { skippedSubtotal++; return false; }
    return true;
  });
  const trimmedHeader = rawHeader.map(h => h.trim());
  // Drop empty padding columns.
  const keepCols = trimmedHeader.map((h, i) => {
    if (h !== "") return true;
    return filteredData.some(r => (r[i] ?? "").trim() !== "");
  });
  const filterRow = (r) => keepCols.map((keep, i) => keep ? (r[i] ?? "") : null).filter(c => c !== null);
  const final = [filterRow(trimmedHeader), ...filteredData.map(filterRow)];
  return { rows: final, skippedHeader: headerIdx, skippedSubtotal };
}

// Walk the parsed rows and figure out which property values would be
// auto-created at import time (i.e., values that don't match any existing
// property by exact OR partial name/address match). Returns
// [{ name, count }, ...] sorted by count descending. Used by both the
// review step (to preview auto-creates) and the clarifications call (to
// tell the AI which pending properties are valid attach-to targets).
function computeWillCreateProperties({ mapping, headers, allRows, propertiesList }) {
  if (!mapping?.property) return [];
  const colIdx = headers.indexOf(mapping.property);
  if (colIdx === -1) return [];

  const propertyKeys = new Set();
  for (const p of propertiesList) {
    if (p.name)    propertyKeys.add(p.name.toLowerCase().trim());
    if (p.address) propertyKeys.add(p.address.toLowerCase().trim());
  }

  const willCreate = new Map();
  for (const row of allRows) {
    const raw = (row[colIdx] || "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (propertyKeys.has(key)) continue;
    let foundPartial = false;
    for (const k of propertyKeys) {
      if (k.includes(key) || key.includes(k)) { foundPartial = true; break; }
    }
    if (foundPartial) continue;
    willCreate.set(raw, (willCreate.get(raw) || 0) + 1);
  }
  return Array.from(willCreate.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Per-target-field value normalizer ────────────────────────────────────────
// Coerces raw CSV strings into the shapes Supabase expects. Centralized here
// so the AI's mapping doesn't need to specify transforms — the schema knows.
function normalizeValue(field, spec, raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "" || s.toLowerCase() === "n/a" || s === "-") return null;

  if (spec.type === "number" || spec.type === "integer") {
    // Strip currency symbols, commas, percent signs. Handle parenthesized negatives.
    let cleaned = s.replace(/[$,\s%]/g, "");
    let negative = false;
    if (cleaned.startsWith("(") && cleaned.endsWith(")")) { negative = true; cleaned = cleaned.slice(1, -1); }
    const n = Number(cleaned);
    if (Number.isNaN(n)) return null;
    const final = negative ? -Math.abs(n) : n;
    return spec.type === "integer" ? Math.round(final) : final;
  }

  if (spec.type === "date") {
    // Try ISO first, then US (MM/DD/YYYY), then EU (DD/MM/YYYY) as last resort.
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const usMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (usMatch) {
      let [, m, d, y] = usMatch;
      if (y.length === 2) y = (Number(y) < 50 ? "20" : "19") + y;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // Fall back to Date constructor (best-effort).
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    return null;
  }

  if (spec.type === "string") {
    if (spec.enum) {
      // Case-insensitive match against the canonical enum.
      const found = spec.enum.find(e => e.toLowerCase() === s.toLowerCase());
      if (found) return found;
      // Special-case the type/amount direction column on transactions.
      const lower = s.toLowerCase();
      if (lower === "income" || lower === "credit" || lower === "deposit") return "income";
      if (lower === "expense" || lower === "debit" || lower === "withdrawal") return "expense";
      return s; // keep raw value; DB may reject but user can adjust
    }
    return s;
  }
  return s;
}

export function ImportWizard({ onClose, onComplete }) {
  const { showToast } = useToast();
  const [step, setStep] = useState("upload");    // upload → loading → review → clarify → importing → done
  const [loadingMessage, setLoadingMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [allRows, setAllRows] = useState([]);    // raw string rows (no header)
  const [aiResult, setAiResult] = useState(null); // {mapping, confidence, notes, target_entity, target_schema, unmapped_source_headers}
  const [mapping, setMapping] = useState({});    // editable copy of aiResult.mapping
  const [defaultPropertyId, setDefaultPropertyId] = useState(""); // transactions only: fallback property when no per-row column exists
  const [skipBlankPropertyRows, setSkipBlankPropertyRows] = useState(false); // when a row has no property value, drop it instead of using the fallback
  const [autoCleanup, setAutoCleanup] = useState({ skippedHeader: 0, skippedSubtotal: 0 });
  // Tier-1 chat-style clarifications: second-pass AI call after mapping is
  // confirmed. The AI looks at the full row data and returns 0-3 multiple-
  // choice questions about patterns it can't decide on its own (umbrella
  // expenses, potential duplicate properties, etc). Empty array = skip step.
  const [clarifications, setClarifications] = useState([]);
  const [clarificationAnswers, setClarificationAnswers] = useState({}); // { [clarificationId]: optionId }
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // {created, failed, errors[]}
  const [error, setError] = useState("");

  const targetEntity = aiResult?.target_entity || null;
  const targetSchema = aiResult?.target_schema || {};

  // ─── Step 1: handle upload ─────────────────────────────────────────────────
  async function handleFile(file) {
    setError("");
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isCsv   = lower.endsWith(".csv");
    const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");
    if (!isCsv && !isExcel) {
      setError("Only CSV and Excel files (.csv, .xlsx, .xls) are supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File is over 10 MB. Split into smaller files before importing.");
      return;
    }
    setStep("loading");
    setLoadingMessage(`Analyzing ${file.name}… Figuring out how your columns map into PROPBOOKS.`);
    setFileName(file.name);
    try {
      let rows;
      if (isCsv) {
        const text = await file.text();
        rows = parseCSV(text);
      } else {
        rows = await parseExcel(file);
      }
      if (rows.length < 2) {
        setError(`${isCsv ? "CSV" : "Excel sheet"} needs at least a header row and one data row.`);
        setStep("upload");
        return;
      }
      const { rows: cleaned, skippedHeader, skippedSubtotal } = preprocessRows(rows);
      if (cleaned.length < 2) {
        setError(`After cleanup there's nothing to import. The file may not contain transaction or property data.`);
        setStep("upload");
        return;
      }
      const [hdr, ...rest] = cleaned;
      setHeaders(hdr);
      setAllRows(rest);
      setAutoCleanup({ skippedHeader, skippedSubtotal });
      // No targetEntity passed — Edge Function picks via tool_choice: "any".
      // Pass full rows so the clarifications pass (chained inside) can reason
      // over them without waiting for the setAllRows state commit.
      await callInferEdgeFunction(hdr, rest.slice(0, 5), null, rest);
    } catch (e) {
      setError(`Couldn't read ${file.name}: ${e?.message || "unknown error"}`);
      setStep("upload");
    }
  }

  // ─── Step 2: call Edge Function for mapping ────────────────────────────────
  // overrideTarget is non-null when the user clicked "Actually this is X" in
  // the review step to override the AI's auto-detected target. We then
  // re-call the function with that target forced via tool_choice.
  async function callInferEdgeFunction(hdr, sample, overrideTarget, fullRows) {
    setStep("loading");
    setLoadingMessage("Figuring out how your columns map into PROPBOOKS. This usually takes a few seconds.");
    try {
      const requestBody = { sourceHeaders: hdr, sampleRows: sample };
      if (overrideTarget) requestBody.targetEntity = overrideTarget;
      const { data, error: fnErr } = await supabase.functions.invoke("infer-import-mapping", {
        body: requestBody,
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setAiResult(data);
      setMapping(data.mapping || {});

      // Clear any clarifications from a previous run (e.g. user re-inferred as a different target).
      setClarifications([]);
      setClarificationAnswers({});

      // Chain a clarifications call for transactions imports that have blank-
      // property rows. The AI's smart questions render inline in the review
      // step in place of the radio-button blank handling, so this is part of
      // the same "loading" experience — no separate step transition.
      if (data.target_entity === "transactions" && data.mapping?.property && fullRows) {
        const propColIdx = hdr.indexOf(data.mapping.property);
        const blankCount = propColIdx === -1 ? 0 : fullRows.filter(r => !(r[propColIdx] || "").trim()).length;
        if (blankCount >= 3) {
          await fetchClarifications(hdr, fullRows, data.mapping, data.target_schema);
        }
      }
      setStep("review");
    } catch (e) {
      const msg = e?.message || "Couldn't infer mapping.";
      setError(msg);
      setStep("upload");
      showToast(msg, "error");
    }
  }

  // Called from the review step when the user disagrees with the inferred
  // target. Re-runs the AI call with the chosen target forced.
  async function reInferAs(otherTarget) {
    await callInferEdgeFunction(headers, allRows.slice(0, 5), otherTarget, allRows);
  }

  // Second-pass AI call. Returns silently on failure — clarifications are
  // "smart help", never a gate. Run inside callInferEdgeFunction so the
  // whole analysis is one continuous loading spinner from the user's POV.
  async function fetchClarifications(hdr, fullRows, mappingArg, schemaArg) {
    setLoadingMessage("Reading the full file for anything that needs a judgment call…");
    try {
      const normalizedRows = fullRows.map(row => {
        const r = {};
        for (const [field, src] of Object.entries(mappingArg)) {
          if (!src) continue;
          const colIdx = hdr.indexOf(src);
          if (colIdx === -1) continue;
          const spec = schemaArg[field];
          const v = spec ? normalizeValue(field, spec, row[colIdx]) : row[colIdx];
          if (v != null && v !== "") r[field] = v;
        }
        return r;
      });
      const existingProps = PROPERTIES.map(p => p.address || p.name).filter(Boolean);
      const willCreate = computeWillCreateProperties({ mapping: mappingArg, headers: hdr, allRows: fullRows, propertiesList: PROPERTIES });
      const pendingProps = willCreate.map(w => w.name);

      const { data, error: fnErr } = await supabase.functions.invoke("propose-import-clarifications", {
        body: { mapping: mappingArg, rows: normalizedRows, existingProperties: existingProps, pendingProperties: pendingProps },
      });
      if (fnErr || data?.error) {
        console.warn("[ImportWizard] clarifications call failed:", fnErr || data?.error);
        return;
      }
      const cls = Array.isArray(data?.clarifications) ? data.clarifications : [];
      if (cls.length === 0) return;
      // Default each answer to the AI's first option — usually the most likely.
      const defaults = {};
      for (const c of cls) defaults[c.id] = c.options?.[0]?.id || null;
      setClarifications(cls);
      setClarificationAnswers(defaults);
    } catch (e) {
      console.warn("[ImportWizard] clarifications threw:", e);
    }
  }

  // Translate one clarification answer into the same resolution shape that
  // handleImport reads (override of {skipBlank, defaultProperty}). When the
  // user picks "Attach to '524 Speer St'" and Speer doesn't exist yet,
  // returns `pending:524 Speer St` so the auto-create path handles it; when
  // they pick an existing property by name, returns its real UUID.
  function resolveClarifications(answers, cls) {
    let skip = skipBlankPropertyRows;
    let def = defaultPropertyId;
    for (const c of cls) {
      const optId = answers[c.id];
      const opt = c.options.find(o => o.id === optId);
      const ef = opt?.effect;
      if (!ef) continue;
      if (ef.type === "skip_blank_property_rows") {
        skip = true;
      } else if (ef.type === "attach_blank_property_rows_to_value" && ef.value) {
        const lower = ef.value.toLowerCase().trim();
        const existing = PROPERTIES.find(p =>
          (p.name && p.name.toLowerCase().trim() === lower) ||
          (p.address && p.address.toLowerCase().trim() === lower)
        );
        def = existing ? existing.id : `pending:${ef.value}`;
        skip = false;
      }
    }
    return { skipBlank: skip, defaultProperty: def };
  }

  // Single bridge from the review step's confirm button to handleImport.
  // If clarifications were surfaced during the loading pass, the user's
  // answers (already collected inline in the review step) get resolved
  // into an import-time override. Otherwise we run with no override and
  // handleImport reads from the standard skipBlank/defaultProperty state.
  async function handleReviewContinue() {
    if (clarifications.length > 0) {
      const resolution = resolveClarifications(clarificationAnswers, clarifications);
      return handleImport(resolution);
    }
    return handleImport();
  }

  // ─── Step 3: transform + bulk insert ───────────────────────────────────────
  // `resolutionOverride` (optional) lets the clarify step override the
  // skipBlankPropertyRows / defaultPropertyId state without waiting for the
  // (async) setState to commit. When omitted, we read directly from state.
  async function handleImport(resolutionOverride) {
    setImporting(true);
    setStep("importing");
    // Resolve override values up-front — these win over the review-step state
    // when the user came through the clarify step, since setState wouldn't
    // have committed yet at the moment we read state inside this function.
    const effectiveSkipBlank   = resolutionOverride?.skipBlank ?? skipBlankPropertyRows;
    const effectiveDefaultProp = resolutionOverride?.defaultProperty ?? defaultPropertyId;
    let created = 0;
    let propsCreated = 0;
    let blanksSkipped = 0;
    const errors = [];

    // Pre-build a lookup table for transactions: lowercased name OR address
    // → property.id. The match is case-insensitive and partial — "123 Main"
    // in the CSV finds the property named "123 Main St". Auto-created
    // properties are appended to this map as we go so subsequent rows with
    // the same value reuse the new id.
    const propertyByKey = new Map();
    if (targetEntity === "transactions") {
      for (const p of PROPERTIES) {
        if (p.name)    propertyByKey.set(p.name.toLowerCase().trim(), p.id);
        if (p.address) propertyByKey.set(p.address.toLowerCase().trim(), p.id);
      }
    }

    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      const record = {};
      for (const [targetField, sourceHeader] of Object.entries(mapping)) {
        if (!sourceHeader) continue;
        const colIdx = headers.indexOf(sourceHeader);
        if (colIdx === -1) continue;
        const spec = targetSchema[targetField];
        if (!spec) continue;
        const normalized = normalizeValue(targetField, spec, row[colIdx]);
        if (normalized !== null) record[targetField] = normalized;
      }

      // Transactions: normalize type + amount.
      //
      // The DB requires `type` to be one of {"income", "expense"} (check
      // constraint `transactions_type_check`) and the schema description
      // says `amount` is always positive — direction comes from `type`.
      //
      // Sometimes the AI maps a category-like column ("Insurance",
      // "Repairs", "Income") to `type` because the only category that
      // happens to look income-shaped passes the enum check. The other
      // 80% of rows then explode at insert time. To make the import
      // resilient: if `type` isn't a valid enum value after normalization,
      // derive it from the sign of `amount` — the user's file encodes
      // direction as positive/parenthesized-negative which is unambiguous.
      // Either way, we abs() the amount before sending to the DB so the
      // "positive amount + type carries direction" invariant holds.
      if (targetEntity === "transactions") {
        if (typeof record.amount === "number") {
          const validType = record.type === "income" || record.type === "expense" ? record.type : null;
          if (!validType) {
            record.type = record.amount < 0 ? "expense" : "income";
          }
          record.amount = Math.abs(record.amount);
        }
      }

      // Transactions: resolve property_id.
      //   1. Try the mapped `property` column (exact then partial match).
      //   2. If no match → auto-create a new property using the row's value.
      //      Cached per-value so 50 rows for "Oak St" create one property.
      //   3. If the column was blank → use the user's fallback property, or
      //      skip the row if they checked "Skip rows without a property".
      if (targetEntity === "transactions") {
        let propertyId = null;
        const propVal = record.property;
        const propValStr = propVal != null ? String(propVal).trim() : "";

        if (propValStr) {
          const key = propValStr.toLowerCase();
          propertyId = propertyByKey.get(key) || null;
          if (!propertyId) {
            // Partial match: any property whose name/address contains this
            // value or vice versa. Handles "Oak St" → "123 Oak Street".
            for (const [k, id] of propertyByKey.entries()) {
              if (k.includes(key) || key.includes(k)) { propertyId = id; break; }
            }
          }
          if (!propertyId) {
            // No match → auto-create. The review step already showed the
            // user this list so they've signed off on it.
            try {
              const newProp = await createProperty({
                name: propValStr,
                address: propValStr,
                type: "Single Family",
                units: 1,
                status: "Occupied",
              });
              PROPERTIES.push(newProp);
              propertyByKey.set(key, newProp.id);
              if (newProp.address) propertyByKey.set(newProp.address.toLowerCase().trim(), newProp.id);
              propertyId = newProp.id;
              propsCreated++;
            } catch (e) {
              errors.push({ row: i + 2, reason: `couldn't auto-create property "${propValStr}": ${e?.message || "insert failed"}` });
              continue;
            }
          }
        }

        // Row had no property value: fall back, skip, or fail.
        if (!propertyId) {
          if (effectiveSkipBlank) {
            blanksSkipped++;
            continue;
          }
          // The fallback picker emits two value shapes:
          //   1. A real property UUID — use it directly.
          //   2. `pending:<DisplayName>` — the user picked a property that
          //      this same file will create. Create-or-reuse it now using
          //      the auto-create cache so the first blank we hit triggers
          //      the insert and subsequent blanks (and any non-blank rows
          //      with the same name) reuse the new id.
          if (effectiveDefaultProp && effectiveDefaultProp.startsWith("pending:")) {
            const displayName = effectiveDefaultProp.slice("pending:".length);
            const key = displayName.toLowerCase().trim();
            propertyId = propertyByKey.get(key) || null;
            if (!propertyId) {
              try {
                const newProp = await createProperty({
                  name: displayName,
                  address: displayName,
                  type: "Single Family",
                  units: 1,
                  status: "Occupied",
                });
                PROPERTIES.push(newProp);
                propertyByKey.set(key, newProp.id);
                if (newProp.address) propertyByKey.set(newProp.address.toLowerCase().trim(), newProp.id);
                propertyId = newProp.id;
                propsCreated++;
              } catch (e) {
                errors.push({ row: i + 2, reason: `couldn't create fallback property "${displayName}": ${e?.message || "insert failed"}` });
                continue;
              }
            }
          } else {
            propertyId = effectiveDefaultProp || null;
          }
        }
        if (!propertyId) {
          errors.push({ row: i + 2, reason: "no property in this row — pick a fallback property or check 'Skip rows without a property' in the review step" });
          continue;
        }
        record.propertyId = propertyId;
        delete record.property; // virtual field, not a real DB column
      }

      // Skip rows missing required fields.
      const missing = Object.entries(targetSchema).filter(([k, s]) => s.required && (record[k] === undefined || record[k] === null || record[k] === ""));
      if (missing.length > 0) {
        errors.push({ row: i + 2, reason: `missing required: ${missing.map(([k]) => k).join(", ")}` });
        continue;
      }
      try {
        // Push every saved row into the in-memory mirror that the UI reads
        // from. Ledger / PortfolioDashboard / AssetList all read directly
        // from PROPERTIES + TRANSACTIONS (synchronous), so without these
        // pushes the imported rows wouldn't appear until the next page
        // reload (when AppShell re-hydrates from Supabase).
        if (targetEntity === "properties") {
          const saved = await createProperty(record);
          PROPERTIES.push(saved);
        } else if (targetEntity === "transactions") {
          const saved = await createTransaction(record);
          TRANSACTIONS.push(saved);
        }
        created++;
      } catch (e) {
        errors.push({ row: i + 2, reason: e?.message || "insert failed" });
      }
    }

    setImportResult({ created, propsCreated, blanksSkipped, failed: errors.length, errors: errors.slice(0, 10) });
    setImporting(false);
    setStep("done");
    if (created > 0) {
      showToast(`Imported ${created} ${targetEntity === "properties" ? "properties" : "transactions"}${propsCreated > 0 ? ` and created ${propsCreated} new propert${propsCreated === 1 ? "y" : "ies"}` : ""}.`, "success");
      onComplete?.();
    }
  }

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: "min(720px, 95vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Sparkles size={20} color="#e95e00" />
            <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>Import Wizard</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        {step === "upload" && (
          <UploadStep onFile={handleFile} error={error} />
        )}

        {step === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <Loader size={32} color="#e95e00" style={{ animation: "spin 1s linear infinite", marginBottom: 14 }} />
            <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 15 }}>{fileName || "Working…"}</p>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>{loadingMessage || "This usually takes a few seconds."}</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {step === "review" && aiResult && (
          <ReviewStep
            targetEntity={targetEntity}
            targetSchema={targetSchema}
            mapping={mapping}
            setMapping={setMapping}
            headers={headers}
            allRows={allRows}
            confidence={aiResult.confidence}
            notes={aiResult.notes}
            unmapped={aiResult.unmapped_source_headers || []}
            sampleRows={allRows.slice(0, 5)}
            fileName={fileName}
            totalRows={allRows.length}
            autoCleanup={autoCleanup}
            defaultPropertyId={defaultPropertyId}
            setDefaultPropertyId={setDefaultPropertyId}
            skipBlankPropertyRows={skipBlankPropertyRows}
            setSkipBlankPropertyRows={setSkipBlankPropertyRows}
            onBack={() => { setAiResult(null); setMapping({}); setStep("upload"); }}
            onReinterpret={reInferAs}
            onConfirm={handleReviewContinue}
            clarifications={clarifications}
            clarificationAnswers={clarificationAnswers}
            setClarificationAnswer={(cid, oid) => setClarificationAnswers(prev => ({ ...prev, [cid]: oid }))}
          />
        )}

        {step === "importing" && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <Loader size={32} color="#e95e00" style={{ animation: "spin 1s linear infinite", marginBottom: 14 }} />
            <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 15 }}>Importing {allRows.length} row{allRows.length !== 1 ? "s" : ""}…</p>
          </div>
        )}

        {step === "done" && importResult && (
          <DoneStep result={importResult} entity={targetEntity} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

// ── UploadStep ──────────────────────────────────────────────────────────────
// Just a file picker. We figure out whether the file is Properties or
// Transactions automatically once it's uploaded, so the user doesn't have
// to commit to a target upfront.
function UploadStep({ onFile, error }) {
  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
        Drop in a CSV or Excel file. We&rsquo;ll read your column headers and a few sample rows, figure out whether it&rsquo;s properties or transactions, propose how the columns map into PROPBOOKS, and let you review before anything is saved.
      </p>

      <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 40, border: "1.5px dashed var(--border)", borderRadius: 12, background: "var(--surface-alt)", cursor: "pointer", transition: "all 0.15s" }}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#e95e00"; }}
        onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--border)"; onFile(e.dataTransfer.files?.[0]); }}>
        <Upload size={32} color="var(--text-muted)" />
        <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 15 }}>Drop your file here or click to browse</p>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>CSV or Excel (.xlsx / .xls). Up to 10 MB.</p>
        <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: "none" }} onChange={e => onFile(e.target.files?.[0])} />
      </label>

      {error && (
        <div style={{ marginTop: 14, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}
    </div>
  );
}

// ── ReviewStep ──────────────────────────────────────────────────────────────
function ReviewStep({ targetEntity, targetSchema, mapping, setMapping, headers, allRows, confidence, notes, unmapped, sampleRows, fileName, totalRows, autoCleanup, defaultPropertyId, setDefaultPropertyId, skipBlankPropertyRows, setSkipBlankPropertyRows, clarifications, clarificationAnswers, setClarificationAnswer, onBack, onReinterpret, onConfirm }) {
  const fields = Object.entries(targetSchema);
  const confColor = confidence >= 80 ? "var(--c-green)" : confidence >= 50 ? "#e95e00" : "var(--c-red)";
  // Which sourceHeaders are still assigned to a target field (for the dropdown to show "used elsewhere").
  const usedHeaders = useMemo(() => {
    const m = {};
    for (const [field, src] of Object.entries(mapping)) if (src) m[src] = field;
    return m;
  }, [mapping]);

  function setField(field, sourceHeader) {
    setMapping(prev => ({ ...prev, [field]: sourceHeader || null }));
  }

  const isTransactions = targetEntity === "transactions";
  const hasPropertyColumn = isTransactions && !!mapping.property;

  // Walk the rows once, classify each by what'll happen to its property
  // assignment at import time. Lets us surface the breakdown in the review
  // step instead of dumping it as errors after the import runs.
  const propertyResolution = useMemo(() => {
    if (!isTransactions) return null;
    if (!hasPropertyColumn) {
      return { hasColumn: false, matchedCount: 0, matchedDistinct: 0, willCreate: [], blank: allRows.length };
    }
    const propertyByKey = new Map();
    for (const p of PROPERTIES) {
      if (p.name)    propertyByKey.set(p.name.toLowerCase().trim(), p.id);
      if (p.address) propertyByKey.set(p.address.toLowerCase().trim(), p.id);
    }
    const colIdx = headers.indexOf(mapping.property);
    if (colIdx === -1) return { hasColumn: false, matchedCount: 0, matchedDistinct: 0, willCreate: [], blank: allRows.length };

    const matchedSet = new Set();
    const willCreate = new Map(); // displayName → row count
    let matchedCount = 0;
    let blank = 0;
    for (const row of allRows) {
      const raw = (row[colIdx] || "").trim();
      if (!raw) { blank++; continue; }
      const key = raw.toLowerCase();
      let matched = propertyByKey.has(key);
      if (!matched) {
        for (const k of propertyByKey.keys()) {
          if (k.includes(key) || key.includes(k)) { matched = true; break; }
        }
      }
      if (matched) { matchedCount++; matchedSet.add(key); }
      else        { willCreate.set(raw, (willCreate.get(raw) || 0) + 1); }
    }
    const willCreateList = Array.from(willCreate.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    return { hasColumn: true, matchedCount, matchedDistinct: matchedSet.size, willCreate: willCreateList, blank };
  }, [isTransactions, hasPropertyColumn, mapping.property, allRows, headers]);

  // Confirm-button gate. When the AI surfaced clarifications, those replace
  // the radio-button blank handling, so the gate is "every clarification has
  // an answer selected" instead of "default property picked OR skip toggle".
  const blanks = propertyResolution?.blank || 0;
  const hasClarifications = Array.isArray(clarifications) && clarifications.length > 0;
  const allClarificationsAnswered = hasClarifications && clarifications.every(c => !!clarificationAnswers[c.id]);
  const blanksHandled = hasClarifications ? allClarificationsAnswered : (!!defaultPropertyId || skipBlankPropertyRows);
  const canConfirm = !isTransactions ? true : (blanks === 0 || blanksHandled);

  // Which mapped fields make the most sense as quick-id columns when
  // showing the user the actual rows that are missing a property value.
  // Prefer date + payee + amount as the "who and how much" trio; fall back
  // to anything else they mapped.
  const blankPreviewFields = useMemo(() => {
    if (!isTransactions) return [];
    const priority = ["date", "paidTo", "receivedFrom", "amount", "category", "notes"];
    return priority.filter(f => mapping[f]);
  }, [isTransactions, mapping]);

  // First 10 blank-property rows, with the mapping + normalizer applied so
  // the preview shows real values (1/15/2025, $58.58) not raw cells.
  const blankPreviewRows = useMemo(() => {
    if (!isTransactions || !propertyResolution?.hasColumn) return [];
    const propColIdx = headers.indexOf(mapping.property);
    if (propColIdx === -1) return [];
    const out = [];
    for (let i = 0; i < allRows.length && out.length < 10; i++) {
      const row = allRows[i];
      if (((row[propColIdx] || "").trim()) !== "") continue;
      const mapped = {};
      for (const f of blankPreviewFields) {
        const colIdx = headers.indexOf(mapping[f]);
        if (colIdx === -1) continue;
        const spec = targetSchema[f];
        const v = spec ? normalizeValue(f, spec, row[colIdx]) : row[colIdx];
        if (v != null && v !== "") mapped[f] = v;
      }
      out.push(mapped);
    }
    return out;
  }, [isTransactions, propertyResolution?.hasColumn, mapping, headers, allRows, targetSchema, blankPreviewFields]);

  const otherTarget = targetEntity === "properties" ? "transactions" : "properties";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, padding: "12px 14px", background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
        <div>
          <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}>{fileName}</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>{totalRows} data row{totalRows !== 1 ? "s" : ""} · {headers.length} columns</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "var(--surface)", border: `1px solid ${confColor}`, borderRadius: 20 }}>
          <Sparkles size={12} color={confColor} />
          <span style={{ fontSize: 11, fontWeight: 700, color: confColor }}>{confidence}% confidence</span>
        </div>
      </div>

      {/* Inferred-target banner with override link */}
      <div style={{ marginBottom: 14, padding: "12px 14px", background: "rgba(233,94,0,0.06)", border: "1px solid rgba(233,94,0,0.25)", borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Detected import type</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{TARGET_LABELS[targetEntity] || targetEntity}</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{TARGET_DESCRIPTIONS[targetEntity] || ""}</p>
          </div>
          <button type="button" onClick={() => onReinterpret(otherTarget)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer", whiteSpace: "nowrap" }}>
            Actually it&rsquo;s {TARGET_LABELS[otherTarget]}
          </button>
        </div>
      </div>

      {notes && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--info-tint)", border: "1px solid var(--info-border)", borderRadius: 10, color: "var(--c-blue)", fontSize: 12 }}>
          <strong style={{ fontWeight: 700 }}>Mapping notes:</strong> {notes}
        </div>
      )}

      {(autoCleanup?.skippedHeader > 0 || autoCleanup?.skippedSubtotal > 0) && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--surface-alt)", border: "1px solid var(--border-subtle)", borderRadius: 10, fontSize: 12, color: "var(--text-secondary)" }}>
          <strong style={{ fontWeight: 700, color: "var(--text-primary)" }}>Auto-cleanup:</strong>{" "}
          {autoCleanup.skippedHeader > 0 && `skipped ${autoCleanup.skippedHeader} title row${autoCleanup.skippedHeader > 1 ? "s" : ""} at the top of the file`}
          {autoCleanup.skippedHeader > 0 && autoCleanup.skippedSubtotal > 0 && "; "}
          {autoCleanup.skippedSubtotal > 0 && `dropped ${autoCleanup.skippedSubtotal} subtotal row${autoCleanup.skippedSubtotal > 1 ? "s" : ""}`}
          . If that looks wrong, click Back and we&rsquo;ll start over.
        </div>
      )}

      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Review the mapping</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {fields.map(([field, spec]) => {
          const current = mapping[field] || "";
          return (
            <div key={field} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10, alignItems: "center", padding: "6px 10px", borderRadius: 8, background: "var(--surface-alt)" }}>
              <div>
                <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}>
                  {field}{spec.required && <span style={{ color: "var(--c-red)", marginLeft: 4 }}>*</span>}
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{spec.type}{spec.enum ? ` · ${spec.enum.length} options` : ""}</p>
              </div>
              <select value={current} onChange={e => setField(field, e.target.value)} style={{ ...iS, padding: "7px 10px", fontSize: 13 }}>
                <option value="">— skip —</option>
                {headers.map(h => (
                  <option key={h} value={h}>
                    {h}{usedHeaders[h] && usedHeaders[h] !== field ? `  (also using for ${usedHeaders[h]})` : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {unmapped.length > 0 && (
        <div style={{ marginBottom: 14, padding: "8px 12px", background: "var(--surface-alt)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          <strong>Unmapped columns:</strong> {unmapped.join(", ")} — these will be ignored.
        </div>
      )}

      {isTransactions && (
        <TransactionPropertySection
          propertyResolution={propertyResolution}
          defaultPropertyId={defaultPropertyId}
          setDefaultPropertyId={setDefaultPropertyId}
          skipBlankPropertyRows={skipBlankPropertyRows}
          setSkipBlankPropertyRows={setSkipBlankPropertyRows}
          blankPreviewRows={blankPreviewRows}
          blankPreviewFields={blankPreviewFields}
          totalRows={totalRows}
          clarifications={clarifications}
          clarificationAnswers={clarificationAnswers}
          setClarificationAnswer={setClarificationAnswer}
        />
      )}

      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Preview — first {Math.min(sampleRows.length, 5)} of {totalRows} rows
      </p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
        This is exactly what will be imported. If anything looks wrong, fix the mapping above or go back and try a different file.
      </p>
      <div style={{ marginBottom: 18, border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "auto", maxHeight: 200 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)", position: "sticky", top: 0 }}>
              {Object.entries(mapping).filter(([, src]) => src).map(([field]) => (
                <th key={field} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", fontSize: 10, borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>
                  {field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sampleRows.map((row, i) => {
              const mappedFields = Object.entries(mapping).filter(([, src]) => src);
              return (
                <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}>
                  {mappedFields.map(([field, src]) => {
                    const colIdx = headers.indexOf(src);
                    const raw = colIdx !== -1 ? row[colIdx] : "";
                    const spec = targetSchema[field];
                    const normalized = spec ? normalizeValue(field, spec, raw) : raw;
                    const display = normalized != null && normalized !== "" ? String(normalized) : null;
                    return (
                      <td key={field} style={{ padding: "6px 10px", color: "var(--text-secondary)", whiteSpace: "nowrap", verticalAlign: "top" }}>
                        {display ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onBack} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={14} /> Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          title={!canConfirm ? (hasClarifications ? "Pick an answer for each question above" : "Pick a default property first") : ""}
          style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: canConfirm ? "pointer" : "not-allowed", opacity: canConfirm ? 1 : 0.5, display: "flex", alignItems: "center", gap: 6 }}
        >
          Import {totalRows} row{totalRows !== 1 ? "s" : ""} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── TransactionPropertySection ───────────────────────────────────────────────
// Renders the property-handling controls for transaction imports. Three
// distinct UI surfaces, driven by `propertyResolution`:
//
//   1. "Matched X rows to Y existing properties"  — pure info
//   2. "Will create N new properties: a, b, c, …" — collapsible list,
//                                                    surfaces auto-creates
//   3. "M rows have no property"                  — radio: fallback vs skip
//
// Has an inline quick-add form for users who are starting from zero
// properties (so they don't have to leave the wizard and lose their parsed
// file just to create their first property).
function TransactionPropertySection({ propertyResolution, defaultPropertyId, setDefaultPropertyId, skipBlankPropertyRows, setSkipBlankPropertyRows, blankPreviewRows, blankPreviewFields, totalRows, clarifications, clarificationAnswers, setClarificationAnswer }) {
  const { showToast } = useToast();
  const [showAllCreates, setShowAllCreates] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [qaName, setQaName] = useState("");
  const [qaAddress, setQaAddress] = useState("");
  const [qaSaving, setQaSaving] = useState(false);

  const hasColumn = propertyResolution?.hasColumn;
  const matched = propertyResolution?.matchedCount || 0;
  const matchedDistinct = propertyResolution?.matchedDistinct || 0;
  const willCreate = propertyResolution?.willCreate || [];
  const willCreateRows = willCreate.reduce((s, p) => s + p.count, 0);
  const blank = propertyResolution?.blank || 0;
  const visibleCreates = showAllCreates ? willCreate : willCreate.slice(0, 5);

  // The picker lists BOTH existing properties and properties about to be
  // auto-created from this file. The pending entries use a `pending:NAME`
  // synthetic value so handleImport knows to create-or-reuse on demand.
  const pickerHasOptions = PROPERTIES.length > 0 || willCreate.length > 0;
  // Quick-add is shown if (a) there's literally nothing to pick from yet, or
  // (b) the user explicitly clicked "+ New" to add another one.
  const showQuickAdd = quickAddOpen || (!pickerHasOptions && !skipBlankPropertyRows && blank > 0);

  async function handleQuickAdd() {
    const name = qaName.trim();
    if (!name) return;
    setQaSaving(true);
    try {
      const saved = await createProperty({ name, address: qaAddress.trim() || null, type: "Single Family", units: 1, status: "Occupied" });
      PROPERTIES.push(saved); // sync the in-memory mirror so the dropdown sees it immediately
      setDefaultPropertyId(saved.id);
      setQuickAddOpen(false);
      setQaName("");
      setQaAddress("");
      showToast(`Added ${saved.name}.`, "success");
    } catch (e) {
      showToast(`Couldn't add property: ${e?.message || "unknown error"}`, "error");
    } finally {
      setQaSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 14, padding: "12px 14px", background: "var(--surface-alt)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Property handling</p>

      {/* Case A: file has a property column. Show full breakdown. */}
      {hasColumn && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: blank > 0 ? 12 : 0 }}>
          {matched > 0 && (
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <span style={{ color: "var(--c-green)", fontWeight: 700 }}>✓</span>{" "}
              Matched <strong>{matched}</strong> row{matched !== 1 ? "s" : ""} to <strong>{matchedDistinct}</strong> existing propert{matchedDistinct === 1 ? "y" : "ies"}.
            </p>
          )}

          {willCreate.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <p>
                <span style={{ color: "#e95e00", fontWeight: 700 }}>+</span>{" "}
                We&rsquo;ll create <strong>{willCreate.length}</strong> new propert{willCreate.length === 1 ? "y" : "ies"} for <strong>{willCreateRows}</strong> row{willCreateRows !== 1 ? "s" : ""}:
              </p>
              <ul style={{ margin: "6px 0 0 18px", padding: 0, fontSize: 11.5 }}>
                {visibleCreates.map(p => (
                  <li key={p.name} style={{ marginBottom: 2 }}>
                    <span style={{ color: "var(--text-primary)" }}>{p.name}</span> <span style={{ color: "var(--text-muted)" }}>({p.count} row{p.count !== 1 ? "s" : ""})</span>
                  </li>
                ))}
              </ul>
              {willCreate.length > 5 && (
                <button type="button" onClick={() => setShowAllCreates(s => !s)}
                  style={{ marginTop: 4, background: "none", border: "none", color: "var(--c-blue)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  {showAllCreates ? "Show fewer" : `Show all ${willCreate.length}`}
                </button>
              )}
              <p style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                If any of these look like duplicates of properties you already have, go back and either rename them in the file or add the missing properties first.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Case B: no property column. Frame the picker as "which property are these for". */}
      {!hasColumn && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>
          Your file doesn&rsquo;t have a property column, so every row needs a property to attach to. Pick one below, or skip the rows entirely.
        </p>
      )}

      {/* When the AI returned clarifications, they replace the deterministic
          radio-button blank-handling UI below. The user picks an answer per
          question; the wizard translates effects into the same skipBlank /
          defaultProperty shape at import time. */}
      {blank > 0 && Array.isArray(clarifications) && clarifications.length > 0 && (
        <div style={{ padding: "12px 14px", background: "rgba(233,94,0,0.06)", border: "1px solid rgba(233,94,0,0.25)", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <MessageCircle size={18} color="#e95e00" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                {clarifications.length === 1 ? "A quick question" : "A few quick questions"}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>
                I noticed {clarifications.length === 1 ? "something" : "a few things"} in your file that {clarifications.length === 1 ? "needs" : "need"} a judgment call. Pick the option that fits.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {clarifications.map(c => (
              <div key={c.id} style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
                <p style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 4 }}>{c.summary}</p>
                {c.example_payees && c.example_payees.length > 0 && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontStyle: "italic" }}>
                    Examples: {c.example_payees.slice(0, 3).join(", ")}
                    {c.row_count ? ` · ${c.row_count} row${c.row_count !== 1 ? "s" : ""}` : ""}
                  </p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {c.options.map(opt => {
                    const selected = clarificationAnswers[c.id] === opt.id;
                    return (
                      <label key={opt.id} style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "7px 10px",
                        borderRadius: 8,
                        border: `1px solid ${selected ? "#e95e00" : "var(--border-subtle)"}`,
                        background: selected ? "rgba(233,94,0,0.08)" : "var(--surface-alt)",
                        cursor: "pointer",
                        transition: "all 0.12s",
                      }}>
                        <input
                          type="radio"
                          name={`clarify-${c.id}`}
                          checked={selected}
                          onChange={() => setClarificationAnswer(c.id, opt.id)}
                          style={{ marginTop: 2 }}
                        />
                        <span style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.4 }}>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standard deterministic blank handling — used when the AI returned no
          clarifications (no blanks, no ambiguity, or the AI call failed). */}
      {blank > 0 && (!Array.isArray(clarifications) || clarifications.length === 0) && (
        <div style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600, marginBottom: hasColumn && blankPreviewRows.length > 0 ? 6 : 8 }}>
            {hasColumn
              ? <><span style={{ color: "#e95e00", fontWeight: 700 }}>⚠</span> <strong>{blank}</strong> row{blank !== 1 ? "s" : ""} {blank === 1 ? "is" : "are"} missing a property value.</>
              : <>All <strong>{totalRows}</strong> row{totalRows !== 1 ? "s" : ""} need a property assignment.</>}
          </p>

          {/* Preview of the actual blank rows — defaults open when ≤5 blanks
              so the user immediately sees what they're deciding about. */}
          {hasColumn && blankPreviewRows.length > 0 && blankPreviewFields.length > 0 && (
            <details open={blank <= 5} style={{ marginBottom: 10, fontSize: 11.5 }}>
              <summary style={{ cursor: "pointer", color: "var(--c-blue)", fontWeight: 600, marginBottom: 6, userSelect: "none" }}>
                {blank <= blankPreviewRows.length ? `Show the ${blank} blank row${blank !== 1 ? "s" : ""}` : `Show the first ${blankPreviewRows.length} (of ${blank})`}
              </summary>
              <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 6, overflow: "auto", maxHeight: 150 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-alt)", position: "sticky", top: 0 }}>
                      {blankPreviewFields.map(f => (
                        <th key={f} style={{ padding: "5px 8px", textAlign: "left", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", fontSize: 9.5, whiteSpace: "nowrap" }}>{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {blankPreviewRows.map((mapped, i) => (
                      <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}>
                        {blankPreviewFields.map(f => (
                          <td key={f} style={{ padding: "5px 8px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                            {mapped[f] != null && mapped[f] !== "" ? String(mapped[f]) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {blank > blankPreviewRows.length && (
                <p style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                  …and {blank - blankPreviewRows.length} more.
                </p>
              )}
            </details>
          )}

          <p style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600, marginBottom: 6 }}>What should we do with {blank === 1 ? "it" : "them"}?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="radio" name="blank-handling" checked={!skipBlankPropertyRows} onChange={() => setSkipBlankPropertyRows(false)} />
              <span><strong style={{ color: "var(--text-primary)" }}>Attach {blank === 1 ? "it" : "them all"} to a property</strong></span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="radio" name="blank-handling" checked={skipBlankPropertyRows} onChange={() => setSkipBlankPropertyRows(true)} />
              <span><strong style={{ color: "var(--text-primary)" }}>Skip {blank === 1 ? "it" : "them"}</strong> — won&rsquo;t be imported (you&rsquo;ll see the count on the next screen)</span>
            </label>
          </div>

          {!skipBlankPropertyRows && (
            <div style={{ marginTop: 10 }}>
              {pickerHasOptions && !showQuickAdd && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={defaultPropertyId} onChange={e => setDefaultPropertyId(e.target.value)} style={{ ...iS, padding: "8px 12px", fontSize: 13, flex: 1 }}>
                    <option value="">— pick a property —</option>
                    {PROPERTIES.length > 0 && (
                      <optgroup label="Your existing properties">
                        {PROPERTIES.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.address ? ` · ${p.address}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {willCreate.length > 0 && (
                      <optgroup label="New properties from this file">
                        {willCreate.map(w => (
                          <option key={`pending:${w.name}`} value={`pending:${w.name}`}>
                            {w.name} (will be created)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button type="button" onClick={() => setQuickAddOpen(true)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    + New
                  </button>
                </div>
              )}

              {showQuickAdd && (
                <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {!pickerHasOptions ? "Add your first property" : "Add a new property"}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8, marginBottom: 8 }}>
                    <input
                      placeholder="Name (e.g. Oak Street Duplex)"
                      value={qaName}
                      onChange={e => setQaName(e.target.value)}
                      style={{ ...iS, padding: "8px 12px", fontSize: 13 }}
                      autoFocus
                    />
                    <input
                      placeholder="Address (optional)"
                      value={qaAddress}
                      onChange={e => setQaAddress(e.target.value)}
                      style={{ ...iS, padding: "8px 12px", fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={handleQuickAdd} disabled={!qaName.trim() || qaSaving}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#e95e00", color: "#fff", fontSize: 13, fontWeight: 700, cursor: !qaName.trim() || qaSaving ? "not-allowed" : "pointer", opacity: !qaName.trim() || qaSaving ? 0.5 : 1 }}>
                      {qaSaving ? "Adding…" : "Add property"}
                    </button>
                    {pickerHasOptions && (
                      <button type="button" onClick={() => { setQuickAddOpen(false); setQaName(""); setQaAddress(""); }}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DoneStep ────────────────────────────────────────────────────────────────
function DoneStep({ result, entity, onClose }) {
  const ok = result.failed === 0;
  const propsCreated = result.propsCreated || 0;
  const blanksSkipped = result.blanksSkipped || 0;
  return (
    <div style={{ textAlign: "center", padding: "30px 20px" }}>
      {ok
        ? <CheckCircle size={48} color="var(--c-green)" style={{ marginBottom: 12 }} />
        : <AlertCircle size={48} color="#e95e00" style={{ marginBottom: 12 }} />}
      <h3 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        {result.created > 0 ? `Imported ${result.created} ${entity === "properties" ? "propert" + (result.created === 1 ? "y" : "ies") : "transaction" + (result.created === 1 ? "" : "s")}` : "Nothing imported"}
      </h3>
      {propsCreated > 0 && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 6 }}>
          Created <strong style={{ color: "var(--text-primary)" }}>{propsCreated}</strong> new propert{propsCreated === 1 ? "y" : "ies"} along the way.
        </p>
      )}
      {blanksSkipped > 0 && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 6 }}>
          Skipped <strong style={{ color: "var(--text-primary)" }}>{blanksSkipped}</strong> row{blanksSkipped !== 1 ? "s" : ""} with no property listed.
        </p>
      )}
      {result.failed > 0 && (
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 12 }}>
          {result.failed} row{result.failed !== 1 ? "s" : ""} couldn't be imported. First few errors below.
        </p>
      )}
      {result.errors.length > 0 && (
        <div style={{ textAlign: "left", maxHeight: 160, overflowY: "auto", marginBottom: 18, padding: 12, background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
          {result.errors.map((e, i) => (
            <p key={i} style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
              <strong>Row {e.row}:</strong> {e.reason}
            </p>
          ))}
        </div>
      )}
      <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        Done
      </button>
    </div>
  );
}
