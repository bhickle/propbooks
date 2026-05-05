// =============================================================================
// Attachments — file upload primitives + Documents tab content used by
// PropertyDetail, TenantDetail, and DealDetail.
//
// AttachmentZone   — drag-and-drop / click-to-browse zone
// AttachmentList   — renders a list of attached files with thumbnails + remove
// OcrPrompt        — post-attach prompt that offers receipt auto-fill
// DocumentsPanel   — full Documents tab UI with add/delete modal
// =============================================================================
import { useState, useRef } from "react";
import {
  UploadCloud, Loader, FileText, FileImage, X, ScanLine, Star, FilePlus, Trash2,
} from "lucide-react";
import { newId, mockOcrScan } from "../api.js";
import { iS } from "../shared.jsx";

export const DOC_TYPE_OPTIONS = [
  { value: "lease", label: "Lease" }, { value: "contract", label: "Contract" }, { value: "insurance", label: "Insurance" },
  { value: "inspection", label: "Inspection" }, { value: "appraisal", label: "Appraisal" }, { value: "closing", label: "Closing Statement" },
  { value: "scope", label: "Scope of Work" }, { value: "addendum", label: "Addendum" }, { value: "application", label: "Application" },
  { value: "w9", label: "W-9" }, { value: "warranty", label: "Warranty" }, { value: "receipt", label: "Receipt" },
  { value: "photo", label: "Photo" }, { value: "other", label: "Other" },
];

