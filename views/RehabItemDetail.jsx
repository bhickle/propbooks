// =============================================================================
// RehabItemDetail — drill-down for a single rehab line item on a deal.
// Manages assigned contractors, photos, linked expenses, and scope notes.
// =============================================================================
import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X, CheckCircle, Wrench, Truck,
} from "lucide-react";
import {
  fmt, DEALS, DEAL_NOTES, DEAL_EXPENSES, CONTRACTORS, CONTRACTOR_BIDS,
  REHAB_CATEGORIES, REHAB_CATEGORY_GROUPS, getCanonicalByLabel,
} from "../api.js";
import { InfoTip, sectionS as sharedSectionS, cardS as sharedCardS } from "../shared.jsx";
import { useToast } from "../toast.jsx";
import { createDealNote as dbCreateDealNote, deleteNote as dbDeleteNote } from "../db/notes.js";

export function RehabItemDetail({ deal, itemIdx, onBack, backLabel, onNavigateToContractor, onNavigateToExpense }) {
  const { showToast } = useToast();
  const [version, setVersion] = useState(0);
  const bump = () => setVersion(v => v + 1);
  const item = deal.rehabItems && deal.rehabItems[itemIdx];
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ category: "", canonicalCategory: null, budgeted: "", spent: "", status: "pending" });
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState(null);

  const allCategories = useMemo(() => {
    const custom = new Set(DEALS.flatMap(f => (f.rehabItems || []).map(i => i.category)).filter(Boolean));
    REHAB_CATEGORIES.forEach(c => custom.delete(c.label));
    return { canonical: REHAB_CATEGORIES, custom: [...custom].sort() };
  }, []);
  const [catFocus, setCatFocus] = useState(false);

  if (!item) {
    return (
      <div>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}><ChevronLeft size={16} /> {backLabel || "Back"}</button>
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Rehab item not found.</div>
      </div>
    );
  }

  const remaining = (item.budgeted || 0) - (item.spent || 0);
  const over = remaining < 0;
  const statusBg = { "complete": "var(--success-badge)", "in-progress": "var(--warning-bg)", "pending": "var(--hover-surface)" };
  const statusColors = { "complete": "#1a7a4a", "in-progress": "#9a3412", "pending": "#64748b" };
  const statusLabel = { "complete": "Complete", "in-progress": "In Progress", "pending": "Pending" };

  const assigned = item.contractors || [];
  const assignedIds = assigned.map(c => c.id);
  const dealContractors = CONTRACTORS.filter(c => (c.dealIds || []).includes(deal.id));
  const unassigned = dealContractors.filter(c => !assignedIds.includes(c.id));
  // Look up each contractor's bid for this scope from the shared bids store
  const getBidFor = (conId) => CONTRACTOR_BIDS.find(b => b.contractorId === conId && b.dealId === deal.id && b.rehabItem === item.category);

  // Linked expenses: match by explicit rehabItemIdx, canonical slug, OR raw category label
  const linkedExpenses = DEAL_EXPENSES
    .filter(e => e.dealId === deal.id && (
      e.rehabItemIdx === itemIdx ||
      (item.canonicalCategory && e.canonicalCategory === item.canonicalCategory) ||
      e.category === item.category
    ))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const linkedTotal = linkedExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Notes live in the global DEAL_NOTES store, scoped by rehabItemIdx
  const notes = DEAL_NOTES
    .filter(n => n.dealId === deal.id && n.rehabItemIdx === itemIdx)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const openEdit = () => {
    setEditForm({
      category: item.category || "",
      canonicalCategory: item.canonicalCategory || getCanonicalByLabel(item.category)?.slug || null,
      budgeted: String(item.budgeted || ""),
      spent: String(item.spent || ""),
      status: item.status || "pending",
    });
    setShowEdit(true);
  };
  const saveEdit = () => {
    if (!editForm.category) return;
    const canon = editForm.canonicalCategory || getCanonicalByLabel(editForm.category)?.slug || null;
    deal.rehabItems[itemIdx] = {
      ...item,
      category: editForm.category,
      canonicalCategory: canon,
      budgeted: parseFloat(editForm.budgeted) || 0,
      spent: parseFloat(editForm.spent) || 0,
      status: editForm.status,
    };
    setShowEdit(false);
    bump();
    showToast("Rehab item updated");
  };

  const addContractor = (conId) => {
    const cons = item.contractors || [];
    if (cons.some(c => c.id === conId)) return;
    deal.rehabItems[itemIdx] = { ...item, contractors: [...cons, { id: conId, bid: 0 }] };
    bump();
  };
  const removeContractor = (conId) => {
    deal.rehabItems[itemIdx] = { ...item, contractors: (item.contractors || []).filter(c => c.id !== conId) };
    bump();
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      const saved = await dbCreateDealNote({
        dealId: deal.id,
        rehabItemIdx: itemIdx,
        date: new Date().toISOString().split("T")[0],
        text: noteText.trim(),
        mentions: [],
      });
      DEAL_NOTES.unshift(saved);
      setNoteText("");
      setShowAddNote(false);
      bump();
      showToast("Note added");
    } catch (e) {
      console.error("[PropBooks] Add rehab note failed:", e);
      showToast("Couldn't add note — " + (e.message || "unknown error"));
    }
  };
  const deleteNote = async (id) => {
    try {
      await dbDeleteNote(id);
      const gi = DEAL_NOTES.findIndex(n => n.id === id);
      if (gi !== -1) DEAL_NOTES.splice(gi, 1);
      setDeletingNoteId(null);
      bump();
      showToast("Note deleted");
    } catch (e) {
      console.error("[PropBooks] Delete rehab note failed:", e);
      showToast("Couldn't delete note — " + (e.message || "unknown error"));
    }
  };

  const addPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      deal.rehabItems[itemIdx] = { ...item, photos: [...(item.photos || []), ev.target.result] };
      bump();
      showToast("Photo added");
    };
    reader.readAsDataURL(file);
  };
  const removePhoto = (pIdx) => {
    deal.rehabItems[itemIdx] = { ...item, photos: (item.photos || []).filter((_, i) => i !== pIdx) };
    bump();
  };

  const sectionS = { ...sharedSectionS, marginBottom: 16 };
  const cardS = sharedCardS;
  const iS = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none", fontFamily: "inherit" };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}><ChevronLeft size={16} /> {backLabel || "Back"}</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{item.category}</h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>{deal.name} · Rehab scope</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ background: statusBg[item.status], color: statusColors[item.status], borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>{statusLabel[item.status] || item.status}</span>
          <button onClick={openEdit} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Pencil size={14} /> Edit</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <div style={cardS}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Budget</p>
            <InfoTip text="The amount budgeted for this rehab scope. Edit via the Edit button." />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{fmt(item.budgeted || 0)}</p>
        </div>
        <div style={cardS}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Spent</p>
            <InfoTip text="Total spent on this scope. Updated manually or from linked expenses." />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{fmt(item.spent || 0)}</p>
        </div>
        <div style={cardS}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{over ? "Over Budget" : "Remaining"}</p>
            <InfoTip text="Budget minus Spent. Negative means over budget." />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: over ? "var(--c-red)" : "var(--c-green)", fontFamily: "var(--font-display)" }}>{over ? `-${fmt(Math.abs(remaining))}` : fmt(remaining)}</p>
        </div>
        <div style={cardS}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contractors</p>
            <InfoTip text="Number of contractors assigned to this scope." />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{assigned.length}</p>
        </div>
      </div>

      {/* Contractors section */}
      <div style={sectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Assigned Contractors</h3>
          {unassigned.length > 0 && (
            <select value="" onChange={e => { if (e.target.value) { addContractor(e.target.value); e.target.value = ""; } }}
              style={{ border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--text-secondary)", background: "var(--surface-alt)", cursor: "pointer", outline: "none" }}>
              <option value="">+ Assign contractor</option>
              {unassigned.map(c => <option key={c.id} value={c.id}>{c.name} ({c.trade})</option>)}
            </select>
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Contractors working on this scope and their bid amounts</p>
        {assigned.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--surface-alt)", borderRadius: 12 }}>
            {dealContractors.length === 0 ? "No contractors on this deal yet. Add contractors from the deal's Contractors tab." : "No contractors assigned to this scope yet."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {assigned.map(asgn => {
              const con = CONTRACTORS.find(c => c.id === asgn.id);
              if (!con) return null;
              const bid = getBidFor(con.id);
              const statusBidBg = bid?.status === "accepted" ? "var(--success-badge)" : "var(--warning-bg)";
              const statusBidColor = bid?.status === "accepted" ? "#1a7a4a" : "#9a3412";
              return (
                <div key={asgn.id} onClick={() => onNavigateToContractor && onNavigateToContractor(con, "bids")}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "var(--surface-alt)", borderRadius: 12, border: "1px solid var(--border-subtle)", cursor: onNavigateToContractor ? "pointer" : "default", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface-muted)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--surface-alt)"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #e95e00, #041830)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Truck size={16} color="#fff" />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{con.name}</p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{con.trade}{con.phone ? ` · ${con.phone}` : ""}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>Bid</p>
                      {bid ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(bid.amount)}</span>
                          <span style={{ background: statusBidBg, color: statusBidColor, borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 600, textTransform: "capitalize" }}>{bid.status}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No bid yet</span>
                      )}
                    </div>
                    <ChevronRight size={16} color="#cbd5e1" />
                    <button onClick={(e) => { e.stopPropagation(); removeContractor(asgn.id); }} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Remove from scope"><X size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Photos section */}
      <div style={sectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Photos</h3>
          <label style={{ background: "var(--surface-muted)", color: "var(--text-label)", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Add Photo
            <input type="file" accept="image/*" onChange={addPhoto} style={{ display: "none" }} />
          </label>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Before, during, and after shots for this scope</p>
        {(item.photos || []).length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--surface-alt)", borderRadius: 12 }}>No photos yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {(item.photos || []).map((p, pi) => (
              <div key={pi} style={{ position: "relative", aspectRatio: "1", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                <img src={p} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => removePhoto(pi)} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Expenses */}
      <div style={sectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Linked Expenses</h3>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fmt(linkedTotal)} total</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Deal expenses tagged to this rehab scope or matching category</p>
        {linkedExpenses.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--surface-alt)", borderRadius: 12 }}>No expenses linked to this scope yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {linkedExpenses.map(exp => (
              <div key={exp.id} onClick={() => onNavigateToExpense && onNavigateToExpense(exp.id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border-subtle)", cursor: onNavigateToExpense ? "pointer" : "default" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{exp.description || exp.vendor}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{exp.date} · {exp.vendor} · {exp.category}</p>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#c0392b" }}>{fmt(exp.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div style={sectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Notes</h3>
          <button onClick={() => setShowAddNote(true)} style={{ background: "var(--surface-muted)", color: "var(--text-label)", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Add Note
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Scope-specific notes like change orders, delays, or permit status</p>
        {showAddNote && (
          <div style={{ marginBottom: 16, padding: 14, background: "var(--surface-alt)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Type your note..."
              style={{ ...iS, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={addNote} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Save Note</button>
              <button onClick={() => { setShowAddNote(false); setNoteText(""); }} style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
        {notes.length === 0 && !showAddNote ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--surface-alt)", borderRadius: 12 }}>No notes yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.map(n => (
              <div key={n.id} style={{ padding: 14, background: "var(--surface-alt)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>{n.date}</p>
                    <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.text}</p>
                  </div>
                  <button onClick={() => setDeletingNoteId(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex", alignItems: "center" }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 28, width: 480, boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>Edit Rehab Item</h2>
              <button onClick={() => setShowEdit(false)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color="var(--text-secondary)" /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ position: "relative" }}>
                <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Category *</label>
                <input value={editForm.category} onChange={e => { setEditForm(f => ({ ...f, category: e.target.value, canonicalCategory: null })); setCatFocus(true); }}
                  onFocus={() => setCatFocus(true)} onBlur={() => setTimeout(() => setCatFocus(false), 150)} style={iS} />
                {editForm.canonicalCategory && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, fontWeight: 600, color: "#1a7a4a" }}><CheckCircle size={11} /> Standard category</span>
                )}
                {catFocus && (() => {
                  const q = editForm.category.toLowerCase().trim();
                  const canonMatches = REHAB_CATEGORIES.filter(c => !q || c.label.toLowerCase().includes(q));
                  const customMatches = allCategories.custom.filter(c => !q || c.toLowerCase().includes(q));
                  const exactCanon = REHAB_CATEGORIES.some(c => c.label.toLowerCase() === q);
                  const exactCustom = allCategories.custom.some(c => c.toLowerCase() === q);
                  const showNew = q && !exactCanon && !exactCustom;
                  const grouped = {};
                  canonMatches.forEach(c => { if (!grouped[c.group]) grouped[c.group] = []; grouped[c.group].push(c); });
                  const groupKeys = REHAB_CATEGORY_GROUPS.filter(g => grouped[g] && grouped[g].length > 0);
                  if (groupKeys.length === 0 && customMatches.length === 0 && !showNew) return null;
                  return (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
                      {groupKeys.map(g => (
                        <div key={g}>
                          <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" }}>{g}</div>
                          {grouped[g].map(c => (
                            <button key={c.slug} onMouseDown={() => { setEditForm(f => ({ ...f, category: c.label, canonicalCategory: c.slug })); setCatFocus(false); }}
                              style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid #f8fafc", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                              <Wrench size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                              <span>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                      {customMatches.length > 0 && (
                        <div>
                          <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" }}>Your Custom</div>
                          {customMatches.slice(0, 6).map(c => (
                            <button key={c} onMouseDown={() => { setEditForm(f => ({ ...f, category: c, canonicalCategory: null })); setCatFocus(false); }}
                              style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid #f8fafc", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                              <Wrench size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                              <span>{c}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Budget *</label>
                  <input value={editForm.budgeted} onChange={e => setEditForm(f => ({ ...f, budgeted: e.target.value }))} type="number" style={iS} />
                </div>
                <div>
                  <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Spent</label>
                  <input value={editForm.spent} onChange={e => setEditForm(f => ({ ...f, spent: e.target.value }))} type="number" style={iS} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={iS}>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowEdit(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveEdit} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete note confirm */}
      {deletingNoteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 28, width: 400, boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Delete note?</h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeletingNoteId(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteNote(deletingNoteId)} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
