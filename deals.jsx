// =============================================================================
// PropBooks – Deal Modules — updated 2026-04-06
// DealDashboard | RehabTracker | DealExpenses | DealContractors | DealAnalytics
// =============================================================================

import { useState, useMemo, useEffect, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine,
} from "recharts";
import {
  Hammer, DollarSign, TrendingUp, Star, Plus, Search, Filter,
  CheckCircle, Clock, AlertCircle, ChevronRight, X, Trash2, Pencil,
  Wrench, Users, Receipt, BarChart3, Target, Calendar, Flag,
  Truck, Building2, MapPin, Home,
  MessageSquare, FileText, Circle, Phone, Mail, Shield, Upload,
  ChevronLeft, Eye, FileCheck, Award, Paperclip, ScanLine, UploadCloud,
  FileImage, FilePlus, Loader, User, UserCheck, Tag, Layers,
} from "lucide-react";
import {
  fmt, fmtK, newId, STAGE_ORDER, STAGE_COLORS, DEFAULT_MILESTONES,
  DEAL_EXPENSE_RECEIPTS, addDealExpenseReceipt, deleteDealExpenseReceipt,
  DEAL_DOCUMENTS, addDealDocument, deleteDealDocument,
  mockOcrScan,
  REHAB_CATEGORIES, REHAB_CATEGORY_GROUPS, getCanonicalBySlug, getCanonicalByLabel,
} from "./api.js";

// Shared mock data refs (passed as props or imported directly)
// Using module-level state so all modules stay in sync within a session
import { DEALS as _DEALS, DEAL_EXPENSES as _FE, CONTRACTORS as _CON, DEAL_MILESTONES, DEAL_NOTES, CONTRACTOR_BIDS as _BIDS, CONTRACTOR_PAYMENTS as _PAYMENTS, CONTRACTOR_DOCUMENTS as _DOCS } from "./api.js";
import { InfoTip, Modal, StatCard, colorWithAlpha, sectionS as sharedSectionS, cardS as sharedCardS } from "./shared.jsx";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const iS = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" };

