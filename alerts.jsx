// =============================================================================
// alerts.jsx — Needs Attention alert generation + dismiss/snooze + rent payment
//
// `_ALERT_STATE` is a module-level singleton: alert IDs are period-scoped
// (e.g. "rentOverdue:3:2026-04") so dismissing March's alert never suppresses
// April's. Snoozes auto-clear when their window expires.
//
// `wasRentPaidThisMonth` is the canonical "did this tenant pay this month?"
// check used by both the alert generator and the Rental Dashboard's Rent
// Collection card — single source of truth so the two views can never drift.
//
// `logRentPayment` is the one place TRANSACTIONS is mutated for a rent payment;
// `QuickPayInline` is the inline form rendered under an alert or unpaid-tenant
// row that calls into it.
// =============================================================================
import { useState } from "react";
import {
  DollarSign, Calendar, AlertCircle, Home, TrendingUp, Hammer, Shield,
} from "lucide-react";
import { fmt, newId, MOCK_USER } from "./api.js";
import { TRANSACTIONS } from "./mockData.js";

// ─── Dismiss / snooze state ──────────────────────────────────────────────────
// Shape per entry: { id, state: "dismissed" | "snoozed", snoozeUntil: "YYYY-MM-DD" | null, updatedAt }
const _ALERT_STATE = {};

export const alertStateFor = (id) => _ALERT_STATE[id] || null;
export const dismissAlert  = (id) => { _ALERT_STATE[id] = { id, state: "dismissed", snoozeUntil: null, updatedAt: new Date().toISOString() }; };
export const snoozeAlert   = (id, days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  _ALERT_STATE[id] = { id, state: "snoozed", snoozeUntil: d.toISOString().slice(0, 10), updatedAt: new Date().toISOString() };
};
export const clearAlertState = (id) => { delete _ALERT_STATE[id]; };

// Is the alert currently suppressed by snooze/dismiss?
export function isAlertSuppressed(id) {
  const st = _ALERT_STATE[id];
  if (!st) return false;
  if (st.state === "dismissed") return true;
  if (st.state === "snoozed" && st.snoozeUntil) {
    const today = new Date().toISOString().slice(0, 10);
    if (today < st.snoozeUntil) return true;
    // Snooze expired — auto-clear so the alert reappears
    delete _ALERT_STATE[id];
    return false;
  }
  return false;
}

// Severity sort order (high first)
export const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

// ─── Canonical rent-paid check ───────────────────────────────────────────────
// Reads TRANSACTIONS, not tenant.lastPayment, so the Needs Attention alert
// generator and the Rental Dashboard's Rent Collection card can never drift.
//
// Match logic:
//   1. Any income tx on the tenant's property this month where payee === tenant.name → paid
//   2. Fallback: if every rent-income tx on the property this month has no payee set,
//      assume the property-level rent covers its tenants (handles seed data and
//      single-tenant properties).
export function wasRentPaidThisMonth(tenant, transactions, monthStr) {
  const propTxns = transactions.filter(tx =>
    tx.propertyId === tenant.propertyId &&
    tx.type === "income" &&
    tx.date && tx.date.startsWith(monthStr)
  );
  if (propTxns.length === 0) return false;
  if (propTxns.some(tx => tx.payee === tenant.name)) return true;
  if (propTxns.every(tx => !tx.payee)) return true;
  return false;
}

