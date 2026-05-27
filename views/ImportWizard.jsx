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
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader, ArrowRight, ArrowLeft, Sparkles, X } from "lucide-react";
import { supabase } from "../supabase.js";
import { useToast } from "../toast.jsx";
import { createProperty } from "../db/properties.js";
import { createTransaction } from "../db/transactions.js";
import { iS } from "../shared.jsx";

const TARGETS = [
  { id: "properties",   label: "Properties",   icon: FileSpreadsheet, sub: "Rentals, addresses, purchase prices, loans" },
  { id: "transactions", label: "Transactions", icon: FileSpreadsheet, sub: "Income and expense entries with dates and amounts" },
];

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
  const [step, setStep] = useState("pick");      // pick → loading → review → importing → done
  const [targetEntity, setTargetEntity] = useState("properties");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [allRows, setAllRows] = useState([]);    // raw string rows (no header)
  const [aiResult, setAiResult] = useState(null); // {mapping, confidence, notes, target_schema, unmapped_source_headers}
  const [mapping, setMapping] = useState({});    // editable copy of aiResult.mapping
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // {created, failed, errors[]}
  const [error, setError] = useState("");

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
        setStep("pick");
        return;
      }
      const [hdr, ...rest] = rows;
      setHeaders(hdr);
      setAllRows(rest);
      await callInferEdgeFunction(hdr, rest.slice(0, 5));
    } catch (e) {
      setError(`Couldn't read ${file.name}: ${e?.message || "unknown error"}`);
      setStep("pick");
    }
  }

  // ─── Step 2: call Edge Function for mapping ────────────────────────────────
  async function callInferEdgeFunction(hdr, sample) {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("infer-import-mapping", {
        body: { sourceHeaders: hdr, sampleRows: sample, targetEntity },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setAiResult(data);
      setMapping(data.mapping || {});
      setStep("review");
    } catch (e) {
      const msg = e?.message || "Couldn't infer mapping.";
      setError(msg);
      setStep("pick");
      showToast(msg, "error");
    }
  }

  // ─── Step 3: transform + bulk insert ───────────────────────────────────────
  async function handleImport() {
    setImporting(true);
    setStep("importing");
    let created = 0;
    const errors = [];

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

        {step === "pick" && (
          <PickStep
            targetEntity={targetEntity}
            setTargetEntity={setTargetEntity}
            onFile={handleFile}
            error={error}
          />
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
            onBack={() => setStep("pick")}
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

// ── PickStep ────────────────────────────────────────────────────────────────
function PickStep({ targetEntity, setTargetEntity, onFile, error }) {
  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
        Import data from QuickBooks, Stessa, or a spreadsheet. We&rsquo;ll read your column headers and a few sample rows, propose how they map into PROPBOOKS, and you review before anything is saved.
      </p>

      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>What are you importing?</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {TARGETS.map(t => {
            const active = targetEntity === t.id;
            const Icon = t.icon;
            return (
              <button key={t.id} type="button" onClick={() => setTargetEntity(t.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, padding: 14, borderRadius: 12, border: active ? "1.5px solid #e95e00" : "1px solid var(--border)", background: active ? "rgba(233,94,0,0.06)" : "var(--surface)", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={16} color={active ? "#e95e00" : "var(--text-muted)"} />
                  <p style={{ color: active ? "#e95e00" : "var(--text-primary)", fontWeight: 700, fontSize: 14 }}>{t.label}</p>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 12 }}>{t.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Upload file</p>
        <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 32, border: "1.5px dashed var(--border)", borderRadius: 12, background: "var(--surface-alt)", cursor: "pointer", transition: "all 0.15s" }}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#e95e00"; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--border)"; onFile(e.dataTransfer.files?.[0]); }}>
          <Upload size={28} color="var(--text-muted)" />
          <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 14 }}>Drop your file here or click to browse</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>CSV or Excel (.xlsx / .xls). Up to 10 MB.</p>
          <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: "none" }} onChange={e => onFile(e.target.files?.[0])} />
        </label>
      </div>

      {error && (
        <div style={{ marginTop: 14, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}
    </div>
  );
}

// ── ReviewStep ──────────────────────────────────────────────────────────────
function ReviewStep({ targetSchema, mapping, setMapping, headers, confidence, notes, unmapped, sampleRows, fileName, totalRows, onBack, onConfirm }) {
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
        <button onClick={onConfirm} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          Import {totalRows} row{totalRows !== 1 ? "s" : ""} <ArrowRight size={14} />
        </button>
      </div>
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
