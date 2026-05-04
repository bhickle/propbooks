// =============================================================================
// Properties — grid/list view of the rental portfolio with add/edit/delete
// modal. Mutates PROPERTIES in place.
// =============================================================================
import { useState, useEffect } from "react";
import { Plus, Search, Filter, Pencil, Trash2, MapPin, Home, X, UploadCloud } from "lucide-react";
import { fmt, fmtK, newId, PROP_COLORS } from "../api.js";
import { PROPERTIES, TRANSACTIONS } from "../mockData.js";
import { calcLoanBalance, getEffectiveMonthly, calcCapRate } from "../finance.js";
import { daysAgo, getPropertyHealth, healthBadge } from "../health.js";
import { useToast } from "../toast.jsx";
import { Modal, Badge, EmptyState, iS } from "../shared.jsx";

export function Properties({ onSelect, editPropertyId, onClearEditId, convertDealData, onClearConvertFlip, onGuidedSetup }) {
  const { showToast } = useToast();
  // Read/write the global PROPERTIES store directly — same pattern DEALS and
  // TRANSACTIONS use. A local React state copy here caused add/edit/delete
  // (and the deal→rental conversion flow) to mutate only the local copy,
  // leaving the rest of the app unaware of the change.
  const [, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null); // null = add, id = edit
  const [deleteConfirm, setDeleteConfirm] = useState(null); // property object to confirm delete
  const emptyP = { name: "", address: "", type: "Single Family", units: "1", purchasePrice: "", currentValue: "", closingCosts: "", landValue: "", loanAmount: "", loanRate: "", loanTermYears: "30", loanStartDate: "", monthlyRent: "", monthlyExpenses: "", status: "Occupied", purchaseDate: "", photo: null };
  const [form, setForm] = useState(emptyP);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-open edit modal when navigated from PropertyDetail health banner
  useEffect(() => {
    if (editPropertyId) {
      const p = PROPERTIES.find(pr => pr.id === editPropertyId);
      if (p) {
        setEditId(p.id);
        setForm({ name: p.name, address: p.address, type: p.type, units: String(p.units), purchasePrice: String(p.purchasePrice), currentValue: String(p.currentValue), closingCosts: String(p.closingCosts || ""), landValue: String(p.landValue || ""), loanAmount: String(p.loanAmount || ""), loanRate: String(p.loanRate || ""), loanTermYears: String(p.loanTermYears || "30"), loanStartDate: p.loanStartDate || "", monthlyRent: String(p.monthlyRent), monthlyExpenses: String(p.monthlyExpenses), status: p.status, purchaseDate: p.purchaseDate || "", photo: p.photo || null });
        setShowModal(true);
      }
      onClearEditId && onClearEditId();
    }
  }, [editPropertyId]); // eslint-disable-line react-hooks/exhaustive-deps -- onClearEditId is an inline parent callback (new ref every render)

  // Auto-open Add Property modal when converting a deal to rental
  useEffect(() => {
    if (convertDealData) {
      setEditId(null);
      setForm({
        ...emptyP,
        name: convertDealData.name || "",
        address: convertDealData.address || "",
        type: convertDealData.type || "Single Family",
        units: convertDealData.units || "1",
        purchasePrice: convertDealData.purchasePrice || "",
        currentValue: convertDealData.currentValue || "",
        closingCosts: convertDealData.closingCosts || "",
        purchaseDate: convertDealData.purchaseDate || "",
      });
      setShowModal(true);
      onClearConvertFlip && onClearConvertFlip();
    }
  }, [convertDealData]); // eslint-disable-line react-hooks/exhaustive-deps -- onClearConvertFlip is an inline parent callback; emptyP is stable

  const handlePhotoUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, photo: ev.target.result }));
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-upload of same file
  };

  const openEdit = (e, p) => {
    e.stopPropagation();
    setEditId(p.id);
    setForm({ name: p.name, address: p.address, type: p.type, units: String(p.units), purchasePrice: String(p.purchasePrice), currentValue: String(p.currentValue), closingCosts: String(p.closingCosts || ""), landValue: String(p.landValue || ""), loanAmount: String(p.loanAmount || ""), loanRate: String(p.loanRate || ""), loanTermYears: String(p.loanTermYears || "30"), loanStartDate: p.loanStartDate || "", monthlyRent: String(p.monthlyRent), monthlyExpenses: String(p.monthlyExpenses), status: p.status, purchaseDate: p.purchaseDate || "", photo: p.photo || null });
    setShowModal(true);
  };

  const handleSaveProp = () => {
    if (!form.name) return;
    const rent = parseFloat(form.monthlyRent) || 0;
    const exp  = parseFloat(form.monthlyExpenses) || 0;
    const val  = parseFloat(form.currentValue) || 0;
    const loanAmt  = parseFloat(form.loanAmount) || 0;
    const loanRate = parseFloat(form.loanRate) || 0;
    const loanTerm = parseFloat(form.loanTermYears) || 30;
    const loanStart = form.loanStartDate || "";
    const cc = parseFloat(form.closingCosts) || 0;
    const today = new Date().toISOString().slice(0, 10);

    if (editId !== null) {
      const idx = PROPERTIES.findIndex(p => p.id === editId);
      if (idx !== -1) {
        const p = PROPERTIES[idx];
        const valChanged = val !== p.currentValue;
        const land = parseFloat(form.landValue) || null;
        PROPERTIES[idx] = { ...p, name: form.name, address: form.address, type: form.type, units: parseInt(form.units) || 1, purchasePrice: parseFloat(form.purchasePrice) || 0, currentValue: val, valueUpdatedAt: valChanged ? today : (p.valueUpdatedAt || today), loanAmount: loanAmt, loanRate, loanTermYears: loanTerm, loanStartDate: loanStart, closingCosts: cc, landValue: land, monthlyRent: rent, monthlyExpenses: exp, purchaseDate: form.purchaseDate, status: form.status, photo: form.photo ?? p.photo };
      }
    } else {
      const usedColors = PROPERTIES.map(p => p.color);
      const color = PROP_COLORS.find(c => !usedColors.includes(c)) || PROP_COLORS[PROPERTIES.length % PROP_COLORS.length];
      const land = parseFloat(form.landValue) || null;
      PROPERTIES.push({ id: newId(), name: form.name, address: form.address, type: form.type, units: parseInt(form.units) || 1, purchasePrice: parseFloat(form.purchasePrice) || 0, currentValue: val, valueUpdatedAt: today, loanAmount: loanAmt, loanRate, loanTermYears: loanTerm, loanStartDate: loanStart, closingCosts: cc, landValue: land, monthlyRent: rent, monthlyExpenses: exp, purchaseDate: form.purchaseDate, status: form.status, image: form.name.slice(0, 2).toUpperCase(), color, photo: form.photo || null });
    }
    const wasEdit = editId !== null;
    setForm(emptyP);
    setShowModal(false);
    rerender();
    showToast(wasEdit ? "Property updated" : "Property added to portfolio");
  };

  const handleDeleteProp = () => {
    if (!deleteConfirm) return;
    const idx = PROPERTIES.findIndex(p => p.id === deleteConfirm.id);
    if (idx !== -1) PROPERTIES.splice(idx, 1);
    setDeleteConfirm(null);
    rerender();
  };

  const filtered = PROPERTIES.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.type.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Properties</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>{PROPERTIES.length} properties in your portfolio</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onGuidedSetup} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Property
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search properties..." style={{ width: "100%", paddingLeft: 38, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" }} />
        </div>
        <button style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px", background: "var(--surface)", color: "var(--text-label)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Filter size={15} /> Filter
        </button>
        <div style={{ display: "flex", background: "var(--surface-muted)", borderRadius: 10, padding: 3 }}>
          {["grid", "list"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: view === v ? "var(--surface)" : "transparent", color: view === v ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
              {v === "grid" ? "#" : "="}
            </button>
          ))}
        </div>
      </div>

      {view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {filtered.map(p => {
            const calcBal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate);
            const effectiveMortgage = calcBal !== null ? calcBal : (p.mortgage || 0);
            const equity = p.currentValue - effectiveMortgage;
            const eff = getEffectiveMonthly(p, TRANSACTIONS);
            const monthlyNet = eff.monthlyIncome - eff.monthlyExpenses;
            const pHealth = getPropertyHealth(p, TRANSACTIONS);
            const pBadge = healthBadge(pHealth);
            return (
              <div key={p.id} onClick={() => onSelect(p)} style={{ background: "var(--surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}>
                <div style={{ height: 130, background: p.photo ? "transparent" : "linear-gradient(135deg, #1e3a5f, #0a2240)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                  {p.photo
                    ? <img src={p.photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 800 }}>{p.image}</div>
                  }
                  <div style={{ position: "absolute", top: 10, left: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "3px 9px", background: pBadge.bg, color: pBadge.color, backdropFilter: "blur(4px)" }}>{pBadge.label}</span>
                  </div>
                  <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Badge status={p.status} />
                    <button onClick={e => openEdit(e, p)} title="Edit property"
                      style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", display: "flex", alignItems: "center", backdropFilter: "blur(4px)" }}>
                      <Pencil size={12} color="#475569" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDeleteConfirm(p); }} title="Delete property"
                      style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", display: "flex", alignItems: "center", backdropFilter: "blur(4px)" }}>
                      <Trash2 size={12} color="var(--c-red)" />
                    </button>
                  </div>
                </div>
                <div style={{ padding: 18 }}>
                  <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{p.name}</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={11} /> {p.address.split(",")[1]?.trim()} . {p.type}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Value</p>
                      <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>{fmtK(p.currentValue)}</p>
                      {p.valueUpdatedAt && (() => {
                        const staleD = Math.round((new Date() - new Date(p.valueUpdatedAt)) / 86400000);
                        const staleV = staleD > 90;
                        return <p style={{ color: staleV ? "#c2410c" : "#cbd5e1", fontSize: 10, marginTop: 1 }}>{staleV ? "⚠ Value may be outdated" : `Value as of ${daysAgo(p.valueUpdatedAt)}`}</p>;
                      })()}
                    </div>
                    <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Equity</p>
                      <p style={{ color: "var(--c-green)", fontSize: 15, fontWeight: 700 }}>{fmtK(equity)}</p>
                      {calcBal !== null && <p style={{ color: "#cbd5e1", fontSize: 10, marginTop: 1 }}>Balance {fmtK(effectiveMortgage)}</p>}
                    </div>
                    <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Monthly CF</p>
                      <p style={{ color: monthlyNet >= 0 ? "var(--c-green)" : "var(--c-red)", fontSize: 15, fontWeight: 700 }}>{fmt(monthlyNet)}</p>
                    </div>
                    <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Cap Rate</p>
                      <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>{calcCapRate(p)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: "1 / -1" }}>
              {PROPERTIES.length === 0
                ? <EmptyState icon={Home} title="No properties yet" subtitle="Add your first rental property to start tracking your portfolio." actionLabel="Add Property" onAction={onGuidedSetup} />
                : <EmptyState icon={Search} title="No properties found" subtitle="Try adjusting your search or filters." />
              }
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-alt)" }}>
                {["Property", "Type", "Value", "Equity", "Monthly Income", "Net Cash Flow", "Cap Rate", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "14px 20px", textAlign: "left", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const lBal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate);
                const effMort = lBal !== null ? lBal : (p.mortgage || 0);
                const tHealth = getPropertyHealth(p, TRANSACTIONS);
                const tBadge = healthBadge(tHealth);
                return (
                <tr key={p.id} onClick={() => onSelect(p)} style={{ borderTop: "1px solid var(--border-subtle)", cursor: "pointer", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--info-tint-alt)"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)"}>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, position: "relative" }}>
                        {p.image}
                        {tHealth.length > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: "50%", background: tBadge.color, border: "2px solid var(--surface)" }} />}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.units} unit{p.units > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: 13, color: "var(--text-label)" }}>{p.type}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{fmtK(p.currentValue)}</p>
                    {p.valueUpdatedAt && (() => {
                      const staleD = Math.round((new Date() - new Date(p.valueUpdatedAt)) / 86400000);
                      const staleV = staleD > 90;
                      return <p style={{ fontSize: 11, color: staleV ? "#c2410c" : "#cbd5e1" }}>{staleV ? "⚠ Value may be outdated" : `Value as of ${daysAgo(p.valueUpdatedAt)}`}</p>;
                    })()}
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-green)" }}>{fmtK(p.currentValue - effMort)}</p>
                    {lBal !== null && <p style={{ fontSize: 11, color: "#cbd5e1" }}>Balance {fmtK(effMort)}</p>}
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{fmt(getEffectiveMonthly(p, TRANSACTIONS).monthlyIncome)}</td>
                  <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(getEffectiveMonthly(p, TRANSACTIONS).monthlyIncome - getEffectiveMonthly(p, TRANSACTIONS).monthlyExpenses)}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <span style={{ background: "var(--purple-tint)", color: "#6d28d9", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{calcCapRate(p, TRANSACTIONS)}%</span>
                  </td>
                  <td style={{ padding: "16px 20px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={e => openEdit(e, p)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "var(--text-label)", fontSize: 12, fontWeight: 600 }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirm(p); }} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--c-red)" }} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9}>
                  {PROPERTIES.length === 0
                    ? <EmptyState icon={Home} title="No properties yet" subtitle="Add your first rental property to start tracking your portfolio." actionLabel="Add Property" onAction={onGuidedSetup} />
                    : <EmptyState icon={Search} title="No properties found" subtitle="Try adjusting your search or filters." />
                  }
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <Modal title={editId ? "Edit Property" : "Add Property"} onClose={() => setShowModal(false)} width={580}>
          {/* Photo Upload */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Property Photo</label>
            <div
              onClick={() => document.getElementById("propPhotoInput").click()}
              style={{ position: "relative", height: form.photo ? 160 : 100, borderRadius: 14, border: "2px dashed var(--border)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: form.photo ? "transparent" : "var(--surface-alt)", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--c-blue)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
            >
              {form.photo ? (
                <>
                  <img src={form.photo} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                    <div style={{ background: "rgba(0,0,0,0.55)", borderRadius: 10, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 600 }}>Change Photo</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, photo: null })); }}
                    style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: 20, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
                    <X size={13} />
                  </button>
                </>
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)", pointerEvents: "none" }}>
                  <UploadCloud size={28} style={{ margin: "0 auto 6px" }} />
                  <p style={{ fontSize: 13, fontWeight: 500 }}>Click to upload photo</p>
                  <p style={{ fontSize: 11, marginTop: 2 }}>JPG, PNG, WEBP</p>
                </div>
              )}
            </div>
            <input id="propPhotoInput" type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
          </div>

          {/* Basic Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { label: "Property Name *", key: "name", type: "text", placeholder: "e.g. Maple Ridge Duplex", full: true },
              { label: "Address", key: "address", type: "text", placeholder: "Street, City, State ZIP", full: true },
              { label: "Purchase Price ($)", key: "purchasePrice", type: "number", placeholder: "0" },
              { label: "Current Value ($)", key: "currentValue", type: "number", placeholder: "0" },
              { label: "Closing Costs ($)", key: "closingCosts", type: "number", placeholder: "0" },
              { label: "Land Value ($)", key: "landValue", type: "number", placeholder: "From tax assessment" },
              { label: "Est. Monthly Rent ($)", key: "monthlyRent", type: "number", placeholder: "0" },
              { label: "Est. Monthly Expenses ($)", key: "monthlyExpenses", type: "number", placeholder: "0" },
              { label: "Units", key: "units", type: "number", placeholder: "1" },
              { label: "Purchase Date", key: "purchaseDate", type: "date", placeholder: "" },
            ].map(f => (
              <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : "auto" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={sf(f.key)} style={iS} />
                {f.key === "landValue" && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {form.landValue && parseFloat(form.purchasePrice) > 0
                      ? `Building value: ${fmt(parseFloat(form.purchasePrice) - parseFloat(form.landValue))} (depreciable basis for Schedule E)`
                      : "From county tax assessment. Used for depreciation — if blank, 20% of purchase price is estimated."}
                  </p>
                )}
              </div>
            ))}
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Type</label>
              <select value={form.type} onChange={sf("type")} style={iS}>
                {["Single Family","Multi-Family","Condo","Commercial","Land"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Status</label>
              <select value={form.status} onChange={sf("status")} style={iS}>
                {["Occupied","Partial Vacancy","Vacant"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Loan Details Section */}
          <div style={{ margin: "20px 0 14px", padding: "14px 16px", background: "var(--warning-bg)", borderRadius: 12, border: "1px solid var(--warning-border)" }}>
            <p style={{ color: "var(--c-blue)", fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              🏦 Loan Details — balance calculated automatically from these
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Original Loan Amount ($)</label>
                <input type="number" placeholder="e.g. 308000" value={form.loanAmount} onChange={sf("loanAmount")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Interest Rate (%)</label>
                <input type="number" step="0.01" placeholder="e.g. 3.25" value={form.loanRate} onChange={sf("loanRate")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Loan Term (years)</label>
                <input type="number" placeholder="30" value={form.loanTermYears} onChange={sf("loanTermYears")} style={iS} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Loan Start Date</label>
                <input type="date" value={form.loanStartDate} onChange={sf("loanStartDate")} style={iS} />
              </div>
              {form.loanAmount && form.loanRate && form.loanTermYears && form.loanStartDate && (() => {
                const b = calcLoanBalance(form.loanAmount, form.loanRate, form.loanTermYears, form.loanStartDate);
                return b !== null ? (
                  <div style={{ gridColumn: "1 / -1", background: "var(--surface)", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--info-border-alt)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Estimated current balance:</span>
                    <span style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>{fmt(b)}</span>
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveProp} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              {editId ? "Save Changes" : "Add Property"}
            </button>
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title="Delete Property" onClose={() => setDeleteConfirm(null)} width={440}>
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--danger-badge)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Trash2 size={22} color="var(--c-red)" />
            </div>
            <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 6 }}>
              {deleteConfirm.address}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 24 }}>
              This will remove the property and its data from your portfolio. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDeleteProp} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete Property</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