// ─── Alert generation ────────────────────────────────────────────────────────
// Pure — no side effects — so the list auto-refreshes when underlying data
// changes. Alerts are filtered through `isAlertSuppressed` so dismissed/snoozed
// items don't appear until the condition recurs (new period key) or the snooze
// expires.
export function generateAlerts({ properties, tenants, transactions, deals, contractors }) {
  const alerts = [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const curMonth = todayStr.slice(0, 7); // "YYYY-MM"
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

  // 1. Rent overdue — tenant has active lease, rent > 0, and no income txn
  //    logged for this property in the current month (keyed to the month so
  //    dismissing March doesn't hide April).
  tenants.forEach(t => {
    if (t.status !== "active-lease" && t.status !== "month-to-month") return;
    if (!t.rent) return;
    const prop = properties.find(p => p.id === t.propertyId);
    if (!prop) return;
    if (wasRentPaidThisMonth(t, transactions, curMonth)) return;
    // Expect rent by the 5th; don't alert before then
    if (now.getDate() < 5) return;
    const daysLate = now.getDate() - 1;
    const id = `rentOverdue:${t.id}:${curMonth}`;
    if (isAlertSuppressed(id)) return;
    alerts.push({
      id, type: "rentOverdue", severity: daysLate > 10 ? "high" : "medium",
      icon: DollarSign, color: "var(--c-red)", bg: "var(--danger-badge)",
      title: `Rent not received — ${t.name}`,
      detail: `${prop.name} · ${t.unit} · ${fmt(t.rent)} due · ${daysLate} day${daysLate === 1 ? "" : "s"} late`,
      action: "Log payment", target: { type: "tenant", id: t.id },
    });
  });

  // 2. Lease expiring in the next 60 days
  tenants.forEach(t => {
    if (!t.leaseEnd || t.status === "vacant" || t.status === "past") return;
    const days = daysBetween(todayStr, t.leaseEnd);
    if (days < 0 || days > 60) return;
    const prop = properties.find(p => p.id === t.propertyId);
    if (!prop) return;
    const id = `leaseExpiring:${t.id}:${t.leaseEnd}`;
    if (isAlertSuppressed(id)) return;
    alerts.push({
      id, type: "leaseExpiring", severity: days <= 14 ? "high" : days <= 30 ? "medium" : "low",
      icon: Calendar, color: "#f59e0b", bg: "var(--yellow-tint)",
      title: `Lease expires in ${days} day${days === 1 ? "" : "s"} — ${t.name}`,
      detail: `${prop.name} · ${t.unit} · Ends ${t.leaseEnd}`,
      action: "Renew or serve notice", target: { type: "tenant", id: t.id },
    });
  });

  // 2b. Lease already expired (past leaseEnd, tenant still present)
  tenants.forEach(t => {
    if (!t.leaseEnd || t.status === "vacant" || t.status === "past") return;
    const days = daysBetween(todayStr, t.leaseEnd);
    if (days >= 0) return;
    const prop = properties.find(p => p.id === t.propertyId);
    if (!prop) return;
    const id = `leaseExpired:${t.id}:${t.leaseEnd}`;
    if (isAlertSuppressed(id)) return;
    alerts.push({
      id, type: "leaseExpired", severity: "high",
      icon: AlertCircle, color: "var(--c-red)", bg: "var(--danger-badge)",
      title: `Lease expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago — ${t.name}`,
      detail: `${prop.name} · ${t.unit} · Ended ${t.leaseEnd}`,
      action: "Renew or serve notice", target: { type: "tenant", id: t.id },
    });
  });

  // 2c. Month-to-month tenants (no fixed end date, rolling lease)
  tenants.forEach(t => {
    if (t.status !== "month-to-month") return;
    const prop = properties.find(p => p.id === t.propertyId);
    if (!prop) return;
    // Suppress if a leaseExpired/leaseExpiring alert already exists for this tenant
    const alreadyListed = alerts.some(a =>
      (a.type === "leaseExpired" || a.type === "leaseExpiring") && a.target?.id === t.id
    );
    if (alreadyListed) return;
    const id = `leaseMTM:${t.id}`;
    if (isAlertSuppressed(id)) return;
    alerts.push({
      id, type: "leaseMonthToMonth", severity: "low",
      icon: Calendar, color: "var(--c-blue)", bg: "var(--info-tint)",
      title: `Month-to-month — ${t.name}`,
      detail: `${prop.name} · ${t.unit} · Consider converting to fixed lease`,
      action: "Renew on fixed term", target: { type: "tenant", id: t.id },
    });
  });

  // 3. Vacant units losing money
  tenants.forEach(t => {
    if (t.status !== "vacant") return;
    const prop = properties.find(p => p.id === t.propertyId);
    if (!prop) return;
    const dailyRent = (t.rent || 0) / 30;
    if (dailyRent === 0) return;
    // Vacant alerts are not period-scoped — one per unit
    const id = `vacantUnit:${t.id}`;
    if (isAlertSuppressed(id)) return;
    alerts.push({
      id, type: "vacantUnit", severity: "medium",
      icon: Home, color: "var(--text-secondary)", bg: "var(--hover-surface)",
      title: `Vacant — ${prop.name} · ${t.unit}`,
      detail: `Losing ~${fmt(Math.round(dailyRent))}/day in potential rent`,
      action: "Find a tenant", target: { type: "tenant", id: t.id },
    });
  });

  // 4. Stale property value (90+ days since update)
  properties.forEach(p => {
    const valDays = p.valueUpdatedAt ? daysBetween(p.valueUpdatedAt, todayStr) : 999;
    if (valDays < 90) return;
    // Period-scoped to the last update date so re-alerts fire after the next refresh
    const id = `staleValue:${p.id}:${p.valueUpdatedAt || "never"}`;
    if (isAlertSuppressed(id)) return;
    alerts.push({
      id, type: "staleValue", severity: valDays > 180 ? "medium" : "low",
      icon: TrendingUp, color: "var(--c-purple)", bg: "var(--purple-tint)",
      title: `Property value stale — ${p.name}`,
      detail: valDays > 900 ? "Never updated" : `Last updated ${valDays} days ago`,
      action: "Update market value", target: { type: "property", id: p.id },
    });
  });

  // 5. Missing loan start date (mortgage balance can't be calculated)
  properties.forEach(p => {
    if (!p.loanAmount || p.loanStartDate) return;
    const id = `missingLoanStart:${p.id}`;
    if (isAlertSuppressed(id)) return;
    alerts.push({
      id, type: "missingLoanStart", severity: "medium",
      icon: AlertCircle, color: "#e95e00", bg: "var(--warning-btn-bg)",
      title: `Loan start date missing — ${p.name}`,
      detail: "Current mortgage balance cannot be estimated without it",
      action: "Add loan start date", target: { type: "property", id: p.id },
    });
  });

  // 6. Active deal with no rehab budget entered
  deals.forEach(d => {
    if (d.stage === "Sold") return;
    const hasBudget = (d.rehabItems || []).some(i => i.budgeted > 0);
    if (hasBudget) return;
    const id = `noRehabBudget:${d.id}`;
    if (isAlertSuppressed(id)) return;
    alerts.push({
      id, type: "noRehabBudget", severity: "medium",
      icon: Hammer, color: "#e95e00", bg: "var(--warning-btn-bg)",
      title: `No rehab budget — ${d.name}`,
      detail: "Active deal has no line-item budget entered",
      action: "Add rehab scope", target: { type: "deal", id: d.id },
    });
  });

  // 7. Contractor insurance expired or expiring in 30 days
  contractors.forEach(c => {
    if (!c.insuranceExpiry) return;
    const days = daysBetween(todayStr, c.insuranceExpiry);
    if (days > 30) return;
    const id = `insuranceExpiring:${c.id}:${c.insuranceExpiry}`;
    if (isAlertSuppressed(id)) return;
    const expired = days < 0;
    alerts.push({
      id, type: "insuranceExpiring", severity: expired ? "high" : days <= 7 ? "high" : "medium",
      icon: Shield, color: "var(--c-red)", bg: "var(--danger-badge)",
      title: expired ? `Insurance EXPIRED — ${c.name}` : `Insurance expires in ${days} day${days === 1 ? "" : "s"} — ${c.name}`,
      detail: `${c.trade} · Expires ${c.insuranceExpiry}`,
      action: "Request updated COI", target: { type: "contractor", id: c.id },
    });
  });

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

// ─── Rent payment write ──────────────────────────────────────────────────────
// The only place TRANSACTIONS is mutated for a rent payment so Rental
// Dashboard's Rent Collection card and the Needs Attention card on Portfolio
// Dashboard produce identical records.
export function logRentPayment(tenant, { amount, date, mode }) {
  if (!tenant || !(amount > 0)) return null;
  const desc = mode === "full"
    ? `${new Date(date).toLocaleString("en-US", { month: "long" })} rent — ${tenant.unit}`
    : `Partial rent payment — ${tenant.unit}`;
  const tx = {
    id: newId(), date, propertyId: tenant.propertyId, category: "Rent Income",
    description: desc, amount: Math.abs(amount), type: "income", payee: tenant.name,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id,
  };
  TRANSACTIONS.unshift(tx);
  return tx;
}

// ─── QuickPayInline ──────────────────────────────────────────────────────────
// Inline Mark-Paid form — rendered under an alert row or unpaid-tenant row.
// Self-contained state. Parent only supplies the tenant, a todayStr default,
// and an onConfirm callback invoked after logRentPayment writes.
export function QuickPayInline({ tenant, defaultDate, onConfirm }) {
  const [mode, setMode] = useState("full");
  const [amt, setAmt] = useState(String(tenant?.rent || ""));
  const [date, setDate] = useState(defaultDate);
  const qInput = { padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none", width: "100%" };
  const confirm = () => {
    const amount = mode === "full" ? (tenant?.rent || 0) : (parseFloat(amt) || 0);
    if (amount <= 0) return;
    logRentPayment(tenant, { amount, date, mode });
    onConfirm && onConfirm();
  };
  return (
    <div style={{ padding: "8px 10px 12px", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={() => { setMode("full"); setAmt(String(tenant?.rent || "")); }}
          style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: mode === "full" ? "1.5px solid #1a7a4a" : "1.5px solid var(--border)", background: mode === "full" ? "var(--success-badge)" : "var(--surface)", color: mode === "full" ? "#1a7a4a" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          Full — {fmt(tenant?.rent || 0)}
        </button>
        <button onClick={() => { setMode("partial"); setAmt(""); }}
          style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: mode === "partial" ? "1.5px solid #e95e00" : "1.5px solid var(--border)", background: mode === "partial" ? "var(--warning-btn-bg)" : "var(--surface)", color: mode === "partial" ? "#9a3412" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          Partial
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {mode === "partial" && (
          <input type="number" placeholder="Amount" value={amt} onChange={e => setAmt(e.target.value)}
            style={{ ...qInput, width: 100 }} />
        )}
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ ...qInput, width: mode === "partial" ? 130 : "auto", flex: mode === "full" ? 1 : undefined }} />
        <button onClick={confirm}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--c-green)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          Confirm
        </button>
      </div>
    </div>
  );
}
