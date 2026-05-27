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
import { Upload, CheckCircle, AlertCircle, Loader, ArrowRight, ArrowLeft, Sparkles, X } from "lucide-react";
import { supabase } from "../supabase.js";
import { useToast } from "../toast.jsx";
import { createProperty } from "../db/properties.js";
import { createTransaction } from "../db/transactions.js";
import { iS } from "../shared.jsx";
import { PROPERTIES } from "../mockData.js";

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

// Clean up common report-export gremlins before sending to the AI:
//   1. Strip the UTF-8 BOM (﻿) from header text — Excel/QuickBooks
//      exports often leave it on the first cell, which makes the AI treat
//      "Date" as a different string than a date header.
//   2. Trim whitespace from headers.
//   3. Drop any column whose header is empty AND every data cell is empty —
//      pretty-printed reports pad the left and right with blank columns.
//   4. Drop columns whose header looks like a "padding" marker (single space, etc.).
// Header trimming is safe; data trimming happens later in the normalizer so
// raw values are preserved for inspection in the review step.
function cleanParsedRows(rows) {
  if (rows.length === 0) return rows;
  // Strip BOM from every cell once — it's only ever a parsing artifact.
  const stripped = rows.map(r => r.map(c => c.replace(/^﻿/, "")));
  const [rawHeader, ...rest] = stripped;
  const trimmedHeader = rawHeader.map(h => h.trim());

  // For each column index, decide if it's keep-worthy.
  const keepCols = trimmedHeader.map((h, i) => {
    if (h !== "") return true; // named column → keep
    // Header is empty: only drop if EVERY data row is also empty here.
    const anyData = rest.some(r => (r[i] ?? "").trim() !== "");
    return anyData;
  });

  const filterRow = (r) => keepCols.map((keep, i) => keep ? (r[i] ?? "") : null).filter(c => c !== null);
  return [filterRow(trimmedHeader), ...rest.map(filterRow)];
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
  const [step, setStep] = useState("upload");    // upload → loading → review → importing → done
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [allRows, setAllRows] = useState([]);    // raw string rows (no header)
  const [aiResult, setAiResult] = useState(null); // {mapping, confidence, notes, target_entity, target_schema, unmapped_source_headers}
  const [mapping, setMapping] = useState({});    // editable copy of aiResult.mapping
  const [defaultPropertyId, setDefaultPropertyId] = useState(""); // transactions only: fallback property when no per-row column exists
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
      const cleaned = cleanParsedRows(rows);
      const [hdr, ...rest] = cleaned;
      setHeaders(hdr);
      setAllRows(rest);
      // No targetEntity passed — Edge Function picks via tool_choice: "any".
      await callInferEdgeFunction(hdr, rest.slice(0, 5), null);
    } catch (e) {
      setError(`Couldn't read ${file.name}: ${e?.message || "unknown error"}`);
      setStep("upload");
    }
  }

  // ─── Step 2: call Edge Function for mapping ────────────────────────────────
  // overrideTarget is non-null when the user clicked "Actually this is X" in
  // the review step to override the AI's auto-detected target. We then
  // re-call the function with that target forced via tool_choice.
  async function callInferEdgeFunction(hdr, sample, overrideTarget) {
    setStep("loading");
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
    await callInferEdgeFunction(headers, allRows.slice(0, 5), otherTarget);
  }

  // ─── Step 3: transform + bulk insert ───────────────────────────────────────
  async function handleImport() {
    setImporting(true);
    setStep("importing");
    let created = 0;
    const errors = [];

    // Pre-build a lookup table for transactions: lowercased name OR address
    // → property.id. The match is case-insensitive and partial — "123 Main"
    // in the CSV finds the property named "123 Main St".
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

      // Transactions: resolve property_id. Try the mapped `property` column
      // first (look up by name/address), then fall back to the default
      // property the user picked. If neither resolves, fail the row.
      if (targetEntity === "transactions") {
        let propertyId = null;
        const propVal = record.property;
        if (propVal) {
          const key = String(propVal).toLowerCase().trim();
          propertyId = propertyByKey.get(key) || null;
          if (!propertyId) {
            // Partial match: any property whose name/address contains this
            // value or vice versa. Handles "Oak St" → "123 Oak Street".
            for (const [k, id] of propertyByKey.entries()) {
              if (k.includes(key) || key.includes(k)) { propertyId = id; break; }
            }
          }
        }
        if (!propertyId) propertyId = defaultPropertyId || null;
        if (!propertyId) {
          errors.push({ row: i + 2, reason: propVal
            ? `couldn't match "${propVal}" to any property — pick a default property below or add the property first`
            : "no property — pick a default property below" });
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
        if (targetEntity === "properties")        await createProperty(record);
        else if (targetEntity === "transactions") await createTransaction(record);
        created++;
      } catch (e) {
        errors.push({ row: i + 2, reason: e?.message || "insert failed" });
      }
    }

    setImportResult({ created, failed: errors.length, errors: errors.slice(0, 10) });
    setImporting(false);
    setStep("done");
    if (created > 0) {
      showToast(`Imported ${created} ${targetEntity === "properties" ? "properties" : "transactions"}.`, "success");
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
            <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 15 }}>Analyzing {fileName}…</p>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>Figuring out how your columns map into PROPBOOKS. This usually takes a few seconds.</p>
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
            confidence={aiResult.confidence}
            notes={aiResult.notes}
            unmapped={aiResult.unmapped_source_headers || []}
            sampleRows={allRows.slice(0, 3)}
            fileName={fileName}
            totalRows={allRows.length}
            defaultPropertyId={defaultPropertyId}
            setDefaultPropertyId={setDefaultPropertyId}
            onBack={() => { setAiResult(null); setMapping({}); setStep("upload"); }}
            onReinterpret={reInferAs}
            onConfirm={handleImport}
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
function ReviewStep({ targetEntity, targetSchema, mapping, setMapping, headers, confidence, notes, unmapped, sampleRows, fileName, totalRows, defaultPropertyId, setDefaultPropertyId, onBack, onReinterpret, onConfirm }) {
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

  // Transactions need a property_id per row. If the CSV doesn't have a
  // property column (or the AI couldn't map one), the user must pick a
  // default property here — otherwise the import would fail with FK errors.
  const isTransactions = targetEntity === "transactions";
  const hasPropertyColumn = !!mapping.property;
  const needsDefaultProperty = isTransactions && !hasPropertyColumn;
  const canConfirm = !needsDefaultProperty || !!defaultPropertyId;

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
          hasPropertyColumn={hasPropertyColumn}
          needsDefaultProperty={needsDefaultProperty}
          defaultPropertyId={defaultPropertyId}
          setDefaultPropertyId={setDefaultPropertyId}
        />
      )}

      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Sample of what will be imported</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, maxHeight: 160, overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 8 }}>
        {sampleRows.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Row {i + 1}:</span>
            <span style={{ wordBreak: "break-word" }}>
              {Object.entries(mapping).filter(([, src]) => src).map(([field, src]) => {
                const colIdx = headers.indexOf(src);
                const val = colIdx !== -1 ? row[colIdx] : "";
                return <span key={field} style={{ marginRight: 10 }}><strong>{field}:</strong> {val || "—"}</span>;
              })}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onBack} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={14} /> Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          title={!canConfirm ? "Pick a default property first" : ""}
          style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: canConfirm ? "pointer" : "not-allowed", opacity: canConfirm ? 1 : 0.5, display: "flex", alignItems: "center", gap: 6 }}
        >
          Import {totalRows} row{totalRows !== 1 ? "s" : ""} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── TransactionPropertySection ───────────────────────────────────────────────
