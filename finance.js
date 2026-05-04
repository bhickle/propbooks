// =============================================================================
// finance.js — pure tax/loan/income math
//
// All functions here operate on arguments — no module-level mutable state.
// Safe to import from anywhere without import-order concerns.
// =============================================================================

// ─── Annual Tax Config ──────────────────────────────────────────────────────
// Update this block once per year (typically January) when IRS publishes new rates.
// Every tax-sensitive value in the app pulls from here — no hunting through code.
// Planned: move to an admin-configurable settings table once Supabase persistence lands.
export const TAX_CONFIG = {
  currentYear: 2026,                          // Default tax year for reports
  yearRange: [2023, 2024, 2025, 2026],        // Available years in dropdowns
  mileageRate: 0.725,                          // IRS standard mileage rate ($/mile) — Notice 2026-10
  mileageRateYear: 2026,                       // Year the mileage rate applies to
  brackets: [10, 12, 22, 24, 32, 35, 37],     // Federal marginal tax brackets (%)
  defaultBracket: 24,                          // Default bracket for estimates
  depreciationResidential: 27.5,               // Years — IRS MACRS residential
  depreciationCommercial: 39,                  // Years — IRS MACRS commercial
  landValuePct: 0.20,                          // Non-depreciable land % of purchase price
  buildingValuePct: 0.80,                      // Depreciable building % (1 - landValuePct)
  recaptureRate: 0.25,                         // Depreciation recapture rate on sale
  qbiDeductionPct: 0.20,                       // Sec. 199A QBI deduction (informational)
};

// Helper: compute depreciable basis for a property
// Uses per-property landValue when available, falls back to TAX_CONFIG.landValuePct estimate
export function getDeprBasis(p) {
  const pp = p.purchasePrice || 0;
  if (p.landValue != null && p.landValue > 0) {
    return { basis: Math.max(0, Math.round(pp - p.landValue)), estimated: false, landValue: p.landValue };
  }
  const estLand = Math.round(pp * TAX_CONFIG.landValuePct);
  return { basis: Math.round(pp * TAX_CONFIG.buildingValuePct), estimated: true, landValue: estLand };
}

// ─── Loan amortization ──────────────────────────────────────────────────────
// calcLoanBalance: amortization formula — returns current remaining balance
export function calcLoanBalance(loanAmount, annualRate, termYears, startDate) {
  const P = parseFloat(loanAmount), r0 = parseFloat(annualRate), n = parseFloat(termYears) * 12;
  if (!P || !r0 || !n || !startDate) return null;
  const r = r0 / 100 / 12;
  const start = new Date(startDate);
  const now = new Date();
  const k = Math.max(0, Math.round((now - start) / (1000 * 60 * 60 * 24 * 30.4375)));
  if (k >= n) return 0;
  const M = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const balance = P * Math.pow(1 + r, k) - M * (Math.pow(1 + r, k) - 1) / r;
  return Math.max(0, Math.round(balance));
}

// calcPaymentInterest: returns the interest portion of a specific mortgage payment
// by computing the remaining balance one period before that payment date
export function calcPaymentInterest(loanAmount, annualRate, termYears, startDate, paymentDate) {
  const P = parseFloat(loanAmount), r0 = parseFloat(annualRate), n = parseFloat(termYears) * 12;
  if (!P || !r0 || !n || !startDate || !paymentDate) return null;
  const r = r0 / 100 / 12;
  const start = new Date(startDate);
  const payment = new Date(paymentDate);
  // k = number of payments already made before this one
  const k = Math.max(0, Math.round((payment - start) / (1000 * 60 * 60 * 24 * 30.4375)));
  if (k >= n) return 0;
  const M = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  // Balance just before this payment (after k prior payments)
  const balBefore = k === 0 ? P : P * Math.pow(1 + r, k) - M * (Math.pow(1 + r, k) - 1) / r;
  return Math.max(0, Math.round(balBefore * r));
}

// ─── Income/expense derivation from transactions ────────────────────────────
// Returns { monthlyIncome, monthlyExpenses, months, source } for a property
// "source" = "transactions" if 2+ months of data, else "estimate" (falls back to property fields)
export function calcMonthlyFromTx(propertyId, transactions, fallbackRent, fallbackExp) {
  const propTx = transactions.filter(t => t.propertyId === propertyId);
  if (propTx.length === 0) return { monthlyIncome: fallbackRent || 0, monthlyExpenses: fallbackExp || 0, months: 0, source: "estimate" };

  const dates = propTx.map(t => t.date).sort();
  const first = new Date(dates[0]);
  const last = new Date(dates[dates.length - 1]);
  const months = Math.max(1, Math.round((last - first) / (1000 * 60 * 60 * 24 * 30.4375)) + 1);

  const totalIncome = propTx.filter(t => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalExpenses = propTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

  // Need at least 2 months of data to trust the average
  if (months < 2) return { monthlyIncome: fallbackRent || 0, monthlyExpenses: fallbackExp || 0, months, source: "estimate" };

  return {
    monthlyIncome: Math.round(totalIncome / months),
    monthlyExpenses: Math.round(totalExpenses / months),
    months,
    source: "transactions",
  };
}

// Convenience: get effective monthly numbers for a property (prefers transactions, falls back to estimates)
export function getEffectiveMonthly(p, transactions) {
  return calcMonthlyFromTx(p.id, transactions, p.monthlyRent, p.monthlyExpenses);
}

// ─── Return metrics ─────────────────────────────────────────────────────────
// Cap Rate = Annual NOI / Current Property Value × 100
// Pass transactions to use real data; omit to use property estimates
export function calcCapRate(p, transactions) {
  if (!p.currentValue) return 0;
  const eff = transactions ? getEffectiveMonthly(p, transactions) : { monthlyIncome: p.monthlyRent, monthlyExpenses: p.monthlyExpenses };
  const annualNOI = (eff.monthlyIncome - eff.monthlyExpenses) * 12;
  return parseFloat((annualNOI / p.currentValue * 100).toFixed(1));
}

// Cash-on-Cash = (Annual NOI − Annual Debt Service) / Total Cash Invested × 100
// Total Cash Invested = Down Payment + Closing Costs
export function calcCashOnCash(p, transactions) {
  const downPayment = p.purchasePrice - (p.loanAmount || 0);
  const totalCashInvested = downPayment + (p.closingCosts || 0);
  if (totalCashInvested <= 0) return 0;
  const eff = transactions ? getEffectiveMonthly(p, transactions) : { monthlyIncome: p.monthlyRent, monthlyExpenses: p.monthlyExpenses };
  const annualNOI = (eff.monthlyIncome - eff.monthlyExpenses) * 12;
  let annualDebtService = 0;
  if (p.loanAmount && p.loanRate && p.loanTermYears) {
    const r = p.loanRate / 100 / 12;
    const n = p.loanTermYears * 12;
    const M = p.loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    annualDebtService = M * 12;
  }
  return parseFloat(((annualNOI - annualDebtService) / totalCashInvested * 100).toFixed(1));
}
