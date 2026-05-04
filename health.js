// =============================================================================
// health.js — property data-quality checks and stale-value warnings
//
// Pure functions over their arguments. getPropertyHealth uses
// getEffectiveMonthly from finance.js to detect properties with no
// transaction history.
// =============================================================================
import { getEffectiveMonthly } from "./finance.js";

export function daysAgo(dateStr) {
  if (!dateStr) return null;
  const d = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  const m = Math.round(d / 30);
  return m === 1 ? "1 month ago" : `${m} months ago`;
}

// Property data health check — returns array of actionable items
export function getPropertyHealth(p, transactions) {
  const items = [];
  // 1. Stale property value
  const valDays = p.valueUpdatedAt ? Math.round((Date.now() - new Date(p.valueUpdatedAt)) / 86400000) : 999;
  if (valDays > 90) items.push({ key: "value", severity: valDays > 180 ? "high" : "medium", label: "Property value", detail: `Last updated ${daysAgo(p.valueUpdatedAt) || "never"}`, action: "Update current market value", field: "currentValue" });
  // 2. Missing closing costs
  if (!p.closingCosts) items.push({ key: "closingCosts", severity: "low", label: "Closing costs", detail: "Not entered — Cash-on-Cash return may be inaccurate", action: "Add closing costs", field: "closingCosts" });
  // 3. No loan details (if likely financed)
  if (!p.loanAmount && p.purchasePrice > 100000) items.push({ key: "loan", severity: "low", label: "Loan details", detail: "No loan info — equity and DSCR cannot be calculated", action: "Add loan terms", field: "loanAmount" });
  // 4. Missing loan start date (has loan but no start)
  if (p.loanAmount && !p.loanStartDate) items.push({ key: "loanStart", severity: "medium", label: "Loan start date", detail: "Needed to estimate current mortgage balance", action: "Add loan start date", field: "loanStartDate" });
  // 5. Missing purchase date
  if (!p.purchaseDate) items.push({ key: "purchaseDate", severity: "low", label: "Purchase date", detail: "Needed for depreciation schedule and hold period", action: "Add purchase date", field: "purchaseDate" });
  // 5b. Missing land value (depreciation accuracy)
  if (!p.landValue && p.purchasePrice > 0) items.push({ key: "landValue", severity: "low", label: "Land value", detail: "Using 20% estimate — depreciation may be inaccurate", action: "Add land value from tax assessment", field: "landValue" });
  // 6. Income/expenses still estimated (no transactions)
  const eff = getEffectiveMonthly(p, transactions);
  if (eff.source === "estimate") items.push({ key: "transactions", severity: "low", label: "Income & expenses", detail: "Using manual estimates — no transaction history yet", action: "Log transactions for actual averages", field: null });
  // 7. No estimated rent/expenses AND no transactions
  if (!p.monthlyRent && eff.source === "estimate") items.push({ key: "rent", severity: "medium", label: "Monthly rent", detail: "No rent entered and no income transactions logged", action: "Add estimated rent or log income", field: "monthlyRent" });
  return items;
}

export function healthBadge(items) {
  if (items.length === 0) return { color: "var(--c-green)", bg: "var(--success-badge)", label: "Up to date" };
  const hasHigh = items.some(i => i.severity === "high");
  const hasMedium = items.some(i => i.severity === "medium");
  if (hasHigh) return { color: "#c0392b", bg: "var(--danger-badge)", label: `${items.length} update${items.length > 1 ? "s" : ""} needed` };
  if (hasMedium) return { color: "#c2410c", bg: "var(--warning-btn-bg)", label: `${items.length} update${items.length > 1 ? "s" : ""} suggested` };
  return { color: "#6366f1", bg: "#e0e7ff", label: `${items.length} optional update${items.length > 1 ? "s" : ""}` };
}
