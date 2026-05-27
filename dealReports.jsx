// ─── DEAL REPORTS — updated 2026-04-06 ────────────────────────────────
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
  Building2, AlertCircle, CheckCircle, Download, Target, ArrowUp,
  ArrowDown, Calendar, Search, List,
} from "lucide-react";
import { fmt, fmtK, STAGE_ORDER, STAGE_COLORS, CONTRACTOR_BIDS as _BIDS } from "./api.js";
import { DEALS as _DEALS, DEAL_EXPENSES as _FE, CONTRACTORS as _CON } from "./api.js";
import { InfoTip, downloadFile } from "./shared.jsx";

// ─── CSV escaping ───────────────────────────────────────────────────────────
// Wraps any field in quotes and escapes embedded quotes; safer than string
// concatenation against fields that may contain commas, newlines, or quotes.
function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function csvRow(cells) { return cells.map(csvCell).join(",") + "\n"; }

// ─── Per-report CSV builders ────────────────────────────────────────────────
// One function per active report. Each takes the same inputs the on-screen
// view uses (allMetrics + filter context) so the export reflects the user's
// current scope. Keep these flat — investors take this CSV to a CPA.
function buildProjectReportCSV(activeReport, allMetrics, dealFilter) {
  const scopeName = dealFilter === "all" ? "All Rehabs" : _DEALS.find(f => f.id === dealFilter)?.name || "Rehab";
  let csv = "";

  if (activeReport === "profitability") {
    csv += csvRow(["Rehab", "Stage", "Purchase Price", "Rehab Budget", "Rehab Spent", "Holding Costs", "Selling Costs", "Total Invested", "Sale / ARV", "Profit", "ROI %", "Annualized %"]);
    [...allMetrics].sort((a, b) => b.m.profit - a.m.profit).forEach(d => {
      csv += csvRow([d.name, d.stage, d.purchasePrice, d.m.rehabBudget, d.m.rehabSpent, d.m.totalHolding, d.m.sellingCosts, d.m.totalInvested, d.m.saleOrARV, d.m.profit, d.m.roi.toFixed(1), d.m.annualized.toFixed(1)]);
    });

  } else if (activeReport === "rehabBudget") {
    csv += csvRow(["Rehab", "Stage", "Rehab Budget", "Rehab Spent", "Variance $", "Variance %"]);
    allMetrics.forEach(d => {
      const variance = d.m.rehabSpent - d.m.rehabBudget;
      csv += csvRow([d.name, d.stage, d.m.rehabBudget, d.m.rehabSpent, variance, d.m.rehabVariance.toFixed(1)]);
    });

  } else if (activeReport === "holdingCosts") {
    csv += csvRow(["Rehab", "Stage", "Days Owned", "Holding $/Month", "Total Holding", "Cost / Day"]);
    allMetrics.forEach(d => {
      const perDay = d.m.daysOwned > 0 ? Math.round(d.m.totalHolding / d.m.daysOwned) : 0;
      csv += csvRow([d.name, d.stage, d.m.daysOwned, d.m.holdPerMonth, d.m.totalHolding, perDay]);
    });

  } else if (activeReport === "contractors") {
    csv += csvRow(["Contractor", "Trade", "Rehab", "Accepted Bids", "Total Paid", "Outstanding"]);
    const filterDealId = dealFilter !== "all" ? dealFilter : null;
    _CON.forEach(c => {
      const bids = _BIDS.filter(b => b.contractorId === c.id && b.status === "accepted" && (!filterDealId || b.dealId === filterDealId));
      const pays = _FE.filter(e => e.contractorId === c.id && (e.status || "paid") === "paid" && (!filterDealId || e.dealId === filterDealId));
      if (bids.length === 0 && pays.length === 0) return;
      const accepted = bids.reduce((s, b) => s + b.amount, 0);
      const paid = pays.reduce((s, e) => s + (e.amount || 0), 0);
      const projectName = filterDealId ? (_DEALS.find(f => f.id === filterDealId)?.name || "") : "(across all)";
      csv += csvRow([c.name, c.trade || "", projectName, accepted, paid, accepted - paid]);
    });

  } else if (activeReport === "capitalGains") {
    csv += csvRow(["Rehab", "Sale Price", "Total Basis", "Capital Gain", "Sold Date"]);
    allMetrics.filter(d => d.stage === "Sold").forEach(d => {
      csv += csvRow([d.name, d.salePrice || d.m.saleOrARV, d.m.totalInvested, d.m.profit, d.closeDate || ""]);
    });

  } else if (activeReport === "cashflow") {
    csv += csvRow(["Rehab", "Stage", "Total Invested", "Sale / ARV", "Net Cash Flow", "Days Owned"]);
    allMetrics.forEach(d => {
      csv += csvRow([d.name, d.stage, d.m.totalInvested, d.m.saleOrARV, d.m.profit, d.m.daysOwned]);
    });

  } else if (activeReport === "pipeline") {
    csv += csvRow(["Stage", "Rehab Count", "Total Value (Sale/ARV)", "Total Invested", "Projected Profit"]);
    STAGE_ORDER.forEach(stage => {
      const inStage = allMetrics.filter(d => d.stage === stage);
      if (inStage.length === 0) return;
      const totalValue = inStage.reduce((s, d) => s + d.m.saleOrARV, 0);
      const totalInv = inStage.reduce((s, d) => s + d.m.totalInvested, 0);
      const totalProfit = inStage.reduce((s, d) => s + d.m.profit, 0);
      csv += csvRow([stage, inStage.length, totalValue, totalInv, totalProfit]);
    });
  }

  return { csv, scopeName };
}

