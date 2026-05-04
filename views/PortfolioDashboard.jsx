// =============================================================================
// PortfolioDashboard — top-level overview combining rentals + deals.
// KPI strip, quick actions, cash flow trend, rentals/deals snapshots,
// Needs Attention alerts, and Recent Activity.
// =============================================================================
import { useState } from "react";
import {
  Wallet, TrendingUp, Target, DollarSign, ArrowUpDown, Hammer, Building2,
  MessageSquare, ArrowRight, AlertCircle, CheckCircle, Clock, X,
  MoreHorizontal, ArrowUp, ArrowDown, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  fmt, DEALS, CONTRACTORS, DEAL_EXPENSES, DEAL_MILESTONES, STAGE_COLORS,
} from "../api.js";
import { PROPERTIES, TRANSACTIONS, TENANTS } from "../mockData.js";
import { calcLoanBalance, getEffectiveMonthly } from "../finance.js";
import { generateAlerts, snoozeAlert, dismissAlert, QuickPayInline } from "../alerts.jsx";
import { StatCard, InfoTip, sectionS as sharedSectionS } from "../shared.jsx";

export function PortfolioDashboard({ onNavigate, onSelectProperty, onSelectFlip, onNavigateToTx, onNavigateToDealExpense, onNavigateToLease, onSelectContractor }) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  // Force a re-render when snooze/dismiss state changes
  const [, rerenderAlerts] = useState(0);
  const [alertMenuOpen, setAlertMenuOpen] = useState(null); // alert id whose menu is open
  const [expandedAlert, setExpandedAlert] = useState(null); // alert id whose inline action form is open
  const bumpAlerts = () => rerenderAlerts(n => n + 1);

  // ── KPIs ────────────────────────────────────────────────────────────────
  const rentalEquity = PROPERTIES.reduce((s, p) => s + (p.currentValue - (calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? p.loanAmount ?? 0)), 0);
  const dealEquity = DEALS.filter(f => f.stage !== "Sold").reduce((s, f) => s + f.purchasePrice, 0);
  const totalEquity = rentalEquity + dealEquity;

  const monthlyIncome = PROPERTIES.reduce((s, p) => { const e = getEffectiveMonthly(p, TRANSACTIONS); return s + e.monthlyIncome; }, 0);
  const monthlyExpenses = PROPERTIES.reduce((s, p) => { const e = getEffectiveMonthly(p, TRANSACTIONS); return s + e.monthlyExpenses; }, 0);
  const netCashFlow = monthlyIncome - monthlyExpenses;

  const activeDeals = DEALS.filter(f => f.stage !== "Sold").length;
  const capitalDeployed = DEALS.filter(f => f.stage !== "Sold").reduce((s, f) => s + f.purchasePrice + f.rehabSpent, 0);

  // ── Rental snapshot cards ────────────────────────────────────────────────
  const allTenants = TENANTS.filter(t => t.status !== "past");

  const rentalSnapshots = PROPERTIES.map(p => {
    const eff = getEffectiveMonthly(p, TRANSACTIONS);
    const propTenants = allTenants.filter(t => t.propertyId === p.id);
    const propOccupied = propTenants.filter(t => t.status !== "vacant").length;
    const propTotal = propTenants.length || p.units || 1;
    const propOccPct = Math.round((propOccupied / propTotal) * 100);
    return { ...p, monthlyNet: eff.monthlyIncome - eff.monthlyExpenses, occPct: propOccPct, occupied: propOccupied, total: propTotal };
  }).sort((a, b) => (b.monthlyNet || 0) - (a.monthlyNet || 0)).slice(0, 6);

  const totalOccupied = rentalSnapshots.reduce((s, p) => s + p.occupied, 0);
  const totalRentalUnits = rentalSnapshots.reduce((s, p) => s + p.total, 0);
  const rentalSummary = `${totalOccupied} of ${totalRentalUnits} units occupied · ${fmt(netCashFlow)}/mo net`;

  // ── Deal snapshot cards ──────────────────────────────────────────────────
  const dealSnapshots = DEALS.filter(f => f.stage !== "Sold").sort((a, b) => {
    const stageOrder = { "Pending": 0, "Active Rehab": 1, "Listed": 2 };
    return (stageOrder[a.stage] ?? 99) - (stageOrder[b.stage] ?? 99);
  });
  const flipSummary = `${dealSnapshots.length} active · ${fmt(dealSnapshots.reduce((s, f) => s + f.rehabBudget, 0))} total budget`;

  // ── Deal Stage Summary with overdue milestones ───────────────────────────
  const dealStageData = dealSnapshots.map(f => {
    const ms = DEAL_MILESTONES.filter(m => m.dealId === f.id);
    const totalMs = ms.length;
    const doneMs = ms.filter(m => m.done).length;
    const overdueMs = ms.filter(m => !m.done && m.targetDate && m.targetDate < todayStr).length;
    const nextMs = ms.filter(m => !m.done).sort((a, b) => (a.targetDate || "9999") < (b.targetDate || "9999") ? -1 : 1)[0];
    return { ...f, totalMs, doneMs, overdueMs, nextMs, pct: totalMs > 0 ? Math.round((doneMs / totalMs) * 100) : 0 };
  });

  // ── Cash Flow Trend (last 6 months) ──────────────────────────────────────
  const cashFlowTrend = (() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short" });
      const monthTx = TRANSACTIONS.filter(t => t.date && t.date.startsWith(key));
      const inc = monthTx.filter(t => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
      const exp = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
      data.push({ month: label, income: inc, expenses: exp, net: inc - exp });
    }
    return data;
  })();

  // ── Needs Attention alerts ──────────────────────────────────────────────
  const attentionAlerts = generateAlerts({
    properties: PROPERTIES,
    tenants: TENANTS,
    transactions: TRANSACTIONS,
    deals: DEALS,
    contractors: CONTRACTORS,
  });
  const highCount = attentionAlerts.filter(a => a.severity === "high").length;

  // ── Recent Activity ──────────────────────────────────────────────────────
  const recentItems = [];
  [...TRANSACTIONS].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).forEach(t => {
    const prop = PROPERTIES.find(p => p.id === t.propertyId);
    recentItems.push({ source: "rental", type: "transaction", date: t.date,
      icon: t.type === "income" ? ArrowUp : ArrowDown,
      color: t.type === "income" ? "#1a7a4a" : "#c0392b",
      bg: t.type === "income" ? "var(--success-badge)" : "var(--danger-badge)",
      title: t.description, sourceName: prop?.name || "Unknown",
      amount: t.amount, txType: t.type, txId: t.id, propertyId: t.propertyId });
  });
  [...DEAL_EXPENSES].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).forEach(e => {
    const deal = DEALS.find(f => f.id === e.dealId);
    recentItems.push({ source: "deal", type: "deal-expense", date: e.date,
      icon: ArrowDown, color: "#c0392b", bg: "var(--danger-badge)",
      title: e.description || `${e.vendor || "Expense"}`, sourceName: deal?.name || "Unknown",
      amount: e.amount, expId: e.id, dealId: e.dealId });
  });
  const recentActivity = recentItems.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  const sectionS = sharedSectionS;
  const qaBtnS = { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", transition: "all 0.15s", flex: 1 };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px 0" }}>Portfolio Overview</h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0 }}>Your complete real estate snapshot — rentals and deals combined.</p>
      </div>

      {/* Row 1: KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 28 }}>
        <StatCard icon={Wallet} label="Total Equity" value={fmt(totalEquity)} color="var(--c-blue)" tip="Sum of rental equity (property value − mortgage balance) plus deal purchase prices invested." />
        <StatCard icon={TrendingUp} label="Monthly Cash Flow" value={fmt(netCashFlow)} color="var(--c-green)" tip="Net rental income across all properties (income minus expenses)." />
        <StatCard icon={Target} label="Active Deals" value={String(activeDeals)} color="#e95e00" tip="Number of deals currently in progress (not sold)." />
        <StatCard icon={DollarSign} label="Capital Deployed" value={fmt(capitalDeployed)} color="var(--c-purple)" tip="Total money invested in active deals (purchase price + rehab spent)." />
      </div>

      {/* Row 2: Quick Actions */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Add Rental Transaction", icon: ArrowUpDown, action: () => onNavigate("transactions") },
          { label: "Add Deal Expense", icon: Hammer, action: () => onNavigate("dealexpenses") },
          { label: "Add Property", icon: Building2, action: () => onNavigate("rentalWizard") },
          { label: "Add Deal", icon: Target, action: () => onNavigate("flipWizard") },
          { label: "Add Note", icon: MessageSquare, action: () => onNavigate("notes-add") },
        ].map((qa, i) => (
          <button key={i} onClick={qa.action} style={qaBtnS}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#e95e00"; e.currentTarget.style.background = "rgba(233,94,0,0.04)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <qa.icon size={18} color="#e95e00" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-label)" }}>{qa.label}</span>
          </button>
        ))}
      </div>

      {/* Row 3: Cash Flow Trend (full width — Lease Alerts moved to Needs Attention) */}
      <div style={{ marginBottom: 28 }}>
        <div style={sectionS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={18} color="var(--c-green)" />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Cash Flow Trend</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Last 6 months</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cashFlowTrend} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} width={45} />
              <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} formatter={(v) => [fmt(v)]} />
              <Bar dataKey="income" fill="var(--c-green)" radius={[6, 6, 0, 0]} name="Income" />
              <Bar dataKey="expenses" fill="var(--c-red)" radius={[6, 6, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--c-green)" }} /> Income
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--c-red)" }} /> Expenses
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Rentals & Flips Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        {/* Rentals */}
        <div style={sectionS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 size={18} color="var(--c-blue)" />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Rentals</h3>
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>({rentalSnapshots.length})</span>
            </div>
            <button onClick={() => onNavigate("dashboard")} style={{ background: "none", border: "none", color: "var(--c-blue)", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rentalSnapshots.map(p => (
              <div key={p.id} onClick={() => onSelectProperty(p)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-muted)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                  {p.image?.slice(0, 1) || "P"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0 0" }}>{fmt(p.monthlyNet)}/mo</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <div style={{ width: 40, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${p.occPct}%`, background: p.occPct === 100 ? "var(--c-green)" : p.occPct >= 75 ? "#e95e00" : "var(--c-red)", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, minWidth: 40 }}>{p.occPct}%</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>{rentalSummary}</div>
        </div>

        {/* Flips — Stage Summary with milestone progress */}
        <div style={sectionS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Hammer size={18} color="#e95e00" />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Active Deals</h3>
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>({dealSnapshots.length})</span>
            </div>
            <button onClick={() => onNavigate("dealdashboard")} style={{ background: "none", border: "none", color: "#e95e00", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {dealStageData.map(f => (
              <div key={f.id} onClick={() => onSelectFlip(f)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-muted)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                  {f.image?.slice(0, 1) || "F"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, color: STAGE_COLORS[f.stage], background: STAGE_COLORS[f.stage] + "1a", borderRadius: 4, padding: "2px 6px" }}>{f.stage}</span>
                    {f.overdueMs > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--c-red)", background: "var(--danger-badge)", borderRadius: 4, padding: "2px 6px" }}>
                        {f.overdueMs} overdue
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${f.pct}%`, background: f.overdueMs > 0 ? "#e95e00" : "var(--c-green)", borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, whiteSpace: "nowrap" }}>{f.doneMs}/{f.totalMs}</span>
                  </div>
                  {f.nextMs && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                      Next: {f.nextMs.label}{f.nextMs.targetDate ? ` · due ${f.nextMs.targetDate}` : ""}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>{flipSummary}</div>
        </div>
      </div>

      {/* Row 5: Needs Attention + Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28, alignItems: "stretch" }}>
        {/* Needs Attention */}
        <div style={{ ...sectionS, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={18} color={highCount > 0 ? "var(--c-red)" : "#f59e0b"} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Needs Attention</h3>
              {attentionAlerts.length > 0 && (
                <span style={{ background: highCount > 0 ? "var(--danger-badge)" : "var(--yellow-tint)", color: highCount > 0 ? "#c0392b" : "#92400e", borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{attentionAlerts.length}</span>
              )}
            </div>
            <InfoTip text="Actionable items across your portfolio — overdue rent, expiring leases, vacant units, stale data, deals missing info, and contractor insurance. Snooze or dismiss items you've handled; they auto-return if the condition recurs." />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0, overflowY: "auto" }}>
            {attentionAlerts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--success-badge)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                  <CheckCircle size={24} color="var(--c-green)" />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>All caught up</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>No action items right now</p>
              </div>
            ) : attentionAlerts.map(a => {
              const sevColor = a.severity === "high" ? "var(--c-red)" : a.severity === "medium" ? "#f59e0b" : "#64748b";
              const Icon = a.icon;
              const isRentOverdue = a.type === "rentOverdue";
              const isExpanded = expandedAlert === a.id;
              const alertTenant = isRentOverdue ? TENANTS.find(tt => tt.id === a.target.id) : null;
              const handleGo = () => {
                // Rent overdue is handled inline via QuickPayInline — never navigate
                if (isRentOverdue) {
                  setExpandedAlert(isExpanded ? null : a.id);
                  return;
                }
                if (a.target.type === "property" && onSelectProperty) {
                  const p = PROPERTIES.find(pp => pp.id === a.target.id);
                  if (p) onSelectProperty(p, null);
                }
                else if (a.target.type === "deal" && onSelectFlip) {
                  const d = DEALS.find(dd => dd.id === a.target.id);
                  // Route deal data-gap alerts (noRehabBudget) to the rehab tab
                  const tab = a.type === "noRehabBudget" ? "rehab" : null;
                  if (d) onSelectFlip(d, tab);
                }
                else if (a.target.type === "tenant" && onNavigateToLease) {
                  const t = TENANTS.find(tt => tt.id === a.target.id);
                  const p = t && PROPERTIES.find(pp => pp.id === t.propertyId);
                  if (p) onNavigateToLease(p, a.target.id);
                }
                else if (a.target.type === "contractor") {
                  const c = CONTRACTORS.find(cc => cc.id === a.target.id);
                  if (c && onSelectContractor) onSelectContractor(c);
                  else if (onNavigate) onNavigate("dealcontractors");
                }
              };
              return (
                <div key={a.id} style={{ borderRadius: 10, background: "var(--surface-alt)", border: isExpanded ? "1.5px solid var(--info-border)" : "1px solid var(--border-subtle)", position: "relative", transition: "border 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={15} color={a.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: sevColor, flexShrink: 0 }} />
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</p>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "0 0 6px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</p>
                      <button onClick={handleGo} style={{ background: "none", border: "none", color: "#e95e00", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                        {isRentOverdue && isExpanded ? "Cancel" : a.action} {!(isRentOverdue && isExpanded) && <ArrowRight size={12} />}
                      </button>
                    </div>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        onClick={() => setAlertMenuOpen(alertMenuOpen === a.id ? null : a.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}
                        title="Options"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {alertMenuOpen === a.id && (
                        <>
                          <div onClick={() => setAlertMenuOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 900 }} />
                          <div style={{ position: "absolute", right: 0, top: 28, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 10px 25px rgba(0,0,0,0.1)", minWidth: 160, zIndex: 901, padding: 4 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 10px 4px" }}>Snooze</div>
                            {[{ label: "3 days", d: 3 }, { label: "7 days", d: 7 }, { label: "30 days", d: 30 }].map(opt => (
                              <button key={opt.d} onClick={() => { snoozeAlert(a.id, opt.d); setAlertMenuOpen(null); bumpAlerts(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-label)", borderRadius: 6 }} onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                                <Clock size={13} color="#94a3b8" /> Remind in {opt.label}
                              </button>
                            ))}
                            <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "4px 0" }} />
                            <button onClick={() => { dismissAlert(a.id); setAlertMenuOpen(null); bumpAlerts(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#c0392b", borderRadius: 6 }} onMouseEnter={e => e.currentTarget.style.background = "var(--danger-tint)"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                              <X size={13} /> Dismiss
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {isRentOverdue && isExpanded && alertTenant && (
                    <QuickPayInline
                      tenant={alertTenant}
                      defaultDate={todayStr}
                      onConfirm={() => { setExpandedAlert(null); bumpAlerts(); }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={sectionS}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px 0" }}>Recent Activity</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentActivity.length > 0 ? (
              recentActivity.map((item, idx) => (
                <div key={`${item.type}-${idx}`}
                  onClick={() => {
                    if (item.source === "rental" && item.txId && onNavigateToTx) onNavigateToTx(item.txId);
                    else if (item.source === "deal" && item.expId && onNavigateToDealExpense) onNavigateToDealExpense(item.expId);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <item.icon size={14} color={item.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                      <span style={{ display: "inline-block", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontWeight: 600, letterSpacing: "0.03em", marginRight: 5, background: item.source === "rental" ? "var(--info-tint)" : "var(--warning-btn-bg)", color: item.source === "rental" ? "var(--c-blue)" : "#d97706" }}>
                        {item.source === "rental" ? "RENTAL" : "DEAL"}
                      </span>
                      {item.sourceName} · {item.date}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: item.color }}>
                      {item.type === "transaction" && item.txType === "income" ? "+" : "−"}{fmt(item.amount)}
                    </span>
                    <ChevronRight size={14} color="#cbd5e1" />
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0", margin: 0 }}>No activity yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
