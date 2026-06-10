// =============================================================================
// Properties — modal-host overlay for Add / Edit Property. The grid/list view
// was retired when AssetList took over; this component now renders nothing
// unless an edit or convert-from-rehab trigger is active.
// =============================================================================
import { useState, useEffect, useRef } from "react";
import { X, UploadCloud, Trash2 } from "lucide-react";
import { fmt, PROP_COLORS, PROPERTY_TYPES, PROPERTY_STATUSES } from "../api.js";
import { PROPERTIES } from "../mockData.js";
import { calcLoanBalance } from "../finance.js";
import { useToast } from "../toast.jsx";
import { Modal, iS } from "../shared.jsx";
import { createProperty, updateProperty as dbUpdateProperty, deleteProperty as dbDeleteProperty } from "../db/properties.js";

// Avatar-tile initials, derived from the name. Matches the fallback in
// db/properties.js#fromRow so create, edit, and hydration all agree.
function propInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export function Properties({ onSelect, editPropertyId, onClearEditId, convertDealData, onClearConvertFlip, onGuidedSetup, onComplete }) {
  // Modal-only mode: when an edit or convert trigger is set, hide the list
  // and treat the screen as a modal-host overlay. After the modal closes the
  // onComplete callback runs so the caller can navigate the user back to
  // whatever surface they came from (typically Assets).
  const isModalOnly = !!editPropertyId || !!convertDealData;
  const wasModalOnlyOpen = useRef(false);
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

  const handleSaveProp = async () => {
    if (!form.name) return;
    const rent = parseFloat(form.monthlyRent) || 0;
    const exp  = parseFloat(form.monthlyExpenses) || 0;
    const val  = parseFloat(form.currentValue) || 0;
    const loanAmt  = parseFloat(form.loanAmount) || 0;
    const loanRate = parseFloat(form.loanRate) || 0;
    const loanTerm = parseFloat(form.loanTermYears) || 30;
    const loanStart = form.loanStartDate || null;
    const cc = parseFloat(form.closingCosts) || 0;
    const today = new Date().toISOString().slice(0, 10);

    try {
      if (editId !== null) {
        const idx = PROPERTIES.findIndex(p => p.id === editId);
        const prev = idx !== -1 ? PROPERTIES[idx] : null;
        const valChanged = prev ? val !== prev.currentValue : true;
        const land = parseFloat(form.landValue) || null;
        const updates = {
          name: form.name, address: form.address, type: form.type,
          units: parseInt(form.units) || 1,
          purchasePrice: parseFloat(form.purchasePrice) || 0,
          currentValue: val,
          valueUpdatedAt: valChanged ? today : (prev?.valueUpdatedAt || today),
          loanAmount: loanAmt, loanRate, loanTermYears: loanTerm, loanStartDate: loanStart,
          closingCosts: cc, landValue: land,
          monthlyRent: rent, monthlyExpenses: exp,
          purchaseDate: form.purchaseDate || null, status: form.status,
          photo: form.photo ?? prev?.photo,
          image: propInitials(form.name),
        };
        const saved = await dbUpdateProperty(editId, updates);
        if (idx !== -1) PROPERTIES[idx] = { ...prev, ...saved, color: prev.color };
      } else {
        const usedColors = PROPERTIES.map(p => p.color);
        const color = PROP_COLORS.find(c => !usedColors.includes(c)) || PROP_COLORS[PROPERTIES.length % PROP_COLORS.length];
        const land = parseFloat(form.landValue) || null;
        const saved = await createProperty({
          name: form.name, address: form.address, type: form.type,
          units: parseInt(form.units) || 1,
          purchasePrice: parseFloat(form.purchasePrice) || 0,
          currentValue: val, valueUpdatedAt: today,
          loanAmount: loanAmt, loanRate, loanTermYears: loanTerm, loanStartDate: loanStart,
          closingCosts: cc, landValue: land,
          monthlyRent: rent, monthlyExpenses: exp,
          purchaseDate: form.purchaseDate || null, status: form.status,
          image: propInitials(form.name),
          photo: form.photo || null,
        });
        PROPERTIES.push({ ...saved, color });
      }
      const wasEdit = editId !== null;
      setForm(emptyP);
      setShowModal(false);
      rerender();
      showToast(wasEdit ? "Property updated" : "Property added to portfolio");
    } catch (e) {
      console.error("[PropBooks] Save property failed:", e);
      showToast("Couldn't save property — " + (e.message || "unknown error"));
    }
  };

  const handleDeleteProp = async () => {
    if (!deleteConfirm) return;
    try {
      await dbDeleteProperty(deleteConfirm.id);
      const idx = PROPERTIES.findIndex(p => p.id === deleteConfirm.id);
      if (idx !== -1) PROPERTIES.splice(idx, 1);
      setDeleteConfirm(null);
      rerender();
    } catch (e) {
      console.error("[PropBooks] Delete property failed:", e);
      showToast("Couldn't delete property — " + (e.message || "unknown error"));
    }
  };

  const filtered = PROPERTIES.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.type.toLowerCase().includes(search.toLowerCase()));

  // Fire onComplete whenever showModal transitions from open to closed.
  // We can't gate on isModalOnly because the auto-open useEffect clears
  // editPropertyId via onClearEditId before showModal becomes true, so
  // (isModalOnly && showModal) is never simultaneously true.
  useEffect(() => {
    if (wasModalOnlyOpen.current && !showModal) {
      wasModalOnlyOpen.current = false;
      onComplete && onComplete();
    } else if (showModal) {
      wasModalOnlyOpen.current = true;
    }
  }, [showModal, onComplete]);

  // The legacy list view is gone — AssetList is the canonical entry. This
  // component is now purely a modal-host overlay that renders nothing unless
  // an edit or convert trigger is active.
  if (!isModalOnly && !showModal) return null;

  return (
    <div>
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
                {PROPERTY_TYPES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Status</label>
              <select value={form.status} onChange={sf("status")} style={iS}>
                {PROPERTY_STATUSES.map(o => <option key={o}>{o}</option>)}
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

