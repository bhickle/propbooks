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
  DEAL_DOCUMENTS,
  REHAB_CATEGORIES, REHAB_CATEGORY_GROUPS, getCanonicalBySlug, getCanonicalByLabel,
} from "./api.js";

// Shared mock data refs (passed as props or imported directly)
// Using module-level state so all modules stay in sync within a session
import { DEALS as _DEALS, DEAL_EXPENSES as _FE, CONTRACTORS as _CON, DEAL_MILESTONES, DEAL_NOTES, CONTRACTOR_BIDS as _BIDS, CONTRACTOR_DOCUMENTS as _DOCS } from "./api.js";
import { InfoTip, Modal, StatCard, colorWithAlpha, sectionS as sharedSectionS, cardS as sharedCardS, iS } from "./shared.jsx";
import { updateMilestone as dbUpdateMilestone, createMilestone as dbCreateMilestone, deleteMilestone as dbDeleteMilestone } from "./db/dealMilestones.js";
import { updateRehabItem as dbUpdateRehabItem, createRehabItem as dbCreateRehabItem, deleteRehabItem as dbDeleteRehabItem } from "./db/dealRehabItems.js";
import { createContractor as dbCreateContractor, updateContractor as dbUpdateContractor, deleteContractor as dbDeleteContractor, linkContractorToDeal as dbLinkContractorToDeal, unlinkContractorFromDeal as dbUnlinkContractorFromDeal } from "./db/contractors.js";
import { createContractorBid as dbCreateContractorBid, updateContractorBid as dbUpdateContractorBid, deleteContractorBid as dbDeleteContractorBid } from "./db/contractorBids.js";
import { createDealExpense as dbCreateDealExpense, updateDealExpense as dbUpdateDealExpense, deleteDealExpense as dbDeleteDealExpense } from "./db/dealExpenses.js";
import { createDealNote as dbCreateDealNote, updateNote as dbUpdateNote, deleteNote as dbDeleteNote } from "./db/notes.js";
import { createDocument as dbCreateDocument, updateDocument as dbUpdateDocument, deleteDocument as dbDeleteDocument } from "./db/documents.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
// iS moved to shared.jsx

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
      <PageHeader title="Dashboard" sub="Here's where your deals stand." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <StatCard icon={Hammer}     label="Active Rehabs"     value={active.length}              sub={isFiltered ? "Filtered" : "In pipeline"}        color="#e95e00" tip="Number of deals in active pipeline stages (not Sold)." />
        <StatCard icon={DollarSign} label="Capital Deployed" value={fmtK(totalDeployed)}        sub={isFiltered ? "Filtered" : "Purchase + rehab"}   color="var(--c-blue)" tip="Total Purchase Price + Rehab Budget across active rehabs." />
        <StatCard icon={TrendingUp} label="Projected Profit" value={fmtK(Math.round(projectedProfit))} sub={isFiltered ? "Filtered" : "Active rehabs"}  color="var(--c-green)" tip="ARV − Purchase − Rehab Budget − Estimated Holding & Selling Costs for all active rehabs." />
        <StatCard icon={Star}       label="Realized Profit"  value={fmt(realizedProfit)}        sub={isFiltered ? "Filtered" : "Closed rehabs YTD"}   color="var(--c-purple)" tip="Actual profit from closed/sold rehabs this year." />
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
        {/* Active Rehabs Table */}
        <div style={sharedSectionS}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Active Rehabs</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Rehab", "Stage", "Days Owned", "Budget Left", "Proj. Profit"].map(h => (
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


