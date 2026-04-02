// =============================================================================
// RealVault – Fix & Flip Modules
// FlipDashboard | RehabTracker | FlipExpenses | FlipContractors | FlipAnalytics
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
  ArrowUp, ArrowDown, Truck, Building2, MapPin, Home, Info,
  MessageSquare, FileText, Circle,
} from "lucide-react";
import {
  fmt, fmtK, newId, STAGE_ORDER, STAGE_COLORS, DEFAULT_MILESTONES,
} from "./api.js";

// Shared mock data refs (passed as props or imported directly)
// Using module-level state so all modules stay in sync within a session
import { FLIPS as _FLIPS, FLIP_EXPENSES as _FE, CONTRACTORS as _CON, FLIP_MILESTONES_DATA as _FM, FLIP_NOTES as _FN } from "./api.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const iS = { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" };

function StageDot({ stage }) {
  const c = STAGE_COLORS[stage] || STAGE_COLORS["Active Rehab"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.text, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
      {stage}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "#3b82f6", trend, trendVal }) {
  const up = trend === "up";
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{label}</p>
          <p style={{ color: "#0f172a", fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{sub}</p>}
        </div>
        <div style={{ background: color + "18", borderRadius: 12, padding: 10 }}>
          <Icon size={20} color={color} />
        </div>
      </div>
      {trendVal && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 14, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
          {up ? <ArrowUp size={13} color="#10b981" /> : <ArrowDown size={13} color="#ef4444" />}
          <span style={{ fontSize: 12, fontWeight: 600, color: up ? "#10b981" : "#ef4444" }}>{trendVal}</span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>vs last quarter</span>
        </div>
      )}
    </div>
  );
}

function PageHeader({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <div>
        <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{title}</h1>
        <p style={{ color: "#64748b", fontSize: 15 }}>{sub}</p>
      </div>
      {action}
    </div>
  );
}

function InfoTip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 4, cursor: "pointer" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onClick={e => { e.stopPropagation(); setShow(s => !s); }}>
      <Info size={13} color="#94a3b8" />
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "#0f172a", color: "#f8fafc", fontSize: 12, lineHeight: 1.5, fontWeight: 400,
          padding: "10px 14px", borderRadius: 10, width: 240, zIndex: 50,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)", pointerEvents: "none", whiteSpace: "normal",
        }}>
          {text}
          <span style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            border: "6px solid transparent", borderTopColor: "#0f172a",
          }} />
        </span>
      )}
    </span>
  );
}

const sectionS = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", marginBottom: 24 };

