import { useState, useEffect, useRef } from "react";
import {
  Home, CheckSquare, AlertCircle, DollarSign, X, Plus, AlertTriangle, ArrowRight,
  FileText, UploadCloud, LogOut, Pencil, Trash2, Users,
} from "lucide-react";
import { newId, fmt, MOCK_USER } from "../api.js";
import { InfoTip, Modal, StatCard, EmptyState, iS } from "../shared.jsx";
import { PROPERTIES, TENANTS } from "../mockData.js";
import { useToast } from "../toast.jsx";

export function TenantManagement({ onBack, highlightTenantId, onClearHighlight, prefillTenant, onClearPrefill, onSelectTenant }) {
  const { showToast } = useToast();
  const [tenantData, setTenantData] = useState(TENANTS);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [propFilter, setPropFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [flashId, setFlashId] = useState(highlightTenantId);
  const highlightRef = useRef(null);
  const [closingTenant, setClosingTenant] = useState(null);
  const [closeForm, setCloseForm] = useState({ moveOutDate: "", moveOutReason: "Lease ended" });

  // Compute days until lease expiry dynamically
  const getDaysLeft = (leaseEnd) => {
    if (!leaseEnd) return null;
    const d = Math.ceil((new Date(leaseEnd) - new Date()) / 86400000);
    return d > 0 ? d : 0;
  };

  useEffect(() => {
    if (highlightTenantId) {
      setFlashId(highlightTenantId);
      setTimeout(() => {
        if (highlightRef.current) highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      const timer = setTimeout(() => { setFlashId(null); onClearHighlight && onClearHighlight(); }, 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightTenantId]); // eslint-disable-line react-hooks/exhaustive-deps -- onClearHighlight is an inline parent callback (new ref every render)
  const emptyT = { propertyId: PROPERTIES[0]?.id || 1, unit: "", name: "", rent: "", securityDeposit: "", lateFeePct: "5", renewalTerms: "Annual", notes: "", leaseStart: "", leaseEnd: "", status: "active-lease", phone: "", email: "", leaseDoc: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
  const [form, setForm] = useState(emptyT);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleLeaseDocUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, leaseDoc: { name: file.name, size: (file.size / 1024).toFixed(0) + " KB", data: ev.target.result } }));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Auto-open add form when navigating from Dashboard "List Unit" quick action
  useEffect(() => {
    if (prefillTenant) {
      setEditId(null);
      setForm({ ...emptyT, propertyId: prefillTenant.propertyId, unit: prefillTenant.unit || "" });
      setShowModal(true);
      onClearPrefill && onClearPrefill();
    }
  }, [prefillTenant]); // eslint-disable-line react-hooks/exhaustive-deps -- onClearPrefill is an inline parent callback; emptyT is stable

  const openAdd = () => { setEditId(null); setForm(emptyT); setShowModal(true); };
  const openEdit = t => {
    setEditId(t.id);
    setForm({
      propertyId:      t.propertyId,
      unit:            t.unit || "",
      name:            t.name || "",
      rent:            String(t.rent || ""),
      securityDeposit: String(t.securityDeposit || ""),
      lateFeePct:      String(t.lateFeePct ?? "5"),
      renewalTerms:    t.renewalTerms || "Annual",
      notes:           t.notes || "",
      leaseStart:      t.leaseStart || "",
      leaseEnd:        t.leaseEnd || "",
      status:          t.status,
      phone:           t.phone || "",
      email:           t.email || "",
      leaseDoc:        t.leaseDoc || null,
    });
    setShowModal(true);
  };

  const handleSaveTenant = () => {
    if (!form.name && form.status !== "vacant") return;
    if (editId !== null) {
      setTenantData(prev => prev.map(t => t.id === editId
        ? { ...t, propertyId: parseInt(form.propertyId), unit: form.unit || t.unit, name: form.name, rent: parseFloat(form.rent) || 0, securityDeposit: parseFloat(form.securityDeposit) || null, lateFeePct: parseFloat(form.lateFeePct) || null, renewalTerms: form.renewalTerms, notes: form.notes, leaseStart: form.leaseStart || null, leaseEnd: form.leaseEnd || null, status: form.status, phone: form.phone || null, email: form.email || null, leaseDoc: form.leaseDoc ?? t.leaseDoc }
        : t
      ));
    } else {
      setTenantData(prev => [...prev, { id: newId(), propertyId: parseInt(form.propertyId), unit: form.unit || "Main", name: form.name, rent: parseFloat(form.rent) || 0, securityDeposit: parseFloat(form.securityDeposit) || null, lateFeePct: parseFloat(form.lateFeePct) || null, renewalTerms: form.renewalTerms, notes: form.notes, leaseStart: form.leaseStart || null, leaseEnd: form.leaseEnd || null, status: form.status, lastPayment: null, phone: form.phone || null, email: form.email || null, leaseDoc: form.leaseDoc || null, moveOutDate: null, moveOutReason: null }]);
    }
    const wasEdit = editId !== null;
    setForm(emptyT);
    setShowModal(false);
    showToast(wasEdit ? "Tenant updated" : "Tenant added");
  };

  const handleDeleteTenant = () => {
    if (!deleteConfirm) return;
    setTenantData(prev => prev.filter(t => t.id !== deleteConfirm.id));
    setDeleteConfirm(null);
  };

  // Close lease: move tenant to "past" and create a vacant unit record
  const handleCloseLease = () => {
    if (!closingTenant) return;
    const t = closingTenant;
    setTenantData(prev => {
      const updated = prev.map(rec => rec.id === t.id
        ? { ...rec, status: "past", moveOutDate: closeForm.moveOutDate || new Date().toISOString().split("T")[0], moveOutReason: closeForm.moveOutReason }
        : rec
      );
      // Check if another active tenant already exists for this unit
      const hasActiveOnUnit = updated.some(rec => rec.id !== t.id && rec.propertyId === t.propertyId && rec.unit === t.unit && rec.status !== "past");
      if (!hasActiveOnUnit) {
        updated.push({ id: newId(), propertyId: t.propertyId, unit: t.unit, name: "Vacant", rent: t.rent, leaseStart: null, leaseEnd: null, status: "vacant", lastPayment: null, phone: null, email: null, securityDeposit: null, moveOutDate: null, moveOutReason: null, leaseDoc: null });
      }
      return updated;
    });
    setClosingTenant(null);
    setCloseForm({ moveOutDate: "", moveOutReason: "Lease ended" });
  };

  const leaseStatusStyle = {
    "active-lease":   { bg: "var(--success-badge)", text: "#1a7a4a" },
    "month-to-month": { bg: "var(--warning-bg)", text: "var(--warning-text)" },
    "vacant":         { bg: "var(--danger-badge)", text: "#c0392b" },
    "past":           { bg: "var(--surface-muted)", text: "var(--text-secondary)" },
  };

  const STATUS_LABELS = { "active-lease": "Active Lease", "month-to-month": "Month-to-Month", "vacant": "Vacant", "past": "Past Tenant" };

  // Active tenants = everything except "past" status
  const activeTenants = tenantData.filter(t => t.status !== "past");
  const pastTenants = tenantData.filter(t => t.status === "past");
  const isPastView = statusFilter === "past";

  const filteredTenants = tenantData.filter(t => {
    const matchProp = propFilter === "all" || t.propertyId === propFilter;
    if (statusFilter === "past") return matchProp && t.status === "past";
    if (statusFilter === "all") return matchProp && t.status !== "past";
    if (statusFilter === "expiring") {
      const days = getDaysLeft(t.leaseEnd);
      return matchProp && t.status !== "past" && t.status !== "vacant" && days !== null && days <= 90;
    }
    return matchProp && t.status === statusFilter;
  });

  const totalUnits = activeTenants.filter(t => propFilter === "all" || t.propertyId === propFilter).length;
  const occupied = activeTenants.filter(t => (propFilter === "all" || t.propertyId === propFilter) && t.status !== "vacant").length;
  const vacancyRate = totalUnits > 0 ? ((totalUnits - occupied) / totalUnits * 100).toFixed(0) : 0;
  const grossRent = activeTenants.filter(t => (propFilter === "all" || t.propertyId === propFilter) && t.status !== "vacant").reduce((s, t) => s + t.rent, 0);
  const expiringIn90 = activeTenants.filter(t => { const d = getDaysLeft(t.leaseEnd); return d !== null && d <= 90 && t.status !== "vacant"; });

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-blue)", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 14 }}>
          Back to Property
        </button>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Tenants</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>All tenants, leases, and occupancy status</p>
        </div>
        <select value={propFilter} onChange={e => setPropFilter(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
          <option value="all">All Properties</option>
          {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Units", value: totalUnits, sub: "Across portfolio", color: "var(--c-blue)", icon: Home, tip: "Count of all active unit records (excludes past tenants)" },
          { label: "Occupied", value: `${occupied}/${totalUnits}`, sub: `${100 - Number(vacancyRate)}% occupancy`, color: "var(--c-green)", icon: CheckSquare, tip: "Units with an active-lease or month-to-month tenant divided by total units" },
          { label: "Vacancy Rate", value: `${vacancyRate}%`, sub: `${totalUnits - occupied} unit${totalUnits - occupied !== 1 ? "s" : ""} vacant`, color: Number(vacancyRate) > 10 ? "var(--c-red)" : "#e95e00", icon: AlertCircle, semantic: true, tip: "Vacant units / total units. Red when above 10%" },
          { label: "Gross Monthly Rent", value: fmt(grossRent), sub: "Occupied units only", color: "var(--c-purple)", icon: DollarSign, tip: "Sum of monthly rent for all occupied units (excludes vacant)" },
        ].map((m, i) => <StatCard key={i} {...m} />)}
      </div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {[
            ["all", "All"],
            ["active-lease", "Active Lease"],
            ["month-to-month", "Month-to-Month"],
            ["vacant", "Vacant"],
            ["expiring", "Expiring Soon"],
            ["past", "Past Tenants"],
          ].map(([val, label]) => {
            const active = statusFilter === val;
            const count = val === "expiring" ? expiringIn90.length : val === "past" ? pastTenants.filter(t => propFilter === "all" || t.propertyId === propFilter).length : 0;
            return (
              <button key={val} onClick={() => setStatusFilter(val)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {label}{(val === "expiring" || val === "past") && count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
        {(propFilter !== "all" || statusFilter !== "all") && (
          <button onClick={() => { setPropFilter("all"); setStatusFilter("all"); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filters
          </button>
        )}
        <button onClick={openAdd} style={{ marginLeft: "auto", background: "var(--c-blue)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Add Tenant
        </button>
      </div>

      {expiringIn90.length > 0 && statusFilter !== "expiring" && !isPastView && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid #fdba74", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertCircle size={18} color="#9a3412" />
          <p style={{ color: "#9a3412", fontSize: 14, fontWeight: 600 }}>
            {expiringIn90.length} lease{expiringIn90.length !== 1 ? "s" : ""} expiring within 90 days:{" "}
            {expiringIn90.map(t => { const d = getDaysLeft(t.leaseEnd); return `${t.name.split(" ")[0]} (${d}d)`; }).join(", ")}
          </p>
        </div>
      )}
      <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {(isPastView
                ? ["Property / Unit", "Tenant", "Rent (was)", "Lease Period", "Move-Out Date", "Reason", ""]
                : ["Property / Unit", "Tenant", "Monthly Rent", "Lease Start", "Lease End", "Days Left", "Status", "Last Payment", ""]
              ).map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTenants.length === 0 && (
              <tr><td colSpan={isPastView ? 7 : 9}>
                {tenantData.length === 0 && !isPastView
                  ? <EmptyState icon={Users} title="No tenants yet" subtitle="Add your first tenant to start tracking leases and rent." actionLabel="Add Tenant" onAction={() => setShowModal(true)} />
                  : <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                      {isPastView ? "No past tenant records found." : "No tenants match your filters."}{" "}
                      <button onClick={() => { setPropFilter("all"); setStatusFilter("all"); }} style={{ background: "none", border: "none", color: "#e95e00", fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
                    </div>
                }
              </td></tr>
            )}
            {filteredTenants.map((t, i) => {
              const prop = PROPERTIES.find(p => p.id === t.propertyId);
              const s = leaseStatusStyle[t.status] || leaseStatusStyle["vacant"];
              const daysLeft = getDaysLeft(t.leaseEnd);
              const expiring = daysLeft !== null && daysLeft <= 90 && t.status !== "vacant" && t.status !== "past";
              const isFlash = flashId === t.id;
              const isActiveTenant = t.status === "active-lease" || t.status === "month-to-month";

              if (isPastView) {
                return (
                  <tr key={t.id} style={{ borderTop: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{prop?.name.split(" ").slice(0,2).join(" ")}</p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.email}</p>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>{fmt(t.rent)}</td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-secondary)" }}>
                      {t.leaseStart || "?"} &mdash; {t.leaseEnd || "?"}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{t.moveOutDate || "-"}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ background: "var(--surface-muted)", color: "var(--text-secondary)", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{t.moveOutReason || "-"}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button onClick={() => setDeleteConfirm(t)} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--c-red)" }} title="Delete record">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={t.id} ref={isFlash ? highlightRef : null} style={{ borderTop: "1px solid var(--border-subtle)", background: isFlash ? "var(--warning-btn-bg)" : i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)", transition: "background 2.5s ease" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{prop?.name.split(" ").slice(0,2).join(" ")}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.unit}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {t.status === "vacant" ? (
                      <span style={{ color: "var(--c-red)", fontSize: 13, fontWeight: 600, fontStyle: "italic" }}>Vacant</span>
                    ) : (
                      <div onClick={() => onSelectTenant && onSelectTenant(t)} style={{ cursor: onSelectTenant ? "pointer" : "default" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.email}</p>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: t.status === "vacant" ? "var(--text-muted)" : "var(--text-primary)" }}>{fmt(t.rent)}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{t.leaseStart || "-"}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{t.leaseEnd || "-"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    {daysLeft !== null && t.status !== "vacant" ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: expiring ? "#9a3412" : "#1a7a4a" }}>
                        {expiring ? "(!) " : ""}{daysLeft}d
                      </span>
                    ) : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{STATUS_LABELS[t.status] || t.status}</span>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{t.lastPayment || "-"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {isActiveTenant && (
                        <button onClick={() => { setClosingTenant(t); setCloseForm({ moveOutDate: new Date().toISOString().split("T")[0], moveOutReason: "Lease ended" }); }} style={{ background: "var(--warning-btn-bg)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "#9a3412", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }} title="Close this lease and move tenant to past records">
                          <LogOut size={12} /> Close
                        </button>
                      )}
                      <button onClick={() => openEdit(t)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "var(--text-label)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => setDeleteConfirm(t)} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--c-red)" }} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Turnover Analytics ── */}
      {!isPastView && pastTenants.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", marginTop: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Turnover Analytics</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Historical tenant turnover and rent trends</p>
          {(() => {
            const relevantPast = pastTenants.filter(t => propFilter === "all" || t.propertyId === propFilter);
            if (relevantPast.length === 0) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No past tenant data for this property.</p>;

            // Turnover rate: past tenants / (past + current active non-vacant) over all time
            const relevantActive = activeTenants.filter(t => (propFilter === "all" || t.propertyId === propFilter) && t.status !== "vacant");
            const turnoverRate = relevantActive.length + relevantPast.length > 0
              ? ((relevantPast.length / (relevantActive.length + relevantPast.length)) * 100).toFixed(0) : 0;

            // Avg vacancy days: for each past tenant, find the next tenant on same property+unit
            const vacancyDays = [];
            relevantPast.forEach(pt => {
              if (!pt.moveOutDate) return;
              // Find if a current or another past tenant took over this unit after this one left
              const successors = tenantData.filter(t => t.id !== pt.id && t.propertyId === pt.propertyId && t.unit === pt.unit && t.leaseStart && new Date(t.leaseStart) >= new Date(pt.moveOutDate));
              if (successors.length > 0) {
                successors.sort((a, b) => new Date(a.leaseStart) - new Date(b.leaseStart));
                const gap = Math.round((new Date(successors[0].leaseStart) - new Date(pt.moveOutDate)) / 86400000);
                if (gap >= 0) vacancyDays.push(gap);
              }
            });
            const avgVacancy = vacancyDays.length > 0 ? Math.round(vacancyDays.reduce((s, d) => s + d, 0) / vacancyDays.length) : null;

            // Rent growth per unit: compare past tenant's rent to current tenant's rent on same unit
            const rentChanges = [];
            relevantPast.forEach(pt => {
              const current = activeTenants.find(t => t.propertyId === pt.propertyId && t.unit === pt.unit && t.status !== "vacant");
              if (current && pt.rent > 0) {
                rentChanges.push({ unit: pt.unit, property: PROPERTIES.find(p => p.id === pt.propertyId)?.name?.split(" ").slice(0,2).join(" ") || "", from: pt.rent, to: current.rent, pct: ((current.rent - pt.rent) / pt.rent * 100).toFixed(1) });
              }
            });
            const avgRentGrowth = rentChanges.length > 0 ? (rentChanges.reduce((s, r) => s + parseFloat(r.pct), 0) / rentChanges.length).toFixed(1) : null;

            return (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                  <div style={{ background: "var(--surface-alt)", borderRadius: 12, padding: "16px 18px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Turnover Rate</p>
                      <InfoTip text="Past tenants / (past + current active tenants). Higher rates may indicate tenant satisfaction issues." />
                    </div>
                    <p style={{ color: Number(turnoverRate) > 50 ? "var(--c-red)" : "var(--text-primary)", fontSize: 22, fontWeight: 700 }}>{turnoverRate}%</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{relevantPast.length} past · {relevantActive.length} active</p>
                  </div>
                  <div style={{ background: "var(--surface-alt)", borderRadius: 12, padding: "16px 18px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg Vacancy Gap</p>
                      <InfoTip text="Average days between a tenant moving out and the next tenant's lease starting on the same unit." />
                    </div>
                    <p style={{ color: avgVacancy !== null && avgVacancy > 30 ? "#e95e00" : "var(--text-primary)", fontSize: 22, fontWeight: 700 }}>{avgVacancy !== null ? `${avgVacancy} days` : "—"}</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{vacancyDays.length > 0 ? `Based on ${vacancyDays.length} transition${vacancyDays.length !== 1 ? "s" : ""}` : "No transition data yet"}</p>
                  </div>
                  <div style={{ background: "var(--surface-alt)", borderRadius: 12, padding: "16px 18px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg Rent Growth</p>
                      <InfoTip text="Average rent increase (%) when a new tenant replaces a previous tenant on the same unit." />
                    </div>
                    <p style={{ color: avgRentGrowth !== null && parseFloat(avgRentGrowth) > 0 ? "var(--c-green)" : "var(--text-primary)", fontSize: 22, fontWeight: 700 }}>
                      {avgRentGrowth !== null ? `${parseFloat(avgRentGrowth) > 0 ? "+" : ""}${avgRentGrowth}%` : "—"}
                    </p>
                    <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{rentChanges.length > 0 ? `Across ${rentChanges.length} unit${rentChanges.length !== 1 ? "s" : ""}` : "No comparable data"}</p>
                  </div>
                </div>

                {/* Rent growth breakdown per unit */}
                {rentChanges.length > 0 && (
                  <div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Rent Growth by Unit</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {rentChanges.map((r, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-label)", minWidth: 120 }}>{r.property} · {r.unit}</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmt(r.from)}</span>
                          <ArrowRight size={12} color="#94a3b8" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(r.to)}</span>
                          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: parseFloat(r.pct) > 0 ? "var(--c-green)" : parseFloat(r.pct) < 0 ? "var(--c-red)" : "#94a3b8" }}>
                            {parseFloat(r.pct) > 0 ? "+" : ""}{r.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Close Lease Modal */}
      {closingTenant && (
        <Modal title="Close Lease" onClose={() => setClosingTenant(null)} width={480}>
          <div style={{ padding: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--warning-bg)", borderRadius: 12, border: "1px solid #fdba74", marginBottom: 20 }}>
              <AlertTriangle size={20} color="#9a3412" />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#9a3412" }}>This will end the lease for <strong>{closingTenant.name}</strong></p>
                <p style={{ fontSize: 12, color: "#9a3412", marginTop: 2 }}>
                  {PROPERTIES.find(p => p.id === closingTenant.propertyId)?.name} &middot; {closingTenant.unit} &middot; {fmt(closingTenant.rent)}/mo
                </p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              The tenant will be moved to past records and the unit will be marked as vacant.
            </p>
            <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Move-Out Date</label>
                <input type="date" value={closeForm.moveOutDate} onChange={e => setCloseForm(f => ({ ...f, moveOutDate: e.target.value }))} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Reason</label>
                <select value={closeForm.moveOutReason} onChange={e => setCloseForm(f => ({ ...f, moveOutReason: e.target.value }))} style={iS}>
                  <option>Lease ended</option>
                  <option>Lease not renewed</option>
                  <option>Relocated for work</option>
                  <option>Purchased own home</option>
                  <option>Lease ended, rent increase</option>
                  <option>Eviction</option>
                  <option>Mutual agreement</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setClosingTenant(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCloseLease} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Close Lease</button>
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal title={editId ? "Edit Tenant" : "Add Tenant"} onClose={() => setShowModal(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Property</label>
              <select value={form.propertyId} onChange={sf("propertyId")} style={iS}>
                {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Unit</label>
              <input type="text" placeholder="e.g. Unit A, #4B" value={form.unit} onChange={sf("unit")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Status</label>
              <select value={form.status} onChange={sf("status")} style={iS}>
                <option value="active-lease">Active Lease</option>
                <option value="month-to-month">Month-to-Month</option>
                <option value="vacant">Vacant</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Tenant Name *</label>
              <input type="text" placeholder="Full name" value={form.name} onChange={sf("name")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Monthly Rent ($)</label>
              <input type="number" placeholder="0" value={form.rent} onChange={sf("rent")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Phone</label>
              <input type="text" placeholder="555-000-0000" value={form.phone} onChange={sf("phone")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Lease Start</label>
              <input type="date" value={form.leaseStart} onChange={sf("leaseStart")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Lease End</label>
              <input type="date" value={form.leaseEnd} onChange={sf("leaseEnd")} style={iS} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Email</label>
              <input type="email" placeholder="tenant@email.com" value={form.email} onChange={sf("email")} style={iS} />
            </div>
          </div>

          {/* Lease Details Section */}
          <div style={{ background: "var(--success-tint)", borderRadius: 14, padding: "16px 18px", marginTop: 18, border: "1px solid #9fcfb4" }}>
            <p style={{ color: "#166534", fontSize: 13, fontWeight: 700, marginBottom: 14, letterSpacing: "0.03em", textTransform: "uppercase" }}>Lease Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Security Deposit ($)</label>
                <input type="number" placeholder="0" value={form.securityDeposit} onChange={sf("securityDeposit")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Late Fee (%)</label>
                <input type="number" placeholder="5" value={form.lateFeePct} onChange={sf("lateFeePct")} style={iS} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Renewal Terms</label>
                <select value={form.renewalTerms} onChange={sf("renewalTerms")} style={iS}>
                  <option value="Annual">Annual</option>
                  <option value="Month-to-Month">Month-to-Month</option>
                  <option value="6-Month">6-Month</option>
                  <option value="5-Year Option">5-Year Option</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Notes</label>
                <textarea placeholder="Any additional notes about this tenant or lease..." value={form.notes} onChange={sf("notes")} rows={3} style={{ ...iS, resize: "vertical", lineHeight: 1.5 }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Lease Document</label>
                {form.leaseDoc ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--surface)", borderRadius: 10, border: "1px solid #d1fae5" }}>
                    <FileText size={20} color="var(--c-green)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{form.leaseDoc.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{form.leaseDoc.size}</div>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, leaseDoc: null }))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-red)", padding: 4, display: "flex", alignItems: "center" }}><X size={15} /></button>
                  </div>
                ) : (
                  <div onClick={() => document.getElementById("leaseDocInput").click()} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--surface)", borderRadius: 10, border: "2px dashed #9fcfb4", cursor: "pointer" }}>
                    <UploadCloud size={20} color="var(--c-green)" />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Click to upload lease (PDF, DOC)</span>
                  </div>
                )}
                <input id="leaseDocInput" type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={handleLeaseDocUpload} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveTenant} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-blue)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              {editId ? "Save Changes" : "Add Tenant"}
            </button>
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title={deleteConfirm.status === "past" ? "Delete Past Tenant Record" : "Remove Tenant"} onClose={() => setDeleteConfirm(null)} width={440}>
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--danger-badge)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Trash2 size={22} color="var(--c-red)" />
            </div>
            <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              {deleteConfirm.status === "past" ? "Delete" : "Remove"} <strong>{deleteConfirm.name || "Vacant Unit"}</strong> from {PROPERTIES.find(p => p.id === deleteConfirm.propertyId)?.name || "property"}?
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 6 }}>
              Unit {deleteConfirm.unit} · {deleteConfirm.status === "vacant" ? "Vacant" : deleteConfirm.status === "past" ? `Past tenant · Moved out ${deleteConfirm.moveOutDate || "N/A"}` : `Rent ${fmt(deleteConfirm.rent)}/mo`}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 24 }}>
              This will permanently remove this {deleteConfirm.status === "past" ? "historical" : "tenant"} record. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDeleteTenant} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{deleteConfirm.status === "past" ? "Delete Record" : "Remove Tenant"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