// ── Attachment components (mirrors App.jsx versions) ──
function DealAttachmentZone({ onFiles, accept = "image/*,.pdf", label = "Drop file here or click to browse", compact = false }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const handleDrop = e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); };
  const handleChange = e => { if (e.target.files.length) { onFiles([...e.target.files]); e.target.value = ""; } };
  return (
    <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{ border: `2px dashed ${dragOver ? "var(--c-blue)" : "var(--border)"}`, borderRadius: 12, padding: compact ? "12px 16px" : "20px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "#eff6ff" : "var(--surface-alt)", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <input ref={inputRef} type="file" accept={accept} multiple onChange={handleChange} style={{ display: "none" }} />
      <UploadCloud size={compact ? 16 : 20} color="var(--text-muted)" />
      <span style={{ fontSize: compact ? 12 : 13, color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}

function DealAttachmentList({ items, onRemove, compact = false }) {
  if (!items || items.length === 0) return null;
  const iconForType = mime => { if (!mime) return FileText; if (mime.startsWith("image/")) return FileImage; return FileText; };
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
            {item.ocrData && <span style={{ fontSize: 10, fontWeight: 600, color: "#1a7a4a", background: "#cce8d8", borderRadius: 6, padding: "2px 6px", flexShrink: 0 }}>OCR</span>}
            {onRemove && (
              <button onClick={e => { e.stopPropagation(); onRemove(item.id); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", color: "var(--text-muted)" }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--c-red)"} onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DealOcrPrompt({ attachment, onResult, onDismiss }) {
  const [scanning, setScanning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || attachment.ocrData) return null;
  const isImage = attachment.mimeType?.startsWith("image/");
  const isPdf = attachment.mimeType?.includes("pdf");
  if (!isImage && !isPdf) return null;
  const runOcr = async () => {
    setScanning(true);
    try { const ocrData = await mockOcrScan({ name: attachment.name, type: attachment.mimeType }); if (onResult) onResult(ocrData, attachment); } catch (err) { console.error("OCR failed:", err); } finally { setScanning(false); }
  };
  if (scanning) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fff7ed", borderRadius: 10, border: "1px solid #fdba74", marginTop: 6 }}>
        <Loader size={14} color="#e95e00" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 12, color: "#9a3412", fontWeight: 600 }}>Reading receipt...</span>
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

function StageDot({ stage }) {
  const c = STAGE_COLORS[stage] || STAGE_COLORS["Active Rehab"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.text, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
      {stage}
    </span>
  );
}

// colorWithAlpha moved to shared.jsx

// StatCard moved to shared.jsx

function PageHeader({ title, sub, action, filter }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <div>
        <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{title}</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>{sub}</p>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {filter}
      </div>
    </div>
  );
}

// InfoTip moved to shared.jsx

const sectionS = { ...sharedSectionS, marginBottom: 24 };

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 1. DEAL DASHBOARD
// ---------------------------------------------------------------------------
export function DealDashboard({ onSelect, onNavigateToNote, onNavigateToExpense, onNavigateToMilestone }) {
  const [filterStage, setFilterStage] = useState("all");

  const allDeals = _DEALS;
  const deals = allDeals.filter(f => {
    if (filterStage !== "all" && f.stage !== filterStage) return false;
    return true;
  });

  const active = deals.filter(f => f.stage !== "Sold");
  const sold   = deals.filter(f => f.stage === "Sold");

  const totalDeployed   = active.reduce((s, f) => s + f.purchasePrice + f.rehabSpent, 0);
  const totalRehabBudget = active.reduce((s, f) => s + f.rehabBudget, 0);
  const totalRehabSpent  = active.reduce((s, f) => s + f.rehabSpent, 0);
  const realizedProfit  = sold.reduce((s, f) => s + (f.netProfit || 0), 0);
  const projectedProfit = active.reduce((s, f) => {
    const cost = f.purchasePrice + f.rehabBudget + (f.holdingCostsPerMonth * ((f.daysOwned || 0) / 30));
    return s + (f.arv - cost - f.arv * ((f.sellingCostPct || 6) / 100));
  }, 0);

  const stageBreakdown = STAGE_ORDER.map(s => ({
    stage: s, count: deals.filter(f => f.stage === s).length,
    color: STAGE_COLORS[s]?.dot || "var(--text-muted)",
  }));

  // Derive recent activity from real data: milestones, expenses, notes
  const recentActivity = useMemo(() => {
    const items = [];
    const shortName = f => f.name.split(" ").slice(0, 2).join(" ");

    // Completed milestones → milestones tab
    allDeals.forEach(f => {
      const ms = DEAL_MILESTONES.filter(m => m.dealId === f.id);
      ms.forEach(m => {
        if (m.done && m.date) {
          const isSold = m.label.toLowerCase().includes("sold") || m.label.toLowerCase().includes("closed");
          items.push({
            dealId: f.id, deal: f, date: m.date, tab: "milestones",
            milestoneKey: f.id + "-" + m.label, milestoneDone: m.done,
            text: `${shortName(f)} – ${m.label}`,
            icon: isSold ? Star : m.label.toLowerCase().includes("inspect") ? Flag : CheckCircle,
            color: isSold ? "#6b7280" : "var(--c-green)",
          });
        }
      });
    });

    // Recent expenses → expenses tab
    allDeals.forEach(f => {
      const exps = _FE.filter(e => e.dealId === f.id).slice(-3);
      exps.forEach(e => {
        items.push({
          dealId: f.id, deal: f, date: e.date, tab: "expenses", expenseId: e.id,
          text: `${shortName(f)} – ${e.description || e.category}`,
          icon: Receipt, color: "var(--c-blue)",
        });
      });
    });

    // Recent notes → notes tab
    allDeals.forEach(f => {
      const notes = DEAL_NOTES.filter(n => n.dealId === f.id).slice(-2);
      notes.forEach(n => {
        items.push({
          dealId: f.id, deal: f, date: n.date, tab: "notes", noteId: n.id,
          text: `${shortName(f)} – ${n.text.length > 50 ? n.text.slice(0, 50) + "…" : n.text}`,
          icon: MessageSquare, color: "var(--c-purple)",
        });
      });
    });

    // Sort by date descending, take latest 6
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    return items.slice(0, 6).map(item => ({
      ...item,
      dateLabel: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  }, [allDeals]);

  const isFiltered = filterStage !== "all";

  return (
    <div>
      <PageHeader title="Overview" sub="All deals at a glance" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <StatCard icon={Hammer}     label="Active Deals"     value={active.length}              sub={isFiltered ? "Filtered" : "In pipeline"}        color="#e95e00" tip="Number of deals in active pipeline stages (not Sold)." />
        <StatCard icon={DollarSign} label="Capital Deployed" value={fmtK(totalDeployed)}        sub={isFiltered ? "Filtered" : "Purchase + rehab"}   color="var(--c-blue)" tip="Total Purchase Price + Rehab Budget across active deals." />
        <StatCard icon={TrendingUp} label="Projected Profit" value={fmtK(Math.round(projectedProfit))} sub={isFiltered ? "Filtered" : "Active deals"}  color="var(--c-green)" tip="ARV − Purchase − Rehab Budget − Estimated Holding & Selling Costs for all active deals." />
        <StatCard icon={Star}       label="Realized Profit"  value={fmt(realizedProfit)}        sub={isFiltered ? "Filtered" : "Closed deals YTD"}   color="var(--c-purple)" tip="Actual profit from closed/sold deals this year." />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {["all", ...STAGE_ORDER].map(s => {
            const active2 = filterStage === s;
            const label = s === "all" ? "All Stages" : s;
            const count = s === "all" ? allDeals.length : allDeals.filter(f => f.stage === s).length;
            return (
              <button key={s} onClick={() => setFilterStage(s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active2 ? "#e95e00" : "transparent", color: active2 ? "#fff" : "var(--text-secondary)", fontWeight: active2 ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {label} ({count})
              </button>
            );
          })}
        </div>
        {isFiltered && (
          <button onClick={() => setFilterStage("all")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filter
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Active Deals Table */}
        <div style={sharedSectionS}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Active Deals</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Deal", "Stage", "Days Owned", "Budget Left", "Proj. Profit"].map(h => (
                  <th key={h} style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", paddingBottom: 10, borderBottom: "1px solid var(--border-subtle)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map((f, i) => {
                const budgetLeft = f.rehabBudget - f.rehabSpent;
                const cost = f.purchasePrice + f.rehabBudget + (f.holdingCostsPerMonth * (f.daysOwned / 30));
                const proj = f.arv - cost - (f.arv * ((f.sellingCostPct || 6) / 100));
                return (
                  <tr key={f.id} style={{ borderBottom: i < active.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                    <td style={{ padding: "12px 0" }}>
                      <button onClick={() => onSelect && onSelect(f)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{f.image}</div>
                          <div>
                            <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{f.name}</p>
                            <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{f.address.split(",")[1]?.trim()}</p>
                          </div>
                        </div>
                      </button>
                    </td>
                    <td style={{ padding: "12px 0" }}><StageDot stage={f.stage} /></td>
                    <td style={{ padding: "12px 0", color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>{f.daysOwned}d</td>
                    <td style={{ padding: "12px 0" }}>
                      <span style={{ color: budgetLeft < 0 ? "var(--c-red)" : "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{fmt(budgetLeft)}</span>
                    </td>
                    <td style={{ padding: "12px 0" }}>
                      <span style={{ color: proj > 0 ? "var(--c-green)" : "var(--c-red)", fontSize: 13, fontWeight: 600 }}>{fmt(Math.round(proj))}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Stage Breakdown + Recent Activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={sharedSectionS}>
            <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>By Stage</h3>
            {stageBreakdown.map(s => (
              <div key={s.stage} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ color: "var(--text-dim)", fontSize: 13, flex: 1 }}>{s.stage}</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 13 }}>{s.count}</span>
              </div>
            ))}
          </div>

          <div style={{ ...sharedSectionS, flex: 1 }}>
            <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Recent Activity</h3>
            {recentActivity.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No activity yet. Complete milestones, log expenses, or add notes to see updates here.</p>
            )}
            {recentActivity.map((a, i) => (
              <div key={i} onClick={() => { if (a.tab === "notes" && a.noteId && onNavigateToNote) onNavigateToNote(a.noteId); else if (a.tab === "expenses" && a.expenseId && onNavigateToExpense) onNavigateToExpense(a.expenseId); else if (a.tab === "milestones" && a.milestoneKey && onNavigateToMilestone) onNavigateToMilestone(a.milestoneKey, a.milestoneDone); else if (onSelect) onSelect(a.deal, a.tab); }} style={{ display: "flex", gap: 10, marginBottom: 12, cursor: "pointer", padding: "6px 8px", marginLeft: -8, marginRight: -8, borderRadius: 10, transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(30,58,95,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <a.icon size={13} color="#475569" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "var(--text-dim)", fontSize: 12, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.text}</p>
                  <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>{a.dateLabel}</p>
                </div>
                <ChevronRight size={12} color="var(--border-strong)" style={{ flexShrink: 0, marginTop: 4 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rehab Budget Overview Bar */}
      <div style={sharedSectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Rehab Budget Overview</h3>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#1e3a5f", display: "inline-block" }} />Budgeted</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#e95e00", display: "inline-block" }} />Spent</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={active.map(f => ({ name: f.name, budget: f.rehabBudget, spent: f.rehabSpent }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
            <Tooltip formatter={v => fmt(v)} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
            <Bar dataKey="budget" fill="var(--chart-bar-primary)" radius={[6, 6, 0, 0]} name="Budgeted" />
            <Bar dataKey="spent"  fill="#e95e00" radius={[6, 6, 0, 0]} name="Spent" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. REHAB TRACKER
// ---------------------------------------------------------------------------
export function RehabTracker({ onSelectRehabItem } = {}) {
  const [filterDeal, setFilterDeal]     = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { dealId, idx, category }
  // assignments: { [flipId-itemIdx]: contractorId | null }
  // seeded from mock data, mutated in place so DealContractors stays in sync
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate(n => n + 1);
  // Typeahead + Add-new-contractor flow (mirrors DealDetail's Rehab tab)
  const [assignTA, setAssignTA] = useState({ dealId: null, itemIdx: null, query: "" });
  const [pendingAssign, setPendingAssign] = useState(null); // { dealId, itemIdx } | null
  const [showConModal, setShowConModal] = useState(false);
  const emptyConForm = { name: "", trade: "", phone: "", email: "", license: "", insuranceExpiry: "", notes: "" };
  const [conForm, setConForm] = useState(emptyConForm);
  const sfC = k => e => setConForm(f => ({ ...f, [k]: e.target.value }));

  const deals = _DEALS.filter(f => f.stage !== "Sold");

  const allItems = deals.flatMap(f =>
    (f.rehabItems || []).map((item, idx) => ({
      ...item, dealId: f.id, dealName: f.name, dealColor: f.color, dealImage: f.image, _idx: idx,
    }))
  );

  const filtered = allItems.filter(item => {
    if (filterDeal   !== "all" && item.dealId !== parseInt(filterDeal)) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    return true;
  });

  const totalBudget = filtered.reduce((s, i) => s + i.budgeted, 0);
  const totalSpent  = filtered.reduce((s, i) => s + i.spent, 0);
  const totalLeft   = totalBudget - totalSpent;
  const complete    = filtered.filter(i => i.status === "complete").length;
  const inProgress  = filtered.filter(i => i.status === "in-progress").length;

  const statusStyle = {
    "complete":    { bg: "#cce8d8", text: "#1a7a4a", label: "Complete"    },
    "in-progress": { bg: "#fff7ed", text: "#9a3412", label: "In Progress" },
    "pending":     { bg: "#f1f5f9", text: "var(--text-secondary)", label: "Pending"     },
  };

  // Assign a contractor to a rehab item — mutates DEALS directly so contractor
  // cards pick it up without prop-drilling
  function addContractorToItem(dealId, itemIdx, contractorId, bid = 0) {
    const deal = _DEALS.find(f => f.id === dealId);
    if (deal && deal.rehabItems[itemIdx] !== undefined) {
      const cons = deal.rehabItems[itemIdx].contractors || [];
      if (!cons.some(c => c.id === contractorId)) {
        deal.rehabItems[itemIdx].contractors = [...cons, { id: contractorId, bid }];
        rerender();
      }
    }
  }

  function removeContractorFromItem(dealId, itemIdx, contractorId) {
    const deal = _DEALS.find(f => f.id === dealId);
    if (deal && deal.rehabItems[itemIdx] !== undefined) {
      deal.rehabItems[itemIdx].contractors = (deal.rehabItems[itemIdx].contractors || []).filter(c => c.id !== contractorId);
      rerender();
    }
  }

  function updateContractorBid(dealId, itemIdx, contractorId, bid) {
    const deal = _DEALS.find(f => f.id === dealId);
    if (deal && deal.rehabItems[itemIdx] !== undefined) {
      const cons = deal.rehabItems[itemIdx].contractors || [];
      const entry = cons.find(c => c.id === contractorId);
      if (entry) { entry.bid = bid; rerender(); }
    }
  }

  // Assign an existing global contractor to a row (auto-attaching to the deal first)
  function assignContractorToRowGlobal(dealId, itemIdx, contractorId) {
    const gi = _CON.findIndex(c => c.id === contractorId);
    if (gi !== -1) {
      const ids = _CON[gi].dealIds || [];
      if (!ids.includes(dealId)) {
        _CON[gi] = { ..._CON[gi], dealIds: [...ids, dealId] };
      }
    }
    addContractorToItem(dealId, itemIdx, contractorId);
    setAssignTA({ dealId: null, itemIdx: null, query: "" });
  }

  // Open Add Contractor modal from a rehab row's typeahead, pre-filling Trade with the row's category
  function openAddContractorForRow(dealId, itemIdx, prefillName) {
    const deal = _DEALS.find(f => f.id === dealId);
    const cat = (deal && deal.rehabItems && deal.rehabItems[itemIdx] && deal.rehabItems[itemIdx].category) || "";
    setPendingAssign({ dealId, itemIdx });
    setAssignTA({ dealId: null, itemIdx: null, query: "" });
    setConForm({ name: (prefillName || "").trim(), trade: cat, phone: "", email: "", license: "", insuranceExpiry: "", notes: "" });
    setShowConModal(true);
  }

  function handleSaveConTracker() {
    if (!conForm.name) return;
    const dealId = pendingAssign?.dealId;
    const newCon = { id: newId(), name: conForm.name, trade: conForm.trade, phone: conForm.phone, email: conForm.email || "", license: conForm.license || null, insuranceExpiry: conForm.insuranceExpiry || null, rating: 0, notes: conForm.notes || "", dealIds: dealId ? [dealId] : [], bids: [], payments: [], documents: [] };
    _CON.push(newCon);
    if (pendingAssign) {
      addContractorToItem(pendingAssign.dealId, pendingAssign.itemIdx, newCon.id);
    }
    setShowConModal(false);
    setPendingAssign(null);
    setConForm(emptyConForm);
    rerender();
  }

  function attachExistingFromTracker(conId) {
    if (!pendingAssign) { setShowConModal(false); return; }
    const gi = _CON.findIndex(c => c.id === conId);
    if (gi === -1) return;
    const ids = _CON[gi].dealIds || [];
    if (!ids.includes(pendingAssign.dealId)) {
      _CON[gi] = { ..._CON[gi], dealIds: [...ids, pendingAssign.dealId] };
    }
    addContractorToItem(pendingAssign.dealId, pendingAssign.itemIdx, conId);
    setShowConModal(false);
    setPendingAssign(null);
    setConForm(emptyConForm);
  }

  // Add line item modal state
  const emptyItem = { dealId: "", category: "", canonicalCategory: null, budgeted: "", spent: "0", status: "pending" };
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm]       = useState(emptyItem);
  const sif = k => e => setItemForm(f => ({ ...f, [k]: e.target.value }));
  const [catFocus, setCatFocus] = useState(false);
  // Canonical taxonomy + any custom categories that have been used across deals
  const allCategories = useMemo(() => {
    const canonicalLabels = new Set(REHAB_CATEGORIES.map(c => c.label.toLowerCase()));
    const customSet = new Set();
    _DEALS.forEach(f => (f.rehabItems || []).forEach(i => {
      if (i.category && !canonicalLabels.has(i.category.toLowerCase())) customSet.add(i.category);
    }));
    return { canonical: REHAB_CATEGORIES, custom: [...customSet].sort() };
  }, []);

  function saveLineItem() {
    if (!itemForm.dealId || !itemForm.category) return;
    const deal = _DEALS.find(f => f.id === parseInt(itemForm.dealId));
    if (!deal) return;
    const canon = itemForm.canonicalCategory || getCanonicalByLabel(itemForm.category)?.slug || null;
    deal.rehabItems.push({
      category:         itemForm.category,
      canonicalCategory: canon,
      budgeted:         parseFloat(itemForm.budgeted) || 0,
      spent:            parseFloat(itemForm.spent) || 0,
      status:           itemForm.status,
      contractors: [],
    });
    setItemForm(emptyItem);
    setShowAddItem(false);
    rerender();
  }

  // Edit line item inline (status + budgeted)
  const [editingItem, setEditingItem] = useState(null); // { dealId, idx }
  const [editVals, setEditVals]       = useState({});

  function startEditItem(dealId, idx, item) {
    setEditingItem({ dealId, idx });
    setEditVals({ budgeted: String(item.budgeted), spent: String(item.spent), status: item.status });
  }

  function saveEditItem() {
    if (!editingItem) return;
    const deal = _DEALS.find(f => f.id === editingItem.dealId);
    if (deal && deal.rehabItems[editingItem.idx]) {
      Object.assign(deal.rehabItems[editingItem.idx], {
        budgeted: parseFloat(editVals.budgeted) || 0,
        spent:    parseFloat(editVals.spent) || 0,
        status:   editVals.status,
      });
    }
    setEditingItem(null);
    rerender();
  }

  function deleteLineItem(dealId, idx) {
    const deal = _DEALS.find(f => f.id === dealId);
    if (deal) {
      deal.rehabItems.splice(idx, 1);
      rerender();
    }
  }

  return (
    <div>
      <PageHeader
        title="Rehab Tracker"
        sub="All rehab line items across active deals"
        filter={
          <select value={filterDeal} onChange={e => setFilterDeal(e.target.value)}
            style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Deals</option>
            {deals.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={Target}      label="Total Budget"  value={fmtK(totalBudget)} sub="Active deals"   color="var(--c-blue)" tip="Sum of rehab budgets across all active deals." />
        <StatCard icon={Receipt}     label="Total Spent"   value={fmt(totalSpent)}   sub="To date"        color="#e95e00" tip="Total amount spent on rehab across all deals to date." />
        <StatCard icon={DollarSign}  label="Budget Left"   value={fmt(totalLeft)}    sub={totalLeft < 0 ? "OVER BUDGET" : "Remaining"} color={totalLeft < 0 ? "var(--c-red)" : "var(--c-green)"} semantic tip="Total Budget − Total Spent. Negative means over budget." />
        <StatCard icon={CheckCircle} label="Tasks Done"    value={`${complete}/${allItems.length}`} sub={`${inProgress} in progress`} color="var(--c-purple)" tip="Completed rehab line items out of total across all deals." />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {[["all", "All Statuses"], ["complete", "Complete"], ["in-progress", "In Progress"], ["pending", "Pending"]].map(([val, label]) => {
            const active = filterStatus === val;
            return (
              <button key={val} onClick={() => setFilterStatus(val)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {label}
              </button>
            );
          })}
        </div>
        <div style={{ background: "var(--surface-muted)", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
          <Search size={13} /> {filtered.length} items
        </div>
        <button onClick={() => setShowAddItem(true)} style={{ marginLeft: "auto", background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Add Rehab Item
        </button>
      </div>

      {/* Items by deal */}
      {deals
        .filter(f => filterDeal === "all" || f.id === parseInt(filterDeal))
        .map(f => {
          const items = filtered.filter(i => i.dealId === f.id);
          if (!items.length) return null;
          const dealBudget     = items.reduce((s, i) => s + i.budgeted, 0);
          const dealSpent      = items.reduce((s, i) => s + i.spent,    0);
          const pct            = dealBudget > 0 ? Math.min((dealSpent / dealBudget) * 100, 100) : 0;
          const dealContractors = _CON.filter(c => (c.dealIds || []).includes(f.id));
          const assignedCount  = items.filter(i => (i.contractors || []).length > 0).length;

          return (
            <div key={f.id} style={{ background: "var(--surface)", borderRadius: 16, padding: 24, border: "1px solid var(--border-subtle)", marginBottom: 16 }}>
              {/* Deal header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{f.image}</div>
                  <div>
                    <p style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 15 }}>{f.name}</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {fmt(dealSpent)} spent of {fmt(dealBudget)} · {assignedCount}/{items.length} scopes assigned
                    </p>
                  </div>
                </div>
                <StageDot stage={f.stage} />
              </div>

              {/* Progress bar */}
              <div style={{ background: "var(--surface-muted)", borderRadius: 4, height: 6, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct > 95 ? "var(--c-red)" : "var(--c-green)", borderRadius: 4, transition: "width 0.3s" }} />
              </div>

              {/* Line items table */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Category", "Contractor", "Status", "Budgeted", "Spent", "Variance", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", paddingBottom: 8, borderBottom: "1px solid var(--border-subtle)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const variance    = item.budgeted - item.spent;
                    const ss          = statusStyle[item.status];
                    const assigned    = item.contractors || [];
                    const assignedIds = assigned.map(c => c.id);
                    const unassigned  = dealContractors.filter(c => !assignedIds.includes(c.id));
                    const isEditing   = editingItem?.dealId === f.id && editingItem?.idx === item._idx;

                    return (
                      <tr key={i} onClick={() => onSelectRehabItem && !isEditing && onSelectRehabItem(f.id, item._idx)} style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : "none", background: isEditing ? "#fff7ed" : "transparent", cursor: onSelectRehabItem && !isEditing ? "pointer" : "default" }}>
                        {/* Category */}
                        <td style={{ padding: "10px 0 10px", color: "var(--text-primary)", fontSize: 13, fontWeight: 500, paddingRight: 12 }}>
                          {item.category}
                        </td>

                        {/* Contractor cell — supports multiple with per-item bids */}
                        <td onClick={e => e.stopPropagation()} style={{ padding: "10px 0", paddingRight: 12, minWidth: 200 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                            {assigned.map(asgn => {
                              const con = _CON.find(c => c.id === asgn.id);
                              if (!con) return null;
                              const conBid = _BIDS.find(b => b.contractorId === con.id && b.dealId === f.id && b.rehabItem === item.category);
                              const mm1 = item.status === "complete" && conBid?.status !== "accepted";
                              const mm2 = false;
                              return (
                                <div key={asgn.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--surface-muted)", borderRadius: 20, padding: "4px 8px 4px 6px" }}>
                                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg, #e95e00, #041830)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Truck size={9} color="#fff" />
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>{con.name}</span>
                                  {asgn.bid > 0 && <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>{fmt(asgn.bid)}</span>}
                                  <button onClick={() => removeContractorFromItem(f.id, item._idx, asgn.id)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex", alignItems: "center" }}>
                                    <X size={10} />
                                  </button>
                                  {mm1 && <span title={`${con.name} still marked active`} style={{ cursor: "help" }}><AlertCircle size={12} color="#e95e00" /></span>}
                                  {mm2 && <span title={`${con.name} is complete but item isn't`} style={{ cursor: "help" }}><AlertCircle size={12} color="var(--c-blue)" /></span>}
                                </div>
                              );
                            })}
                            {assignTA.dealId === f.id && assignTA.itemIdx === item._idx ? (
                              <div style={{ position: "relative" }}>
                                <input
                                  autoFocus
                                  value={assignTA.query}
                                  onChange={e => setAssignTA({ dealId: f.id, itemIdx: item._idx, query: e.target.value })}
                                  onBlur={() => setTimeout(() => setAssignTA(s => (s.dealId === f.id && s.itemIdx === item._idx) ? { dealId: null, itemIdx: null, query: "" } : s), 180)}
                                  onKeyDown={e => { if (e.key === "Escape") setAssignTA({ dealId: null, itemIdx: null, query: "" }); }}
                                  placeholder="Type contractor name..."
                                  style={{ border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "var(--text-dim)", background: "var(--surface)", outline: "none", width: 200 }} />
                                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", zIndex: 100, minWidth: 240, maxHeight: 240, overflowY: "auto" }}>
                                  {(() => {
                                    const q = assignTA.query.trim().toLowerCase();
                                    const matches = _CON.filter(c => !assignedIds.includes(c.id) && (!q || c.name.toLowerCase().includes(q))).slice(0, 8);
                                    return (
                                      <>
                                        {matches.length === 0 && (
                                          <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)" }}>{q ? "No matches" : "No contractors yet"}</div>
                                        )}
                                        {matches.map(c => {
                                          const onDeal = (c.dealIds || []).includes(f.id);
                                          return (
                                            <div key={c.id}
                                              onMouseDown={e => { e.preventDefault(); assignContractorToRowGlobal(f.id, item._idx, c.id); }}
                                              style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                                              onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
                                              onMouseLeave={e => e.currentTarget.style.background = "var(--surface)"}>
                                              <span style={{ color: "var(--text-dim)", fontWeight: 600 }}>{c.name}</span>
                                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.trade || ""}{!onDeal ? " · not on deal" : ""}</span>
                                            </div>
                                          );
                                        })}
                                        <div onMouseDown={e => { e.preventDefault(); openAddContractorForRow(f.id, item._idx, assignTA.query); }}
                                          style={{ padding: "10px 12px", fontSize: 12, cursor: "pointer", color: "#e95e00", fontWeight: 700, background: "#fff7ed", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 6 }}
                                          onMouseEnter={e => e.currentTarget.style.background = "#ffedd5"}
                                          onMouseLeave={e => e.currentTarget.style.background = "#fff7ed"}>
                                          <Plus size={12} /> Add new contractor{assignTA.query.trim() ? ` "${assignTA.query.trim()}"` : ""}
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setAssignTA({ dealId: f.id, itemIdx: item._idx, query: "" })}
                                style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "var(--text-muted)", background: "var(--surface-alt)", cursor: "pointer" }}>
                                {assigned.length > 0 ? "+ Add" : "+ Assign contractor"}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Status — editable inline */}
                        <td onClick={e => e.stopPropagation()} style={{ padding: "10px 0", paddingRight: 12 }}>
                          {isEditing ? (
                            <select value={editVals.status} onChange={e => setEditVals(v => ({ ...v, status: e.target.value }))}
                              style={{ ...iS, padding: "4px 8px", fontSize: 12, width: 120 }}>
                              <option value="pending">Pending</option>
                              <option value="in-progress">In Progress</option>
                              <option value="complete">Complete</option>
                            </select>
                          ) : (
                            <span style={{ background: ss.bg, color: ss.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{ss.label}</span>
                          )}
                        </td>

                        {/* Budgeted — editable inline */}
                        <td onClick={e => e.stopPropagation()} style={{ padding: "10px 0", paddingRight: 12 }}>
                          {isEditing ? (
                            <input type="number" value={editVals.budgeted} onChange={e => setEditVals(v => ({ ...v, budgeted: e.target.value }))}
                              style={{ ...iS, padding: "4px 8px", fontSize: 12, width: 100 }} />
                          ) : (
                            <span style={{ color: "var(--text-primary)", fontSize: 13 }}>{fmt(item.budgeted)}</span>
                          )}
                        </td>

                        {/* Spent — editable inline */}
                        <td onClick={e => e.stopPropagation()} style={{ padding: "10px 0", paddingRight: 12 }}>
                          {isEditing ? (
                            <input type="number" value={editVals.spent} onChange={e => setEditVals(v => ({ ...v, spent: e.target.value }))}
                              style={{ ...iS, padding: "4px 8px", fontSize: 12, width: 100 }} />
                          ) : (
                            <span style={{ color: "var(--text-primary)", fontSize: 13 }}>{fmt(item.spent)}</span>
                          )}
                        </td>

                        {/* Variance */}
                        <td style={{ padding: "10px 0", paddingRight: 8 }}>
                          <span style={{ color: variance < 0 ? "var(--c-red)" : "var(--c-green)", fontSize: 13, fontWeight: 600 }}>
                            {variance < 0 ? "−" : "+"}{fmt(Math.abs(variance))}
                          </span>
                        </td>

                        {/* Actions */}
                        <td onClick={e => e.stopPropagation()} style={{ padding: "10px 0", whiteSpace: "nowrap" }}>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={saveEditItem} style={{ background: "var(--c-green)", color: "#fff", border: "none", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                              <button onClick={() => setEditingItem(null)} style={{ background: "var(--surface-muted)", color: "var(--text-secondary)", border: "none", borderRadius: 7, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 4, opacity: 0.4, transition: "opacity 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.opacity = 1}
                              onMouseLeave={e => e.currentTarget.style.opacity = 0.4}>
                              <button onClick={() => startEditItem(f.id, item._idx, item)}
                                style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }}
                                title="Edit">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => setDeleteConfirm({ dealId: f.id, idx: item._idx, category: item.category, budgeted: item.budgeted, spent: item.spent })}
                                style={{ background: "#f5d0cc", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }}
                                title="Delete">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

      {/* Add Rehab Item Modal */}
      {showAddItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>Add Rehab Item</h2>
              <button onClick={() => setShowAddItem(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Deal *</p>
                <select style={iS} value={itemForm.dealId} onChange={sif("dealId")}>
                  <option value="">Select deal...</option>
                  {deals.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div style={{ position: "relative" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Category *</p>
                <input style={iS} placeholder="Start typing to search or add new..." value={itemForm.category}
                  onChange={e => { setItemForm(f => ({ ...f, category: e.target.value, canonicalCategory: null })); setCatFocus(true); }}
                  onFocus={() => setCatFocus(true)} onBlur={() => setTimeout(() => setCatFocus(false), 150)} />
                {!catFocus && !itemForm.category && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>Pick from standard categories or add your own</p>}
                {catFocus && (() => {
                  const q = itemForm.category.toLowerCase().trim();
                  const canonMatches = q
                    ? allCategories.canonical.filter(c => c.label.toLowerCase().includes(q))
                    : allCategories.canonical;
                  const customMatches = q
                    ? allCategories.custom.filter(c => c.toLowerCase().includes(q))
                    : allCategories.custom;
                  const exactExists = [...allCategories.canonical.map(c => c.label), ...allCategories.custom]
                    .some(c => c.toLowerCase() === q);
                  const showNew = q && !exactExists;
                  if (canonMatches.length === 0 && customMatches.length === 0 && !showNew) return null;
                  // Group canonical matches by their group
                  const grouped = REHAB_CATEGORY_GROUPS
                    .map(g => ({ group: g, items: canonMatches.filter(c => c.group === g) }))
                    .filter(g => g.items.length > 0);
                  return (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                      {grouped.map(({ group, items }) => (
                        <div key={group}>
                          <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)", borderBottom: "1px solid var(--border-subtle)" }}>{group}</div>
                          {items.map(c => (
                            <button key={c.slug} type="button"
                              onMouseDown={() => { setItemForm(f => ({ ...f, category: c.label, canonicalCategory: c.slug })); setCatFocus(false); }}
                              style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                              <Wrench size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                              <span>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                      {customMatches.length > 0 && (
                        <div>
                          <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)", borderBottom: "1px solid var(--border-subtle)" }}>Custom</div>
                          {customMatches.map(c => (
                            <button key={c} type="button"
                              onMouseDown={() => { setItemForm(f => ({ ...f, category: c, canonicalCategory: null })); setCatFocus(false); }}
                              style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                              <Wrench size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                              <span>{c}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {showNew && (
                        <button type="button" onMouseDown={() => { setCatFocus(false); }}
                          style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "#fff7ed", border: "none", cursor: "pointer", textAlign: "left" }}>
                          <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{itemForm.category}&rdquo; as custom</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Budget ($)</p>
                  <input type="number" style={iS} placeholder="0" value={itemForm.budgeted} onChange={sif("budgeted")} />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Spent so far ($)</p>
                  <input type="number" style={iS} placeholder="0" value={itemForm.spent} onChange={sif("spent")} />
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Status</p>
                <select style={iS} value={itemForm.status} onChange={sif("status")}>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveLineItem} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Add Rehab Item</button>
              <button onClick={() => setShowAddItem(false)} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, width: 480, padding: 28 }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Delete Rehab Item</h2>
            <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this rehab item?</p>
            <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{deleteConfirm.category}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Budget: ${deleteConfirm.budgeted?.toLocaleString()} · Spent: ${deleteConfirm.spent?.toLocaleString()}</p>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { deleteLineItem(deleteConfirm.dealId, deleteConfirm.idx); setDeleteConfirm(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {showConModal && (() => {
        const dealOnIds = new Set((pendingAssign ? _CON.filter(c => (c.dealIds || []).includes(pendingAssign.dealId)) : []).map(c => c.id));
        const existingAvailable = _CON.filter(c => !dealOnIds.has(c.id));
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>Add Contractor</h2>
                <button onClick={() => { setShowConModal(false); setPendingAssign(null); setConForm(emptyConForm); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
              </div>
              {existingAvailable.length > 0 && (
                <div style={{ marginBottom: 18, padding: 14, background: "var(--surface-alt)", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
                  <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Add from your existing contractors</label>
                  <select defaultValue="" onChange={e => { if (e.target.value) attachExistingFromTracker(parseInt(e.target.value)); }} style={iS}>
                    <option value="">Select a contractor you've worked with before…</option>
                    {existingAvailable.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.trade ? ` — ${c.trade}` : ""}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>— or create a new contractor below —</p>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Company / Name *</label><input type="text" placeholder="e.g. ABC Plumbing" value={conForm.name} onChange={sfC("name")} style={iS} /></div>
                <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Trade</label><input type="text" placeholder="e.g. Plumbing, Electrical" value={conForm.trade} onChange={sfC("trade")} style={iS} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Phone <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label><input type="tel" placeholder="555-000-0000" value={conForm.phone} onChange={sfC("phone")} style={iS} /></div>
                <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Email <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label><input type="email" placeholder="info@contractor.com" value={conForm.email} onChange={sfC("email")} style={iS} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>License # <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label><input type="text" placeholder="e.g. PL-2024-1847" value={conForm.license} onChange={sfC("license")} style={iS} /></div>
                <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Insurance Expiry <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label><input type="date" value={conForm.insuranceExpiry} onChange={sfC("insuranceExpiry")} style={iS} /></div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Notes <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
                <textarea style={{ ...iS, minHeight: 70, resize: "vertical" }} placeholder="Notes about this contractor..." value={conForm.notes} onChange={sfC("notes")} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowConModal(false); setPendingAssign(null); setConForm(emptyConForm); }} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSaveConTracker} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Add Contractor</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. DEAL EXPENSES
// ---------------------------------------------------------------------------

// ─── Expense Detail Slide-Over ─────────────────────────────────────────────
function ExpDetailPanel({ exp, onClose, onEdit, onDelete }) {
  if (!exp) return null;
  const deal = _DEALS.find(d => d.id === exp.dealId);
  const contractor = _CON.find(c => c.id === exp.contractorId);
  const rehabItem = (exp.rehabItemIdx != null && deal?.rehabItems) ? deal.rehabItems[exp.rehabItemIdx] : null;
  const receipts = DEAL_EXPENSE_RECEIPTS.filter(r => r.expenseId === exp.id);
  const isPaid = (exp.status || "paid") === "paid";
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,24,48,0.35)", zIndex: 1200 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 460, background: "var(--surface)", boxShadow: "-8px 0 40px rgba(0,0,0,0.14)", zIndex: 1201, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "28px 28px 20px", background: "var(--surface-alt)", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ background: isPaid ? "#cce8d8" : "#fff7ed", color: isPaid ? "#1a7a4a" : "#9a3412", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{isPaid ? "Paid" : "Pending"}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 8, lineHeight: 1 }}><X size={20} /></button>
          </div>
          <p style={{ fontSize: 32, fontWeight: 800, color: "#c0392b", margin: "0 0 4px" }}>−{fmt(exp.amount)}</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{exp.date}</p>
        </div>
        <div style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Tag size={14} color="var(--text-muted)" /></div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Category</p>
                <span style={{ background: "var(--surface-muted)", color: "var(--text-label)", borderRadius: 6, padding: "3px 9px", fontSize: 13, fontWeight: 600 }}>{exp.category}</span>
              </div>
            </div>
            {deal && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Hammer size={14} color="var(--text-muted)" /></div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Deal</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)", display: "inline-block" }} /><p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{deal.name}</p></div>
                </div>
              </div>
            )}
            {[
              { label: "Paid To", value: exp.vendor || "—", icon: <User size={14} color="var(--text-muted)" /> },
              { label: "Description", value: exp.description || "—", icon: <MessageSquare size={14} color="var(--text-muted)" /> },
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
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Layers size={14} color="#e95e00" /></div>
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
              <Paperclip size={12} /> Attachments{receipts.length > 0 && <span style={{ background: "var(--surface-muted)", borderRadius: 20, padding: "1px 7px", fontSize: 11, color: "var(--text-label)", marginLeft: 2 }}>{receipts.length}</span>}
            </p>
            {receipts.length === 0 ? (
              <div style={{ background: "var(--surface-alt)", border: "1px dashed #e2e8f0", borderRadius: 12, padding: "28px 20px", textAlign: "center" }}>
                <Paperclip size={20} color="var(--border-strong)" style={{ display: "block", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No receipts attached</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {receipts.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: r.mimeType?.includes("pdf") ? "#f5d0cc" : "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
          <button onClick={() => { onClose(); onDelete(exp); }} style={{ padding: "11px 18px", background: "#f5d0cc", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--c-red)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Trash2 size={14} /> Delete</button>
        </div>
      </div>
    </>
  );
}

const DEAL_EXPENSE_GROUPS = {
  "Acquisition":          ["Closing Costs (Buy)", "Title & Escrow", "Inspection", "Appraisal"],
  "Rehab Labor":          ["General Contractor", "Subcontractor", "Day Labor"],
  "Rehab Materials":      ["Materials & Supplies", "Appliances", "Fixtures & Hardware"],
  "Permits & Fees":       ["Permits", "Inspections", "Dumpster / Debris Removal"],
  "Holding Costs":        ["Insurance", "Property Tax", "Utilities", "Loan Interest / Hard Money", "HOA"],
  "Selling Costs":        ["Agent Commission", "Photography / Marketing", "Staging", "Cleaning", "Closing Costs (Sell)"],
  "General":              ["Landscaping", "Travel", "Other"],
};
const EXPENSE_CATS = Object.values(DEAL_EXPENSE_GROUPS).flat();

export function DealExpenses({ highlightExpId, onBack, onClearHighlight, backLabel }) {
  const [expenses, setExpenses] = useState([..._FE]);
  const [filterDeal, setFilterDeal]     = useState("all");
  const [filterCat, setFilterCat]       = useState("all");
  const [dateFilter, setDateFilter]     = useState("all");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [showModal, setShowModal]       = useState(false);

  // Highlight / flash support (linked from deal detail)
  const [flashId, setFlashId] = useState(highlightExpId);
  const highlightRef = useRef(null);
  useEffect(() => {
    if (highlightExpId) {
      setFlashId(highlightExpId);
      setTimeout(() => {
        if (highlightRef.current) {
          highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      const timer = setTimeout(() => {
        setFlashId(null);
        onClearHighlight && onClearHighlight();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightExpId]); // eslint-disable-line react-hooks/exhaustive-deps -- onClearHighlight is an inline parent callback (new ref every render)
  const [editId, setEditId]             = useState(null);
  const [search, setSearch]             = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [detailExp, setDetailExp]       = useState(null);

  const emptyForm = { dealId: "", date: "", vendor: "", category: "Materials & Supplies", description: "", amount: "", rehabItemIdx: "", contractorId: "" };
  const [form, setForm]   = useState(emptyForm);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const [vendorFocus, setVendorFocus] = useState(false);
  const [dealReceipts, setDealReceipts] = useState([]);

  // Unique vendor names for typeahead
  const allVendors = useMemo(() => {
    const names = new Set([..._FE.map(e => e.vendor), ..._CON.map(c => c.name)]);
    return [...names].filter(Boolean).sort();
  }, [expenses]); // eslint-disable-line react-hooks/exhaustive-deps -- expenses is the cache-bust counter for _FE/_CON

  // Rehab items for selected deal
  const expDeal = _DEALS.find(f => f.id === parseInt(form.dealId));
  const expRehabItems = expDeal?.rehabItems || [];

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDealReceipts([]); setShowModal(true); };
  const openEdit = exp => {
    setEditId(exp.id);
    setForm({ dealId: String(exp.dealId), date: exp.date, vendor: exp.vendor || "", category: exp.category, description: exp.description || "", amount: String(exp.amount), rehabItemIdx: exp.rehabItemIdx != null ? String(exp.rehabItemIdx) : "", contractorId: exp.contractorId ? String(exp.contractorId) : "" });
    setDealReceipts(DEAL_EXPENSE_RECEIPTS.filter(r => r.expenseId === exp.id));
    setShowModal(true);
  };

  // Date filter
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonthIdx = now.getMonth();
  const matchesDate = e => {
    if (dateFilter === "all") return true;
    const d = new Date(e.date);
    if (dateFilter === "thisMonth") return d.getFullYear() === thisYear && d.getMonth() === thisMonthIdx;
    if (dateFilter === "lastMonth") {
      const lm = thisMonthIdx === 0 ? 11 : thisMonthIdx - 1;
      const ly = thisMonthIdx === 0 ? thisYear - 1 : thisYear;
      return d.getFullYear() === ly && d.getMonth() === lm;
    }
    if (dateFilter === "thisYear") return d.getFullYear() === thisYear;
    if (dateFilter === "lastYear") return d.getFullYear() === thisYear - 1;
    if (dateFilter === "custom") {
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    }
    return true;
  };
  const clearAllFilters = () => { setFilterDeal("all"); setFilterCat("all"); setDateFilter("all"); setDateFrom(""); setDateTo(""); setSearch(""); };
  const hasActiveFilters = filterDeal !== "all" || filterCat !== "all" || dateFilter !== "all" || search;

  const filtered = expenses.filter(e => {
    if (filterDeal !== "all" && e.dealId !== parseInt(filterDeal)) return false;
    if (filterCat  !== "all" && e.category !== filterCat) return false;
    if (search && !e.description.toLowerCase().includes(search.toLowerCase()) && !e.vendor.toLowerCase().includes(search.toLowerCase())) return false;
    if (!matchesDate(e)) return false;
    return true;
  });

  const total     = filtered.reduce((s, e) => s + e.amount, 0);
  const highestExp = filtered.length > 0 ? filtered.reduce((max, e) => e.amount > max.amount ? e : max, filtered[0]) : null;

  const catTotals = EXPENSE_CATS.map(cat => ({
    cat, total: filtered.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const handleSave = () => {
    if (!form.amount || !form.dealId || !form.vendor || !form.description) return;
    const deal = _DEALS.find(f => f.id === parseInt(form.dealId));
    const amt = parseFloat(form.amount);
    const riIdx = form.rehabItemIdx !== "" ? parseInt(form.rehabItemIdx) : null;
    const built = { dealId: parseInt(form.dealId), dealName: deal?.name, date: form.date || new Date().toISOString().split("T")[0], vendor: form.vendor || "Unknown", category: form.category, description: form.description, amount: amt, rehabItemIdx: riIdx, contractorId: form.contractorId ? parseInt(form.contractorId) : null };

    if (editId !== null) {
      // Reverse the old rehab item link before applying new one
      const oldExp = expenses.find(e => e.id === editId);
      if (oldExp && oldExp.rehabItemIdx != null && deal) {
        const oldItem = deal.rehabItems[oldExp.rehabItemIdx];
        if (oldItem) oldItem.spent = Math.max(0, oldItem.spent - oldExp.amount);
      }
      setExpenses(prev => prev.map(e => e.id === editId ? { ...e, ...built } : e));
      // Persist to shared DEAL_EXPENSES array so other screens (RehabItemDetail, etc.) see the change
      const globalIdx = _FE.findIndex(e => e.id === editId);
      if (globalIdx !== -1) {
        _FE[globalIdx] = { ..._FE[globalIdx], ...built };
      }
      dealReceipts.filter(r => !DEAL_EXPENSE_RECEIPTS.some(er => er.id === r.id)).forEach(r => addDealExpenseReceipt({ ...r, expenseId: editId }));
    } else {
      const expId = newId();
      const newExp = { id: expId, ...built };
      setExpenses(prev => [newExp, ...prev]);
      // Persist to shared DEAL_EXPENSES array
      _FE.unshift(newExp);
      dealReceipts.forEach(r => addDealExpenseReceipt({ ...r, expenseId: expId }));
    }
    // Update rehab item spent
    if (riIdx != null && deal && deal.rehabItems[riIdx]) {
      deal.rehabItems[riIdx].spent += amt;
    }
    setForm(emptyForm); setEditId(null); setDealReceipts([]); setShowModal(false);
  };

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#e95e00", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 0 12px" }}>
          <ChevronLeft size={14} /> {backLabel || "Back to Deal"}
        </button>
      )}
      <PageHeader
        title="Expenses"
        sub="All costs across every deal"
        filter={
          <select value={filterDeal} onChange={e => setFilterDeal(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Deals</option>
            {_DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={Receipt}    label="Total Expenses"    value={fmt(total)}     sub={`${filtered.length} transactions`} color="#e95e00" tip="Sum of all expenses matching the current filters." />
        <StatCard icon={TrendingUp}  label="Largest Expense"   value={highestExp ? fmt(highestExp.amount) : "—"} sub={highestExp ? `${highestExp.description || highestExp.category}` : "No expenses"} color="#e95e00" tip="The single highest expense in the current filtered view." />
        <StatCard icon={Hammer}     label="Largest Category"  value={catTotals[0]?.cat || "—"} sub={catTotals[0] ? fmt(catTotals[0].total) : ""}  color="var(--c-purple)" tip="The expense category with the highest total spend." />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: hasActiveFilters ? 10 : 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" }} />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...iS, width: "auto", minWidth: 160, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All Categories</option>
          {Object.entries(DEAL_EXPENSE_GROUPS).map(([group, subs]) => (
                    <optgroup key={group} label={group}>
                      {subs.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  ))}
        </select>
        <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); if (e.target.value !== "custom") { setDateFrom(""); setDateTo(""); } }} style={{ ...iS, width: "auto", minWidth: 140, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All Time</option>
          <option value="thisMonth">This Month</option>
          <option value="lastMonth">Last Month</option>
          <option value="thisYear">This Year</option>
          <option value="lastYear">Last Year</option>
          <option value="custom">Custom Range</option>
        </select>
        {dateFilter === "custom" && (
          <>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...iS, width: "auto", fontSize: 13, padding: "9px 12px" }} />
            <span style={{ color: "var(--text-muted)", fontSize: 13, alignSelf: "center" }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...iS, width: "auto", fontSize: 13, padding: "9px 12px" }} />
          </>
        )}
        <button onClick={openAdd} style={{ marginLeft: "auto", background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Add Expense
        </button>
      </div>
      {/* Active filter chips */}
      {hasActiveFilters && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Filtered:</span>
          {filterDeal !== "all" && <span style={{ background: "#fff7ed", color: "#e95e00", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{_DEALS.find(f => f.id === parseInt(filterDeal))?.name || filterDeal}</span>}
          {filterCat !== "all" && <span style={{ background: "#fff7ed", color: "#7c2d12", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{filterCat}</span>}
          {dateFilter !== "all" && <span style={{ background: "#edf7f2", color: "#1a7a4a", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{{ thisMonth: "This Month", lastMonth: "Last Month", thisYear: "This Year", lastYear: "Last Year", custom: dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : "Custom Range" }[dateFilter]}</span>}
          {search && <span style={{ background: "var(--surface-muted)", color: "var(--text-label)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>&ldquo;{search}&rdquo;</span>}
          <button onClick={clearAllFilters} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filter
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["Date", "Deal", "Paid To", "Category", "Description", "Amount", ""].map(h => (
                <th key={h} style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "12px 16px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                No expenses match your filters.{" "}
                <button onClick={clearAllFilters} style={{ background: "none", border: "none", color: "#e95e00", fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
              </td></tr>
            )}
            {filtered.map((e, i) => {
              const deal = _DEALS.find(f => f.id === e.dealId);
              return (
                <tr key={e.id} ref={e.id === flashId ? highlightRef : undefined}
                  onClick={() => setDetailExp(e)}
                  style={{ borderTop: "1px solid var(--border-subtle)", background: e.id === flashId ? "#fff7ed" : i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)", transition: "background 1.5s ease", cursor: "pointer" }}
                  onMouseEnter={ev => { if (e.id !== flashId) ev.currentTarget.style.background = "#f0f9ff"; }}
                  onMouseLeave={ev => { ev.currentTarget.style.background = e.id === flashId ? "#fff7ed" : i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)"; }}>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: 13 }}>{e.date}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {deal && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)" }} />
                        <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>{deal.name}</span>
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>{e.vendor}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: "var(--surface-muted)", color: "var(--text-label)", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{e.category}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: 13 }}>{e.description}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>{fmt(e.amount)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={ev => { ev.stopPropagation(); openEdit(e); }} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                      <button onClick={ev => { ev.stopPropagation(); setDeleteConfirm(e); }} style={{ background: "#f5d0cc", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No expenses found</td></tr>
            )}
          </tbody>
        </table>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", background: "var(--surface-alt)", display: "flex", justifyContent: "flex-end", gap: 24 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total: <strong style={{ color: "var(--text-primary)" }}>{fmt(total)}</strong></span>
        </div>
      </div>

      {/* Expense Detail Panel */}
      {detailExp && <ExpDetailPanel exp={detailExp} onClose={() => setDetailExp(null)} onEdit={e => { setDetailExp(null); openEdit(e); }} onDelete={e => { setDetailExp(null); setDeleteConfirm(e); }} />}

      {/* Add Expense Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>{editId ? "Edit Expense" : "Add Expense"}</h2>
              <button onClick={() => { setShowModal(false); setEditId(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            {dealReceipts.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--info-tint-alt)", borderRadius: 10, border: "1px solid var(--info-border-alt)", marginBottom: 16 }}>
                <ScanLine size={16} color="var(--c-blue)" />
                <p style={{ fontSize: 12, color: "var(--text-primary)", margin: 0 }}>
                  <strong>Have a receipt?</strong> Attach it below and we can auto-fill the details for you.
                </p>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Deal *</p>
                <select value={form.dealId} onChange={sf("dealId")} style={iS}>
                  <option value="">Select deal...</option>
                  {_DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Date</p>
                  <input type="date" style={iS} value={form.date} onChange={sf("date")} />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Amount ($) *</p>
                  <input type="number" style={iS} placeholder="0.00" value={form.amount} onChange={sf("amount")} />
                </div>
              </div>
              {(() => {
                const linkedCon = form.contractorId ? _CON.find(c => String(c.id) === String(form.contractorId)) : null;
                const pickVendor = v => {
                  const matchedCon = _CON.find(c => c.name.toLowerCase() === v.toLowerCase());
                  setForm(f => ({ ...f, vendor: v, contractorId: matchedCon ? String(matchedCon.id) : "" }));
                };
                return (
                  <div style={{ position: "relative" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Paid To *</p>
                    <input style={iS} placeholder="Who was paid?" value={form.vendor}
                      onChange={e => { pickVendor(e.target.value); setVendorFocus(true); }}
                      onFocus={() => setVendorFocus(true)} onBlur={() => setTimeout(() => setVendorFocus(false), 150)} />
                    {!vendorFocus && !form.vendor && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>Type to search previous entries or add new</p>}
                    {linkedCon && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <UserCheck size={12} color="var(--c-blue)" />
                        <span style={{ fontSize: 12, color: "var(--c-blue)", fontWeight: 600 }}>Linked to {linkedCon.name}{linkedCon.trade ? ` (${linkedCon.trade})` : ""}</span>
                        <button onMouseDown={e => { e.preventDefault(); setForm(f => ({ ...f, contractorId: "" })); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>unlink</button>
                      </div>
                    )}
                    {vendorFocus && (() => {
                      const q = form.vendor.toLowerCase();
                      const matches = q ? allVendors.filter(v => v.toLowerCase().includes(q) && v.toLowerCase() !== q) : allVendors.slice(0, 6);
                      const exactExists = allVendors.some(v => v.toLowerCase() === q);
                      const showNew = q && !exactExists;
                      if (matches.length === 0 && !showNew) return null;
                      return (
                        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                          {matches.slice(0, 6).map(v => {
                            const isContractor = _CON.some(c => c.name === v);
                            return (
                              <button key={v} onMouseDown={() => { pickVendor(v); setVendorFocus(false); }}
                                style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                                {isContractor ? <UserCheck size={13} style={{ color: "var(--c-blue)", flexShrink: 0 }} /> : <Users size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                                <span>{v}</span>
                                {isContractor && <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--c-blue)", fontWeight: 600, textTransform: "uppercase" }}>Contractor</span>}
                              </button>
                            );
                          })}
                          {showNew && (
                            <button onMouseDown={() => { pickVendor(form.vendor); setVendorFocus(false); }}
                              style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "#fff7ed", border: "none", borderTop: matches.length > 0 ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left" }}>
                              <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                              <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{form.vendor}&rdquo; as new</span>
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Category</p>
                  <select style={iS} value={form.category} onChange={sf("category")}>
                    {Object.entries(DEAL_EXPENSE_GROUPS).map(([group, subs]) => (
                    <optgroup key={group} label={group}>
                      {subs.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  ))}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Rehab Item <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></p>
                  <select style={iS} value={form.rehabItemIdx} onChange={sf("rehabItemIdx")}>
                    <option value="">None — general expense</option>
                    {expRehabItems.map((item, idx) => (
                      <option key={idx} value={idx}>{item.category} ({fmt(item.spent)} / {fmt(item.budgeted)})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Description *</p>
                <input style={iS} placeholder="Brief description" value={form.description} onChange={sf("description")} />
              </div>

              {/* Receipt / Attachment */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>
                  <Paperclip size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />Receipt / Attachment
                </p>
                <DealAttachmentZone
                  onFiles={files => {
                    const newAtts = files.map(f => ({
                      id: newId(), name: f.name, mimeType: f.type,
                      size: f.size > 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(1) + " MB" : Math.round(f.size / 1024) + " KB",
                      url: URL.createObjectURL(f), ocrData: null, createdAt: new Date().toISOString(), userId: "usr_001",
                    }));
                    setDealReceipts(prev => [...prev, ...newAtts]);
                  }}
                  compact label="Attach receipt or document" />
                {dealReceipts.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <DealAttachmentList items={dealReceipts} onRemove={id => setDealReceipts(prev => prev.filter(r => r.id !== id))} compact />
                    {dealReceipts.filter(r => !r.ocrData).map(att => (
                      <DealOcrPrompt key={att.id} attachment={att}
                        onResult={(ocrData, a) => {
                          setForm(f => ({
                            ...f,
                            vendor: f.vendor || ocrData.vendor || "",
                            amount: f.amount || String(ocrData.amount || ""),
                            date: f.date || ocrData.date || "",
                            description: f.description || `Receipt — ${ocrData.vendor || "scanned"}`,
                          }));
                          setDealReceipts(prev => prev.map(r => r.id === a.id ? { ...r, ocrData } : r));
                        }} />
                    ))}
                  </div>
                )}
                {dealReceipts.some(r => r.ocrData) && (
                  <p style={{ fontSize: 11, color: "#1a7a4a", marginTop: 4, fontStyle: "italic" }}>
                    <CheckCircle size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />
                    Fields auto-filled from receipt — please verify
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{editId ? "Save Changes" : "Save Expense"}</button>
              <button onClick={() => { setShowModal(false); setEditId(null); setDealReceipts([]); }} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, width: 480, padding: 28 }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Delete Expense</h2>
            <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this expense?</p>
            <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{deleteConfirm.description}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{deleteConfirm.vendor} · {deleteConfirm.date} · <span style={{ color: "#c0392b", fontWeight: 700 }}>${deleteConfirm.amount?.toLocaleString()}</span></p>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { setExpenses(prev => prev.filter(x => x.id !== deleteConfirm.id)); const gi = _FE.findIndex(e => e.id === deleteConfirm.id); if (gi !== -1) _FE.splice(gi, 1); setDeleteConfirm(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. CONTRACTORS
// ---------------------------------------------------------------------------
const STATUS_STYLES = {
  active:   { bg: "var(--info-tint)", text: "var(--c-blue)", label: "Active"   },
  complete: { bg: "#cce8d8", text: "#1a7a4a", label: "Complete" },
  pending:  { bg: "#f1f5f9", text: "var(--text-secondary)", label: "Pending"  },
};

export function DealContractors({ onSelectContractor }) {
  const [, rerender] = useState(0);
  const [filterDeal, setFilterDeal] = useState("all");
  const [filterTrade, setFilterTrade] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [nameFocus, setNameFocus] = useState(false);

  const emptyForm = { name: "", trade: "", phone: "", email: "", license: "", insuranceExpiry: "", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const allContractorNames = useMemo(() => {
    const names = new Set(_CON.map(c => c.name));
    return [...names].sort();
  }, []);

  const allTrades = useMemo(() => [...new Set(_CON.map(c => c.trade).filter(Boolean))].sort(), []);

  const filtered = _CON.filter(c => {
    if (filterDeal !== "all" && !(c.dealIds || []).includes(parseInt(filterDeal))) return false;
    if (filterTrade !== "all" && c.trade !== filterTrade) return false;
    return true;
  });

  const totalBids = filtered.reduce((s, c) => s + _BIDS.filter(b => b.contractorId === c.id && b.status === "accepted").reduce((bs, b) => bs + b.amount, 0), 0);
  const totalPaid = filtered.reduce((s, c) => s + _PAYMENTS.filter(p => p.contractorId === c.id).reduce((ps, p) => ps + p.amount, 0), 0);
  const outstanding = totalBids - totalPaid;

  const handleAdd = () => {
    if (!form.name) return;
    const newCon = { id: newId(), name: form.name, trade: form.trade, phone: form.phone, email: form.email || "", license: form.license || null, insuranceExpiry: form.insuranceExpiry || null, rating: 0, notes: form.notes || "", dealIds: [] };
    _CON.push(newCon);
    rerender(n => n + 1);
    setForm(emptyForm);
    setShowModal(false);
  };

  const handleDelete = (con) => {
    const ci = _CON.findIndex(x => x.id === con.id);
    if (ci !== -1) _CON.splice(ci, 1);
    _DEALS.forEach(f => (f.rehabItems || []).forEach(item => {
      if (item.contractors) item.contractors = item.contractors.filter(a => a.id !== con.id);
    }));
    rerender(n => n + 1);
    setDeleteConfirm(null);
  };

  return (
    <div>
      <PageHeader title="Contractors" sub="Manage your contractor relationships across all deals"
        filter={
          <select value={filterDeal} onChange={e => setFilterDeal(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Deals</option>
            {_DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        } />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={Users} label="Contractors" value={filtered.length} sub={filterDeal !== "all" ? `of ${_CON.length} total` : `${_CON.filter(c => (c.dealIds || []).length > 0).length} with active deals`} color="#e95e00" tip="Number of contractors matching the current filters." />
        <StatCard icon={DollarSign} label="Accepted Bids" value={fmt(totalBids)} sub={`${filtered.length} contractor${filtered.length !== 1 ? "s" : ""}`} color="#e95e00" tip="Sum of all accepted bid amounts for contractors in the current view." />
        <StatCard icon={CheckCircle} label="Total Paid" value={fmt(totalPaid)} sub="Disbursed to date" color="var(--c-green)" tip="Total payments disbursed to contractors in the current view." />
        <StatCard icon={AlertCircle} label="Outstanding" value={fmt(outstanding)} sub="Remaining balance" color={outstanding > 0 ? "#e95e00" : "var(--text-muted)"} semantic tip="Accepted Bids − Total Paid. Amount still owed to contractors in the current view." />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <select value={filterTrade} onChange={e => setFilterTrade(e.target.value)} style={{ ...iS, width: "auto", padding: "8px 12px", fontSize: 13 }}>
          <option value="all">All Trades</option>
          {allTrades.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center" }}>{filtered.length} contractors</div>
        <button onClick={() => { setForm(emptyForm); setShowModal(true); }} style={{ marginLeft: "auto", background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Add Contractor</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {filtered.map(c => {
          const deals = (c.dealIds || []).map(id => _DEALS.find(f => f.id === id)).filter(Boolean);
          const totalConBids = _BIDS.filter(b => b.contractorId === c.id && b.status === "accepted").reduce((s, b) => s + b.amount, 0);
          const totalConPaid = _PAYMENTS.filter(p => p.contractorId === c.id).reduce((s, p) => s + p.amount, 0);
          const pct = totalConBids > 0 ? Math.min((totalConPaid / totalConBids) * 100, 100) : 0;
          const conBids = _BIDS.filter(b => b.contractorId === c.id);
          const conDocs = _DOCS.filter(d => d.contractorId === c.id);
          return (
            <div key={c.id} onClick={() => onSelectContractor && onSelectContractor(c)}
              style={{ background: "var(--surface)", borderRadius: 16, padding: 20, border: "1px solid var(--border-subtle)", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#e95e00"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(245,158,11,0.10)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Truck size={18} color="var(--text-secondary)" />
                  </div>
                  <div>
                    <p style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 14 }}>{c.name}</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 12 }}>{c.trade}{c.phone ? ` · ${c.phone}` : ""}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              </div>
              {deals.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {deals.map(fl => (
                    <span key={fl.id} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface-alt)", border: "1px solid var(--border-subtle)", borderRadius: 20, padding: "2px 8px", fontSize: 11, color: "var(--text-secondary)" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1e3a5f" }} />{fl.name}
                    </span>
                  ))}
                </div>
              )}
              {deals.length === 0 && <p style={{ fontSize: 12, color: "#cbd5e1", fontStyle: "italic", marginBottom: 10 }}>No deals assigned yet</p>}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Accepted: {fmt(totalConBids)}</span>
                <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>{fmt(totalConPaid)} paid</span>
              </div>
              <div style={{ background: "var(--surface-muted)", borderRadius: 4, height: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "var(--c-green)", borderRadius: 4 }} />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
                <span>{conBids.length} bid{conBids.length !== 1 ? "s" : ""}</span>
                <span>{conDocs.length} doc{conDocs.length !== 1 ? "s" : ""}</span>
                <span>{deals.length} deal{deals.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No contractors found</div>}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>Add Contractor</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Company / Name *</p>
                <input style={iS} placeholder="Start typing to search or add new..." value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setNameFocus(true); }}
                  onFocus={() => setNameFocus(true)} onBlur={() => setTimeout(() => setNameFocus(false), 150)} />
                {!nameFocus && !form.name && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>Type to search existing contractors or add new</p>}
                {nameFocus && (() => {
                  const q = form.name.toLowerCase();
                  const matches = q ? allContractorNames.filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q) : allContractorNames.slice(0, 6);
                  const exactExists = allContractorNames.some(n => n.toLowerCase() === q);
                  const showNew = q && !exactExists;
                  if (matches.length === 0 && !showNew) return null;
                  return (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                      {matches.slice(0, 6).map(n => {
                        const existing = _CON.find(c => c.name === n);
                        return (
                          <button key={n} onMouseDown={() => { setForm(f => ({ ...f, name: n, trade: existing?.trade || f.trade })); setNameFocus(false); }}
                            style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                            <Wrench size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} /><span>{n}</span>
                            {existing?.trade && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{existing.trade}</span>}
                          </button>
                        );
                      })}
                      {showNew && (
                        <button onMouseDown={() => { setForm(f => ({ ...f, name: f.name })); setNameFocus(false); }}
                          style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "#fff7ed", border: "none", borderTop: matches.length > 0 ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left" }}>
                          <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{form.name}&rdquo; as new</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Trade</p><input style={iS} placeholder="Plumbing" value={form.trade} onChange={sf("trade")} /></div>
                <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Phone</p><input style={iS} placeholder="555-000-0000" value={form.phone} onChange={sf("phone")} /></div>
              </div>
              <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Email <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></p><input style={iS} placeholder="contractor@email.com" value={form.email} onChange={sf("email")} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>License # <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></p><input style={iS} placeholder="e.g. PL-2024-1847" value={form.license} onChange={sf("license")} /></div>
                <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Insurance Expiry <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></p><input type="date" style={iS} value={form.insuranceExpiry} onChange={sf("insuranceExpiry")} /></div>
              </div>
              <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Notes <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></p><textarea style={{ ...iS, minHeight: 70, resize: "vertical" }} placeholder="Notes about this contractor..." value={form.notes} onChange={sf("notes")} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleAdd} disabled={!form.name.trim()} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: !form.name.trim() ? "var(--surface-muted)" : "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: !form.name.trim() ? "not-allowed" : "pointer" }}>Add Contractor</button>
              <button onClick={() => setShowModal(false)} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, width: 480, padding: 28 }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Delete Contractor</h2>
            <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Remove <strong>{deleteConfirm.name}</strong> and all their bids, payments, and documents?</p>
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

// ---------------------------------------------------------------------------
// 4b. CONTRACTOR DETAIL
// ---------------------------------------------------------------------------
export function ContractorDetail({ contractor, onBack, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || "overview");
  const [, rerender] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: contractor.name, trade: contractor.trade, phone: contractor.phone || "", email: contractor.email || "", license: contractor.license || "", insuranceExpiry: contractor.insuranceExpiry || "", notes: contractor.notes || "" });
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidForm, setBidForm] = useState({ dealId: "", rehabItem: "", amount: "" });
  const [editingBidId, setEditingBidId] = useState(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", type: "contract", dealId: "" });
  const [editingDocId, setEditingDocId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [rehabFocus, setRehabFocus] = useState(false);

  const con = _CON.find(c => c.id === contractor.id) || contractor;
  const deals = (con.dealIds || []).map(id => _DEALS.find(f => f.id === id)).filter(Boolean);
  const bids = _BIDS.filter(b => b.contractorId === con.id);
  const payments = _PAYMENTS.filter(p => p.contractorId === con.id);
  const documents = _DOCS.filter(d => d.contractorId === con.id);

  const totalAccepted = bids.filter(b => b.status === "accepted").reduce((s, b) => s + b.amount, 0);
  const totalPending = bids.filter(b => b.status === "pending").reduce((s, b) => s + b.amount, 0);
  const totalPaidAmt = payments.reduce((s, p) => s + p.amount, 0);

  const saveOverview = () => {
    Object.assign(con, { name: editForm.name, trade: editForm.trade, phone: editForm.phone, email: editForm.email, license: editForm.license, insuranceExpiry: editForm.insuranceExpiry, notes: editForm.notes });
    setEditMode(false);
    rerender(n => n + 1);
  };

  const openEditBid = (b) => {
    setEditingBidId(b.id);
    setBidForm({ dealId: String(b.dealId), rehabItem: b.rehabItem, amount: String(b.amount) });
    setShowBidModal(true);
  };

  const saveBid = () => {
    const fId = parseInt(bidForm.dealId);
    const rehabName = bidForm.rehabItem.trim();
    if (!fId || !rehabName || !bidForm.amount) return;
    const deal = _DEALS.find(f => f.id === fId);
    if (editingBidId) {
      const bid = _BIDS.find(b => b.id === editingBidId);
      if (bid) {
        bid.dealId = fId;
        bid.rehabItem = rehabName;
        bid.amount = parseFloat(bidForm.amount) || 0;
      }
      setEditingBidId(null);
    } else {
      const newBid = { id: newId(), contractorId: con.id, dealId: fId, rehabItem: rehabName, amount: parseFloat(bidForm.amount) || 0, status: "pending", date: new Date().toISOString().slice(0, 10) };
      _BIDS.push(newBid);
      if (!con.dealIds.includes(fId)) con.dealIds.push(fId);
      // Auto-create rehab item on the deal if it doesn't exist
      if (deal) {
        let item = (deal.rehabItems || []).find(i => i.category === rehabName);
        if (!item) {
          item = { category: rehabName, budgeted: 0, spent: 0, status: "pending", contractors: [] };
          if (!deal.rehabItems) deal.rehabItems = [];
          deal.rehabItems.push(item);
        }
        const cons = item.contractors || [];
        if (!cons.some(c => c.id === con.id)) {
          item.contractors = [...cons, { id: con.id, bid: newBid.amount }];
        }
      }
    }
    rerender(n => n + 1);
    setBidForm({ dealId: "", rehabItem: "", amount: "" });
    setShowBidModal(false);
  };

  const toggleBidStatus = (bidId) => {
    const bid = _BIDS.find(b => b.id === bidId);
    if (bid) { bid.status = bid.status === "accepted" ? "pending" : "accepted"; rerender(n => n + 1); }
  };

  const deleteBid = (bidId) => {
    const idx = _BIDS.findIndex(b => b.id === bidId);
    if (idx !== -1) _BIDS.splice(idx, 1);
    rerender(n => n + 1);
    setDeleteConfirm(null);
  };

  const openEditDoc = (d) => {
    setEditingDocId(d.id);
    setDocForm({ name: d.name, type: d.type, dealId: d.dealId ? String(d.dealId) : "" });
    setShowDocModal(true);
  };

  const saveDoc = () => {
    if (!docForm.name) return;
    if (editingDocId) {
      const doc = _DOCS.find(d => d.id === editingDocId);
      if (doc) {
        doc.name = docForm.name;
        doc.type = docForm.type;
        doc.dealId = docForm.dealId ? parseInt(docForm.dealId) : null;
      }
      setEditingDocId(null);
    } else {
      const newDoc = { id: newId(), contractorId: con.id, name: docForm.name, type: docForm.type, dealId: docForm.dealId ? parseInt(docForm.dealId) : null, date: new Date().toISOString().slice(0, 10), size: "— KB" };
      _DOCS.push(newDoc);
    }
    rerender(n => n + 1);
    setDocForm({ name: "", type: "contract", dealId: "" });
    setShowDocModal(false);
  };

  const deleteDoc = (docId) => {
    const idx = _DOCS.findIndex(d => d.id === docId);
    if (idx !== -1) _DOCS.splice(idx, 1);
    rerender(n => n + 1);
    setDeleteConfirm(null);
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "bids", label: "Bids", icon: DollarSign, count: bids.length },
    { id: "documents", label: "Documents", icon: FileText, count: documents.length },
    { id: "history", label: "Deal History", icon: Clock, count: deals.length },
  ];

  const selectedDealForBid = _DEALS.find(f => f.id === parseInt(bidForm.dealId));
  const bidRehabOptions = selectedDealForBid ? (selectedDealForBid.rehabItems || []).map(i => i.category) : [];
  // All rehab categories across all deals for typeahead suggestions
  const allRehabCategories = useMemo(() => {
    const cats = new Set();
    _DEALS.forEach(f => (f.rehabItems || []).forEach(i => cats.add(i.category)));
    return [...cats].sort();
  }, []);

  const DOC_TYPES = { contract: "Contract", w9: "W-9", insurance: "Insurance", lienWaiver: "Lien Waiver", changeOrder: "Change Order", warranty: "Warranty", invoice: "Invoice", other: "Other" };
  const DOC_COLORS = { contract: "var(--c-blue)", w9: "var(--c-purple)", insurance: "var(--c-green)", lienWaiver: "#e95e00", changeOrder: "var(--c-red)", warranty: "#06b6d4", invoice: "#ec4899", other: "var(--text-secondary)" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}>
          <ChevronLeft size={16} /> Back to Contractors
        </button>
      </div>

      {/* Header Card */}
      <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, border: "1px solid var(--border-subtle)", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><Truck size={24} color="var(--text-secondary)" /></div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{con.name}</h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>{con.trade}{con.phone ? ` · ${con.phone}` : ""}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {deals.map(fl => (
                <span key={fl.id} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface-alt)", border: "1px solid var(--border-subtle)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "var(--text-secondary)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1e3a5f" }} />{fl.name}
                </span>
              ))}
            </div>
            <button onClick={() => { setEditMode(true); setActiveTab("overview"); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-muted)", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-label)", marginLeft: 4 }}><Pencil size={13} /> Edit Contractor</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
          <div><span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Accepted Bids</span><p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "2px 0 0" }}>{fmt(totalAccepted)}</p></div>
          <div><span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Pending Bids</span><p style={{ fontSize: 18, fontWeight: 700, color: "#e95e00", margin: "2px 0 0" }}>{fmt(totalPending)}</p></div>
          <div><span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Paid</span><p style={{ fontSize: 18, fontWeight: 700, color: "var(--c-green)", margin: "2px 0 0" }}>{fmt(totalPaidAmt)}</p></div>
          <div><span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Outstanding</span><p style={{ fontSize: 18, fontWeight: 700, color: totalAccepted - totalPaidAmt > 0 ? "var(--c-red)" : "var(--c-green)", margin: "2px 0 0" }}>{fmt(totalAccepted - totalPaidAmt)}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--surface-alt)", borderRadius: 12, padding: 4, border: "1px solid var(--border-subtle)" }}>
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: "none", background: active ? "var(--surface)" : "transparent", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none", color: active ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: active ? 600 : 500, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
              <Icon size={15} />{tab.label}
              {tab.count !== undefined && <span style={{ background: active ? "var(--surface-muted)" : "var(--surface-muted)", borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>{tab.count}</span>}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Contact & License Info</h3>
          </div>
          {editMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Company / Name</p><input style={iS} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Trade</p><input style={iS} value={editForm.trade} onChange={e => setEditForm(f => ({ ...f, trade: e.target.value }))} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Phone</p><input style={iS} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Email</p><input style={iS} value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>License #</p><input style={iS} value={editForm.license} onChange={e => setEditForm(f => ({ ...f, license: e.target.value }))} placeholder="e.g. PL-2024-1847" /></div>
                <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Insurance Expiry</p><input type="date" style={iS} value={editForm.insuranceExpiry} onChange={e => setEditForm(f => ({ ...f, insuranceExpiry: e.target.value }))} /></div>
              </div>
              <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Notes</p><textarea style={{ ...iS, minHeight: 80, resize: "vertical" }} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes about this contractor..." /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={saveOverview} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Save</button>
                <button onClick={() => setEditMode(false)} style={{ padding: "10px 20px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Phone size={14} color="var(--text-muted)" /><span style={{ fontSize: 13, color: "var(--text-primary)" }}>{con.phone || "—"}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Mail size={14} color="var(--text-muted)" /><span style={{ fontSize: 13, color: "var(--text-primary)" }}>{con.email || "—"}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Shield size={14} color="var(--text-muted)" /><span style={{ fontSize: 13, color: "var(--text-primary)" }}>License: {con.license || "—"}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><FileCheck size={14} color="var(--text-muted)" /><span style={{ fontSize: 13, color: con.insuranceExpiry && con.insuranceExpiry < new Date().toISOString().slice(0, 10) ? "var(--c-red)" : "var(--text-primary)" }}>Insurance: {con.insuranceExpiry || "—"}{con.insuranceExpiry && con.insuranceExpiry < new Date().toISOString().slice(0, 10) ? " (EXPIRED)" : ""}</span></div>
              {con.notes && <div style={{ gridColumn: "1/-1", marginTop: 8, padding: 14, background: "var(--surface-alt)", borderRadius: 10, fontSize: 13, color: "var(--text-label)", lineHeight: 1.5 }}>{con.notes}</div>}
            </div>
          )}
        </div>
      )}

      {/* BIDS TAB */}
      {activeTab === "bids" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>All Bids</h3>
            <button onClick={() => {
              // Pre-select this contractor's deal if they're on exactly one
              const firstDealId = (con.dealIds && con.dealIds.length > 0) ? String(con.dealIds[0]) : "";
              setBidForm({ dealId: firstDealId, rehabItem: "", amount: "" });
              setEditingBidId(null);
              setShowBidModal(true);
            }} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Add Bid</button>
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
            {bids.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No bids yet. Add a bid to get started.</div>}
            {bids.map((b, i) => {
              const fl = _DEALS.find(f => f.id === b.dealId);
              return (
                <div key={b.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < bids.length - 1 ? "1px solid var(--border-subtle)" : "none", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    {fl && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1e3a5f", flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{b.rehabItem}</span>
                    {fl && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {fl.name}</span>}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", minWidth: 80, textAlign: "right" }}>{fmt(b.amount)}</span>
                  <button onClick={(e) => { e.stopPropagation(); toggleBidStatus(b.id); }}
                    style={{ background: b.status === "accepted" ? "#cce8d8" : "#fff7ed", color: b.status === "accepted" ? "#1a7a4a" : "#9a3412", border: "none", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", minWidth: 70 }}>
                    {b.status === "accepted" ? "Accepted" : "Pending"}
                  </button>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 80 }}>{b.date}</span>
                  <button onClick={(e) => { e.stopPropagation(); openEditBid(b); }} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: "bid", id: b.id, label: b.rehabItem }); }} style={{ background: "#f5d0cc", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DOCUMENTS TAB */}
      {activeTab === "documents" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Documents</h3>
            <button onClick={() => setShowDocModal(true)} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Upload size={14} /> Add Document</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {documents.length === 0 && <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No documents yet.</div>}
            {documents.map(d => {
              const fl = d.dealId ? _DEALS.find(f => f.id === d.dealId) : null;
              const typeColor = DOC_COLORS[d.type] || "var(--text-secondary)";
              return (
                <div key={d.id} style={{ background: "var(--surface)", borderRadius: 12, padding: 16, border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <FileText size={16} color={typeColor} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openEditDoc(d)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteConfirm({ type: "doc", id: d.id, label: d.name })} style={{ background: "#f5d0cc", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ background: `${typeColor}15`, color: typeColor, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{DOC_TYPES[d.type] || d.type}</span>
                    {fl && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#1e3a5f" }} />{fl.name}</span>}
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.date}</span>
                    {d.size && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.size}</span>}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DEAL HISTORY TAB */}
      {activeTab === "history" && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Deal History</h3>
          {deals.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>No deals assigned yet.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {deals.map(fl => {
              const dealBids = bids.filter(b => b.dealId === fl.id);
              const dealPayments = payments.filter(p => p.dealId === fl.id);
              const dealDocs = documents.filter(d => d.dealId === fl.id);
              const dealBidTotal = dealBids.reduce((s, b) => s + b.amount, 0);
              const dealPaidTotal = dealPayments.reduce((s, p) => s + p.amount, 0);
              const stageStyle = STAGE_COLORS[fl.stage] || { bg: "#f1f5f9", text: "var(--text-secondary)" };
              return (
                <div key={fl.id} style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#1e3a5f" }} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{fl.name}</span>
                      <span style={{ background: stageStyle.bg, color: stageStyle.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{fl.stage}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
                    <div><span style={{ color: "var(--text-muted)" }}>Bids: </span><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{fmt(dealBidTotal)} ({dealBids.length})</span></div>
                    <div><span style={{ color: "var(--text-muted)" }}>Paid: </span><span style={{ fontWeight: 600, color: "var(--c-green)" }}>{fmt(dealPaidTotal)}</span></div>
                    <div><span style={{ color: "var(--text-muted)" }}>Docs: </span><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{dealDocs.length}</span></div>
                  </div>
                  {dealPayments.length > 0 && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payments ({dealPayments.length})</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Total <span style={{ fontWeight: 700, color: "var(--c-green)" }}>{fmt(dealPaidTotal)}</span></span>
                      </div>
                      <div style={{ background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border-subtle)", padding: "4px 12px" }}>
                        {dealPayments.map((p, i) => (
                          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", fontSize: 13, borderBottom: i < dealPayments.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#cce8d8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <DollarSign size={14} color="var(--c-green)" />
                              </div>
                              <div>
                                <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}>{p.note || "Payment"}</p>
                                <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{p.date}</p>
                              </div>
                            </div>
                            <span style={{ fontWeight: 700, color: "var(--c-green)", fontSize: 14 }}>{fmt(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Bid Modal */}
      {showBidModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>{editingBidId ? "Edit Bid" : "Add Bid"}</h2>
              <button onClick={() => { setShowBidModal(false); setEditingBidId(null); setBidForm({ dealId: "", rehabItem: "", amount: "" }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(() => {
                // Prefer deals this contractor is attached to; fall back to all active
                // deals only when the contractor has no linked deals yet.
                const conDealIds = new Set(con.dealIds || []);
                const myDeals = _DEALS.filter(f => conDealIds.has(f.id) && f.stage !== "Sold");
                const otherDeals = _DEALS.filter(f => !conDealIds.has(f.id) && f.stage !== "Sold");
                // When contractor has exactly 1 linked active deal (and no editing), skip the picker
                const onlyOne = myDeals.length === 1 && !editingBidId;
                if (onlyOne) {
                  if (bidForm.dealId !== String(myDeals[0].id)) {
                    // auto-seed on first render — safe because effect happens outside render
                    setTimeout(() => setBidForm(f => f.dealId === String(myDeals[0].id) ? f : { ...f, dealId: String(myDeals[0].id) }), 0);
                  }
                  return (
                    <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Deal</p>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{myDeals[0].name}</p>
                    </div>
                  );
                }
                return (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Deal *</p>
                    <select style={iS} value={bidForm.dealId} onChange={e => setBidForm(f => ({ ...f, dealId: e.target.value, rehabItem: "" }))}>
                      <option value="">Select deal...</option>
                      {myDeals.length > 0 && (
                        <optgroup label={`${con.name}'s Deals`}>
                          {myDeals.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </optgroup>
                      )}
                      {otherDeals.length > 0 && (
                        <optgroup label="Other Active Deals">
                          {otherDeals.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>
                );
              })()}
              <div style={{ position: "relative" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Rehab Item *</p>
                <input style={iS} placeholder={bidForm.dealId ? "Start typing or pick from the list..." : "Select a deal first"} disabled={!bidForm.dealId}
                  value={bidForm.rehabItem} onChange={e => { setBidForm(f => ({ ...f, rehabItem: e.target.value })); setRehabFocus(true); }}
                  onFocus={() => setRehabFocus(true)} onBlur={() => setTimeout(() => setRehabFocus(false), 150)} />
                {!rehabFocus && !bidForm.rehabItem && bidForm.dealId && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>Pick a standard category or type your own</p>}
                {rehabFocus && bidForm.dealId && (() => {
                  const q = bidForm.rehabItem.toLowerCase().trim();
                  const canonMatches = REHAB_CATEGORIES.filter(c => !q || c.label.toLowerCase().includes(q));
                  // Items already on this deal that aren't canonical → "On This Deal"
                  const dealLabels = bidRehabOptions.filter(c => !REHAB_CATEGORIES.some(cc => cc.label === c));
                  const dealCustomMatches = dealLabels.filter(c => !q || c.toLowerCase().includes(q));
                  const exactCanon = REHAB_CATEGORIES.some(c => c.label.toLowerCase() === q);
                  const exactCustom = dealCustomMatches.some(c => c.toLowerCase() === q);
                  const showNew = q && !exactCanon && !exactCustom;
                  const grouped = {};
                  canonMatches.forEach(c => { if (!grouped[c.group]) grouped[c.group] = []; grouped[c.group].push(c); });
                  const groupKeys = REHAB_CATEGORY_GROUPS.filter(g => grouped[g] && grouped[g].length > 0);
                  if (groupKeys.length === 0 && dealCustomMatches.length === 0 && !showNew) return null;
                  return (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
                      {dealCustomMatches.length > 0 && (
                        <div>
                          <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" }}>On This Deal</div>
                          {dealCustomMatches.slice(0, 6).map(c => (
                            <button key={c} onMouseDown={() => { setBidForm(f => ({ ...f, rehabItem: c })); setRehabFocus(false); }}
                              style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                              <Wrench size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                              <span>{c}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {groupKeys.map(g => (
                        <div key={g}>
                          <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" }}>{g}</div>
                          {grouped[g].map(c => (
                            <button key={c.slug} onMouseDown={() => { setBidForm(f => ({ ...f, rehabItem: c.label })); setRehabFocus(false); }}
                              style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                              <Wrench size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                              <span>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                      {showNew && (
                        <button onMouseDown={() => setRehabFocus(false)}
                          style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "#fff7ed", border: "none", borderTop: "1px solid var(--border)", cursor: "pointer", textAlign: "left" }}>
                          <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{bidForm.rehabItem}&rdquo; as custom</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Bid Amount ($) *</p>
                <input type="number" style={iS} placeholder="0" value={bidForm.amount} onChange={e => setBidForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveBid} disabled={!bidForm.dealId || !bidForm.rehabItem || !bidForm.amount} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: !bidForm.dealId || !bidForm.rehabItem || !bidForm.amount ? "var(--surface-muted)" : "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: !bidForm.dealId || !bidForm.rehabItem || !bidForm.amount ? "not-allowed" : "pointer" }}>{editingBidId ? "Save Changes" : "Add Bid"}</button>
              <button onClick={() => { setShowBidModal(false); setEditingBidId(null); setBidForm({ dealId: "", rehabItem: "", amount: "" }); }} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {showDocModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>{editingDocId ? "Edit Document" : "Add Document"}</h2>
              <button onClick={() => { setShowDocModal(false); setEditingDocId(null); setDocForm({ name: "", type: "contract", dealId: "" }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Document Name *</p><input style={iS} placeholder="e.g. Plumbing Contract" value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Type</p>
                  <select style={iS} value={docForm.type} onChange={e => setDocForm(f => ({ ...f, type: e.target.value }))}>
                    {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Associated Deal <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></p>
                  <select style={iS} value={docForm.dealId} onChange={e => setDocForm(f => ({ ...f, dealId: e.target.value }))}>
                    <option value="">General (no deal)</option>
                    {_DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveDoc} disabled={!docForm.name.trim()} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: !docForm.name.trim() ? "var(--surface-muted)" : "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: !docForm.name.trim() ? "not-allowed" : "pointer" }}>{editingDocId ? "Save Changes" : "Add Document"}</button>
              <button onClick={() => { setShowDocModal(false); setEditingDocId(null); setDocForm({ name: "", type: "contract", dealId: "" }); }} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, width: 400, padding: 28 }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Delete {deleteConfirm.type === "bid" ? "Bid" : "Document"}</h2>
            <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 18 }}>Remove &ldquo;{deleteConfirm.label}&rdquo;? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteConfirm.type === "bid" ? deleteBid(deleteConfirm.id) : deleteDoc(deleteConfirm.id)} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. DEAL ANALYTICS
// ---------------------------------------------------------------------------
export function DealAnalytics() {
  const [filterDeal, setFilterDeal] = useState("all");

  const allDeals = _DEALS;
  const deals = allDeals;
  const sold  = deals.filter(f => f.stage === "Sold");

  const roiData = deals.map(f => {
    const cost = f.purchasePrice + (f.stage === "Sold" ? f.rehabSpent : f.rehabBudget);
    const sale = f.stage === "Sold" ? f.salePrice : f.arv;
    const profit = sale - cost - (f.stage === "Sold" ? f.sellingCosts + f.totalHoldingCosts : (sale * ((f.sellingCostPct || 6) / 100)) + (f.holdingCostsPerMonth * (f.daysOwned || 0) / 30));
    const roi = cost > 0 ? ((profit / cost) * 100).toFixed(1) : 0;
    return { name: f.image, fullName: f.name, roi: parseFloat(roi), profit: Math.round(profit), stage: f.stage, color: parseFloat(roi) >= 0 ? "var(--c-green)" : "var(--c-red)" };
  });

  const budgetVsActual = deals.filter(f => f.rehabSpent > 0).map(f => ({
    name: f.image, fullName: f.name, budget: f.rehabBudget, actual: f.rehabSpent,
    variance: f.rehabBudget - f.rehabSpent,
  }));

  const timelineData = deals.filter(f => f.daysOwned > 0).map(f => ({
    name: f.image, fullName: f.name, days: f.daysOwned, stage: f.stage, color: "#1e3a5f",
  }));

  const dealIdSet = new Set(deals.map(f => f.id));
  const catSpend = _FE.filter(e => dealIdSet.has(e.dealId)).reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const catChartData = Object.entries(catSpend).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const COLORS = ["#e95e00", "var(--c-blue)", "var(--c-green)", "var(--c-purple)", "var(--c-red)", "#06b6d4"];

  // Monthly expense trend – group all deal expenses by month
  // (plain expression so it stays in sync with _FE mutations, matching catSpend above)
  const monthlyTrend = (() => {
    const filtered = _FE.filter(e => dealIdSet.has(e.dealId));
    const byMonth = {};
    filtered.forEach(e => {
      const m = e.date?.substring(0, 7); // "2026-03"
      if (m) byMonth[m] = (byMonth[m] || 0) + e.amount;
    });
    return Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => {
      const [y, m] = month.split("-");
      const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      return { month: label, total };
    });
  })();

  // Profit breakdown per deal – stacked components
  const profitBreakdown = deals.map(f => {
    const purchase = f.purchasePrice;
    const rehab = f.stage === "Sold" ? f.rehabSpent : f.rehabBudget;
    const holding = f.stage === "Sold" ? f.totalHoldingCosts : (f.holdingCostsPerMonth * ((f.daysOwned || 0) / 30));
    const selling = f.stage === "Sold" ? f.sellingCosts : ((f.stage === "Sold" ? f.salePrice : f.arv) * ((f.sellingCostPct || 6) / 100));
    const sale = f.stage === "Sold" ? f.salePrice : f.arv;
    const totalCost = purchase + rehab + holding + selling;
    const profit = sale - totalCost;
    const margin = sale > 0 ? ((profit / sale) * 100).toFixed(1) : 0;
    return { name: f.image, fullName: f.name, purchase, rehab, holding: Math.round(holding), selling: Math.round(selling), profit: Math.round(profit), totalCost: Math.round(totalCost), sale: Math.round(sale), margin, color: f.color, stage: f.stage };
  });

  const avgROI    = roiData.length ? (roiData.reduce((s, d) => s + d.roi, 0) / roiData.length).toFixed(1) : 0;
  const avgDays   = timelineData.length ? Math.round(timelineData.reduce((s, d) => s + d.days, 0) / timelineData.length) : 0;
  const totalProfit = sold.reduce((s, f) => s + (f.netProfit || 0), 0);

  // Single-deal mode
  const singleDeal = filterDeal !== "all" ? allDeals.find(f => f.id === parseInt(filterDeal)) : null;

  // Single-deal computed data
  const dealExpenses = singleDeal ? _FE.filter(e => e.dealId === singleDeal.id).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const dealCatSpend = singleDeal ? dealExpenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {}) : {};
  const dealCatChart = Object.entries(dealCatSpend).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Cumulative spend curve for single deal
  // (plain expression — useMemo here was a no-op since dealExpenses is a new ref every render)
  const spendCurve = (() => {
    if (!singleDeal || dealExpenses.length === 0) return [];
    let cumulative = 0;
    return dealExpenses.map(e => {
      cumulative += e.amount;
      const d = new Date(e.date);
      return { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), spent: cumulative, budget: singleDeal.rehabBudget };
    });
  })();

  // Single-deal scorecard metrics
  const dealROI = singleDeal ? roiData.find(r => r.fullName === singleDeal.name) : null;
  const dealHolding = singleDeal ? (singleDeal.stage === "Sold" ? singleDeal.totalHoldingCosts : Math.round(singleDeal.holdingCostsPerMonth * ((singleDeal.daysOwned || 0) / 30))) : 0;
  const dealCostPerDay = singleDeal && singleDeal.daysOwned > 0 ? Math.round((singleDeal.rehabSpent + dealHolding) / singleDeal.daysOwned) : 0;

  // Rehab item progress for single deal
  const rehabProgress = singleDeal ? (singleDeal.rehabItems || []).map(item => ({
    name: item.category.length > 14 ? item.category.substring(0, 14) + "..." : item.category,
    fullName: item.category,
    budgeted: item.budgeted,
    spent: item.spent,
    pct: item.budgeted > 0 ? Math.round((item.spent / item.budgeted) * 100) : 0,
    status: item.status,
  })) : [];

  const cardS = sharedCardS;


  return (
    <div>
      {/* Header — matches rental Analytics pattern */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Analytics</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            {singleDeal ? `Performance details — ${singleDeal.name}` : "Performance metrics across all deals"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={filterDeal} onChange={e => setFilterDeal(e.target.value)} style={{ ...iS, width: 220, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Deals</option>
            {allDeals.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>

      {/* ======== SINGLE-DEAL VIEW ======== */}
      {singleDeal ? (<>
        {/* Deal Return Scorecard — matches rental property scorecard */}
        <div style={{ ...sectionS, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>{singleDeal.image}</div>
            <div>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Deal Scorecard</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {singleDeal.address}</p>
            </div>
            <div style={{ marginLeft: "auto" }}><StageDot stage={singleDeal.stage} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
            {[
              { label: "Projected ROI", value: `${dealROI?.roi || 0}%`, color: "var(--c-green)", sub: singleDeal.stage === "Sold" ? "Realized return" : "Estimated return", tip: "Return on Investment = (Sale Price \u2212 Total Cost) \u00f7 Total Cost \u00d7 100. Total Cost includes purchase, rehab, holding, and selling costs." },
              { label: "Projected Profit", value: fmt(dealROI?.profit || 0), color: "var(--c-purple)", sub: singleDeal.stage === "Sold" ? "Realized" : "Based on ARV", tip: "ARV (or Sale Price) minus all costs: purchase price, rehab, holding costs, and estimated 6% selling costs." },
              { label: "Cost Per Day", value: dealCostPerDay > 0 ? `${fmt(dealCostPerDay)}/day` : "N/A", color: "#e95e00", sub: `${singleDeal.daysOwned || 0} days owned`, tip: "Total spend (rehab + holding costs) divided by days owned. Helps quantify the daily burn rate on this deal." },
            ].map((m, i) => (
              <div key={i} style={{ background: "var(--surface-alt)", borderRadius: 14, padding: "18px 16px", border: "1px solid var(--border-subtle)" }}>
                <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                <p style={{ color: m.color, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{m.value}</p>
                <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{m.sub}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              { label: "Purchase Price", value: fmt(singleDeal.purchasePrice), tip: "Original acquisition price at closing." },
              { label: "Rehab Budget", value: fmt(singleDeal.rehabBudget), tip: "Total planned renovation budget across all line items." },
              { label: "ARV / Sale", value: fmt(singleDeal.stage === "Sold" ? singleDeal.salePrice : singleDeal.arv), tip: singleDeal.stage === "Sold" ? "Actual sale price at closing." : "After Repair Value \u2014 estimated market value once rehab is complete." },
              { label: "Holding Costs", value: fmt(dealHolding), tip: "Monthly holding cost \u00d7 months owned. Includes mortgage, insurance, taxes, and utilities while you hold the property." },
              { label: "Total Invested", value: fmt(singleDeal.purchasePrice + singleDeal.rehabSpent + dealHolding), tip: "Purchase price + rehab spent to date + holding costs accrued. This is your total cash outlay so far." },
            ].map(item => (
              <div key={item.label} style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", margin: 0, display: "flex", alignItems: "center" }}>{item.label}<InfoTip text={item.tip} /></p>
                <p style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, margin: "4px 0 0" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Cumulative Spend Curve */}
          <div style={sectionS}>
            <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Rehab Spend Curve</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Cumulative spend vs budget over time</p>
            {spendCurve.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={spendCurve}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e95e00" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#e95e00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => fmt(v)} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
                  <ReferenceLine y={singleDeal.rehabBudget} stroke="var(--c-red)" strokeDasharray="6 4" label={{ value: "Budget", position: "right", fontSize: 11, fill: "var(--c-red)" }} />
                  <Area type="monotone" dataKey="spent" stroke="#e95e00" strokeWidth={2.5} fill="url(#spendGrad)" dot={{ fill: "#e95e00", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>No expenses recorded yet</div>
            )}
          </div>

          {/* Expense Category Breakdown (single deal) */}
          <div style={sectionS}>
            <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cost Breakdown</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Expenses by category</p>
            {dealCatChart.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={dealCatChart} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                      {dealCatChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {dealCatChart.map((d, i) => (
                    <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>No expenses recorded yet</div>
            )}
          </div>
        </div>

        {/* Rehab Item Progress */}
        <div style={{ ...sectionS, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Rehab Item Progress</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Budget consumed per line item</p>
            </div>
            {rehabProgress.length > 0 && (() => {
              const done = rehabProgress.filter(r => r.status === "complete").length;
              const over = rehabProgress.filter(r => r.pct > 100).length;
              return (
                <div style={{ display: "flex", gap: 16 }}>
                  {[
                    { color: "var(--c-green)", label: `${done} Complete` },
                    { color: "#e95e00", label: `${rehabProgress.length - done - over} In Progress` },
                    ...(over > 0 ? [{ color: "var(--c-red)", label: `${over} Over Budget` }] : []),
                  ].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          {rehabProgress.length > 0 ? (
            <div style={{ display: "grid", gap: 14 }}>
              {rehabProgress.map((item, i) => {
                const overBudget = item.pct > 100;
                const barColor = item.status === "complete" ? "var(--c-green)" : overBudget ? "var(--c-red)" : "#e95e00";
                const statusIcon = item.status === "complete" ? CheckCircle : item.status === "in-progress" ? Clock : AlertCircle;
                const StatusIcon = statusIcon;
                const remaining = item.budgeted - item.spent;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Status icon + category name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, width: 160, flexShrink: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: item.status === "complete" ? "#cce8d8" : item.status === "in-progress" ? "#ffedd5" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <StatusIcon size={13} color={item.status === "complete" ? "#16a34a" : item.status === "in-progress" ? "#d97706" : "var(--text-muted)"} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.fullName}>{item.fullName}</p>
                        <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize" }}>{item.status.replace("-", " ")}</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", height: 24, background: "var(--surface-alt)", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                        <div style={{ width: `${Math.min(item.pct, 100)}%`, height: "100%", background: barColor, borderRadius: 6, transition: "width 0.3s", minWidth: item.pct > 0 ? 2 : 0 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmt(item.spent)} of {fmt(item.budgeted)}</span>
                        <span style={{ fontSize: 10, color: overBudget ? "var(--c-red)" : "var(--text-muted)", fontWeight: overBudget ? 600 : 400 }}>
                          {overBudget ? `${fmt(Math.abs(remaining))} over` : remaining > 0 ? `${fmt(remaining)} left` : "On budget"}
                        </span>
                      </div>
                    </div>
                    {/* Percentage */}
                    <div style={{ width: 56, textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: barColor, lineHeight: 1 }}>{item.pct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No rehab items configured</div>
          )}
        </div>

        {/* Expense Log */}
        <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Expense Log</h3>
          </div>
          {dealExpenses.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)" }}>
                  {["Date", "Paid To", "Category", "Description", "Amount"].map(h => (
                    <th key={h} style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "10px 16px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealExpenses.map(e => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "10px 16px", color: "var(--text-secondary)", fontSize: 13 }}>{new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td style={{ padding: "10px 16px", color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>{e.vendor}</td>
                    <td style={{ padding: "10px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "var(--surface-muted)", color: "var(--text-secondary)" }}>{e.category}</span></td>
                    <td style={{ padding: "10px 16px", color: "var(--text-secondary)", fontSize: 13 }}>{e.description}</td>
                    <td style={{ padding: "10px 16px", color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No expenses recorded for this deal</div>
          )}
        </div>
      </>) : (<>

      {/* ======== PORTFOLIO VIEW ======== */}
      {/* KPI cards with InfoTips — matches rental Analytics pattern */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Avg ROI", value: `${avgROI}%`, color: "var(--c-green)", sub: "All deals", tip: "Average Return on Investment across all deals. ROI = (Sale/ARV \u2212 Total Cost) \u00f7 Total Cost \u00d7 100. Active deals use projected ARV and estimated costs." },
          { label: "Avg Hold Time", value: `${avgDays} days`, color: "var(--c-blue)", sub: "Active deals", tip: "Average number of days properties have been owned. Shorter hold times mean less carrying cost and faster capital recycling." },
          { label: "Total Realized", value: fmt(totalProfit), color: "var(--c-purple)", sub: "Closed deals", tip: "Sum of net profit from all sold deals. Net Profit = Sale Price \u2212 Purchase Price \u2212 Rehab Spent \u2212 Holding Costs \u2212 Selling Costs." },
          { label: "Deals Analyzed", value: deals.length, color: "#e95e00", sub: `${sold.length} closed`, tip: "Total number of deals in your pipeline. Includes active, listed, under contract, and sold properties." },
        ].map((m, i) => (
          <div key={i} style={{ ...cardS, textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: "var(--text-primary)", fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
            <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 6 }}>{m.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* ROI by Deal */}
        <div style={sectionS}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>ROI by Deal</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Actual (sold) vs projected (active)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={roiData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v, n, p) => [`${v}%`, "ROI"]} labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
              <Bar dataKey="roi" radius={[6, 6, 0, 0]}>
                {roiData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Category Breakdown */}
        <div style={sectionS}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Expense Breakdown</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>By category across all deals</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={catChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                  {catChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {catChartData.map((d, i) => (
                <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{fmt(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Budget vs Actual */}
      <div style={sectionS}>
        <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Rehab Budget vs Actual</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>How well rehab budgets are holding</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={budgetVsActual}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
            <Tooltip formatter={v => fmt(v)} labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
            <Legend />
            <Bar dataKey="budget" fill="var(--chart-bar-primary)" name="Budgeted" radius={[6, 6, 0, 0]} />
            <Bar dataKey="actual" fill="#e95e00" name="Actual"   radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Hold Time by Deal */}
        <div style={sectionS}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Hold Time by Deal</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Days owned per property{avgDays > 0 ? ` (avg ${avgDays}d)` : ""}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timelineData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}d`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={v => [`${v} days`, "Hold Time"]} labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
              <Bar dataKey="days" radius={[0, 6, 6, 0]}>
                {timelineData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Expense Trend */}
        <div style={sectionS}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Monthly Expense Trend</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Total spend by month</p>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={v => [fmt(v), "Spent"]} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
                <Line type="monotone" dataKey="total" stroke="#e95e00" strokeWidth={2.5} dot={{ fill: "#e95e00", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>No expense data available</div>
          )}
        </div>
      </div>

      {/* Profit Breakdown by Deal */}
      <div style={sectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Profit Breakdown by Deal</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Cost components vs sale price — hover segments for details</p>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { color: "var(--c-blue)", label: "Purchase" },
              { color: "#e95e00", label: "Rehab" },
              { color: "var(--c-purple)", label: "Holding" },
              { color: "var(--text-muted)", label: "Selling" },
              { color: "var(--c-green)", label: "Profit" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {profitBreakdown.map((d, i) => {
            const maxVal = Math.max(...profitBreakdown.map(x => x.sale));
            const segments = [
              { key: "purchase", value: d.purchase, color: "var(--c-blue)", label: "Purchase" },
              { key: "rehab", value: d.rehab, color: "#e95e00", label: "Rehab" },
              { key: "holding", value: d.holding, color: "var(--c-purple)", label: "Holding" },
              { key: "selling", value: d.selling, color: "var(--text-muted)", label: "Selling" },
            ];
            const profitPct = maxVal > 0 ? (Math.max(d.profit, 0) / maxVal) * 100 : 0;
            const costPct = maxVal > 0 ? (d.totalCost / maxVal) * 100 : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, width: 120, flexShrink: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>{d.image}</div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>{d.fullName.split(" ")[0]}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.stage}</p>
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 2, height: 28, background: "var(--surface-alt)", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                  {segments.map(seg => {
                    const pct = maxVal > 0 ? (seg.value / maxVal) * 100 : 0;
                    if (pct < 0.5) return null;
                    return (
                      <div key={seg.key} title={`${seg.label}: ${fmt(seg.value)}`} style={{ width: `${pct}%`, height: "100%", background: seg.color, transition: "width 0.3s", cursor: "default", minWidth: pct > 0 ? 2 : 0 }} />
                    );
                  })}
                  {d.profit > 0 && (
                    <div title={`Net Profit: ${fmt(d.profit)}`} style={{ width: `${profitPct}%`, height: "100%", background: "var(--c-green)", borderRadius: "0 6px 6px 0", transition: "width 0.3s", cursor: "default", minWidth: 2 }} />
                  )}
                </div>
                <div style={{ width: 100, textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: d.profit > 0 ? "var(--c-green)" : "var(--c-red)" }}>{fmt(d.profit)}</span>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{d.margin}% margin</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deal Summary Table */}
      <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Deal Summary</h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["Deal", "Stage", "Purchase", "Rehab Budget", "ARV / Sale", "Proj. Profit", "ROI"].map(h => (
                <th key={h} style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "10px 16px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roiData.map((d, i) => {
              const deal = deals[i];
              return (
                <tr key={deal.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>{deal.image}</div>
                      <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{deal.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}><StageDot stage={deal.stage} /></td>
                  <td style={{ padding: "12px 16px", color: "var(--text-primary)", fontSize: 13 }}>{fmt(deal.purchasePrice)}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-primary)", fontSize: 13 }}>{fmt(deal.rehabBudget)}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-primary)", fontSize: 13 }}>{fmt(deal.stage === "Sold" ? deal.salePrice : deal.arv)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ color: d.profit > 0 ? "var(--c-green)" : "var(--c-red)", fontWeight: 700, fontSize: 13 }}>{fmt(d.profit)}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ color: d.roi > 0 ? "var(--c-green)" : "var(--c-red)", fontWeight: 700, fontSize: 13 }}>{d.roi}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. MILESTONES (cross-deal view)
// ---------------------------------------------------------------------------
export function DealMilestones({ highlightMilestoneKey, onBack, onClearHighlight }) {
  const [filterDeal, setFilterDeal] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [renderKey, rerender] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [msForm, setMsForm] = useState({ dealId: "", label: "", targetDate: "" });
  const [editItem, setEditItem] = useState(null); // { dealId, idx }
  const [editForm, setEditForm] = useState({ label: "", targetDate: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { dealId, idx, label }
  const [labelFocus, setLabelFocus] = useState(false);
  const [flashKey, setFlashKey] = useState(highlightMilestoneKey);

  useEffect(() => {
    if (highlightMilestoneKey) {
      setFlashKey(highlightMilestoneKey);
      // If the highlighted milestone is completed, set filter to show completed items
      const [hDealId, ...hLabelParts] = highlightMilestoneKey.split("-");
      const hLabel = hLabelParts.join("-");
      const dealMs = DEAL_MILESTONES.filter(m => m.dealId === parseInt(hDealId));
      const targetMs = dealMs.find(m => m.label === hLabel);
      if (targetMs?.done && filterStatus === "upcoming") setFilterStatus("all");
      setTimeout(() => {
        const el = document.getElementById("ms-" + highlightMilestoneKey);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
      const timer = setTimeout(() => { setFlashKey(null); onClearHighlight && onClearHighlight(); }, 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightMilestoneKey]); // eslint-disable-line react-hooks/exhaustive-deps -- onClearHighlight is inline parent callback; filterStatus is read once on highlight by design
  const allMilestoneLabels = useMemo(() => {
    const labels = new Set(DEFAULT_MILESTONES);
    DEAL_MILESTONES.forEach(m => { if (m.label) labels.add(m.label); });
    return [...labels].sort();
  }, [renderKey]); // eslint-disable-line react-hooks/exhaustive-deps -- renderKey is the cache-bust counter for DEAL_MILESTONES

  // Build flat list of all milestones across deals
  const allMilestones = useMemo(() => {
    const list = [];
    _DEALS.forEach(f => {
      const ms = DEAL_MILESTONES.filter(m => m.dealId === f.id) || DEFAULT_MILESTONES.map(label => ({ label, done: false, date: null, targetDate: null }));
      ms.forEach((m, idx) => {
        list.push({ ...m, dealId: f.id, dealName: f.name, dealColor: f.color, dealImage: f.image, dealStage: f.stage, _idx: idx });
      });
    });
    return list;
  }, [renderKey]); // eslint-disable-line react-hooks/exhaustive-deps -- renderKey is the cache-bust counter for _DEALS/DEAL_MILESTONES

  const filtered = allMilestones.filter(m => {
    if (filterDeal !== "all" && m.dealId !== parseInt(filterDeal)) return false;
    if (filterStatus === "done" && !m.done) return false;
    if (filterStatus === "upcoming" && m.done) return false;
    if (filterStatus === "overdue" && (m.done || !m.targetDate || m.targetDate >= new Date().toISOString().split("T")[0])) return false;
    return true;
  });

  const totalDone = filtered.filter(m => m.done).length;
  const totalUpcoming = filtered.filter(m => !m.done).length;
  const today = new Date().toISOString().split("T")[0];
  const totalOverdue = filtered.filter(m => !m.done && m.targetDate && m.targetDate < today).length;

  const clearFilters = () => { setFilterDeal("all"); setFilterStatus("all"); };
  const hasFilters = filterDeal !== "all" || filterStatus !== "all";

  // Inline completion date picker state
  const [completingItem, setCompletingItem] = useState(null); // { dealId, idx }
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split("T")[0]);

  const startComplete = (dealId, idx) => {
    setCompletingItem({ dealId, idx });
    setCompletionDate(new Date().toISOString().split("T")[0]);
  };

  const confirmComplete = () => {
    if (!completingItem) return;
    const ms = DEAL_MILESTONES.filter(m => m.dealId === completingItem.dealId);
    if (ms && ms[completingItem.idx]) {
      ms[completingItem.idx].done = true;
      ms[completingItem.idx].date = completionDate;
    }
    setCompletingItem(null);
    rerender(n => n + 1);
  };

  const uncomplete = (dealId, idx) => {
    const ms = DEAL_MILESTONES.filter(m => m.dealId === dealId);
    if (ms && ms[idx]) {
      ms[idx].done = false;
      ms[idx].date = null;
    }
    rerender(n => n + 1);
  };

  const saveMilestone = () => {
    const fId = parseInt(msForm.dealId);
    if (!fId || !msForm.label.trim()) return;
    DEAL_MILESTONES.push({ id: Date.now() + Math.random(), dealId: fId, label: msForm.label.trim(), done: false, date: null, targetDate: msForm.targetDate || null });
    setMsForm({ dealId: "", label: "", targetDate: "" });
    setShowAdd(false);
    rerender(n => n + 1);
  };

  const startEdit = (dealId, idx, m) => {
    setEditItem({ dealId, idx });
    setEditForm({ label: m.label, targetDate: m.targetDate || "", completedDate: m.date || "" });
  };

  const saveEdit = () => {
    if (!editItem) return;
    const ms = DEAL_MILESTONES.filter(m => m.dealId === editItem.dealId);
    if (ms && ms[editItem.idx]) {
      ms[editItem.idx].label = editForm.label.trim() || ms[editItem.idx].label;
      ms[editItem.idx].targetDate = editForm.targetDate || null;
      if (editForm.completedDate) {
        ms[editItem.idx].date = editForm.completedDate;
        ms[editItem.idx].done = true;
      } else {
        ms[editItem.idx].date = null;
        ms[editItem.idx].done = false;
      }
    }
    setEditItem(null);
    rerender(n => n + 1);
  };

  const deleteMilestone = () => {
    if (!deleteConfirm) return;
    const msIdx = DEAL_MILESTONES.findIndex(m => m.dealId === deleteConfirm.dealId && DEAL_MILESTONES.filter(x => x.dealId === deleteConfirm.dealId)[deleteConfirm.idx]?.id === m.id);
    if (msIdx !== -1) { DEAL_MILESTONES.splice(msIdx, 1); }
    setDeleteConfirm(null);
    rerender(n => n + 1);
  };

  // Group by deal for display
  const groupedByDeal = {};
  filtered.forEach(m => {
    if (!groupedByDeal[m.dealId]) groupedByDeal[m.dealId] = { deal: { id: m.dealId, name: m.dealName, color: m.dealColor, image: m.dealImage, stage: m.dealStage }, items: [] };
    groupedByDeal[m.dealId].items.push(m);
  });

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "#e95e00", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 14 }}>
          <ChevronLeft size={15} /> Back to Dashboard
        </button>
      )}
      <PageHeader
        title="Milestones"
        sub="Track progress across all your deals"
        filter={
          <select value={filterDeal} onChange={e => setFilterDeal(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Deals</option>
            {_DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={CheckCircle} label="Completed" value={totalDone} sub={`of ${filtered.length} total`} color="var(--c-green)" tip="Milestones marked as done across all deals." />
        <StatCard icon={Clock} label="Upcoming" value={totalUpcoming} sub="Not yet done" color="var(--c-blue)" tip="Milestones not yet completed and within their target date." />
        <StatCard icon={AlertCircle} label="Overdue" value={totalOverdue} sub="Past target date" color={totalOverdue > 0 ? "var(--c-red)" : "var(--text-muted)"} semantic tip="Milestones past their target date that haven't been completed." />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: hasFilters ? 10 : 20, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...iS, width: "auto", minWidth: 140, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All Statuses</option>
          <option value="done">Completed</option>
          <option value="upcoming">Upcoming</option>
          <option value="overdue">Overdue</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filter
          </button>
        )}
        <button onClick={() => setShowAdd(true)} style={{ marginLeft: "auto", background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Add Milestone
        </button>
      </div>

      {/* Grouped by deal */}
      {Object.values(groupedByDeal).length === 0 ? (
        <div style={{ ...sectionS, textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
          <Flag size={32} style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ fontWeight: 600, marginBottom: 4 }}>No milestones match your filters</p>
          {hasFilters && <button onClick={clearFilters} style={{ background: "none", border: "none", color: "#e95e00", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>}
        </div>
      ) : Object.values(groupedByDeal).map(({ deal, items }) => {
        const done = items.filter(m => m.done).length;
        const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
        return (
          <div key={deal.id} style={{ ...sectionS }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{deal.image}</div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{deal.name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{deal.stage}</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{pct}%</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{done} of {items.length}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ background: "var(--surface-muted)", borderRadius: 6, height: 6, marginBottom: 16, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--c-green)", borderRadius: 6, transition: "width 0.3s" }} />
            </div>
            {/* Milestone rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((m, i) => {
                const overdue = !m.done && m.targetDate && m.targetDate < today;
                const isEditing = editItem?.dealId === deal.id && editItem?.idx === m._idx;
                const isCompleting = completingItem?.dealId === deal.id && completingItem?.idx === m._idx;
                return isEditing ? (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "#fff7ed", border: "1px solid #fdba74" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <input value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} style={{ ...iS, flex: 1, padding: "6px 10px", fontSize: 13 }} placeholder="Milestone label" />
                      <button onClick={saveEdit} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                      <button onClick={() => setEditItem(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}><X size={14} /></button>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Target Date</p>
                        <input type="date" value={editForm.targetDate} onChange={e => setEditForm(f => ({ ...f, targetDate: e.target.value }))} style={{ ...iS, padding: "5px 10px", fontSize: 12, width: "100%" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Completed Date</p>
                        <input type="date" value={editForm.completedDate} onChange={e => setEditForm(f => ({ ...f, completedDate: e.target.value }))} style={{ ...iS, padding: "5px 10px", fontSize: 12, width: "100%" }} />
                      </div>
                    </div>
                  </div>
                ) : isCompleting ? (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#edf7f2", border: "1px solid #9fcfb4" }}>
                    <CheckCircle size={18} color="var(--c-green)" />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>{m.label}</span>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Completed:</span>
                    <input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)} style={{ ...iS, width: 140, padding: "5px 10px", fontSize: 12 }} />
                    <button onClick={confirmComplete} style={{ background: "var(--c-green)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Confirm</button>
                    <button onClick={() => setCompletingItem(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}><X size={14} /></button>
                  </div>
                ) : (
                  <div key={i} id={"ms-" + deal.id + "-" + m.label} className="ms-row" onMouseEnter={e => { if (flashKey !== (deal.id + "-" + m.label)) e.currentTarget.style.background = "var(--surface-alt)"; }} onMouseLeave={e => { if (flashKey !== (deal.id + "-" + m.label)) e.currentTarget.style.background = m.done ? "#edf7f2" : overdue ? "#faeeed" : "var(--surface-alt)"; }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 8, background: flashKey === (deal.id + "-" + m.label) ? "#fff7ed" : m.done ? "#edf7f2" : overdue ? "#faeeed" : "var(--surface-alt)", border: `1px solid ${flashKey === (deal.id + "-" + m.label) ? "#e95e00" : m.done ? "#9fcfb4" : overdue ? "#fecaca" : "var(--border-subtle)"}`, boxShadow: flashKey === (deal.id + "-" + m.label) ? "0 0 0 2px #e95e00" : "none", position: "relative", transition: "all 0.4s ease" }}>
                    <button onClick={() => m.done ? uncomplete(deal.id, m._idx) : startComplete(deal.id, m._idx)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
                      {m.done ? <CheckCircle size={18} color="var(--c-green)" /> : <Circle size={18} color={overdue ? "var(--c-red)" : "#cbd5e1"} />}
                    </button>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: m.done ? "#6b7280" : "var(--text-primary)", textDecoration: m.done ? "line-through" : "none" }}>{m.label}</span>
                    {m.targetDate && (
                      <span style={{ fontSize: 11, color: overdue ? "var(--c-red)" : "var(--text-muted)", fontWeight: overdue ? 600 : 400, flexShrink: 0 }}>
                        {overdue ? "Overdue: " : "Target: "}{new Date(m.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {m.done && m.date && (
                      <span style={{ fontSize: 11, color: "var(--c-green)", flexShrink: 0 }}>
                        {new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 4 }}>
                      <button onClick={() => startEdit(deal.id, m._idx, m)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteConfirm({ dealId: deal.id, idx: m._idx, label: m.label })} style={{ background: "#f5d0cc", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add Milestone Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>Add Milestone</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Deal *</p>
                <select value={msForm.dealId} onChange={e => setMsForm(f => ({ ...f, dealId: e.target.value }))} style={iS}>
                  <option value="">Select deal...</option>
                  {_DEALS.filter(f => f.stage !== "Sold").map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div style={{ position: "relative" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Milestone Name *</p>
                <input value={msForm.label} style={iS} placeholder="Start typing to search or add new..."
                  onChange={e => { setMsForm(f => ({ ...f, label: e.target.value })); setLabelFocus(true); }}
                  onFocus={() => setLabelFocus(true)} onBlur={() => setTimeout(() => setLabelFocus(false), 150)} />
                {!labelFocus && !msForm.label && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>Type to search previous milestones or add new</p>}
                {labelFocus && (() => {
                  const q = msForm.label.toLowerCase();
                  const matches = q ? allMilestoneLabels.filter(l => l.toLowerCase().includes(q) && l.toLowerCase() !== q) : allMilestoneLabels.slice(0, 6);
                  const exactExists = allMilestoneLabels.some(l => l.toLowerCase() === q);
                  const showNew = q && !exactExists;
                  if (matches.length === 0 && !showNew) return null;
                  return (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                      {matches.slice(0, 6).map(l => (
                        <button key={l} onMouseDown={() => { setMsForm(f => ({ ...f, label: l })); setLabelFocus(false); }}
                          style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                          <Flag size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                          <span>{l}</span>
                        </button>
                      ))}
                      {showNew && (
                        <button onMouseDown={() => { setMsForm(f => ({ ...f, label: f.label })); setLabelFocus(false); }}
                          style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "#fff7ed", border: "none", borderTop: matches.length > 0 ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left" }}>
                          <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{msForm.label}&rdquo; as new</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Target Date <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></p>
                <input type="date" value={msForm.targetDate} onChange={e => setMsForm(f => ({ ...f, targetDate: e.target.value }))} style={iS} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveMilestone} disabled={!msForm.dealId || !msForm.label.trim()} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: !msForm.dealId || !msForm.label.trim() ? "var(--surface-muted)" : "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: !msForm.dealId || !msForm.label.trim() ? "not-allowed" : "pointer" }}>Add Milestone</button>
              <button onClick={() => setShowAdd(false)} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, width: 480, padding: 28 }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Delete Milestone</h2>
            <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Are you sure you want to remove this milestone?</p>
            <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{deleteConfirm.label}</p>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={deleteMilestone} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "var(--c-red)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Delete</button>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. NOTES (cross-deal activity log)
// ---------------------------------------------------------------------------
export function DealNotes({ highlightNoteId, onBack, onClearHighlight }) {
  const [filterDeal, setFilterDeal] = useState("all");
  const [search, setSearch] = useState("");
  const [renderKey, rerender] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [noteForm, setNoteForm] = useState({ dealId: "", text: "" });
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [flashId, setFlashId] = useState(highlightNoteId);

  useEffect(() => {
    if (highlightNoteId) {
      setFlashId(highlightNoteId);
      setTimeout(() => {
        const el = document.getElementById("dealnote-" + highlightNoteId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      const timer = setTimeout(() => { setFlashId(null); onClearHighlight && onClearHighlight(); }, 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightNoteId]); // eslint-disable-line react-hooks/exhaustive-deps -- onClearHighlight is an inline parent callback (new ref every render)

  // Build flat list of all notes across deals (no memo — must recalculate after mutations)
  const allNotes = (() => {
    const list = [];
    DEAL_NOTES.forEach(n => {
      const deal = _DEALS.find(f => f.id === n.dealId);
      if (deal) {
        list.push({ ...n, dealId: n.dealId, dealName: deal.name, dealColor: deal.color, dealImage: deal.image });
      }
    });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  })();

  const filtered = allNotes.filter(n => {
    if (filterDeal !== "all" && n.dealId !== parseInt(filterDeal)) return false;
    if (search && !n.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const clearFilters = () => { setFilterDeal("all"); setSearch(""); };
  const hasFilters = filterDeal !== "all" || search;

  const handleSave = () => {
    if (!noteForm.text.trim() || !noteForm.dealId) return;
    const fId = parseInt(noteForm.dealId);
    if (editId !== null) {
      const idx = DEAL_NOTES.findIndex(n => n.id === editId);
      if (idx !== -1) DEAL_NOTES[idx] = { ...DEAL_NOTES[idx], text: noteForm.text.trim() };
    } else {
      DEAL_NOTES.unshift({ id: newId(), dealId: fId, date: new Date().toISOString().split("T")[0], text: noteForm.text.trim() });
    }
    setNoteForm({ dealId: "", text: "" });
    setEditId(null);
    setShowAdd(false);
    rerender(n => n + 1);
  };

  const handleDelete = (note) => {
    const idx = DEAL_NOTES.findIndex(n => n.id === note.id);
    if (idx !== -1) DEAL_NOTES.splice(idx, 1);
    setDeleteConfirm(null);
    rerender(n => n + 1);
  };

  const openEdit = (note) => {
    setEditId(note.id);
    setNoteForm({ dealId: String(note.dealId), text: note.text });
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
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "#e95e00", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 14 }}>
          <ChevronLeft size={15} /> Back to Dashboard
        </button>
      )}
      <PageHeader
        title="Deal Notes"
        sub={`${allNotes.length} note${allNotes.length !== 1 ? "s" : ""} across ${new Set(allNotes.map(n => n.dealId)).size} deal${new Set(allNotes.map(n => n.dealId)).size === 1 ? "" : "s"}`}
        filter={
          <select value={filterDeal} onChange={e => setFilterDeal(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Deals</option>
            {_DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        }
      />

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: hasFilters ? 10 : 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..."
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" }} />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filter
          </button>
        )}
        <button onClick={() => { setEditId(null); setNoteForm({ dealId: _DEALS[0] ? String(_DEALS[0].id) : "", text: "" }); setShowAdd(true); }} style={{ marginLeft: "auto", background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Add Note
        </button>
      </div>

      {/* Notes grouped by date */}
      {Object.keys(grouped).length === 0 ? (
        <div style={{ ...sectionS, textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
          <MessageSquare size={32} style={{ margin: "0 auto 12px", display: "block" }} />
          {hasFilters ? (
            <>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No notes match your filters</p>
              <button onClick={clearFilters} style={{ background: "none", border: "none", color: "#e95e00", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No notes yet</p>
              <p style={{ fontSize: 13 }}>Click &ldquo;Add Note&rdquo; to start documenting your deals.</p>
            </>
          )}
        </div>
      ) : Object.entries(grouped).map(([dateKey, { label, notes }]) => (
        <div key={dateKey} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>{label}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.map(n => (
              <div key={n.id} id={"dealnote-" + n.id} onMouseEnter={e => { if (flashId !== n.id) e.currentTarget.style.background = "var(--surface-alt)"; }} onMouseLeave={e => { if (flashId !== n.id) e.currentTarget.style.background = "var(--surface)"; }} style={{ ...sectionS, marginBottom: 0, padding: 18, transition: "all 0.4s ease", ...(flashId === n.id ? { background: "#ede9fe", boxShadow: "0 0 0 2px #8b5cf6", border: "1px solid #8b5cf6" } : {}) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{n.dealImage}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{n.dealName}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openEdit(n)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={12} /></button>
                    <button onClick={() => setDeleteConfirm(n)} style={{ background: "#f5d0cc", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={12} /></button>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-label)", lineHeight: 1.6 }}>{n.text}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add/Edit Note Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>{editId ? "Edit Note" : "Add Note"}</h2>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Deal *</p>
                <select style={iS} value={noteForm.dealId} onChange={e => setNoteForm(f => ({ ...f, dealId: e.target.value }))} disabled={!!editId}>
                  <option value="">Select deal...</option>
                  {_DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Note *</p>
                <textarea style={{ ...iS, minHeight: 120, resize: "vertical", fontFamily: "inherit" }} placeholder="What happened? Decisions made, updates, reminders..." value={noteForm.text} onChange={e => setNoteForm(f => ({ ...f, text: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: (!noteForm.text.trim() || !noteForm.dealId) ? 0.5 : 1 }}>{editId ? "Save Changes" : "Add Note"}</button>
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