// Transaction Detail uses different inputs (date range + per-row tx filters)
// than the project-level reports, so it gets its own CSV builder.
function buildTxDetailCSV(rows, dealFilter) {
  const scopeName = dealFilter === "all" ? "All Rehabs" : _DEALS.find(f => f.id === dealFilter)?.name || "Rehab";
  let csv = csvRow(["Date", "Rehab", "Category", "Vendor", "Description", "Amount"]);
  rows.forEach(r => {
    const dealName = _DEALS.find(f => f.id === r.dealId)?.name || "—";
    csv += csvRow([r.date, dealName, r.category || "", r.vendor || "", r.description || "", r.amount]);
  });
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
  csv += csvRow(["", "", "", "", `Totals (${rows.length} expenses)`, total]);
  return { csv, scopeName };
}

// ─── Shared styles ───────────────────────────────────────────────────────────
const iS = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 14, color: "var(--text-primary)", background: "var(--surface)", outline: "none" };
const thS = { padding: "11px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" };
const tdS = { padding: "12px 16px", fontSize: 13, color: "var(--text-primary)", borderTop: "1px solid var(--border-subtle)" };
const sectionS = { background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", marginBottom: 24 };

// InfoTip moved to shared.jsx

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
export function DealReports() {
  const [activeReport, setActiveReport] = useState("profitability");
  const [dealFilter, setDealFilter] = useState("all");
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));

  // Transaction Detail state — date range, search, sort, category filter
  const [txSearch, setTxSearch] = useState("");
  const [txCatFilter, setTxCatFilter] = useState("all");
  const [txSort, setTxSort] = useState("date-desc");
  const [txDateFrom, setTxDateFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [txDateTo, setTxDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [txDatePreset, setTxDatePreset] = useState("ytd");

  // Available years for the year dropdown — union of acquisition / close / expense dates
  const yearOptions = useMemo(() => {
    const ys = new Set([new Date().getFullYear()]);
    _DEALS.forEach(d => {
      if (d.acquisitionDate) ys.add(new Date(d.acquisitionDate).getFullYear());
      if (d.contractDate)    ys.add(new Date(d.contractDate).getFullYear());
      if (d.closeDate)       ys.add(new Date(d.closeDate).getFullYear());
    });
    _FE.forEach(e => { if (e.date) ys.add(new Date(e.date).getFullYear()); });
    return [...ys].sort((a, b) => b - a).map(String);
  }, []);

  const deals = dealFilter === "all" ? _DEALS : _DEALS.filter(f => f.id === dealFilter);
  const allMetrics = deals.map(f => ({ ...f, m: calcDealMetrics(f) }));

  // Portfolio-level KPIs
  const totalInvested = allMetrics.reduce((s, d) => s + d.m.totalInvested, 0);
  const totalProfit   = allMetrics.reduce((s, d) => s + d.m.profit, 0);
  const totalRehab    = allMetrics.reduce((s, d) => s + d.m.rehabSpent, 0);
  const totalBudget   = allMetrics.reduce((s, d) => s + d.m.rehabBudget, 0);
  const avgROI        = allMetrics.length > 0 ? allMetrics.reduce((s, d) => s + d.m.roi, 0) / allMetrics.length : 0;

  const profitReports = [
    { id: "profitability",  label: "Rehab Profitability",    icon: DollarSign  },
    { id: "rehabBudget",    label: "Rehab Budget vs Actual",icon: BarChart3   },
    { id: "holdingCosts",   label: "Holding Costs",         icon: Clock       },
  ];
  const operationalReports = [
    { id: "contractors",    label: "Contractor Payments",   icon: Users       },
    { id: "capitalGains",   label: "Capital Gains",         icon: TrendingUp  },
    { id: "cashflow",       label: "Cash Flow",             icon: DollarSign  },
    { id: "txdetail",       label: "Transaction Detail",    icon: List        },
    { id: "pipeline",       label: "Pipeline Value",        icon: Target      },
  ];

  // Reports that respect the top-level taxYear dropdown
  const yearScopedReports = new Set(["contractors", "capitalGains", "cashflow"]);
  const yearApplies = yearScopedReports.has(activeReport);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Rehab Reports</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Profitability, rehab analysis, contractor payments, and projections</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {yearApplies && (
            <select value={taxYear} onChange={e => setTaxYear(e.target.value)} style={{ ...iS, width: 110 }} title="Filter to expenses, sales, and payments that fall within this year">
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <select value={dealFilter} onChange={e => setDealFilter(e.target.value)} style={{ ...iS, width: 220 }}>
            <option value="all">All Rehabs</option>
            {_DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button onClick={() => {
            const ts = new Date().toISOString().slice(0, 10);
            if (activeReport === "txdetail") {
              const rows = filterTxDetail({ txDateFrom, txDateTo, txCatFilter, txSearch, txSort, dealFilter });
              const { csv, scopeName } = buildTxDetailCSV(rows, dealFilter);
              const safeScope = scopeName.replace(/[^a-zA-Z0-9_-]/g, "_");
              downloadFile(csv, `PROPBOOKS_txdetail_${safeScope}_${txDateFrom}_to_${txDateTo}.csv`, "text/csv");
              return;
            }
            const { csv, scopeName } = buildProjectReportCSV(activeReport, allMetrics, dealFilter);
            const safeScope = scopeName.replace(/[^a-zA-Z0-9_-]/g, "_");
            const yearSuffix = yearApplies ? `_${taxYear}` : "";
            downloadFile(csv, `PROPBOOKS_${activeReport}_${safeScope}${yearSuffix}_${ts}.csv`, "text/csv");
          }} style={{ background: "var(--surface)", color: "var(--text-label)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Invested",  value: fmt(totalInvested), tip: "Purchase + rehab spent + holding costs + selling costs" },
          { label: "Total Profit",    value: fmt(totalProfit),   tip: "Sale price (or ARV) minus total invested" },
          { label: "Avg ROI",         value: `${avgROI.toFixed(1)}%`, tip: "Average return on investment across all rehabs" },
          { label: "Rehab Spend",     value: fmt(totalRehab),    tip: "Total rehab dollars spent across all rehabs" },
          { label: "Budget Variance", value: `${totalBudget > 0 ? (((totalRehab - totalBudget) / totalBudget) * 100).toFixed(1) : 0}%`, tip: "How much total rehab spend is over/under total budget" },
        ].map((m, i) => (
          <div key={i} style={{ background: "var(--surface)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
        {/* Sidebar */}
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", height: "fit-content" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 14px 4px" }}>Profitability</p>
          {profitReports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: activeReport === r.id ? "var(--active-highlight)" : "transparent", color: activeReport === r.id ? "#e95e00" : "var(--text-label)", fontWeight: activeReport === r.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
              <r.icon size={16} /> {r.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "8px 14px", paddingTop: 0 }} />
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 14px 4px" }}>Operational</p>
          {operationalReports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: activeReport === r.id ? "var(--active-highlight)" : "transparent", color: activeReport === r.id ? "#e95e00" : "var(--text-label)", fontWeight: activeReport === r.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
              <r.icon size={16} /> {r.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 12, paddingTop: 12 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", padding: "0 14px", marginBottom: 6 }}>Scope</p>
            <p style={{ fontSize: 12, color: "var(--text-label)", padding: "0 14px", fontWeight: 600 }}>{dealFilter === "all" ? `All ${_DEALS.length} rehabs` : _DEALS.find(f => f.id === dealFilter)?.name}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "0 14px" }}>{deals.filter(d => d.stage === "Sold").length} sold · {deals.filter(d => d.stage !== "Sold").length} active</p>
            {yearApplies && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 14px 0" }}>Year {taxYear}</p>
            )}
            {activeReport === "txdetail" && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 14px 0" }}>{txDateFrom} – {txDateTo}</p>
            )}
          </div>
        </div>

        {/* Content */}
        <div>
          {activeReport === "profitability" && <ProfitabilityReport deals={allMetrics} />}
          {activeReport === "rehabBudget"   && <RehabBudgetReport deals={allMetrics} />}
          {activeReport === "holdingCosts"  && <HoldingCostsReport deals={allMetrics} />}
          {activeReport === "contractors"   && <ContractorPaymentsReport dealFilter={dealFilter} taxYear={taxYear} />}
          {activeReport === "capitalGains"  && <CapitalGainsReport deals={allMetrics} taxYear={taxYear} />}
          {activeReport === "cashflow"      && <CashFlowReport deals={allMetrics} taxYear={taxYear} />}
          {activeReport === "txdetail"      && (
            <TransactionDetailReport
              dealFilter={dealFilter}
              txDateFrom={txDateFrom} setTxDateFrom={setTxDateFrom}
              txDateTo={txDateTo}     setTxDateTo={setTxDateTo}
              txDatePreset={txDatePreset} setTxDatePreset={setTxDatePreset}
              txSearch={txSearch}     setTxSearch={setTxSearch}
              txCatFilter={txCatFilter} setTxCatFilter={setTxCatFilter}
              txSort={txSort}         setTxSort={setTxSort}
            />
          )}
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
  const chartData = sorted.map(d => ({ name: d.image || d.name.split(" ").map(w => w[0]).join("").slice(0, 3), fullName: d.name, profit: d.m.profit, invested: d.m.totalInvested }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Rehab Profitability Summary</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Profit, ROI, and cost breakdown per rehab</p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Rehab", "Stage", "Purchase", "Rehab", "Invested", "Sale / ARV", "Profit", "ROI", "Annualized"].map(h => (
                  <th key={h} style={{ ...thS, textAlign: h === "Rehab" || h === "Stage" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(d => {
                const stg = STAGE_COLORS[d.stage] || { bg: "#f1f5f9", text: "var(--text-secondary)" };
                return (
                  <tr key={d.id}>
                    <td style={{ ...tdS, fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--avatar-bg)", flexShrink: 0 }} />
                        {d.name}
                      </div>
                    </td>
                    <td style={tdS}><span style={{ background: stg.bg, color: stg.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", display: "inline-block", lineHeight: 1.4 }}>{d.stage}</span></td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(d.purchasePrice)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(d.m.rehabSpent)}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }} title={`Purchase ${fmt(d.purchasePrice)} + Rehab ${fmt(d.m.rehabSpent)} + Holding ${fmt(d.m.totalHolding)} + Selling ${fmt(d.m.sellingCosts)}`}>{fmt(d.m.totalInvested)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(d.m.saleOrARV)}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: d.m.profit >= 0 ? "#1a7a4a" : "#c0392b" }}>{fmt(d.m.profit)}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600, color: d.m.roi >= 0 ? "#1a7a4a" : "#c0392b" }}>{d.m.roi.toFixed(1)}%</td>
                    <td style={{ ...tdS, textAlign: "right", color: "var(--text-secondary)" }}>{d.m.daysOwned > 0 ? `${d.m.annualized.toFixed(1)}%` : "—"}</td>
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
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(sorted.reduce((s, d) => s + d.m.totalInvested, 0))}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(sorted.reduce((s, d) => s + d.m.saleOrARV, 0))}</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: sorted.reduce((s, d) => s + d.m.profit, 0) >= 0 ? "#1a7a4a" : "#c0392b" }}>{fmt(sorted.reduce((s, d) => s + d.m.profit, 0))}</td>
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
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Profit by Rehab</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Net profit comparison across rehabs</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--chart-axis)" }} />
              <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 12, fill: "var(--chart-axis)" }} />
              <Tooltip formatter={v => fmt(v)} labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
              <Bar dataKey="profit" name="Profit" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? "#1a7a4a" : "#c0392b"} />)}
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
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--avatar-bg)" }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{d.name}</h3>
                <span style={{ background: STAGE_COLORS[d.stage]?.bg || "var(--surface-muted)", color: STAGE_COLORS[d.stage]?.text || "var(--text-secondary)", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{d.stage}</span>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>Budget: <strong style={{ color: "var(--text-primary)" }}>{fmt(totalBudget)}</strong></span>
                <span style={{ color: "var(--text-secondary)" }}>Spent: <strong style={{ color: totalSpent > totalBudget ? "#c0392b" : "var(--text-primary)" }}>{fmt(totalSpent)}</strong></span>
                <span style={{ color: variance > 0 ? "#c0392b" : "#1a7a4a", fontWeight: 700 }}>{variance > 0 ? "+" : ""}{variance.toFixed(1)}%</span>
              </div>
            </div>

            {/* Category table */}
            <div style={{ overflowX: "auto" }}>
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
                  const statusMap = { complete: { bg: "#cce8d8", text: "#1a7a4a" }, "in-progress": { bg: "#dbeafe", text: "#1d4ed8" }, pending: { bg: "#f1f5f9", text: "var(--text-secondary)" } };
                  const st = statusMap[item.status] || statusMap.pending;
                  return (
                    <tr key={idx}>
                      <td style={{ ...tdS, fontWeight: 600 }}>{item.category}</td>
                      <td style={tdS}><span style={{ background: st.bg, color: st.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{item.status}</span></td>
                      <td style={{ ...tdS, textAlign: "right" }}>{fmt(item.budgeted)}</td>
                      <td style={{ ...tdS, textAlign: "right" }}>{fmt(item.spent)}</td>
                      <td style={{ ...tdS, textAlign: "right", fontWeight: 600, color: v > 0 ? "#c0392b" : v < 0 ? "#1a7a4a" : "var(--text-secondary)" }}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</td>
                      <td style={{ ...tdS, minWidth: 120 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: "var(--surface-muted)", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: pct > 100 ? "#c0392b" : pct === 100 ? "#1a7a4a" : "#3b82f6", borderRadius: 99, transition: "width 0.3s" }} />
                          </div>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", minWidth: 32 }}>{Math.round(pct)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Grouped bar chart */}
            {chartData.length > 0 && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
                  <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
                  <Tooltip formatter={v => fmt(v)} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
                  <Bar dataKey="budgeted" name="Budgeted" fill="var(--chart-bar-primary)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="spent" name="Spent" fill="#e95e00" radius={[6, 6, 0, 0]} />
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
  const chartData = sorted.map(d => ({ name: d.image || d.name.split(" ").map(w => w[0]).join("").slice(0, 3), fullName: d.name, holding: d.m.totalHolding, daily: d.m.holdPerMonth > 0 ? Math.round(d.m.holdPerMonth / 30) : 0 }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Holding Cost Analysis</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Monthly burn rate, days held, and total holding costs per rehab</p>

        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Rehab", "Stage", "Days Held", "Monthly Burn", "Daily Burn", "Total Holding", "% of Invest", "Holding / Profit"].map(h => (
                <th key={h} style={{ ...thS, textAlign: h === "Rehab" || h === "Stage" ? "left" : "right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(d => {
              const pctInv = d.m.totalInvested > 0 ? (d.m.totalHolding / d.m.totalInvested * 100) : 0;
              const holdVsProfit = d.m.profit > 0 ? (d.m.totalHolding / d.m.profit * 100) : 0;
              const daily = d.m.holdPerMonth > 0 ? Math.round(d.m.holdPerMonth / 30) : 0;
              const stg = STAGE_COLORS[d.stage] || { bg: "var(--surface-muted)", text: "var(--text-secondary)" };
              return (
                <tr key={d.id}>
                  <td style={{ ...tdS, fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--avatar-bg)", flexShrink: 0 }} />
                      {d.name}
                    </div>
                  </td>
                  <td style={tdS}><span style={{ background: stg.bg, color: stg.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", display: "inline-block", lineHeight: 1.4 }}>{d.stage}</span></td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{d.m.daysOwned || "—"}</td>
                  <td style={{ ...tdS, textAlign: "right" }}>{fmt(d.m.holdPerMonth)}<span style={{ color: "var(--text-muted)", fontSize: 11 }}>/mo</span></td>
                  <td style={{ ...tdS, textAlign: "right" }}>{fmt(daily)}<span style={{ color: "var(--text-muted)", fontSize: 11 }}>/day</span></td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: "#c0392b" }}>{fmt(d.m.totalHolding)}</td>
                  <td style={{ ...tdS, textAlign: "right" }}>{pctInv.toFixed(1)}%</td>
                  <td style={{ ...tdS, textAlign: "right", color: holdVsProfit > 30 ? "#c0392b" : "var(--text-secondary)" }}>{d.m.profit > 0 ? `${holdVsProfit.toFixed(1)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {chartData.length > 1 && (
        <div style={sectionS}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Holding Costs by Rehab</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Total holding cost comparison</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--chart-axis)" }} />
              <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 12, fill: "var(--chart-axis)" }} />
              <Tooltip formatter={v => fmt(v)} labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
              <Bar dataKey="holding" name="Total Holding" fill="var(--chart-bar-primary)" radius={[6, 6, 0, 0]} />
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
function ContractorPaymentsReport({ dealFilter, taxYear }) {
  const filterDealId = dealFilter !== "all" ? dealFilter : null;
  const yr = Number(taxYear);

  // Helpers — bids come from CONTRACTOR_BIDS, payments derive from
  // DEAL_EXPENSES rows linked via contractorId (paid status only). Both are
  // restricted to the active tax year so figures match 1099 / tax reporting.
  const getBids = (c) => _BIDS.filter(b =>
    b.contractorId === c.id
    && (!filterDealId || b.dealId === filterDealId)
    && (!b.date || new Date(b.date).getFullYear() === yr));
  const getPayments = (c) => _FE.filter(e =>
    e.contractorId === c.id && (e.status || "paid") === "paid"
    && (!filterDealId || e.dealId === filterDealId)
    && (!e.date || new Date(e.date).getFullYear() === yr));

  // Only include contractors with activity in the current scope
  const contractors = _CON.filter(c => {
    if (filterDealId) return (c.dealIds || []).includes(filterDealId);
    return getBids(c).length > 0 || getPayments(c).length > 0;
  });

  const sorted = [...contractors].sort((a, b) => {
    const aPaid = getPayments(b).reduce((s, p) => s + p.amount, 0);
    const bPaid = getPayments(a).reduce((s, p) => s + p.amount, 0);
    return aPaid - bPaid;
  });

  const totalBids     = contractors.reduce((s, c) => s + getBids(c).reduce((bs, b) => bs + b.amount, 0), 0);
  const totalAccepted = contractors.reduce((s, c) => s + getBids(c).filter(b => b.status === "accepted").reduce((bs, b) => bs + b.amount, 0), 0);
  const totalPaid     = contractors.reduce((s, c) => s + getPayments(c).reduce((ps, p) => ps + p.amount, 0), 0);
  const outstanding   = totalAccepted - totalPaid;

  // Pie chart by trade
  const byTrade = {};
  contractors.forEach(c => {
    const paid = getPayments(c).reduce((s, p) => s + p.amount, 0);
    if (paid > 0) byTrade[c.trade] = (byTrade[c.trade] || 0) + paid;
  });
  const pieData = Object.entries(byTrade).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const PIE_COLORS = ["#3b82f6", "#1a7a4a", "#f59e0b", "#8b5cf6", "#c0392b", "#06b6d4", "#ec4899", "var(--text-secondary)"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Bid Value",     value: fmt(totalBids),     tip: "Sum of all bids across all contractors" },
          { label: "Accepted Bids",       value: fmt(totalAccepted), tip: "Total value of accepted bids only" },
          { label: "Total Paid",          value: fmt(totalPaid),     tip: "Total payments disbursed to all contractors" },
          { label: "Outstanding Balance", value: fmt(outstanding),   tip: "Accepted bids minus payments made" },
        ].map((m, i) => (
          <div key={i} style={{ background: "var(--surface)", borderRadius: 16, padding: "18px 20px", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 4, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: "var(--text-primary)", fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Contractor table */}
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Contractor Payment Detail</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>All contractors with bids or payments</p>

        {sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No contractor activity to report.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Contractor", "Trade", "Rehabs", "Total Bids", "Accepted", "Paid", "Outstanding", "Acceptance Rate"].map(h => (
                  <th key={h} style={{ ...thS, textAlign: h === "Contractor" || h === "Trade" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const bids = getBids(c);
                const pays = getPayments(c);
                const bidTotal = bids.reduce((s, b) => s + b.amount, 0);
                const acceptTotal = bids.filter(b => b.status === "accepted").reduce((s, b) => s + b.amount, 0);
                const paidTotal = pays.reduce((s, p) => s + p.amount, 0);
                const owed = acceptTotal - paidTotal;
                const acceptRate = bids.length > 0 ? Math.round((bids.filter(b => b.status === "accepted").length / bids.length) * 100) : 0;
                const dealCount = filterDealId ? 1 : (c.dealIds || []).length;
                return (
                  <tr key={c.id}>
                    <td style={{ ...tdS, fontWeight: 600 }}>{c.name}</td>
                    <td style={{ ...tdS, color: "var(--text-secondary)" }}>{c.trade}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{dealCount}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(bidTotal)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmt(acceptTotal)}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600, color: "#1a7a4a" }}>{fmt(paidTotal)}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600, color: owed > 0 ? "#c0392b" : "#1a7a4a" }}>{fmt(owed)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{acceptRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Pie by trade */}
      {pieData.length > 1 && (
        <div style={sectionS}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Payments by Trade</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Distribution of contractor payments by trade specialty</p>
          <ResponsiveContainer width="100%" height={340}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={0}
                label={({ name, percent, x, y, midAngle }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = 130;
                  const cx2 = 0; const cy2 = 0;
                  return `${name} (${(percent * 100).toFixed(0)}%)`;
                }}
                labelLine={{ stroke: "var(--text-muted)", strokeWidth: 1 }}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
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
function CapitalGainsReport({ deals, taxYear }) {
  const today = new Date().toISOString().slice(0, 10);
  const yr = Number(taxYear);

  // Limit to rehabs sold in the active tax year. Unsold rehabs stay visible
  // (projected) so investors can plan ahead, but only for the current year.
  const scoped = deals.filter(d => {
    if (d.closeDate) return new Date(d.closeDate).getFullYear() === yr;
    return yr === new Date().getFullYear();
  });

  const rows = scoped.map(d => {
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
          { label: "Total Capital Gains", value: fmt(totalGains), color: totalGains >= 0 ? "#1a7a4a" : "#c0392b", tip: "Sum of profit across all rehabs" },
          { label: "Estimated Tax",       value: fmt(totalTax),   color: "#c0392b", tip: "22% short-term, 15% long-term estimate" },
          { label: "Short-Term Rehabs",   value: String(shortCount), color: "#f59e0b", tip: "Held less than 1 year — taxed as ordinary income" },
          { label: "Long-Term Rehabs",    value: String(longCount),  color: "#1a7a4a", tip: "Held 1+ years — lower capital gains rate" },
        ].map((m, i) => (
          <div key={i} style={{ background: "var(--surface)", borderRadius: 16, padding: "18px 20px", border: "1px solid var(--border-subtle)" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: m.color, fontSize: 22, fontWeight: 800 }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Capital Gains Projection</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Estimated tax liability by rehab — consult your CPA for actual filing</p>

        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Rehab", "Acquired", "Sold / Projected", "Days Held", "Type", "Gain / Loss", "Tax Rate", "Est. Tax", "After Tax"].map(h => (
                <th key={h} style={{ ...thS, textAlign: h === "Rehab" ? "left" : "right" }}>{h}</th>
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
                  <span style={{ background: r.isShortTerm ? "#fef9c3" : "#cce8d8", color: r.isShortTerm ? "#a16207" : "#1a7a4a", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                    {r.isShortTerm ? "Short-Term" : "Long-Term"}
                  </span>
                </td>
                <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: r.gain >= 0 ? "#1a7a4a" : "#c0392b" }}>{fmt(r.gain)}</td>
                <td style={{ ...tdS, textAlign: "right" }}>{(r.estTaxRate * 100).toFixed(0)}%</td>
                <td style={{ ...tdS, textAlign: "right", color: "#c0392b" }}>{fmt(r.estTax)}</td>
                <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{fmt(r.afterTax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
          Tax estimates use 22% for short-term and 15% for long-term gains. Actual rates depend on your income bracket. Consult a tax professional.
        </p>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 6. CASH FLOW
// ═══════════════════════════════════════════════════════════════════════════════
function CashFlowReport({ deals, taxYear }) {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const yr = Number(taxYear);

  // Group expenses by month, scoped to the active tax year so the monthly
  // buckets reflect actual cash movement that year (not just same-month rows
  // from any year).
  const monthlyData = MONTHS.map((month, i) => {
    const monthExpenses = _FE.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === yr && d.getMonth() === i && deals.some(dl => dl.id === e.dealId);
    });
    const purchases = deals.filter(f => {
      const acqDate = f.acquisitionDate || f.contractDate;
      if (!acqDate) return false;
      const d = new Date(acqDate);
      return d.getFullYear() === yr && d.getMonth() === i;
    }).reduce((s, f) => s + f.purchasePrice, 0);
    const sales = deals.filter(f => {
      if (!f.closeDate) return false;
      const d = new Date(f.closeDate);
      return d.getFullYear() === yr && d.getMonth() === i;
    }).reduce((s, f) => s + (f.salePrice || 0), 0);
    const rehabSpend = monthExpenses.reduce((s, e) => s + e.amount, 0);
    // Holding costs apply for months the rehab was actively held within the year
    const yearStart = new Date(`${yr}-01-01`);
    const yearEnd = new Date(`${yr}-12-31`);
    const holdingCosts = deals.filter(f => {
      const start = f.acquisitionDate || f.contractDate;
      if (!start) return false;
      const s = new Date(start);
      const e = f.closeDate ? new Date(f.closeDate) : new Date();
      const monthStart = new Date(yr, i, 1);
      const monthEnd = new Date(yr, i + 1, 0);
      // active during this month if s <= monthEnd and e >= monthStart, and intersects year
      return s <= monthEnd && e >= monthStart && s <= yearEnd && e >= yearStart;
    }).reduce((s, f) => s + (f.holdingCostsPerMonth || 0), 0);

    const totalOut = purchases + rehabSpend + holdingCosts;
    const net = sales - totalOut;
    return { month, sales, purchases, rehabSpend, holdingCosts, totalOut, net };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Monthly Cash Flow</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Money in (sales) vs money out (purchases, rehab, holding) by month</p>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--chart-axis)" }} />
            <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 12, fill: "var(--chart-axis)" }} />
            <Tooltip formatter={v => fmt(v)} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
            <Bar dataKey="sales" name="Sales" fill="#1a7a4a" radius={[6, 6, 0, 0]} />
            <Bar dataKey="totalOut" name="Cash Out" fill="#c0392b" radius={[6, 6, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Cash Flow Detail</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Monthly breakdown of inflows and outflows</p>

        <div style={{ overflowX: "auto" }}>
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
                <td style={{ ...tdS, textAlign: "right", color: m.sales > 0 ? "#1a7a4a" : "var(--text-muted)" }}>{m.sales > 0 ? fmt(m.sales) : "—"}</td>
                <td style={{ ...tdS, textAlign: "right", color: m.purchases > 0 ? "#c0392b" : "var(--text-muted)" }}>{m.purchases > 0 ? fmt(m.purchases) : "—"}</td>
                <td style={{ ...tdS, textAlign: "right" }}>{m.rehabSpend > 0 ? fmt(m.rehabSpend) : "—"}</td>
                <td style={{ ...tdS, textAlign: "right" }}>{m.holdingCosts > 0 ? fmt(m.holdingCosts) : "—"}</td>
                <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{m.totalOut > 0 ? fmt(m.totalOut) : "—"}</td>
                <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: m.net >= 0 ? "#1a7a4a" : "#c0392b" }}>{fmt(m.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--surface-alt)" }}>
              <td style={{ ...tdS, fontWeight: 700 }}>Total</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: "#1a7a4a" }}>{fmt(monthlyData.reduce((s, m) => s + m.sales, 0))}</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(monthlyData.reduce((s, m) => s + m.purchases, 0))}</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(monthlyData.reduce((s, m) => s + m.rehabSpend, 0))}</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(monthlyData.reduce((s, m) => s + m.holdingCosts, 0))}</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{fmt(monthlyData.reduce((s, m) => s + m.totalOut, 0))}</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: monthlyData.reduce((s, m) => s + m.net, 0) >= 0 ? "#1a7a4a" : "#c0392b" }}>{fmt(monthlyData.reduce((s, m) => s + m.net, 0))}</td>
            </tr>
          </tfoot>
        </table>
        </div>
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
    const colors = STAGE_COLORS[stage] || { bg: "#f1f5f9", text: "var(--text-secondary)" };
    return { stage, deals: stageDeals, count: stageDeals.length, totalARV, totalInvested, totalProfit, colors };
  });

  const totalPipeline = deals.reduce((s, d) => s + (d.salePrice || d.arv || 0), 0);
  const activeDeals = deals.filter(d => d.stage !== "Sold");
  const projectedProfit = activeDeals.reduce((s, d) => s + d.m.profit, 0);
  const realizedProfit = deals.filter(d => d.stage === "Sold").reduce((s, d) => s + d.m.profit, 0);

  const pieData = stages.filter(s => s.count > 0).map(s => ({ name: s.stage, value: s.totalARV }));
  const PIE_COLORS = { "Under Contract": "#8b5cf6", "Active Rehab": "#f59e0b", "Listed": "#3b82f6", "Sold": "#1a7a4a" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Pipeline Value",  value: fmt(totalPipeline),   color: "#3b82f6", tip: "Combined ARV / sale price of all rehabs" },
          { label: "Active Rehabs",          value: String(activeDeals.length), color: "#f59e0b", tip: "Rehabs not yet sold" },
          { label: "Projected Profit",      value: fmt(projectedProfit), color: "#8b5cf6", tip: "Estimated profit on unsold rehabs (ARV minus costs)" },
          { label: "Realized Profit",       value: fmt(realizedProfit),  color: "#1a7a4a", tip: "Actual profit from sold rehabs" },
        ].map((m, i) => (
          <div key={i} style={{ background: "var(--surface)", borderRadius: 16, padding: "18px 20px", border: "1px solid var(--border-subtle)" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: m.color, fontSize: 22, fontWeight: 800 }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Stage breakdown */}
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Pipeline by Stage</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Rehab count, value, and projected profit at each stage</p>

        <div style={{ display: "grid", gridTemplateColumns: pieData.length > 1 ? "1fr 300px" : "1fr", gap: 24 }}>
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Stage", "Rehabs", "Total ARV / Sale", "Total Invested", "Projected Profit", "Avg ROI"].map(h => (
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
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: s.totalProfit >= 0 ? "#1a7a4a" : "#c0392b" }}>{fmt(s.totalProfit)}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{avgRoi.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {pieData.length > 1 && (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={0}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: "var(--text-muted)", strokeWidth: 1 }}>
                  {pieData.map((d, i) => <Cell key={i} fill={PIE_COLORS[d.name] || "var(--text-secondary)"} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Deal timeline */}
      <div style={sectionS}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Rehab Timeline</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Key dates and projected milestones for each rehab</p>

        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Rehab", "Stage", "Acquired", "Rehab Start", "Rehab End", "Listed", "Closed", "Days"].map(h => (
                <th key={h} style={{ ...thS, textAlign: h === "Rehab" || h === "Stage" ? "left" : "right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map(d => {
              const stg = STAGE_COLORS[d.stage] || { bg: "var(--surface-muted)", text: "var(--text-secondary)" };
              return (
                <tr key={d.id}>
                  <td style={{ ...tdS, fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--avatar-bg)", flexShrink: 0 }} />
                      {d.name}
                    </div>
                  </td>
                  <td style={tdS}><span style={{ background: stg.bg, color: stg.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", display: "inline-block", lineHeight: 1.4 }}>{d.stage}</span></td>
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
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 8. TRANSACTION DETAIL
// ═══════════════════════════════════════════════════════════════════════════════
// Pure filter used by both the on-screen table and the CSV export so they
// stay in lockstep. Sources from DEAL_EXPENSES — rehabs are expense-only.
function filterTxDetail({ txDateFrom, txDateTo, txCatFilter, txSearch, txSort, dealFilter }) {
  const fromDate = new Date(txDateFrom + "T00:00:00");
  const toDate = new Date(txDateTo + "T23:59:59");
  const scopeDealId = dealFilter !== "all" ? dealFilter : null;

  let rows = _FE.filter(e => {
    const d = new Date(e.date);
    if (d < fromDate || d > toDate) return false;
    if (scopeDealId && e.dealId !== scopeDealId) return false;
    return true;
  });

  if (txCatFilter !== "all") rows = rows.filter(e => e.category === txCatFilter);
  if (txSearch.trim()) {
    const q = txSearch.toLowerCase();
    rows = rows.filter(e => {
      const dealName = _DEALS.find(f => f.id === e.dealId)?.name || "";
      return (e.description || "").toLowerCase().includes(q)
        || (e.category || "").toLowerCase().includes(q)
        || (e.vendor || "").toLowerCase().includes(q)
        || dealName.toLowerCase().includes(q);
    });
  }

  rows = [...rows].sort((a, b) => {
    if (txSort === "date-desc") return new Date(b.date) - new Date(a.date);
    if (txSort === "date-asc")  return new Date(a.date) - new Date(b.date);
    if (txSort === "amount-desc") return Math.abs(b.amount) - Math.abs(a.amount);
    if (txSort === "amount-asc")  return Math.abs(a.amount) - Math.abs(b.amount);
    if (txSort === "rehab") {
      const aName = _DEALS.find(f => f.id === a.dealId)?.name || "";
      const bName = _DEALS.find(f => f.id === b.dealId)?.name || "";
      return aName.localeCompare(bName);
    }
    if (txSort === "category") return (a.category || "").localeCompare(b.category || "");
    return 0;
  });

  return rows;
}

function TransactionDetailReport({
  dealFilter,
  txDateFrom, setTxDateFrom,
  txDateTo, setTxDateTo,
  txDatePreset, setTxDatePreset,
  txSearch, setTxSearch,
  txCatFilter, setTxCatFilter,
  txSort, setTxSort,
}) {
  const applyPreset = (preset) => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    setTxDatePreset(preset);
    if (preset === "thisMonth") {
      setTxDateFrom(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`);
      setTxDateTo(todayStr);
    } else if (preset === "lastMonth") {
      const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      setTxDateFrom(lm.toISOString().slice(0, 10));
      setTxDateTo(lmEnd.toISOString().slice(0, 10));
    } else if (preset === "90days") {
      const d90 = new Date(today); d90.setDate(d90.getDate() - 90);
      setTxDateFrom(d90.toISOString().slice(0, 10));
      setTxDateTo(todayStr);
    } else if (preset === "ytd") {
      setTxDateFrom(`${today.getFullYear()}-01-01`);
      setTxDateTo(todayStr);
    } else if (preset === "lastYear") {
      setTxDateFrom(`${today.getFullYear() - 1}-01-01`);
      setTxDateTo(`${today.getFullYear() - 1}-12-31`);
    } else if (preset === "all") {
      setTxDateFrom("2000-01-01");
      setTxDateTo(todayStr);
    }
  };

  // Date-scope rows BEFORE applying user filters, so the category dropdown
  // surfaces only categories that actually exist in the date window.
  const fromDate = new Date(txDateFrom + "T00:00:00");
  const toDate = new Date(txDateTo + "T23:59:59");
  const scopeDealId = dealFilter !== "all" ? dealFilter : null;
  const dateScoped = _FE.filter(e => {
    const d = new Date(e.date);
    if (d < fromDate || d > toDate) return false;
    if (scopeDealId && e.dealId !== scopeDealId) return false;
    return true;
  });
  const categories = [...new Set(dateScoped.map(e => e.category).filter(Boolean))].sort();

  const sorted = filterTxDetail({ txDateFrom, txDateTo, txCatFilter, txSearch, txSort, dealFilter });

  const totalSpent = sorted.reduce((s, e) => s + (e.amount || 0), 0);
  const dealsInView = new Set(sorted.map(e => e.dealId)).size;

  // Top category by spend
  const catTotals = {};
  sorted.forEach(e => {
    const c = e.category || "Uncategorized";
    catTotals[c] = (catTotals[c] || 0) + (e.amount || 0);
  });
  const topCatEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  const topCatName = topCatEntry ? topCatEntry[0] : "—";
  const topCatTotal = topCatEntry ? topCatEntry[1] : 0;
  const topCatCount = topCatEntry ? sorted.filter(e => (e.category || "Uncategorized") === topCatName).length : 0;

  return (
    <div>
      <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Transaction Detail</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>All rehab expenses for the selected date range · Filter by category, rehab, or search</p>

      {/* Date range row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "thisMonth", label: "This Month" },
          { id: "lastMonth", label: "Last Month" },
          { id: "90days",    label: "Last 90 Days" },
          { id: "ytd",       label: "Year to Date" },
          { id: "lastYear",  label: "Last Year" },
          { id: "all",       label: "All Time" },
        ].map(p => (
          <button key={p.id} onClick={() => applyPreset(p.id)} style={{ padding: "7px 14px", borderRadius: 8, border: txDatePreset === p.id ? "2px solid #3b82f6" : "1px solid var(--border)", background: txDatePreset === p.id ? "var(--info-tint)" : "var(--surface)", color: txDatePreset === p.id ? "var(--c-blue)" : "var(--text-label)", fontWeight: txDatePreset === p.id ? 700 : 500, fontSize: 12, cursor: "pointer" }}>
            {p.label}
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          <input type="date" value={txDateFrom} onChange={e => { setTxDateFrom(e.target.value); setTxDatePreset("custom"); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, color: "var(--text-primary)" }} />
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>to</span>
          <input type="date" value={txDateTo} onChange={e => { setTxDateTo(e.target.value); setTxDatePreset("custom"); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, color: "var(--text-primary)" }} />
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Spent",   value: fmt(totalSpent), color: "#c0392b", bg: "var(--danger-tint)", tip: "Sum of all rehab expenses in the date range and filters" },
          { label: "Transactions",  value: String(sorted.length), color: "var(--c-blue)", bg: "var(--info-tint)", tip: "Count of expense rows matching the current filters" },
          { label: "Rehabs",        value: String(dealsInView), color: "#8b5cf6", bg: "var(--info-tint-alt)", tip: "Distinct rehab projects with expenses in this view" },
          { label: "Top Category",  value: topCatName, color: "#e95e00", bg: "var(--surface-alt)", tip: topCatEntry ? `${fmt(topCatTotal)} across ${topCatCount} expense${topCatCount === 1 ? "" : "s"}` : "No expenses in range" },
        ].map((m, i) => (
          <div key={i} style={{ background: m.bg, borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border-subtle)" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
            <p style={{ color: m.color, fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search description, vendor, rehab..." style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, color: "var(--text-primary)", outline: "none", background: "var(--surface)" }} />
        </div>
        <select value={txCatFilter} onChange={e => setTxCatFilter(e.target.value)} style={{ ...iS, width: 220 }}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={txSort} onChange={e => setTxSort(e.target.value)} style={{ ...iS, width: 170 }}>
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="amount-desc">Largest Amount</option>
          <option value="amount-asc">Smallest Amount</option>
          <option value="rehab">By Rehab</option>
          <option value="category">By Category</option>
        </select>
      </div>

      {/* Transaction table */}
      <div style={sectionS}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Date", "Rehab", "Category", "Vendor", "Description", "Amount"].map(h => (
                  <th key={h} style={{ ...thS, textAlign: h === "Amount" ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No expenses match your filters</td></tr>
              ) : sorted.slice(0, 200).map((e, i) => {
                const dealName = _DEALS.find(f => f.id === e.dealId)?.name || "—";
                return (
                  <tr key={e.id || i} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                    <td style={{ ...tdS, fontSize: 12, whiteSpace: "nowrap" }}>{new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td style={{ ...tdS, fontSize: 12, fontWeight: 600 }}>{dealName}</td>
                    <td style={tdS}>
                      <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 8px", background: "var(--danger-badge)", color: "#c0392b" }}>{e.category || "Uncategorized"}</span>
                    </td>
                    <td style={{ ...tdS, fontSize: 12, color: "var(--text-secondary)" }}>{e.vendor || "—"}</td>
                    <td style={{ ...tdS, fontSize: 12, color: "var(--text-label)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description || "—"}</td>
                    <td style={{ ...tdS, textAlign: "right", fontSize: 13, fontWeight: 700, color: "#c0392b" }}>-{fmt(e.amount || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
            {sorted.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--surface-alt)" }}>
                  <td style={{ ...tdS, fontWeight: 700 }} colSpan={5}>Totals ({sorted.length} expense{sorted.length === 1 ? "" : "s"})</td>
                  <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: "#c0392b" }}>-{fmt(totalSpent)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {sorted.length > 200 && (
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center" }}>
            Showing first 200 of {sorted.length} expenses. Export CSV for the full list, or narrow your filters.
          </p>
        )}
      </div>
    </div>
  );
}
