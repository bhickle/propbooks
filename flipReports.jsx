// ─── FIX & FLIP REPORTS ─────────────────────────────────────────────────────
// Deal profitability · Rehab budget vs actual · Contractor payments · Holding costs
// Capital gains · Cash flow · Pipeline value
// Matches rental Reports layout: sidebar nav, KPI strip, content area
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, Clock, Users, FileText, Home, BarChart3,
  Building2, AlertCircle, CheckCircle, Download, Info, Target, ArrowUp,
  ArrowDown, Calendar,
} from "lucide-react";
import { fmt, fmtK, STAGE_ORDER, STAGE_COLORS } from "./api.js";
import { FLIPS as _FLIPS, FLIP_EXPENSES as _FE, CONTRACTORS as _CON } from "./api.js";

// ─── Shared styles ───────────────────────────────────────────────────────────
const iS = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, color: "#0f172a", background: "#fff", outline: "none" };
const thS = { padding: "11px 16px", textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: "#f8fafc" };
const tdS = { padding: "12px 16px", fontSize: 13, color: "#0f172a", borderTop: "1px solid #f1f5f9" };
const sectionS = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" };

// ─── InfoTip ─────────────────────────────────────────────────────────────────
function InfoTip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: 4, cursor: "help" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info size={12} color="#94a3b8" />
      {show && (
        <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "#0f172a", color: "#fff", fontSize: 12, padding: "8px 12px", borderRadius: 10,
          border: "1px solid #e2e8f0", whiteSpace: "nowrap", zIndex: 100, fontWeight: 400, lineHeight: 1.4 }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcDealMetrics(f) {
  const rehabBudget = f.rehabBudget || (f.rehabItems || []).reduce((s, i) => s + i.budgeted, 0);
  const rehabSpent  = f.rehabSpent  || (f.rehabItems || []).reduce((s, i) => s + i.spent, 0);
  const holdPerMonth = f.holdingCostsPerMonth || 0;
  const daysOwned = f.daysOwned || 0;
  const totalHolding = f.totalHoldingCosts || Math.round(holdPerMonth * (daysOwned / 30));
  const saleOrARV = f.salePrice || f.arv || 0;
  const sellingCosts = f.sellingCosts || Math.round(saleOrARV * 0.06);
  const totalInvested = f.purchasePrice + rehabSpent + totalHolding + sellingCosts;
  const profit = f.netProfit != null ? f.netProfit : saleOrARV - totalInvested;
  const roi = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
  const cashOnCash = f.purchasePrice > 0 ? (profit / f.purchasePrice) * 100 : 0;
  const annualized = daysOwned > 0 ? roi * (365 / daysOwned) : 0;
  const rehabVariance = rehabBudget > 0 ? ((rehabSpent - rehabBudget) / rehabBudget) * 100 : 0;
  return { rehabBudget, rehabSpent, holdPerMonth, daysOwned, totalHolding, saleOrARV, sellingCosts, totalInvested, profit, roi, cashOnCash, annualized, rehabVariance };
}

// ═══════════════════════════════════════════════════════════════════════════════
export function FlipReports() {
  const [activeReport, setActiveReport] = useState("profitability");
  const [dealFilter, setDealFilter] = useState("all");

  const deals = dealFilter === "all" ? _FLIPS : _FLIPS.filter(f => f.id === parseInt(dealFilter));
  const allMetrics = deals.map(f => ({ ...f, m: calcDealMetrics(f) }));

  // Portfolio-level KPIs
  const totalInvested = allMetrics.reduce((s, d) => s + d.m.totalInvested, 0);
  const totalProfit   = allMetrics.reduce((s, d) => s + d.m.profit, 0);
  const totalRehab    = allMetrics.reduce((s, d) => s + d.m.rehabSpent, 0);
  const totalBudget   = allMetrics.reduce((s, d) => s + d.m.rehabBudget, 0);
  const avgROI        = allMetrics.length > 0 ? allMetrics.reduce((s, d) => s + d.m.roi, 0) / allMetrics.length : 0;

  const profitReports = [
    { id: "profitability",  label: "Deal Profitability",    icon: DollarSign  },
    { id: "rehabBudget",    label: "Rehab Budget vs Actual",icon: BarChart3   },
    { id: "holdingCosts",   label: "Holding Costs",         icon: Clock       },
  ];
  const operationalReports = [
    { id: "contractors",    label: "Contractor Payments",   icon: Users       },
    { id: "capitalGains",   label: "Capital Gains",         icon: TrendingUp  },
    { id: "cashflow",       label: "Cash Flow",             icon: DollarSign  },
    { id: "pipeline",       label: "Pipeline Value",        icon: Target      },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Fix &amp; Flip Reports</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>Profitability, rehab analysis, contractor payments, and projections</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={dealFilter} onChange={e => setDealFilter(e.target.value)} style={{ ...iS, width: 220 }}>
            <option value="all">All Deals</option>
            {_FLIPS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Invested",  value: fmt(totalInvested), color: "#3b82f6", bg: "#eff6ff",   tip: "Purchase + rehab spent + holding costs + selling costs" },
          { label: "Total Profit",    value: fmt(totalProfit),   color: totalProfit >= 0 ? "#15803d" : "#b91c1c", bg: totalProfit >= 0 ? "#f0fdf4" : "#fef2f2", tip: "Sale price (or ARV) minus total invested" },
          { label: "Avg ROI",         value: `${avgROI.toFixed(1)}%`, color: "#8b5cf6", bg: "#f5f3ff", tip: "Average return on investment across all deals" },
          { label: "Rehab Spend",     value: fmt(totalRehab),    color: "#f59e0b", bg: "#fffbeb",   tip: "Total rehab dollars spent across all deals" },
          { label: "Budget Variance", value: `${totalBudget > 0 ? (((totalRehab - totalBudget) / totalBudget) * 100).toFixed(1) : 0}%`, color: totalRehab > totalBudget ? "#b91c1c" : "#15803d", bg: totalRehab > totalBudget ? "#fef2f2" : "#f0fdf4", tip: "How much total rehab spend is over/under total budget" },
        ].map((m, i) => (
          <div key={i} style={{ background: m.bg, borderRadius: 14, padding: "14px 16px", border: "1px solid #f1f5f9" }}>
            <p style={{ color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: m.color, fontSize: 20, fontWeight: 800 }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
        {/* Sidebar */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", height: "fit-content" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 14px 4px" }}>Profitability</p>
          {profitReports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: activeReport === r.id ? "#eff6ff" : "transparent", color: activeReport === r.id ? "#3b82f6" : "#475569", fontWeight: activeReport === r.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
              <r.icon size={16} /> {r.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid #f1f5f9", margin: "8px 14px", paddingTop: 0 }} />
          <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 14px 4px" }}>Operational</p>
          {operationalReports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: activeReport === r.id ? "#eff6ff" : "transparent", color: activeReport === r.id ? "#3b82f6" : "#475569", fontWeight: activeReport === r.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
              <r.icon size={16} /> {r.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 12, paddingTop: 12 }}>
            <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", padding: "0 14px", marginBottom: 6 }}>Scope</p>
            <p style={{ fontSize: 12, color: "#475569", padding: "0 14px", fontWeight: 600 }}>{dealFilter === "all" ? `All ${_FLIPS.length} deals` : _FLIPS.find(f => f.id === parseInt(dealFilter))?.name}</p>
            <p style={{ fontSize: 12, color: "#94a3b8", padding: "0 14px" }}>{deals.filter(d => d.stage === "Sold").length} sold · {deals.filter(d => d.stage !== "Sold").length} active</p>
          </div>
        </div>

        {/* Content */}
        <div>
          {activeReport === "profitability" && <ProfitabilityReport deals={allMetrics} />}
          {activeReport === "rehabBudget"   && <RehabBudgetReport deals={allMetrics} />}
          {activeReport === "holdingCosts"  && <HoldingCostsReport deals={allMetrics} />}
          {activeReport === "contractors"   && <ContractorPaymentsReport />}
          {activeReport === "capitalGains"  && <CapitalGainsReport deals={allMetrics} />}
          {activeReport === "cashflow"      && <CashFlowReport deals={allMetrics} />}
          {activeReport === "pipeline"      && <PipelineReport deals={allMetrics} />}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 1. DEAL PROFITABILITY
// ═══════════════════════════════════════════════════════════════════════════════
function ProfitabilityReport({ deals }) {
  const sorted = [...deals].sort((a, b) => b.m.profit - a.m.profit);
  const chartData = sorted.map(d => ({ name: d.name.split(" ").slice(0, 2).join(" "), profit: d.m.profit, invested: d.m.totalInvested }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Deal Profitability Summary</h3>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Profit, ROI, and cost breakdown per deal</p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Deal", "Stage", "Purchase", "Rehab", "Holding", "Selling", "Total Invested", "Sale / ARV", "Profit", "ROI", "Annualized"].map(h => (
                  <th key={h} style={{ ...thS, textAlign: h === "Deal" || h === "Stage" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(d => {
                const stg = STAGE_COLORS[d.stage] || { bg: "#f1f5f9", text: "#64748b" };
                return (
                  <tr key={d.id}>
                    <td style={{ ...tdS, fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                        {d.name}
                      </div>
                    </td>
                    <td style={tdS}><span style={{ background: stg.bg, color: stg.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{d.stage}</span></td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(d.purchasePrice)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(d.m.rehabSpent)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(d.m.totalHolding)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(d.m.sellingCosts)}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{fmt(d.m.totalInvested)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(d.m.saleOrARV)}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: d.m.profit >= 0 ? "#15803d" : "#b91c1c" }}>{fmt(d.m.profit)}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600, color: d.m.roi >= 0 ? "#15803d" : "#b91c1c" }}>{d.m.roi.toFixed(1)}%</td>
                    <td style={{ ...tdS, textAlign: "right", color: "#64748b" }}>{d.m.daysOwned > 0 ? `${d.m.annualized.toFixed(1)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            {sorted.length > 1 && (
              <tfoot>
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ ...tdS, fontWeight: 700 }} colSpan={2}>Totals</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(sorted.reduce((s, d) => s + d.purchasePrice, 0))}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(sorted.reduce((s, d) => s + d.m.rehabSpent, 0))}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(sorted.reduce((s, d) => s + d.m.totalHolding, 0))}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(sorted.reduce((s, d) => s + d.m.sellingCosts, 0))}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(sorted.reduce((s, d) => s + d.m.totalInvested, 0))}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(sorted.reduce((s, d) => s + d.m.saleOrARV, 0))}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: sorted.reduce((s, d) => s + d.m.profit, 0) >= 0 ? "#15803d" : "#b91c1c" }}>{fmt(sorted.reduce((s, d) => s + d.m.profit, 0))}</td>
                  <td style={tdS} colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Profit chart */}
      {chartData.length > 1 && (
        <div style={sectionS}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Profit by Deal</h3>
          <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Net profit comparison across deals</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="profit" name="Profit" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? "#10b981" : "#ef4444"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 2. REHAB BUDGET VS ACTUAL
// ═══════════════════════════════════════════════════════════════════════════════
function RehabBudgetReport({ deals }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {deals.map(d => {
        const items = d.rehabItems || [];
        const totalBudget = items.reduce((s, i) => s + i.budgeted, 0);
        const totalSpent  = items.reduce((s, i) => s + i.spent, 0);
        const variance = totalBudget > 0 ? ((totalSpent - totalBudget) / totalBudget * 100) : 0;
        const chartData = items.map(i => ({
          name: i.category.length > 18 ? i.category.slice(0, 16) + "…" : i.category,
          budgeted: i.budgeted,
          spent: i.spent,
        }));

        return (
          <div key={d.id} style={sectionS}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{d.name}</h3>
                <span style={{ background: STAGE_COLORS[d.stage]?.bg || "#f1f5f9", color: STAGE_COLORS[d.stage]?.text || "#64748b", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{d.stage}</span>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                <span style={{ color: "#64748b" }}>Budget: <strong style={{ color: "#0f172a" }}>{fmt(totalBudget)}</strong></span>
                <span style={{ color: "#64748b" }}>Spent: <strong style={{ color: totalSpent > totalBudget ? "#b91c1c" : "#0f172a" }}>{fmt(totalSpent)}</strong></span>
                <span style={{ color: variance > 0 ? "#b91c1c" : "#15803d", fontWeight: 700 }}>{variance > 0 ? "+" : ""}{variance.toFixed(1)}%</span>
              </div>
            </div>

            {/* Category table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
              <thead>
                <tr>
                  {["Category", "Status", "Budgeted", "Spent", "Variance", "Progress"].map(h => (
                    <th key={h} style={{ ...thS, textAlign: h === "Category" || h === "Status" || h === "Progress" ? "left" : "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const v = item.budgeted > 0 ? ((item.spent - item.budgeted) / item.budgeted * 100) : 0;
                  const pct = item.budgeted > 0 ? Math.min(100, (item.spent / item.budgeted) * 100) : 0;
                  const statusMap = { complete: { bg: "#dcfce7", text: "#15803d" }, "in-progress": { bg: "#dbeafe", text: "#1d4ed8" }, pending: { bg: "#f1f5f9", text: "#64748b" } };
                  const st = statusMap[item.status] || statusMap.pending;
                  return (
                    <tr key={idx}>
                      <td style={{ ...tdS, fontWeight: 600 }}>{item.category}</td>
                      <td style={tdS}><span style={{ background: st.bg, color: st.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{item.status}</span></td>
                      <td style={{ ...tdS, textAlign: "right" }}>{fmt(item.budgeted)}</td>
                      <td style={{ ...tdS, textAlign: "right" }}>{fmt(item.spent)}</td>
                      <td style={{ ...tdS, textAlign: "right", fontWeight: 600, color: v > 0 ? "#b91c1c" : v < 0 ? "#15803d" : "#64748b" }}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</td>
                      <td style={{ ...tdS, minWidth: 120 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: pct > 100 ? "#ef4444" : pct === 100 ? "#10b981" : "#3b82f6", borderRadius: 99, transition: "width 0.3s" }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#64748b", minWidth: 32 }}>{Math.round(pct)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Grouped bar chart */}
            {chartData.length > 0 && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="budgeted" name="Budgeted" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="spent" name="Spent" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 3. HOLDING COSTS
// ═══════════════════════════════════════════════════════════════════════════════
function HoldingCostsReport({ deals }) {
  const sorted = [...deals].sort((a, b) => b.m.totalHolding - a.m.totalHolding);
  const chartData = sorted.map(d => ({ name: d.name.split(" ").slice(0, 2).join(" "), holding: d.m.totalHolding, daily: d.m.holdPerMonth > 0 ? Math.round(d.m.holdPerMonth / 30) : 0 }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Holding Cost Analysis</h3>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Monthly burn rate, days held, and total holding costs per deal</p>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Deal", "Stage", "Days Held", "Monthly Burn", "Daily Burn", "Total Holding", "% of Investment", "Holding / Profit"].map(h => (
                <th key={h} style={{ ...thS, textAlign: h === "Deal" || h === "Stage" ? "left" : "right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(d => {
              const pctInv = d.m.totalInvested > 0 ? (d.m.totalHolding / d.m.totalInvested * 100) : 0;
              const holdVsProfit = d.m.profit > 0 ? (d.m.totalHolding / d.m.profit * 100) : 0;
              const daily = d.m.holdPerMonth > 0 ? Math.round(d.m.holdPerMonth / 30) : 0;
              const stg = STAGE_COLORS[d.stage] || { bg: "#f1f5f9", text: "#64748b" };
              return (
                <tr key={d.id}>
                  <td style={{ ...tdS, fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                      {d.name}
                    </div>
                  </td>
                  <td style={tdS}><span style={{ background: stg.bg, color: stg.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{d.stage}</span></td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{d.m.daysOwned || "—"}</td>
                  <td style={{ ...tdS, textAlign: "right" }}>{fmt(d.m.holdPerMonth)}<span style={{ color: "#94a3b8", fontSize: 11 }}>/mo</span></td>
                  <td style={{ ...tdS, textAlign: "right" }}>{fmt(daily)}<span style={{ color: "#94a3b8", fontSize: 11 }}>/day</span></td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>{fmt(d.m.totalHolding)}</td>
                  <td style={{ ...tdS, textAlign: "right" }}>{pctInv.toFixed(1)}%</td>
                  <td style={{ ...tdS, textAlign: "right", color: holdVsProfit > 30 ? "#b91c1c" : "#64748b" }}>{d.m.profit > 0 ? `${holdVsProfit.toFixed(1)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {chartData.length > 1 && (
        <div style={sectionS}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Holding Costs by Deal</h3>
          <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Total holding cost comparison</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="holding" name="Total Holding" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 4. CONTRACTOR PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════
function ContractorPaymentsReport() {
  const contractors = _CON.filter(c => (c.bids || []).length > 0 || (c.payments || []).length > 0);
  const sorted = [...contractors].sort((a, b) => {
    const aPaid = (b.payments || []).reduce((s, p) => s + p.amount, 0);
    const bPaid = (a.payments || []).reduce((s, p) => s + p.amount, 0);
    return aPaid - bPaid;
  });

  const totalBids     = contractors.reduce((s, c) => s + (c.bids || []).reduce((bs, b) => bs + b.amount, 0), 0);
  const totalAccepted = contractors.reduce((s, c) => s + (c.bids || []).filter(b => b.status === "accepted").reduce((bs, b) => bs + b.amount, 0), 0);
  const totalPaid     = contractors.reduce((s, c) => s + (c.payments || []).reduce((ps, p) => ps + p.amount, 0), 0);
  const outstanding   = totalAccepted - totalPaid;

  // Pie chart by trade
  const byTrade = {};
  contractors.forEach(c => {
    const paid = (c.payments || []).reduce((s, p) => s + p.amount, 0);
    if (paid > 0) byTrade[c.trade] = (byTrade[c.trade] || 0) + paid;
  });
  const pieData = Object.entries(byTrade).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#64748b"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Bid Value",     value: fmt(totalBids),     color: "#3b82f6", tip: "Sum of all bids across all contractors" },
          { label: "Accepted Bids",       value: fmt(totalAccepted), color: "#10b981", tip: "Total value of accepted bids only" },
          { label: "Total Paid",          value: fmt(totalPaid),     color: "#f59e0b", tip: "Total payments disbursed to all contractors" },
          { label: "Outstanding Balance", value: fmt(outstanding),   color: outstanding > 0 ? "#ef4444" : "#10b981", tip: "Accepted bids minus payments made" },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "18px 20px", border: "1px solid #f1f5f9" }}>
            <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: m.color, fontSize: 22, fontWeight: 800 }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Contractor table */}
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Contractor Payment Detail</h3>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>All contractors with bids or payments</p>

        {sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>No contractor activity to report.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Contractor", "Trade", "Deals", "Total Bids", "Accepted", "Paid", "Outstanding", "Acceptance Rate"].map(h => (
                  <th key={h} style={{ ...thS, textAlign: h === "Contractor" || h === "Trade" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const bids = c.bids || [];
                const pays = c.payments || [];
                const bidTotal = bids.reduce((s, b) => s + b.amount, 0);
                const acceptTotal = bids.filter(b => b.status === "accepted").reduce((s, b) => s + b.amount, 0);
                const paidTotal = pays.reduce((s, p) => s + p.amount, 0);
                const owed = acceptTotal - paidTotal;
                const acceptRate = bids.length > 0 ? Math.round((bids.filter(b => b.status === "accepted").length / bids.length) * 100) : 0;
                const dealCount = (c.dealIds || []).length;
                return (
                  <tr key={c.id}>
                    <td style={{ ...tdS, fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {c.name}
                        {c.rating > 0 && <span style={{ fontSize: 11, color: "#f59e0b" }}>{"★".repeat(c.rating)}</span>}
                      </div>
                    </td>
                    <td style={{ ...tdS, color: "#64748b" }}>{c.trade}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{dealCount}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(bidTotal)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(acceptTotal)}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600, color: "#10b981" }}>{fmt(paidTotal)}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600, color: owed > 0 ? "#b91c1c" : "#10b981" }}>{fmt(owed)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{acceptRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pie by trade */}
      {pieData.length > 1 && (
        <div style={sectionS}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Payments by Trade</h3>
          <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Distribution of contractor payments by trade specialty</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 5. CAPITAL GAINS
// ═══════════════════════════════════════════════════════════════════════════════
function CapitalGainsReport({ deals }) {
  const today = new Date().toISOString().slice(0, 10);

  const rows = deals.map(d => {
    const acqDate = d.acquisitionDate || d.contractDate || "";
    const saleDate = d.closeDate || "";
    const holdDays = d.m.daysOwned || 0;
    const isShortTerm = holdDays < 365;
    const gain = d.m.profit;
    // Rough estimate: 22% short-term, 15% long-term
    const estTaxRate = isShortTerm ? 0.22 : 0.15;
    const estTax = Math.max(0, Math.round(gain * estTaxRate));
    const afterTax = gain - estTax;
    return { ...d, acqDate, saleDate, holdDays, isShortTerm, gain, estTaxRate, estTax, afterTax };
  });

  const totalGains = rows.reduce((s, r) => s + r.gain, 0);
  const totalTax   = rows.reduce((s, r) => s + r.estTax, 0);
  const shortCount = rows.filter(r => r.isShortTerm).length;
  const longCount  = rows.filter(r => !r.isShortTerm).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Capital Gains", value: fmt(totalGains), color: totalGains >= 0 ? "#15803d" : "#b91c1c", tip: "Sum of profit across all deals" },
          { label: "Estimated Tax",       value: fmt(totalTax),   color: "#ef4444", tip: "22% short-term, 15% long-term estimate" },
          { label: "Short-Term Deals",    value: String(shortCount), color: "#f59e0b", tip: "Held less than 1 year — taxed as ordinary income" },
          { label: "Long-Term Deals",     value: String(longCount),  color: "#10b981", tip: "Held 1+ years — lower capital gains rate" },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "18px 20px", border: "1px solid #f1f5f9" }}>
            <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: m.color, fontSize: 22, fontWeight: 800 }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Capital Gains Projection</h3>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Estimated tax liability by deal — consult your CPA for actual filing</p>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Deal", "Acquired", "Sold / Projected", "Days Held", "Type", "Gain / Loss", "Est. Tax Rate", "Est. Tax", "After Tax"].map(h => (
                <th key={h} style={{ ...thS, textAlign: h === "Deal" ? "left" : "right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ ...tdS, fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                    {r.name}
                  </div>
                </td>
                <td style={{ ...tdS, textAlign: "right", fontSize: 12 }}>{r.acqDate || "—"}</td>
                <td style={{ ...tdS, textAlign: "right", fontSize: 12 }}>{r.saleDate || "projected"}</td>
                <td style={{ ...tdS, textAlign: "right" }}>{r.holdDays || "—"}</td>
                <td style={{ ...tdS, textAlign: "right" }}>
                  <span style={{ background: r.isShortTerm ? "#fef9c3" : "#dcfce7", color: r.isShortTerm ? "#a16207" : "#15803d", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                    {r.isShortTerm ? "Short-Term" : "Long-Term"}
                  </span>
                </td>
                <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: r.gain >= 0 ? "#15803d" : "#b91c1c" }}>{fmt(r.gain)}</td>
                <td style={{ ...tdS, textAlign: "right" }}>{(r.estTaxRate * 100).toFixed(0)}%</td>
                <td style={{ ...tdS, textAlign: "right", color: "#ef4444" }}>{fmt(r.estTax)}</td>
                <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{fmt(r.afterTax)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ marginTop: 16, fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
          Tax estimates use 22% for short-term and 15% for long-term gains. Actual rates depend on your income bracket. Consult a tax professional.
        </p>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 6. CASH FLOW
// ═══════════════════════════════════════════════════════════════════════════════
function CashFlowReport({ deals }) {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Group expenses by month
  const monthlyData = MONTHS.map((month, i) => {
    const monthExpenses = _FE.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === i && deals.some(dl => dl.id === e.flipId);
    });
    const purchases = deals.filter(f => {
      const acqDate = f.acquisitionDate || f.contractDate;
      return acqDate && new Date(acqDate).getMonth() === i;
    }).reduce((s, f) => s + f.purchasePrice, 0);
    const sales = deals.filter(f => f.closeDate && new Date(f.closeDate).getMonth() === i).reduce((s, f) => s + (f.salePrice || 0), 0);
    const rehabSpend = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const holdingCosts = deals.filter(f => {
      const start = f.acquisitionDate || f.contractDate;
      const end = f.closeDate;
      if (!start) return false;
      const sm = new Date(start).getMonth();
      const em = end ? new Date(end).getMonth() : 11;
      return i >= sm && i <= em;
    }).reduce((s, f) => s + (f.holdingCostsPerMonth || 0), 0);

    const totalOut = purchases + rehabSpend + holdingCosts;
    const net = sales - totalOut;
    return { month, sales, purchases, rehabSpend, holdingCosts, totalOut, net };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Monthly Cash Flow</h3>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Money in (sales) vs money out (purchases, rehab, holding) by month</p>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[6, 6, 0, 0]} />
            <Bar dataKey="totalOut" name="Cash Out" fill="#ef4444" radius={[6, 6, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Cash Flow Detail</h3>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Monthly breakdown of inflows and outflows</p>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Month", "Sales (In)", "Purchases", "Rehab Spend", "Holding Costs", "Total Out", "Net Cash Flow"].map(h => (
                <th key={h} style={{ ...thS, textAlign: h === "Month" ? "left" : "right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((m, i) => (
              <tr key={i}>
                <td style={{ ...tdS, fontWeight: 600 }}>{m.month}</td>
                <td style={{ ...tdS, textAlign: "right", color: m.sales > 0 ? "#15803d" : "#94a3b8" }}>{m.sales > 0 ? fmt(m.sales) : "—"}</td>
                <td style={{ ...tdS, textAlign: "right", color: m.purchases > 0 ? "#b91c1c" : "#94a3b8" }}>{m.purchases > 0 ? fmt(m.purchases) : "—"}</td>
                <td style={{ ...tdS, textAlign: "right" }}>{m.rehabSpend > 0 ? fmt(m.rehabSpend) : "—"}</td>
                <td style={{ ...tdS, textAlign: "right" }}>{m.holdingCosts > 0 ? fmt(m.holdingCosts) : "—"}</td>
                <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{m.totalOut > 0 ? fmt(m.totalOut) : "—"}</td>
                <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: m.net >= 0 ? "#15803d" : "#b91c1c" }}>{fmt(m.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f8fafc" }}>
              <td style={{ ...tdS, fontWeight: 700 }}>Total</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: "#15803d" }}>{fmt(monthlyData.reduce((s, m) => s + m.sales, 0))}</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(monthlyData.reduce((s, m) => s + m.purchases, 0))}</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(monthlyData.reduce((s, m) => s + m.rehabSpend, 0))}</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(monthlyData.reduce((s, m) => s + m.holdingCosts, 0))}</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(monthlyData.reduce((s, m) => s + m.totalOut, 0))}</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: monthlyData.reduce((s, m) => s + m.net, 0) >= 0 ? "#15803d" : "#b91c1c" }}>{fmt(monthlyData.reduce((s, m) => s + m.net, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 7. PIPELINE VALUE
// ═══════════════════════════════════════════════════════════════════════════════
function PipelineReport({ deals }) {
  // Group by stage
  const stages = STAGE_ORDER.map(stage => {
    const stageDeals = deals.filter(d => d.stage === stage);
    const totalARV = stageDeals.reduce((s, d) => s + (d.salePrice || d.arv || 0), 0);
    const totalInvested = stageDeals.reduce((s, d) => s + d.m.totalInvested, 0);
    const totalProfit = stageDeals.reduce((s, d) => s + d.m.profit, 0);
    const colors = STAGE_COLORS[stage] || { bg: "#f1f5f9", text: "#64748b" };
    return { stage, deals: stageDeals, count: stageDeals.length, totalARV, totalInvested, totalProfit, colors };
  });

  const totalPipeline = deals.reduce((s, d) => s + (d.salePrice || d.arv || 0), 0);
  const activeDeals = deals.filter(d => d.stage !== "Sold");
  const projectedProfit = activeDeals.reduce((s, d) => s + d.m.profit, 0);
  const realizedProfit = deals.filter(d => d.stage === "Sold").reduce((s, d) => s + d.m.profit, 0);

  const pieData = stages.filter(s => s.count > 0).map(s => ({ name: s.stage, value: s.totalARV }));
  const PIE_COLORS = { "Under Contract": "#8b5cf6", "Active Rehab": "#f59e0b", "Listed": "#3b82f6", "Sold": "#10b981" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Pipeline Value",  value: fmt(totalPipeline),   color: "#3b82f6", tip: "Combined ARV / sale price of all deals" },
          { label: "Active Deals",          value: String(activeDeals.length), color: "#f59e0b", tip: "Deals not yet sold" },
          { label: "Projected Profit",      value: fmt(projectedProfit), color: "#8b5cf6", tip: "Estimated profit on unsold deals (ARV minus costs)" },
          { label: "Realized Profit",       value: fmt(realizedProfit),  color: "#15803d", tip: "Actual profit from sold deals" },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "18px 20px", border: "1px solid #f1f5f9" }}>
            <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: m.color, fontSize: 22, fontWeight: 800 }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Stage breakdown */}
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Pipeline by Stage</h3>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Deal count, value, and projected profit at each stage</p>

        <div style={{ display: "grid", gridTemplateColumns: pieData.length > 1 ? "1fr 300px" : "1fr", gap: 24 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Stage", "Deals", "Total ARV / Sale", "Total Invested", "Projected Profit", "Avg ROI"].map(h => (
                  <th key={h} style={{ ...thS, textAlign: h === "Stage" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stages.filter(s => s.count > 0).map(s => {
                const avgRoi = s.deals.length > 0 ? s.deals.reduce((acc, d) => acc + d.m.roi, 0) / s.deals.length : 0;
                return (
                  <tr key={s.stage}>
                    <td style={tdS}>
                      <span style={{ background: s.colors.bg, color: s.colors.text, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{s.stage}</span>
                    </td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{s.count}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(s.totalARV)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(s.totalInvested)}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: s.totalProfit >= 0 ? "#15803d" : "#b91c1c" }}>{fmt(s.totalProfit)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{avgRoi.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pieData.length > 1 && (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((d, i) => <Cell key={i} fill={PIE_COLORS[d.name] || "#64748b"} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Deal timeline */}
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Deal Timeline</h3>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Key dates and projected milestones for each deal</p>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Deal", "Stage", "Acquired", "Rehab Start", "Rehab End", "List Date", "Close Date", "Days Owned"].map(h => (
                <th key={h} style={{ ...thS, textAlign: h === "Deal" || h === "Stage" ? "left" : "right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map(d => {
              const stg = STAGE_COLORS[d.stage] || { bg: "#f1f5f9", text: "#64748b" };
              return (
                <tr key={d.id}>
                  <td style={{ ...tdS, fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                      {d.name}
                    </div>
                  </td>
                  <td style={tdS}><span style={{ background: stg.bg, color: stg.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{d.stage}</span></td>
                  <td style={{ ...tdS, textAlign: "right", fontSize: 12 }}>{d.acquisitionDate || d.contractDate || "—"}</td>
                  <td style={{ ...tdS, textAlign: "right", fontSize: 12 }}>{d.rehabStartDate || "—"}</td>
                  <td style={{ ...tdS, textAlign: "right", fontSize: 12 }}>{d.rehabEndDate || "—"}</td>
                  <td style={{ ...tdS, textAlign: "right", fontSize: 12 }}>{d.listDate || d.projectedListDate || "—"}</td>
                  <td style={{ ...tdS, textAlign: "right", fontSize: 12 }}>{d.closeDate || d.projectedCloseDate || "—"}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{d.m.daysOwned || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
