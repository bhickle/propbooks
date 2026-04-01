// =============================================================================
// RealVault – Fix & Flip Modules
// FlipDashboard | RehabTracker | FlipExpenses | FlipContractors | FlipAnalytics
// =============================================================================

import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine,
} from "recharts";
import {
  Hammer, DollarSign, TrendingUp, Star, Plus, Search, Filter,
  CheckCircle, Clock, AlertCircle, ChevronRight, X, Trash2, Pencil,
  Wrench, Users, Receipt, BarChart3, Target, Calendar, Flag,
  ArrowUp, ArrowDown, Truck, Building2, MapPin, Home,
} from "lucide-react";
import {
  fmt, fmtK, newId, STAGE_ORDER, STAGE_COLORS,
} from "./api.js";

// Shared mock data refs (passed as props or imported directly)
// Using module-level state so all modules stay in sync within a session
import { FLIPS as _FLIPS, FLIP_EXPENSES as _FE, CONTRACTORS as _CON } from "./api.js";

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
  const complete    = allItems.filter(i => i.status === "complete").length;
  const inProgress  = allItems.filter(i => i.status === "in-progress").length;

  const statusStyle = {
    "complete":    { bg: "#dcfce7", text: "#15803d", label: "Complete"    },
    "in-progress": { bg: "#fef9c3", text: "#a16207", label: "In Progress" },
    "pending":     { bg: "#f1f5f9", text: "#64748b", label: "Pending"     },
  };

  // Assign a contractor to a rehab item — mutates FLIPS directly so contractor
  // cards pick it up without prop-drilling
  function addContractorToItem(flipId, itemIdx, contractorId) {
    const flip = _FLIPS.find(f => f.id === flipId);
    if (flip && flip.rehabItems[itemIdx] !== undefined) {
      const ids = flip.rehabItems[itemIdx].contractorIds || [];
      if (!ids.includes(contractorId)) {
        flip.rehabItems[itemIdx].contractorIds = [...ids, contractorId];
        rerender();
      }
    }
  }

  function removeContractorFromItem(flipId, itemIdx, contractorId) {
    const flip = _FLIPS.find(f => f.id === flipId);
    if (flip && flip.rehabItems[itemIdx] !== undefined) {
      flip.rehabItems[itemIdx].contractorIds = (flip.rehabItems[itemIdx].contractorIds || []).filter(id => id !== contractorId);
      rerender();
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
      contractorIds: [],
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
            <Plus size={16} /> Add Line Item
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
          const assignedCount  = items.filter(i => (i.contractorIds || []).length > 0).length;

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
                    const assignedIds = item.contractorIds || [];
                    const unassigned  = flipContractors.filter(c => !assignedIds.includes(c.id));
                    const isEditing   = editingItem?.flipId === f.id && editingItem?.idx === item._idx;

                    return (
                      <tr key={i} style={{ borderBottom: i < items.length - 1 ? "1px solid #f8fafc" : "none", background: isEditing ? "#fffbeb" : "transparent" }}>
                        {/* Category */}
                        <td style={{ padding: "10px 0 10px", color: "#0f172a", fontSize: 13, fontWeight: 500, paddingRight: 12 }}>
                          {item.category}
                        </td>

                        {/* Contractor cell — supports multiple */}
                        <td style={{ padding: "10px 0", paddingRight: 12, minWidth: 200 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                            {assignedIds.map(cid => {
                              const con = _CON.find(c => c.id === cid);
                              if (!con) return null;
                              const mm1 = item.status === "complete" && con.status !== "complete";
                              const mm2 = con.status === "complete" && item.status !== "complete";
                              return (
                                <div key={cid} style={{ display: "flex", alignItems: "center", gap: 5, background: "#f1f5f9", borderRadius: 20, padding: "4px 8px 4px 6px" }}>
                                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Truck size={9} color="#fff" />
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{con.name}</span>
                                  <button onClick={() => removeContractorFromItem(f.id, item._idx, cid)}
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
                            {flipContractors.length === 0 && assignedIds.length === 0 && (
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

      {/* Add Line Item Modal */}
      {showAddItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "#0f172a", fontSize: 19, fontWeight: 700 }}>Add Rehab Line Item</h2>
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
              <button onClick={saveLineItem} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Add Line Item</button>
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
const EXPENSE_CATS = ["Materials/Supplies", "Subcontractor", "Permits & Inspections", "Appliances", "Dump Fees", "Holding Costs", "Closing Costs", "Other"];

export function FlipExpenses() {
  const [expenses, setExpenses] = useState([..._FE]);
  const [filterFlip, setFilterFlip]     = useState("all");
  const [filterCat, setFilterCat]       = useState("all");
  const [showModal, setShowModal]       = useState(false);
  const [editId, setEditId]             = useState(null);
  const [search, setSearch]             = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const emptyForm = { flipId: "", date: "", vendor: "", category: "Materials/Supplies", description: "", amount: "" };
  const [form, setForm]   = useState(emptyForm);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = exp => {
    setEditId(exp.id);
    setForm({ flipId: String(exp.flipId), date: exp.date, vendor: exp.vendor || "", category: exp.category, description: exp.description || "", amount: String(exp.amount) });
    setShowModal(true);
  };

  const filtered = expenses.filter(e => {
    if (filterFlip !== "all" && e.flipId !== parseInt(filterFlip)) return false;
    if (filterCat  !== "all" && e.category !== filterCat) return false;
    if (search && !e.description.toLowerCase().includes(search.toLowerCase()) && !e.vendor.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const total     = filtered.reduce((s, e) => s + e.amount, 0);
  const thisMonth = filtered.filter(e => e.date >= "2026-03-01").reduce((s, e) => s + e.amount, 0);

  const catTotals = EXPENSE_CATS.map(cat => ({
    cat, total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const handleSave = () => {
    if (!form.amount || !form.flipId) return;
    const flip = _FLIPS.find(f => f.id === parseInt(form.flipId));
    const built = { flipId: parseInt(form.flipId), flipName: flip?.name, date: form.date || new Date().toISOString().split("T")[0], vendor: form.vendor || "Unknown", category: form.category, description: form.description, amount: parseFloat(form.amount) };
    if (editId !== null) {
      setExpenses(prev => prev.map(e => e.id === editId ? { ...e, ...built } : e));
    } else {
      setExpenses(prev => [{ id: newId(), ...built }, ...prev]);
    }
    setForm(emptyForm); setEditId(null); setShowModal(false);
  };

  return (
    <div>
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

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
          <Search size={13} color="#94a3b8" />
          <input placeholder="Search vendor or description..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: "none", background: "transparent", fontSize: 13, color: "#475569", outline: "none", width: "100%" }} />
        </div>
        <select value={filterFlip} onChange={e => setFilterFlip(e.target.value)} style={{ ...iS, width: "auto", padding: "8px 12px", fontSize: 13 }}>
          <option value="all">All Flips</option>
          {_FLIPS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...iS, width: "auto", padding: "8px 12px", fontSize: 13 }}>
          <option value="all">All Categories</option>
          {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Date", "Flip", "Vendor", "Category", "Description", "Amount", ""].map(h => (
                <th key={h} style={{ textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "12px 16px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => {
              const flip = _FLIPS.find(f => f.id === e.flipId);
              return (
                <tr key={e.id} style={{ borderTop: "1px solid #f1f5f9" }}>
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
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Vendor</p>
                <input style={iS} placeholder="Vendor name" value={form.vendor} onChange={sf("vendor")} />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Category</p>
                <select style={iS} value={form.category} onChange={sf("category")}>
                  {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
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
  const [selectedItems, setSelectedItems] = useState(new Set()); // Set of "flipIdx:itemIdx" keys

  const emptyForm = { flipId: "", name: "", trade: "", paymentType: "Fixed Bid", totalBid: "", dayRate: "", phone: "", status: "pending" };
  const [form, setForm] = useState(emptyForm);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Current flip's rehab items for the modal
  const modalFlip     = _FLIPS.find(f => f.id === parseInt(form.flipId));
  const modalItems    = modalFlip?.rehabItems || [];

  const toggleItem = idx => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setSelectedItems(new Set());
    setShowModal(true);
  };

  const openEdit = c => {
    setEditId(c.id);
    setForm({ flipId: String(c.flipId), name: c.name, trade: c.trade || "", paymentType: c.paymentType, totalBid: String(c.totalBid || ""), dayRate: String(c.dayRate || ""), phone: c.phone || "", status: c.status });
    // Pre-select items already assigned to this contractor
    const flip = _FLIPS.find(f => f.id === c.flipId);
    const preChecked = new Set();
    (flip?.rehabItems || []).forEach((item, idx) => {
      if ((item.contractorIds || []).includes(c.id)) preChecked.add(idx);
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
          const ids = item.contractorIds || [];
          const wasChecked = ids.includes(editId);
          const isChecked  = selectedItems.has(idx);
          if (isChecked && !wasChecked) item.contractorIds = [...ids, editId];
          if (!isChecked && wasChecked) item.contractorIds = ids.filter(id => id !== editId);
        });
      }
    } else {
      // --- ADD MODE ---
      const newCon = { id: newId(), flipId: fId, name: form.name, trade: form.trade, paymentType: form.paymentType, totalBid: parseFloat(form.totalBid) || 0, dayRate: parseFloat(form.dayRate) || 0, totalPaid: 0, status: form.status, phone: form.phone };
      setContractors(prev => [...prev, newCon]);
      _CON.push(newCon);
      // Assign selected rehab items
      if (flip) {
        selectedItems.forEach(idx => {
          const item = flip.rehabItems[idx];
          if (item && !(item.contractorIds || []).includes(newCon.id)) {
            item.contractorIds = [...(item.contractorIds || []), newCon.id];
          }
        });
      }
    }

    rerender(n => n + 1);
    setForm(emptyForm);
    setSelectedItems(new Set());
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

              {/* Assigned Scope */}
              {(() => {
                const scope = [];
                _FLIPS.forEach(fl => {
                  (fl.rehabItems || []).forEach(item => {
                    if ((item.contractorIds || []).includes(c.id)) {
                      scope.push({ flipName: fl.name, flipColor: fl.color, label: item.category, budgeted: item.budgeted, status: item.status });
                    }
                  });
                });
                if (scope.length === 0) return null;
                const scopeBudget = scope.reduce((s, i) => s + (i.budgeted || 0), 0);
                return (
                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12, marginTop: c.paymentType === "Day Rate" ? 14 : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Assigned Scope</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{fmt(scopeBudget)}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {scope.map((item, i) => {
                        const sSt = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", borderRadius: 7, padding: "5px 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.flipColor, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label || item.category}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmt(item.budgeted)}</span>
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
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Company / Name *</p>
                  <input style={iS} placeholder="ABC Plumbing" value={form.name} onChange={sf("name")} />
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

              {/* Rehab Item Assignment */}
              {modalItems.length > 0 && (
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14, marginTop: 2 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Assign Rehab Scope</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {modalItems.map((item, idx) => {
                      const checked = selectedItems.has(idx);
                      const otherCons = (item.contractorIds || []).filter(id => id !== editId);
                      return (
                        <label key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: checked ? "#fef9c3" : "#f8fafc", border: `1px solid ${checked ? "#fde68a" : "#f1f5f9"}`, cursor: "pointer" }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleItem(idx)} style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#f59e0b" }} />
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{item.category}</span>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>{fmt(item.budgeted)}</span>
                          {otherCons.length > 0 && (
                            <span style={{ fontSize: 11, color: "#64748b", background: "#e2e8f0", borderRadius: 10, padding: "2px 7px" }}>
                              +{otherCons.length} assigned
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {selectedItems.size > 0 && (
                    <p style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600, marginTop: 8 }}>
                      {selectedItems.size} scope{selectedItems.size > 1 ? "s" : ""} selected · {fmt([...selectedItems].reduce((s, idx) => s + (modalItems[idx]?.budgeted || 0), 0))} total
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
    const profit = sale - purchase - rehab - holding - selling;
    return { name: f.image, fullName: f.name, purchase, rehab, holding: Math.round(holding), selling: Math.round(selling), profit: Math.round(profit), color: f.color };
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

  return (
    <div>
      <PageHeader title="Flip Analytics" sub={singleDeal ? `Performance details — ${singleDeal.name}` : "Performance metrics across all deals"} />

      {/* Deal selector — matches rental Analytics pattern */}
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

      {/* Stat cards — portfolio vs single-deal */}
      {singleDeal ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          <StatCard icon={TrendingUp} label="Projected ROI" value={`${dealROI?.roi || 0}%`} sub={singleDeal.stage} color="#10b981" />
          <StatCard icon={Clock} label="Days Owned" value={singleDeal.daysOwned || 0} sub={dealCostPerDay > 0 ? `${fmt(dealCostPerDay)}/day` : "Not started"} color="#3b82f6" />
          <StatCard icon={DollarSign} label="Rehab Spent" value={fmt(singleDeal.rehabSpent)} sub={`of ${fmt(singleDeal.rehabBudget)} budget`} color="#f59e0b" />
          <StatCard icon={Star} label="Proj. Profit" value={fmt(dealROI?.profit || 0)} sub={singleDeal.stage === "Sold" ? "Realized" : "Estimated"} color="#8b5cf6" />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          <StatCard icon={TrendingUp}  label="Avg ROI"          value={`${avgROI}%`}          sub="All deals"         color="#10b981" />
          <StatCard icon={Clock}       label="Avg Hold Time"    value={`${avgDays} days`}      sub="Active deals"      color="#3b82f6" />
          <StatCard icon={Star}        label="Total Realized"   value={fmt(totalProfit)}       sub="Closed deals"      color="#8b5cf6" />
          <StatCard icon={BarChart3}   label="Deals Analyzed"   value={flips.length}           sub={`${sold.length} closed`} color="#f59e0b" />
        </div>
      )}

      {/* ======== SINGLE-DEAL VIEW ======== */}
      {singleDeal ? (<>
        {/* Deal Scorecard */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: singleDeal.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: singleDeal.color }}>{singleDeal.image}</div>
            <div>
              <p style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, margin: 0 }}>{singleDeal.name}</p>
              <p style={{ color: "#94a3b8", fontSize: 12, margin: 0, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {singleDeal.address}</p>
            </div>
            <div style={{ marginLeft: "auto" }}><StageDot stage={singleDeal.stage} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              { label: "Purchase Price", value: fmt(singleDeal.purchasePrice) },
              { label: "Rehab Budget", value: fmt(singleDeal.rehabBudget) },
              { label: "ARV / Sale", value: fmt(singleDeal.stage === "Sold" ? singleDeal.salePrice : singleDeal.arv) },
              { label: "Holding Costs", value: fmt(dealHolding) },
              { label: "Total Invested", value: fmt(singleDeal.purchasePrice + singleDeal.rehabSpent + dealHolding) },
            ].map(item => (
              <div key={item.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>{item.label}</p>
                <p style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, margin: "4px 0 0" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Cumulative Spend Curve */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9" }}>
            <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Rehab Spend Curve</p>
            <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>Cumulative spend vs budget over time</p>
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
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9" }}>
            <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Cost Breakdown</p>
            <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>Expenses by category</p>
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
        <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9", marginBottom: 20 }}>
          <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Rehab Item Progress</p>
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>Budget consumed per line item</p>
          {rehabProgress.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {rehabProgress.map((item, i) => {
                const overBudget = item.pct > 100;
                const barColor = item.status === "complete" ? "#10b981" : overBudget ? "#ef4444" : "#f59e0b";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: "#374151", fontWeight: 500, width: 130, flexShrink: 0 }} title={item.fullName}>{item.name}</span>
                    <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 6, height: 22, position: "relative", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(item.pct, 100)}%`, height: "100%", background: barColor, borderRadius: 6, transition: "width 0.3s" }} />
                      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 600, color: item.pct > 60 ? "#fff" : "#374151" }}>{item.pct}%</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#94a3b8", width: 100, textAlign: "right", flexShrink: 0 }}>{fmt(item.spent)} / {fmt(item.budgeted)}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", padding: "2px 8px", borderRadius: 6, background: item.status === "complete" ? "#dcfce7" : item.status === "in-progress" ? "#fef3c7" : "#f1f5f9", color: item.status === "complete" ? "#16a34a" : item.status === "in-progress" ? "#d97706" : "#94a3b8", flexShrink: 0 }}>{item.status}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No rehab items configured</div>
          )}
        </div>

        {/* Expense Log */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid #f1f5f9" }}>
            <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700 }}>Expense Log</p>
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

      {/* ======== PORTFOLIO VIEW (existing) ======== */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* ROI by Deal */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9" }}>
          <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>ROI by Deal</p>
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>Actual (sold) vs projected (active)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={roiData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v, n, p) => [`${v}%`, "ROI"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="roi" radius={[5, 5, 0, 0]}>
                {roiData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Category Breakdown */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9" }}>
          <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Expense Breakdown</p>
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>By category across all flips</p>
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
      <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9", marginBottom: 20 }}>
        <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Rehab Budget vs Actual</p>
        <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>How well rehab budgets are holding</p>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Hold Time by Deal */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9" }}>
          <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Hold Time by Deal</p>
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>Days owned per property{avgDays > 0 ? ` (avg ${avgDays}d)` : ""}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timelineData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}d`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={v => [`${v} days`, "Hold Time"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="days" radius={[0, 5, 5, 0]}>
                {timelineData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Expense Trend */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9" }}>
          <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Monthly Expense Trend</p>
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>Total spend by month</p>
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
      <div style={{ background: "#fff", borderRadius: 16, padding: 22, border: "1px solid #f1f5f9", marginBottom: 20 }}>
        <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Profit Breakdown by Deal</p>
        <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>Where the money goes — purchase, rehab, holding, selling, and net profit</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={profitBreakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
            <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Legend iconType="circle" />
            <Bar dataKey="purchase" stackId="cost" fill="#3b82f6" name="Purchase" />
            <Bar dataKey="rehab"    stackId="cost" fill="#f59e0b" name="Rehab" />
            <Bar dataKey="holding"  stackId="cost" fill="#8b5cf6" name="Holding" />
            <Bar dataKey="selling"  stackId="cost" fill="#94a3b8" name="Selling" radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit"   fill="#10b981" name="Net Profit" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Deal Summary Table */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #f1f5f9" }}>
          <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700 }}>Deal Summary</p>
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