// ── AttachmentZone — reusable drag-and-drop / click-to-browse file upload ──
export function AttachmentZone({ onFiles, accept = "image/*,.pdf", label = "Drop file here or click to browse", compact = false, scanning = false }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const handleDrop = e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); };
  const handleChange = e => { if (e.target.files.length) { onFiles([...e.target.files]); e.target.value = ""; } };
  if (scanning) {
    return (
      <div style={{ border: "2px dashed #e95e00", borderRadius: 12, padding: compact ? "12px 16px" : "20px 24px", textAlign: "center", background: "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <Loader size={18} color="#e95e00" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, color: "#9a3412", fontWeight: 600 }}>Scanning receipt...</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{ border: `2px dashed ${dragOver ? "#e95e00" : "var(--border)"}`, borderRadius: 12, padding: compact ? "12px 16px" : "20px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "var(--warning-bg)" : "var(--surface-alt)", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <input ref={inputRef} type="file" accept={accept} multiple onChange={handleChange} style={{ display: "none" }} />
      <UploadCloud size={compact ? 16 : 20} color="#94a3b8" />
      <span style={{ fontSize: compact ? 12 : 13, color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}

// ── AttachmentList — shows files with thumbnails, names, and remove buttons ──
export function AttachmentList({ items, onRemove, compact = false }) {
  if (!items || items.length === 0) return null;
  const iconForType = mime => {
    if (!mime) return FileText;
    if (mime.startsWith("image/")) return FileImage;
    if (mime.includes("pdf")) return FileText;
    return FileText;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map(item => {
        const Icon = iconForType(item.mimeType);
        return (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-alt)", borderRadius: 10, padding: compact ? "6px 10px" : "8px 12px", border: "1px solid var(--border-subtle)" }}>
            <Icon size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
              {item.size && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.size}</p>}
            </div>
            {item.ocrData && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "#1a7a4a", background: "var(--success-badge)", borderRadius: 6, padding: "2px 6px", flexShrink: 0 }}>OCR</span>
            )}
            {onRemove && (
              <button onClick={e => { e.stopPropagation(); onRemove(item.id); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", color: "var(--text-muted)" }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--c-red)"} onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── OcrPrompt — shown after a receipt is attached, offers to auto-fill form ──
export function OcrPrompt({ attachment, onResult, onDismiss }) {
  const [scanning, setScanning] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || attachment.ocrData) return null;

  const isImage = attachment.mimeType?.startsWith("image/");
  const isPdf = attachment.mimeType?.includes("pdf");
  if (!isImage && !isPdf) return null; // only offer OCR for images/PDFs

  const runOcr = async () => {
    setScanning(true);
    try {
      const ocrData = await mockOcrScan({ name: attachment.name, type: attachment.mimeType });
      if (onResult) onResult(ocrData, attachment);
    } catch (err) {
      console.error("OCR failed:", err);
    } finally {
      setScanning(false);
    }
  };

  if (scanning) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--warning-bg)", borderRadius: 10, border: "1px solid var(--warning-border)", marginTop: 6 }}>
        <Loader size={14} color="#e95e00" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 12, color: "var(--warning-text)", fontWeight: 600 }}>Reading receipt...</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--info-tint-alt)", borderRadius: 10, border: "1px solid var(--info-border-alt)", marginTop: 6 }}>
      <ScanLine size={15} color="var(--c-blue)" />
      <span style={{ fontSize: 12, color: "var(--text-primary)", flex: 1 }}>Auto-fill from this receipt?</span>
      <button onClick={runOcr}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: "none", background: "#1e3a5f", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
        <Star size={12} /> Auto-fill
      </button>
      <button onClick={() => { setDismissed(true); if (onDismiss) onDismiss(); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-muted)", display: "flex" }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ── DocumentsPanel — reusable documents tab content for any entity ──
export function DocumentsPanel({ documents, onAdd, onDelete, entityLabel = "item" }) {
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [docForm, setDocForm] = useState({ name: "", type: "other" });
  const [pendingFiles, setPendingFiles] = useState([]);
  const dsf = k => e => setDocForm(f => ({ ...f, [k]: e.target.value }));

  const handleFilesSelected = (files) => {
    const newPending = files.map(f => ({
      id: newId(), name: f.name, mimeType: f.type,
      size: f.size > 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(1) + " MB" : Math.round(f.size / 1024) + " KB",
      url: URL.createObjectURL(f), file: f,
    }));
    setPendingFiles(prev => [...prev, ...newPending]);
    if (!docForm.name && files.length === 1) setDocForm(f => ({ ...f, name: files[0].name.replace(/\.[^.]+$/, "") }));
  };

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!docForm.name && pendingFiles.length === 0) return;
    setSaving(true);
    try {
      if (pendingFiles.length === 0 && docForm.name) {
        // Placeholder record (no file)
        await onAdd({
          meta: {
            name: docForm.name, type: docForm.type, mimeType: null, size: null,
            date: new Date().toISOString().slice(0, 10),
          },
          file: null,
        });
      } else {
        for (const pf of pendingFiles) {
          await onAdd({
            meta: {
              name: docForm.name || pf.name,
              type: docForm.type,
              mimeType: pf.mimeType,
              size: pf.size,
              date: new Date().toISOString().slice(0, 10),
            },
            file: pf.file,
          });
        }
      }
      setDocForm({ name: "", type: "other" }); setPendingFiles([]); setShowModal(false);
    } catch (e) {
      console.error("[PropBooks] Save document failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = t => (DOC_TYPE_OPTIONS.find(o => o.value === t) || {}).label || t;
  const typeColor = t => {
    const colors = { lease: "var(--c-blue)", contract: "var(--c-purple)", insurance: "var(--c-green)", inspection: "#e95e00", appraisal: "#06b6d4", closing: "var(--c-red)", scope: "#ec4899", addendum: "#64748b", application: "#a855f7", w9: "#0ea5e9", warranty: "#22c55e", receipt: "#f97316", photo: "#6366f1" };
    return colors[t] || "#94a3b8";
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Documents</h3>
        <button onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <FilePlus size={14} /> Add Document
        </button>
      </div>

      {documents.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface-alt)", borderRadius: 12, border: "1px dashed var(--border)" }}>
          <FileText size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
          <p>No documents yet</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Upload leases, inspections, receipts, and more</p>
        </div>
      )}

      {documents.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {documents.map(doc => (
            <div key={doc.id} style={{ background: "var(--surface)", borderRadius: 12, padding: 16, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ background: typeColor(doc.type) + "18", borderRadius: 8, padding: 8, flexShrink: 0 }}>
                  {doc.mimeType?.startsWith("image/") ? <FileImage size={18} color={typeColor(doc.type)} /> : <FileText size={18} color={typeColor(doc.type)} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: typeColor(doc.type), background: typeColor(doc.type) + "18", borderRadius: 6, padding: "2px 8px", textTransform: "uppercase" }}>{typeLabel(doc.type)}</span>
                    {doc.size && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{doc.size}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{doc.date}</span>
                <button onClick={() => setDeleteConfirm(doc)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)", borderRadius: 6 }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--c-red)"} onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Document Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { setShowModal(false); setPendingFiles([]); setDocForm({ name: "", type: "other" }); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 28, width: 440, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Add Document</h3>
              <button onClick={() => { setShowModal(false); setPendingFiles([]); setDocForm({ name: "", type: "other" }); }}
                style={{ background: "var(--surface-muted)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}><X size={16} color="var(--text-secondary)" /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Document Name *</label>
                <input type="text" value={docForm.name} onChange={dsf("name")} placeholder="e.g. Lease Agreement" style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Type</label>
                <select value={docForm.type} onChange={dsf("type")} style={iS}>
                  {DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>File</label>
                <AttachmentZone onFiles={handleFilesSelected} accept="image/*,.pdf,.doc,.docx" label="Drop file here or click to browse" />
                {pendingFiles.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <AttachmentList items={pendingFiles} onRemove={id => setPendingFiles(prev => prev.filter(p => p.id !== id))} compact />
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} disabled={saving || (!docForm.name && pendingFiles.length === 0)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: (saving || (!docForm.name && pendingFiles.length === 0)) ? 0.5 : 1 }}>
                {saving ? "Saving..." : "Save Document"}
              </button>
              <button onClick={() => { setShowModal(false); setPendingFiles([]); setDocForm({ name: "", type: "other" }); }}
                style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 28, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Delete Document?</h3>
            <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 20 }}>Remove <strong>{deleteConfirm.name}</strong>? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { onDelete(deleteConfirm.id); setDeleteConfirm(null); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "var(--c-red)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Delete
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