// Renders the "which property" picker for transaction imports. Includes a
// "Quick-add property" inline form so users with zero properties (or who
// realize mid-import that their property isn't in the list) can create one
// without leaving the wizard and losing their parsed file.
function TransactionPropertySection({ hasPropertyColumn, needsDefaultProperty, defaultPropertyId, setDefaultPropertyId }) {
  const { showToast } = useToast();
  const [showQuickAdd, setShowQuickAdd] = useState(PROPERTIES.length === 0);
  const [qaName, setQaName] = useState("");
  const [qaAddress, setQaAddress] = useState("");
  const [qaSaving, setQaSaving] = useState(false);

  async function handleQuickAdd() {
    const name = qaName.trim();
    if (!name) return;
    setQaSaving(true);
    try {
      const saved = await createProperty({ name, address: qaAddress.trim() || null, type: "Single Family", units: 1, status: "Occupied" });
      PROPERTIES.push(saved); // sync the in-memory mirror so the dropdown sees it immediately
      setDefaultPropertyId(saved.id);
      setShowQuickAdd(false);
      setQaName("");
      setQaAddress("");
      showToast(`Added ${saved.name}.`, "success");
    } catch (e) {
      showToast(`Couldn't add property: ${e?.message || "unknown error"}`, "error");
    } finally {
      setQaSaving(false);
    }
  }

  const label = hasPropertyColumn ? "Fallback property" : "Which property are these transactions for?";
  const helpText = hasPropertyColumn
    ? "Each row is matched against your properties by the Property column. If a row's value doesn't match anything, this fallback is used."
    : "Every transaction has to belong to a property. Pick which one these rows are for — every row will be attached to it.";

  return (
    <div style={{ marginBottom: 14, padding: "12px 14px", background: "var(--surface-alt)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
        {label}{needsDefaultProperty && <span style={{ color: "var(--c-red)", marginLeft: 4 }}>*</span>}
      </p>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>{helpText}</p>

      {PROPERTIES.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: showQuickAdd ? 10 : 0 }}>
          <select value={defaultPropertyId} onChange={e => setDefaultPropertyId(e.target.value)} style={{ ...iS, padding: "8px 12px", fontSize: 13, flex: 1 }}>
            <option value="">— pick a property —</option>
            {PROPERTIES.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.address ? ` · ${p.address}` : ""}
              </option>
            ))}
          </select>
          {!showQuickAdd && (
            <button type="button" onClick={() => setShowQuickAdd(true)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              + New
            </button>
          )}
        </div>
      )}

      {showQuickAdd && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {PROPERTIES.length === 0 ? "Add your first property" : "Add a new property"}
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
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.4 }}>
            We&rsquo;ll create a Single Family property with these basics — you can fill in purchase price, loan details, and the rest from the property page later.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={handleQuickAdd} disabled={!qaName.trim() || qaSaving}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#e95e00", color: "#fff", fontSize: 13, fontWeight: 700, cursor: !qaName.trim() || qaSaving ? "not-allowed" : "pointer", opacity: !qaName.trim() || qaSaving ? 0.5 : 1 }}>
              {qaSaving ? "Adding…" : "Add property"}
            </button>
            {PROPERTIES.length > 0 && (
              <button type="button" onClick={() => { setShowQuickAdd(false); setQaName(""); setQaAddress(""); }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── DoneStep ────────────────────────────────────────────────────────────────
function DoneStep({ result, entity, onClose }) {
  const ok = result.failed === 0;
  return (
    <div style={{ textAlign: "center", padding: "30px 20px" }}>
      {ok
        ? <CheckCircle size={48} color="var(--c-green)" style={{ marginBottom: 12 }} />
        : <AlertCircle size={48} color="#e95e00" style={{ marginBottom: 12 }} />}
      <h3 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        {result.created > 0 ? `Imported ${result.created} ${entity === "properties" ? "propert" + (result.created === 1 ? "y" : "ies") : "transaction" + (result.created === 1 ? "" : "s")}` : "Nothing imported"}
      </h3>
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
