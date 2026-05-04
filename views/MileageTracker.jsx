// =============================================================================
// MileageTracker — log and analyze business trips, computing IRS deduction.
// Linked properties/deals from the canonical lists drive the dropdown.
// =============================================================================
import { useState } from "react";
import {
  Plus, Search, Pencil, Trash2, Download, X, Car, Route, DollarSign, Truck,
} from "lucide-react";
import { fmt, newId, MOCK_USER, DEALS } from "../api.js";
import { MILEAGE_TRIPS, PROPERTIES } from "../mockData.js";
import { TAX_CONFIG } from "../finance.js";
import { StatCard, Modal, iS, downloadFile } from "../shared.jsx";

export function MileageTracker() {
  const [tripData, setTripData] = useState(MILEAGE_TRIPS);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("thisYear");
  const [search, setSearch] = useState("");
  const [linkedFilter, setLinkedFilter] = useState("all"); // "all" | property name | deal name
  const emptyTrip = { date: "", description: "", from: "Home", to: "", miles: "", purpose: "Rental", businessPct: "100", linkedTo: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
  const [form, setForm] = useState(emptyTrip);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const openAdd = () => { setEditId(null); setForm(emptyTrip); setShowModal(true); };
  const openEdit = t => {
    setEditId(t.id);
    setForm({ date: t.date, description: t.description, from: t.from, to: t.to, miles: String(t.miles), purpose: t.purpose, businessPct: String(t.businessPct), linkedTo: t.linkedTo || "", createdAt: t.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), userId: t.userId || MOCK_USER.id });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.miles || !form.to) return;
    const built = { date: form.date || new Date().toISOString().split("T")[0], description: form.description || form.to, from: form.from, to: form.to, miles: parseFloat(form.miles) || 0, purpose: form.purpose, businessPct: parseFloat(form.businessPct) || 100, linkedTo: form.linkedTo || "" };
    if (editId !== null) {
      setTripData(prev => prev.map(t => t.id === editId ? { ...t, ...built } : t));
    } else {
      setTripData(prev => [{ id: newId(), ...built }, ...prev]);
    }
    setForm(emptyTrip);
    setEditId(null);
    setShowModal(false);
  };

  const IRS_RATE = TAX_CONFIG.mileageRate;
  const purposeColors = { Deal: "#e95e00", Rental: "var(--c-blue)", Business: "var(--c-purple)" };

  const mNow = new Date();
  const mThisYear = mNow.getFullYear();
  const mThisMonth = mNow.getMonth();
  const matchesMileageDate = t => {
    if (dateFilter === "all") return true;
    const d = new Date(t.date);
    if (dateFilter === "thisMonth") return d.getFullYear() === mThisYear && d.getMonth() === mThisMonth;
    if (dateFilter === "lastMonth") { const lm = mThisMonth === 0 ? 11 : mThisMonth - 1; const ly = mThisMonth === 0 ? mThisYear - 1 : mThisYear; return d.getFullYear() === ly && d.getMonth() === lm; }
    if (dateFilter === "thisYear") return d.getFullYear() === mThisYear;
    return true;
  };

  const filteredTrips = tripData.filter(t =>
    (purposeFilter === "all" || t.purpose === purposeFilter) &&
    matchesMileageDate(t) &&
    (linkedFilter === "all" || (t.linkedTo || "") === linkedFilter) &&
    (!search || t.description.toLowerCase().includes(search.toLowerCase()) || t.from.toLowerCase().includes(search.toLowerCase()) || t.to.toLowerCase().includes(search.toLowerCase()))
  );

  // Get unique linked properties/deals for filter dropdown
  const linkedOptions = [...new Set(tripData.map(t => t.linkedTo).filter(Boolean))].sort();

  const totalMiles = filteredTrips.reduce((s, t) => s + t.miles, 0);
  const businessMiles = filteredTrips.filter(t => t.businessPct === 100).reduce((s, t) => s + t.miles, 0);
  const deduction = filteredTrips.reduce((s, t) => s + t.miles * IRS_RATE * t.businessPct / 100, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Mileage Tracker</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Log business trips · IRS rate: ${IRS_RATE}/mile (${TAX_CONFIG.mileageRateYear})</p>
        </div>
        <button onClick={openAdd} style={{ background: "var(--c-blue)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Add Trip
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Miles", value: totalMiles.toFixed(1), sub: dateFilter === "thisYear" ? "This year" : dateFilter === "thisMonth" ? "This month" : dateFilter === "lastMonth" ? "Last month" : "All time", color: "var(--c-blue)", icon: Car, tip: "Sum of all miles logged for the selected time period and purpose filter." },
          { label: "Business Miles", value: businessMiles.toFixed(1), sub: "100% deductible trips", color: "var(--c-green)", icon: Route, tip: "Miles from trips marked as 100% business deductible." },
          { label: "Mileage Deduction", value: fmt(deduction), sub: `@ $${IRS_RATE}/mile IRS rate`, color: "var(--c-purple)", icon: DollarSign, tip: "Total deductible miles × IRS standard mileage rate. Each trip's miles are multiplied by its business-use percentage." },
          { label: "Trips", value: filteredTrips.length, sub: `of ${tripData.length} total logged`, color: "#e95e00", icon: Truck, tip: "Number of trips matching the current filters out of all logged trips." },
        ].map((m, i) => <StatCard key={i} {...m} />)}
      </div>
      {/* Mileage filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {[["all", "All Purposes"], ["Rental", "Rental"], ["Deal", "Deal"], ["Business", "Business"]].map(([val, label]) => {
            const active = purposeFilter === val;
            return (
              <button key={val} onClick={() => setPurposeFilter(val)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "0 12px" }}>
          <Search size={14} color="#94a3b8" />
          <input placeholder="Search trips..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: "none", background: "transparent", fontSize: 13, color: "var(--text-label)", outline: "none", padding: "9px 0", width: 140 }} />
        </div>
        {linkedOptions.length > 0 && (
          <select value={linkedFilter} onChange={e => setLinkedFilter(e.target.value)} style={{ ...iS, width: "auto", minWidth: 160, fontSize: 13, padding: "9px 12px" }}>
            <option value="all">All Properties / Deals</option>
            {linkedOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ ...iS, width: "auto", minWidth: 140, fontSize: 13, padding: "9px 12px", marginLeft: "auto" }}>
          <option value="thisYear">This Year</option>
          <option value="thisMonth">This Month</option>
          <option value="lastMonth">Last Month</option>
          <option value="all">All Time</option>
        </select>
        {(purposeFilter !== "all" || dateFilter !== "thisYear" || search || linkedFilter !== "all") && (
          <button onClick={() => { setPurposeFilter("all"); setDateFilter("thisYear"); setSearch(""); setLinkedFilter("all"); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>Trip Log</h3>
          <button onClick={() => {
            let csv = "Date,Description,From,To,Miles,Purpose,Business%,Deduction,Linked To\n";
            filteredTrips.forEach(t => {
              csv += `${t.date},"${t.description}","${t.from}","${t.to}",${t.miles},${t.purpose},${t.businessPct},${(t.miles * IRS_RATE * t.businessPct / 100).toFixed(2)},"${t.linkedTo || ""}"\n`;
            });
            csv += `\nTotal,,,,${totalMiles.toFixed(1)},,,${deduction.toFixed(2)},\n`;
            downloadFile(csv, `PropBooks_Mileage_${mThisYear}.csv`, "text/csv");
          }} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", background: "var(--surface)", color: "var(--text-label)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["Date", "Description", "From / To", "Linked To", "Miles", "Purpose", "Deduction", ""].map(h => (
                <th key={h} style={{ padding: "12px 18px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTrips.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "40px 18px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No trips match your filters.</td></tr>
            )}
            {filteredTrips.map((t, i) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                <td style={{ padding: "13px 18px", fontSize: 13, color: "var(--text-secondary)" }}>{t.date}</td>
                <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.description}</td>
                <td style={{ padding: "13px 18px", fontSize: 12, color: "var(--text-label)" }}>{t.from}  /  {t.to.split(",")[0]}</td>
                <td style={{ padding: "13px 18px", fontSize: 12, color: t.linkedTo ? "var(--text-label)" : "var(--text-muted)" }}>{t.linkedTo || "—"}</td>
                <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{t.miles} mi</td>
                <td style={{ padding: "13px 18px" }}>
                  <span style={{ background: (purposeColors[t.purpose] || "#94a3b8") + "20", color: purposeColors[t.purpose] || "var(--text-label)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{t.purpose}</span>
                </td>
                <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 700, color: "#1a7a4a" }}>{fmt(t.miles * IRS_RATE * t.businessPct / 100)}</td>
                <td style={{ padding: "13px 18px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openEdit(t)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteConfirm(t)} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--surface-alt)", borderTop: "2px solid var(--border)" }}>
              <td colSpan={4} style={{ padding: "12px 18px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Totals ({filteredTrips.length} trips)</td>
              <td style={{ padding: "12px 18px", fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{totalMiles.toFixed(1)} mi</td>
              <td />
              <td style={{ padding: "12px 18px", fontSize: 15, fontWeight: 800, color: "#1a7a4a" }}>{fmt(deduction)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {showModal && (
        <Modal title={editId ? "Edit Trip" : "Add Trip"} onClose={() => { setShowModal(false); setEditId(null); }} width={460}>
          {[
            { label: "Date", type: "date", key: "date" },
            { label: "Description", type: "text", key: "description", placeholder: "e.g. Inspect Oakdale Craftsman" },
            { label: "From", type: "text", key: "from", placeholder: "Starting location" },
            { label: "To *", type: "text", key: "to", placeholder: "Destination" },
            { label: "Miles *", type: "number", key: "miles", placeholder: "0.0" },
            { label: "Business Use %", type: "number", key: "businessPct", placeholder: "100" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={sf(f.key)} style={iS} />
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Purpose</label>
            <select value={form.purpose} onChange={sf("purpose")} style={iS}>
              {["Deal","Rental","Business"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Linked Property / Deal</label>
            <select value={form.linkedTo} onChange={sf("linkedTo")} style={iS}>
              <option value="">None</option>
              <optgroup label="Properties">
                {PROPERTIES.map(p => <option key={`p-${p.id}`} value={p.name}>{p.name}</option>)}
              </optgroup>
              <optgroup label="Deals">
                {DEALS.map(f => <option key={`f-${f.id}`} value={f.name}>{f.name}</option>)}
              </optgroup>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSave} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-blue)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{editId ? "Save Changes" : "Save Trip"}</button>
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title="Delete Trip" onClose={() => setDeleteConfirm(null)}>
          <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this trip?</p>
          <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{deleteConfirm.from} → {deleteConfirm.to}</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{deleteConfirm.date} · {deleteConfirm.miles} mi · {deleteConfirm.purpose}</p>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { setTripData(prev => prev.filter(x => x.id !== deleteConfirm.id)); setDeleteConfirm(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
