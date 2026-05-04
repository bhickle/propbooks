// =============================================================================
// Dashboard — rental-side dashboard. KPI strip, Rent Roll, Rent Collection,
// property snapshots, recent activity. Uses wasRentPaidThisMonth as the
// canonical paid-this-month source so the Rent Collection card stays in
// sync with the Needs Attention rentOverdue alert on PortfolioDashboard.
// =============================================================================
import { useState, useMemo } from "react";
import {
  DollarSign, Wallet, Users, CheckCircle, MessageSquare, ArrowUp,
  ArrowDown, ChevronRight,
} from "lucide-react";
import { fmt, fmtK, RENTAL_NOTES } from "../api.js";
import { PROPERTIES, TRANSACTIONS, TENANTS } from "../mockData.js";
import { calcLoanBalance, getEffectiveMonthly } from "../finance.js";
import { wasRentPaidThisMonth, QuickPayInline } from "../alerts.jsx";
import { StatCard, InfoTip, sectionS as sharedSectionS } from "../shared.jsx";

export function Dashboard({ onNavigate, onNavigateToTx, onSelectProperty, onNavigateToTenantAdd, onNavigateToNote, onNavigateToLease }) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const [renderKey, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);

  // ── Quick Action State ─────────────────────────────────────────────────
  // quickPay holds just the tenant whose inline form is open; the form itself
  // (mode/amount/date) lives inside <QuickPayInline/>.
  const [quickPay, setQuickPay] = useState(null);

  // ── KPIs ────────────────────────────────────────────────────────────────
  const totalValue = PROPERTIES.reduce((s, p) => s + p.currentValue, 0);
  const totalEquity = PROPERTIES.reduce((s, p) => s + (p.currentValue - (calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? p.loanAmount ?? 0)), 0);
  const monthlyIncome = PROPERTIES.reduce((s, p) => { const e = getEffectiveMonthly(p, TRANSACTIONS); return s + e.monthlyIncome; }, 0);
  const monthlyExpenses = PROPERTIES.reduce((s, p) => { const e = getEffectiveMonthly(p, TRANSACTIONS); return s + e.monthlyExpenses; }, 0);
  const netCashFlow = monthlyIncome - monthlyExpenses;

  // ── Occupancy ───────────────────────────────────────────────────────────
  const allTenants = TENANTS.filter(t => t.status !== "past");
  const totalUnits = allTenants.length;
  const occupiedUnits = allTenants.filter(t => t.status !== "vacant").length;
  const occupancyPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  // ── Rent Collection (this month) ────────────────────────────────────────
  // Paid status is derived from TRANSACTIONS (the source of truth), not from
  // tenant.lastPayment, so this card can never drift from the Needs Attention
  // rentOverdue alert on the portfolio dashboard. Uses the shared
  // wasRentPaidThisMonth helper — see generateAlerts.
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const activeTenants = allTenants.filter(t => t.status !== "vacant");
  const expectedRent = activeTenants.reduce((s, t) => s + (t.rent || 0), 0);
  // eslint-disable-next-line no-unused-vars
  const _rkForRent = renderKey; // force recompute after confirmMarkPaid rerender
  const paidThisMonth = activeTenants.filter(t => wasRentPaidThisMonth(t, TRANSACTIONS, thisMonthStr));
  const collectedRent = paidThisMonth.reduce((s, t) => s + (t.rent || 0), 0);
  const collectionPct = expectedRent > 0 ? Math.round((collectedRent / expectedRent) * 100) : 0;
  const unpaidTenants = activeTenants.filter(t => !wasRentPaidThisMonth(t, TRANSACTIONS, thisMonthStr));

  // ── Recent Activity (transactions + notes) ──────────────────────────────
  const recentActivity = useMemo(() => {
    const items = [];
    // Recent transactions
    TRANSACTIONS.slice(0, 8).forEach(t => {
      const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "Unknown";
      items.push({ type: "transaction", date: t.date, icon: t.type === "income" ? ArrowUp : ArrowDown,
        color: t.type === "income" ? "#1a7a4a" : "#c0392b", bg: t.type === "income" ? "var(--success-badge)" : "var(--danger-badge)",
        title: t.description, sub: `${propName.split(" ").slice(0, 2).join(" ")} · ${t.date}`,
        amount: t.amount, txType: t.type, txId: t.id });
    });
    // Recent rental notes
    RENTAL_NOTES.forEach(n => {
      const prop = PROPERTIES.find(p => p.id === n.propertyId);
      items.push({ type: "note", date: n.date, icon: MessageSquare, color: "var(--c-purple)", bg: "var(--purple-tint)",
        title: n.text.length > 60 ? n.text.slice(0, 60) + "..." : n.text,
        sub: `${prop?.name?.split(" ").slice(0, 2).join(" ") || "Property"} · ${n.date}`,
        propId: n.propertyId, noteId: n.id });
    });
    return items.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  }, [renderKey]); // eslint-disable-line react-hooks/exhaustive-deps -- renderKey is the cache-bust counter for mutable module arrays

  // ── Property snapshot cards ─────────────────────────────────────────────
  const propSnapshots = PROPERTIES.map(p => {
    const eff = getEffectiveMonthly(p, TRANSACTIONS);
    const propTenants = allTenants.filter(t => t.propertyId === p.id);
    const propOccupied = propTenants.filter(t => t.status !== "vacant").length;
    const propTotal = propTenants.length || p.units || 1;
    const propOccPct = Math.round((propOccupied / propTotal) * 100);
    const nextExpiry = propTenants.filter(t => t.leaseEnd && t.status !== "vacant")
      .map(t => ({ ...t, daysLeft: Math.round((new Date(t.leaseEnd) - now) / 86400000) }))
      .sort((a, b) => a.daysLeft - b.daysLeft)[0];
    return { ...p, monthlyNet: eff.monthlyIncome - eff.monthlyExpenses, occPct: propOccPct, occupied: propOccupied, total: propTotal, nextExpiry };
  });

  // ── Quick Action Handlers ────────────────────────────────────────────────
  // Rent payment write lives in shared logRentPayment() via <QuickPayInline/>.
  const handleMarkPaid = (tenant) => { setQuickPay(tenant); };

  const sectionS = sharedSectionS;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Here's what needs your attention today.</p>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 28 }}>
        <StatCard icon={DollarSign} label="Monthly Cash Flow" value={fmt(netCashFlow)} sub={`${fmt(monthlyIncome)} in · ${fmt(monthlyExpenses)} out`} color="var(--c-green)" tip="Total Monthly Income − Total Monthly Expenses across all properties." />
        <StatCard icon={Wallet} label="Total Equity" value={fmtK(totalEquity)} sub={`Portfolio value ${fmtK(totalValue)}`} color="var(--c-blue)" tip="Current Value − Mortgage Balance, summed across all properties." />
        <StatCard icon={Users} label="Occupancy" value={`${occupancyPct}%`} sub={`${occupiedUnits} of ${totalUnits} units occupied`} color={occupancyPct >= 90 ? "var(--c-green)" : occupancyPct >= 70 ? "#e95e00" : "var(--c-red)"} semantic tip="Occupied units ÷ total units across all properties." />
        <StatCard icon={CheckCircle} label="Rent Collected" value={`${collectionPct}%`} sub={`${fmt(collectedRent)} of ${fmt(expectedRent)} this month`} color={collectionPct >= 100 ? "var(--c-green)" : collectionPct >= 75 ? "#e95e00" : "var(--c-red)"} semantic tip="Rent received this month ÷ total expected rent from active tenants." />
      </div>

      {/* Rent Roll + Rent Collection Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        {/* Rent Roll */}
        <div style={sectionS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Rent Roll</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>{activeTenants.length} active tenants · {fmt(expectedRent)}/mo</p>
            </div>
            <InfoTip text="Summary of every active tenant: unit, monthly rent, lease status, and lease end date. Click a row to view the tenant's property detail." />
          </div>
          {activeTenants.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Users size={28} color="#94a3b8" style={{ marginBottom: 8 }} />
              <p style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 600 }}>No active tenants</p>
              <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>Add tenants to your properties to see the rent roll.</p>
            </div>
          ) : (
            <div>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, padding: "0 6px 8px", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tenant / Unit</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Rent</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Lease</span>
              </div>
              {/* Rows */}
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {activeTenants.map(t => {
                  const prop = PROPERTIES.find(p => p.id === t.propertyId);
                  const daysLeft = t.leaseEnd ? Math.round((new Date(t.leaseEnd) - now) / 86400000) : null;
                  const statusColor = t.status === "month-to-month" ? "var(--c-blue)"
                    : daysLeft !== null && daysLeft < 0 ? "var(--c-red)"
                    : daysLeft !== null && daysLeft <= 30 ? "#f59e0b"
                    : "var(--c-green)";
                  const statusLabel = t.status === "month-to-month" ? "MTM"
                    : daysLeft !== null && daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d`
                    : daysLeft !== null && daysLeft <= 60 ? `${daysLeft}d left`
                    : t.leaseEnd || "—";
                  return (
                    <div key={t.id}
                      onClick={() => prop && onNavigateToLease && onNavigateToLease(prop, t.id)}
                      style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, padding: "9px 6px", borderBottom: "1px solid #f8fafc", cursor: "pointer", borderRadius: 6, transition: "background 0.12s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prop?.name?.split(" ").slice(0, 3).join(" ") || ""} · {t.unit}</p>
                      </div>
                      <div style={{ textAlign: "right", alignSelf: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(t.rent)}</span>
                      </div>
                      <div style={{ textAlign: "right", alignSelf: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, background: statusColor + "18", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{statusLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Footer total */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, padding: "10px 6px 0", borderTop: "1px solid var(--border-subtle)", marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Total ({activeTenants.length})</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textAlign: "right" }}>{fmt(expectedRent)}</span>
                <span />
              </div>
            </div>
          )}
        </div>

        {/* Rent Collection */}
        <div style={sectionS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Rent Collection</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>{new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}</p>
            </div>
            {onNavigate && <button onClick={() => onNavigate("transactions")} style={{ color: "var(--c-blue)", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>View all <ChevronRight size={14} /></button>}
          </div>
          {/* Collection progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fmt(collectedRent)} collected</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{fmt(expectedRent)} expected</span>
            </div>
            <div style={{ height: 10, background: "var(--surface-muted)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(collectionPct, 100)}%`, background: collectionPct >= 100 ? "var(--c-green)" : collectionPct >= 75 ? "#e95e00" : "var(--c-red)", borderRadius: 5, transition: "width 0.5s ease" }} />
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{paidThisMonth.length} of {activeTenants.length} tenants paid</p>
          </div>
          {/* Unpaid tenants */}
          {unpaidTenants.length > 0 ? (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Outstanding</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {unpaidTenants.slice(0, 4).map(t => {
                  const prop = PROPERTIES.find(p => p.id === t.propertyId);
                  const isExpanded = quickPay?.id === t.id;
                  return (
                    <div key={t.id} style={{ borderRadius: 10, border: isExpanded ? "1.5px solid var(--info-border)" : "1px solid transparent", background: isExpanded ? "var(--surface-alt)" : "transparent", transition: "all 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</p>
                          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{prop?.name?.split(" ").slice(0, 2).join(" ") || ""} · {t.unit}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#c0392b" }}>{fmt(t.rent)}</span>
                          <button onClick={e => { e.stopPropagation(); isExpanded ? setQuickPay(null) : handleMarkPaid(t); }}
                            style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: isExpanded ? "var(--surface-muted)" : "var(--c-green)", color: isExpanded ? "var(--text-label)" : "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                            {isExpanded ? "Cancel" : "Mark Paid"}
                          </button>
                        </div>
                      </div>
                      {/* Quick Pay Inline Form (shared component) */}
                      {isExpanded && (
                        <QuickPayInline
                          tenant={t}
                          defaultDate={todayStr}
                          onConfirm={() => { setQuickPay(null); rerender(); }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <CheckCircle size={24} color="var(--c-green)" style={{ marginBottom: 6 }} />
              <p style={{ color: "var(--c-green)", fontSize: 13, fontWeight: 600 }}>All rent collected</p>
            </div>
          )}
        </div>
      </div>

      {/* Property Snapshot Cards + Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20 }}>
        {/* Property At-a-Glance */}
        <div style={sectionS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Properties</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>{PROPERTIES.length} properties · {occupiedUnits}/{totalUnits} units occupied</p>
            </div>
            {onNavigate && <button onClick={() => onNavigate("properties")} style={{ color: "var(--c-blue)", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>View all <ChevronRight size={14} /></button>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {propSnapshots.map(p => (
              <div key={p.id} onClick={() => onSelectProperty && onSelectProperty(p)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 12px", borderRadius: 12, border: "1px solid var(--border-subtle)", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border-subtle)"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  {p.image}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</p>
                    <span style={{ fontSize: 14, fontWeight: 700, color: p.monthlyNet >= 0 ? "#1a7a4a" : "#c0392b" }}>{p.monthlyNet >= 0 ? "+" : ""}{fmt(p.monthlyNet)}<span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>/mo</span></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Occupancy mini-bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <div style={{ width: 60, height: 5, background: "var(--surface-muted)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${p.occPct}%`, background: p.occPct >= 90 ? "var(--c-green)" : p.occPct >= 70 ? "#e95e00" : "var(--c-red)", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{p.occupied}/{p.total}</span>
                    </div>
                    {/* Next lease expiry */}
                    {p.nextExpiry && p.nextExpiry.daysLeft <= 60 && (
                      <span style={{ fontSize: 11, color: p.nextExpiry.daysLeft < 0 ? "var(--c-red)" : "#e95e00", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {p.nextExpiry.daysLeft < 0 ? "Expired" : `${p.nextExpiry.daysLeft}d`} — {p.nextExpiry.unit}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{p.type} · {p.units} unit{p.units !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <ChevronRight size={14} color="#cbd5e1" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={sectionS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Recent Activity</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recentActivity.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>No recent activity.</p>
            ) : recentActivity.map((a, i) => (
              <div key={i} onClick={() => { if (a.txId && onNavigateToTx) onNavigateToTx(a.txId); else if (a.type === "note" && a.noteId && onNavigateToNote) onNavigateToNote(a.noteId); else if (a.propId && onSelectProperty) { const prop = PROPERTIES.find(p => p.id === a.propId); if (prop) onSelectProperty(prop); } }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 10, cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <a.icon size={13} color={a.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.sub}</p>
                </div>
                {a.amount !== undefined && (
                  <span style={{ fontWeight: 700, fontSize: 13, color: a.txType === "income" ? "#1a7a4a" : "#c0392b", whiteSpace: "nowrap" }}>
                    {a.txType === "income" ? "+" : ""}{fmt(Math.abs(a.amount))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
