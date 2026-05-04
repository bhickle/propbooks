import { useState, useMemo } from "react";
import {
  ChevronRight, Home, DollarSign, FileText, Wrench, MessageSquare, LogOut, Pencil,
  Phone, Mail, Shield, CheckCircle, Plus, Trash2, AlertTriangle, UploadCloud,
} from "lucide-react";
import {
  newId, fmt, MOCK_USER,
  TENANT_DOCUMENTS, MAINTENANCE_REQUESTS, RENTAL_NOTES,
} from "../api.js";
import { createTransaction } from "../db/transactions.js";
import { InfoTip, Modal, colorWithAlpha, iS } from "../shared.jsx";
import { PROPERTIES, TRANSACTIONS } from "../mockData.js";
import { useToast } from "../toast.jsx";

export function TenantDetail({ tenant, onBack, backLabel, onTenantUpdated, onSelectTenant }) {
  const { showToast } = useToast();
  const property = PROPERTIES.find(p => p.id === tenant.propertyId);
  const [activeTab, setActiveTab] = useState("overview");
  // Payments: read from existing transactions (rent income tied to this tenant)
  const [txVersion, setTxVersion] = useState(0);
  const payments = useMemo(() => TRANSACTIONS.filter(t => t.tenantId === tenant.id && t.type === "income" && t.category === "Rent Income").sort((a, b) => b.date.localeCompare(a.date)), [tenant.id, txVersion]); // eslint-disable-line react-hooks/exhaustive-deps -- txVersion is the cache-bust counter for TRANSACTIONS
  const [documents, setDocuments] = useState(TENANT_DOCUMENTS.filter(d => d.tenantId === tenant.id));
  // Notes: read from RENTAL_NOTES filtered by tenantId
  const [noteVersion, setNoteVersion] = useState(0);
  const notes = useMemo(() => RENTAL_NOTES.filter(n => n.tenantId === tenant.id).sort((a, b) => b.date.localeCompare(a.date)), [tenant.id, noteVersion]); // eslint-disable-line react-hooks/exhaustive-deps -- noteVersion is the cache-bust counter for RENTAL_NOTES
  const [requests, setRequests] = useState(MAINTENANCE_REQUESTS.filter(r => r.tenantId === tenant.id));

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});
  const sef = k => e => setEditForm(f => ({ ...f, [k]: e.target.value }));

  // Close lease modal
  const [showClose, setShowClose] = useState(false);
  const [closeForm, setCloseForm] = useState({ moveOutDate: new Date().toISOString().split("T")[0], moveOutReason: "Lease ended" });

  // Record payment modal (creates a real transaction)
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [payForm, setPayForm] = useState({ date: new Date().toISOString().split("T")[0], amount: String(tenant.rent || ""), description: "" });
  const spf = k => e => setPayForm(f => ({ ...f, [k]: e.target.value }));

  // Add note modal
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Add maintenance modal
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [maintForm, setMaintForm] = useState({ title: "", description: "", priority: "medium" });
  const smf = k => e => setMaintForm(f => ({ ...f, [k]: e.target.value }));

  const openEdit = () => {
    setEditForm({
      name: tenant.name || "", phone: tenant.phone || "", email: tenant.email || "",
      rent: String(tenant.rent || ""), securityDeposit: String(tenant.securityDeposit || ""),
      leaseStart: tenant.leaseStart || "", leaseEnd: tenant.leaseEnd || "",
      unit: tenant.unit || "", status: tenant.status,
    });
    setShowEdit(true);
  };

  const handleSaveEdit = () => {
    const updates = {
      name: editForm.name, phone: editForm.phone || null, email: editForm.email || null,
      rent: parseFloat(editForm.rent) || 0, securityDeposit: parseFloat(editForm.securityDeposit) || null,
      leaseStart: editForm.leaseStart || null, leaseEnd: editForm.leaseEnd || null,
      unit: editForm.unit, status: editForm.status,
    };
    onTenantUpdated && onTenantUpdated(tenant.id, updates);
    setShowEdit(false);
    showToast("Tenant updated");
  };

  const handleCloseLease = () => {
    onTenantUpdated && onTenantUpdated(tenant.id, { status: "past", moveOutDate: closeForm.moveOutDate || new Date().toISOString().split("T")[0], moveOutReason: closeForm.moveOutReason });
    setShowClose(false);
    showToast("Lease closed");
    onBack && onBack();
  };

  const handleAddPayment = async () => {
    const amt = parseFloat(payForm.amount) || 0;
    const desc = payForm.description || `Rent payment - ${tenant.name}`;
    // tenantId omitted: tenants are still mock-side, so the FK can't be set
    // until tenants are migrated. Backfill links rent rows to tenants then.
    try {
      const saved = await createTransaction({
        date: payForm.date, propertyId: tenant.propertyId,
        category: "Rent Income", description: desc,
        amount: amt, type: "income",
      });
      TRANSACTIONS.unshift(saved);
      setTxVersion(v => v + 1);
      setShowAddPayment(false);
      setPayForm({ date: new Date().toISOString().split("T")[0], amount: String(tenant.rent || ""), description: "" });
      showToast("Payment recorded as transaction");
    } catch (e) {
      console.error("[PropBooks] Record payment failed:", e);
      showToast("Couldn't record payment — " + (e.message || "unknown error"));
    }
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const n = { id: newId(), propertyId: tenant.propertyId, tenantId: tenant.id, date: new Date().toISOString().split("T")[0], text: noteText.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
    RENTAL_NOTES.push(n);
    setNoteVersion(v => v + 1);
    setNoteText("");
    setShowAddNote(false);
    showToast("Note added");
  };

  const handleDeleteNote = (id) => {
    const idx = RENTAL_NOTES.findIndex(n => n.id === id);
    if (idx !== -1) RENTAL_NOTES.splice(idx, 1);
    setNoteVersion(v => v + 1);
    showToast("Note deleted");
  };

  const handleAddMaint = () => {
    if (!maintForm.title.trim()) return;
    const r = { id: newId(), tenantId: tenant.id, propertyId: tenant.propertyId, title: maintForm.title, description: maintForm.description, priority: maintForm.priority, status: "open", createdAt: new Date().toISOString(), scheduledDate: null, resolvedDate: null, cost: null, vendor: null };
    MAINTENANCE_REQUESTS.push(r);
    setRequests(prev => [r, ...prev]);
    setMaintForm({ title: "", description: "", priority: "medium" });
    setShowAddMaint(false);
    showToast("Maintenance request created");
  };

  const handleResolveMaint = (id) => {
    const idx = MAINTENANCE_REQUESTS.findIndex(r => r.id === id);
    if (idx !== -1) Object.assign(MAINTENANCE_REQUESTS[idx], { status: "resolved", resolvedDate: new Date().toISOString().split("T")[0] });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "resolved", resolvedDate: new Date().toISOString().split("T")[0] } : r));
    showToast("Marked as resolved");
  };

  const getDaysLeft = (leaseEnd) => {
    if (!leaseEnd) return null;
    const d = Math.ceil((new Date(leaseEnd) - new Date()) / 86400000);
    return d > 0 ? d : 0;
  };
  const daysLeft = getDaysLeft(tenant.leaseEnd);
  const isActive = tenant.status === "active-lease" || tenant.status === "month-to-month";
  const leaseStatusStyle = { "active-lease": { bg: "var(--success-badge)", text: "#1a7a4a", label: "Active Lease" }, "month-to-month": { bg: "var(--warning-bg)", text: "var(--warning-text)", label: "Month-to-Month" }, "vacant": { bg: "var(--danger-badge)", text: "#c0392b", label: "Vacant" }, "past": { bg: "var(--surface-muted)", text: "var(--text-secondary)", label: "Past Tenant" } };
  const s = leaseStatusStyle[tenant.status] || leaseStatusStyle["vacant"];

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const paymentCount = payments.length;

  const openRequests = requests.filter(r => r.status === "open" || r.status === "scheduled").length;
  const resolvedRequests = requests.filter(r => r.status === "resolved").length;

  const tabs = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "payments", label: "Payments", icon: DollarSign },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "maintenance", label: "Maintenance", icon: Wrench },
    { id: "notes", label: "Notes", icon: MessageSquare },
  ];

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-blue)", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 14 }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> {backLabel || "Back to Tenants"}
        </button>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 800 }}>
            {tenant.name?.charAt(0) || "?"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700 }}>{tenant.name}</h1>
              <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700 }}>{s.label}</span>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
              {property?.name || "Unknown Property"} &middot; {tenant.unit}
              {tenant.rent ? ` · ${fmt(tenant.rent)}/mo` : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isActive && (
            <button onClick={() => { setCloseForm({ moveOutDate: new Date().toISOString().split("T")[0], moveOutReason: "Lease ended" }); setShowClose(true); }} style={{ background: "var(--warning-btn-bg)", border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#9a3412", fontSize: 13, fontWeight: 600 }}>
              <LogOut size={14} /> Close Lease
            </button>
          )}
          <button onClick={openEdit} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--text-label)", fontSize: 13, fontWeight: 600 }}>
            <Pencil size={14} /> Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 24, border: "1px solid var(--border)" }}>
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
              <t.icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Contact Info */}
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Contact Information</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {tenant.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "var(--info-tint)", borderRadius: 8, padding: 8 }}><Phone size={14} color="var(--c-blue)" /></div>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Phone</p>
                    <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>{tenant.phone}</p>
                  </div>
                </div>
              )}
              {tenant.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "var(--success-tint)", borderRadius: 8, padding: 8 }}><Mail size={14} color="var(--c-green)" /></div>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Email</p>
                    <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>{tenant.email}</p>
                  </div>
                </div>
              )}
              {tenant.securityDeposit && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "var(--purple-tint)", borderRadius: 8, padding: 8 }}><Shield size={14} color="var(--c-purple)" /></div>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Security Deposit</p>
                    <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>{fmt(tenant.securityDeposit)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lease Info */}
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Lease Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Lease Period</span>
                <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{tenant.leaseStart || "-"} to {tenant.leaseEnd || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Monthly Rent</span>
                <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>{fmt(tenant.rent)}</span>
              </div>
              {daysLeft !== null && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Days Until Expiry</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: daysLeft <= 90 ? "#9a3412" : "#1a7a4a" }}>
                    {daysLeft <= 90 ? `(!) ${daysLeft} days` : `${daysLeft} days`}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Last Payment</span>
                <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{tenant.lastPayment || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Property</span>
                <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{property?.name || "-"}</span>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              { label: "Total Paid", value: fmt(totalPaid), color: "var(--c-green)", icon: DollarSign, tip: "Sum of all rent transactions recorded for this tenant" },
              { label: "Payments", value: paymentCount, color: "var(--c-blue)", icon: CheckCircle, tip: `${paymentCount} rent payment${paymentCount !== 1 ? "s" : ""} recorded as transactions` },
              { label: "Open Requests", value: openRequests, color: openRequests > 0 ? "#e95e00" : "var(--c-green)", icon: Wrench, tip: "Active or scheduled maintenance requests" },
              { label: "Documents", value: documents.length, color: "var(--c-blue)", icon: FileText, tip: "Total tenant documents on file" },
            ].map((m, i) => (
              <div key={i} style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</p>
                      <InfoTip text={m.tip} />
                    </div>
                    <p style={{ color: m.color, fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
                  </div>
                  <div style={{ background: colorWithAlpha(m.color, 0.1), borderRadius: 10, padding: 10 }}><m.icon size={20} color={m.color} /></div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div style={{ gridColumn: "1 / -1", background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Recent Activity</h3>
            {[...payments.slice(0, 3).map(p => ({ type: "payment", date: p.date, text: `Payment: ${fmt(p.amount)} — ${p.description}`, color: "var(--c-green)", icon: DollarSign })),
              ...requests.filter(r => r.status !== "resolved").map(r => ({ type: "maintenance", date: r.createdAt.split("T")[0], text: `Maintenance: ${r.title}`, color: "#e95e00", icon: Wrench })),
              ...notes.slice(0, 2).map(n => ({ type: "note", date: n.date, text: `Note: ${n.text.substring(0, 80)}${n.text.length > 80 ? "..." : ""}`, color: "var(--c-blue)", icon: MessageSquare })),
            ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}>
                <div style={{ background: colorWithAlpha(item.color, 0.1), borderRadius: 8, padding: 8 }}><item.icon size={14} color={item.color} /></div>
                <p style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{item.text}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.date}</p>
              </div>
            ))}
            {payments.length === 0 && requests.length === 0 && notes.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No activity recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {activeTab === "payments" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Payment History</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{payments.length} payments recorded &middot; {fmt(totalPaid)} total</p>
            </div>
            <button onClick={() => setShowAddPayment(true)} style={{ background: "var(--c-green)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Record Payment
            </button>
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)" }}>
                  {["Date", "Amount", "Description", "Category"].map(h => (
                    <th key={h} style={{ padding: "14px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{p.date}</td>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: "var(--c-green)" }}>{fmt(p.amount)}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{p.description}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ background: "var(--success-badge)", color: "#1a7a4a", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{p.category}</span>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No rent payments recorded yet. Use "Record Payment" to log rent as a transaction.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {activeTab === "documents" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Documents</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Lease agreements, applications, addenda, and tenant files</p>
            </div>
            <label style={{ background: "var(--c-blue)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <UploadCloud size={14} /> Upload
              <input type="file" style={{ display: "none" }} onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const doc = { id: newId(), tenantId: tenant.id, name: file.name, type: "other", mimeType: file.type, size: (file.size / 1024).toFixed(0) + " KB", date: new Date().toISOString().split("T")[0], url: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
                TENANT_DOCUMENTS.push(doc);
                setDocuments(prev => [...prev, doc]);
                showToast("Document uploaded");
                e.target.value = "";
              }} />
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {documents.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ background: "var(--info-tint)", borderRadius: 10, padding: 10 }}><FileText size={18} color="var(--c-blue)" /></div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.type} &middot; {d.size} &middot; {d.date}</p>
                </div>
                <button onClick={() => { const idx = TENANT_DOCUMENTS.findIndex(td => td.id === d.id); if (idx !== -1) TENANT_DOCUMENTS.splice(idx, 1); setDocuments(prev => prev.filter(td => td.id !== d.id)); showToast("Document removed"); }} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {documents.length === 0 && (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                No documents on file. Upload lease agreements, applications, or addenda.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MAINTENANCE TAB ── */}
      {activeTab === "maintenance" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Maintenance Requests</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{openRequests} open &middot; {resolvedRequests} resolved</p>
            </div>
            <button onClick={() => setShowAddMaint(true)} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> New Request
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => {
              const prioStyle = { high: { bg: "var(--danger-badge)", text: "#c0392b" }, medium: { bg: "var(--warning-bg)", text: "#9a3412" }, low: { bg: "var(--surface-muted)", text: "var(--text-secondary)" } };
              const statusStyle = { open: { bg: "var(--danger-badge)", text: "var(--c-red)" }, scheduled: { bg: "var(--info-tint)", text: "var(--c-blue)" }, resolved: { bg: "var(--success-badge)", text: "var(--c-green)" } };
              const ps = prioStyle[r.priority] || prioStyle.medium;
              const ss = statusStyle[r.status] || statusStyle.open;
              return (
                <div key={r.id} style={{ background: "var(--surface)", borderRadius: 12, padding: 20, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{r.title}</p>
                        <span style={{ background: ps.bg, color: ps.text, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{r.priority}</span>
                        <span style={{ background: ss.bg, color: ss.text, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{r.status}</span>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.description}</p>
                    </div>
                    {r.status !== "resolved" && (
                      <button onClick={() => handleResolveMaint(r.id)} style={{ background: "var(--success-badge)", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#1a7a4a", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                        <CheckCircle size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> Resolve
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
                    <span>Created: {r.createdAt.split("T")[0]}</span>
                    {r.scheduledDate && <span>Scheduled: {r.scheduledDate}</span>}
                    {r.resolvedDate && <span>Resolved: {r.resolvedDate}</span>}
                    {r.vendor && <span>Paid To: {r.vendor}</span>}
                    {r.cost && <span>Cost: {fmt(r.cost)}</span>}
                  </div>
                </div>
              );
            })}
            {requests.length === 0 && (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                No maintenance requests for this tenant.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NOTES TAB ── */}
      {activeTab === "notes" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Notes</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Private notes about this tenant</p>
            </div>
            <button onClick={() => setShowAddNote(true)} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Add Note
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notes.map(n => (
              <div key={n.id} style={{ display: "flex", gap: 14, padding: "16px 20px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ background: "#eef2ff", borderRadius: 10, padding: 10, height: "fit-content" }}><MessageSquare size={16} color="#6366f1" /></div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{n.text}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{n.date}</p>
                </div>
                <button onClick={() => handleDeleteNote(n.id)} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", height: "fit-content" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {notes.length === 0 && (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                No notes for this tenant. Notes added here also appear in the unified Notes hub.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Edit Tenant Modal */}
      {showEdit && (
        <Modal title="Edit Tenant" onClose={() => setShowEdit(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Name</label>
              <input value={editForm.name} onChange={sef("name")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Unit</label>
              <input value={editForm.unit} onChange={sef("unit")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Status</label>
              <select value={editForm.status} onChange={sef("status")} style={iS}>
                <option value="active-lease">Active Lease</option>
                <option value="month-to-month">Month-to-Month</option>
                <option value="vacant">Vacant</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Monthly Rent</label>
              <input type="number" value={editForm.rent} onChange={sef("rent")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Security Deposit</label>
              <input type="number" value={editForm.securityDeposit} onChange={sef("securityDeposit")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Phone</label>
              <input value={editForm.phone} onChange={sef("phone")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Email</label>
              <input value={editForm.email} onChange={sef("email")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Lease Start</label>
              <input type="date" value={editForm.leaseStart} onChange={sef("leaseStart")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Lease End</label>
              <input type="date" value={editForm.leaseEnd} onChange={sef("leaseEnd")} style={iS} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowEdit(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveEdit} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-blue)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Save Changes</button>
          </div>
        </Modal>
      )}

      {/* Close Lease Modal */}
      {showClose && (
        <Modal title="Close Lease" onClose={() => setShowClose(false)} width={480}>
          <div style={{ padding: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--warning-bg)", borderRadius: 12, border: "1px solid #fdba74", marginBottom: 20 }}>
              <AlertTriangle size={20} color="#9a3412" />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#9a3412" }}>This will end the lease for <strong>{tenant.name}</strong></p>
                <p style={{ fontSize: 12, color: "#9a3412", marginTop: 2 }}>{property?.name} &middot; {tenant.unit} &middot; {fmt(tenant.rent)}/mo</p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Move-Out Date</label>
                <input type="date" value={closeForm.moveOutDate} onChange={e => setCloseForm(f => ({ ...f, moveOutDate: e.target.value }))} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Reason</label>
                <select value={closeForm.moveOutReason} onChange={e => setCloseForm(f => ({ ...f, moveOutReason: e.target.value }))} style={iS}>
                  <option>Lease ended</option><option>Lease not renewed</option><option>Relocated for work</option><option>Purchased own home</option><option>Lease ended, rent increase</option><option>Eviction</option><option>Mutual agreement</option><option>Other</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowClose(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCloseLease} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Close Lease</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <Modal title="Record Rent Payment" onClose={() => setShowAddPayment(false)} width={480}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>This creates a rent income transaction on {property?.name || "the property"}.</p>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Date</label>
                <input type="date" value={payForm.date} onChange={spf("date")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Amount</label>
                <input type="number" value={payForm.amount} onChange={spf("amount")} style={iS} />
              </div>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Description <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
              <input value={payForm.description} onChange={spf("description")} placeholder={`Rent payment - ${tenant.name}`} style={iS} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowAddPayment(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAddPayment} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-green)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Record Payment</button>
          </div>
        </Modal>
      )}

      {/* Add Note Modal */}
      {showAddNote && (
        <Modal title="Add Note" onClose={() => setShowAddNote(false)} width={520}>
          <div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write a private note about this tenant..." rows={4} style={{ ...iS, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => setShowAddNote(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAddNote} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#6366f1", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Add Note</button>
          </div>
        </Modal>
      )}

      {/* Add Maintenance Modal */}
      {showAddMaint && (
        <Modal title="New Maintenance Request" onClose={() => setShowAddMaint(false)} width={520}>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Title</label>
              <input value={maintForm.title} onChange={smf("title")} placeholder="e.g., Leaky faucet in bathroom" style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Description</label>
              <textarea value={maintForm.description} onChange={smf("description")} placeholder="Details about the issue..." rows={3} style={{ ...iS, resize: "vertical" }} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Priority</label>
              <select value={maintForm.priority} onChange={smf("priority")} style={iS}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowAddMaint(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAddMaint} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Create Request</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