// ---------------------------------------------------------------------------
// 1. FLIP DASHBOARD
// ---------------------------------------------------------------------------
export function FlipDashboard({ onSelect }) {
  const [filterStage, setFilterStage] = useState("all");

  const allFlips = _FLIPS;
  const flips = allFlips.filter(f => {
    if (filterStage !== "all" && f.stage !== filterStage) return false;
    return true;
  });

  const active = flips.filter(f => f.stage !== "Sold");
  const sold   = flips.filter(f => f.stage === "Sold");

  const totalDeployed   = active.reduce((s, f) => s + f.purchasePrice + f.rehabSpent, 0);
  const totalRehabBudget = active.reduce((s, f) => s + f.rehabBudget, 0);
  const totalRehabSpent  = active.reduce((s, f) => s + f.rehabSpent, 0);
  const realizedProfit  = sold.reduce((s, f) => s + (f.netProfit || 0), 0);
  const projectedProfit = active.reduce((s, f) => {
    const cost = f.purchasePrice + f.rehabBudget + (f.holdingCostsPerMonth * ((f.daysOwned || 0) / 30));
    return s + (f.arv - cost - f.arv * 0.06);
  }, 0);

  const stageBreakdown = STAGE_ORDER.map(s => ({
    stage: s, count: flips.filter(f => f.stage === s).length,
    color: STAGE_COLORS[s]?.dot || "#94a3b8",
  }));

  const recentActivity = [
    { text: "Oakdale Craftsman – flooring install started",  date: "Mar 22", icon: Wrench,   color: "#f59e0b" },
    { text: "Pine Street Ranch – offer accepted",             date: "Mar 20", icon: CheckCircle, color: "#10b981" },
    { text: "Hawthorne Heights – inspection complete",        date: "Mar 12", icon: Flag,     color: "#8b5cf6" },
    { text: "Birchwood Colonial – closed at $361,500",        date: "Aug 29", icon: Star,     color: "#6b7280" },
  ];

  const isFiltered = filterStage !== "all";

  return (
    <div>
      <PageHeader title="Overview" sub="All fix & flip deals at a glance" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <StatCard icon={Hammer}     label="Active Deals"     value={active.length}              sub={isFiltered ? "Filtered" : "In pipeline"}        color="#f59e0b" trend={!isFiltered ? "up" : undefined} trendVal="+1 this quarter" />
        <StatCard icon={DollarSign} label="Capital Deployed" value={fmtK(totalDeployed)}        sub={isFiltered ? "Filtered" : "Purchase + rehab"}   color="#3b82f6" />
        <StatCard icon={TrendingUp} label="Projected Profit" value={fmtK(Math.round(projectedProfit))} sub={isFiltered ? "Filtered" : "Active deals"}  color="#10b981" />
        <StatCard icon={Star}       label="Realized Profit"  value={fmt(realizedProfit)}        sub={isFiltered ? "Filtered" : "Closed deals YTD"}   color="#8b5cf6" trend={!isFiltered ? "up" : undefined} trendVal="+$61K YTD" />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "#f8fafc", borderRadius: 10, padding: 4, border: "1px solid #e2e8f0" }}>
          {["all", ...STAGE_ORDER].map(s => {
            const active2 = filterStage === s;
            const label = s === "all" ? "All Stages" : s;
            const count = s === "all" ? allFlips.length : allFlips.filter(f => f.stage === s).length;
            return (
              <button key={s} onClick={() => setFilterStage(s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active2 ? "#f59e0b" : "transparent", color: active2 ? "#fff" : "#64748b", fontWeight: active2 ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {label} ({count})
              </button>
            );
          })}
        </div>
        {isFiltered && (
          <button onClick={() => setFilterStage("all")} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filter
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Active Flips Table */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9" }}>
          <p style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Active Deals</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Deal", "Stage", "Days Owned", "Budget Left", "Proj. Profit"].map(h => (
                  <th key={h} style={{ textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", paddingBottom: 10, borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map((f, i) => {
                const budgetLeft = f.rehabBudget - f.rehabSpent;
                const cost = f.purchasePrice + f.rehabBudget + (f.holdingCostsPerMonth * (f.daysOwned / 30));
                const proj = f.arv - cost - (f.arv * 0.06);
                return (
                  <tr key={f.id} style={{ borderBottom: i < active.length - 1 ? "1px solid #f8fafc" : "none" }}>
                    <td style={{ padding: "12px 0" }}>
                      <button onClick={() => onSelect && onSelect(f)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: f.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: f.color }}>{f.image}</div>
                          <div>
                            <p style={{ color: "#0f172a", fontSize: 13, fontWeight: 600 }}>{f.name}</p>
                            <p style={{ color: "#94a3b8", fontSize: 11 }}>{f.address.split(",")[1]?.trim()}</p>
                          </div>
                        </div>
                      </button>
                    </td>
                    <td style={{ padding: "12px 0" }}><StageDot stage={f.stage} /></td>
                    <td style={{ padding: "12px 0", color: "#0f172a", fontSize: 13, fontWeight: 500 }}>{f.daysOwned}d</td>
                    <td style={{ padding: "12px 0" }}>
                      <span style={{ color: budgetLeft < 0 ? "#ef4444" : "#0f172a", fontSize: 13, fontWeight: 600 }}>{fmt(budgetLeft)}</span>
                    </td>
                    <td style={{ padding: "12px 0" }}>
                      <span style={{ color: proj > 0 ? "#10b981" : "#ef4444", fontSize: 13, fontWeight: 600 }}>{fmt(Math.round(proj))}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Stage Breakdown + Recent Activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9" }}>
            <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>By Stage</p>
            {stageBreakdown.map(s => (
              <div key={s.stage} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ color: "#374151", fontSize: 13, flex: 1 }}>{s.stage}</span>
                <span style={{ color: "#0f172a", fontWeight: 700, fontSize: 13 }}>{s.count}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9", flex: 1 }}>
            <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Recent Activity</p>
            {recentActivity.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: a.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <a.icon size={13} color={a.color} />
                </div>
                <div>
                  <p style={{ color: "#374151", fontSize: 12, lineHeight: 1.4 }}>{a.text}</p>
                  <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{a.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rehab Budget Overview Bar */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ color: "#0f172a", fontSize: 16, fontWeight: 700 }}>Rehab Budget Overview</p>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#3b82f6", display: "inline-block" }} />Budgeted</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981", display: "inline-block" }} />Spent</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={active.map(f => ({ name: f.image, budget: f.rehabBudget, spent: f.rehabSpent }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
            <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }} />
            <Bar dataKey="budget" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Budgeted" />
            <Bar dataKey="spent"  fill="#10b981" radius={[4, 4, 0, 0]} name="Spent" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. REHAB TRACKER
// ---------------------------------------------------------------------------
export function RehabTracker() {
  const [filterFlip, setFilterFlip]     = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { flipId, idx, category }
  // assignments: { [flipId-itemIdx]: contractorId | null }
  // seeded from mock data, mutated in place so FlipContractors stays in sync
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate(n => n + 1);

  const flips = _FLIPS.filter(f => f.stage !== "Sold");

  const allItems = flips.flatMap(f =>
    (f.rehabItems || []).map((item, idx) => ({
      ...item, flipId: f.id, flipName: f.name, flipColor: f.color, flipImage: f.image, _idx: idx,
    }))
  );

  const filtered = allItems.filter(item => {
    if (filterFlip   !== "all" && item.flipId !== parseInt(filterFlip)) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    return true;
  });

  const totalBudget = filtered.reduce((s, i) => s + i.budgeted, 0);
  const totalSpent  = filtered.reduce((s, i) => s + i.spent, 0);
  const totalLeft   = totalBudget - totalSpent;
  const complete    = filtered.filter(i => i.status === "complete").length;
  const inProgress  = filtered.filter(i => i.status === "in-progress").length;

  const statusStyle = {
    "complete":    { bg: "#dcfce7", text: "#15803d", label: "Complete"    },
    "in-progress": { bg: "#fef9c3", text: "#a16207", label: "In Progress" },
    "pending":     { bg: "#f1f5f9", text: "#64748b", label: "Pending"     },
  };

  // Assign a contractor to a rehab item — mutates FLIPS directly so contractor
  // cards pick it up without prop-drilling
  function addContractorToItem(flipId, itemIdx, contractorId, bid = 0) {
    const flip = _FLIPS.find(f => f.id === flipId);
    if (flip && flip.rehabItems[itemIdx] !== undefined) {
      const cons = flip.rehabItems[itemIdx].contractors || [];
      if (!cons.some(c => c.id === contractorId)) {
        flip.rehabItems[itemIdx].contractors = [...cons, { id: contractorId, bid }];
        rerender();
      }
    }
  }

  function removeContractorFromItem(flipId, itemIdx, contractorId) {
    const flip = _FLIPS.find(f => f.id === flipId);
    if (flip && flip.rehabItems[itemIdx] !== undefined) {
      flip.rehabItems[itemIdx].contractors = (flip.rehabItems[itemIdx].contractors || []).filter(c => c.id !== contractorId);
      rerender();
    }
  }

  function updateContractorBid(flipId, itemIdx, contractorId, bid) {
    const flip = _FLIPS.find(f => f.id === flipId);
    if (flip && flip.rehabItems[itemIdx] !== undefined) {
      const cons = flip.rehabItems[itemIdx].contractors || [];
      const entry = cons.find(c => c.id === contractorId);
      if (entry) { entry.bid = bid; rerender(); }
    }
  }

  // Add line item modal state
  const emptyItem = { flipId: "", category: "", budgeted: "", spent: "0", status: "pending" };
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm]       = useState(emptyItem);
  const sif = k => e => setItemForm(f => ({ ...f, [k]: e.target.value }));

  function saveLineItem() {
    if (!itemForm.flipId || !itemForm.category) return;
    const flip = _FLIPS.find(f => f.id === parseInt(itemForm.flipId));
    if (!flip) return;
    flip.rehabItems.push({
      category:      itemForm.category,
      budgeted:      parseFloat(itemForm.budgeted) || 0,
      spent:         parseFloat(itemForm.spent) || 0,
      status:        itemForm.status,
      contractors: [],
    });
    setItemForm(emptyItem);
    setShowAddItem(false);
    rerender();
  }

  // Edit line item inline (status + budgeted)
  const [editingItem, setEditingItem] = useState(null); // { flipId, idx }
  const [editVals, setEditVals]       = useState({});

  function startEditItem(flipId, idx, item) {
    setEditingItem({ flipId, idx });
    setEditVals({ budgeted: String(item.budgeted), spent: String(item.spent), status: item.status });
  }

  function saveEditItem() {
    if (!editingItem) return;
    const flip = _FLIPS.find(f => f.id === editingItem.flipId);
    if (flip && flip.rehabItems[editingItem.idx]) {
      Object.assign(flip.rehabItems[editingItem.idx], {
        budgeted: parseFloat(editVals.budgeted) || 0,
        spent:    parseFloat(editVals.spent) || 0,
        status:   editVals.status,
      });
    }
    setEditingItem(null);
    rerender();
  }

  function deleteLineItem(flipId, idx) {
    const flip = _FLIPS.find(f => f.id === flipId);
    if (flip) {
      flip.rehabItems.splice(idx, 1);
      rerender();
    }
  }

  return (
    <div>
      <PageHeader
        title="Rehab Tracker"
        sub="All rehab line items across active flips"
        action={
          <button onClick={() => setShowAddItem(true)} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Rehab Item
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={Target}      label="Total Budget"  value={fmtK(totalBudget)} sub="Active flips"   color="#3b82f6" />
        <StatCard icon={Receipt}     label="Total Spent"   value={fmt(totalSpent)}   sub="To date"        color="#f59e0b" />
        <StatCard icon={DollarSign}  label="Budget Left"   value={fmt(totalLeft)}    sub={totalLeft < 0 ? "OVER BUDGET" : "Remaining"} color={totalLeft < 0 ? "#ef4444" : "#10b981"} />
        <StatCard icon={CheckCircle} label="Tasks Done"    value={`${complete}/${allItems.length}`} sub={`${inProgress} in progress`} color="#8b5cf6" />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <select value={filterFlip} onChange={e => setFilterFlip(e.target.value)}
          style={{ ...iS, width: "auto", padding: "8px 12px", fontSize: 13 }}>
          <option value="all">All Flips</option>
          {flips.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ ...iS, width: "auto", padding: "8px 12px", fontSize: 13 }}>
          <option value="all">All Statuses</option>
          <option value="complete">Complete</option>
          <option value="in-progress">In Progress</option>
          <option value="pending">Pending</option>
        </select>
        <div style={{ marginLeft: "auto", background: "#f1f5f9", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
          <Search size={13} /> {filtered.length} items
        </div>
      </div>

      {/* Items by flip */}
      {flips
        .filter(f => filterFlip === "all" || f.id === parseInt(filterFlip))
        .map(f => {
          const items = filtered.filter(i => i.flipId === f.id);
          if (!items.length) return null;
          const flipBudget     = items.reduce((s, i) => s + i.budgeted, 0);
          const flipSpent      = items.reduce((s, i) => s + i.spent,    0);
          const pct            = flipBudget > 0 ? Math.min((flipSpent / flipBudget) * 100, 100) : 0;
          const flipContractors = _CON.filter(c => c.flipId === f.id);
          const assignedCount  = items.filter(i => (i.contractors || []).length > 0).length;

          return (
            <div key={f.id} style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9", marginBottom: 16 }}>
              {/* Flip header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: f.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: f.color }}>{f.image}</div>
                  <div>
                    <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 15 }}>{f.name}</p>
                    <p style={{ color: "#94a3b8", fontSize: 12 }}>
                      {fmt(flipSpent)} spent of {fmt(flipBudget)} · {assignedCount}/{items.length} scopes assigned
                    </p>
                  </div>
                </div>
                <StageDot stage={f.stage} />
              </div>

              {/* Progress bar */}
              <div style={{ background: "#f1f5f9", borderRadius: 4, height: 6, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct > 95 ? "#ef4444" : "#10b981", borderRadius: 4, transition: "width 0.3s" }} />
              </div>

              {/* Line items table */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Category", "Contractor", "Status", "Budgeted", "Spent", "Variance", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const variance    = item.budgeted - item.spent;
                    const ss          = statusStyle[item.status];
                    const assigned    = item.contractors || [];
                    const assignedIds = assigned.map(c => c.id);
                    const unassigned  = flipContractors.filter(c => !assignedIds.includes(c.id));
                    const isEditing   = editingItem?.flipId === f.id && editingItem?.idx === item._idx;

                    return (
                      <tr key={i} style={{ borderBottom: i < items.length - 1 ? "1px solid #f8fafc" : "none", background: isEditing ? "#fffbeb" : "transparent" }}>
                        {/* Category */}
                        <td style={{ padding: "10px 0 10px", color: "#0f172a", fontSize: 13, fontWeight: 500, paddingRight: 12 }}>
                          {item.category}
                        </td>

                        {/* Contractor cell — supports multiple with per-item bids */}
                        <td style={{ padding: "10px 0", paddingRight: 12, minWidth: 200 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                            {assigned.map(asgn => {
                              const con = _CON.find(c => c.id === asgn.id);
                              if (!con) return null;
                              const mm1 = item.status === "complete" && con.status !== "complete";
                              const mm2 = con.status === "complete" && item.status !== "complete";
                              return (
                                <div key={asgn.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "#f1f5f9", borderRadius: 20, padding: "4px 8px 4px 6px" }}>
                                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Truck size={9} color="#fff" />
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{con.name}</span>
                                  {asgn.bid > 0 && <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{fmt(asgn.bid)}</span>}
                                  <button onClick={() => removeContractorFromItem(f.id, item._idx, asgn.id)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex", alignItems: "center" }}>
                                    <X size={10} />
                                  </button>
                                  {mm1 && <span title={`${con.name} still marked active`} style={{ cursor: "help" }}><AlertCircle size={12} color="#f59e0b" /></span>}
                                  {mm2 && <span title={`${con.name} is complete but item isn't`} style={{ cursor: "help" }}><AlertCircle size={12} color="#3b82f6" /></span>}
                                </div>
                              );
                            })}
                            {unassigned.length > 0 && (
                              <select
                                value=""
                                onChange={e => { if (e.target.value) addContractorToItem(f.id, item._idx, parseInt(e.target.value)); }}
                                style={{ border: "1.5px dashed #cbd5e1", borderRadius: 8, padding: "4px 8px", fontSize: 12, color: "#94a3b8", background: "#fafafa", cursor: "pointer", outline: "none" }}>
                                <option value="">+ Add</option>
                                {unassigned.map(c => (
                                  <option key={c.id} value={c.id}>{c.name} ({c.trade})</option>
                                ))}
                              </select>
                            )}
                            {flipContractors.length === 0 && assigned.length === 0 && (
                              <span style={{ fontSize: 12, color: "#cbd5e1", fontStyle: "italic" }}>No contractors</span>
                            )}
                          </div>
                        </td>

                        {/* Status — editable inline */}
                        <td style={{ padding: "10px 0", paddingRight: 12 }}>
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
                        <td style={{ padding: "10px 0", paddingRight: 12 }}>
                          {isEditing ? (
                            <input type="number" value={editVals.budgeted} onChange={e => setEditVals(v => ({ ...v, budgeted: e.target.value }))}
                              style={{ ...iS, padding: "4px 8px", fontSize: 12, width: 100 }} />
                          ) : (
                            <span style={{ color: "#0f172a", fontSize: 13 }}>{fmt(item.budgeted)}</span>
                          )}
                        </td>

                        {/* Spent — editable inline */}
                        <td style={{ padding: "10px 0", paddingRight: 12 }}>
                          {isEditing ? (
                            <input type="number" value={editVals.spent} onChange={e => setEditVals(v => ({ ...v, spent: e.target.value }))}
                              style={{ ...iS, padding: "4px 8px", fontSize: 12, width: 100 }} />
                          ) : (
                            <span style={{ color: "#0f172a", fontSize: 13 }}>{fmt(item.spent)}</span>
                          )}
                        </td>

                        {/* Variance */}
                        <td style={{ padding: "10px 0", paddingRight: 8 }}>
                          <span style={{ color: variance < 0 ? "#ef4444" : "#10b981", fontSize: 13, fontWeight: 600 }}>
                            {variance < 0 ? "−" : "+"}{fmt(Math.abs(variance))}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "10px 0", whiteSpace: "nowrap" }}>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={saveEditItem} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                              <button onClick={() => setEditingItem(null)} style={{ background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 7, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 4, opacity: 0.4, transition: "opacity 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.opacity = 1}
                              onMouseLeave={e => e.currentTarget.style.opacity = 0.4}>
                              <button onClick={() => startEditItem(f.id, item._idx, item)}
                                style={{ background: "#f1f5f9", border: "none", borderRadius: 6, padding: "4px 7px", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}
                                title="Edit">
                                ✏️
                              </button>
                              <button onClick={() => setDeleteConfirm({ flipId: f.id, idx: item._idx, category: item.category, budgeted: item.budgeted, spent: item.spent })}
                                style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "4px 7px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}
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
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "#0f172a", fontSize: 19, fontWeight: 700 }}>Add Rehab Item</h2>
              <button onClick={() => setShowAddItem(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Flip *</p>
                <select style={iS} value={itemForm.flipId} onChange={sif("flipId")}>
                  <option value="">Select flip...</option>
                  {flips.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Category / Scope Name *</p>
                <input style={iS} placeholder="e.g. Kitchen, Drywall, HVAC, Landscaping..." value={itemForm.category} onChange={sif("category")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Budget ($)</p>
                  <input type="number" style={iS} placeholder="0" value={itemForm.budgeted} onChange={sif("budgeted")} />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Spent so far ($)</p>
                  <input type="number" style={iS} placeholder="0" value={itemForm.spent} onChange={sif("spent")} />
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Status</p>
                <select style={iS} value={itemForm.status} onChange={sif("status")}>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveLineItem} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Add Rehab Item</button>
              <button onClick={() => setShowAddItem(false)} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#64748b" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: 420, padding: 28 }}>
            <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Delete Rehab Item</h2>
            <p style={{ color: "#475569", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this rehab item?</p>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{deleteConfirm.category}</p>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Budget: ${deleteConfirm.budgeted?.toLocaleString()} · Spent: ${deleteConfirm.spent?.toLocaleString()}</p>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { deleteLineItem(deleteConfirm.flipId, deleteConfirm.idx); setDeleteConfirm(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. FLIP EXPENSES
// ---------------------------------------------------------------------------
const FLIP_EXPENSE_GROUPS = {
  "Acquisition":          ["Closing Costs (Buy)", "Title & Escrow", "Inspection", "Appraisal"],
  "Rehab Labor":          ["General Contractor", "Subcontractor", "Day Labor"],
  "Rehab Materials":      ["Materials & Supplies", "Appliances", "Fixtures & Hardware"],
  "Permits & Fees":       ["Permits", "Inspections", "Dumpster / Debris Removal"],
  "Holding Costs":        ["Insurance", "Property Tax", "Utilities", "Loan Interest / Hard Money", "HOA"],
  "Selling Costs":        ["Agent Commission", "Photography / Marketing", "Staging", "Cleaning", "Closing Costs (Sell)"],
  "General":              ["Landscaping", "Travel", "Other"],
};
const EXPENSE_CATS = Object.values(FLIP_EXPENSE_GROUPS).flat();

export function FlipExpenses({ highlightExpId, onBack, onClearHighlight }) {
  const [expenses, setExpenses] = useState([..._FE]);
  const [filterFlip, setFilterFlip]     = useState("all");
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
  }, [highlightExpId]);
  const [editId, setEditId]             = useState(null);
  const [search, setSearch]             = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const emptyForm = { flipId: "", date: "", vendor: "", category: "Materials & Supplies", description: "", amount: "", rehabItemIdx: "" };
  const [form, setForm]   = useState(emptyForm);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const [vendorFocus, setVendorFocus] = useState(false);

  // Unique vendor names for typeahead
  const allVendors = useMemo(() => {
    const names = new Set([..._FE.map(e => e.vendor), ..._CON.map(c => c.name)]);
    return [...names].filter(Boolean).sort();
  }, [expenses]);

  // Rehab items for selected flip
  const expFlip = _FLIPS.find(f => f.id === parseInt(form.flipId));
  const expRehabItems = expFlip?.rehabItems || [];

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = exp => {
    setEditId(exp.id);
    setForm({ flipId: String(exp.flipId), date: exp.date, vendor: exp.vendor || "", category: exp.category, description: exp.description || "", amount: String(exp.amount), rehabItemIdx: exp.rehabItemIdx != null ? String(exp.rehabItemIdx) : "" });
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
  const clearAllFilters = () => { setFilterFlip("all"); setFilterCat("all"); setDateFilter("all"); setDateFrom(""); setDateTo(""); setSearch(""); };
  const hasActiveFilters = filterFlip !== "all" || filterCat !== "all" || dateFilter !== "all" || search;

  const filtered = expenses.filter(e => {
    if (filterFlip !== "all" && e.flipId !== parseInt(filterFlip)) return false;
    if (filterCat  !== "all" && e.category !== filterCat) return false;
    if (search && !e.description.toLowerCase().includes(search.toLowerCase()) && !e.vendor.toLowerCase().includes(search.toLowerCase())) return false;
    if (!matchesDate(e)) return false;
    return true;
  });

  const total     = filtered.reduce((s, e) => s + e.amount, 0);
  const thisMonth = filtered.filter(e => e.date >= "2026-03-01").reduce((s, e) => s + e.amount, 0);

  const catTotals = EXPENSE_CATS.map(cat => ({
    cat, total: filtered.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const handleSave = () => {
    if (!form.amount || !form.flipId) return;
    const flip = _FLIPS.find(f => f.id === parseInt(form.flipId));
    const amt = parseFloat(form.amount);
    const riIdx = form.rehabItemIdx !== "" ? parseInt(form.rehabItemIdx) : null;
    const built = { flipId: parseInt(form.flipId), flipName: flip?.name, date: form.date || new Date().toISOString().split("T")[0], vendor: form.vendor || "Unknown", category: form.category, description: form.description, amount: amt, rehabItemIdx: riIdx };

    if (editId !== null) {
      // Reverse the old rehab item link before applying new one
      const oldExp = expenses.find(e => e.id === editId);
      if (oldExp && oldExp.rehabItemIdx != null && flip) {
        const oldItem = flip.rehabItems[oldExp.rehabItemIdx];
        if (oldItem) oldItem.spent = Math.max(0, oldItem.spent - oldExp.amount);
      }
      setExpenses(prev => prev.map(e => e.id === editId ? { ...e, ...built } : e));
    } else {
      setExpenses(prev => [{ id: newId(), ...built }, ...prev]);
    }
    // Update rehab item spent
    if (riIdx != null && flip && flip.rehabItems[riIdx]) {
      flip.rehabItems[riIdx].spent += amt;
    }
    setForm(emptyForm); setEditId(null); setShowModal(false);
  };

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#f59e0b", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 0 12px" }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Deal
        </button>
      )}
      <PageHeader
        title="Flip Expenses"
        sub="All costs across every fix & flip project"
        action={
          <button onClick={openAdd} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Expense
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={Receipt}    label="Total Expenses"    value={fmt(total)}     sub={`${filtered.length} transactions`} color="#f59e0b" />
        <StatCard icon={Calendar}   label="This Month"        value={fmt(thisMonth)} sub="March 2026"                        color="#3b82f6" />
        <StatCard icon={Hammer}     label="Largest Category"  value={catTotals[0]?.cat || "—"} sub={catTotals[0] ? fmt(catTotals[0].total) : ""}  color="#8b5cf6" />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: hasActiveFilters ? 10 : 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }} />
        </div>
        <select value={filterFlip} onChange={e => setFilterFlip(e.target.value)} style={{ ...iS, width: "auto", minWidth: 160, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All Flips</option>
          {_FLIPS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...iS, width: "auto", minWidth: 160, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All Categories</option>
          {Object.entries(FLIP_EXPENSE_GROUPS).map(([group, subs]) => (
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
            <span style={{ color: "#94a3b8", fontSize: 13, alignSelf: "center" }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...iS, width: "auto", fontSize: 13, padding: "9px 12px" }} />
          </>
        )}
      </div>
      {/* Active filter chips */}
      {hasActiveFilters && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>Filtered:</span>
          {filterFlip !== "all" && <span style={{ background: "#eff6ff", color: "#3b82f6", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{_FLIPS.find(f => f.id === parseInt(filterFlip))?.name || filterFlip}</span>}
          {filterCat !== "all" && <span style={{ background: "#fef9c3", color: "#854d0e", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{filterCat}</span>}
          {dateFilter !== "all" && <span style={{ background: "#f0fdf4", color: "#15803d", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{{ thisMonth: "This Month", lastMonth: "Last Month", thisYear: "This Year", lastYear: "Last Year", custom: dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : "Custom Range" }[dateFilter]}</span>}
          {search && <span style={{ background: "#f1f5f9", color: "#475569", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>&ldquo;{search}&rdquo;</span>}
          <button onClick={clearAllFilters} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear all</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Date", "Flip", "Paid To", "Category", "Description", "Amount", ""].map(h => (
                <th key={h} style={{ textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "12px 16px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "48px 20px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                No expenses match your filters.{" "}
                <button onClick={clearAllFilters} style={{ background: "none", border: "none", color: "#f59e0b", fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
              </td></tr>
            )}
            {filtered.map((e, i) => {
              const flip = _FLIPS.find(f => f.id === e.flipId);
              return (
                <tr key={e.id} ref={e.id === flashId ? highlightRef : undefined} style={{ borderTop: "1px solid #f1f5f9", background: e.id === flashId ? "#fef9c3" : "transparent", transition: "background 1.5s ease" }}>
                  <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 13 }}>{e.date}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {flip && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: flip.color }} />
                        <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{flip.name}</span>
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#0f172a", fontSize: 13, fontWeight: 500 }}>{e.vendor}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: "#f1f5f9", color: "#475569", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{e.category}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 13 }}>{e.description}</td>
                  <td style={{ padding: "12px 16px", color: "#0f172a", fontSize: 13, fontWeight: 700 }}>{fmt(e.amount)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openEdit(e)} style={{ background: "#f1f5f9", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteConfirm(e)} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No expenses found</td></tr>
            )}
          </tbody>
        </table>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #f1f5f9", background: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: 24 }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>Total: <strong style={{ color: "#0f172a" }}>{fmt(total)}</strong></span>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "#0f172a", fontSize: 19, fontWeight: 700 }}>{editId ? "Edit Expense" : "Add Expense"}</h2>
              <button onClick={() => { setShowModal(false); setEditId(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Flip *</p>
                <select value={form.flipId} onChange={sf("flipId")} style={iS}>
                  <option value="">Select flip...</option>
                  {_FLIPS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Date</p>
                  <input type="date" style={iS} value={form.date} onChange={sf("date")} />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Amount *</p>
                  <input type="number" style={iS} placeholder="0.00" value={form.amount} onChange={sf("amount")} />
                </div>
              </div>
              <div style={{ position: "relative" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Paid To</p>
                <input style={iS} placeholder="e.g. Home Depot, ABC Plumbing" value={form.vendor}
                  onChange={e => { setForm(f => ({ ...f, vendor: e.target.value })); setVendorFocus(true); }}
                  onFocus={() => setVendorFocus(true)} onBlur={() => setTimeout(() => setVendorFocus(false), 150)} />
                {vendorFocus && (() => {
                  const q = form.vendor.toLowerCase();
                  const matches = q ? allVendors.filter(v => v.toLowerCase().includes(q) && v.toLowerCase() !== q) : allVendors;
                  const exactExists = allVendors.some(v => v.toLowerCase() === q);
                  const showNew = q && !exactExists;
                  if (matches.length === 0 && !showNew) return null;
                  return (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                      {matches.slice(0, 6).map(v => (
                        <button key={v} onMouseDown={() => { setForm(f => ({ ...f, vendor: v })); setVendorFocus(false); }}
                          style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", textAlign: "left", cursor: "pointer", fontSize: 13, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                          <Users size={13} style={{ color: "#94a3b8", flexShrink: 0 }} />
                          <span>{v}</span>
                        </button>
                      ))}
                      {showNew && (
                        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "#fffbeb", borderTop: matches.length > 0 ? "1px solid #e2e8f0" : "none" }}>
                          <Plus size={13} style={{ color: "#f59e0b", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>Add &ldquo;{form.vendor}&rdquo; as new</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Category</p>
                  <select style={iS} value={form.category} onChange={sf("category")}>
                    {Object.entries(FLIP_EXPENSE_GROUPS).map(([group, subs]) => (
                    <optgroup key={group} label={group}>
                      {subs.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  ))}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Rehab Item <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span></p>
                  <select style={iS} value={form.rehabItemIdx} onChange={sf("rehabItemIdx")}>
                    <option value="">None — general expense</option>
                    {expRehabItems.map((item, idx) => (
                      <option key={idx} value={idx}>{item.category} ({fmt(item.spent)} / {fmt(item.budgeted)})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Description</p>
                <input style={iS} placeholder="Brief description" value={form.description} onChange={sf("description")} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{editId ? "Save Changes" : "Save Expense"}</button>
              <button onClick={() => { setShowModal(false); setEditId(null); }} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#64748b" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: 420, padding: 28 }}>
            <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Delete Expense</h2>
            <p style={{ color: "#475569", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this expense?</p>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{deleteConfirm.description}</p>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{deleteConfirm.vendor} · {deleteConfirm.date} · <span style={{ color: "#b91c1c", fontWeight: 700 }}>${deleteConfirm.amount?.toLocaleString()}</span></p>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { setExpenses(prev => prev.filter(x => x.id !== deleteConfirm.id)); setDeleteConfirm(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
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
  active:   { bg: "#dbeafe", text: "#1d4ed8", label: "Active"   },
  complete: { bg: "#dcfce7", text: "#15803d", label: "Complete" },
  pending:  { bg: "#f1f5f9", text: "#64748b", label: "Pending"  },
};

export function FlipContractors() {
  const [contractors, setContractors] = useState([..._CON]);
  const [, rerender]          = useState(0);
  const [filterFlip, setFilterFlip]     = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showModal, setShowModal]       = useState(false);
  const [editId, setEditId]             = useState(null); // null = add mode
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Map()); // Map<idx, bid>

  const emptyForm = { flipId: "", name: "", trade: "", paymentType: "Fixed Bid", totalBid: "", dayRate: "", phone: "", status: "pending" };
  const [form, setForm] = useState(emptyForm);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const [nameFocus, setNameFocus] = useState(false);

  // Unique contractor names across all deals for typeahead
  const allContractorNames = useMemo(() => {
    const names = new Set(_CON.map(c => c.name));
    return [...names].sort();
  }, [contractors]);

  // Current flip's rehab items for the modal
  const modalFlip     = _FLIPS.find(f => f.id === parseInt(form.flipId));
  const modalItems    = modalFlip?.rehabItems || [];

  const toggleItem = idx => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      next.has(idx) ? next.delete(idx) : next.set(idx, 0);
      return next;
    });
  };

  const setItemBid = (idx, bid) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      next.set(idx, bid);
      return next;
    });
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setSelectedItems(new Map());
    setShowModal(true);
  };

  const openEdit = c => {
    setEditId(c.id);
    setForm({ flipId: String(c.flipId), name: c.name, trade: c.trade || "", paymentType: c.paymentType, totalBid: String(c.totalBid || ""), dayRate: String(c.dayRate || ""), phone: c.phone || "", status: c.status });
    // Pre-select items already assigned to this contractor with their bids
    const flip = _FLIPS.find(f => f.id === c.flipId);
    const preChecked = new Map();
    (flip?.rehabItems || []).forEach((item, idx) => {
      const entry = (item.contractors || []).find(a => a.id === c.id);
      if (entry) preChecked.set(idx, entry.bid || 0);
    });
    setSelectedItems(preChecked);
    setShowModal(true);
  };

  const filtered = contractors.filter(c => {
    if (filterFlip   !== "all" && c.flipId !== parseInt(filterFlip)) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    return true;
  });

  const totalCommitted = contractors.reduce((s, c) => s + (c.totalBid || 0), 0);
  const totalPaid      = contractors.reduce((s, c) => s + (c.totalPaid || 0), 0);
  const outstanding    = totalCommitted - totalPaid;

  const handleSave = () => {
    if (!form.name || !form.flipId) return;
    const fId = parseInt(form.flipId);
    const flip = _FLIPS.find(f => f.id === fId);

    if (editId !== null) {
      // --- EDIT MODE ---
      setContractors(prev => prev.map(c => c.id === editId
        ? { ...c, flipId: fId, name: form.name, trade: form.trade, paymentType: form.paymentType,
            totalBid: parseFloat(form.totalBid) || 0, dayRate: parseFloat(form.dayRate) || 0,
            phone: form.phone, status: form.status }
        : c
      ));
      // Also update _CON in place for cross-module sync
      const ci = _CON.findIndex(c => c.id === editId);
      if (ci !== -1) Object.assign(_CON[ci], { flipId: fId, name: form.name, trade: form.trade, paymentType: form.paymentType, totalBid: parseFloat(form.totalBid) || 0, dayRate: parseFloat(form.dayRate) || 0, phone: form.phone, status: form.status });
      // Sync rehab item assignments for this contractor
      if (flip) {
        flip.rehabItems.forEach((item, idx) => {
          const cons = item.contractors || [];
          const existing = cons.find(c => c.id === editId);
          const isChecked  = selectedItems.has(idx);
          if (isChecked && !existing) {
            item.contractors = [...cons, { id: editId, bid: selectedItems.get(idx) || 0 }];
          } else if (isChecked && existing) {
            existing.bid = selectedItems.get(idx) || 0;
          } else if (!isChecked && existing) {
            item.contractors = cons.filter(c => c.id !== editId);
          }
        });
      }
    } else {
      // --- ADD MODE ---
      const newCon = { id: newId(), flipId: fId, name: form.name, trade: form.trade, paymentType: form.paymentType, totalBid: parseFloat(form.totalBid) || 0, dayRate: parseFloat(form.dayRate) || 0, totalPaid: 0, status: form.status, phone: form.phone };
      setContractors(prev => [...prev, newCon]);
      _CON.push(newCon);
      // Assign selected rehab items with per-item bids
      if (flip) {
        selectedItems.forEach((bid, idx) => {
          const item = flip.rehabItems[idx];
          if (item && !(item.contractors || []).some(c => c.id === newCon.id)) {
            item.contractors = [...(item.contractors || []), { id: newCon.id, bid: bid || 0 }];
          }
        });
      }
    }

    rerender(n => n + 1);
    setForm(emptyForm);
    setSelectedItems(new Map());
    setShowModal(false);
  };

  return (
    <div>
      <PageHeader
        title="Contractors"
        sub="All contractors and subcontractors across your flips"
        action={
          <button onClick={openAdd} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Contractor
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={Users}      label="Total Contractors" value={contractors.length}   sub={`${contractors.filter(c=>c.status==="active").length} active`}  color="#f59e0b" />
        <StatCard icon={DollarSign} label="Total Committed"   value={fmt(totalCommitted)}  sub="Across all flips"  color="#3b82f6" />
        <StatCard icon={CheckCircle}label="Total Paid"        value={fmt(totalPaid)}        sub="Disbursed to date" color="#10b981" />
        <StatCard icon={AlertCircle}label="Outstanding"       value={fmt(outstanding)}      sub="Remaining balance" color="#f59e0b" />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <select value={filterFlip} onChange={e => setFilterFlip(e.target.value)} style={{ ...iS, width: "auto", padding: "8px 12px", fontSize: 13 }}>
          <option value="all">All Flips</option>
          {_FLIPS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...iS, width: "auto", padding: "8px 12px", fontSize: 13 }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="complete">Complete</option>
          <option value="pending">Pending</option>
        </select>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#64748b", display: "flex", alignItems: "center" }}>
          {filtered.length} contractors
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {filtered.map(c => {
          const flip = _FLIPS.find(f => f.id === c.flipId);
          const ss = STATUS_STYLES[c.status] || STATUS_STYLES.pending;
          const pct = c.totalBid > 0 ? Math.min((c.totalPaid / c.totalBid) * 100, 100) : 0;
          return (
            <div key={c.id} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Truck size={18} color="#64748b" />
                  </div>
                  <div>
                    <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 14 }}>{c.name}</p>
                    <p style={{ color: "#94a3b8", fontSize: 12 }}>{c.trade} · {c.phone || "—"}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: ss.bg, color: ss.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{ss.label}</span>
                  <button onClick={() => openEdit(c)} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => setDeleteConfirm(c)} style={{ background: "#fee2e2", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }} title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {flip && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: flip.color }} />
                  <span style={{ fontSize: 12, color: "#64748b" }}>{flip.name}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  {c.paymentType === "Day Rate" ? `Day Rate: $${c.dayRate}/day` : `Bid: ${fmt(c.totalBid)}`}
                </span>
                <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>{fmt(c.totalPaid)} paid</span>
              </div>
              {c.paymentType !== "Day Rate" && (
                <div style={{ background: "#f1f5f9", borderRadius: 4, height: 5, overflow: "hidden", marginBottom: 14 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#10b981", borderRadius: 4 }} />
                </div>
              )}

              {/* Assigned Scope — per-item bids */}
              {(() => {
                const scope = [];
                _FLIPS.forEach(fl => {
                  (fl.rehabItems || []).forEach(item => {
                    const entry = (item.contractors || []).find(a => a.id === c.id);
                    if (entry) {
                      const totalOnItem = (item.contractors || []).length;
                      scope.push({ flipName: fl.name, flipColor: fl.color, label: item.category, itemBudget: item.budgeted, bid: entry.bid || 0, status: item.status, sharedWith: totalOnItem - 1 });
                    }
                  });
                });
                if (scope.length === 0) return null;
                const totalBids = scope.reduce((s, item) => s + item.bid, 0);
                return (
                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12, marginTop: c.paymentType === "Day Rate" ? 14 : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Assigned Scope ({scope.length})</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Total Bids: {c.paymentType === "Day Rate" ? `$${c.dayRate}/day` : fmt(totalBids)}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {scope.map((item, i) => {
                        const sSt = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", borderRadius: 7, padding: "5px 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.flipColor, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                              {item.bid > 0 && <span style={{ fontSize: 11, color: "#0f172a", fontWeight: 600 }}>Bid: {fmt(item.bid)}</span>}
                              {item.bid === 0 && <span style={{ fontSize: 11, color: "#cbd5e1", fontStyle: "italic" }}>No bid</span>}
                              {item.sharedWith > 0 && (
                                <span style={{ fontSize: 10, color: "#64748b", background: "#e2e8f0", borderRadius: 10, padding: "2px 7px", fontWeight: 500 }}>+{item.sharedWith} other{item.sharedWith > 1 ? "s" : ""}</span>
                              )}
                              <span style={{ background: sSt.bg, color: sSt.text, borderRadius: 20, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>{sSt.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            No contractors found
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: 520, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "#0f172a", fontSize: 19, fontWeight: 700 }}>{editId ? "Edit Contractor" : "Add Contractor"}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Flip *</p>
                <select style={iS} value={form.flipId} onChange={e => { sf("flipId")(e); setSelectedItems(new Set()); }} disabled={!!editId}>
                  <option value="">Select flip...</option>
                  {_FLIPS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Company / Name *</p>
                  <input style={iS} placeholder="ABC Plumbing" value={form.name}
                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setNameFocus(true); }}
                    onFocus={() => setNameFocus(true)} onBlur={() => setTimeout(() => setNameFocus(false), 150)} />
                  {nameFocus && (() => {
                    const q = form.name.toLowerCase();
                    const matches = q ? allContractorNames.filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q) : allContractorNames;
                    const exactExists = allContractorNames.some(n => n.toLowerCase() === q);
                    const showNew = q && !exactExists;
                    if (matches.length === 0 && !showNew) return null;
                    return (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                        {matches.slice(0, 6).map(n => {
                          const existing = _CON.find(c => c.name === n);
                          return (
                            <button key={n} onMouseDown={() => {
                              setForm(f => ({ ...f, name: n, trade: existing?.trade || f.trade }));
                              setNameFocus(false);
                            }}
                              style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", textAlign: "left", cursor: "pointer", fontSize: 13, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                              <Wrench size={13} style={{ color: "#94a3b8", flexShrink: 0 }} />
                              <span>{n}</span>
                              {existing?.trade && <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>{existing.trade}</span>}
                            </button>
                          );
                        })}
                        {showNew && (
                          <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "#fffbeb", borderTop: matches.length > 0 ? "1px solid #e2e8f0" : "none" }}>
                            <Plus size={13} style={{ color: "#f59e0b", flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>Add &ldquo;{form.name}&rdquo; as new</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Trade</p>
                  <input style={iS} placeholder="Plumbing" value={form.trade} onChange={sf("trade")} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Payment Type</p>
                  <select style={iS} value={form.paymentType} onChange={sf("paymentType")}>
                    <option>Fixed Bid</option>
                    <option>Day Rate</option>
                    <option>Time & Materials</option>
                  </select>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{form.paymentType === "Day Rate" ? "Day Rate ($)" : "Total Bid ($)"}</p>
                  <input type="number" style={iS} placeholder="0" value={form.paymentType === "Day Rate" ? form.dayRate : form.totalBid} onChange={sf(form.paymentType === "Day Rate" ? "dayRate" : "totalBid")} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Phone</p>
                  <input style={iS} placeholder="555-000-0000" value={form.phone} onChange={sf("phone")} />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Status</p>
                  <select style={iS} value={form.status} onChange={sf("status")}>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="complete">Complete</option>
                  </select>
                </div>
              </div>

              {/* Rehab Item Assignment with per-item bids */}
              {modalItems.length > 0 && (
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14, marginTop: 2 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Assign Rehab Scope</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {modalItems.map((item, idx) => {
                      const checked = selectedItems.has(idx);
                      const otherCons = (item.contractors || []).filter(c => c.id !== editId);
                      return (
                        <div key={idx} style={{ borderRadius: 8, background: checked ? "#fef9c3" : "#f8fafc", border: `1px solid ${checked ? "#fde68a" : "#f1f5f9"}`, overflow: "hidden" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", cursor: "pointer" }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleItem(idx)} style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#f59e0b" }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{item.category}</span>
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>Budget: {fmt(item.budgeted)}</span>
                            {otherCons.length > 0 && (
                              <span style={{ fontSize: 11, color: "#64748b", background: "#e2e8f0", borderRadius: 10, padding: "2px 7px" }}>
                                +{otherCons.length} assigned
                              </span>
                            )}
                          </label>
                          {checked && (
                            <div style={{ padding: "4px 10px 8px 39px", display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>Bid $</span>
                              <input type="number" placeholder="0" value={selectedItems.get(idx) || ""}
                                onChange={e => setItemBid(idx, parseFloat(e.target.value) || 0)}
                                onClick={e => e.stopPropagation()}
                                style={{ ...iS, padding: "5px 8px", fontSize: 12, width: 110 }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {selectedItems.size > 0 && (
                    <p style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600, marginTop: 8 }}>
                      {selectedItems.size} scope{selectedItems.size > 1 ? "s" : ""} selected · {fmt([...selectedItems.values()].reduce((s, bid) => s + (bid || 0), 0))} total bids
                    </p>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                {editId ? "Save Changes" : "Add Contractor"}
              </button>
              <button onClick={() => setShowModal(false)} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#64748b" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: 420, padding: 28 }}>
            <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Delete Contractor</h2>
            <p style={{ color: "#475569", fontSize: 14, marginBottom: 8 }}>Are you sure you want to remove this contractor?</p>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{deleteConfirm.name}</p>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{deleteConfirm.trade} · {deleteConfirm.paymentType}</p>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { setContractors(prev => prev.filter(x => x.id !== deleteConfirm.id)); const ci = _CON.findIndex(x => x.id === deleteConfirm.id); if (ci !== -1) _CON.splice(ci, 1); setDeleteConfirm(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. FLIP ANALYTICS
// ---------------------------------------------------------------------------
export function FlipAnalytics() {
  const [filterDeal, setFilterDeal] = useState("all");

  const allFlips = _FLIPS;
  const flips = allFlips;
  const sold  = flips.filter(f => f.stage === "Sold");

  const roiData = flips.map(f => {
    const cost = f.purchasePrice + (f.stage === "Sold" ? f.rehabSpent : f.rehabBudget);
    const sale = f.stage === "Sold" ? f.salePrice : f.arv;
    const profit = sale - cost - (f.stage === "Sold" ? f.sellingCosts + f.totalHoldingCosts : (sale * 0.06) + (f.holdingCostsPerMonth * (f.daysOwned || 0) / 30));
    const roi = cost > 0 ? ((profit / cost) * 100).toFixed(1) : 0;
    return { name: f.image, fullName: f.name, roi: parseFloat(roi), profit: Math.round(profit), stage: f.stage, color: f.color };
  });

  const budgetVsActual = flips.filter(f => f.rehabSpent > 0).map(f => ({
    name: f.image, budget: f.rehabBudget, actual: f.rehabSpent,
    variance: f.rehabBudget - f.rehabSpent,
  }));

  const timelineData = flips.filter(f => f.daysOwned > 0).map(f => ({
    name: f.image, days: f.daysOwned, stage: f.stage, color: f.color,
  }));

  const flipIds = new Set(flips.map(f => f.id));
  const catSpend = _FE.filter(e => flipIds.has(e.flipId)).reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const catChartData = Object.entries(catSpend).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];

  // Monthly expense trend – group all flip expenses by month
  const monthlyTrend = useMemo(() => {
    const filtered = _FE.filter(e => flipIds.has(e.flipId));
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
  }, [flips]);

  // Profit breakdown per deal – stacked components
  const profitBreakdown = flips.map(f => {
    const purchase = f.purchasePrice;
    const rehab = f.stage === "Sold" ? f.rehabSpent : f.rehabBudget;
    const holding = f.stage === "Sold" ? f.totalHoldingCosts : (f.holdingCostsPerMonth * ((f.daysOwned || 0) / 30));
    const selling = f.stage === "Sold" ? f.sellingCosts : ((f.stage === "Sold" ? f.salePrice : f.arv) * 0.06);
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
  const singleDeal = filterDeal !== "all" ? allFlips.find(f => f.id === parseInt(filterDeal)) : null;

  // Single-deal computed data
  const dealExpenses = singleDeal ? _FE.filter(e => e.flipId === singleDeal.id).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const dealCatSpend = singleDeal ? dealExpenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {}) : {};
  const dealCatChart = Object.entries(dealCatSpend).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Cumulative spend curve for single deal
  const spendCurve = useMemo(() => {
    if (!singleDeal || dealExpenses.length === 0) return [];
    let cumulative = 0;
    const points = dealExpenses.map(e => {
      cumulative += e.amount;
      const d = new Date(e.date);
      return { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), spent: cumulative, budget: singleDeal.rehabBudget };
    });
    return points;
  }, [singleDeal, dealExpenses]);

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

  const cardS = { background: "#fff", borderRadius: 14, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" };

  return (
    <div>
      {/* Header — matches rental Analytics pattern */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Flip Analytics</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>
            {singleDeal ? `Performance details — ${singleDeal.name}` : "Performance metrics across all deals"}
          </p>
        </div>
      </div>

      {/* Deal selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterDeal} onChange={e => setFilterDeal(e.target.value)} style={{ ...iS, width: "auto", minWidth: 220, fontSize: 13, padding: "9px 12px", fontWeight: 600 }}>
          <option value="all">All Deals</option>
          {allFlips.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {filterDeal !== "all" && (
          <button onClick={() => setFilterDeal("all")} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filter
          </button>
        )}
      </div>

      {/* ======== SINGLE-DEAL VIEW ======== */}
      {singleDeal ? (<>
        {/* Deal Return Scorecard — matches rental property scorecard */}
        <div style={{ ...sectionS, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: singleDeal.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: singleDeal.color }}>{singleDeal.image}</div>
            <div>
              <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Deal Scorecard</h3>
              <p style={{ color: "#94a3b8", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {singleDeal.address}</p>
            </div>
            <div style={{ marginLeft: "auto" }}><StageDot stage={singleDeal.stage} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
            {[
              { label: "Projected ROI", value: `${dealROI?.roi || 0}%`, color: "#10b981", sub: singleDeal.stage === "Sold" ? "Realized return" : "Estimated return", tip: "Return on Investment = (Sale Price \u2212 Total Cost) \u00f7 Total Cost \u00d7 100. Total Cost includes purchase, rehab, holding, and selling costs." },
              { label: "Projected Profit", value: fmt(dealROI?.profit || 0), color: "#8b5cf6", sub: singleDeal.stage === "Sold" ? "Realized" : "Based on ARV", tip: "ARV (or Sale Price) minus all costs: purchase price, rehab, holding costs, and estimated 6% selling costs." },
              { label: "Cost Per Day", value: dealCostPerDay > 0 ? `${fmt(dealCostPerDay)}/day` : "N/A", color: "#f59e0b", sub: `${singleDeal.daysOwned || 0} days owned`, tip: "Total spend (rehab + holding costs) divided by days owned. Helps quantify the daily burn rate on this deal." },
            ].map((m, i) => (
              <div key={i} style={{ background: "#f8fafc", borderRadius: 14, padding: "18px 16px", border: "1px solid #f1f5f9" }}>
                <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                <p style={{ color: m.color, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{m.value}</p>
                <p style={{ color: "#94a3b8", fontSize: 11 }}>{m.sub}</p>
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
              <div key={item.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", margin: 0, display: "flex", alignItems: "center" }}>{item.label}<InfoTip text={item.tip} /></p>
                <p style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, margin: "4px 0 0" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Cumulative Spend Curve */}
          <div style={sectionS}>
            <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Rehab Spend Curve</h3>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Cumulative spend vs budget over time</p>
            {spendCurve.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={spendCurve}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <ReferenceLine y={singleDeal.rehabBudget} stroke="#ef4444" strokeDasharray="6 4" label={{ value: "Budget", position: "right", fontSize: 11, fill: "#ef4444" }} />
                  <Area type="monotone" dataKey="spent" stroke="#f59e0b" strokeWidth={2.5} fill="url(#spendGrad)" dot={{ fill: "#f59e0b", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>No expenses recorded yet</div>
            )}
          </div>

          {/* Expense Category Breakdown (single deal) */}
          <div style={sectionS}>
            <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cost Breakdown</h3>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Expenses by category</p>
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
                        <span style={{ fontSize: 12, color: "#374151" }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>No expenses recorded yet</div>
            )}
          </div>
        </div>

        {/* Rehab Item Progress */}
        <div style={{ ...sectionS, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Rehab Item Progress</h3>
              <p style={{ color: "#94a3b8", fontSize: 13 }}>Budget consumed per line item</p>
            </div>
            {rehabProgress.length > 0 && (() => {
              const done = rehabProgress.filter(r => r.status === "complete").length;
              const over = rehabProgress.filter(r => r.pct > 100).length;
              return (
                <div style={{ display: "flex", gap: 16 }}>
                  {[
                    { color: "#10b981", label: `${done} Complete` },
                    { color: "#f59e0b", label: `${rehabProgress.length - done - over} In Progress` },
                    ...(over > 0 ? [{ color: "#ef4444", label: `${over} Over Budget` }] : []),
                  ].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{l.label}</span>
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
                const barColor = item.status === "complete" ? "#10b981" : overBudget ? "#ef4444" : "#f59e0b";
                const statusIcon = item.status === "complete" ? CheckCircle : item.status === "in-progress" ? Clock : AlertCircle;
                const StatusIcon = statusIcon;
                const remaining = item.budgeted - item.spent;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Status icon + category name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, width: 160, flexShrink: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: item.status === "complete" ? "#dcfce7" : item.status === "in-progress" ? "#fef3c7" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <StatusIcon size={13} color={item.status === "complete" ? "#16a34a" : item.status === "in-progress" ? "#d97706" : "#94a3b8"} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.fullName}>{item.fullName}</p>
                        <p style={{ fontSize: 10, color: "#94a3b8", textTransform: "capitalize" }}>{item.status.replace("-", " ")}</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", height: 24, background: "#f8fafc", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                        <div style={{ width: `${Math.min(item.pct, 100)}%`, height: "100%", background: barColor, borderRadius: 6, transition: "width 0.3s", minWidth: item.pct > 0 ? 2 : 0 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>{fmt(item.spent)} of {fmt(item.budgeted)}</span>
                        <span style={{ fontSize: 10, color: overBudget ? "#ef4444" : "#94a3b8", fontWeight: overBudget ? 600 : 400 }}>
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
            <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No rehab items configured</div>
          )}
        </div>

        {/* Expense Log */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
            <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700 }}>Expense Log</h3>
          </div>
          {dealExpenses.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Date", "Paid To", "Category", "Description", "Amount"].map(h => (
                    <th key={h} style={{ textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "10px 16px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealExpenses.map(e => (
                  <tr key={e.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 16px", color: "#64748b", fontSize: 13 }}>{new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td style={{ padding: "10px 16px", color: "#0f172a", fontSize: 13, fontWeight: 500 }}>{e.vendor}</td>
                    <td style={{ padding: "10px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "#f1f5f9", color: "#64748b" }}>{e.category}</span></td>
                    <td style={{ padding: "10px 16px", color: "#64748b", fontSize: 13 }}>{e.description}</td>
                    <td style={{ padding: "10px 16px", color: "#0f172a", fontSize: 13, fontWeight: 600 }}>{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No expenses recorded for this deal</div>
          )}
        </div>
      </>) : (<>

      {/* ======== PORTFOLIO VIEW ======== */}
      {/* KPI cards with InfoTips — matches rental Analytics pattern */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Avg ROI", value: `${avgROI}%`, color: "#10b981", sub: "All deals", tip: "Average Return on Investment across all deals. ROI = (Sale/ARV \u2212 Total Cost) \u00f7 Total Cost \u00d7 100. Active deals use projected ARV and estimated costs." },
          { label: "Avg Hold Time", value: `${avgDays} days`, color: "#3b82f6", sub: "Active deals", tip: "Average number of days properties have been owned. Shorter hold times mean less carrying cost and faster capital recycling." },
          { label: "Total Realized", value: fmt(totalProfit), color: "#8b5cf6", sub: "Closed deals", tip: "Sum of net profit from all sold deals. Net Profit = Sale Price \u2212 Purchase Price \u2212 Rehab Spent \u2212 Holding Costs \u2212 Selling Costs." },
          { label: "Deals Analyzed", value: flips.length, color: "#f59e0b", sub: `${sold.length} closed`, tip: "Total number of deals in your pipeline. Includes active, listed, under contract, and sold properties." },
        ].map((m, i) => (
          <div key={i} style={cardS}>
            <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: m.color, fontSize: 22, fontWeight: 800 }}>{m.value}</p>
            <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>{m.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* ROI by Deal */}
        <div style={sectionS}>
          <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>ROI by Deal</h3>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Actual (sold) vs projected (active)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={roiData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v, n, p) => [`${v}%`, "ROI"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="roi" radius={[6, 6, 0, 0]}>
                {roiData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Category Breakdown */}
        <div style={sectionS}>
          <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Expense Breakdown</h3>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>By category across all flips</p>
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
                    <span style={{ fontSize: 12, color: "#374151" }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{fmt(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Budget vs Actual */}
      <div style={sectionS}>
        <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Rehab Budget vs Actual</h3>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>How well rehab budgets are holding</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={budgetVsActual}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
            <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Legend />
            <Bar dataKey="budget" fill="#3b82f6" name="Budgeted" radius={[4, 4, 0, 0]} />
            <Bar dataKey="actual" fill="#f59e0b" name="Actual"   radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Hold Time by Deal */}
        <div style={sectionS}>
          <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Hold Time by Deal</h3>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Days owned per property{avgDays > 0 ? ` (avg ${avgDays}d)` : ""}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timelineData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}d`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={v => [`${v} days`, "Hold Time"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="days" radius={[0, 6, 6, 0]}>
                {timelineData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Expense Trend */}
        <div style={sectionS}>
          <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Monthly Expense Trend</h3>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Total spend by month</p>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={v => [fmt(v), "Spent"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>No expense data available</div>
          )}
        </div>
      </div>

      {/* Profit Breakdown by Deal */}
      <div style={sectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Profit Breakdown by Deal</h3>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>Cost components vs sale price — hover segments for details</p>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { color: "#3b82f6", label: "Purchase" },
              { color: "#f59e0b", label: "Rehab" },
              { color: "#8b5cf6", label: "Holding" },
              { color: "#94a3b8", label: "Selling" },
              { color: "#10b981", label: "Profit" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {profitBreakdown.map((d, i) => {
            const maxVal = Math.max(...profitBreakdown.map(x => x.sale));
            const segments = [
              { key: "purchase", value: d.purchase, color: "#3b82f6", label: "Purchase" },
              { key: "rehab", value: d.rehab, color: "#f59e0b", label: "Rehab" },
              { key: "holding", value: d.holding, color: "#8b5cf6", label: "Holding" },
              { key: "selling", value: d.selling, color: "#94a3b8", label: "Selling" },
            ];
            const profitPct = maxVal > 0 ? (Math.max(d.profit, 0) / maxVal) * 100 : 0;
            const costPct = maxVal > 0 ? (d.totalCost / maxVal) * 100 : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, width: 120, flexShrink: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: d.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: d.color }}>{d.name}</div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", lineHeight: 1.2 }}>{d.fullName.split(" ")[0]}</p>
                    <p style={{ fontSize: 10, color: "#94a3b8" }}>{d.stage}</p>
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 2, height: 28, background: "#f8fafc", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                  {segments.map(seg => {
                    const pct = maxVal > 0 ? (seg.value / maxVal) * 100 : 0;
                    if (pct < 0.5) return null;
                    return (
                      <div key={seg.key} title={`${seg.label}: ${fmt(seg.value)}`} style={{ width: `${pct}%`, height: "100%", background: seg.color, transition: "width 0.3s", cursor: "default", minWidth: pct > 0 ? 2 : 0 }} />
                    );
                  })}
                  {d.profit > 0 && (
                    <div title={`Net Profit: ${fmt(d.profit)}`} style={{ width: `${profitPct}%`, height: "100%", background: "#10b981", borderRadius: "0 6px 6px 0", transition: "width 0.3s", cursor: "default", minWidth: 2 }} />
                  )}
                </div>
                <div style={{ width: 100, textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: d.profit > 0 ? "#10b981" : "#ef4444" }}>{fmt(d.profit)}</span>
                  <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{d.margin}% margin</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deal Summary Table */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
          <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700 }}>Deal Summary</h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Deal", "Stage", "Purchase", "Rehab Budget", "ARV / Sale", "Proj. Profit", "ROI"].map(h => (
                <th key={h} style={{ textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "10px 16px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roiData.map((d, i) => {
              const flip = flips[i];
              return (
                <tr key={flip.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: flip.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: flip.color }}>{flip.image}</div>
                      <span style={{ color: "#0f172a", fontSize: 13, fontWeight: 600 }}>{flip.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}><StageDot stage={flip.stage} /></td>
                  <td style={{ padding: "12px 16px", color: "#0f172a", fontSize: 13 }}>{fmt(flip.purchasePrice)}</td>
                  <td style={{ padding: "12px 16px", color: "#0f172a", fontSize: 13 }}>{fmt(flip.rehabBudget)}</td>
                  <td style={{ padding: "12px 16px", color: "#0f172a", fontSize: 13 }}>{fmt(flip.stage === "Sold" ? flip.salePrice : flip.arv)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ color: d.profit > 0 ? "#10b981" : "#ef4444", fontWeight: 700, fontSize: 13 }}>{fmt(d.profit)}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ color: d.roi > 0 ? "#10b981" : "#ef4444", fontWeight: 700, fontSize: 13 }}>{d.roi}%</span>
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
export function FlipMilestones() {
  const [filterFlip, setFilterFlip] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [, rerender] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [msForm, setMsForm] = useState({ flipId: "", label: "", targetDate: "" });
  const [editItem, setEditItem] = useState(null); // { flipId, idx }
  const [editForm, setEditForm] = useState({ label: "", targetDate: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { flipId, idx, label }

  // Build flat list of all milestones across deals
  const allMilestones = useMemo(() => {
    const list = [];
    _FLIPS.forEach(f => {
      const ms = _FM[f.id] || DEFAULT_MILESTONES.map(label => ({ label, done: false, date: null, targetDate: null }));
      ms.forEach((m, idx) => {
        list.push({ ...m, flipId: f.id, flipName: f.name, flipColor: f.color, flipImage: f.image, flipStage: f.stage, _idx: idx });
      });
    });
    return list;
  }, []);

  const filtered = allMilestones.filter(m => {
    if (filterFlip !== "all" && m.flipId !== parseInt(filterFlip)) return false;
    if (filterStatus === "done" && !m.done) return false;
    if (filterStatus === "upcoming" && m.done) return false;
    if (filterStatus === "overdue" && (m.done || !m.targetDate || m.targetDate >= new Date().toISOString().split("T")[0])) return false;
    return true;
  });

  const totalDone = filtered.filter(m => m.done).length;
  const totalUpcoming = filtered.filter(m => !m.done).length;
  const today = new Date().toISOString().split("T")[0];
  const totalOverdue = filtered.filter(m => !m.done && m.targetDate && m.targetDate < today).length;

  const clearFilters = () => { setFilterFlip("all"); setFilterStatus("all"); };
  const hasFilters = filterFlip !== "all" || filterStatus !== "all";

  const toggleMilestone = (flipId, idx) => {
    const ms = _FM[flipId];
    if (ms && ms[idx]) {
      ms[idx].done = !ms[idx].done;
      ms[idx].date = ms[idx].done ? new Date().toISOString().split("T")[0] : null;
      rerender(n => n + 1);
    }
  };

  const saveMilestone = () => {
    const fId = parseInt(msForm.flipId);
    if (!fId || !msForm.label.trim()) return;
    if (!_FM[fId]) _FM[fId] = [];
    _FM[fId].push({ label: msForm.label.trim(), done: false, date: null, targetDate: msForm.targetDate || null });
    setMsForm({ flipId: "", label: "", targetDate: "" });
    setShowAdd(false);
    rerender(n => n + 1);
  };

  const startEdit = (flipId, idx, m) => {
    setEditItem({ flipId, idx });
    setEditForm({ label: m.label, targetDate: m.targetDate || "" });
  };

  const saveEdit = () => {
    if (!editItem) return;
    const ms = _FM[editItem.flipId];
    if (ms && ms[editItem.idx]) {
      ms[editItem.idx].label = editForm.label.trim() || ms[editItem.idx].label;
      ms[editItem.idx].targetDate = editForm.targetDate || null;
    }
    setEditItem(null);
    rerender(n => n + 1);
  };

  const deleteMilestone = () => {
    if (!deleteConfirm) return;
    const ms = _FM[deleteConfirm.flipId];
    if (ms) { ms.splice(deleteConfirm.idx, 1); }
    setDeleteConfirm(null);
    rerender(n => n + 1);
  };

  // Group by deal for display
  const groupedByDeal = {};
  filtered.forEach(m => {
    if (!groupedByDeal[m.flipId]) groupedByDeal[m.flipId] = { flip: { id: m.flipId, name: m.flipName, color: m.flipColor, image: m.flipImage, stage: m.flipStage }, items: [] };
    groupedByDeal[m.flipId].items.push(m);
  });

  return (
    <div>
      <PageHeader
        title="Milestones"
        sub="Track progress across all your flips"
        action={
          <button onClick={() => setShowAdd(true)} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Milestone
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={CheckCircle} label="Completed" value={totalDone} sub={`of ${filtered.length} total`} color="#10b981" />
        <StatCard icon={Clock} label="Upcoming" value={totalUpcoming} sub="Not yet done" color="#3b82f6" />
        <StatCard icon={AlertCircle} label="Overdue" value={totalOverdue} sub="Past target date" color={totalOverdue > 0 ? "#ef4444" : "#94a3b8"} />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: hasFilters ? 10 : 20, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterFlip} onChange={e => setFilterFlip(e.target.value)} style={{ ...iS, width: "auto", minWidth: 160, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All Deals</option>
          {_FLIPS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...iS, width: "auto", minWidth: 140, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All Statuses</option>
          <option value="done">Completed</option>
          <option value="upcoming">Upcoming</option>
          <option value="overdue">Overdue</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
        )}
      </div>

      {/* Grouped by deal */}
      {Object.values(groupedByDeal).length === 0 ? (
        <div style={{ ...sectionS, textAlign: "center", padding: 48, color: "#94a3b8" }}>
          <Flag size={32} style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ fontWeight: 600, marginBottom: 4 }}>No milestones match your filters</p>
          {hasFilters && <button onClick={clearFilters} style={{ background: "none", border: "none", color: "#f59e0b", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>}
        </div>
      ) : Object.values(groupedByDeal).map(({ flip, items }) => {
        const done = items.filter(m => m.done).length;
        const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
        return (
          <div key={flip.id} style={{ ...sectionS }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: flip.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: flip.color }}>{flip.image}</div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{flip.name}</p>
                  <p style={{ fontSize: 12, color: "#94a3b8" }}>{flip.stage}</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{pct}%</p>
                <p style={{ fontSize: 11, color: "#94a3b8" }}>{done} of {items.length}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ background: "#f1f5f9", borderRadius: 6, height: 6, marginBottom: 16, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "#10b981", borderRadius: 6, transition: "width 0.3s" }} />
            </div>
            {/* Milestone rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((m, i) => {
                const overdue = !m.done && m.targetDate && m.targetDate < today;
                const isEditing = editItem?.flipId === flip.id && editItem?.idx === m._idx;
                return isEditing ? (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a" }}>
                    <input value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} style={{ ...iS, flex: 1, padding: "6px 10px", fontSize: 13 }} placeholder="Milestone label" />
                    <input type="date" value={editForm.targetDate} onChange={e => setEditForm(f => ({ ...f, targetDate: e.target.value }))} style={{ ...iS, width: 140, padding: "6px 10px", fontSize: 12 }} />
                    <button onClick={saveEdit} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditItem(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}><X size={14} /></button>
                  </div>
                ) : (
                  <div key={i} className="ms-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 8, background: m.done ? "#f0fdf4" : overdue ? "#fef2f2" : "#f8fafc", border: `1px solid ${m.done ? "#bbf7d0" : overdue ? "#fecaca" : "#f1f5f9"}`, position: "relative" }}>
                    <button onClick={() => toggleMilestone(flip.id, m._idx)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
                      {m.done ? <CheckCircle size={18} color="#10b981" /> : <Circle size={18} color={overdue ? "#ef4444" : "#cbd5e1"} />}
                    </button>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: m.done ? "#6b7280" : "#0f172a", textDecoration: m.done ? "line-through" : "none" }}>{m.label}</span>
                    {m.targetDate && (
                      <span style={{ fontSize: 11, color: overdue ? "#ef4444" : "#94a3b8", fontWeight: overdue ? 600 : 400, flexShrink: 0 }}>
                        {overdue ? "Overdue: " : "Target: "}{new Date(m.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {m.done && m.date && (
                      <span style={{ fontSize: 11, color: "#10b981", flexShrink: 0 }}>
                        {new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 4 }}>
                      <button onClick={() => startEdit(flip.id, m._idx, m)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }} title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteConfirm({ flipId: flip.id, idx: m._idx, label: m.label })} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }} title="Delete"><Trash2 size={13} /></button>
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
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "#0f172a", fontSize: 19, fontWeight: 700 }}>Add Milestone</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Deal</p>
                <select value={msForm.flipId} onChange={e => setMsForm(f => ({ ...f, flipId: e.target.value }))} style={iS}>
                  <option value="">Select a deal...</option>
                  {_FLIPS.filter(f => f.stage !== "Sold").map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Milestone Label</p>
                <input value={msForm.label} onChange={e => setMsForm(f => ({ ...f, label: e.target.value }))} style={iS} placeholder="e.g. Inspection Complete" />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Target Date <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span></p>
                <input type="date" value={msForm.targetDate} onChange={e => setMsForm(f => ({ ...f, targetDate: e.target.value }))} style={iS} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveMilestone} disabled={!msForm.flipId || !msForm.label.trim()} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: !msForm.flipId || !msForm.label.trim() ? "#e2e8f0" : "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 14, cursor: !msForm.flipId || !msForm.label.trim() ? "not-allowed" : "pointer" }}>Add Milestone</button>
              <button onClick={() => setShowAdd(false)} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#64748b" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: 420, padding: 28 }}>
            <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Delete Milestone</h2>
            <p style={{ color: "#475569", fontSize: 14, marginBottom: 8 }}>Are you sure you want to remove this milestone?</p>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{deleteConfirm.label}</p>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={deleteMilestone} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Delete</button>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#64748b" }}>Cancel</button>
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
export function FlipNotes() {
  const [filterFlip, setFilterFlip] = useState("all");
  const [search, setSearch] = useState("");
  const [, rerender] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [noteForm, setNoteForm] = useState({ flipId: "", text: "" });
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Build flat list of all notes across deals
  const allNotes = useMemo(() => {
    const list = [];
    _FLIPS.forEach(f => {
      (_FN[f.id] || []).forEach(n => {
        list.push({ ...n, flipId: f.id, flipName: f.name, flipColor: f.color, flipImage: f.image });
      });
    });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, []);

  const filtered = allNotes.filter(n => {
    if (filterFlip !== "all" && n.flipId !== parseInt(filterFlip)) return false;
    if (search && !n.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const clearFilters = () => { setFilterFlip("all"); setSearch(""); };
  const hasFilters = filterFlip !== "all" || search;

  const handleSave = () => {
    if (!noteForm.text.trim() || !noteForm.flipId) return;
    const fId = parseInt(noteForm.flipId);
    if (!_FN[fId]) _FN[fId] = [];
    if (editId !== null) {
      const idx = _FN[fId].findIndex(n => n.id === editId);
      if (idx !== -1) _FN[fId][idx] = { ..._FN[fId][idx], text: noteForm.text.trim() };
    } else {
      _FN[fId].unshift({ id: newId(), date: new Date().toISOString().split("T")[0], text: noteForm.text.trim() });
    }
    setNoteForm({ flipId: "", text: "" });
    setEditId(null);
    setShowAdd(false);
    rerender(n => n + 1);
  };

  const handleDelete = (note) => {
    if (!_FN[note.flipId]) return;
    _FN[note.flipId] = _FN[note.flipId].filter(n => n.id !== note.id);
    setDeleteConfirm(null);
    rerender(n => n + 1);
  };

  const openEdit = (note) => {
    setEditId(note.id);
    setNoteForm({ flipId: String(note.flipId), text: note.text });
    setShowAdd(true);
  };

  // Group by date
  const grouped = {};
  filtered.forEach(n => {
    const label = new Date(n.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (!grouped[n.date]) grouped[n.date] = { label, notes: [] };
    grouped[n.date].notes.push(n);
  });

  const totalNotes = allNotes.length;
  const dealsWithNotes = new Set(allNotes.map(n => n.flipId)).size;

  return (
    <div>
      <PageHeader
        title="Deal Notes"
        sub="Activity log and notes across all flips"
        action={
          <button onClick={() => { setEditId(null); setNoteForm({ flipId: _FLIPS[0] ? String(_FLIPS[0].id) : "", text: "" }); setShowAdd(true); }} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Note
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={MessageSquare} label="Total Notes" value={totalNotes} sub="Across all deals" color="#f59e0b" />
        <StatCard icon={Building2} label="Deals with Notes" value={dealsWithNotes} sub={`of ${_FLIPS.length} deals`} color="#3b82f6" />
        <StatCard icon={Calendar} label="Latest Entry" value={allNotes[0] ? new Date(allNotes[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"} sub={allNotes[0]?.flipName || ""} color="#8b5cf6" />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: hasFilters ? 10 : 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..."
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }} />
        </div>
        <select value={filterFlip} onChange={e => setFilterFlip(e.target.value)} style={{ ...iS, width: "auto", minWidth: 160, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All Deals</option>
          {_FLIPS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
        )}
      </div>

      {/* Notes grouped by date */}
      {Object.keys(grouped).length === 0 ? (
        <div style={{ ...sectionS, textAlign: "center", padding: 48, color: "#94a3b8" }}>
          <MessageSquare size={32} style={{ margin: "0 auto 12px", display: "block" }} />
          {hasFilters ? (
            <>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No notes match your filters</p>
              <button onClick={clearFilters} style={{ background: "none", border: "none", color: "#f59e0b", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
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
          <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>{label}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.map(n => (
              <div key={n.id} style={{ ...sectionS, marginBottom: 0, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: n.flipColor + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: n.flipColor }}>{n.flipImage}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{n.flipName}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openEdit(n)} style={{ background: "#f1f5f9", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={12} /></button>
                    <button onClick={() => setDeleteConfirm(n)} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={12} /></button>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{n.text}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add/Edit Note Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "#0f172a", fontSize: 19, fontWeight: 700 }}>{editId ? "Edit Note" : "Add Note"}</h2>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Deal *</p>
                <select style={iS} value={noteForm.flipId} onChange={e => setNoteForm(f => ({ ...f, flipId: e.target.value }))} disabled={!!editId}>
                  <option value="">Select deal...</option>
                  {_FLIPS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Note *</p>
                <textarea style={{ ...iS, minHeight: 120, resize: "vertical", fontFamily: "inherit" }} placeholder="What happened? Decisions made, updates, reminders..." value={noteForm.text} onChange={e => setNoteForm(f => ({ ...f, text: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: (!noteForm.text.trim() || !noteForm.flipId) ? 0.5 : 1 }}>{editId ? "Save Changes" : "Add Note"}</button>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#64748b" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: 420, padding: 28 }}>
            <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Delete Note</h2>
            <p style={{ color: "#475569", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this note?</p>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>{deleteConfirm.text.substring(0, 120)}{deleteConfirm.text.length > 120 ? "..." : ""}</p>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
