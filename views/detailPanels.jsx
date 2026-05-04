// =============================================================================
// detailPanels — slide-over detail panels for transactions and deal expenses.
// Used by Transactions, PropertyDetail (tx mini-list), and Reports.
// =============================================================================
import {
  X, Tag, Building2, Users, User, MessageSquare, Paperclip, FileText,
  FileImage, Pencil, Trash2, Hammer, Layers, UserCheck,
} from "lucide-react";
import {
  fmt, DEALS, CONTRACTORS, TRANSACTION_RECEIPTS, DEAL_EXPENSE_RECEIPTS,
} from "../api.js";
import { PROPERTIES, TENANTS } from "../mockData.js";

// ─── Transaction Detail Slide-Over ─────────────────────────────────────────
export function TxDetailPanel({ tx, onClose, onEdit, onDelete }) {
  if (!tx) return null;
  const property = PROPERTIES.find(p => p.id === tx.propertyId);
  const tenant = tx.tenantId ? TENANTS.find(t => t.id === tx.tenantId) : null;
  const receipts = TRANSACTION_RECEIPTS.filter(r => r.transactionId === tx.id);
  const isIncome = tx.type === "income";
  const color = isIncome ? "#1a7a4a" : "#c0392b";
  const bgColor = isIncome ? "var(--success-badge)" : "var(--danger-badge)";
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,24,48,0.35)", zIndex: 1200 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 460, background: "var(--surface)", boxShadow: "-8px 0 40px rgba(0,0,0,0.14)", zIndex: 1201, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "28px 28px 20px", background: "var(--surface-alt)", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ background: bgColor, color, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{tx.type}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 8, lineHeight: 1 }}><X size={20} /></button>
          </div>
          <p style={{ fontSize: 32, fontWeight: 800, color, margin: "0 0 4px" }}>{isIncome ? "+" : "−"}{fmt(Math.abs(tx.amount))}</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{tx.date}</p>
        </div>
        <div style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Tag size={14} color="#94a3b8" /></div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Category</p>
                <span style={{ background: "var(--surface-muted)", color: "var(--text-label)", borderRadius: 6, padding: "3px 9px", fontSize: 13, fontWeight: 600 }}>{tx.category}</span>
              </div>
            </div>
            {[
              { label: "Property", value: property?.name || "Unknown", icon: <Building2 size={14} color="#94a3b8" /> },
              ...(tenant ? [{ label: "Tenant", value: tenant.name + (tenant.unit ? ` · ${tenant.unit}` : ""), icon: <Users size={14} color="#94a3b8" /> }] : []),
              { label: isIncome ? "Received From" : "Paid To", value: tx.payee || "—", icon: <User size={14} color="#94a3b8" /> },
              { label: "Description", value: tx.description || "—", icon: <MessageSquare size={14} color="#94a3b8" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>{icon}</div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</p>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
          {(tx.piPrincipal || tx.piInterest) && (
            <div style={{ background: "var(--surface-alt)", borderRadius: 12, padding: "16px 18px", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Principal & Interest</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div><p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 3 }}>Principal</p><p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(tx.piPrincipal || 0)}</p></div>
                <div><p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 3 }}>Interest</p><p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(tx.piInterest || 0)}</p></div>
              </div>
            </div>
          )}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Paperclip size={12} /> Attachments{receipts.length > 0 && <span style={{ background: "var(--border)", borderRadius: 20, padding: "1px 7px", fontSize: 11, color: "var(--text-label)", marginLeft: 2 }}>{receipts.length}</span>}
            </p>
            {receipts.length === 0 ? (
              <div style={{ background: "var(--surface-alt)", border: "1px dashed var(--border)", borderRadius: 12, padding: "28px 20px", textAlign: "center" }}>
                <Paperclip size={20} color="#cbd5e1" style={{ display: "block", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No receipts attached</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {receipts.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: r.mimeType?.includes("pdf") ? "var(--danger-badge)" : "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {r.mimeType?.includes("pdf") ? <FileText size={16} color="var(--c-red)" /> : <FileImage size={16} color="var(--c-blue)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.size}</p>
                    </div>
                    {r.ocrData && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 1 }}>{r.ocrData.vendor}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(r.ocrData.amount)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: "18px 28px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 10, background: "var(--surface)" }}>
          <button onClick={() => { onClose(); onEdit(tx); }} style={{ flex: 1, padding: "11px 0", background: "var(--surface-muted)", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-label)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Pencil size={14} /> Edit</button>
          <button onClick={() => { onClose(); onDelete(tx); }} style={{ padding: "11px 18px", background: "var(--danger-badge)", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--c-red)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Trash2 size={14} /> Delete</button>
        </div>
      </div>
    </>
  );
}

// ─── Deal Expense Detail Slide-Over ────────────────────────────────────────
export function ExpDetailPanel({ exp, onClose, onEdit, onDelete }) {
  if (!exp) return null;
  const deal = DEALS.find(d => d.id === exp.dealId);
  const contractor = CONTRACTORS.find(c => c.id === exp.contractorId);
  const rehabItem = (exp.rehabItemIdx != null && deal?.rehabItems) ? deal.rehabItems[exp.rehabItemIdx] : null;
  const receipts = DEAL_EXPENSE_RECEIPTS.filter(r => r.expenseId === exp.id);
  const isPaid = (exp.status || "paid") === "paid";
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,24,48,0.35)", zIndex: 1200 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 460, background: "var(--surface)", boxShadow: "-8px 0 40px rgba(0,0,0,0.14)", zIndex: 1201, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "28px 28px 20px", background: "var(--surface-alt)", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ background: isPaid ? "var(--success-badge)" : "var(--warning-bg)", color: isPaid ? "#1a7a4a" : "var(--warning-text)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{isPaid ? "Paid" : "Pending"}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 8, lineHeight: 1 }}><X size={20} /></button>
          </div>
          <p style={{ fontSize: 32, fontWeight: 800, color: "#c0392b", margin: "0 0 4px" }}>−{fmt(exp.amount)}</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{exp.date}</p>
        </div>
        <div style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Tag size={14} color="#94a3b8" /></div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Category</p>
                <span style={{ background: "var(--surface-muted)", color: "var(--text-label)", borderRadius: 6, padding: "3px 9px", fontSize: 13, fontWeight: 600 }}>{exp.category}</span>
              </div>
            </div>
            {deal && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Hammer size={14} color="#94a3b8" /></div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Deal</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", display: "inline-block" }} /><p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{deal.name}</p></div>
                </div>
              </div>
            )}
            {[
              { label: "Paid To", value: exp.vendor || "—", icon: <User size={14} color="#94a3b8" /> },
              { label: "Description", value: exp.description || "—", icon: <MessageSquare size={14} color="#94a3b8" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>{icon}</div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</p>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{value}</p>
                </div>
              </div>
            ))}
            {rehabItem && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Layers size={14} color="#e95e00" /></div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Rehab Line Item</p>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{rehabItem.category}</p>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Budget: <strong style={{ color: "var(--text-primary)" }}>{fmt(rehabItem.budgeted || 0)}</strong></p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Spent: <strong style={{ color: "#c0392b" }}>{fmt(rehabItem.spent || 0)}</strong></p>
                  </div>
                </div>
              </div>
            )}
            {contractor && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><UserCheck size={14} color="var(--c-blue)" /></div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Linked Contractor</p>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{contractor.name}</p>
                  {contractor.trade && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{contractor.trade}</p>}
                </div>
              </div>
            )}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Paperclip size={12} /> Attachments{receipts.length > 0 && <span style={{ background: "var(--border)", borderRadius: 20, padding: "1px 7px", fontSize: 11, color: "var(--text-label)", marginLeft: 2 }}>{receipts.length}</span>}
            </p>
            {receipts.length === 0 ? (
              <div style={{ background: "var(--surface-alt)", border: "1px dashed var(--border)", borderRadius: 12, padding: "28px 20px", textAlign: "center" }}>
                <Paperclip size={20} color="#cbd5e1" style={{ display: "block", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No receipts attached</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {receipts.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: r.mimeType?.includes("pdf") ? "var(--danger-badge)" : "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {r.mimeType?.includes("pdf") ? <FileText size={16} color="var(--c-red)" /> : <FileImage size={16} color="#e95e00" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.size}</p>
                    </div>
                    {r.ocrData && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 1 }}>{r.ocrData.vendor}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(r.ocrData.amount)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: "18px 28px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 10, background: "var(--surface)" }}>
          <button onClick={() => { onClose(); onEdit(exp); }} style={{ flex: 1, padding: "11px 0", background: "var(--surface-muted)", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-label)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Pencil size={14} /> Edit</button>
          <button onClick={() => { onClose(); onDelete(exp); }} style={{ padding: "11px 18px", background: "var(--danger-badge)", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--c-red)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Trash2 size={14} /> Delete</button>
        </div>
      </div>
    </>
  );
}
