import { useState, useMemo } from 'react';
import { AlertCircle, ArrowUp, ArrowDown } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { fmt, fmtK } from '../api.js';
import {
  calcLoanBalance, getEffectiveMonthly, calcCapRate, calcCashOnCash,
} from '../finance.js';
import { daysAgo } from '../health.js';
import { InfoTip, sectionS as sharedSectionS, cardS as sharedCardS, iS } from '../shared.jsx';
import { PROPERTIES, TRANSACTIONS, TENANTS } from '../mockData.js';

export function Analytics() {
  const [selectedPropId, setSelectedPropId] = useState("");
  const selectedProp = selectedPropId ? PROPERTIES.find(p => p.id === Number(selectedPropId)) : null;

  // Deterministic monthly expense variation (avoids Math.random re-renders)
  const EXP_FACTORS = [1.0, 0.88, 1.15, 0.92, 1.05, 1.18, 0.97, 1.22, 0.89, 1.08, 1.30, 0.95];
  const ALL_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  // Build trailing 12 months ending at current month
  const currentMonth = new Date().getMonth(); // 0-indexed (Mar = 2)
  const TRAILING_MONTHS = Array.from({ length: 12 }, (_, i) => {
    const idx = (currentMonth - 11 + i + 12) % 12;
    return { label: ALL_MONTHS[idx], idx };
  });

  // ── Portfolio-level computations ──
  const totalUnits = PROPERTIES.reduce((s, p) => s + p.units, 0);
  const vacantUnits = TENANTS.filter(t => t.status === "vacant").length; // past tenants auto-excluded — "vacant" is only for active units
  const occupancyRate = totalUnits > 0 ? ((totalUnits - vacantUnits) / totalUnits * 100).toFixed(1) : "100.0";
  const portfolioIncome = PROPERTIES.reduce((s, p) => s + getEffectiveMonthly(p, TRANSACTIONS).monthlyIncome, 0);
  const portfolioExpenses = PROPERTIES.reduce((s, p) => s + getEffectiveMonthly(p, TRANSACTIONS).monthlyExpenses, 0);
  const portfolioNOI = (portfolioIncome - portfolioExpenses) * 12;
  const portfolioExpenseRatio = portfolioIncome > 0 ? ((portfolioExpenses / portfolioIncome) * 100).toFixed(1) : "0";
  const avgCapRate = (PROPERTIES.reduce((s, p) => s + calcCapRate(p, TRANSACTIONS), 0) / PROPERTIES.length).toFixed(1);
  const avgCoC = (PROPERTIES.reduce((s, p) => s + calcCashOnCash(p, TRANSACTIONS), 0) / PROPERTIES.length).toFixed(1);
  const totalAppreciation = PROPERTIES.reduce((s, p) => s + (p.currentValue - p.purchasePrice), 0);

  // DSCR = NOI / Annual Debt Service
  const annualDebtService = PROPERTIES.reduce((s, p) => {
    if (!p.loanAmount || !p.loanRate || !p.loanTermYears) return s;
    const r = p.loanRate / 100 / 12;
    const n = p.loanTermYears * 12;
    const M = p.loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    return s + M * 12;
  }, 0);
  const portfolioDSCR = annualDebtService > 0 ? (portfolioNOI / annualDebtService).toFixed(2) : "N/A";

  // ── Portfolio trailing 12-month trend (deterministic) ──
  const portfolioMonthlyData = useMemo(() => TRAILING_MONTHS.map(({ label, idx }, i) => {
    const income = Math.round(portfolioIncome * (0.92 + i * 0.015 + (i % 3) * 0.01));
    const expenses = Math.round(portfolioExpenses * EXP_FACTORS[idx]);
    return { month: label, income, expenses, net: income - expenses };
  }), []); // eslint-disable-line react-hooks/exhaustive-deps -- deterministic mock trend computed once per mount

  // YoY simulated: last year values slightly lower
  const yoyNOI = 8.2;
  const yoyCapRate = 0.3;
  const yoyCoC = 0.5;
  const yoyAppreciation = 14.7;

  const selectedPropEff = selectedProp ? getEffectiveMonthly(selectedProp, TRANSACTIONS) : null;
  const propMonthlyData = selectedProp && selectedPropEff ? TRAILING_MONTHS.map(({ label, idx }, i) => {
    const income = selectedPropEff.monthlyIncome;
    const expenses = Math.round(selectedPropEff.monthlyExpenses * EXP_FACTORS[idx]);
    return { month: label, income, expenses, net: income - expenses };
  }) : [];

  const propTenants = selectedProp ? TENANTS.filter(t => t.propertyId === selectedProp.id && t.status !== "past") : [];

  // Per-property DSCR
  const propDSCR = selectedProp ? (() => {
    if (!selectedProp.loanAmount || !selectedProp.loanRate || !selectedProp.loanTermYears) return "N/A";
    const r = selectedProp.loanRate / 100 / 12;
    const n = selectedProp.loanTermYears * 12;
    const M = selectedProp.loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    const annualDS = M * 12;
    const se = getEffectiveMonthly(selectedProp, TRANSACTIONS);
    const noi = (se.monthlyIncome - se.monthlyExpenses) * 12;
    return annualDS > 0 ? (noi / annualDS).toFixed(2) : "N/A";
  })() : "N/A";

  // Per-property occupancy
  const propOccupancy = selectedProp ? (() => {
    const tenants = TENANTS.filter(t => t.propertyId === selectedProp.id && t.status !== "past");
    if (tenants.length === 0) return selectedProp.status === "Occupied" ? "100" : "0";
    const occupied = tenants.filter(t => t.status !== "vacant").length;
    return tenants.length > 0 ? ((occupied / tenants.length) * 100).toFixed(0) : "100";
  })() : "100";

  const sortedByCoc = [...PROPERTIES].sort((a, b) => calcCashOnCash(b) - calcCashOnCash(a));
  const sortedByCapRate = [...PROPERTIES].sort((a, b) => calcCapRate(b) - calcCapRate(a));
  const cocRank = selectedProp ? sortedByCoc.findIndex(p => p.id === selectedProp.id) + 1 : 0;
  const capRateRank = selectedProp ? sortedByCapRate.findIndex(p => p.id === selectedProp.id) + 1 : 0;
  const rankLabel = r => r === 1 ? "#1" : r === 2 ? "#2" : r === 3 ? "#3" : `#${r}`;

  // YoY badge helper
  const YoY = ({ val, suffix = "%" }) => {
    const up = val > 0;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 6 }}>
        {up ? <ArrowUp size={12} color="var(--c-green)" /> : <ArrowDown size={12} color="var(--c-red)" />}
        <span style={{ fontSize: 11, fontWeight: 700, color: up ? "var(--c-green)" : "var(--c-red)" }}>{up ? "+" : ""}{val}{suffix}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>vs last year</span>
      </div>
    );
  };

  const cardS = sharedCardS;
  const sectionS = { ...sharedSectionS, marginBottom: 24 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Analytics &amp; Returns</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            {selectedProp ? `Performance details — ${selectedProp.name}` : "Detailed performance metrics for every property"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={selectedPropId} onChange={e => setSelectedPropId(e.target.value)} style={{ ...iS, width: 220, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="">All Properties</option>
            {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {!selectedProp ? (
        /* ——— PORTFOLIO VIEW ——— */
        <>
          {/* KPI row with YoY indicators */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
            {[
              { label: "Total Annual NOI", value: fmt(portfolioNOI), color: "var(--c-green)", yoy: yoyNOI, tip: "Net Operating Income = (Monthly Rent \u2212 Monthly Expenses) \u00d7 12, summed across all properties. Excludes debt service." },
              { label: "Portfolio Cap Rate", value: `${avgCapRate}%`, color: "var(--c-blue)", yoy: yoyCapRate, tip: "Average Cap Rate across all properties. Cap Rate = Annual NOI \u00f7 Current Property Value." },
              { label: "Avg Cash-on-Cash", value: `${avgCoC}%`, color: "var(--c-purple)", yoy: yoyCoC, tip: "Average Cash-on-Cash return. CoC = (Annual NOI \u2212 Annual Debt Service) \u00f7 (Down Payment + Closing Costs). Down payment derived from Purchase Price \u2212 Loan Amount." },
            ].map((m, i) => (
              <div key={i} style={cardS}>
                <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                <p style={{ color: "var(--text-primary)", fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
                <YoY val={m.yoy} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Total Appreciation", value: fmt(totalAppreciation), yoy: yoyAppreciation, tip: "Sum of (Current Value \u2212 Purchase Price) across all properties. Values are manually updated by the owner." },
              { label: "Expense Ratio", value: `${portfolioExpenseRatio}%`, desc: "Expenses / gross income", tip: "Total Monthly Expenses \u00f7 Total Monthly Rent \u00d7 100. Lower is better \u2014 under 40% is considered healthy." },
              { label: "Occupancy Rate", value: `${occupancyRate}%`, desc: `${totalUnits - vacantUnits} / ${totalUnits} units occupied`, tip: "Occupied Units \u00f7 Total Units \u00d7 100. Based on current tenant records." },
              { label: "DSCR", value: portfolioDSCR, desc: parseFloat(portfolioDSCR) >= 1.25 ? "Healthy coverage" : parseFloat(portfolioDSCR) >= 1.0 ? "Adequate" : "Below target", tip: "Debt Service Coverage Ratio = Annual NOI \u00f7 Annual Mortgage Payments. Above 1.25 is healthy; below 1.0 means income doesn\u2019t cover debt." },
            ].map((m, i) => (
              <div key={i} style={cardS}>
                <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                <p style={{ color: "var(--text-primary)", fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
                {m.yoy !== undefined ? <YoY val={m.yoy} /> : <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 6 }}>{m.desc}</p>}
              </div>
            ))}
          </div>

          {/* Portfolio Income vs Expenses Trend */}
          <div style={sectionS}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Portfolio Cash Flow Trend</h3>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Income vs. expenses — trailing 12 months across all properties</p>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                {[
                  { label: "Avg Monthly Net", value: fmt(Math.round(portfolioMonthlyData.reduce((s, m) => s + m.net, 0) / 12)), color: "var(--c-green)" },
                  { label: "Avg Expense Ratio", value: `${portfolioExpenseRatio}%`, color: "#e95e00" },
                ].map((m, i) => (
                  <div key={i} style={{ textAlign: "right" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{m.label}</p>
                    <p style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={portfolioMonthlyData}>
                <defs>
                  <linearGradient id="pIncGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--c-green)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--c-green)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pExpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--c-red)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--c-red)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v, name) => [fmt(v), name === "income" ? "Income" : name === "expenses" ? "Expenses" : "Net"]} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
                <Area type="monotone" dataKey="income" stroke="var(--c-green)" strokeWidth={2.5} fill="url(#pIncGrad)" name="income" />
                <Area type="monotone" dataKey="expenses" stroke="var(--c-red)" strokeWidth={2.5} fill="url(#pExpGrad)" name="expenses" />
                <Area type="monotone" dataKey="net" stroke="var(--c-blue)" strokeWidth={2} strokeDasharray="5 5" fill="none" name="net" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Property-by-Property — improved 3-column layout */}
          <div style={sectionS}>
            <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Property-by-Property Performance</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {PROPERTIES.map(p => {
                const pEff = getEffectiveMonthly(p, TRANSACTIONS);
                const annualRent = pEff.monthlyIncome * 12;
                const annualExpenses = pEff.monthlyExpenses * 12;
                const NOI = annualRent - annualExpenses;
                const coC = calcCashOnCash(p, TRANSACTIONS);
                const appreciation = ((p.currentValue - p.purchasePrice) / p.purchasePrice * 100).toFixed(1);
                const expRatio = pEff.monthlyIncome > 0 ? ((pEff.monthlyExpenses / pEff.monthlyIncome) * 100).toFixed(0) : "0";
                const propTen = TENANTS.filter(t => t.propertyId === p.id && t.status !== "past");
                const occUnits = propTen.filter(t => t.status !== "vacant").length;
                const propOcc = propTen.length > 0 ? ((occUnits / propTen.length) * 100).toFixed(0) : (p.status === "Occupied" ? "100" : "0");
                // DSCR per property
                let pDSCR = "N/A";
                if (p.loanAmount && p.loanRate && p.loanTermYears) {
                  const r = p.loanRate / 100 / 12;
                  const n = p.loanTermYears * 12;
                  const M = p.loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
                  pDSCR = (NOI / (M * 12)).toFixed(2);
                }
                // Stale value check
                const daysSinceUpdate = p.valueUpdatedAt ? Math.round((new Date() - new Date(p.valueUpdatedAt)) / (1000 * 60 * 60 * 24)) : 999;
                const isStale = daysSinceUpdate > 90;
                return (
                  <div key={p.id} onClick={() => setSelectedPropId(String(p.id))} style={{ background: "var(--surface-alt)", borderRadius: 14, padding: 20, border: "2px solid var(--border)", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#e95e00"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>{p.image}</div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>{p.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.type} · {p.units} unit{p.units > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Annual NOI", value: fmtK(NOI), color: NOI >= 0 ? "var(--c-green)" : "var(--c-red)" },
                        { label: "Cap Rate", value: `${calcCapRate(p)}%`, color: "var(--text-primary)" },
                        { label: "Cash-on-Cash", value: `${coC}%`, color: parseFloat(coC) >= 0 ? "var(--c-green)" : "var(--c-red)" },
                        { label: "Appreciation", value: `${parseFloat(appreciation) >= 0 ? "+" : ""}${appreciation}%`, color: parseFloat(appreciation) >= 0 ? "var(--c-green)" : "var(--c-red)" },
                        { label: "Expense Ratio", value: `${expRatio}%`, color: "var(--text-primary)" },
                        { label: "DSCR", value: pDSCR, color: pDSCR !== "N/A" ? (parseFloat(pDSCR) >= 1.0 ? "var(--c-green)" : "var(--c-red)") : "var(--text-muted)" },
                      ].map((m, i) => (
                        <div key={i}>
                          <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 1 }}>{m.label}</p>
                          <p style={{ color: m.color, fontSize: 15, fontWeight: 700 }}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Occupancy</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, marginLeft: 12 }}>
                        <div style={{ flex: 1, height: 6, background: "var(--surface-muted)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${propOcc}%`, background: parseFloat(propOcc) >= 90 ? "var(--c-green)" : parseFloat(propOcc) >= 70 ? "#e95e00" : "var(--c-red)", borderRadius: 3, transition: "width 0.3s" }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", minWidth: 36, textAlign: "right" }}>{propOcc}%</span>
                      </div>
                    </div>
                    {isStale && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertCircle size={12} color="#e95e00" />
                        <span style={{ fontSize: 11, color: "#c2410c" }}>Stale value — last updated {daysSinceUpdate}d ago. Update property value to improve accuracy.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cap Rate + CoC charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={sectionS}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cap Rate Comparison</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Annual net operating income / property value</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={PROPERTIES.map(p => ({ name: p.image, fullName: p.name, rate: calcCapRate(p) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} domain={[0, 12]} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, "Cap Rate"]} labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]} fill="var(--chart-bar-primary)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={sectionS}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cash-on-Cash Return</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Annual pre-tax cash flow / total cash invested</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={PROPERTIES.map(p => ({ name: p.image, fullName: p.name, coc: calcCashOnCash(p) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} domain={[0, 14]} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, "CoC Return"]} labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
                  <Bar dataKey="coc" radius={[6, 6, 0, 0]} fill="#e95e00" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        /* ——— PROPERTY VIEW ——— */
        <>
          {/* 1. Return Scorecard — now with DSCR and Occupancy */}
          <div style={{ ...sectionS, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18 }}>{selectedProp.image}</div>
              <div>
                <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Return Scorecard</h3>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>How this property stacks up against your portfolio</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
              {[
                {
                  label: "Cap Rate", value: `${calcCapRate(selectedProp, TRANSACTIONS)}%`,
                  sub: `Ranked ${rankLabel(capRateRank)} of ${PROPERTIES.length}`, color: "var(--c-blue)",
                  tip: "Cap Rate = Annual NOI \u00f7 Current Property Value. Measures return independent of financing.",
                },
                {
                  label: "Cash-on-Cash", value: `${calcCashOnCash(selectedProp, TRANSACTIONS)}%`,
                  sub: `Ranked ${rankLabel(cocRank)} of ${PROPERTIES.length}`, color: "var(--c-purple)",
                  tip: "(Annual NOI \u2212 Annual Debt Service) \u00f7 (Down Payment + Closing Costs). Down payment = Purchase Price \u2212 Loan Amount.",
                },
                (() => {
                  const daysSince = selectedProp.valueUpdatedAt ? Math.round((new Date() - new Date(selectedProp.valueUpdatedAt)) / (1000*60*60*24)) : 999;
                  const stale = daysSince > 90;
                  return {
                    label: "Appreciation",
                    value: `+${((selectedProp.currentValue - selectedProp.purchasePrice) / selectedProp.purchasePrice * 100).toFixed(1)}%`,
                    sub: stale ? `${fmt(selectedProp.currentValue - selectedProp.purchasePrice)} gain · Value may be outdated` : `${fmt(selectedProp.currentValue - selectedProp.purchasePrice)} total gain`,
                    color: stale ? "#c2410c" : "#e95e00",
                    tip: `(Current Value − Purchase Price) ÷ Purchase Price. Based on a manually entered property value${selectedProp.valueUpdatedAt ? ` last updated ${daysAgo(selectedProp.valueUpdatedAt)}` : ""}. Edit the property to update.`,
                  };
                })(),
              ].map((m, i) => (
                <div key={i} style={{ background: "var(--surface-alt)", borderRadius: 14, padding: "18px 16px", border: "1px solid var(--border-subtle)" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                  <p style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 800, marginBottom: 4, fontFamily: "var(--font-display)" }}>{m.value}</p>
                  <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{m.sub}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                {
                  label: "Current Equity",
                  value: fmt(selectedProp.currentValue - (calcLoanBalance(selectedProp.loanAmount, selectedProp.loanRate, selectedProp.loanTermYears, selectedProp.loanStartDate) ?? selectedProp.loanAmount ?? 0)),
                  sub: "Value minus loan balance", color: "var(--c-green)",
                  tip: "Current Property Value \u2212 Remaining Loan Balance. Loan balance is amortized from the original loan terms.",
                },
                {
                  label: "DSCR",
                  value: propDSCR,
                  sub: parseFloat(propDSCR) >= 1.25 ? "Healthy coverage" : parseFloat(propDSCR) >= 1.0 ? "Adequate" : "Below target",
                  color: parseFloat(propDSCR) >= 1.0 ? "var(--c-green)" : "var(--c-red)",
                  tip: "Debt Service Coverage Ratio = Annual NOI \u00f7 Annual Mortgage Payments. Lenders typically want 1.25+.",
                },
                {
                  label: "Occupancy",
                  value: `${propOccupancy}%`,
                  sub: `${propTenants.filter(t => t.status !== "vacant").length} of ${propTenants.length || selectedProp.units} units`,
                  color: parseFloat(propOccupancy) >= 90 ? "var(--c-green)" : parseFloat(propOccupancy) >= 70 ? "#e95e00" : "var(--c-red)",
                  tip: "Occupied Units \u00f7 Total Units \u00d7 100. Based on current tenant lease status records.",
                },
              ].map((m, i) => (
                <div key={i} style={{ background: "var(--surface-alt)", borderRadius: 14, padding: "18px 16px", border: "1px solid var(--border-subtle)" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                  <p style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 800, marginBottom: 4, fontFamily: "var(--font-display)" }}>{m.value}</p>
                  <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{m.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Cash Flow Deep Dive */}
          <div style={{ ...sectionS, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Cash Flow Deep Dive</h3>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Income vs. expenses — trailing 12 months</p>
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                {[
                  { label: "Avg Monthly Net", value: fmt(Math.round(propMonthlyData.reduce((s, m) => s + m.net, 0) / 12)), color: "var(--c-green)" },
                  { label: "Annual NOI", value: fmt((selectedPropEff.monthlyIncome - selectedPropEff.monthlyExpenses) * 12), color: "var(--c-blue)" },
                  { label: "Expense Ratio", value: `${((selectedPropEff.monthlyExpenses / selectedPropEff.monthlyIncome) * 100).toFixed(0)}%`, color: "#e95e00" },
                ].map((m, i) => (
                  <div key={i} style={{ textAlign: "right" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{m.label}</p>
                    <p style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "center" }}>
              <div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={propMonthlyData}>
                    <defs>
                      <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--c-green)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="var(--c-green)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--c-red)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="var(--c-red)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v, name) => [fmt(v), name === "income" ? "Income" : "Expenses"]} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
                    <Area type="monotone" dataKey="income" stroke="var(--c-green)" strokeWidth={2.5} fill="url(#incGrad)" name="income" />
                    <Area type="monotone" dataKey="expenses" stroke="var(--c-red)" strokeWidth={2.5} fill="url(#expGrad)" name="expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Annual Breakdown</p>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Income", value: selectedPropEff.monthlyIncome * 12 },
                        { name: "Expenses", value: selectedPropEff.monthlyExpenses * 12 },
                      ]}
                      cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value"
                    >
                      <Cell fill="var(--c-green)" />
                      <Cell fill="var(--c-red)" />
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {[
                    { label: "Annual Income", value: fmt(selectedPropEff.monthlyIncome * 12), color: "var(--c-green)" },
                    { label: "Annual Expenses", value: fmt(selectedPropEff.monthlyExpenses * 12), color: "var(--c-red)" },
                    { label: "Net (NOI)", value: fmt((selectedPropEff.monthlyIncome - selectedPropEff.monthlyExpenses) * 12), color: "var(--c-blue)" },
                  ].map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.label}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Tenant Health Panel */}
          <div style={{ ...sectionS, marginBottom: 0 }}>
            <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Tenant Health Panel</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Unit-by-unit lease and payment status</p>
            {propTenants.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "40px 0" }}>No tenants on record for this property.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {propTenants.map(t => {
                  const scMap = { "active-lease": { bg: "var(--success-badge)", text: "#1a7a4a" }, "month-to-month": { bg: "var(--warning-bg)", text: "#7c2d12" }, vacant: { bg: "var(--danger-badge)", text: "#c0392b" } };
                  const sc = scMap[t.status] || scMap["active-lease"];
                  const expiring = t.daysUntilExpiry !== null && t.daysUntilExpiry <= 60;
                  return (
                    <div key={t.id} style={{ background: "var(--surface-alt)", borderRadius: 14, padding: 18, border: `1px solid ${expiring ? "var(--warning-border)" : "var(--border-subtle)"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{t.unit || "Unit"}</p>
                          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{t.status === "vacant" ? "No tenant" : t.name}</p>
                        </div>
                        <span style={{ background: sc.bg, color: sc.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{{ "active-lease": "Active Lease", "month-to-month": "Month-to-Month", vacant: "Vacant" }[t.status] || t.status}</span>
                      </div>
                      {t.status !== "vacant" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {[
                            { label: "Monthly Rent", value: fmt(t.rent), color: "var(--text-primary)" },
                            { label: "Lease Ends", value: t.leaseEnd || "—", color: "var(--text-primary)" },
                            { label: "Days Remaining", value: t.daysUntilExpiry !== null ? `${t.daysUntilExpiry}d ${expiring ? "⚠️" : "✓"}` : "—", color: expiring ? "#c2410c" : "#1a7a4a" },
                            { label: "Last Payment", value: t.lastPayment || "—", color: "var(--text-primary)" },
                          ].map((row, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{row.label}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: row.color }}>{row.value}</span>
                            </div>
                          ))}
                          {t.securityDeposit ? (
                            <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Security Deposit</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{fmt(t.securityDeposit)}</span>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
