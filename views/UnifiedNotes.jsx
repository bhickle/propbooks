// =============================================================================
// UnifiedNotes — single hub combining rental notes, deal notes, and general
// notes. Filters by entity (property/deal) and free-text search; supports
// @-mentions for team members via MentionTextarea.
// =============================================================================
import { useState, useEffect } from "react";
import { Plus, X, Search, MessageSquare, Pencil, Trash2, Wrench, ArrowLeft } from "lucide-react";
import {
  DEALS, RENTAL_NOTES, DEAL_NOTES, GENERAL_NOTES, TEAM_MEMBERS,
} from "../api.js";
import { PROPERTIES, TENANTS } from "../mockData.js";
import {
  createRentalNote, createDealNote, createGeneralNote,
  updateNote as dbUpdateNote, deleteNote as dbDeleteNote,
} from "../db/notes.js";
import { iS } from "../shared.jsx";
import { MentionTextarea, NoteTextWithMentions } from "./MentionTextarea.jsx";

export function UnifiedNotes({ highlightNoteId, highlightDealNoteId, onBack, onClearHighlight, autoOpenAdd }) {
  const [activeTab, setActiveTab] = useState("all");
  const [propFilter, setPropFilter] = useState("all");
  const [flipFilter, setFlipFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [renderKey, rerender] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [flashId, setFlashId] = useState(highlightNoteId || highlightDealNoteId);
  const [noteForm, setNoteForm] = useState({ category: "general", entityId: "", tenantId: "", text: "", mentions: [] });

  // Auto-open add modal when navigating from quick action
  useEffect(() => {
    if (autoOpenAdd) {
      setEditId(null);
      setNoteForm({ category: "general", entityId: "", tenantId: "", text: "", mentions: [] });
      setShowAdd(true);
    }
  }, [autoOpenAdd]);

  // Flash highlight on mount
  useEffect(() => {
    const hId = highlightNoteId || highlightDealNoteId;
    if (hId) {
      setFlashId(hId);
      if (highlightNoteId) setActiveTab("properties");
      if (highlightDealNoteId) setActiveTab("deals");
      setTimeout(() => {
        const el = document.getElementById("unote-" + hId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      const timer = setTimeout(() => { setFlashId(null); onClearHighlight && onClearHighlight(); }, 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightNoteId, highlightDealNoteId]); // eslint-disable-line react-hooks/exhaustive-deps -- onClearHighlight is an inline parent callback (new ref every render)

  // Build unified list
  const allNotes = (() => {
    const list = [];
    RENTAL_NOTES.forEach(n => {
      const prop = PROPERTIES.find(p => p.id === n.propertyId);
      if (prop) {
        const ten = n.tenantId ? TENANTS.find(t => t.id === n.tenantId) : null;
        list.push({ ...n, noteType: "property", entityId: n.propertyId, entityName: prop.name, entityColor: prop.color, entityImage: prop.image, tenantName: ten?.name || null, mentions: n.mentions || [] });
      }
    });
    DEAL_NOTES.forEach(n => {
      const deal = DEALS.find(f => f.id === n.dealId);
      if (deal) {
        const rehabCat = (typeof n.rehabItemIdx === "number" && deal.rehabItems && deal.rehabItems[n.rehabItemIdx])
          ? deal.rehabItems[n.rehabItemIdx].category
          : null;
        list.push({ ...n, noteType: "deal", entityId: n.dealId, entityName: deal.name, entityColor: deal.color, entityImage: deal.image, rehabScope: rehabCat, mentions: n.mentions || [] });
      }
    });
    GENERAL_NOTES.forEach(n => {
      list.push({ ...n, noteType: "general", entityId: null, entityName: "General", entityColor: "var(--c-purple)", entityImage: null, mentions: n.mentions || [] });
    });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  })();

  // Filter
  const filtered = allNotes.filter(n => {
    if (activeTab === "properties" && n.noteType !== "property") return false;
    if (activeTab === "deals" && n.noteType !== "deal") return false;
    if (activeTab === "general" && n.noteType !== "general") return false;
    if (activeTab === "properties" && propFilter !== "all" && n.entityId !== propFilter) return false;
    if (activeTab === "deals" && flipFilter !== "all" && n.entityId !== flipFilter) return false;
    if (search && !n.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const clearFilters = () => { setPropFilter("all"); setFlipFilter("all"); setSearch(""); };
  const hasFilters = propFilter !== "all" || flipFilter !== "all" || search;

  // Tab counts
  const propCount = allNotes.filter(n => n.noteType === "property").length;
  const dealCount = allNotes.filter(n => n.noteType === "deal").length;
  const genCount = allNotes.filter(n => n.noteType === "general").length;

  const tabs = [
    { id: "all", label: "All", count: allNotes.length },
    { id: "properties", label: "Properties", count: propCount },
    { id: "deals", label: "Deals", count: dealCount },
    { id: "general", label: "General", count: genCount },
  ];

  // Type badge color
  const typeBadge = (type) => {
    if (type === "property") return { bg: "var(--info-tint)", color: "#2563eb", label: "Property" };
    if (type === "deal") return { bg: "var(--warning-btn-bg)", color: "#c2410c", label: "Deal" };
    return { bg: "var(--purple-tint)", color: "#7c3aed", label: "General" };
  };

  // Save
  const handleSave = async () => {
    if (!noteForm.text.trim()) return;
    const today = new Date().toISOString().split("T")[0];

    try {
      if (editId !== null) {
        const saved = await dbUpdateNote(editId, { text: noteForm.text.trim(), mentions: noteForm.mentions });
        const targets = [RENTAL_NOTES, DEAL_NOTES, GENERAL_NOTES];
        for (const arr of targets) {
          const idx = arr.findIndex(n => n.id === editId);
          if (idx !== -1) { arr[idx] = { ...arr[idx], ...saved }; break; }
        }
      } else {
        const payload = { date: today, text: noteForm.text.trim(), mentions: noteForm.mentions };
        if (noteForm.category === "property") {
          if (!noteForm.entityId) return;
          const saved = await createRentalNote({ ...payload, propertyId: noteForm.entityId, tenantId: noteForm.tenantId || null });
          RENTAL_NOTES.unshift(saved);
        } else if (noteForm.category === "deal") {
          if (!noteForm.entityId) return;
          const saved = await createDealNote({ ...payload, dealId: noteForm.entityId });
          DEAL_NOTES.unshift(saved);
        } else {
          const saved = await createGeneralNote(payload);
          GENERAL_NOTES.unshift(saved);
        }
      }
      setNoteForm({ category: "general", entityId: "", tenantId: "", text: "", mentions: [] });
      setEditId(null);
      setShowAdd(false);
      rerender(n => n + 1);
    } catch (e) {
      console.error("[PropBooks] Save note failed:", e);
    }
  };

  const handleDelete = async (note) => {
    try {
      await dbDeleteNote(note.id);
      const targets = note.noteType === "property" ? [RENTAL_NOTES]
        : note.noteType === "deal" ? [DEAL_NOTES]
        : [GENERAL_NOTES];
      for (const arr of targets) {
        const idx = arr.findIndex(n => n.id === note.id);
        if (idx !== -1) arr.splice(idx, 1);
      }
      setDeleteConfirm(null);
      rerender(n => n + 1);
    } catch (e) {
      console.error("[PropBooks] Delete note failed:", e);
    }
  };

  const openEdit = (note) => {
    setEditId(note.id);
    const cat = note.noteType === "property" ? "property" : note.noteType === "deal" ? "deal" : "general";
    setNoteForm({ category: cat, entityId: note.entityId ? String(note.entityId) : "", tenantId: note.tenantId ? String(note.tenantId) : "", text: note.text, mentions: note.mentions || [] });
    setShowAdd(true);
  };

  const openAdd = () => {
    const cat = activeTab === "properties" ? "property" : activeTab === "deals" ? "deal" : activeTab === "general" ? "general" : "general";
    const defaultEntity = cat === "property" ? (PROPERTIES[0] ? String(PROPERTIES[0].id) : "") : cat === "deal" ? (DEALS[0] ? String(DEALS[0].id) : "") : "";
    setEditId(null);
    setNoteForm({ category: cat, entityId: defaultEntity, tenantId: "", text: "", mentions: [] });
    setShowAdd(true);
  };

  // Group by date
  const grouped = {};
  filtered.forEach(n => {
    const label = new Date(n.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (!grouped[n.date]) grouped[n.date] = { label, notes: [] };
    grouped[n.date].notes.push(n);
  });

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-blue)", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 14 }}>
          <ArrowLeft size={15} /> Back to Dashboard
        </button>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Notes</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>{allNotes.length} note{allNotes.length !== 1 ? "s" : ""} across properties, deals, and general</p>
        </div>
        <button onClick={openAdd} style={{ background: "var(--c-blue)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Add Note
        </button>
      </div>

      {/* Tab pills */}
      <div style={{ display: "flex", gap: 6, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", marginBottom: 16, width: "fit-content" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setPropFilter("all"); setFlipFilter("all"); }}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: activeTab === t.id ? "#e95e00" : "transparent", color: activeTab === t.id ? "#fff" : "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
            {t.label}
            <span style={{ background: activeTab === t.id ? "rgba(255,255,255,0.3)" : "var(--surface-muted)", color: activeTab === t.id ? "#fff" : "var(--text-muted)", fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 6, minWidth: 18, textAlign: "center" }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: hasFilters ? 10 : 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..."
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" }} />
        </div>
        {activeTab === "properties" && (
          <select value={propFilter} onChange={e => setPropFilter(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Properties</option>
            {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {activeTab === "deals" && (
          <select value={flipFilter} onChange={e => setFlipFilter(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Deals</option>
            {DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
        {hasFilters && (
          <button onClick={clearFilters} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}><X size={11} /> Clear filters</button>
        )}
      </div>

      {/* Notes grouped by date */}
      {Object.keys(grouped).length === 0 ? (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 48, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", textAlign: "center", color: "var(--text-muted)" }}>
          <MessageSquare size={32} style={{ margin: "0 auto 12px", display: "block" }} />
          {hasFilters ? (
            <>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No notes match your filters</p>
              <button onClick={clearFilters} style={{ background: "none", border: "none", color: "var(--c-blue)", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No notes yet</p>
              <p style={{ fontSize: 13 }}>Click "Add Note" to start documenting.</p>
            </>
          )}
        </div>
      ) : Object.entries(grouped).map(([dateKey, { label, notes }]) => (
        <div key={dateKey} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>{label}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.map(n => {
              const badge = typeBadge(n.noteType);
              return (
                <div key={n.id} id={"unote-" + n.id}
                  onMouseEnter={e => { if (flashId !== n.id) e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={e => { if (flashId !== n.id) e.currentTarget.style.background = "var(--surface)"; }}
                  style={{ background: flashId === n.id ? "var(--purple-tint)" : "var(--surface)", borderRadius: 16, padding: 18, boxShadow: flashId === n.id ? "0 0 0 2px #8b5cf6" : "0 1px 3px rgba(0,0,0,0.06)", border: flashId === n.id ? "1px solid #8b5cf6" : "1px solid var(--border-subtle)", transition: "all 0.4s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {n.entityImage ? (
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{n.entityImage}</div>
                      ) : (
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: n.entityColor + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <MessageSquare size={12} color={n.entityColor} />
                        </div>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{n.entityName}</span>
                      {n.tenantName && (
                        <span style={{ fontSize: 10, fontWeight: 600, background: "var(--info-tint)", color: "var(--c-blue)", padding: "2px 7px", borderRadius: 5 }}>{n.tenantName}</span>
                      )}
                      {n.rehabScope && (
                        <span style={{ fontSize: 10, fontWeight: 600, background: "var(--warning-btn-bg)", color: "#c2410c", padding: "2px 7px", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <Wrench size={9} /> {n.rehabScope}
                        </span>
                      )}
                      {activeTab === "all" && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color, padding: "2px 7px", borderRadius: 5 }}>{badge.label}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openEdit(n)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={12} /></button>
                      <button onClick={() => setDeleteConfirm(n)} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <NoteTextWithMentions text={n.text} />
                  {/* Mention chips */}
                  {n.mentions && n.mentions.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                      {n.mentions.map(mId => {
                        const member = TEAM_MEMBERS.find(m => m.id === mId);
                        if (!member) return null;
                        return (
                          <span key={mId} style={{ display: "inline-flex", alignItems: "center", gap: 3, background: member.color + "12", color: member.color, fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 5 }}>
                            @{member.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add/Edit Note Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>{editId ? "Edit Note" : "Add Note"}</h2>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Category selector */}
              {!editId && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Category *</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[{ id: "general", label: "General", color: "var(--c-purple)" }, { id: "property", label: "Property", color: "var(--c-blue)" }, { id: "deal", label: "Deal", color: "#e95e00" }].map(c => (
                      <button key={c.id} onClick={() => setNoteForm(f => ({ ...f, category: c.id, entityId: c.id === "property" ? (PROPERTIES[0] ? String(PROPERTIES[0].id) : "") : c.id === "deal" ? (DEALS[0] ? String(DEALS[0].id) : "") : "" }))}
                        style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: noteForm.category === c.id ? "2px solid " + c.color : "1.5px solid var(--border)", background: noteForm.category === c.id ? c.color + "10" : "#fff", color: noteForm.category === c.id ? c.color : "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Entity selector (property/deal) */}
              {noteForm.category === "property" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Property *</p>
                    <select style={iS} value={noteForm.entityId} onChange={e => setNoteForm(f => ({ ...f, entityId: e.target.value, tenantId: "" }))} disabled={!!editId}>
                      <option value="">Select property...</option>
                      {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Tenant <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></p>
                    <select style={iS} value={noteForm.tenantId} onChange={e => setNoteForm(f => ({ ...f, tenantId: e.target.value }))} disabled={!noteForm.entityId}>
                      <option value="">No tenant</option>
                      {noteForm.entityId && TENANTS.filter(t => t.propertyId === noteForm.entityId && t.status !== "past" && t.status !== "vacant").map(t => <option key={t.id} value={t.id}>{t.name} — {t.unit}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {noteForm.category === "deal" && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Deal *</p>
                  <select style={iS} value={noteForm.entityId} onChange={e => setNoteForm(f => ({ ...f, entityId: e.target.value }))} disabled={!!editId}>
                    <option value="">Select deal...</option>
                    {DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}
              {/* Note text with @mention */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Note *</p>
                <MentionTextarea
                  value={noteForm.text}
                  onChange={(text) => setNoteForm(f => ({ ...f, text }))}
                  mentions={noteForm.mentions}
                  onMentionsChange={(mentions) => setNoteForm(f => ({ ...f, mentions }))}
                  placeholder="Write a note... Type @ to mention a team member"
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "var(--c-blue)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: (!noteForm.text.trim() || (noteForm.category !== "general" && !noteForm.entityId)) ? 0.5 : 1 }}>{editId ? "Save Changes" : "Add Note"}</button>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, width: 480, padding: 28 }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Delete Note</h2>
            <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this note?</p>
            <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 13, color: "var(--text-label)", lineHeight: 1.5 }}>{deleteConfirm.text.substring(0, 120)}{deleteConfirm.text.length > 120 ? "..." : ""}</p>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