// DEAL EXPENSES (ExpDetailPanel + DealExpenses) removed — replaced by views/Ledger.jsx
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
    if (filterDeal !== "all" && !(c.dealIds || []).includes(filterDeal)) return false;
    if (filterTrade !== "all" && c.trade !== filterTrade) return false;
    return true;
  });

  const totalBids = filtered.reduce((s, c) => s + _BIDS.filter(b => b.contractorId === c.id && b.status === "accepted").reduce((bs, b) => bs + b.amount, 0), 0);
  const totalPaid = filtered.reduce((s, c) => s + _FE.filter(e => e.contractorId === c.id && (e.status || "paid") === "paid").reduce((ps, e) => ps + (e.amount || 0), 0), 0);
  const outstanding = totalBids - totalPaid;

  const handleAdd = async () => {
    if (!form.name) return;
    try {
      const saved = await dbCreateContractor({
        name: form.name, trade: form.trade, phone: form.phone,
        email: form.email || null, license: form.license || null,
        insuranceExpiry: form.insuranceExpiry || null, rating: null,
        notes: form.notes || "",
      });
      _CON.push({ ...saved, dealIds: [] });
    } catch (e) {
      console.error("[PropBooks] add contractor failed:", e);
    }
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
    dbDeleteContractor(con.id).catch(e => console.error("[PropBooks] delete contractor failed:", e));
    rerender(n => n + 1);
    setDeleteConfirm(null);
  };

  return (
    <div>
      <PageHeader title="Contractors" sub="Manage your contractor relationships across all rehabs"
        filter={
          <select value={filterDeal} onChange={e => setFilterDeal(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Rehabs</option>
            {_DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        } />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={Users} label="Contractors" value={filtered.length} sub={filterDeal !== "all" ? `of ${_CON.length} total` : `${_CON.filter(c => (c.dealIds || []).length > 0).length} with active rehabs`} color="#e95e00" tip="Number of contractors matching the current filters." />
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
          const totalConPaid = _FE.filter(e => e.contractorId === c.id && (e.status || "paid") === "paid").reduce((s, e) => s + (e.amount || 0), 0);
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
              {deals.length === 0 && <p style={{ fontSize: 12, color: "#cbd5e1", fontStyle: "italic", marginBottom: 10 }}>No rehabs assigned yet</p>}
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
                <span>{deals.length} rehab{deals.length !== 1 ? "s" : ""}</span>
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
  // Payments are now derived from expenses linked to this contractor.
  // Expense fields: description (was note on payments), date, amount, dealId, bidId.
  const payments = _FE
    .filter(e => e.contractorId === con.id && (e.status || "paid") === "paid")
    .map(e => ({ id: e.id, dealId: e.dealId, amount: e.amount || 0, date: e.date, note: e.description, bidId: e.bidId || null }));
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

  const saveBid = async () => {
    const fId = bidForm.dealId;
    const rehabName = bidForm.rehabItem.trim();
    if (!fId || !rehabName || !bidForm.amount) return;
    const deal = _DEALS.find(f => f.id === fId);
    const amount = parseFloat(bidForm.amount) || 0;
    try {
      if (editingBidId) {
        const saved = await dbUpdateContractorBid(editingBidId, { dealId: fId, rehabItem: rehabName, amount });
        const idx = _BIDS.findIndex(b => b.id === editingBidId);
        if (idx !== -1) _BIDS[idx] = saved;
        setEditingBidId(null);
      } else {
        const saved = await dbCreateContractorBid({ contractorId: con.id, dealId: fId, rehabItem: rehabName, amount, status: "pending", date: new Date().toISOString().slice(0, 10) });
        _BIDS.push(saved);
        if (!con.dealIds.includes(fId)) {
          con.dealIds.push(fId);
          dbLinkContractorToDeal(con.id, fId).catch(e => console.error("[PropBooks] link contractor failed:", e));
        }
        // Auto-create rehab item on the rehab if it doesn't exist
        if (deal) {
          let item = (deal.rehabItems || []).find(i => i.category === rehabName);
          if (!item) {
            const newItemSaved = await dbCreateRehabItem({ dealId: fId, category: rehabName, budgeted: 0, spent: 0, status: "pending", sortOrder: (deal.rehabItems || []).length });
            item = { ...newItemSaved, contractors: [] };
            if (!deal.rehabItems) deal.rehabItems = [];
            deal.rehabItems.push(item);
          }
          const cons = item.contractors || [];
          if (!cons.some(c => c.id === con.id)) {
            item.contractors = [...cons, { id: con.id, bid: amount }];
          }
        }
      }
    } catch (e) {
      console.error("[PropBooks] save bid failed:", e);
    }
    rerender(n => n + 1);
    setBidForm({ dealId: "", rehabItem: "", amount: "" });
    setShowBidModal(false);
  };

  const toggleBidStatus = (bidId) => {
    const bid = _BIDS.find(b => b.id === bidId);
    if (bid) {
      const next = bid.status === "accepted" ? "pending" : "accepted";
      bid.status = next;
      dbUpdateContractorBid(bidId, { status: next }).catch(e => console.error("[PropBooks] toggle bid failed:", e));
      rerender(n => n + 1);
    }
  };

  const deleteBid = (bidId) => {
    const idx = _BIDS.findIndex(b => b.id === bidId);
    if (idx !== -1) _BIDS.splice(idx, 1);
    dbDeleteContractorBid(bidId).catch(e => console.error("[PropBooks] delete bid failed:", e));
    rerender(n => n + 1);
    setDeleteConfirm(null);
  };

  const openEditDoc = (d) => {
    setEditingDocId(d.id);
    setDocForm({ name: d.name, type: d.type, dealId: d.dealId ? String(d.dealId) : "" });
    setShowDocModal(true);
  };

  const saveDoc = async () => {
    if (!docForm.name) return;
    try {
      if (editingDocId) {
        const saved = await dbUpdateDocument(editingDocId, {
          name: docForm.name, type: docForm.type, dealId: docForm.dealId || null,
        });
        const idx = _DOCS.findIndex(d => d.id === editingDocId);
        if (idx !== -1) _DOCS[idx] = { ...(_DOCS[idx]), ...saved };
        setEditingDocId(null);
      } else {
        const saved = await dbCreateDocument({
          entityType: "contractor",
          entityId: con.id,
          dealId: docForm.dealId || null,
          meta: { name: docForm.name, type: docForm.type, size: "— KB" },
          file: null,
        });
        _DOCS.unshift(saved);
      }
      rerender(n => n + 1);
      setDocForm({ name: "", type: "contract", dealId: "" });
      setShowDocModal(false);
    } catch (e) {
      console.error("[PropBooks] save contractor doc failed:", e);
    }
  };

  const deleteDoc = async (docId) => {
    try {
      const doc = _DOCS.find(d => d.id === docId);
      if (doc) await dbDeleteDocument(doc);
      const idx = _DOCS.findIndex(d => d.id === docId);
      if (idx !== -1) _DOCS.splice(idx, 1);
      rerender(n => n + 1);
      setDeleteConfirm(null);
    } catch (e) {
      console.error("[PropBooks] delete contractor doc failed:", e);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "bids", label: "Bids", icon: DollarSign, count: bids.length },
    { id: "documents", label: "Documents", icon: FileText, count: documents.length },
    { id: "history", label: "Rehab History", icon: Clock, count: deals.length },
  ];

  const selectedDealForBid = _DEALS.find(f => f.id === bidForm.dealId);
  const bidRehabOptions = selectedDealForBid ? (selectedDealForBid.rehabItems || []).map(i => i.category) : [];
  // All rehab categories across all rehabs for typeahead suggestions
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
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--c-blue)", fontSize: 14, fontWeight: 600 }}>
          <ChevronLeft size={15} /> Back to Contractors
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
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Rehab History</h3>
          {deals.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>No rehabs assigned yet.</div>}
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
                      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Rehab</p>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{myDeals[0].name}</p>
                    </div>
                  );
                }
                return (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Rehab *</p>
                    <select style={iS} value={bidForm.dealId} onChange={e => setBidForm(f => ({ ...f, dealId: e.target.value, rehabItem: "" }))}>
                      <option value="">Select rehab...</option>
                      {myDeals.length > 0 && (
                        <optgroup label={`${con.name}'s Rehabs`}>
                          {myDeals.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </optgroup>
                      )}
                      {otherDeals.length > 0 && (
                        <optgroup label="Other Active Rehabs">
                          {otherDeals.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>
                );
              })()}
              <div style={{ position: "relative" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Scope item *</p>
                <input style={iS} placeholder={bidForm.dealId ? "Start typing or pick from the list..." : "Select a rehab first"} disabled={!bidForm.dealId}
                  value={bidForm.rehabItem} onChange={e => { setBidForm(f => ({ ...f, rehabItem: e.target.value })); setRehabFocus(true); }}
                  onFocus={() => setRehabFocus(true)} onBlur={() => setTimeout(() => setRehabFocus(false), 150)} />
                {!rehabFocus && !bidForm.rehabItem && bidForm.dealId && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>Pick a standard category or type your own</p>}
                {rehabFocus && bidForm.dealId && (() => {
                  const q = bidForm.rehabItem.toLowerCase().trim();
                  const canonMatches = REHAB_CATEGORIES.filter(c => !q || c.label.toLowerCase().includes(q));
                  // Items already on this rehab that aren't canonical → "On This Deal"
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
                          <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" }}>On This Rehab</div>
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
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Associated Rehab <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></p>
                  <select style={iS} value={docForm.dealId} onChange={e => setDocForm(f => ({ ...f, dealId: e.target.value }))}>
                    <option value="">General (no rehab)</option>
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

  // Profit breakdown per rehab – stacked components
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
  const singleDeal = filterDeal !== "all" ? allDeals.find(f => f.id === filterDeal) : null;

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
            {singleDeal ? `Performance details — ${singleDeal.name}` : "Performance metrics across all rehabs"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={filterDeal} onChange={e => setFilterDeal(e.target.value)} style={{ ...iS, width: 220, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Rehabs</option>
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
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Rehab Scorecard</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {singleDeal.address}</p>
            </div>
            <div style={{ marginLeft: "auto" }}><StageDot stage={singleDeal.stage} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
            {[
              { label: "Projected ROI", value: `${dealROI?.roi || 0}%`, color: "var(--c-green)", sub: singleDeal.stage === "Sold" ? "Realized return" : "Estimated return", tip: "Return on Investment = (Sale Price \u2212 Total Cost) \u00f7 Total Cost \u00d7 100. Total Cost includes purchase, rehab, holding, and selling costs." },
              { label: "Projected Profit", value: fmt(dealROI?.profit || 0), color: "var(--c-purple)", sub: singleDeal.stage === "Sold" ? "Realized" : "Based on ARV", tip: "ARV (or Sale Price) minus all costs: purchase price, rehab, holding costs, and estimated 6% selling costs." },
              { label: "Cost Per Day", value: dealCostPerDay > 0 ? `${fmt(dealCostPerDay)}/day` : "N/A", color: "#e95e00", sub: `${singleDeal.daysOwned || 0} days owned`, tip: "Total spend (rehab + holding costs) divided by days owned. Helps quantify the daily burn rate on this rehab." },
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
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Scope Item Progress</h3>
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
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No scope items configured</div>
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
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No expenses recorded for this rehab</div>
          )}
        </div>
      </>) : (<>

      {/* ======== PORTFOLIO VIEW ======== */}
      {/* KPI cards with InfoTips — matches rental Analytics pattern */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Avg ROI", value: `${avgROI}%`, color: "var(--c-green)", sub: "All rehabs", tip: "Average Return on Investment across all rehabs. ROI = (Sale/ARV \u2212 Total Cost) \u00f7 Total Cost \u00d7 100. Active rehabs use projected ARV and estimated costs." },
          { label: "Avg Hold Time", value: `${avgDays} days`, color: "var(--c-blue)", sub: "Active rehabs", tip: "Average number of days properties have been owned. Shorter hold times mean less carrying cost and faster capital recycling." },
          { label: "Total Realized", value: fmt(totalProfit), color: "var(--c-purple)", sub: "Closed rehabs", tip: "Sum of net profit from all sold rehabs. Net Profit = Sale Price \u2212 Purchase Price \u2212 Rehab Spent \u2212 Holding Costs \u2212 Selling Costs." },
          { label: "Rehabs Analyzed", value: deals.length, color: "#e95e00", sub: `${sold.length} closed`, tip: "Total number of rehabs in your pipeline. Includes active, listed, under contract, and sold properties." },
        ].map((m, i) => (
          <div key={i} style={{ ...cardS, textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: "var(--text-primary)", fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
            <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 6 }}>{m.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* ROI by Rehab */}
        <div style={sectionS}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>ROI by Rehab</h3>
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
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>By category across all rehabs</p>
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
        {/* Hold Time by Rehab */}
        <div style={sectionS}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Hold Time by Rehab</h3>
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

      {/* Profit Breakdown by Rehab */}
      <div style={sectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Profit Breakdown by Rehab</h3>
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
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Rehab Summary</h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["Rehab", "Stage", "Purchase", "Rehab Budget", "ARV / Sale", "Proj. Profit", "ROI"].map(h => (
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
      const dealMs = DEAL_MILESTONES.filter(m => m.dealId === hDealId);
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

  // Build flat list of all milestones across rehabs
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
    if (filterDeal !== "all" && m.dealId !== filterDeal) return false;
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
      dbUpdateMilestone(ms[completingItem.idx].id, { done: true, date: completionDate })
        .catch(e => console.error("[PropBooks] complete milestone failed:", e));
    }
    setCompletingItem(null);
    rerender(n => n + 1);
  };

  const uncomplete = (dealId, idx) => {
    const ms = DEAL_MILESTONES.filter(m => m.dealId === dealId);
    if (ms && ms[idx]) {
      ms[idx].done = false;
      ms[idx].date = null;
      dbUpdateMilestone(ms[idx].id, { done: false, date: null })
        .catch(e => console.error("[PropBooks] uncomplete milestone failed:", e));
    }
    rerender(n => n + 1);
  };

  const saveMilestone = async () => {
    const fId = msForm.dealId;
    if (!fId || !msForm.label.trim()) return;
    try {
      const saved = await dbCreateMilestone({
        dealId: fId, label: msForm.label.trim(),
        done: false, date: null, targetDate: msForm.targetDate || null,
      });
      DEAL_MILESTONES.push(saved);
    } catch (e) {
      console.error("[PropBooks] add milestone failed:", e);
    }
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
      const target = ms[editItem.idx];
      target.label = editForm.label.trim() || target.label;
      target.targetDate = editForm.targetDate || null;
      if (editForm.completedDate) {
        target.date = editForm.completedDate;
        target.done = true;
      } else {
        target.date = null;
        target.done = false;
      }
      dbUpdateMilestone(target.id, {
        label: target.label,
        targetDate: target.targetDate,
        date: target.date,
        done: target.done,
      }).catch(e => console.error("[PropBooks] edit milestone failed:", e));
    }
    setEditItem(null);
    rerender(n => n + 1);
  };

  const deleteMilestone = () => {
    if (!deleteConfirm) return;
    const targets = DEAL_MILESTONES.filter(m => m.dealId === deleteConfirm.dealId);
    const target = targets[deleteConfirm.idx];
    if (target) {
      const msIdx = DEAL_MILESTONES.findIndex(m => m.id === target.id);
      if (msIdx !== -1) DEAL_MILESTONES.splice(msIdx, 1);
      dbDeleteMilestone(target.id)
        .catch(e => console.error("[PropBooks] delete milestone failed:", e));
    }
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
            <option value="all">All Rehabs</option>
            {_DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={CheckCircle} label="Completed" value={totalDone} sub={`of ${filtered.length} total`} color="var(--c-green)" tip="Milestones marked as done across all rehabs." />
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
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Rehab *</p>
                <select value={msForm.dealId} onChange={e => setMsForm(f => ({ ...f, dealId: e.target.value }))} style={iS}>
                  <option value="">Select rehab...</option>
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

