import { useState, useMemo, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Building2, LayoutDashboard, ArrowUpDown, BarChart3, FileText,
  TrendingUp, TrendingDown, DollarSign, Home, Plus, Search, Bell,
  ChevronRight, Settings as SettingsIcon, LogOut, Filter, Download, Eye, MoreHorizontal,
  Calendar, Tag, CheckCircle, AlertCircle, X, ChevronDown, User,
  Percent, ArrowUp, ArrowDown, Star, MapPin, Wallet, PieChartIcon,
  Hammer, Clock, Target, Flag, Wrench,
  Users, Route, Calculator, FileCheck, UserCheck, Truck, Layers, Car,
  CheckSquare, Square, PlusCircle, Receipt, UploadCloud, Trash2, Pencil, Info, List,
  CreditCard, MessageSquare, Copy, Camera, Image, AlertTriangle
} from "lucide-react";
import {
  newId, fmt, fmtK,
  PROP_COLORS, FLIP_COLORS, STAGE_ORDER, STAGE_COLORS, DEFAULT_MILESTONES,
  getProperties, addProperty, getTransactions, addTransaction,
  getMonthlyCashFlow, getEquityGrowth, getExpenseCategories,
  getFlips, addFlip, updateFlip,
  getFlipExpenses, addFlipExpense, getContractors, addContractor,
  getFlipMilestones, updateFlipMilestones,
  getTenants, getMileageTrips, addMileageTrip,
} from "./api.js";
import { AuthProvider, AuthScreen, useAuth } from "./auth.jsx";
import { Settings, OnboardingWizard } from "./settings.jsx";
import { FlipDashboard, RehabTracker, FlipExpenses, FlipContractors, FlipAnalytics } from "./flips.jsx";

// ─── Annual Tax Config ──────────────────────────────────────────────
// Update this block once per year (typically January) when IRS publishes new rates.
// Every tax-sensitive value in the app pulls from here — no hunting through code.
const TAX_CONFIG = {
  currentYear: 2026,                          // Default tax year for reports
  yearRange: [2023, 2024, 2025, 2026],        // Available years in dropdowns
  mileageRate: 0.70,                           // IRS standard mileage rate ($/mile)
  mileageRateYear: 2025,                       // Year the mileage rate applies to
  brackets: [10, 12, 22, 24, 32, 35, 37],     // Federal marginal tax brackets (%)
  defaultBracket: 24,                          // Default bracket for estimates
  depreciationResidential: 27.5,               // Years — IRS MACRS residential
  depreciationCommercial: 39,                  // Years — IRS MACRS commercial
  landValuePct: 0.20,                          // Non-depreciable land % of purchase price
  buildingValuePct: 0.80,                      // Depreciable building % (1 - landValuePct)
  recaptureRate: 0.25,                         // Depreciation recapture rate on sale
  qbiDeductionPct: 0.20,                       // Sec. 199A QBI deduction (informational)
};
// ────────────────────────────────────────────────────────────────────

const iS = { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" };

function Modal({ title, onClose, children, width = 500 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 32, width, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ color: "#0f172a", fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------
// MOCK DATA
// (Also exported via api.js for future backend swap)
// ---------------------------------------------
// calcLoanBalance: amortization formula — returns current remaining balance
function calcLoanBalance(loanAmount, annualRate, termYears, startDate) {
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
function calcPaymentInterest(loanAmount, annualRate, termYears, startDate, paymentDate) {
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

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const d = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  const m = Math.round(d / 30);
  return m === 1 ? "1 month ago" : `${m} months ago`;
}

// Property data health check — returns array of actionable items
function getPropertyHealth(p, transactions) {
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
  // 6. Income/expenses still estimated (no transactions)
  const eff = getEffectiveMonthly(p, transactions);
  if (eff.source === "estimate") items.push({ key: "transactions", severity: "low", label: "Income & expenses", detail: "Using manual estimates — no transaction history yet", action: "Log transactions for actual averages", field: null });
  // 7. No estimated rent/expenses AND no transactions
  if (!p.monthlyRent && eff.source === "estimate") items.push({ key: "rent", severity: "medium", label: "Monthly rent", detail: "No rent entered and no income transactions logged", action: "Add estimated rent or log income", field: "monthlyRent" });
  return items;
}

function healthBadge(items) {
  if (items.length === 0) return { color: "#10b981", bg: "#dcfce7", label: "Up to date" };
  const hasHigh = items.some(i => i.severity === "high");
  const hasMedium = items.some(i => i.severity === "medium");
  if (hasHigh) return { color: "#b91c1c", bg: "#fee2e2", label: `${items.length} update${items.length > 1 ? "s" : ""} needed` };
  if (hasMedium) return { color: "#b45309", bg: "#fef3c7", label: `${items.length} update${items.length > 1 ? "s" : ""} suggested` };
  return { color: "#6366f1", bg: "#e0e7ff", label: `${items.length} optional update${items.length > 1 ? "s" : ""}` };
}

const PROPERTIES = [
  { id: 1, name: "Maple Ridge Duplex", address: "2847 Maple Ridge Dr, Austin, TX 78701", type: "Multi-Family", units: 2, purchasePrice: 385000, currentValue: 462000, valueUpdatedAt: "2025-10-01", loanAmount: 308000, loanRate: 3.25, loanTermYears: 30, loanStartDate: "2021-03-15", closingCosts: 8470, monthlyRent: 3800, monthlyExpenses: 1640, purchaseDate: "2021-03-15", status: "Occupied", image: "MR", color: "#3b82f6", photo: null },
  { id: 2, name: "Lakeview SFR", address: "518 Lakeview Terrace, Denver, CO 80203", type: "Single Family", units: 1, purchasePrice: 520000, currentValue: 598000, valueUpdatedAt: "2025-11-15", loanAmount: 416000, loanRate: 2.875, loanTermYears: 30, loanStartDate: "2020-07-22", closingCosts: 11440, monthlyRent: 2950, monthlyExpenses: 1120, purchaseDate: "2020-07-22", status: "Occupied", image: "LV", color: "#10b981", photo: null },
  { id: 3, name: "Midtown Condo #4B", address: "1200 Peachtree St NE #4B, Atlanta, GA 30309", type: "Condo", units: 1, purchasePrice: 280000, currentValue: 315000, valueUpdatedAt: "2026-01-20", loanAmount: 224000, loanRate: 3.75, loanTermYears: 30, loanStartDate: "2022-01-10", closingCosts: 6160, monthlyRent: 2100, monthlyExpenses: 860, purchaseDate: "2022-01-10", status: "Occupied", image: "MC", color: "#8b5cf6", photo: null },
  { id: 4, name: "Riverside Triplex", address: "744 Riverside Blvd, Portland, OR 97201", type: "Multi-Family", units: 3, purchasePrice: 670000, currentValue: 745000, valueUpdatedAt: "2025-08-30", loanAmount: 536000, loanRate: 4.0, loanTermYears: 30, loanStartDate: "2019-11-05", closingCosts: 14740, monthlyRent: 5700, monthlyExpenses: 2380, purchaseDate: "2019-11-05", status: "Partial Vacancy", image: "RT", color: "#f59e0b", photo: null },
  { id: 5, name: "Sunset Strip Commercial", address: "9220 Sunset Blvd, West Hollywood, CA 90069", type: "Commercial", units: 1, purchasePrice: 1200000, currentValue: 1380000, valueUpdatedAt: "2025-12-05", loanAmount: 900000, loanRate: 4.5, loanTermYears: 25, loanStartDate: "2018-06-30", closingCosts: 26400, monthlyRent: 8500, monthlyExpenses: 3200, purchaseDate: "2018-06-30", status: "Occupied", image: "SS", color: "#ef4444", photo: null },
];

// ── Derived financials from transactions ──
// Returns { monthlyIncome, monthlyExpenses, months, source } for a property
// "source" = "transactions" if 2+ months of data, else "estimate" (falls back to property fields)
function calcMonthlyFromTx(propertyName, transactions, fallbackRent, fallbackExp) {
  const propTx = transactions.filter(t => t.property === propertyName);
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
function getEffectiveMonthly(p, transactions) {
  return calcMonthlyFromTx(p.name, transactions, p.monthlyRent, p.monthlyExpenses);
}

// ── Derived metric helpers ──
// Cap Rate = Annual NOI / Current Property Value × 100
// Pass transactions to use real data; omit to use property estimates
function calcCapRate(p, transactions) {
  if (!p.currentValue) return 0;
  const eff = transactions ? getEffectiveMonthly(p, transactions) : { monthlyIncome: p.monthlyRent, monthlyExpenses: p.monthlyExpenses };
  const annualNOI = (eff.monthlyIncome - eff.monthlyExpenses) * 12;
  return parseFloat((annualNOI / p.currentValue * 100).toFixed(1));
}

// Cash-on-Cash = (Annual NOI − Annual Debt Service) / Total Cash Invested × 100
// Total Cash Invested = Down Payment + Closing Costs
function calcCashOnCash(p, transactions) {
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

const TRANSACTIONS = [
  { id: 1,  date: "2026-03-20", property: "Maple Ridge Duplex",       category: "Rent Income", description: "March rent - Unit A",       amount:  1900, type: "income",  payee: "Jordan Williams" },
  { id: 2,  date: "2026-03-20", property: "Maple Ridge Duplex",       category: "Rent Income", description: "March rent - Unit B",       amount:  1900, type: "income",  payee: "Priya Patel" },
  { id: 3,  date: "2026-03-18", property: "Riverside Triplex",        category: "Maintenance", description: "HVAC repair - Unit 2",      amount:  -420, type: "expense", payee: "AirPro HVAC Services" },
  { id: 4,  date: "2026-03-15", property: "Lakeview SFR",             category: "Rent Income", description: "March rent",               amount:  2950, type: "income",  payee: "Marcus Thompson" },
  { id: 5,  date: "2026-03-12", property: "Midtown Condo #4B",        category: "HOA Fees",    description: "Monthly HOA",              amount:  -285, type: "expense", payee: "Midtown HOA" },
  { id: 6,  date: "2026-03-10", property: "Sunset Strip Commercial",  category: "Rent Income", description: "March commercial rent",    amount:  8500, type: "income",  payee: "Acme Retail LLC" },
  { id: 7,  date: "2026-03-08", property: "Riverside Triplex",        category: "Rent Income", description: "March rent - Units 1,2,3", amount:  5700, type: "income",  payee: "Various Tenants" },
  { id: 8,  date: "2026-03-05", property: "Maple Ridge Duplex",       category: "Insurance",   description: "Q1 property insurance",   amount: -1200, type: "expense", payee: "State Farm" },
  { id: 9,  date: "2026-03-03", property: "Lakeview SFR",             category: "Property Tax",description: "Semi-annual tax payment",  amount: -2100, type: "expense", payee: "Denver County Assessor" },
  { id: 10, date: "2026-03-01", property: "Midtown Condo #4B",        category: "Rent Income", description: "March rent",               amount:  2100, type: "income",  payee: "Keisha Brown" },
  { id: 11, date: "2026-02-28", property: "Sunset Strip Commercial",  category: "Maintenance", description: "Parking lot reseal",       amount: -3500, type: "expense", payee: "Pacific Paving Co." },
  { id: 12, date: "2026-02-20", property: "Riverside Triplex",        category: "Mortgage",    description: "February mortgage",        amount: -2840, type: "expense", payee: "US Bank" },
  { id: 13, date: "2026-02-15", property: "Maple Ridge Duplex",       category: "Mortgage",    description: "February mortgage",        amount: -1620, type: "expense", payee: "Chase Mortgage" },
  { id: 14, date: "2026-02-10", property: "Lakeview SFR",             category: "Landscaping", description: "Monthly lawn service",     amount:  -180, type: "expense", payee: "Green Thumb Landscaping" },
  { id: 15, date: "2026-02-05", property: "Midtown Condo #4B",        category: "Utilities",   description: "Common area utilities",    amount:   -95, type: "expense", payee: "Georgia Power" },
];

const MONTHLY_CASH_FLOW = [
  { month: "Oct", income: 18500, expenses: 8200, net: 10300 },
  { month: "Nov", income: 19200, expenses: 9100, net: 10100 },
  { month: "Dec", income: 19800, expenses: 11400, net: 8400 },
  { month: "Jan", income: 20100, expenses: 8600, net: 11500 },
  { month: "Feb", income: 21200, expenses: 10200, net: 11000 },
  { month: "Mar", income: 23050, expenses: 9775, net: 13275 },
];

const EQUITY_GROWTH = [
  { year: "2020", equity: 248000 },
  { year: "2021", equity: 412000 },
  { year: "2022", equity: 580000 },
  { year: "2023", equity: 698000 },
  { year: "2024", equity: 815000 },
  { year: "2025", equity: 892000 },
  { year: "2026", equity: 960000 },
];

const EXPENSE_CATEGORIES = [
  { name: "Mortgage", value: 42, color: "#3b82f6" },
  { name: "Maintenance", value: 22, color: "#10b981" },
  { name: "Property Tax", value: 16, color: "#8b5cf6" },
  { name: "Insurance", value: 10, color: "#f59e0b" },
  { name: "HOA", value: 6, color: "#ef4444" },
  { name: "Other", value: 4, color: "#6b7280" },
];

const FLIPS = [
  {
    id: 1, name: "Oakdale Craftsman", address: "1422 Oakdale Ave, Nashville, TN 37206",
    stage: "Active Rehab", image: "OC", color: "#f59e0b",
    purchasePrice: 195000, arv: 310000, rehabBudget: 62000, rehabSpent: 38500,
    holdingCostsPerMonth: 1850, acquisitionDate: "2026-01-08", rehabStartDate: "2026-01-20",
    projectedListDate: "2026-04-15", projectedCloseDate: "2026-05-30", daysOwned: 75,
    rehabItems: [
      { category: "Kitchen", budgeted: 18000, spent: 16200, status: "complete" },
      { category: "Bathrooms (2)", budgeted: 12000, spent: 11500, status: "complete" },
      { category: "Flooring", budgeted: 8500, spent: 5200, status: "in-progress" },
      { category: "Roof", budgeted: 9500, spent: 5600, status: "in-progress" },
      { category: "Exterior / Paint", budgeted: 6000, spent: 0, status: "pending" },
      { category: "HVAC", budgeted: 5500, spent: 0, status: "pending" },
      { category: "Landscaping", budgeted: 2500, spent: 0, status: "pending" },
    ],
  },
  {
    id: 2, name: "Pine Street Ranch", address: "874 Pine Street, Memphis, TN 38104",
    stage: "Listed", image: "PS", color: "#10b981",
    purchasePrice: 148000, arv: 229000, listPrice: 229000, rehabBudget: 38000, rehabSpent: 39200,
    holdingCostsPerMonth: 1420, acquisitionDate: "2025-10-14", rehabStartDate: "2025-10-28",
    rehabEndDate: "2026-01-15", listDate: "2026-01-22", daysOwned: 161,
    rehabItems: [
      { category: "Kitchen", budgeted: 14000, spent: 15200, status: "complete" },
      { category: "Bathroom", budgeted: 7000, spent: 7400, status: "complete" },
      { category: "Flooring", budgeted: 6500, spent: 6800, status: "complete" },
      { category: "Windows", budgeted: 5500, spent: 5400, status: "complete" },
      { category: "Electrical", budgeted: 3000, spent: 3100, status: "complete" },
      { category: "Exterior / Paint", budgeted: 2000, spent: 1300, status: "complete" },
    ],
  },
  {
    id: 3, name: "Hawthorne Heights", address: "3305 Hawthorne Blvd, Charlotte, NC 28205",
    stage: "Under Contract", image: "HH", color: "#8b5cf6",
    purchasePrice: 268000, arv: 445000, rehabBudget: 95000, rehabSpent: 0,
    holdingCostsPerMonth: 2600, contractDate: "2026-03-10", projectedCloseDate: "2026-04-05", daysOwned: 0,
    rehabItems: [
      { category: "Full Kitchen Remodel", budgeted: 28000, spent: 0, status: "pending" },
      { category: "Master Bath", budgeted: 18000, spent: 0, status: "pending" },
      { category: "Secondary Baths (2)", budgeted: 14000, spent: 0, status: "pending" },
      { category: "Addition / Expansion", budgeted: 22000, spent: 0, status: "pending" },
      { category: "Flooring", budgeted: 8000, spent: 0, status: "pending" },
      { category: "Roof & Gutters", budgeted: 5000, spent: 0, status: "pending" },
    ],
  },
  {
    id: 4, name: "Birchwood Colonial", address: "612 Birchwood Lane, Raleigh, NC 27601",
    stage: "Sold", image: "BC", color: "#6b7280",
    purchasePrice: 220000, arv: 358000, salePrice: 361500, rehabBudget: 55000, rehabSpent: 52800,
    holdingCostsPerMonth: 2100, acquisitionDate: "2025-04-12", rehabStartDate: "2025-04-25",
    rehabEndDate: "2025-07-10", listDate: "2025-07-18", closeDate: "2025-08-29",
    daysOwned: 139, totalHoldingCosts: 9730, sellingCosts: 21690, netProfit: 61280,
    rehabItems: [
      { category: "Kitchen", budgeted: 16000, spent: 15600, status: "complete" },
      { category: "Bathrooms (2)", budgeted: 13000, spent: 12400, status: "complete" },
      { category: "Basement Finish", budgeted: 12000, spent: 11800, status: "complete" },
      { category: "HVAC", budgeted: 7500, spent: 7200, status: "complete" },
      { category: "Flooring", budgeted: 4500, spent: 4300, status: "complete" },
      { category: "Exterior", budgeted: 2000, spent: 1500, status: "complete" },
    ],
  },
];

// STAGE_ORDER, STAGE_COLORS imported from api.js

const FLIP_EXPENSE_GROUPS = {
  "Acquisition":          ["Closing Costs (Buy)", "Title & Escrow", "Inspection", "Appraisal"],
  "Rehab Labor":          ["General Contractor", "Subcontractor", "Day Labor"],
  "Rehab Materials":      ["Materials & Supplies", "Appliances", "Fixtures & Hardware"],
  "Permits & Fees":       ["Permits", "Inspections", "Dumpster / Debris Removal"],
  "Holding Costs":        ["Insurance", "Property Tax", "Utilities", "Loan Interest / Hard Money", "HOA"],
  "Selling Costs":        ["Agent Commission", "Photography / Marketing", "Staging", "Cleaning", "Closing Costs (Sell)"],
  "General":              ["Landscaping", "Travel", "Other"],
};
const FLIP_EXPENSE_CATS = Object.values(FLIP_EXPENSE_GROUPS).flat();
const getFlipExpGroup = (cat) => {
  for (const [parent, subs] of Object.entries(FLIP_EXPENSE_GROUPS)) { if (subs.includes(cat)) return parent; }
  return "General";
};

const FLIP_EXPENSES = [
  { id: 1, flipId: 1, date: "2026-03-18", vendor: "Home Depot", category: "Materials & Supplies", description: "Hardwood flooring - 680 sqft", amount: 2890 },
  { id: 2, flipId: 1, date: "2026-03-15", vendor: "ABC Plumbing", category: "Subcontractor", description: "Master bath rough-in", amount: 3200 },
  { id: 3, flipId: 1, date: "2026-03-10", vendor: "Lowe's", category: "Fixtures & Hardware", description: "Kitchen cabinet hardware + fixtures", amount: 640 },
  { id: 4, flipId: 1, date: "2026-03-04", vendor: "City of Nashville", category: "Permits", description: "Renovation permit", amount: 380 },
  { id: 5, flipId: 1, date: "2026-02-28", vendor: "Elite Electric", category: "Subcontractor", description: "Panel upgrade + recessed lighting", amount: 4100 },
  { id: 6, flipId: 1, date: "2026-02-20", vendor: "Lowe's", category: "Materials & Supplies", description: "Kitchen cabinets - shaker style", amount: 5800 },
  { id: 7, flipId: 1, date: "2026-02-14", vendor: "Budget Dumpster", category: "Dumpster / Debris Removal", description: "Demo debris removal", amount: 420 },
  { id: 8, flipId: 2, date: "2026-01-12", vendor: "Sherwin-Williams", category: "Materials & Supplies", description: "Interior/exterior paint + supplies", amount: 1150 },
  { id: 9, flipId: 2, date: "2026-01-08", vendor: "Pro Flooring Co.", category: "Subcontractor", description: "LVP install - 1,100 sqft", amount: 3900 },
  { id: 10, flipId: 2, date: "2025-12-20", vendor: "Home Depot", category: "Appliances", description: "Stainless appliance package", amount: 2400 },
  { id: 11, flipId: 2, date: "2025-12-10", vendor: "Jim's Windows", category: "Subcontractor", description: "Replace 8 windows", amount: 5400 },
  { id: 12, flipId: 2, date: "2025-11-18", vendor: "City of Memphis", category: "Permits", description: "Electrical & structural permits", amount: 295 },
  { id: 13, flipId: 4, date: "2025-07-02", vendor: "Summit HVAC", category: "Subcontractor", description: "Full HVAC replacement", amount: 7200 },
  { id: 14, flipId: 4, date: "2025-06-15", vendor: "Habitat Flooring", category: "Materials & Supplies", description: "Engineered hardwood - whole house", amount: 4300 },
  { id: 15, flipId: 4, date: "2025-06-01", vendor: "Raleigh Tile Co.", category: "Subcontractor", description: "Master bath tile work", amount: 3100 },
];

const CONTRACTORS = [
  { id: 1, flipId: 1, name: "ABC Plumbing", trade: "Plumbing", paymentType: "Fixed Bid", totalBid: 8500, totalPaid: 3200, status: "active", phone: "615-555-0182" },
  { id: 2, flipId: 1, name: "Elite Electric", trade: "Electrical", paymentType: "Fixed Bid", totalBid: 4100, totalPaid: 4100, status: "complete", phone: "615-555-0247" },
  { id: 3, flipId: 1, name: "Nash Drywall", trade: "Drywall", paymentType: "Day Rate", dayRate: 450, totalPaid: 0, status: "pending", phone: "615-555-0318" },
  { id: 4, flipId: 2, name: "Pro Flooring Co.", trade: "Flooring", paymentType: "Fixed Bid", totalBid: 3900, totalPaid: 3900, status: "complete", phone: "901-555-0144" },
  { id: 5, flipId: 2, name: "Jim's Windows", trade: "Windows", paymentType: "Fixed Bid", totalBid: 5400, totalPaid: 5400, status: "complete", phone: "901-555-0229" },
  { id: 6, flipId: 4, name: "Summit HVAC", trade: "HVAC", paymentType: "Fixed Bid", totalBid: 7200, totalPaid: 7200, status: "complete", phone: "919-555-0361" },
];

// DEFAULT_MILESTONES imported from api.js

const FLIP_MILESTONES = {
  1: [
    { label: "Contract Executed", done: true, date: "2026-01-06", targetDate: "2026-01-06" },
    { label: "Inspection Complete", done: true, date: "2026-01-07", targetDate: "2026-01-10" },
    { label: "Purchased / Closed", done: true, date: "2026-01-08", targetDate: "2026-01-08" },
    { label: "Demo Complete", done: true, date: "2026-01-22", targetDate: "2026-01-20" },
    { label: "Rough-In (Plumbing/Electric)", done: true, date: "2026-02-10", targetDate: "2026-02-07" },
    { label: "Drywall", done: true, date: "2026-02-24", targetDate: "2026-02-21" },
    { label: "Paint", done: false, date: null, targetDate: "2026-03-14" },
    { label: "Flooring", done: false, date: null, targetDate: "2026-03-21" },
    { label: "Kitchen & Baths", done: false, date: null, targetDate: "2026-03-28" },
    { label: "Punch List", done: false, date: null, targetDate: "2026-04-04" },
    { label: "Listed for Sale", done: false, date: null, targetDate: "2026-04-15" },
    { label: "Sold / Closed", done: false, date: null, targetDate: "2026-05-30" },
  ],
  2: DEFAULT_MILESTONES.map((label, i) => ({ label, done: i < 11, date: i < 11 ? "2026-01-15" : null, targetDate: null })),
  3: DEFAULT_MILESTONES.slice(0, 3).map((label, i) => ({ label, done: i < 2, date: i < 2 ? "2026-03-12" : null, targetDate: null })),
  4: DEFAULT_MILESTONES.map(label => ({ label, done: true, date: "2025-08-29", targetDate: null })),
};

const TENANTS = [
  { id: 1, propertyId: 1, unit: "Unit A", name: "Marcus & Priya Williams", rent: 1900, securityDeposit: 3800, lateFeePct: 5, renewalTerms: "Annual", notes: "Excellent tenants, always on time.", leaseStart: "2024-02-01", leaseEnd: "2025-01-31", status: "active-lease", daysUntilExpiry: 40, lastPayment: "2026-03-01", phone: "512-555-0143", email: "mwilliams@email.com", leaseDoc: null },
  { id: 2, propertyId: 1, unit: "Unit B", name: "Jordan Lee", rent: 1900, securityDeposit: 1900, lateFeePct: 5, renewalTerms: "Month-to-Month", notes: "", leaseStart: "2023-08-01", leaseEnd: "2024-07-31", status: "month-to-month", daysUntilExpiry: null, lastPayment: "2026-03-01", phone: "512-555-0287", email: "jlee@email.com", leaseDoc: null },
  { id: 3, propertyId: 2, unit: "Main", name: "Stephanie & Dan Kowalski", rent: 2950, securityDeposit: 5900, lateFeePct: 10, renewalTerms: "Annual", notes: "Pet deposit $500 held.", leaseStart: "2024-06-01", leaseEnd: "2025-05-31", status: "active-lease", daysUntilExpiry: 68, lastPayment: "2026-03-15", phone: "303-555-0194", email: "kowalski@email.com", leaseDoc: null },
  { id: 4, propertyId: 3, unit: "#4B", name: "Alexis Fontaine", rent: 2100, securityDeposit: 4200, lateFeePct: 5, renewalTerms: "Annual", notes: "", leaseStart: "2025-01-01", leaseEnd: "2025-12-31", status: "active-lease", daysUntilExpiry: 282, lastPayment: "2026-03-01", phone: "404-555-0362", email: "afontaine@email.com", leaseDoc: null },
  { id: 5, propertyId: 4, unit: "Unit 1", name: "Ryan & Keisha Thompson", rent: 1950, securityDeposit: 3900, lateFeePct: 5, renewalTerms: "Annual", notes: "", leaseStart: "2024-09-01", leaseEnd: "2025-08-31", status: "active-lease", daysUntilExpiry: 159, lastPayment: "2026-03-08", phone: "503-555-0218", email: "kthompson@email.com", leaseDoc: null },
  { id: 6, propertyId: 4, unit: "Unit 2", name: "Vacant", rent: 1875, securityDeposit: null, lateFeePct: null, renewalTerms: "", notes: "", leaseStart: null, leaseEnd: null, status: "vacant", daysUntilExpiry: null, lastPayment: null, phone: null, email: null, leaseDoc: null },
  { id: 7, propertyId: 4, unit: "Unit 3", name: "Carlos Mendez", rent: 1875, securityDeposit: 1875, lateFeePct: 5, renewalTerms: "Month-to-Month", notes: "Month-to-month since Feb 2026.", leaseStart: "2025-03-01", leaseEnd: "2026-02-28", status: "month-to-month", daysUntilExpiry: null, lastPayment: "2026-03-08", phone: "503-555-0445", email: "cmendez@email.com", leaseDoc: null },
  { id: 8, propertyId: 5, unit: "Commercial", name: "Pacific Rim Restaurant Group", rent: 8500, securityDeposit: 17000, lateFeePct: 3, renewalTerms: "5-Year Option", notes: "NNN lease. CAM reconciliation annually.", leaseStart: "2023-01-01", leaseEnd: "2027-12-31", status: "active-lease", daysUntilExpiry: 648, lastPayment: "2026-03-10", phone: "310-555-0501", email: "leasing@pacificrimrg.com", leaseDoc: null },
];

const MILEAGE_TRIPS = [
  { id: 1, date: "2026-03-22", description: "Inspect Oakdale Craftsman - contractor walkthrough", from: "Home", to: "1422 Oakdale Ave, Nashville", miles: 14.2, purpose: "Flip", businessPct: 100 },
  { id: 2, date: "2026-03-20", description: "Collect rent - Maple Ridge Duplex", from: "Home", to: "2847 Maple Ridge Dr, Austin", miles: 8.5, purpose: "Rental", businessPct: 100 },
  { id: 3, date: "2026-03-18", description: "Meet plumber - Oakdale Craftsman", from: "Home", to: "1422 Oakdale Ave, Nashville", miles: 14.2, purpose: "Flip", businessPct: 100 },
  { id: 4, date: "2026-03-15", description: "Annual inspection - Lakeview SFR", from: "Home", to: "518 Lakeview Terrace, Denver", miles: 22.7, purpose: "Rental", businessPct: 100 },
  { id: 5, date: "2026-03-12", description: "Pine Street Ranch showing", from: "Home", to: "874 Pine Street, Memphis", miles: 18.9, purpose: "Flip", businessPct: 100 },
  { id: 6, date: "2026-03-10", description: "Commercial property check-in", from: "Home", to: "9220 Sunset Blvd, W Hollywood", miles: 31.4, purpose: "Rental", businessPct: 100 },
  { id: 7, date: "2026-03-05", description: "Riverside Triplex - maintenance call", from: "Home", to: "744 Riverside Blvd, Portland", miles: 12.1, purpose: "Rental", businessPct: 100 },
  { id: 8, date: "2026-02-28", description: "Accountant meeting - tax prep", from: "Home", to: "Downtown Office", miles: 9.3, purpose: "Business", businessPct: 100 },
];

// fmt, fmtK imported from api.js

// ---------------------------------------------
// COMPONENTS
// ---------------------------------------------

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

function StatCard({ icon: Icon, label, value, sub, trend, trendVal, color = "#3b82f6" }) {
  const up = trend === "up";
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)", border: "1px solid #f1f5f9" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
          <p style={{ color: "#0f172a", fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>{sub}</p>}
        </div>
        <div style={{ background: color + "18", borderRadius: 12, padding: 12 }}>
          <Icon size={22} color={color} />
        </div>
      </div>
      {trendVal && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
          {up ? <ArrowUp size={14} color="#10b981" /> : <ArrowDown size={14} color="#ef4444" />}
          <span style={{ fontSize: 13, fontWeight: 600, color: up ? "#10b981" : "#ef4444" }}>{trendVal}</span>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>vs last month</span>
        </div>
      )}
    </div>
  );
}

function Badge({ status }) {
  const map = {
    "Occupied": { bg: "#dcfce7", text: "#15803d" },
    "Partial Vacancy": { bg: "#fef9c3", text: "#a16207" },
    "Vacant": { bg: "#fee2e2", text: "#b91c1c" },
  };
  const s = map[status] || map["Occupied"];
  return (
    <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      {status}
    </span>
  );
}

// ---------------------------------------------
// VIEWS
// ---------------------------------------------

function Dashboard({ onNavigate, onNavigateToTx }) {
  const [dashProp, setDashProp] = useState("all");
  const isAll = dashProp === "all";
  const props = isAll ? PROPERTIES : PROPERTIES.filter(p => String(p.id) === dashProp);
  const selectedProp = !isAll ? PROPERTIES.find(p => String(p.id) === dashProp) : null;

  // KPIs — filtered by selected property, using transaction-derived financials
  const totalValue = props.reduce((s, p) => s + p.currentValue, 0);
  const totalEquity = props.reduce((s, p) => s + (p.currentValue - (calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? p.loanAmount ?? 0)), 0);
  const monthlyIncome = props.reduce((s, p) => { const e = getEffectiveMonthly(p, TRANSACTIONS); return s + e.monthlyIncome; }, 0);
  const monthlyExpenses = props.reduce((s, p) => { const e = getEffectiveMonthly(p, TRANSACTIONS); return s + e.monthlyExpenses; }, 0);
  const netCashFlow = monthlyIncome - monthlyExpenses;
  const avgCapRate = props.length > 0 ? (props.reduce((s, p) => s + calcCapRate(p, TRANSACTIONS), 0) / props.length).toFixed(1) : "0.0";

  // Transactions filtered by property
  const filteredTx = isAll ? TRANSACTIONS : TRANSACTIONS.filter(t => {
    const propNames = props.map(p => p.name);
    return propNames.some(n => t.property === n);
  });

  // Cash flow chart — derive from filtered transactions by month
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const cfByMonth = {};
  filteredTx.forEach(t => {
    const d = new Date(t.date);
    const key = monthNames[d.getMonth()];
    if (!cfByMonth[key]) cfByMonth[key] = { month: key, income: 0, expenses: 0, net: 0, _order: d.getMonth() };
    if (t.type === "income") cfByMonth[key].income += t.amount;
    else cfByMonth[key].expenses += Math.abs(t.amount);
  });
  Object.values(cfByMonth).forEach(m => { m.net = m.income - m.expenses; });
  const dashCashFlow = Object.values(cfByMonth).sort((a, b) => a._order - b._order);
  // Fallback to global data if no transactions found
  const chartCashFlow = dashCashFlow.length > 0 ? dashCashFlow : MONTHLY_CASH_FLOW;

  // Expense breakdown — derive from filtered transactions
  const expCatColors = { "Mortgage Payment": "#3b82f6", "Mortgage": "#3b82f6", "Maintenance": "#10b981", "Repairs & Maintenance": "#10b981", "Property Tax": "#8b5cf6", "Insurance": "#f59e0b", "HOA Fees": "#ef4444", "Utilities": "#06b6d4", "Landscaping": "#84cc16", "Management Fees": "#ec4899" };
  const expTotals = {};
  filteredTx.filter(t => t.type === "expense").forEach(t => {
    const cat = t.category;
    expTotals[cat] = (expTotals[cat] || 0) + Math.abs(t.amount);
  });
  const totalExpAmt = Object.values(expTotals).reduce((s, v) => s + v, 0) || 1;
  const dashExpCats = Object.entries(expTotals).map(([name, val]) => ({
    name, value: Math.round(val / totalExpAmt * 100), color: expCatColors[name] || "#94a3b8",
  })).sort((a, b) => b.value - a.value);
  const chartExpCats = dashExpCats.length > 0 ? dashExpCats : EXPENSE_CATEGORIES;

  // Equity growth — simulate historical equity for filtered properties
  // For a single property, build yearly equity from purchase date to now using loan amortization
  const dashEquityGrowth = useMemo(() => {
    if (isAll) return EQUITY_GROWTH;
    // Build year-by-year equity for the selected property(ies)
    const years = [];
    const curYear = new Date().getFullYear();
    props.forEach(p => {
      const purchaseYear = p.purchaseDate ? new Date(p.purchaseDate).getFullYear() : (p.loanStartDate ? new Date(p.loanStartDate).getFullYear() : curYear - 2);
      for (let y = purchaseYear; y <= curYear; y++) {
        if (!years.includes(y)) years.push(y);
      }
    });
    years.sort((a, b) => a - b);
    // If no date info, show at least current year
    if (years.length === 0) years.push(curYear);

    return years.map(y => {
      let equity = 0;
      props.forEach(p => {
        const purchaseYear = p.purchaseDate ? new Date(p.purchaseDate).getFullYear() : (p.loanStartDate ? new Date(p.loanStartDate).getFullYear() : curYear - 2);
        if (y < purchaseYear) return; // not owned yet
        const yearsOwned = y - purchaseYear;
        // Estimate value appreciation (~3% per year from purchase price to current value)
        const totalYears = Math.max(1, curYear - purchaseYear);
        const annualAppreciation = totalYears > 0 ? Math.pow(p.currentValue / p.purchasePrice, 1 / totalYears) : 1;
        const estValue = y === curYear ? p.currentValue : Math.round(p.purchasePrice * Math.pow(annualAppreciation, yearsOwned));
        // Estimate loan balance at that point in time
        let loanBal = p.loanAmount || 0;
        if (p.loanAmount && p.loanRate && p.loanTermYears && p.loanStartDate) {
          const loanStartYear = new Date(p.loanStartDate).getFullYear();
          const monthsElapsed = Math.max(0, (y - loanStartYear) * 12);
          const r = (p.loanRate / 100) / 12;
          const n = p.loanTermYears * 12;
          if (r > 0 && monthsElapsed < n) {
            const M = p.loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
            loanBal = Math.max(0, p.loanAmount * Math.pow(1 + r, monthsElapsed) - M * (Math.pow(1 + r, monthsElapsed) - 1) / r);
          } else if (monthsElapsed >= n) {
            loanBal = 0;
          }
        }
        equity += Math.max(0, estValue - loanBal);
      });
      return { year: String(y), equity: Math.round(equity) };
    });
  }, [dashProp]);

  // Subtitle
  const subtitle = isAll
    ? "Welcome back, Brandon — here's your portfolio at a glance."
    : `Showing ${selectedProp?.name || "property"} performance.`;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>{subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Building2 size={16} color="#94a3b8" />
          <select value={dashProp} onChange={e => setDashProp(e.target.value)} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 14px", fontSize: 14, color: "#0f172a", background: "#fff", cursor: "pointer", fontWeight: 600, minWidth: 200 }}>
            <option value="all">All Properties</option>
            {PROPERTIES.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 28 }}>
        <StatCard icon={Building2} label={isAll ? "Portfolio Value" : "Property Value"} value={fmtK(totalValue)} sub={isAll ? `${props.length} properties` : (selectedProp?.type || "")} trend="up" trendVal={isAll ? `${props.length} properties` : ""} color="#3b82f6" />
        <StatCard icon={Wallet} label="Total Equity" value={fmtK(totalEquity)} sub="Net of mortgages" color="#10b981" />
        <StatCard icon={DollarSign} label="Monthly Cash Flow" value={fmt(netCashFlow)} sub={`${fmt(monthlyIncome)} income - ${fmt(monthlyExpenses)} exp`} color="#8b5cf6" />
        <StatCard icon={Percent} label={isAll ? "Avg. Cap Rate" : "Cap Rate"} value={`${avgCapRate}%`} sub={isAll ? "Across portfolio" : "This property"} color="#f59e0b" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 28 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700 }}>Cash Flow</h3>
              <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>Income vs. expenses vs. net</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartCashFlow}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v/1000}K`} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <Area type="monotone" dataKey="income" stroke="#3b82f6" strokeWidth={2} fill="url(#colorIncome)" name="Income" />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="none" strokeDasharray="4 4" name="Expenses" />
              <Area type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2.5} fill="url(#colorNet)" name="Net" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Expense Breakdown</h3>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>By category</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={chartExpCats} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                {chartExpCats.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {chartExpCats.slice(0, 4).map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                  <span style={{ fontSize: 12, color: "#475569" }}>{c.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{c.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Equity Growth</h3>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>{isAll ? "Total portfolio equity over time" : `${selectedProp?.name || ""} equity over time`}</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dashEquityGrowth}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v/1000}K`} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
              <Area type="monotone" dataKey="equity" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#colorEquity)" name="Equity" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700 }}>Recent Transactions</h3>
            {onNavigate && <button onClick={() => onNavigate("transactions")} style={{ color: "#3b82f6", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>View all <ChevronRight size={14} /></button>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filteredTx.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 24 }}>No transactions for this property yet.</p>
            ) : filteredTx.slice(0, 5).map(t => (
              <div key={t.id} onClick={() => onNavigateToTx && onNavigateToTx(t.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "10px 8px", borderRadius: 10, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: t.type === "income" ? "#dcfce7" : "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {t.type === "income" ? <ArrowUp size={16} color="#15803d" /> : <ArrowDown size={16} color="#b91c1c" />}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 1 }}>{t.description}</p>
                    <p style={{ fontSize: 12, color: "#94a3b8" }}>{isAll ? `${t.property.split(" ").slice(0, 2).join(" ")} · ` : ""}{t.date}</p>
                  </div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: t.type === "income" ? "#15803d" : "#b91c1c" }}>
                  {t.type === "income" ? "+" : ""}{fmt(Math.abs(t.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Properties({ onSelect, editPropertyId, onClearEditId }) {
  const [propData, setPropData] = useState(PROPERTIES);
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null); // null = add, id = edit
  const [deleteConfirm, setDeleteConfirm] = useState(null); // property object to confirm delete
  const emptyP = { name: "", address: "", type: "Single Family", units: "1", purchasePrice: "", currentValue: "", closingCosts: "", loanAmount: "", loanRate: "", loanTermYears: "30", loanStartDate: "", monthlyRent: "", monthlyExpenses: "", status: "Occupied", purchaseDate: "", photo: null };
  const [form, setForm] = useState(emptyP);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-open edit modal when navigated from PropertyDetail health banner
  useEffect(() => {
    if (editPropertyId) {
      const p = propData.find(pr => pr.id === editPropertyId);
      if (p) {
        setEditId(p.id);
        setForm({ name: p.name, address: p.address, type: p.type, units: String(p.units), purchasePrice: String(p.purchasePrice), currentValue: String(p.currentValue), closingCosts: String(p.closingCosts || ""), loanAmount: String(p.loanAmount || ""), loanRate: String(p.loanRate || ""), loanTermYears: String(p.loanTermYears || "30"), loanStartDate: p.loanStartDate || "", monthlyRent: String(p.monthlyRent), monthlyExpenses: String(p.monthlyExpenses), status: p.status, purchaseDate: p.purchaseDate || "", photo: p.photo || null });
        setShowModal(true);
      }
      onClearEditId && onClearEditId();
    }
  }, [editPropertyId]);

  const handlePhotoUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, photo: ev.target.result }));
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-upload of same file
  };

  const openAdd = () => { setEditId(null); setForm(emptyP); setShowModal(true); };
  const openEdit = (e, p) => {
    e.stopPropagation();
    setEditId(p.id);
    setForm({ name: p.name, address: p.address, type: p.type, units: String(p.units), purchasePrice: String(p.purchasePrice), currentValue: String(p.currentValue), closingCosts: String(p.closingCosts || ""), loanAmount: String(p.loanAmount || ""), loanRate: String(p.loanRate || ""), loanTermYears: String(p.loanTermYears || "30"), loanStartDate: p.loanStartDate || "", monthlyRent: String(p.monthlyRent), monthlyExpenses: String(p.monthlyExpenses), status: p.status, purchaseDate: p.purchaseDate || "", photo: p.photo || null });
    setShowModal(true);
  };

  const handleSaveProp = () => {
    if (!form.name) return;
    const rent = parseFloat(form.monthlyRent) || 0;
    const exp  = parseFloat(form.monthlyExpenses) || 0;
    const val  = parseFloat(form.currentValue) || 0;
    const loanAmt  = parseFloat(form.loanAmount) || 0;
    const loanRate = parseFloat(form.loanRate) || 0;
    const loanTerm = parseFloat(form.loanTermYears) || 30;
    const loanStart = form.loanStartDate || "";
    const cc = parseFloat(form.closingCosts) || 0;
    const today = new Date().toISOString().slice(0, 10);

    if (editId !== null) {
      setPropData(prev => prev.map(p => {
        if (p.id !== editId) return p;
        const valChanged = val !== p.currentValue;
        return { ...p, name: form.name, address: form.address, type: form.type, units: parseInt(form.units) || 1, purchasePrice: parseFloat(form.purchasePrice) || 0, currentValue: val, valueUpdatedAt: valChanged ? today : (p.valueUpdatedAt || today), loanAmount: loanAmt, loanRate, loanTermYears: loanTerm, loanStartDate: loanStart, closingCosts: cc, monthlyRent: rent, monthlyExpenses: exp, purchaseDate: form.purchaseDate, status: form.status, photo: form.photo ?? p.photo };
      }));
    } else {
      const usedColors = propData.map(p => p.color);
      const color = PROP_COLORS.find(c => !usedColors.includes(c)) || PROP_COLORS[propData.length % PROP_COLORS.length];
      setPropData(prev => [...prev, { id: newId(), name: form.name, address: form.address, type: form.type, units: parseInt(form.units) || 1, purchasePrice: parseFloat(form.purchasePrice) || 0, currentValue: val, valueUpdatedAt: today, loanAmount: loanAmt, loanRate, loanTermYears: loanTerm, loanStartDate: loanStart, closingCosts: cc, monthlyRent: rent, monthlyExpenses: exp, purchaseDate: form.purchaseDate, status: form.status, image: form.name.slice(0, 2).toUpperCase(), color, photo: form.photo || null }]);
    }
    setForm(emptyP);
    setShowModal(false);
  };

  const handleDeleteProp = () => {
    if (!deleteConfirm) return;
    setPropData(prev => prev.filter(p => p.id !== deleteConfirm.id));
    setDeleteConfirm(null);
  };

  const filtered = propData.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.type.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Properties</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>{propData.length} properties in your portfolio</p>
        </div>
        <button onClick={openAdd} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Add Property
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search properties..." style={{ width: "100%", paddingLeft: 38, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }} />
        </div>
        <button style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 16px", background: "#fff", color: "#475569", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Filter size={15} /> Filter
        </button>
        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
          {["grid", "list"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: view === v ? "#fff" : "transparent", color: view === v ? "#0f172a" : "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
              {v === "grid" ? "#" : "="}
            </button>
          ))}
        </div>
      </div>

      {view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {filtered.map(p => {
            const calcBal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate);
            const effectiveMortgage = calcBal !== null ? calcBal : (p.mortgage || 0);
            const equity = p.currentValue - effectiveMortgage;
            const eff = getEffectiveMonthly(p, TRANSACTIONS);
            const monthlyNet = eff.monthlyIncome - eff.monthlyExpenses;
            const pHealth = getPropertyHealth(p, TRANSACTIONS);
            const pBadge = healthBadge(pHealth);
            return (
              <div key={p.id} onClick={() => onSelect(p)} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}>
                <div style={{ height: 130, background: p.photo ? "transparent" : `linear-gradient(135deg, ${p.color}22, ${p.color}44)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                  {p.photo
                    ? <img src={p.photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: 56, height: 56, borderRadius: 16, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 800 }}>{p.image}</div>
                  }
                  <div style={{ position: "absolute", top: 10, left: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "3px 9px", background: pBadge.bg, color: pBadge.color, backdropFilter: "blur(4px)" }}>{pBadge.label}</span>
                  </div>
                  <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Badge status={p.status} />
                    <button onClick={e => openEdit(e, p)} title="Edit property"
                      style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", display: "flex", alignItems: "center", backdropFilter: "blur(4px)" }}>
                      <Pencil size={12} color="#475569" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDeleteConfirm(p); }} title="Delete property"
                      style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", display: "flex", alignItems: "center", backdropFilter: "blur(4px)" }}>
                      <Trash2 size={12} color="#ef4444" />
                    </button>
                  </div>
                </div>
                <div style={{ padding: 18 }}>
                  <h3 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{p.name}</h3>
                  <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={11} /> {p.address.split(",")[1]?.trim()} . {p.type}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Value</p>
                      <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 700 }}>{fmtK(p.currentValue)}</p>
                      {p.valueUpdatedAt && (() => {
                        const staleD = Math.round((new Date() - new Date(p.valueUpdatedAt)) / 86400000);
                        const staleV = staleD > 90;
                        return <p style={{ color: staleV ? "#b45309" : "#cbd5e1", fontSize: 10, marginTop: 1 }}>{staleV ? "⚠ Value may be outdated" : `Value as of ${daysAgo(p.valueUpdatedAt)}`}</p>;
                      })()}
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Equity</p>
                      <p style={{ color: "#10b981", fontSize: 15, fontWeight: 700 }}>{fmtK(equity)}</p>
                      {calcBal !== null && <p style={{ color: "#cbd5e1", fontSize: 10, marginTop: 1 }}>Balance {fmtK(effectiveMortgage)}</p>}
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Monthly CF</p>
                      <p style={{ color: "#3b82f6", fontSize: 15, fontWeight: 700 }}>{fmt(monthlyNet)}</p>
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Cap Rate</p>
                      <p style={{ color: "#8b5cf6", fontSize: 15, fontWeight: 700 }}>{calcCapRate(p)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Property", "Type", "Value", "Equity", "Monthly Income", "Net Cash Flow", "Cap Rate", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "14px 20px", textAlign: "left", color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const lBal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate);
                const effMort = lBal !== null ? lBal : (p.mortgage || 0);
                const tHealth = getPropertyHealth(p, TRANSACTIONS);
                const tBadge = healthBadge(tHealth);
                return (
                <tr key={p.id} onClick={() => onSelect(p)} style={{ borderTop: "1px solid #f1f5f9", cursor: "pointer", background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0f9ff"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"}>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, position: "relative" }}>
                        {p.image}
                        {tHealth.length > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: "50%", background: tBadge.color, border: "2px solid #fff" }} />}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{p.name}</p>
                        <p style={{ fontSize: 12, color: "#94a3b8" }}>{p.units} unit{p.units > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: 13, color: "#475569" }}>{p.type}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{fmtK(p.currentValue)}</p>
                    {p.valueUpdatedAt && (() => {
                      const staleD = Math.round((new Date() - new Date(p.valueUpdatedAt)) / 86400000);
                      const staleV = staleD > 90;
                      return <p style={{ fontSize: 11, color: staleV ? "#b45309" : "#cbd5e1" }}>{staleV ? "⚠ Value may be outdated" : `Value as of ${daysAgo(p.valueUpdatedAt)}`}</p>;
                    })()}
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#10b981" }}>{fmtK(p.currentValue - effMort)}</p>
                    {lBal !== null && <p style={{ fontSize: 11, color: "#cbd5e1" }}>Balance {fmtK(effMort)}</p>}
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{fmt(getEffectiveMonthly(p, TRANSACTIONS).monthlyIncome)}</td>
                  <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>{fmt(getEffectiveMonthly(p, TRANSACTIONS).monthlyIncome - getEffectiveMonthly(p, TRANSACTIONS).monthlyExpenses)}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <span style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{calcCapRate(p, TRANSACTIONS)}%</span>
                  </td>
                  <td style={{ padding: "16px 20px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={e => openEdit(e, p)} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "#475569", fontSize: 12, fontWeight: 600 }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirm(p); }} style={{ background: "#fee2e2", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", color: "#ef4444" }} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <Modal title={editId ? "Edit Property" : "Add Property"} onClose={() => setShowModal(false)} width={580}>
          {/* Photo Upload */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Property Photo</label>
            <div
              onClick={() => document.getElementById("propPhotoInput").click()}
              style={{ position: "relative", height: form.photo ? 160 : 100, borderRadius: 14, border: "2px dashed #e2e8f0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: form.photo ? "transparent" : "#f8fafc", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#3b82f6"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#e2e8f0"}
            >
              {form.photo ? (
                <>
                  <img src={form.photo} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                    <div style={{ background: "rgba(0,0,0,0.55)", borderRadius: 10, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 600 }}>Change Photo</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, photo: null })); }}
                    style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: 20, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
                    <X size={13} />
                  </button>
                </>
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8", pointerEvents: "none" }}>
                  <UploadCloud size={28} style={{ margin: "0 auto 6px" }} />
                  <p style={{ fontSize: 13, fontWeight: 500 }}>Click to upload photo</p>
                  <p style={{ fontSize: 11, marginTop: 2 }}>JPG, PNG, WEBP</p>
                </div>
              )}
            </div>
            <input id="propPhotoInput" type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
          </div>

          {/* Basic Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { label: "Property Name", key: "name", type: "text", placeholder: "e.g. Maple Ridge Duplex", full: true },
              { label: "Address", key: "address", type: "text", placeholder: "Street, City, State ZIP", full: true },
              { label: "Purchase Price ($)", key: "purchasePrice", type: "number", placeholder: "0" },
              { label: "Current Value ($)", key: "currentValue", type: "number", placeholder: "0" },
              { label: "Closing Costs ($)", key: "closingCosts", type: "number", placeholder: "0" },
              { label: "Est. Monthly Rent ($)", key: "monthlyRent", type: "number", placeholder: "0" },
              { label: "Est. Monthly Expenses ($)", key: "monthlyExpenses", type: "number", placeholder: "0" },
              { label: "Units", key: "units", type: "number", placeholder: "1" },
              { label: "Purchase Date", key: "purchaseDate", type: "date", placeholder: "" },
            ].map(f => (
              <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : "auto" }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={sf(f.key)} style={iS} />
              </div>
            ))}
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Type</label>
              <select value={form.type} onChange={sf("type")} style={iS}>
                {["Single Family","Multi-Family","Condo","Commercial","Land"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Status</label>
              <select value={form.status} onChange={sf("status")} style={iS}>
                {["Occupied","Partial Vacancy","Vacant"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Loan Details Section */}
          <div style={{ margin: "20px 0 14px", padding: "14px 16px", background: "#f0f9ff", borderRadius: 12, border: "1px solid #bae6fd" }}>
            <p style={{ color: "#0369a1", fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              🏦 Loan Details — balance calculated automatically from these
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Original Loan Amount ($)</label>
                <input type="number" placeholder="e.g. 308000" value={form.loanAmount} onChange={sf("loanAmount")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Interest Rate (%)</label>
                <input type="number" step="0.01" placeholder="e.g. 3.25" value={form.loanRate} onChange={sf("loanRate")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Loan Term (years)</label>
                <input type="number" placeholder="30" value={form.loanTermYears} onChange={sf("loanTermYears")} style={iS} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Loan Start Date</label>
                <input type="date" value={form.loanStartDate} onChange={sf("loanStartDate")} style={iS} />
              </div>
              {form.loanAmount && form.loanRate && form.loanTermYears && form.loanStartDate && (() => {
                const b = calcLoanBalance(form.loanAmount, form.loanRate, form.loanTermYears, form.loanStartDate);
                return b !== null ? (
                  <div style={{ gridColumn: "1 / -1", background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #bae6fd", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b", fontSize: 13 }}>Estimated current balance:</span>
                    <span style={{ color: "#0f172a", fontSize: 15, fontWeight: 700 }}>{fmt(b)}</span>
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveProp} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              {editId ? "Save Changes" : "Add Property"}
            </button>
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title="Delete Property" onClose={() => setDeleteConfirm(null)} width={440}>
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fee2e2", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Trash2 size={22} color="#ef4444" />
            </div>
            <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
            </p>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 6 }}>
              {deleteConfirm.address}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 24 }}>
              This will remove the property and its data from your portfolio. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDeleteProp} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete Property</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PropertyDetail({ property, onBack, onEditProperty, onGoToTransactions }) {
  const calcBal = calcLoanBalance(property.loanAmount, property.loanRate, property.loanTermYears, property.loanStartDate);
  const effectiveMortgage = calcBal !== null ? calcBal : (property.mortgage || 0);
  const equity = property.currentValue - effectiveMortgage;
  const appreciation = property.currentValue - property.purchasePrice;
  const eff = getEffectiveMonthly(property, TRANSACTIONS);
  const annualNOI = (eff.monthlyIncome - eff.monthlyExpenses) * 12;
  const propTransactions = TRANSACTIONS.filter(t => t.property === property.name);
  const detailHealth = getPropertyHealth(property, TRANSACTIONS);
  const [healthOpen, setHealthOpen] = useState(true);

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "#3b82f6", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 20 }}>
        Back to Properties
      </button>

      {/* Recommended Updates Banner */}
      {detailHealth.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, padding: healthOpen ? "16px 20px" : "12px 20px", marginBottom: 20, transition: "all 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setHealthOpen(h => !h)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={16} color="#b45309" />
              <span style={{ color: "#92400e", fontSize: 14, fontWeight: 700 }}>
                {detailHealth.length} Recommended Update{detailHealth.length > 1 ? "s" : ""}
              </span>
              <span style={{ color: "#b45309", fontSize: 12 }}>— improve the accuracy of your analytics</span>
            </div>
            <ChevronDown size={16} color="#b45309" style={{ transform: healthOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
          </div>
          {healthOpen && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {detailHealth.map(item => (
                <div key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#fff", borderRadius: 10, padding: "12px 16px", border: "1px solid #fde68a" }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                    background: item.severity === "high" ? "#dc2626" : item.severity === "medium" ? "#f59e0b" : "#6366f1"
                  }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "#0f172a", fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{item.label}</p>
                    <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{item.detail}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); item.field ? onEditProperty && onEditProperty(property) : onGoToTransactions && onGoToTransactions(); }} style={{
                    fontSize: 11, fontWeight: 600, color: "#b45309", background: "#fef3c7", borderRadius: 6, padding: "5px 12px", whiteSpace: "nowrap", flexShrink: 0,
                    border: "1px solid #fde68a", cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#fde68a"; e.currentTarget.style.color = "#92400e"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#fef3c7"; e.currentTarget.style.color = "#b45309"; }}
                  >{item.field ? "Edit Property" : "Go to Transactions"}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ background: `linear-gradient(135deg, ${property.color}18, ${property.color}30)`, borderRadius: 20, padding: 28, marginBottom: 24, border: `1px solid ${property.color}30` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {property.photo
              ? <img src={property.photo} alt={property.name} style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", border: `3px solid ${property.color}40` }} />
              : <div style={{ width: 64, height: 64, borderRadius: 18, background: property.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800 }}>{property.image}</div>
            }
            <div>
              <h1 style={{ color: "#0f172a", fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{property.name}</h1>
              <p style={{ color: "#64748b", fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> {property.address}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <span style={{ background: "rgba(255,255,255,0.7)", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: "#475569", fontWeight: 600 }}>{property.type}</span>
                <span style={{ background: "rgba(255,255,255,0.7)", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: "#475569", fontWeight: 600 }}>{property.units} unit{property.units > 1 ? "s" : ""}</span>
                <Badge status={property.status} />
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "#64748b", fontSize: 13 }}>Current Value</p>
            <p style={{ color: "#0f172a", fontSize: 32, fontWeight: 800 }}>{fmt(property.currentValue)}</p>
            <p style={{ color: "#10b981", fontSize: 14, fontWeight: 600 }}>+{fmt(appreciation)} since purchase</p>
            {property.valueUpdatedAt && (() => {
              const staleD = Math.round((new Date() - new Date(property.valueUpdatedAt)) / 86400000);
              const staleV = staleD > 90;
              return <p style={{ color: staleV ? "#b45309" : "#94a3b8", fontSize: 12, marginTop: 2 }}>
                {staleV ? "⚠ Property value may be outdated — edit property to update" : `Value as of ${daysAgo(property.valueUpdatedAt)}`}
              </p>;
            })()}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Monthly Income", value: fmt(eff.monthlyIncome), color: "#10b981", sub: eff.source === "transactions" ? `Avg from ${eff.months}mo of transactions` : "Manual estimate — log transactions for actuals" },
          { label: "Monthly Expenses", value: fmt(eff.monthlyExpenses), color: "#ef4444", sub: eff.source === "transactions" ? `Avg from ${eff.months}mo of transactions` : "Manual estimate — log transactions for actuals" },
          { label: "Net Cash Flow", value: fmt(eff.monthlyIncome - eff.monthlyExpenses), color: "#3b82f6" },
          { label: "Total Equity", value: fmt(equity), color: "#8b5cf6" },
          { label: "Purchase Price", value: fmt(property.purchasePrice), color: "#0f172a" },
          { label: "Closing Costs", value: property.closingCosts ? fmt(property.closingCosts) : "—", color: "#64748b" },
          { label: calcBal !== null ? "Est. Mortgage Balance" : "Mortgage Balance", value: fmt(effectiveMortgage), color: "#f59e0b", sub: calcBal !== null ? "Calculated from loan terms" : null },
          { label: "Cap Rate", value: `${calcCapRate(property, TRANSACTIONS)}%`, color: "#8b5cf6" },
          { label: "Cash-on-Cash", value: `${calcCashOnCash(property, TRANSACTIONS)}%`, color: "#10b981" },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
            <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{m.label}</p>
            <p style={{ color: m.color, fontSize: 18, fontWeight: 700 }}>{m.value}</p>
            {m.sub && <p style={{ color: "#cbd5e1", fontSize: 10, marginTop: 2 }}>{m.sub}</p>}
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
        <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recent Transactions</h3>
        {propTransactions.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: 24 }}>No transactions found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Date", "Category", "Description", "Amount"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {propTransactions.map(t => (
                <tr key={t.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#64748b" }}>{t.date}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600, color: "#475569" }}>{t.category}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#0f172a" }}>{t.description}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: t.type === "income" ? "#15803d" : "#b91c1c" }}>
                    {t.type === "income" ? "+" : ""}{fmt(Math.abs(t.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Transactions({ highlightTxId, onBack, onClearHighlight }) {
  const [txData, setTxData] = useState(TRANSACTIONS);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [propFilter, setPropFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [dateTo, setDateTo] = useState("");
  const [flashId, setFlashId] = useState(highlightTxId);
  const highlightRef = useRef(null);

  useEffect(() => {
    if (highlightTxId) {
      setFlashId(highlightTxId);
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
  }, [highlightTxId]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  // ── Two-tier category system: parent → subcategories ──
  const INCOME_GROUPS = {
    "Rent":           ["Rent Income", "Parking / Storage", "Laundry Income"],
    "Fees":           ["Late Fees", "Pet Fees", "Application Fees"],
    "Other Income":   ["Damage Deposit Applied", "Other Income"],
  };
  const EXPENSE_GROUPS = {
    "Mortgage & Financing": ["Mortgage Payment", "Loan Interest", "Refinance Costs"],
    "Taxes":                ["Property Tax", "Tax Penalties"],
    "Insurance":            ["Property Insurance", "Liability Insurance", "Flood Insurance"],
    "Repairs & Maintenance":["Plumbing", "Electrical", "HVAC", "Appliance Repair", "Roof Repair", "General Maintenance"],
    "Capital Improvement":  ["Kitchen Remodel", "Bathroom Remodel", "Flooring", "New Roof", "Other Capital"],
    "HOA / Condo Fees":     ["HOA Dues", "Special Assessment"],
    "Property Management":  ["Management Fee", "Leasing Fee"],
    "Utilities":            ["Electric", "Gas", "Water / Sewer", "Trash", "Internet / Cable"],
    "Grounds":              ["Landscaping", "Snow Removal", "Pest Control"],
    "Professional Services":["Legal Fees", "Accounting / CPA", "Inspection Fees"],
    "Marketing":            ["Advertising", "Listing Fees", "Signage"],
    "General":              ["Cleaning", "Supplies & Materials", "Travel & Mileage", "Other Expenses"],
  };
  const groupsForType = t => t === "income" ? INCOME_GROUPS : EXPENSE_GROUPS;
  // Flat list for backwards compat
  const INCOME_CATS = Object.values(INCOME_GROUPS).flat();
  const EXPENSE_CATS = Object.values(EXPENSE_GROUPS).flat();
  const catsForType = t => t === "income" ? INCOME_CATS : EXPENSE_CATS;
  // Get parent group for a subcategory (checks both income & expense groups, handles legacy names)
  const parentOf = (cat, type) => {
    const groups = groupsForType(type);
    for (const [parent, subs] of Object.entries(groups)) { if (subs.includes(cat)) return parent; }
    // Fallback: check the other type's groups too (for filter chip display)
    const alt = type === "income" ? EXPENSE_GROUPS : INCOME_GROUPS;
    for (const [parent, subs] of Object.entries(alt)) { if (subs.includes(cat)) return parent; }
    return "";
  };
  // selectedGroup no longer needed — single grouped dropdown

  const emptyIncome  = { date: "", property: PROPERTIES[0]?.name || "", type: "income",  category: "Rent Income",      description: "", amount: "", payee: "", piOverride: false, piPrincipal: "", piInterest: "" };
  const emptyExpense = { date: "", property: PROPERTIES[0]?.name || "", type: "expense", category: "Mortgage Payment", description: "", amount: "", payee: "", piOverride: false, piPrincipal: "", piInterest: "" };
  const [form, setForm] = useState(emptyIncome);
  const [payeeFocus, setPayeeFocus] = useState(false);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const closeModal = () => { setShowModal(false); setPayeeFocus(false); };
  const openAddIncome  = () => { setEditId(null); setForm(emptyIncome);  setPayeeFocus(false); setShowModal("income");  };
  const openAddExpense = () => { setEditId(null); setForm(emptyExpense); setPayeeFocus(false); setShowModal("expense"); };
  const openEdit = t => {
    setEditId(t.id);
    setForm({ date: t.date, property: t.property, type: t.type, category: t.category, description: t.description, amount: String(Math.abs(t.amount)), payee: t.payee || "", piOverride: !!(t.piPrincipal || t.piInterest), piPrincipal: t.piPrincipal ? String(t.piPrincipal) : "", piInterest: t.piInterest ? String(t.piInterest) : "" });
    setPayeeFocus(false);
    setShowModal(t.type);
  };

  // Unique categories in the current data
  const allCategories = [...new Set(txData.map(t => t.category))].sort();

  // Date filter helpers
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth(); // 0-indexed
  const matchesDate = t => {
    if (dateFilter === "all") return true;
    const d = new Date(t.date);
    if (dateFilter === "thisMonth") return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    if (dateFilter === "lastMonth") {
      const lm = thisMonth === 0 ? 11 : thisMonth - 1;
      const ly = thisMonth === 0 ? thisYear - 1 : thisYear;
      return d.getFullYear() === ly && d.getMonth() === lm;
    }
    if (dateFilter === "thisYear") return d.getFullYear() === thisYear;
    if (dateFilter === "lastYear") return d.getFullYear() === thisYear - 1;
    if (dateFilter === "custom") {
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      return true;
    }
    return true;
  };

  const filtered = txData.filter(t => {
    const matchType = filter === "all" || t.type === filter;
    const matchProp = propFilter === "all" || t.property === propFilter;
    const matchCat = catFilter === "all" || t.category === catFilter;
    const matchSearch = t.description.toLowerCase().includes(search.toLowerCase()) || t.property.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()) || (t.payee || "").toLowerCase().includes(search.toLowerCase());
    return matchType && matchProp && matchCat && matchSearch && matchesDate(t);
  });

  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

  // Separate payee/payer lists: expense payees vs income payers
  const allPayees = [...new Set(txData.filter(t => t.type === "expense").map(t => t.payee).filter(Boolean))].sort();
  const allPayers = [...new Set(txData.filter(t => t.type === "income").map(t => t.payee).filter(Boolean))].sort();

  const handleSave = () => {
    if (!form.description || !form.amount) return;
    const amt = parseFloat(form.amount) || 0;
    const isMortgage = ["Mortgage Payment", "Mortgage"].includes(form.category);
    const built = { date: form.date || new Date().toISOString().split("T")[0], property: form.property, category: form.category || "Other", description: form.description, amount: form.type === "income" ? Math.abs(amt) : -Math.abs(amt), type: form.type, payee: (form.payee || "").trim() };
    // Store P&I split if mortgage transaction
    if (isMortgage && form.piOverride && form.piPrincipal && form.piInterest) {
      built.piPrincipal = parseFloat(form.piPrincipal) || 0;
      built.piInterest = parseFloat(form.piInterest) || 0;
    } else if (isMortgage) {
      // Auto-calculate and store
      const prop = PROPERTIES.find(p => p.name === form.property);
      if (prop) {
        const payDate = form.date || new Date().toISOString().split("T")[0];
        const interest = calcPaymentInterest(prop.loanAmount, prop.loanRate, prop.loanTermYears, prop.loanStartDate, payDate);
        if (interest !== null) {
          built.piInterest = interest;
          built.piPrincipal = Math.max(0, Math.round(amt - interest));
        }
      }
    }
    if (editId !== null) {
      setTxData(prev => prev.map(t => t.id === editId ? { ...t, ...built } : t));
    } else {
      setTxData(prev => [{ id: newId(), ...built }, ...prev]);
    }
    setForm(emptyIncome);
    closeModal();
  };

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#3b82f6", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 0 12px", marginBottom: 0 }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Dashboard
        </button>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Transactions</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>Track all income and expenses across your portfolio</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={openAddExpense} style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Expense
          </button>
          <button onClick={openAddIncome} style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Income
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Total Income</p>
          <p style={{ color: "#15803d", fontSize: 24, fontWeight: 800, marginTop: 4 }}>+{fmt(totalIncome)}</p>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Total Expenses</p>
          <p style={{ color: "#b91c1c", fontSize: 24, fontWeight: 800, marginTop: 4 }}>-{fmt(totalExpenses)}</p>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Net</p>
          <p style={{ color: totalIncome - totalExpenses >= 0 ? "#15803d" : "#b91c1c", fontSize: 24, fontWeight: 800, marginTop: 4 }}>{fmt(totalIncome - totalExpenses)}</p>
        </div>
      </div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }} />
        </div>
        {/* Property */}
        <select value={propFilter} onChange={e => setPropFilter(e.target.value)} style={{ ...iS, width: "auto", minWidth: 160, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All Properties</option>
          {PROPERTIES.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        {/* Category */}
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ ...iS, width: "auto", minWidth: 160, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All Categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {/* Date range */}
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
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...iS, width: "auto", fontSize: 13, padding: "9px 12px" }} placeholder="From" />
            <span style={{ color: "#94a3b8", fontSize: 13, alignSelf: "center" }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...iS, width: "auto", fontSize: 13, padding: "9px 12px" }} placeholder="To" />
          </>
        )}
        {/* Income / Expense toggle */}
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {[["all", "All"], ["income", "Income"], ["expense", "Expenses"]].map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "9px 16px", borderRadius: 10, border: filter === f ? "none" : "1px solid #e2e8f0", background: filter === f ? (f === "income" ? "#dcfce7" : f === "expense" ? "#fee2e2" : "#3b82f6") : "#fff", color: filter === f ? (f === "income" ? "#15803d" : f === "expense" ? "#b91c1c" : "#fff") : "#475569", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* Active filter chips + clear */}
      {(propFilter !== "all" || catFilter !== "all" || dateFilter !== "all" || search) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>Filtered:</span>
          {propFilter !== "all" && <span style={{ background: "#eff6ff", color: "#3b82f6", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{propFilter.split(" ").slice(0, 2).join(" ")}</span>}
          {catFilter !== "all" && <span style={{ background: "#f0fdf4", color: "#15803d", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{catFilter}</span>}
          {dateFilter !== "all" && <span style={{ background: "#fef9c3", color: "#854d0e", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{{ thisMonth: "This Month", lastMonth: "Last Month", thisYear: "This Year", lastYear: "Last Year", custom: dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : "Custom Range" }[dateFilter]}</span>}
          {search && <span style={{ background: "#f1f5f9", color: "#475569", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>"{search}"</span>}
          <button onClick={() => { setPropFilter("all"); setCatFilter("all"); setDateFilter("all"); setDateFrom(""); setDateTo(""); setSearch(""); }} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear all</button>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Date", "Property", "Category", "Payee", "Description", "Amount", "Type", ""].map(h => (
                <th key={h} style={{ padding: "14px 20px", textAlign: "left", color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "48px 20px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>No transactions match your filters. <button onClick={() => { setPropFilter("all"); setCatFilter("all"); setDateFilter("all"); setDateFrom(""); setDateTo(""); setSearch(""); setFilter("all"); }} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button></td></tr>
            )}
            {filtered.map((t, i) => (
              <tr key={t.id} ref={t.id === flashId ? highlightRef : undefined} style={{ borderTop: "1px solid #f1f5f9", background: t.id === flashId ? "#dbeafe" : i % 2 === 0 ? "#fff" : "#fafafa", transition: "background 1.5s ease" }}>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "#64748b" }}>{t.date}</td>
                <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{t.property.split(" ").slice(0, 2).join(" ")}</td>
                <td style={{ padding: "14px 20px" }}>
                  {(() => { const group = parentOf(t.category, t.type); return group && group !== t.category ? <p style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>{group}</p> : null; })()}
                  <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600, color: "#475569" }}>{t.category}</span>
                </td>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "#475569" }}>{t.payee || <span style={{ color: "#cbd5e1", fontStyle: "italic" }}>—</span>}</td>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "#0f172a" }}>{t.description}</td>
                <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 700, color: t.type === "income" ? "#15803d" : "#b91c1c" }}>
                  {t.type === "income" ? "+" : "-"}{fmt(Math.abs(t.amount))}
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{ background: t.type === "income" ? "#dcfce7" : "#fee2e2", color: t.type === "income" ? "#15803d" : "#b91c1c", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{t.type}</span>
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openEdit(t)} style={{ background: "#f1f5f9", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteConfirm(t)} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* ── Shared payee typeahead — rendered inside whichever modal is open ── */}
      {(showModal === "income" || showModal === "expense") && (() => {
        const isIncome = showModal === "income";
        const accentColor = isIncome ? "#15803d" : "#b91c1c";
        const accentBg    = isIncome ? "#f0fdf4"  : "#fef2f2";
        const accentBorder= isIncome ? "#bbf7d0"  : "#fecaca";
        const saveColor   = isIncome ? "#15803d"  : "#b91c1c";
        const payeeLabel  = isIncome ? "Received From" : "Payee";
        const payeePlaceholder = isIncome
          ? "e.g. Jordan Williams, Marcus Thompson"
          : "e.g. State Farm, Green Thumb Landscaping";
        const payeePool = isIncome ? allPayers : allPayees;

        const PayeeDropdown = () => {
          const q = form.payee.toLowerCase();
          const matches = q ? payeePool.filter(p => p.toLowerCase().includes(q) && p.toLowerCase() !== q) : (isIncome ? [] : payeePool);
          const exactExists = payeePool.some(p => p.toLowerCase() === q);
          const showNew = q && !exactExists;
          if (matches.length === 0 && !showNew) return null;
          return (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden" }}>
              {matches.slice(0, 6).map(p => (
                <button key={p} onMouseDown={() => { setForm(f => ({ ...f, payee: p })); setPayeeFocus(false); }}
                  style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", textAlign: "left", cursor: "pointer", fontSize: 13, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={13} style={{ color: "#94a3b8", flexShrink: 0 }} /> {p}
                </button>
              ))}
              {showNew && (
                <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "#f0f9ff", borderTop: matches.length > 0 ? "1px solid #e2e8f0" : "none" }}>
                  <PlusCircle size={13} style={{ color: "#3b82f6", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#3b82f6", fontWeight: 600 }}>Add "{form.payee}" as new</span>
                </div>
              )}
            </div>
          );
        };

        return (
          <Modal
            title={editId
              ? `Edit ${isIncome ? "Income" : "Expense"}`
              : isIncome ? "Log Income" : "Log Expense"}
            onClose={closeModal}
          >
            {/* Colored type badge at top */}
            <div style={{ background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: 10, padding: "8px 14px", marginBottom: 20, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: accentColor, display: "inline-block" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{isIncome ? "Income" : "Expense"}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Date</label>
                <input type="date" value={form.date} onChange={sf("date")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Amount ($)</label>
                <input type="number" placeholder="0.00" value={form.amount} onChange={sf("amount")} style={iS} />
              </div>

              {/* P&I Split for mortgage payments */}
              {["Mortgage Payment", "Mortgage"].includes(form.category) && form.amount && (() => {
                const prop = PROPERTIES.find(p => p.name === form.property);
                const amt = parseFloat(form.amount) || 0;
                const payDate = form.date || new Date().toISOString().split("T")[0];
                const autoInterest = prop ? calcPaymentInterest(prop.loanAmount, prop.loanRate, prop.loanTermYears, prop.loanStartDate, payDate) : null;
                const autoPrincipal = autoInterest !== null ? Math.max(0, Math.round(amt - autoInterest)) : null;
                const hasLoanTerms = prop && prop.loanAmount && prop.loanRate && prop.loanTermYears && prop.loanStartDate;
                return (
                  <div style={{ gridColumn: "1 / -1", background: "#f0f9ff", borderRadius: 10, padding: "12px 14px", border: "1px solid #bae6fd" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: form.piOverride ? 10 : 0 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#0c4a6e", marginBottom: 2 }}>Principal & Interest Split</p>
                        {hasLoanTerms && !form.piOverride ? (
                          <p style={{ fontSize: 12, color: "#475569" }}>
                            <span style={{ fontWeight: 700, color: "#3b82f6" }}>{fmt(autoPrincipal)}</span> principal + <span style={{ fontWeight: 700, color: "#f59e0b" }}>{fmt(autoInterest)}</span> interest
                            <span style={{ color: "#94a3b8", marginLeft: 6 }}>(auto from loan terms)</span>
                          </p>
                        ) : !hasLoanTerms && !form.piOverride ? (
                          <p style={{ fontSize: 12, color: "#94a3b8" }}>Add loan terms to this property for auto-calculation, or enter manually below</p>
                        ) : null}
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, piOverride: !f.piOverride, piPrincipal: f.piOverride ? "" : String(autoPrincipal ?? ""), piInterest: f.piOverride ? "" : String(autoInterest ?? "") }))} style={{ background: form.piOverride ? "#dbeafe" : "#fff", border: "1px solid #bae6fd", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "#3b82f6", cursor: "pointer", whiteSpace: "nowrap" }}>
                        {form.piOverride ? "Use Auto" : "Override"}
                      </button>
                    </div>
                    {form.piOverride && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ display: "block", color: "#3b82f6", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Principal ($)</label>
                          <input type="number" placeholder="0.00" value={form.piPrincipal} onChange={e => setForm(f => ({ ...f, piPrincipal: e.target.value }))} style={{ ...iS, fontSize: 13 }} />
                        </div>
                        <div>
                          <label style={{ display: "block", color: "#f59e0b", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Interest ($)</label>
                          <input type="number" placeholder="0.00" value={form.piInterest} onChange={e => setForm(f => ({ ...f, piInterest: e.target.value }))} style={{ ...iS, fontSize: 13 }} />
                        </div>
                        {form.piPrincipal && form.piInterest && Math.abs((parseFloat(form.piPrincipal) + parseFloat(form.piInterest)) - amt) > 1 && (
                          <p style={{ gridColumn: "1 / -1", fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>
                            P+I ({fmt(parseFloat(form.piPrincipal) + parseFloat(form.piInterest))}) doesn't match total ({fmt(amt)})
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Payee / Received From — typeahead */}
              <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {payeeLabel} {isIncome && <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span>}
                </label>
                <input
                  type="text"
                  placeholder={payeePlaceholder}
                  value={form.payee}
                  onChange={e => setForm(f => ({ ...f, payee: e.target.value }))}
                  onFocus={() => setPayeeFocus(true)}
                  onBlur={() => setTimeout(() => setPayeeFocus(false), 150)}
                  style={iS}
                  autoComplete="off"
                />
                {payeeFocus && <PayeeDropdown />}
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Description</label>
                <input type="text" placeholder="Brief description" value={form.description} onChange={sf("description")} style={iS} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Property</label>
                <select value={form.property} onChange={sf("property")} style={iS}>
                  {PROPERTIES.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Category</label>
                <select value={form.category} onChange={sf("category")} style={iS}>
                  {Object.entries(groupsForType(form.type)).map(([group, subs]) => (
                    <optgroup key={group} label={group}>
                      {subs.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: saveColor, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                {editId ? "Save Changes" : isIncome ? "Save Income" : "Save Expense"}
              </button>
            </div>
          </Modal>
        );
      })()}
      {deleteConfirm && (
        <Modal title="Delete Transaction" onClose={() => setDeleteConfirm(null)}>
          <p style={{ color: "#475569", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this transaction?</p>
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{deleteConfirm.description}</p>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{deleteConfirm.property} · {deleteConfirm.date} · <span style={{ color: deleteConfirm.type === "income" ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{deleteConfirm.type === "income" ? "+" : "-"}{fmt(Math.abs(deleteConfirm.amount))}</span></p>
          </div>
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { setTxData(prev => prev.filter(x => x.id !== deleteConfirm.id)); setDeleteConfirm(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Analytics() {
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
  const vacantUnits = TENANTS.filter(t => t.status === "vacant").length;
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
  }), []);

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

  const propTenants = selectedProp ? TENANTS.filter(t => t.propertyId === selectedProp.id) : [];

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
    const tenants = TENANTS.filter(t => t.propertyId === selectedProp.id);
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
        {up ? <ArrowUp size={12} color="#10b981" /> : <ArrowDown size={12} color="#ef4444" />}
        <span style={{ fontSize: 11, fontWeight: 700, color: up ? "#10b981" : "#ef4444" }}>{up ? "+" : ""}{val}{suffix}</span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>vs last year</span>
      </div>
    );
  };

  const cardS = { background: "#fff", borderRadius: 14, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" };
  const sectionS = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", marginBottom: 24 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Analytics &amp; Returns</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>
            {selectedProp ? `Performance details — ${selectedProp.name}` : "Detailed performance metrics for every property"}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <select value={selectedPropId} onChange={e => setSelectedPropId(e.target.value)} style={{ ...iS, width: "auto", minWidth: 220, fontSize: 13, padding: "9px 12px", fontWeight: 600 }}>
          <option value="">All Properties</option>
          {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selectedPropId && (
          <button onClick={() => setSelectedPropId("")} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filter
          </button>
        )}
      </div>

      {!selectedProp ? (
        /* ——— PORTFOLIO VIEW ——— */
        <>
          {/* KPI row with YoY indicators */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
            {[
              { label: "Total Annual NOI", value: fmt(portfolioNOI), color: "#10b981", yoy: yoyNOI, tip: "Net Operating Income = (Monthly Rent \u2212 Monthly Expenses) \u00d7 12, summed across all properties. Excludes debt service." },
              { label: "Portfolio Cap Rate", value: `${avgCapRate}%`, color: "#3b82f6", yoy: yoyCapRate, tip: "Average Cap Rate across all properties. Cap Rate = Annual NOI \u00f7 Current Property Value." },
              { label: "Avg Cash-on-Cash", value: `${avgCoC}%`, color: "#8b5cf6", yoy: yoyCoC, tip: "Average Cash-on-Cash return. CoC = (Annual NOI \u2212 Annual Debt Service) \u00f7 (Down Payment + Closing Costs). Down payment derived from Purchase Price \u2212 Loan Amount." },
            ].map((m, i) => (
              <div key={i} style={cardS}>
                <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                <p style={{ color: m.color, fontSize: 22, fontWeight: 800 }}>{m.value}</p>
                <YoY val={m.yoy} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Total Appreciation", value: fmt(totalAppreciation), color: "#f59e0b", yoy: yoyAppreciation, tip: "Sum of (Current Value \u2212 Purchase Price) across all properties. Values are manually updated by the owner." },
              { label: "Expense Ratio", value: `${portfolioExpenseRatio}%`, color: "#ef4444", desc: "Expenses / gross income", tip: "Total Monthly Expenses \u00f7 Total Monthly Rent \u00d7 100. Lower is better \u2014 under 40% is considered healthy." },
              { label: "Occupancy Rate", value: `${occupancyRate}%`, color: "#10b981", desc: `${totalUnits - vacantUnits} / ${totalUnits} units occupied`, tip: "Occupied Units \u00f7 Total Units \u00d7 100. Based on current tenant records." },
              { label: "DSCR", value: portfolioDSCR, color: "#3b82f6", desc: parseFloat(portfolioDSCR) >= 1.25 ? "Healthy coverage" : parseFloat(portfolioDSCR) >= 1.0 ? "Adequate" : "Below target", tip: "Debt Service Coverage Ratio = Annual NOI \u00f7 Annual Mortgage Payments. Above 1.25 is healthy; below 1.0 means income doesn\u2019t cover debt." },
            ].map((m, i) => (
              <div key={i} style={cardS}>
                <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                <p style={{ color: m.color, fontSize: 22, fontWeight: 800 }}>{m.value}</p>
                {m.yoy !== undefined ? <YoY val={m.yoy} /> : <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>{m.desc}</p>}
              </div>
            ))}
          </div>

          {/* Portfolio Income vs Expenses Trend */}
          <div style={sectionS}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Portfolio Cash Flow Trend</h3>
                <p style={{ color: "#94a3b8", fontSize: 13 }}>Income vs. expenses — trailing 12 months across all properties</p>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                {[
                  { label: "Avg Monthly Net", value: fmt(Math.round(portfolioMonthlyData.reduce((s, m) => s + m.net, 0) / 12)), color: "#10b981" },
                  { label: "Avg Expense Ratio", value: `${portfolioExpenseRatio}%`, color: "#f59e0b" },
                ].map((m, i) => (
                  <div key={i} style={{ textAlign: "right" }}>
                    <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{m.label}</p>
                    <p style={{ color: m.color, fontSize: 18, fontWeight: 800 }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={portfolioMonthlyData}>
                <defs>
                  <linearGradient id="pIncGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pExpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v, name) => [fmt(v), name === "income" ? "Income" : name === "expenses" ? "Expenses" : "Net"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
                <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2.5} fill="url(#pIncGrad)" name="income" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} fill="url(#pExpGrad)" name="expenses" />
                <Area type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" fill="none" name="net" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Property-by-Property — improved 3-column layout */}
          <div style={sectionS}>
            <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Property-by-Property Performance</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {PROPERTIES.map(p => {
                const pEff = getEffectiveMonthly(p, TRANSACTIONS);
                const annualRent = pEff.monthlyIncome * 12;
                const annualExpenses = pEff.monthlyExpenses * 12;
                const NOI = annualRent - annualExpenses;
                const coC = calcCashOnCash(p, TRANSACTIONS);
                const appreciation = ((p.currentValue - p.purchasePrice) / p.purchasePrice * 100).toFixed(1);
                const expRatio = pEff.monthlyIncome > 0 ? ((pEff.monthlyExpenses / pEff.monthlyIncome) * 100).toFixed(0) : "0";
                const propTen = TENANTS.filter(t => t.propertyId === p.id);
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
                  <div key={p.id} onClick={() => setSelectedPropId(String(p.id))} style={{ background: "#f8fafc", borderRadius: 14, padding: 20, border: `2px solid ${p.color}30`, cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = `${p.color}30`; e.currentTarget.style.transform = "translateY(0)"; }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>{p.image}</div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{p.name}</p>
                        <p style={{ fontSize: 11, color: "#94a3b8" }}>{p.type} · {p.units} unit{p.units > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Annual NOI", value: fmtK(NOI), color: "#10b981" },
                        { label: "Cap Rate", value: `${calcCapRate(p)}%`, color: "#3b82f6" },
                        { label: "Cash-on-Cash", value: `${coC}%`, color: "#8b5cf6" },
                        { label: "Appreciation", value: `+${appreciation}%`, color: "#f59e0b" },
                        { label: "Expense Ratio", value: `${expRatio}%`, color: "#ef4444" },
                        { label: "DSCR", value: pDSCR, color: "#3b82f6" },
                      ].map((m, i) => (
                        <div key={i}>
                          <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 1 }}>{m.label}</p>
                          <p style={{ color: m.color, fontSize: 15, fontWeight: 700 }}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>Occupancy</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, marginLeft: 12 }}>
                        <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${propOcc}%`, background: parseFloat(propOcc) >= 90 ? "#10b981" : parseFloat(propOcc) >= 70 ? "#f59e0b" : "#ef4444", borderRadius: 3, transition: "width 0.3s" }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", minWidth: 36, textAlign: "right" }}>{propOcc}%</span>
                      </div>
                    </div>
                    {isStale && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertCircle size={12} color="#f59e0b" />
                        <span style={{ fontSize: 11, color: "#b45309" }}>Stale value — last updated {daysSinceUpdate}d ago. Update property value to improve accuracy.</span>
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
              <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cap Rate Comparison</h3>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Annual net operating income / property value</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={PROPERTIES.map(p => ({ name: p.image, rate: calcCapRate(p), fill: p.color }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 12]} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, "Cap Rate"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                    {PROPERTIES.map((p, i) => <Cell key={i} fill={p.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={sectionS}>
              <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cash-on-Cash Return</h3>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Annual pre-tax cash flow / total cash invested</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={PROPERTIES.map(p => ({ name: p.image, coc: calcCashOnCash(p) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 14]} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, "CoC Return"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="coc" radius={[6, 6, 0, 0]} fill="#8b5cf6" />
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
              <div style={{ width: 38, height: 38, borderRadius: 10, background: selectedProp.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18 }}>{selectedProp.image}</div>
              <div>
                <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Return Scorecard</h3>
                <p style={{ color: "#94a3b8", fontSize: 13 }}>How this property stacks up against your portfolio</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
              {[
                {
                  label: "Cap Rate", value: `${calcCapRate(selectedProp, TRANSACTIONS)}%`,
                  sub: `Ranked ${rankLabel(capRateRank)} of ${PROPERTIES.length}`, color: "#3b82f6",
                  tip: "Cap Rate = Annual NOI \u00f7 Current Property Value. Measures return independent of financing.",
                },
                {
                  label: "Cash-on-Cash", value: `${calcCashOnCash(selectedProp, TRANSACTIONS)}%`,
                  sub: `Ranked ${rankLabel(cocRank)} of ${PROPERTIES.length}`, color: "#8b5cf6",
                  tip: "(Annual NOI \u2212 Annual Debt Service) \u00f7 (Down Payment + Closing Costs). Down payment = Purchase Price \u2212 Loan Amount.",
                },
                (() => {
                  const daysSince = selectedProp.valueUpdatedAt ? Math.round((new Date() - new Date(selectedProp.valueUpdatedAt)) / (1000*60*60*24)) : 999;
                  const stale = daysSince > 90;
                  return {
                    label: "Appreciation",
                    value: `+${((selectedProp.currentValue - selectedProp.purchasePrice) / selectedProp.purchasePrice * 100).toFixed(1)}%`,
                    sub: stale ? `${fmt(selectedProp.currentValue - selectedProp.purchasePrice)} gain · Value may be outdated` : `${fmt(selectedProp.currentValue - selectedProp.purchasePrice)} total gain`,
                    color: stale ? "#b45309" : "#f59e0b",
                    tip: `(Current Value − Purchase Price) ÷ Purchase Price. Based on a manually entered property value${selectedProp.valueUpdatedAt ? ` last updated ${daysAgo(selectedProp.valueUpdatedAt)}` : ""}. Edit the property to update.`,
                  };
                })(),
              ].map((m, i) => (
                <div key={i} style={{ background: "#f8fafc", borderRadius: 14, padding: "18px 16px", border: "1px solid #f1f5f9" }}>
                  <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                  <p style={{ color: m.color, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{m.value}</p>
                  <p style={{ color: "#94a3b8", fontSize: 11 }}>{m.sub}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                {
                  label: "Current Equity",
                  value: fmt(selectedProp.currentValue - (calcLoanBalance(selectedProp.loanAmount, selectedProp.loanRate, selectedProp.loanTermYears, selectedProp.loanStartDate) ?? selectedProp.loanAmount ?? 0)),
                  sub: "Value minus loan balance", color: "#10b981",
                  tip: "Current Property Value \u2212 Remaining Loan Balance. Loan balance is amortized from the original loan terms.",
                },
                {
                  label: "DSCR",
                  value: propDSCR,
                  sub: parseFloat(propDSCR) >= 1.25 ? "Healthy coverage" : parseFloat(propDSCR) >= 1.0 ? "Adequate" : "Below target",
                  color: parseFloat(propDSCR) >= 1.25 ? "#10b981" : parseFloat(propDSCR) >= 1.0 ? "#f59e0b" : "#ef4444",
                  tip: "Debt Service Coverage Ratio = Annual NOI \u00f7 Annual Mortgage Payments. Lenders typically want 1.25+.",
                },
                {
                  label: "Occupancy",
                  value: `${propOccupancy}%`,
                  sub: `${propTenants.filter(t => t.status !== "vacant").length} of ${propTenants.length || selectedProp.units} units`,
                  color: parseFloat(propOccupancy) >= 90 ? "#10b981" : parseFloat(propOccupancy) >= 70 ? "#f59e0b" : "#ef4444",
                  tip: "Occupied Units \u00f7 Total Units \u00d7 100. Based on current tenant lease status records.",
                },
              ].map((m, i) => (
                <div key={i} style={{ background: "#f8fafc", borderRadius: 14, padding: "18px 16px", border: "1px solid #f1f5f9" }}>
                  <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                  <p style={{ color: m.color, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{m.value}</p>
                  <p style={{ color: "#94a3b8", fontSize: 11 }}>{m.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Cash Flow Deep Dive */}
          <div style={{ ...sectionS, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Cash Flow Deep Dive</h3>
                <p style={{ color: "#94a3b8", fontSize: 13 }}>Income vs. expenses — trailing 12 months</p>
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                {[
                  { label: "Avg Monthly Net", value: fmt(Math.round(propMonthlyData.reduce((s, m) => s + m.net, 0) / 12)), color: "#10b981" },
                  { label: "Annual NOI", value: fmt((selectedPropEff.monthlyIncome - selectedPropEff.monthlyExpenses) * 12), color: "#3b82f6" },
                  { label: "Expense Ratio", value: `${((selectedPropEff.monthlyExpenses / selectedPropEff.monthlyIncome) * 100).toFixed(0)}%`, color: "#f59e0b" },
                ].map((m, i) => (
                  <div key={i} style={{ textAlign: "right" }}>
                    <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{m.label}</p>
                    <p style={{ color: m.color, fontSize: 20, fontWeight: 800 }}>{m.value}</p>
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
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v, name) => [fmt(v), name === "income" ? "Income" : "Expenses"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
                    <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2.5} fill="url(#incGrad)" name="income" />
                    <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} fill="url(#expGrad)" name="expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Annual Breakdown</p>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Income", value: selectedPropEff.monthlyIncome * 12 },
                        { name: "Expenses", value: selectedPropEff.monthlyExpenses * 12 },
                      ]}
                      cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {[
                    { label: "Annual Income", value: fmt(selectedPropEff.monthlyIncome * 12), color: "#10b981" },
                    { label: "Annual Expenses", value: fmt(selectedPropEff.monthlyExpenses * 12), color: "#ef4444" },
                    { label: "Net (NOI)", value: fmt((selectedPropEff.monthlyIncome - selectedPropEff.monthlyExpenses) * 12), color: "#3b82f6" },
                  ].map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#64748b" }}>{m.label}</span>
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
            <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Tenant Health Panel</h3>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Unit-by-unit lease and payment status</p>
            {propTenants.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: "40px 0" }}>No tenants on record for this property.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {propTenants.map(t => {
                  const scMap = { "active-lease": { bg: "#dcfce7", text: "#15803d" }, "month-to-month": { bg: "#fef9c3", text: "#854d0e" }, vacant: { bg: "#fee2e2", text: "#b91c1c" } };
                  const sc = scMap[t.status] || scMap["active-lease"];
                  const expiring = t.daysUntilExpiry !== null && t.daysUntilExpiry <= 60;
                  return (
                    <div key={t.id} style={{ background: "#f8fafc", borderRadius: 14, padding: 18, border: `1px solid ${expiring ? "#fde68a" : "#f1f5f9"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{t.unit || "Unit"}</p>
                          <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{t.status === "vacant" ? "No tenant" : t.name}</p>
                        </div>
                        <span style={{ background: sc.bg, color: sc.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{{ "active-lease": "Active Lease", "month-to-month": "Month-to-Month", vacant: "Vacant" }[t.status] || t.status}</span>
                      </div>
                      {t.status !== "vacant" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {[
                            { label: "Monthly Rent", value: fmt(t.rent), color: "#0f172a" },
                            { label: "Lease Ends", value: t.leaseEnd || "—", color: "#0f172a" },
                            { label: "Days Remaining", value: t.daysUntilExpiry !== null ? `${t.daysUntilExpiry}d ${expiring ? "⚠️" : "✓"}` : "—", color: expiring ? "#b45309" : "#15803d" },
                            { label: "Last Payment", value: t.lastPayment || "—", color: "#0f172a" },
                          ].map((row, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>{row.label}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: row.color }}>{row.value}</span>
                            </div>
                          ))}
                          {t.securityDeposit ? (
                            <div style={{ paddingTop: 8, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>Security Deposit</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{fmt(t.securityDeposit)}</span>
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

// ── REPORT EXPORT HELPERS ──
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function exportReportCSV(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear) {
  let csv = "";
  if (activeReport === "scheduleE") {
    csv = "Property,Line,Description,Amount\n";
    reportProps.forEach(p => {
      const { lines, grossRent, net } = calcPropLines(p);
      csv += `"${p.name}",3,Rents Received,${grossRent}\n`;
      Object.entries(lines).forEach(([line, amt]) => {
        const labels = { "5":"Advertising","6":"Auto & Travel","7":"Cleaning","9":"Insurance","10":"Legal","11":"Management","12":"Mortgage Interest","14":"Repairs","15":"Supplies","16":"Taxes","17":"Utilities","18":"Depreciation","19":"Other" };
        csv += `"${p.name}",${line},"${labels[line] || "Other"}",${Math.round(amt)}\n`;
      });
      csv += `"${p.name}",26,Net Income / (Loss),${Math.round(net)}\n`;
    });
  } else if (activeReport === "cashflow") {
    csv = "Month,Source,Income,Expenses,Net Cash Flow,Margin %\n";
    monthlyData.forEach(m => {
      const margin = m.income > 0 ? ((m.net / m.income) * 100).toFixed(1) : "0";
      csv += `${m.month},${m.isActual ? "Actual" : "Estimated"},${m.income},${m.expenses},${m.net},${margin}\n`;
    });
  } else if (activeReport === "depreciation") {
    csv = "Property,Placed in Service,Purchase Price,Depr Basis,Annual Deduction,Years Held,Cumulative,Remaining\n";
    deprRows.forEach(({ p, basis, annual, yearsHeld, cumul, remaining }) => {
      csv += `"${p.name}",${p.purchaseDate || ""},${p.purchasePrice},${basis},${annual},${yearsHeld},${cumul},${remaining}\n`;
    });
  } else if (activeReport === "lenderPackage") {
    csv = "Property,Annual NOI,Loan Balance,Current Value,Equity,Monthly DS,DSCR,LTV %\n";
    lenderData.forEach(({ p, noi, bal, mds, dscr, ltv, equity }) => {
      csv += `"${p.name}",${noi},${Math.round(bal)},${p.currentValue},${Math.round(equity)},${mds},${dscr ? dscr.toFixed(2) : ""},${ltv.toFixed(1)}\n`;
    });
  } else if (activeReport === "yearend") {
    csv = "Property,Annual Rent,Annual Expenses,Depreciation,Mortgage Interest (est),Net\n";
    reportProps.forEach(p => {
      const cEff = getEffectiveMonthly(p, TRANSACTIONS);
      const annRent = cEff.monthlyIncome * 12;
      const annExp = cEff.monthlyExpenses * 12;
      const yrs = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
      const depr = Math.round(p.purchasePrice * TAX_CONFIG.buildingValuePct / yrs);
      const bal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount || 0);
      const intEst = Math.round(bal * (p.loanRate || 4) / 100);
      csv += `"${p.name}",${annRent},${annExp},${depr},${intEst},${annRent - annExp - depr - intEst}\n`;
    });
  } else if (activeReport === "ownerStatement") {
    csv = "Type,Date,Description,Category,Amount\n";
    const p = reportProps[0];
    if (p) {
      const monthTx = TRANSACTIONS.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === new Date().getMonth() && d.getFullYear() === Number(taxYear) && t.property === p.name;
      });
      monthTx.forEach(t => { csv += `${t.type},${t.date},"${t.description}","${t.category}",${t.amount}\n`; });
    }
  } else if (activeReport === "transactions") {
    const reportPropNames = new Set(reportProps.map(p => p.name));
    const allTx = TRANSACTIONS.filter(t => reportPropNames.has(t.property));
    csv = "Date,Property,Category,Type,Description,Amount\n";
    allTx.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
      csv += `${t.date},"${t.property}","${t.category}",${t.type},"${t.description || t.vendor || ""}",${t.amount}\n`;
    });
  }
  downloadFile(csv, `RealVault_${activeReport}_${taxYear}.csv`, "text/csv");
}

function exportReportPDF(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear, propFilter) {
  // Build printable HTML and open in new window for browser print-to-PDF
  const reportNames = { scheduleE: "Schedule E", cashflow: "Cash Flow Report", ownerStatement: "Owner's Statement", lenderPackage: "Lender Package", depreciation: "Depreciation Schedule", yearend: "Year-End Summary" };
  let tableHTML = "";

  if (activeReport === "scheduleE") {
    reportProps.forEach(p => {
      const { lines, grossRent, totalExp, net, interestSource } = calcPropLines(p);
      tableHTML += `<h3>${p.name}</h3><p style="color:#888">${p.address}</p><table><tr><th>Line</th><th>Description</th><th style="text-align:right">Amount</th></tr>`;
      tableHTML += `<tr><td>3</td><td>Rents Received</td><td style="text-align:right;color:green">+$${grossRent.toLocaleString()}</td></tr>`;
      const labels = { "5":"Advertising","6":"Auto & Travel","7":"Cleaning","9":"Insurance","10":"Legal & Professional","11":"Management Fees","12":`Mortgage Interest (${interestSource})`,"14":"Repairs","15":"Supplies","16":"Taxes","17":"Utilities","18":"Depreciation (est.)","19":"Other" };
      Object.entries(lines).sort((a,b) => Number(a[0]) - Number(b[0])).forEach(([line, amt]) => {
        if (amt > 0) tableHTML += `<tr><td>${line}</td><td>${labels[line] || "Other"}</td><td style="text-align:right;color:#b91c1c">-$${Math.round(amt).toLocaleString()}</td></tr>`;
      });
      tableHTML += `<tr style="border-top:2px solid #333;font-weight:bold"><td colspan="2">Net Income / (Loss)</td><td style="text-align:right;color:${net >= 0 ? 'green' : '#b91c1c'}">${net >= 0 ? '' : '-'}$${Math.abs(Math.round(net)).toLocaleString()}</td></tr></table>`;
    });
  } else if (activeReport === "cashflow") {
    tableHTML = `<table><tr><th>Month</th><th>Source</th><th style="text-align:right">Income</th><th style="text-align:right">Expenses</th><th style="text-align:right">Net</th><th style="text-align:right">Margin</th></tr>`;
    monthlyData.forEach(m => {
      const margin = m.income > 0 ? ((m.net / m.income) * 100).toFixed(0) + "%" : "0%";
      tableHTML += `<tr><td>${m.month}</td><td>${m.isActual ? "Actual" : "Est."}</td><td style="text-align:right;color:green">+$${m.income.toLocaleString()}</td><td style="text-align:right;color:#b91c1c">-$${m.expenses.toLocaleString()}</td><td style="text-align:right;font-weight:bold">$${m.net.toLocaleString()}</td><td style="text-align:right">${margin}</td></tr>`;
    });
    tableHTML += `</table>`;
  } else if (activeReport === "depreciation") {
    tableHTML = `<table><tr><th>Property</th><th>In Service</th><th style="text-align:right">Purchase</th><th style="text-align:right">Basis</th><th style="text-align:right">Annual</th><th>Yrs Held</th><th style="text-align:right">Cumulative</th><th style="text-align:right">Remaining</th></tr>`;
    deprRows.forEach(({ p, basis, annual, yearsHeld, cumul, remaining }) => {
      tableHTML += `<tr><td>${p.name}</td><td>${p.purchaseDate || "—"}</td><td style="text-align:right">$${p.purchasePrice.toLocaleString()}</td><td style="text-align:right">$${basis.toLocaleString()}</td><td style="text-align:right">$${annual.toLocaleString()}</td><td>${yearsHeld}</td><td style="text-align:right">$${cumul.toLocaleString()}</td><td style="text-align:right">$${remaining.toLocaleString()}</td></tr>`;
    });
    tableHTML += `</table>`;
  } else if (activeReport === "lenderPackage") {
    tableHTML = `<table><tr><th>Property</th><th style="text-align:right">NOI</th><th style="text-align:right">Loan Bal</th><th style="text-align:right">Value</th><th style="text-align:right">Equity</th><th style="text-align:right">Mo DS</th><th style="text-align:right">DSCR</th><th style="text-align:right">LTV</th></tr>`;
    lenderData.forEach(({ p, noi, bal, mds, dscr, ltv, equity }) => {
      tableHTML += `<tr><td>${p.name}</td><td style="text-align:right">$${noi.toLocaleString()}</td><td style="text-align:right">$${Math.round(bal).toLocaleString()}</td><td style="text-align:right">$${p.currentValue.toLocaleString()}</td><td style="text-align:right">$${Math.round(equity).toLocaleString()}</td><td style="text-align:right">$${mds.toLocaleString()}</td><td style="text-align:right">${dscr ? dscr.toFixed(2) : "—"}</td><td style="text-align:right">${ltv.toFixed(1)}%</td></tr>`;
    });
    tableHTML += `</table>`;
  } else if (activeReport === "transactions") {
    const reportPropNames = new Set(reportProps.map(p => p.name));
    const allTx = TRANSACTIONS.filter(t => reportPropNames.has(t.property));
    allTx.sort((a, b) => new Date(b.date) - new Date(a.date));
    tableHTML = `<table><tr><th>Date</th><th>Property</th><th>Category</th><th>Type</th><th>Description</th><th style="text-align:right">Amount</th></tr>`;
    allTx.forEach(t => {
      const isIncome = t.type === "income";
      tableHTML += `<tr><td>${t.date}</td><td>${t.property}</td><td>${t.category}</td><td>${t.type}</td><td>${t.description || t.vendor || ""}</td><td style="text-align:right;color:${isIncome ? 'green' : '#b91c1c'}">${isIncome ? '+' : '-'}$${Math.abs(t.amount).toLocaleString()}</td></tr>`;
    });
    const totIn = allTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totOut = allTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    tableHTML += `<tr style="border-top:2px solid #333;font-weight:bold"><td colspan="5">Totals (${allTx.length} transactions)</td><td style="text-align:right">In: $${totIn.toLocaleString()} | Out: $${totOut.toLocaleString()}</td></tr></table>`;
  } else {
    tableHTML = `<p>Use your browser's print dialog to save as PDF.</p>`;
  }

  const reportNames2 = { ...reportNames, transactions: "Transaction Detail" };
  const isTaxRpt = ["scheduleE", "depreciation", "yearend"].includes(activeReport);
  const scopeLabel = propFilter === "all" ? "All Properties" : (reportProps[0]?.name || "");
  const html = `<!DOCTYPE html><html><head><title>RealVault — ${reportNames2[activeReport] || activeReport}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; color: #1e293b; }
    h1 { font-size: 22px; margin-bottom: 4px; } h2 { color: #64748b; font-size: 14px; font-weight: 400; margin-bottom: 24px; } h3 { margin-top: 28px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; } th, td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
    th { background: #f8fafc; font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 11px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; }
    @media print { body { margin: 20px; } }
  </style></head><body>
    <h1>${reportNames2[activeReport] || activeReport}</h1>
    <h2>${scopeLabel} · ${isTaxRpt ? 'Tax Year' : 'Year'} ${taxYear} · Generated ${new Date().toLocaleDateString()}</h2>
    ${tableHTML}
    <div class="footer">Generated by RealVault · For planning purposes only — consult your CPA before filing.</div>
  </body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

function Reports() {
  const [activeReport, setActiveReport] = useState("scheduleE");
  const [taxYear, setTaxYear] = useState(String(TAX_CONFIG.currentYear));
  const [propFilter, setPropFilter] = useState("all");
  const [ownerMonth, setOwnerMonth] = useState(new Date().getMonth());
  const [taxRate, setTaxRate] = useState(TAX_CONFIG.defaultBracket);
  const [txSearch, setTxSearch] = useState("");
  const [txCatFilter, setTxCatFilter] = useState("all");
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const [txSort, setTxSort] = useState("date-desc");
  const [txDateFrom, setTxDateFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [txDateTo, setTxDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [txDatePreset, setTxDatePreset] = useState("ytd");

  const reportProps = propFilter === "all" ? PROPERTIES : PROPERTIES.filter(p => p.id === Number(propFilter));
  const reportPropNames = new Set(reportProps.map(p => p.name));

  // IRS Schedule E line mapping keyed by transaction category
  const CAT_TO_LINE = {
    // Marketing (line 5)
    "Advertising & Marketing":  { line: "5",  label: "Advertising" },
    "Advertising":              { line: "5",  label: "Advertising" },
    "Listing Fees":             { line: "5",  label: "Advertising" },
    "Signage":                  { line: "5",  label: "Advertising" },
    // Auto & travel (line 6)
    "Travel & Mileage":         { line: "6",  label: "Auto & Travel" },
    // Cleaning (line 7)
    "Cleaning & Janitorial":    { line: "7",  label: "Cleaning & Maintenance" },
    "Cleaning":                 { line: "7",  label: "Cleaning & Maintenance" },
    // Insurance (line 9)
    "Insurance":                { line: "9",  label: "Insurance" },
    "Property Insurance":       { line: "9",  label: "Insurance" },
    "Liability Insurance":      { line: "9",  label: "Insurance" },
    "Flood Insurance":          { line: "9",  label: "Insurance" },
    // Legal & professional (line 10)
    "Legal & Professional Fees":{ line: "10", label: "Legal & Professional" },
    "Legal Fees":               { line: "10", label: "Legal & Professional" },
    "Accounting / CPA":         { line: "10", label: "Legal & Professional" },
    "Inspection Fees":          { line: "10", label: "Legal & Professional" },
    // Management (line 11)
    "Property Management":      { line: "11", label: "Management Fees" },
    "Management Fee":           { line: "11", label: "Management Fees" },
    "Leasing Fee":              { line: "11", label: "Management Fees" },
    // Mortgage (skip — handled via amortization)
    "Mortgage":                 { line: "skip", label: "" },
    "Mortgage Payment":         { line: "skip", label: "" },
    "Loan Interest":            { line: "skip", label: "" },
    "Refinance Costs":          { line: "skip", label: "" },
    // Repairs (line 14)
    "Repairs & Maintenance":    { line: "14", label: "Repairs" },
    "Maintenance":              { line: "14", label: "Repairs" },
    "Plumbing":                 { line: "14", label: "Repairs" },
    "Electrical":               { line: "14", label: "Repairs" },
    "HVAC":                     { line: "14", label: "Repairs" },
    "Appliance Repair":         { line: "14", label: "Repairs" },
    "Roof Repair":              { line: "14", label: "Repairs" },
    "General Maintenance":      { line: "14", label: "Repairs" },
    "Pest Control":             { line: "14", label: "Repairs" },
    "Landscaping":              { line: "14", label: "Repairs" },
    "Snow Removal":             { line: "14", label: "Repairs" },
    // Supplies (line 15)
    "Supplies & Materials":     { line: "15", label: "Supplies" },
    // Taxes (line 16)
    "Property Tax":             { line: "16", label: "Taxes" },
    "Tax Penalties":            { line: "16", label: "Taxes" },
    // Utilities (line 17)
    "Utilities":                { line: "17", label: "Utilities" },
    "Electric":                 { line: "17", label: "Utilities" },
    "Gas":                      { line: "17", label: "Utilities" },
    "Water / Sewer":            { line: "17", label: "Utilities" },
    "Trash":                    { line: "17", label: "Utilities" },
    "Internet / Cable":         { line: "17", label: "Utilities" },
    // Other (line 19)
    "HOA Fees":                 { line: "19", label: "Other" },
    "HOA / Condo Fees":         { line: "19", label: "Other" },
    "HOA Dues":                 { line: "19", label: "Other" },
    "Special Assessment":       { line: "19", label: "Other" },
    "Other Expenses":           { line: "19", label: "Other" },
    // Capital improvements (not deductible as expense — depreciated)
    "Capital Improvement":      { line: "cap", label: "" },
    "Kitchen Remodel":          { line: "cap", label: "" },
    "Bathroom Remodel":         { line: "cap", label: "" },
    "Flooring":                 { line: "cap", label: "" },
    "New Roof":                 { line: "cap", label: "" },
    "Other Capital":            { line: "cap", label: "" },
  };

  // Build per-property Schedule E lines from real transactions
  const calcPropLines = p => {
    const propTx = TRANSACTIONS.filter(t =>
      new Date(t.date).getFullYear() === Number(taxYear) && t.property === p.name && t.type === "expense"
    );
    const lines = {};
    propTx.forEach(t => {
      const m = CAT_TO_LINE[t.category];
      if (!m || m.line === "skip" || m.line === "cap") return;
      lines[m.line] = (lines[m.line] || 0) + Math.abs(t.amount);
    });

    // Line 12: Mortgage Interest — prefer stored P&I split from transactions, then amortization calc, then estimate
    const mortgageTx = TRANSACTIONS.filter(t =>
      new Date(t.date).getFullYear() === Number(taxYear) &&
      t.property === p.name &&
      (t.category === "Mortgage" || t.category === "Mortgage Payment")
    );
    let interestSource = "estimated";
    let totalPrincipal = 0;
    if (mortgageTx.length > 0) {
      lines["12"] = mortgageTx.reduce((s, t) => {
        // Use stored piInterest if available (user-entered or auto-calculated at save time), otherwise calc on the fly
        const interest = t.piInterest != null ? t.piInterest : (calcPaymentInterest(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate, t.date) ?? 0);
        return s + interest;
      }, 0);
      totalPrincipal = mortgageTx.reduce((s, t) => {
        const principal = t.piPrincipal != null ? t.piPrincipal : Math.max(0, Math.abs(t.amount) - (calcPaymentInterest(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate, t.date) ?? 0));
        return s + principal;
      }, 0);
      const hasOverrides = mortgageTx.some(t => t.piInterest != null);
      interestSource = hasOverrides ? `${mortgageTx.length} payment${mortgageTx.length > 1 ? "s" : ""} (P&I split)` : `${mortgageTx.length} payment${mortgageTx.length > 1 ? "s" : ""}`;
    } else {
      // Fallback: rough annual estimate from current balance × rate
      const bal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount || 0);
      lines["12"] = Math.round(bal * (p.loanRate || 4) / 100);
    }

    // Line 18: Depreciation — always estimated (no single transaction represents this)
    const deprYrs = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
    lines["18"] = Math.round(p.purchasePrice * TAX_CONFIG.buildingValuePct / deprYrs);

    const txIncome = TRANSACTIONS.filter(t =>
      new Date(t.date).getFullYear() === Number(taxYear) && t.property === p.name && t.type === "income"
    ).reduce((s, t) => s + t.amount, 0);
    const rEff = getEffectiveMonthly(p, TRANSACTIONS);
    const grossRent = txIncome > 0 ? txIncome : rEff.monthlyIncome * 12;
    const totalExp = Object.values(lines).reduce((s, v) => s + v, 0);
    const net = grossRent - totalExp;
    return { lines, grossRent, totalExp, net, hasActual: txIncome > 0, interestSource, totalPrincipal };
  };

  // Per-property calc (for year-end) — uses transaction-derived financials
  const calcProp = p => {
    const cEff = getEffectiveMonthly(p, TRANSACTIONS);
    const annRent = cEff.monthlyIncome * 12;
    const annExp = cEff.monthlyExpenses * 12;
    const depr = Math.round(p.purchasePrice * TAX_CONFIG.buildingValuePct / (p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential));
    const bal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount || 0);
    const intEst = Math.round(bal * (p.loanRate || 4) / 100);
    const net = annRent - annExp - depr - intEst;
    return { annRent, annExp, depr, intEst, net };
  };

  const totIncome   = reportProps.reduce((s, p) => s + calcProp(p).annRent, 0);
  const totExpenses = reportProps.reduce((s, p) => s + calcProp(p).annExp, 0);
  const totDepr     = reportProps.reduce((s, p) => s + calcProp(p).depr, 0);
  const totInt      = reportProps.reduce((s, p) => s + calcProp(p).intEst, 0);
  const totNet      = reportProps.reduce((s, p) => s + calcProp(p).net, 0);

  // Monthly cash flow — real transactions with estimated fallback
  const EXP_FACTORS = [1.0, 0.88, 1.15, 0.92, 1.05, 1.18, 0.97, 1.22, 0.89, 1.08, 1.30, 0.95];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthlyData = MONTHS.map((month, i) => {
    const monthTx = TRANSACTIONS.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === Number(taxYear) && d.getMonth() === i && reportPropNames.has(t.property);
    });
    if (monthTx.length > 0) {
      const income   = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expenses = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
      return { month, income, expenses, net: income - expenses, isActual: true };
    }
    const income   = reportProps.reduce((s, p) => s + getEffectiveMonthly(p, TRANSACTIONS).monthlyIncome, 0);
    const expenses = reportProps.reduce((s, p) => s + Math.round(getEffectiveMonthly(p, TRANSACTIONS).monthlyExpenses * EXP_FACTORS[i]), 0);
    return { month, income, expenses, net: income - expenses, isActual: false };
  });

  // Depreciation schedule
  const taxYearEnd = new Date(`${taxYear}-12-31`);
  const deprRows = reportProps.map(p => {
    const basis = Math.round(p.purchasePrice * TAX_CONFIG.buildingValuePct);
    const deprLife = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
    const annual = Math.round(basis / deprLife);
    const start = p.purchaseDate ? new Date(p.purchaseDate) : new Date("2020-01-01");
    const yearsHeld = Math.max(0, (taxYearEnd - start) / (365.25 * 86400000));
    const cumul = Math.min(basis, Math.round(annual * yearsHeld));
    return { p, basis, annual, deprLife, yearsHeld: yearsHeld.toFixed(1), cumul, remaining: basis - cumul };
  });

  // Lender package data
  const lenderData = reportProps.map(p => {
    const lEff = getEffectiveMonthly(p, TRANSACTIONS);
    const noi = (lEff.monthlyIncome - lEff.monthlyExpenses) * 12;
    const bal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount ?? 0);
    const r = (p.loanRate || 4) / 100 / 12;
    const n = (p.loanTermYears || 30) * 12;
    const mds = r > 0 ? Math.round(p.loanAmount * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1)) : 0;
    const annDebt = mds * 12;
    const dscr = annDebt > 0 ? (noi / annDebt) : null;
    const ltv = p.currentValue > 0 ? ((bal / p.currentValue) * 100) : 0;
    const equity = p.currentValue - bal;
    const capRate = p.currentValue > 0 ? (noi / p.currentValue * 100) : 0;
    const grm = lEff.monthlyIncome > 0 ? (p.currentValue / (lEff.monthlyIncome * 12)) : 0;
    const perUnit = p.units > 0 ? Math.round(p.currentValue / p.units) : p.currentValue;
    return { p, noi, bal, mds, annDebt, dscr, ltv, equity, capRate, grm, perUnit };
  });

  const taxReports = [
    { id: "scheduleE",     label: "Schedule E",           icon: FileText    },
    { id: "depreciation",  label: "Depreciation Schedule", icon: TrendingDown },
    { id: "yearend",       label: "Year-End Summary",      icon: Calendar    },
  ];
  const financialReports = [
    { id: "cashflow",      label: "Cash Flow",             icon: DollarSign  },
    { id: "ownerStatement",label: "Owner's Statement",     icon: Home        },
    { id: "lenderPackage", label: "Lender Package",        icon: Building2   },
    { id: "transactions",  label: "Transaction Detail",    icon: List        },
  ];
  const allReportTypes = [...taxReports, ...financialReports];
  const isTaxReport = taxReports.some(r => r.id === activeReport);

  const thStyle = { padding: "11px 16px", textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: "#f8fafc" };
  const tdStyle = { padding: "12px 16px", fontSize: 13, color: "#0f172a", borderTop: "1px solid #f1f5f9" };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Reports</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>Financial summaries, tax reports, and lender packages</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {activeReport !== "transactions" && (
            <select value={taxYear} onChange={e => setTaxYear(e.target.value)} style={{ ...iS, width: 110, fontWeight: 700 }}>
              {TAX_CONFIG.yearRange.slice().reverse().map(y => (
                <option key={y} value={String(y)}>{isTaxReport ? `TY ${y}` : String(y)}</option>
              ))}
            </select>
          )}
          <select value={propFilter} onChange={e => setPropFilter(e.target.value)} style={{ ...iS, width: 220 }}>
            <option value="all">All Properties</option>
            {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => exportReportCSV(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear)} style={{ background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={16} /> CSV
          </button>
          <button onClick={() => exportReportPDF(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear, propFilter)} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={16} /> PDF
          </button>
        </div>
      </div>

      {/* Portfolio Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
        {(() => {
          const allCalc = reportProps.map(p => calcPropLines(p));
          const tRent = allCalc.reduce((s, c) => s + c.grossRent, 0);
          const tExp  = allCalc.reduce((s, c) => s + c.totalExp, 0);
          const tNet  = allCalc.reduce((s, c) => s + c.net, 0);
          const tDepr = reportProps.reduce((s, p) => {
            const yrs = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
            return s + Math.round(p.purchasePrice * TAX_CONFIG.buildingValuePct / yrs);
          }, 0);
          const actualPct = Math.round((allCalc.filter(c => c.hasActual).length / Math.max(1, allCalc.length)) * 100);
          return [
            { label: "Gross Rental Income", value: fmt(tRent), color: "#15803d", bg: "#f0fdf4" },
            { label: "Total Expenses", value: fmt(tExp), color: "#b91c1c", bg: "#fef2f2" },
            { label: isTaxReport ? "Net Taxable Income" : "Net Operating Income", value: fmt(tNet), color: tNet >= 0 ? "#15803d" : "#b91c1c", bg: "#f0f9ff" },
            { label: isTaxReport ? "Annual Depreciation" : "Portfolio Properties", value: isTaxReport ? fmt(tDepr) : String(reportProps.length), color: isTaxReport ? "#8b5cf6" : "#8b5cf6", bg: "#f5f3ff" },
            { label: "Actual Data Coverage", value: `${actualPct}%`, color: "#3b82f6", bg: "#eff6ff" },
          ].map((m, i) => (
            <div key={i} style={{ background: m.bg, borderRadius: 14, padding: "14px 16px", border: "1px solid #f1f5f9" }}>
              <p style={{ color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{m.label}</p>
              <p style={{ color: m.color, fontSize: 20, fontWeight: 800 }}>{m.value}</p>
            </div>
          ));
        })()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
        {/* Sidebar nav */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", height: "fit-content" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 14px 4px" }}>Tax Reports</p>
          {taxReports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: activeReport === r.id ? "#eff6ff" : "transparent", color: activeReport === r.id ? "#3b82f6" : "#475569", fontWeight: activeReport === r.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
              <r.icon size={16} /> {r.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid #f1f5f9", margin: "8px 14px", paddingTop: 0 }} />
          <p style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 14px 4px" }}>Financial Reports</p>
          {financialReports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: activeReport === r.id ? "#eff6ff" : "transparent", color: activeReport === r.id ? "#3b82f6" : "#475569", fontWeight: activeReport === r.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
              <r.icon size={16} /> {r.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 12, paddingTop: 12 }}>
            <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", padding: "0 14px", marginBottom: 6 }}>Scope</p>
            <p style={{ fontSize: 12, color: "#475569", padding: "0 14px", fontWeight: 600 }}>{propFilter === "all" ? `All ${PROPERTIES.length} properties` : PROPERTIES.find(p => p.id === Number(propFilter))?.name}</p>
            <p style={{ fontSize: 12, color: "#94a3b8", padding: "0 14px" }}>{activeReport === "transactions" ? `${txDateFrom} – ${txDateTo}` : isTaxReport ? `Tax Year ${taxYear}` : `Year ${taxYear}`}</p>
          </div>
        </div>

        {/* Report content */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>

          {/* ── SCHEDULE E ── */}
          {activeReport === "scheduleE" && (
            <div>
              <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Schedule E — Supplemental Income &amp; Loss</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 24 }}>Tax Year {taxYear} · Part I: Income or Loss From Rental Real Estate</p>
              {reportProps.map(p => {
                const { lines, grossRent, totalExp, net, hasActual, interestSource } = calcPropLines(p);
                const lineOrder = [
                  { n: "3",  label: "Rents Received",         income: true },
                  { n: "5",  label: "Advertising" },
                  { n: "6",  label: "Auto & Travel" },
                  { n: "7",  label: "Cleaning & Maint." },
                  { n: "9",  label: "Insurance" },
                  { n: "10", label: "Legal & Prof." },
                  { n: "11", label: "Management Fees" },
                  { n: "12", label: `Mortgage Interest (${interestSource})` },
                  { n: "14", label: "Repairs" },
                  { n: "15", label: "Supplies" },
                  { n: "16", label: "Taxes" },
                  { n: "17", label: "Utilities" },
                  { n: "18", label: "Depreciation (est.)" },
                  { n: "19", label: "Other" },
                ];
                const filledLines = lineOrder.filter(l => l.income ? grossRent > 0 : (lines[l.n] || 0) > 0);
                return (
                  <div key={p.id} style={{ border: "1px solid #f1f5f9", borderRadius: 14, padding: 20, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>{p.image}</div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{p.name}</p>
                        <p style={{ fontSize: 12, color: "#94a3b8" }}>{p.address}</p>
                      </div>
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                        {hasActual && <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", borderRadius: 6, padding: "3px 8px", fontWeight: 700 }}>Actual Data</span>}
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 11, color: "#94a3b8" }}>Net Income / (Loss)</p>
                          <p style={{ fontSize: 17, fontWeight: 800, color: net >= 0 ? "#15803d" : "#b91c1c" }}>{net >= 0 ? "" : "-"}{fmt(Math.abs(net))}</p>
                        </div>
                      </div>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ ...thStyle, borderRadius: "6px 0 0 0" }}>Line</th>
                          <th style={thStyle}>Description</th>
                          <th style={{ ...thStyle, textAlign: "right", borderRadius: "0 6px 0 0" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filledLines.map((l, i) => {
                          const val = l.income ? grossRent : (lines[l.n] || 0);
                          return (
                            <tr key={l.n} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                              <td style={{ ...tdStyle, color: "#94a3b8", fontWeight: 700, width: 50 }}>{l.n}</td>
                              <td style={{ ...tdStyle, color: "#475569" }}>{l.label}</td>
                              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: l.income ? "#15803d" : "#b91c1c" }}>
                                {l.income ? "+" : "-"}{fmt(val)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: "#f0f9ff", borderTop: "2px solid #bae6fd" }}>
                          <td style={{ ...tdStyle, fontWeight: 800, color: "#0c4a6e" }} colSpan={2}>26. Total Expenses &amp; Net Income / (Loss)</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, fontSize: 15, color: net >= 0 ? "#15803d" : "#b91c1c" }}>
                            {net >= 0 ? "+" : "-"}{fmt(Math.abs(net))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
              <div style={{ background: "#f0f9ff", borderRadius: 14, padding: 20, border: "1px solid #bae6fd" }}>
                <h3 style={{ color: "#0c4a6e", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Portfolio Totals</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                  {(() => {
                    const allCalc = reportProps.map(p => calcPropLines(p));
                    const tRent = allCalc.reduce((s, c) => s + c.grossRent, 0);
                    const tExp  = allCalc.reduce((s, c) => s + c.totalExp, 0);
                    const tNet  = allCalc.reduce((s, c) => s + c.net, 0);
                    return [
                      { label: "Total Gross Rents", value: fmt(tRent), color: "#15803d" },
                      { label: "Total Expenses (incl. depr.)", value: `-${fmt(tExp)}`, color: "#b91c1c" },
                      { label: "Net Taxable Rental Income", value: fmt(tNet), color: tNet >= 0 ? "#15803d" : "#b91c1c" },
                      { label: "Total Depreciation", value: `-${fmt(reportProps.reduce((s, p) => s + Math.round(p.purchasePrice*0.8/(p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential)), 0))}`, color: "#b91c1c" },
                      { label: "Mortgage Interest (est.)", value: `-${fmt(reportProps.reduce((s, p) => { const b = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount||0); return s + Math.round(b*(p.loanRate||4)/100); }, 0))}`, color: "#b91c1c" },
                      { label: "Est. Tax Liability @ 28%", value: tNet > 0 ? `-${fmt(Math.round(tNet * 0.28))}` : "$0", color: "#b91c1c" },
                    ].map((m, i) => (
                      <div key={i} style={{ background: "#fff", borderRadius: 10, padding: "12px 16px" }}>
                        <p style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}</p>
                        <p style={{ color: m.color, fontSize: 16, fontWeight: 800 }}>{m.value}</p>
                      </div>
                    ));
                  })()}
                </div>
                <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 14 }}>⚠️ Estimates for planning only. Mortgage interest is estimated from outstanding loan balance. Consult your CPA before filing.</p>
              </div>
            </div>
          )}

          {/* ── CASH FLOW REPORT ── */}
          {activeReport === "cashflow" && (
            <div>
              <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Cash Flow Report</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 6 }}>{taxYear} · Monthly income and expense detail</p>
              <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "#10b981", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "#475569" }}>Income</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "#ef4444", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "#475569" }}>Expenses</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "#3b82f6", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "#475569" }}>Net Cash Flow</span>
                </div>
              </div>

              {/* Cash Flow Bar Chart */}
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: "20px 16px 10px", marginBottom: 24, border: "1px solid #f1f5f9" }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v, name) => [`$${v.toLocaleString()}`, name]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }} />
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name="Net" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Month</th>
                      <th style={thStyle}>Source</th>
                      <th style={{ ...thStyle, color: "#15803d" }}>Income</th>
                      <th style={{ ...thStyle, color: "#b91c1c" }}>Expenses</th>
                      <th style={{ ...thStyle, color: "#3b82f6" }}>Net Cash Flow</th>
                      <th style={thStyle}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m, i) => {
                      const margin = m.income > 0 ? ((m.net / m.income) * 100).toFixed(0) : 0;
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{m.month}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 8px", background: m.isActual ? "#dcfce7" : "#f1f5f9", color: m.isActual ? "#15803d" : "#94a3b8" }}>
                              {m.isActual ? "Actual" : "Est."}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: "#15803d", fontWeight: 600 }}>+{fmt(m.income)}</td>
                          <td style={{ ...tdStyle, color: "#b91c1c" }}>-{fmt(m.expenses)}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: m.net >= 0 ? "#15803d" : "#b91c1c" }}>{m.net >= 0 ? "+" : ""}{fmt(m.net)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, Number(margin)))}%`, background: Number(margin) >= 30 ? "#10b981" : Number(margin) >= 10 ? "#f59e0b" : "#ef4444", borderRadius: 99 }} />
                              </div>
                              <span style={{ fontSize: 12, color: "#64748b", width: 34, textAlign: "right" }}>{margin}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f0f9ff", borderTop: "2px solid #bae6fd" }}>
                      <td style={{ ...tdStyle, fontWeight: 800, color: "#0c4a6e" }}>Full Year</td>
                      <td style={tdStyle} />
                      <td style={{ ...tdStyle, fontWeight: 800, color: "#15803d" }}>+{fmt(monthlyData.reduce((s, m) => s + m.income, 0))}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: "#b91c1c" }}>-{fmt(monthlyData.reduce((s, m) => s + m.expenses, 0))}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: "#15803d" }}>{fmt(monthlyData.reduce((s, m) => s + m.net, 0))}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#0c4a6e" }}>{((monthlyData.reduce((s, m) => s + m.net, 0) / Math.max(1, monthlyData.reduce((s, m) => s + m.income, 0))) * 100).toFixed(0)}% avg</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── OWNER'S STATEMENT ── */}
          {activeReport === "ownerStatement" && (
            <div>
              <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Owner's Statement</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Monthly P&amp;L summary per property — select a property and month to generate</p>
              {propFilter === "all" ? (
                <div style={{ background: "#f8fafc", borderRadius: 14, padding: 40, textAlign: "center", border: "1px dashed #cbd5e1" }}>
                  <Home size={36} style={{ color: "#cbd5e1", marginBottom: 12 }} />
                  <p style={{ color: "#475569", fontWeight: 600, marginBottom: 6 }}>Select a Property to Generate Owner's Statement</p>
                  <p style={{ color: "#94a3b8", fontSize: 13 }}>Use the property dropdown above to filter to a single property.</p>
                </div>
              ) : (() => {
                const p = reportProps[0];
                const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
                const monthTx = TRANSACTIONS.filter(t => {
                  const d = new Date(t.date);
                  return d.getMonth() === ownerMonth && d.getFullYear() === Number(taxYear) && t.property === p.name;
                });
                const income   = monthTx.filter(t => t.type === "income");
                const expenses = monthTx.filter(t => t.type === "expense");
                const totalIn  = income.reduce((s, t) => s + t.amount, 0);
                const totalOut = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
                const net      = totalIn - totalOut;
                const hasData  = monthTx.length > 0;
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{p.image}</div>
                      <div>
                        <p style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{p.name}</p>
                        <p style={{ color: "#94a3b8", fontSize: 13 }}>{p.address}</p>
                      </div>
                      <div style={{ marginLeft: "auto" }}>
                        <select value={ownerMonth} onChange={e => setOwnerMonth(Number(e.target.value))} style={{ ...iS, width: 160 }}>
                          {MONTH_NAMES.map((mn, i) => <option key={i} value={i}>{mn} {taxYear}</option>)}
                        </select>
                      </div>
                    </div>

                    {!hasData ? (
                      <div style={{ background: "#fef9c3", borderRadius: 12, padding: "14px 18px", border: "1px solid #fde68a", marginBottom: 20 }}>
                        <p style={{ color: "#854d0e", fontSize: 13, fontWeight: 600 }}>No transactions logged for {MONTH_NAMES[ownerMonth]} {taxYear}. Add transactions to see actual data here.</p>
                      </div>
                    ) : null}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                      {[
                        { label: "Total Income", value: fmt(totalIn), color: "#15803d", bg: "#f0fdf4" },
                        { label: "Total Expenses", value: fmt(totalOut), color: "#b91c1c", bg: "#fef2f2" },
                        { label: "Net Operating Income", value: fmt(net), color: net >= 0 ? "#15803d" : "#b91c1c", bg: "#f0f9ff" },
                      ].map((kpi, i) => (
                        <div key={i} style={{ background: kpi.bg, borderRadius: 12, padding: "16px 18px" }}>
                          <p style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>{kpi.label}</p>
                          <p style={{ color: kpi.color, fontSize: 22, fontWeight: 800 }}>{kpi.value}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Income</p>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <tbody>
                            {income.length > 0 ? income.map((t, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "8px 0", fontSize: 13, color: "#0f172a" }}>
                                  <div>{t.description}</div>
                                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.date}</div>
                                </td>
                                <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 700, color: "#15803d", textAlign: "right" }}>+{fmt(t.amount)}</td>
                              </tr>
                            )) : (
                              <tr><td colSpan={2} style={{ padding: "12px 0", color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>No income recorded</td></tr>
                            )}
                            <tr style={{ borderTop: "2px solid #e2e8f0" }}>
                              <td style={{ padding: "10px 0", fontWeight: 700, fontSize: 13 }}>Total Income</td>
                              <td style={{ padding: "10px 0", fontWeight: 800, color: "#15803d", textAlign: "right" }}>+{fmt(totalIn)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Expenses</p>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <tbody>
                            {expenses.length > 0 ? expenses.map((t, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "8px 0", fontSize: 13, color: "#0f172a" }}>
                                  <div>{t.description}</div>
                                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.category} · {t.date}</div>
                                </td>
                                <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 600, color: "#b91c1c", textAlign: "right" }}>-{fmt(Math.abs(t.amount))}</td>
                              </tr>
                            )) : (
                              <tr><td colSpan={2} style={{ padding: "12px 0", color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>No expenses recorded</td></tr>
                            )}
                            <tr style={{ borderTop: "2px solid #e2e8f0" }}>
                              <td style={{ padding: "10px 0", fontWeight: 700, fontSize: 13 }}>Total Expenses</td>
                              <td style={{ padding: "10px 0", fontWeight: 800, color: "#b91c1c", textAlign: "right" }}>-{fmt(totalOut)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* NOI + Management Fee + Distribution breakdown */}
                    {(() => {
                      const mgmtTx = expenses.filter(t => ["Property Management", "Management Fee", "Leasing Fee"].includes(t.category));
                      const mgmtFee = mgmtTx.reduce((s, t) => s + Math.abs(t.amount), 0);
                      const mortgageTx = expenses.filter(t => ["Mortgage", "Mortgage Payment"].includes(t.category));
                      const mortgageAmt = mortgageTx.reduce((s, t) => s + Math.abs(t.amount), 0);
                      const ownerDist = net - mgmtFee;
                      return (
                        <div style={{ marginTop: 20 }}>
                          <div style={{ background: net >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: "12px 12px 0 0", padding: "14px 20px", border: `1px solid ${net >= 0 ? "#bbf7d0" : "#fecaca"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>Net Operating Income — {MONTH_NAMES[ownerMonth]} {taxYear}</p>
                            <p style={{ fontWeight: 800, fontSize: 20, color: net >= 0 ? "#15803d" : "#b91c1c" }}>{net >= 0 ? "+" : "-"}{fmt(Math.abs(net))}</p>
                          </div>
                          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", padding: "14px 20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{ fontSize: 13, color: "#475569" }}>Less: Management Fee{mgmtFee === 0 ? " (none logged)" : ""}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>{mgmtFee > 0 ? `-${fmt(mgmtFee)}` : "$0"}</span>
                            </div>
                            {mortgageAmt > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                                <span style={{ fontSize: 13, color: "#475569" }}>Less: Mortgage Payment (P&I)</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>-{fmt(mortgageAmt)}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ background: "#eff6ff", borderRadius: "0 0 12px 12px", padding: "14px 20px", border: "1px solid #bfdbfe", borderTop: "2px solid #3b82f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: "#1e40af" }}>Owner Distribution</p>
                            <p style={{ fontWeight: 800, fontSize: 20, color: ownerDist - mortgageAmt >= 0 ? "#1e40af" : "#b91c1c" }}>{fmt(ownerDist - mortgageAmt)}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── LENDER PACKAGE ── */}
          {activeReport === "lenderPackage" && (
            <div>
              <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Lender / Refinance Package</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 24 }}>Key metrics lenders evaluate — NOI, DSCR, LTV, equity, and debt service</p>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
                <thead>
                  <tr>
                    {["Property","Annual NOI","Value","$/Unit","Equity","Cap Rate","GRM","Mo DS","DSCR","LTV"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lenderData.map(({ p, noi, bal, mds, dscr, ltv, equity, capRate, grm, perUnit }, i) => {
                    const dscrColor = dscr === null ? "#94a3b8" : dscr >= 1.25 ? "#15803d" : dscr >= 1.0 ? "#d97706" : "#b91c1c";
                    const dscrBg   = dscr === null ? "#f8fafc" : dscr >= 1.25 ? "#dcfce7" : dscr >= 1.0 ? "#fef9c3" : "#fee2e2";
                    const ltvColor = ltv < 70 ? "#15803d" : ltv < 80 ? "#d97706" : "#b91c1c";
                    const capColor = capRate >= 6 ? "#15803d" : capRate >= 4 ? "#d97706" : "#b91c1c";
                    return (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{p.image}</div>
                            {p.name.split(" ").slice(0, 2).join(" ")}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, color: noi >= 0 ? "#15803d" : "#b91c1c", fontWeight: 600 }}>{fmt(noi)}</td>
                        <td style={tdStyle}>{fmt(p.currentValue)}</td>
                        <td style={{ ...tdStyle, fontSize: 12 }}>{fmt(perUnit)}</td>
                        <td style={{ ...tdStyle, color: equity >= 0 ? "#15803d" : "#b91c1c", fontWeight: 600 }}>{fmt(equity)}</td>
                        <td style={tdStyle}><span style={{ color: capColor, fontWeight: 700 }}>{capRate.toFixed(1)}%</span></td>
                        <td style={{ ...tdStyle, fontSize: 12 }}>{grm > 0 ? `${grm.toFixed(1)}x` : "—"}</td>
                        <td style={tdStyle}>{mds > 0 ? fmt(mds) : "—"}</td>
                        <td style={tdStyle}>
                          <span style={{ background: dscrBg, color: dscrColor, fontWeight: 700, fontSize: 13, borderRadius: 7, padding: "4px 10px" }}>
                            {dscr !== null ? dscr.toFixed(2) : "—"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: ltvColor, fontWeight: 700 }}>{ltv.toFixed(1)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f0f9ff", borderTop: "2px solid #bae6fd" }}>
                    <td style={{ ...tdStyle, fontWeight: 800, color: "#0c4a6e" }}>Portfolio Total</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: "#15803d" }}>{fmt(lenderData.reduce((s, d) => s + d.noi, 0))}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(lenderData.reduce((s, d) => s + d.p.currentValue, 0))}</td>
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, fontWeight: 800, color: "#15803d" }}>{fmt(lenderData.reduce((s, d) => s + d.equity, 0))}</td>
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(lenderData.reduce((s, d) => s + d.mds, 0))}</td>
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                  </tr>
                </tfoot>
              </table>

              {/* DSCR Guide */}
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: 18, border: "1px solid #e2e8f0" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>DSCR Reference Guide</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                  {[
                    { label: "Strong — Lender Favorable", range: "≥ 1.25", bg: "#dcfce7", color: "#15803d", note: "Most lenders approve at this threshold. Strong cash coverage." },
                    { label: "Marginal — Borderline", range: "1.00 – 1.24", bg: "#fef9c3", color: "#d97706", note: "Debt is covered but thin. Some lenders require reserves or higher rates." },
                    { label: "Negative Coverage", range: "< 1.00", bg: "#fee2e2", color: "#b91c1c", note: "Property cash flow doesn't cover debt. Refinance may be difficult." },
                  ].map((g, i) => (
                    <div key={i} style={{ background: g.bg, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: g.color }}>{g.label}</p>
                        <span style={{ fontSize: 14, fontWeight: 800, color: g.color }}>{g.range}</span>
                      </div>
                      <p style={{ fontSize: 11, color: "#475569" }}>{g.note}</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "#94a3b8" }}>DSCR = Net Operating Income ÷ Annual Debt Service. LTV = Outstanding Loan Balance ÷ Current Property Value. Loan balances estimated via amortization formula.</p>
              </div>
            </div>
          )}

          {/* ── DEPRECIATION SCHEDULE ── */}
          {activeReport === "depreciation" && (
            <div>
              <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Depreciation Schedule</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 6 }}>Tax Year {taxYear} · IRS MACRS — Residential ({TAX_CONFIG.depreciationResidential} yr) &amp; Commercial ({TAX_CONFIG.depreciationCommercial} yr), straight-line</p>
              <p style={{ color: "#64748b", fontSize: 12, marginBottom: 24 }}>Land value excluded at {TAX_CONFIG.landValuePct * 100}% of purchase price. Depreciable basis = {TAX_CONFIG.buildingValuePct * 100}% of purchase price.</p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Property", "Placed in Service", "Purchase Price", "Depr. Basis (80%)", "Life", "Annual Deduction", "Yrs Held", "Cumul. Taken", "Remaining Basis"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deprRows.map(({ p, basis, annual, yearsHeld, cumul, remaining, deprLife }, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{p.image}</div>
                          {p.name.split(" ").slice(0, 2).join(" ")}
                        </div>
                      </td>
                      <td style={tdStyle}>{p.purchaseDate || "—"}</td>
                      <td style={tdStyle}>{fmt(p.purchasePrice)}</td>
                      <td style={{ ...tdStyle, color: "#8b5cf6", fontWeight: 600 }}>{fmt(basis)}</td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>{deprLife} yr</td>
                      <td style={{ ...tdStyle, color: "#b91c1c", fontWeight: 700 }}>-{fmt(annual)}</td>
                      <td style={tdStyle}>{yearsHeld} yrs</td>
                      <td style={{ ...tdStyle, color: "#b91c1c" }}>-{fmt(cumul)}</td>
                      <td style={{ ...tdStyle, color: "#0f172a", fontWeight: 600 }}>{fmt(remaining)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f0f9ff", borderTop: "2px solid #bae6fd" }}>
                    <td colSpan={5} style={{ ...tdStyle, fontWeight: 800, color: "#0c4a6e" }}>Portfolio Total</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: "#b91c1c" }}>-{fmt(deprRows.reduce((s, r) => s + r.annual, 0))}</td>
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#b91c1c" }}>-{fmt(deprRows.reduce((s, r) => s + r.cumul, 0))}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(deprRows.reduce((s, r) => s + r.remaining, 0))}</td>
                  </tr>
                </tfoot>
              </table>
              <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 16px", marginTop: 20 }}>
                <p style={{ fontSize: 12, color: "#854d0e" }}>⚠️ Depreciation recapture at {TAX_CONFIG.recaptureRate * 100}% applies if you sell. Buildings placed in service mid-year use the mid-month convention for the first year. Consult your CPA for the exact first-year deduction.</p>
              </div>
            </div>
          )}

          {/* ── YEAR-END SUMMARY ── */}
          {activeReport === "yearend" && (() => {
            // Pull actual other income (late fees, pet fees, app fees) from transactions
            const otherIncomeTx = TRANSACTIONS.filter(t =>
              new Date(t.date).getFullYear() === Number(taxYear) && t.type === "income" && reportPropNames.has(t.property)
              && !["Rent", "Rent Payment", "Monthly Rent"].includes(t.category)
            );
            const otherIncome = otherIncomeTx.reduce((s, t) => s + t.amount, 0);

            // Pull actual property tax from transactions
            const propTaxTx = TRANSACTIONS.filter(t =>
              new Date(t.date).getFullYear() === Number(taxYear) && reportPropNames.has(t.property)
              && (t.category === "Property Tax" || t.category === "Tax Penalties")
            );
            const propTaxActual = propTaxTx.reduce((s, t) => s + Math.abs(t.amount), 0);
            const propTaxHasActual = propTaxTx.length > 0;

            // Use calcPropLines for accurate P&I split across all properties
            const allPropCalc = reportProps.map(p => calcPropLines(p));
            const actualInterest = allPropCalc.reduce((s, c) => s + (c.lines["12"] || 0), 0);
            const actualPrincipal = allPropCalc.reduce((s, c) => s + (c.totalPrincipal || 0), 0);
            const hasMortgageTx = allPropCalc.some(c => c.interestSource !== "estimated");

            const totalGross = totIncome + otherIncome;
            const totalDeductions = totExpenses + actualInterest + totDepr;
            const rate = taxRate / 100;

            return (
            <div>
              <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Year-End Tax Summary</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 24 }}>Tax Year {taxYear} · Full rental P&amp;L for your records and CPA</p>

              {/* Income section */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Income</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      { label: "Gross Rents Received", value: totIncome },
                      { label: otherIncome > 0 ? `Other Income (late fees, deposits, etc.)` : "Other Income", value: otherIncome, note: otherIncome === 0 ? "No non-rent income transactions logged" : null },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 0", fontSize: 14, color: "#0f172a" }}>{row.label}{row.note && <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: 8 }}>({row.note})</span>}</td>
                        <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 700, color: "#15803d", textAlign: "right" }}>+{fmt(row.value)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Total Gross Income</td>
                      <td style={{ padding: "10px 0", fontSize: 15, fontWeight: 800, color: "#15803d", textAlign: "right" }}>+{fmt(totalGross)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Deductions section */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Deductible Expenses</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      { label: "Operating Expenses (repairs, insurance, mgmt, etc.)", value: totExpenses },
                      { label: hasMortgageTx ? "Mortgage Interest — Line 12 (from P&I split)" : "Mortgage Interest — Line 12 (est.)", value: actualInterest },
                      ...(hasMortgageTx && actualPrincipal > 0 ? [{ label: "Mortgage Principal (not deductible — equity building)", value: actualPrincipal, isInfo: true }] : []),
                      { label: `Depreciation — straight-line`, value: totDepr },
                      { label: propTaxHasActual ? "Property Taxes (from transactions)" : "Property Taxes (no transactions logged)", value: propTaxActual, note: !propTaxHasActual },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: row.isInfo ? "#f8fafc" : "transparent" }}>
                        <td style={{ padding: "10px 0", fontSize: row.isInfo ? 13 : 14, color: row.isInfo ? "#64748b" : "#0f172a", paddingLeft: row.isInfo ? 16 : 0 }}>
                          {row.label}
                          {row.note && <span style={{ color: "#f59e0b", fontSize: 12, marginLeft: 8 }}>— log property tax payments for accuracy</span>}
                        </td>
                        <td style={{ padding: "10px 0", fontSize: row.isInfo ? 13 : 14, fontWeight: 600, color: row.isInfo ? "#94a3b8" : "#b91c1c", textAlign: "right" }}>{row.isInfo ? fmt(row.value) : `-${fmt(row.value)}`}</td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Total Deductions</td>
                      <td style={{ padding: "10px 0", fontSize: 15, fontWeight: 800, color: "#b91c1c", textAlign: "right" }}>-{fmt(totalDeductions)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bottom line */}
              <div style={{ background: totNet >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 14, padding: 20, border: `1px solid ${totNet >= 0 ? "#bbf7d0" : "#fecaca"}`, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Net Taxable Rental Income</p>
                  <p style={{ fontSize: 24, fontWeight: 800, color: totNet >= 0 ? "#15803d" : "#b91c1c" }}>{totNet >= 0 ? "" : "-"}{fmt(Math.abs(totNet))}</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
                  <div style={{ background: "#fff", borderRadius: 10, padding: "12px 14px" }}>
                    <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Marginal Tax Rate</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <select value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 15, fontWeight: 800, color: "#475569", cursor: "pointer" }}>
                        {TAX_CONFIG.brackets.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                  </div>
                  {[
                    { label: `Est. Federal Tax @ ${taxRate}%`, value: totNet > 0 ? `-${fmt(Math.round(totNet * rate))}` : "No liability", color: "#b91c1c" },
                    { label: "Net After Est. Taxes", value: fmt(totNet - Math.max(0, Math.round(totNet * rate))), color: "#15803d" },
                    { label: "Effective Rate", value: totNet > 0 ? `${((Math.round(totNet * rate) / totalGross) * 100).toFixed(1)}%` : "N/A", color: "#475569" },
                  ].map((m, i) => (
                    <div key={i} style={{ background: "#fff", borderRadius: 10, padding: "12px 14px" }}>
                      <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}</p>
                      <p style={{ color: m.color, fontSize: 15, fontWeight: 800 }}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>⚠️ Estimates for planning only — does not account for the {TAX_CONFIG.qbiDeductionPct * 100}% QBI deduction (Sec. 199A), passive activity loss rules, or state taxes. Please consult your CPA before filing.</p>
            </div>
            );
          })()}

          {/* ── TRANSACTION DETAIL ── */}
          {activeReport === "transactions" && (() => {
            // Date range presets helper
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

            // All transactions for date range + selected properties
            const fromDate = new Date(txDateFrom + "T00:00:00");
            const toDate = new Date(txDateTo + "T23:59:59");
            const allTx = TRANSACTIONS.filter(t => {
              const d = new Date(t.date);
              return d >= fromDate && d <= toDate && reportPropNames.has(t.property);
            });

            // Unique categories
            const categories = [...new Set(allTx.map(t => t.category))].sort();

            // Apply filters
            let filtered = allTx;
            if (txTypeFilter !== "all") filtered = filtered.filter(t => t.type === txTypeFilter);
            if (txCatFilter !== "all") filtered = filtered.filter(t => t.category === txCatFilter);
            if (txSearch.trim()) {
              const q = txSearch.toLowerCase();
              filtered = filtered.filter(t =>
                (t.description || "").toLowerCase().includes(q) ||
                (t.category || "").toLowerCase().includes(q) ||
                (t.property || "").toLowerCase().includes(q) ||
                (t.vendor || "").toLowerCase().includes(q)
              );
            }

            // Sort
            const sorted = [...filtered].sort((a, b) => {
              if (txSort === "date-desc") return new Date(b.date) - new Date(a.date);
              if (txSort === "date-asc") return new Date(a.date) - new Date(b.date);
              if (txSort === "amount-desc") return Math.abs(b.amount) - Math.abs(a.amount);
              if (txSort === "amount-asc") return Math.abs(a.amount) - Math.abs(b.amount);
              if (txSort === "property") return (a.property || "").localeCompare(b.property || "");
              if (txSort === "category") return (a.category || "").localeCompare(b.category || "");
              return 0;
            });

            // Summary stats
            const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
            const totalExpenses = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
            const netFlow = totalIncome - totalExpenses;

            // Category breakdown
            const catBreakdown = {};
            filtered.forEach(t => {
              const cat = t.category || "Uncategorized";
              if (!catBreakdown[cat]) catBreakdown[cat] = { income: 0, expense: 0, count: 0 };
              catBreakdown[cat].count++;
              if (t.type === "income") catBreakdown[cat].income += t.amount;
              else catBreakdown[cat].expense += Math.abs(t.amount);
            });
            const catRows = Object.entries(catBreakdown).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense));

            return (
            <div>
              <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Transaction Detail</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>All transactions for selected date range · Filter by property, type, or category</p>

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
                  <button key={p.id} onClick={() => applyPreset(p.id)} style={{ padding: "7px 14px", borderRadius: 8, border: txDatePreset === p.id ? "2px solid #3b82f6" : "1px solid #e2e8f0", background: txDatePreset === p.id ? "#eff6ff" : "#fff", color: txDatePreset === p.id ? "#3b82f6" : "#475569", fontWeight: txDatePreset === p.id ? 700 : 500, fontSize: 12, cursor: "pointer" }}>
                    {p.label}
                  </button>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                  <input type="date" value={txDateFrom} onChange={e => { setTxDateFrom(e.target.value); setTxDatePreset("custom"); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, color: "#0f172a" }} />
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>to</span>
                  <input type="date" value={txDateTo} onChange={e => { setTxDateTo(e.target.value); setTxDatePreset("custom"); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, color: "#0f172a" }} />
                </div>
              </div>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
                {[
                  { label: "Total Income", value: `+${fmt(totalIncome)}`, color: "#15803d", bg: "#f0fdf4" },
                  { label: "Total Expenses", value: `-${fmt(totalExpenses)}`, color: "#b91c1c", bg: "#fef2f2" },
                  { label: "Net Cash Flow", value: `${netFlow >= 0 ? "+" : ""}${fmt(netFlow)}`, color: netFlow >= 0 ? "#15803d" : "#b91c1c", bg: "#f0f9ff" },
                  { label: "Transactions", value: `${filtered.length}`, color: "#3b82f6", bg: "#eff6ff" },
                ].map((m, i) => (
                  <div key={i} style={{ background: m.bg, borderRadius: 14, padding: "14px 16px", border: "1px solid #f1f5f9" }}>
                    <p style={{ color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{m.label}</p>
                    <p style={{ color: m.color, fontSize: 20, fontWeight: 800 }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                  <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search description, vendor, property..." style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, color: "#0f172a", outline: "none" }} />
                </div>
                <select value={txTypeFilter} onChange={e => setTxTypeFilter(e.target.value)} style={{ ...iS, width: 130 }}>
                  <option value="all">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expenses</option>
                </select>
                <select value={txCatFilter} onChange={e => setTxCatFilter(e.target.value)} style={{ ...iS, width: 200 }}>
                  <option value="all">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={txSort} onChange={e => setTxSort(e.target.value)} style={{ ...iS, width: 160 }}>
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Largest Amount</option>
                  <option value="amount-asc">Smallest Amount</option>
                  <option value="property">By Property</option>
                  <option value="category">By Category</option>
                </select>
              </div>

              {/* Transaction table */}
              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr>
                      {["Date", "Property", "Category", "Description", "Type", "Amount"].map(h => (
                        <th key={h} style={{ ...thStyle, textAlign: h === "Amount" ? "right" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>No transactions match your filters</td></tr>
                    ) : sorted.slice(0, 200).map((t, i) => {
                      const isIncome = t.type === "income";
                      return (
                        <tr key={t.id || i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ ...tdStyle, fontSize: 12, whiteSpace: "nowrap" }}>{new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>
                            <span style={{ fontWeight: 600 }}>{(t.property || "").split(" ").slice(0, 2).join(" ")}</span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 8px", background: isIncome ? "#dcfce7" : "#fee2e2", color: isIncome ? "#15803d" : "#b91c1c" }}>{t.category}</span>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12, color: "#475569", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description || t.vendor || "—"}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: isIncome ? "#15803d" : "#b91c1c" }}>{t.type}</span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: isIncome ? "#15803d" : "#b91c1c", whiteSpace: "nowrap" }}>
                            {isIncome ? "+" : "-"}{fmt(Math.abs(t.amount))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {sorted.length > 0 && (
                    <tfoot>
                      <tr style={{ background: "#f0f9ff", borderTop: "2px solid #bae6fd" }}>
                        <td colSpan={5} style={{ ...tdStyle, fontWeight: 800, color: "#0c4a6e" }}>
                          {sorted.length > 200 ? `Showing 200 of ${sorted.length}` : `${sorted.length} transaction${sorted.length !== 1 ? "s" : ""}`}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: netFlow >= 0 ? "#15803d" : "#b91c1c" }}>
                          {netFlow >= 0 ? "+" : ""}{fmt(netFlow)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Category Breakdown */}
              {catRows.length > 0 && (
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Category Breakdown</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                    {catRows.map(([cat, data]) => {
                      const total = data.income + data.expense;
                      const isIncomeCat = data.income > data.expense;
                      return (
                        <div key={cat} style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", border: "1px solid #f1f5f9" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{cat}</p>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "#f1f5f9", borderRadius: 6, padding: "2px 6px" }}>{data.count}</span>
                          </div>
                          {data.income > 0 && <p style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>+{fmt(data.income)}</p>}
                          {data.expense > 0 && <p style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>-{fmt(data.expense)}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------
// FLIP COMPONENTS
// ---------------------------------------------

function StageBadge({ stage }) {
  const s = STAGE_COLORS[stage] || { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {stage}
    </span>
  );
}

function RehabProgress({ items }) {
  const totalBudget = items.reduce((s, i) => s + i.budgeted, 0);
  const totalSpent = items.reduce((s, i) => s + i.spent, 0);
  const pct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const over = totalSpent > totalBudget;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{pct}% complete</span>
        <span style={{ fontSize: 13, color: over ? "#b91c1c" : "#64748b", fontWeight: over ? 700 : 400 }}>
          {fmt(totalSpent)} / {fmt(totalBudget)} {over && "(!) Over budget"}
        </span>
      </div>
      <div style={{ height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: over ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#10b981", borderRadius: 99, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function FlipCard({ flip, onSelect }) {
  const s = STAGE_COLORS[flip.stage];
  const totalCost = flip.purchasePrice + flip.rehabBudget + (flip.holdingCostsPerMonth * (flip.daysOwned / 30));
  const projectedProfit = flip.arv - totalCost - (flip.arv * 0.06);
  const mao70 = (flip.arv * 0.70) - flip.rehabBudget;
  const rehabPct = flip.rehabBudget > 0 ? Math.round((flip.rehabSpent / flip.rehabBudget) * 100) : 0;

  return (
    <div onClick={() => onSelect(flip)}
      style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: flip.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800 }}>{flip.image}</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{flip.name}</p>
            <p style={{ fontSize: 11, color: "#94a3b8" }}>{flip.address.split(",")[1]?.trim()}</p>
          </div>
        </div>
        <StageBadge stage={flip.stage} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Purchase", value: fmtK(flip.purchasePrice) },
          { label: "ARV", value: fmtK(flip.arv) },
          { label: flip.stage === "Sold" ? "Net Profit" : "Proj. Profit", value: flip.stage === "Sold" ? fmt(flip.netProfit) : fmtK(Math.round(projectedProfit)), color: "#10b981" },
        ].map((m, i) => (
          <div key={i} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{m.label}</p>
            <p style={{ color: m.color || "#0f172a", fontSize: 13, fontWeight: 700 }}>{m.value}</p>
          </div>
        ))}
      </div>

      {flip.stage !== "Sold" && flip.stage !== "Under Contract" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>REHAB PROGRESS</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>{rehabPct}%</span>
          </div>
          <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${rehabPct}%`, background: rehabPct >= 80 ? "#10b981" : "#f59e0b", borderRadius: 99 }} />
          </div>
        </div>
      )}

      {flip.stage === "Under Contract" && (
        <p style={{ fontSize: 12, color: "#8b5cf6", fontWeight: 600 }}>
          <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
          Closing {flip.projectedCloseDate}
        </p>
      )}

      {flip.daysOwned > 0 && (
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
          <Clock size={11} style={{ display: "inline", marginRight: 3 }} />
          Day {flip.daysOwned} of hold
        </p>
      )}
    </div>
  );
}

function FlipPipeline({ onSelect }) {
  const [activeStage, setActiveStage] = useState("all");
  const [showAddDeal, setShowAddDeal] = useState(false);
  const emptyDeal = { name: "", address: "", purchasePrice: "", arv: "", rehabBudget: "", holdingCostsPerMonth: "", stage: "Under Contract", acquisitionDate: "", projectedCloseDate: "" };
  const [dealForm, setDealForm] = useState(emptyDeal);
  const sfD = k => e => setDealForm(f => ({ ...f, [k]: e.target.value }));
  const [, forceRender] = useState(0);

  const handleSaveDeal = () => {
    if (!dealForm.name || !dealForm.purchasePrice) return;
    const initials = dealForm.name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
    const colors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#ec4899"];
    const color = colors[FLIPS.length % colors.length];
    const newDeal = {
      id: newId(), name: dealForm.name, address: dealForm.address || "",
      stage: dealForm.stage, image: initials, color,
      purchasePrice: parseFloat(dealForm.purchasePrice) || 0,
      arv: parseFloat(dealForm.arv) || 0,
      rehabBudget: parseFloat(dealForm.rehabBudget) || 0,
      rehabSpent: 0,
      holdingCostsPerMonth: parseFloat(dealForm.holdingCostsPerMonth) || 0,
      acquisitionDate: dealForm.acquisitionDate || "",
      projectedCloseDate: dealForm.projectedCloseDate || "",
      daysOwned: 0,
      rehabItems: [],
    };
    FLIPS.push(newDeal);
    // Auto-populate milestones for the new deal
    FLIP_MILESTONES[newDeal.id] = DEFAULT_MILESTONES.map(label => ({ label, done: false, date: null, targetDate: null }));
    setDealForm(emptyDeal);
    setShowAddDeal(false);
    forceRender(n => n + 1);
  };

  const activeFlips = FLIPS.filter(f => f.stage !== "Sold");
  const totalDeployed = activeFlips.reduce((s, f) => s + f.purchasePrice + f.rehabSpent, 0);
  const projectedProfits = FLIPS.filter(f => f.stage !== "Sold").map(f => {
    const totalCost = f.purchasePrice + f.rehabBudget + (f.holdingCostsPerMonth * (f.daysOwned / 30));
    return f.arv - totalCost - (f.arv * 0.06);
  });
  const totalProjected = projectedProfits.reduce((s, v) => s + v, 0);
  const realizedProfit = FLIPS.filter(f => f.stage === "Sold").reduce((s, f) => s + (f.netProfit || 0), 0);

  const filtered = activeStage === "all" ? FLIPS : FLIPS.filter(f => f.stage === activeStage);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Deals</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>Track every flip from contract to close</p>
        </div>
        <button onClick={() => setShowAddDeal(true)} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Add Flip Deal
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { icon: Hammer, label: "Active Deals", value: activeFlips.length, sub: "In pipeline", color: "#f59e0b" },
          { icon: DollarSign, label: "Capital Deployed", value: fmtK(totalDeployed), sub: "Purchase + rehab", color: "#3b82f6" },
          { icon: TrendingUp, label: "Projected Profit", value: fmtK(Math.round(totalProjected)), sub: "Active deals", color: "#10b981" },
          { icon: Star, label: "Realized Profit", value: fmt(realizedProfit), sub: "Closed deals YTD", color: "#8b5cf6" },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{m.label}</p>
                <p style={{ color: "#0f172a", fontSize: 24, fontWeight: 800 }}>{m.value}</p>
                {m.sub && <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{m.sub}</p>}
              </div>
              <div style={{ background: m.color + "18", borderRadius: 10, padding: 10 }}>
                <m.icon size={20} color={m.color} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "#f8fafc", borderRadius: 10, padding: 4, border: "1px solid #e2e8f0" }}>
          {["all", ...STAGE_ORDER].map(s => {
            const active = activeStage === s;
            return (
              <button key={s} onClick={() => setActiveStage(s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active ? "#f59e0b" : "transparent", color: active ? "#fff" : "#64748b", fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {s === "all" ? `All (${FLIPS.length})` : `${s} (${FLIPS.filter(f => f.stage === s).length})`}
              </button>
            );
          })}
        </div>
        {activeStage !== "all" && (
          <button onClick={() => setActiveStage("all")} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filter
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
        {filtered.map(f => <FlipCard key={f.id} flip={f} onSelect={onSelect} />)}
      </div>

      {showAddDeal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: 520, maxHeight: "90vh", overflow: "auto", padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: "#0f172a", fontSize: 20, fontWeight: 700 }}>Add Flip Deal</h2>
              <button onClick={() => { setShowAddDeal(false); setDealForm(emptyDeal); }} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color="#64748b" /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Deal Name *</label>
                <input value={dealForm.name} onChange={sfD("name")} placeholder="e.g. Oakdale Craftsman" style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Address</label>
                <input value={dealForm.address} onChange={sfD("address")} placeholder="1234 Main St, Nashville, TN 37206" style={iS} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Purchase Price *</label>
                  <input value={dealForm.purchasePrice} onChange={sfD("purchasePrice")} type="number" placeholder="195000" style={iS} />
                </div>
                <div>
                  <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>ARV (After Repair Value)</label>
                  <input value={dealForm.arv} onChange={sfD("arv")} type="number" placeholder="310000" style={iS} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Rehab Budget</label>
                  <input value={dealForm.rehabBudget} onChange={sfD("rehabBudget")} type="number" placeholder="62000" style={iS} />
                </div>
                <div>
                  <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Holding Costs / Month</label>
                  <input value={dealForm.holdingCostsPerMonth} onChange={sfD("holdingCostsPerMonth")} type="number" placeholder="1850" style={iS} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Stage</label>
                  <select value={dealForm.stage} onChange={sfD("stage")} style={iS}>
                    {STAGE_ORDER.filter(s => s !== "Sold").map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Acquisition Date</label>
                  <input value={dealForm.acquisitionDate} onChange={sfD("acquisitionDate")} type="date" style={iS} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Projected Close Date</label>
                <input value={dealForm.projectedCloseDate} onChange={sfD("projectedCloseDate")} type="date" style={iS} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button onClick={() => { setShowAddDeal(false); setDealForm(emptyDeal); }} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSaveDeal} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: (!dealForm.name || !dealForm.purchasePrice) ? 0.5 : 1 }}>Add Deal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FlipDetail({ flip, onBack, allFlips, setAllFlips, onNavigateToExpense }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showContractorModal, setShowContractorModal] = useState(false);
  const [expData, setExpData] = useState(FLIP_EXPENSES.filter(e => e.flipId === flip.id));
  const [conData, setConData] = useState(CONTRACTORS.filter(c => c.flipId === flip.id));
  const [rehabItems, setRehabItems] = useState(flip.rehabItems || []);
  const [milestones, setMilestones] = useState(FLIP_MILESTONES[flip.id] || DEFAULT_MILESTONES.map(label => ({ label, done: false, date: null, targetDate: null })));
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showCompletedMilestones, setShowCompletedMilestones] = useState(false);
  const emptyMilestone = { label: "", targetDate: "", date: "" };
  const [milestoneForm, setMilestoneForm] = useState(emptyMilestone);
  const sfM = k => e => setMilestoneForm(f => ({ ...f, [k]: e.target.value }));
  const [editingMilestoneId, setEditingMilestoneId] = useState(null); // index when editing
  const [showAddRehab, setShowAddRehab] = useState(false);
  const emptyRehab = { category: "", budgeted: "", spent: "0", status: "pending", photos: [] };
  const [rehabForm, setRehabForm] = useState(emptyRehab);
  const sfR = k => e => setRehabForm(f => ({ ...f, [k]: e.target.value }));
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: "expense"|"contractor"|"rehab"|"milestone", item, index? }
  const [stage, setStage] = useState(flip.stage);

  // Expense tab filters
  const [expSearch, setExpSearch] = useState("");
  const [expCatFilter, setExpCatFilter] = useState("all");
  const [expDateFilter, setExpDateFilter] = useState("all");
  const [expDateFrom, setExpDateFrom] = useState("");
  const [expDateTo, setExpDateTo] = useState("");

  // Deal notes
  const [dealNotes, setDealNotes] = useState(() => {
    // Seed a couple demo notes for flip 1
    if (flip.id === 1) return [
      { id: newId(), date: "2026-03-28", text: "Spoke with inspector — back wall needs structural review before drywall. Getting quote from Nash Drywall." },
      { id: newId(), date: "2026-03-15", text: "ABC Plumbing delayed 1 week on master bath rough-in. Pushed flooring start to 3/21." },
      { id: newId(), date: "2026-02-10", text: "Demo went smooth. Dumpster picked up, ready for rough-in next week." },
    ];
    if (flip.id === 2) return [
      { id: newId(), date: "2026-01-20", text: "All rehab complete. Scheduling photographer for listing photos this week." },
    ];
    return [];
  });
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const addNote = () => {
    if (!noteText.trim()) return;
    setDealNotes(prev => [{ id: newId(), date: today, text: noteText.trim() }, ...prev]);
    setNoteText("");
    setShowNoteInput(false);
  };

  // Edit deal state
  const [showEditDeal, setShowEditDeal] = useState(false);
  const [dealEditForm, setDealEditForm] = useState({});
  const sfD = k => e => setDealEditForm(f => ({ ...f, [k]: e.target.value }));
  const openEditDeal = () => {
    setDealEditForm({
      name: flip.name || "", address: flip.address || "",
      purchasePrice: String(flip.purchasePrice || ""), arv: String(flip.arv || ""),
      rehabBudget: String(flip.rehabBudget || ""), holdingCostsPerMonth: String(flip.holdingCostsPerMonth || ""),
      acquisitionDate: flip.acquisitionDate || flip.contractDate || "",
      rehabStartDate: flip.rehabStartDate || "", rehabEndDate: flip.rehabEndDate || "",
      listDate: flip.listDate || "", projectedListDate: flip.projectedListDate || "",
      closeDate: flip.closeDate || "", projectedCloseDate: flip.projectedCloseDate || "",
      salePrice: String(flip.salePrice || ""),
    });
    setShowEditDeal(true);
  };
  const handleSaveDeal = () => {
    if (!dealEditForm.name) return;
    const updated = {
      ...flip, name: dealEditForm.name, address: dealEditForm.address,
      purchasePrice: parseFloat(dealEditForm.purchasePrice) || 0,
      arv: parseFloat(dealEditForm.arv) || 0,
      rehabBudget: parseFloat(dealEditForm.rehabBudget) || 0,
      holdingCostsPerMonth: parseFloat(dealEditForm.holdingCostsPerMonth) || 0,
      acquisitionDate: dealEditForm.acquisitionDate, rehabStartDate: dealEditForm.rehabStartDate,
      rehabEndDate: dealEditForm.rehabEndDate, listDate: dealEditForm.listDate,
      projectedListDate: dealEditForm.projectedListDate, closeDate: dealEditForm.closeDate,
      projectedCloseDate: dealEditForm.projectedCloseDate,
      salePrice: parseFloat(dealEditForm.salePrice) || 0,
    };
    // Update the global FLIPS array directly
    const idx = FLIPS.findIndex(f => f.id === flip.id);
    if (idx !== -1) Object.assign(FLIPS[idx], updated);
    if (setAllFlips) setAllFlips(prev => prev.map(f => f.id === flip.id ? { ...f, ...updated } : f));
    setShowEditDeal(false);
  };

  // Expense edit state
  const emptyExp = { date: "", vendor: "", category: "Materials & Supplies", description: "", amount: "", status: "paid", contractorId: "" };
  const [expForm, setExpForm] = useState(emptyExp);
  const sfE = k => e => setExpForm(f => ({ ...f, [k]: e.target.value }));
  const [editingExpId, setEditingExpId] = useState(null);
  const [vendorFocus, setVendorFocus] = useState(false);
  const allVendors = [...new Set(expData.map(e => e.vendor).filter(Boolean))].sort();
  const openEditExp = (e) => {
    setEditingExpId(e.id);
    setExpForm({ date: e.date, vendor: e.vendor, category: e.category, description: e.description, amount: String(e.amount), status: e.status || "paid", contractorId: e.contractorId || "" });
    setShowExpenseModal(true);
  };

  // Contractor edit state
  const emptyCon = { name: "", trade: "", paymentType: "Fixed Bid", totalBid: "", dayRate: "", phone: "", status: "pending" };
  const [conForm, setConForm] = useState(emptyCon);
  const sfC = k => e => setConForm(f => ({ ...f, [k]: e.target.value }));
  const [editingConId, setEditingConId] = useState(null);
  const openEditCon = (c) => {
    setEditingConId(c.id);
    setConForm({ name: c.name, trade: c.trade, paymentType: c.paymentType, totalBid: String(c.totalBid || ""), dayRate: String(c.dayRate || ""), phone: c.phone, status: c.status });
    setShowContractorModal(true);
  };

  // Contractor payment state
  const [showPaymentModal, setShowPaymentModal] = useState(null); // contractor id
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentNote, setPaymentNote] = useState("");
  const handleRecordPayment = () => {
    if (!paymentAmount || !showPaymentModal) return;
    const amt = parseFloat(paymentAmount) || 0;
    // Update contractor totalPaid
    setConData(prev => prev.map(c => c.id === showPaymentModal ? { ...c, totalPaid: (c.totalPaid || 0) + amt } : c));
    // Also log as an expense automatically (linked to contractor)
    const con = conData.find(c => c.id === showPaymentModal);
    if (con) {
      setExpData(prev => [{ id: newId(), flipId: flip.id, date: paymentDate, vendor: con.name, category: con.trade === "General Contractor" ? "General Contractor" : "Subcontractor", description: paymentNote || `Payment to ${con.name}`, amount: amt, status: "paid", contractorId: showPaymentModal }, ...prev]);
    }
    // Add to activity log
    if (con) setDealNotes(prev => [{ id: newId(), date: paymentDate, text: `Recorded ${fmt(amt)} payment to ${con.name}` }, ...prev]);
    setShowPaymentModal(null);
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
  };

  // Rehab edit state
  const [editingRehabIdx, setEditingRehabIdx] = useState(null);
  const openEditRehab = (item, idx) => {
    setEditingRehabIdx(idx);
    setRehabForm({ category: item.category, budgeted: String(item.budgeted), spent: String(item.spent), status: item.status, photos: item.photos || [] });
    setShowAddRehab(true);
  };

  const openEditMilestone = (m, idx) => {
    setEditingMilestoneId(idx);
    setMilestoneForm({ label: m.label, targetDate: m.targetDate || "", date: m.date || "" });
    setShowMilestoneModal(true);
  };
  const handleSaveMilestone = () => {
    if (!milestoneForm.label.trim()) return;
    if (editingMilestoneId !== null) {
      setMilestones(prev => prev.map((item, idx) => idx === editingMilestoneId ? { ...item, label: milestoneForm.label.trim(), targetDate: milestoneForm.targetDate || null, date: milestoneForm.date || item.date, done: milestoneForm.date ? true : item.done } : item));
      setEditingMilestoneId(null);
    } else {
      setMilestones(prev => [...prev, { label: milestoneForm.label.trim(), done: false, date: null, targetDate: milestoneForm.targetDate || null }]);
    }
    setMilestoneForm(emptyMilestone);
    setShowMilestoneModal(false);
  };

  const handleSaveExp = () => {
    if (!expForm.amount) return;
    const parsed = { date: expForm.date || new Date().toISOString().split("T")[0], vendor: expForm.vendor || "Unknown", category: expForm.category, description: expForm.description, amount: parseFloat(expForm.amount) || 0, status: expForm.status || "paid", contractorId: expForm.contractorId || null };
    if (editingExpId) {
      setExpData(prev => prev.map(e => e.id === editingExpId ? { ...e, ...parsed } : e));
      setEditingExpId(null);
    } else {
      setExpData(prev => [{ id: newId(), flipId: flip.id, ...parsed }, ...prev]);
    }
    setExpForm(emptyExp);
    setShowExpenseModal(false);
  };

  const handleSaveCon = () => {
    if (!conForm.name) return;
    if (editingConId) {
      setConData(prev => prev.map(c => c.id === editingConId ? { ...c, name: conForm.name, trade: conForm.trade, paymentType: conForm.paymentType, totalBid: parseFloat(conForm.totalBid) || 0, dayRate: parseFloat(conForm.dayRate) || 0, status: conForm.status, phone: conForm.phone } : c));
      setEditingConId(null);
    } else {
      setConData(prev => [...prev, { id: newId(), flipId: flip.id, name: conForm.name, trade: conForm.trade, paymentType: conForm.paymentType, totalBid: parseFloat(conForm.totalBid) || 0, dayRate: parseFloat(conForm.dayRate) || 0, totalPaid: 0, status: conForm.status, phone: conForm.phone }]);
    }
    setConForm(emptyCon);
    setShowContractorModal(false);
  };

  const handleStageChange = (e) => {
    const newStage = e.target.value;
    setStage(newStage);
    if (setAllFlips) setAllFlips(prev => prev.map(f => f.id === flip.id ? { ...f, stage: newStage } : f));
  };

  const cycleRehabStatus = (idx) => {
    const order = ["pending", "in-progress", "complete"];
    const updated = rehabItems.map((item, i) => i !== idx ? item : { ...item, status: order[(order.indexOf(item.status) + 1) % order.length] });
    setRehabItems(updated);
  };

  const currentFlip = { ...flip, stage };
  const holdingCosts = currentFlip.daysOwned > 0 ? Math.round(currentFlip.holdingCostsPerMonth * (currentFlip.daysOwned / 30)) : 0;
  const totalHolding = currentFlip.stage === "Sold" ? currentFlip.totalHoldingCosts : holdingCosts;
  const sellingCosts = currentFlip.stage === "Sold" ? currentFlip.sellingCosts : Math.round((currentFlip.arv || 0) * 0.06);
  const totalCost = currentFlip.purchasePrice + (currentFlip.stage === "Sold" ? currentFlip.rehabSpent : currentFlip.rehabBudget) + totalHolding + sellingCosts;
  const saleOrARV = currentFlip.stage === "Sold" ? currentFlip.salePrice : currentFlip.arv;
  const profit = saleOrARV - totalCost;
  const roi = totalCost > 0 ? ((profit / (currentFlip.purchasePrice + currentFlip.rehabBudget)) * 100).toFixed(1) : 0;
  const mao70 = (currentFlip.arv * 0.70) - currentFlip.rehabBudget;
  const rehabTotalBudget = rehabItems.reduce((s, i) => s + i.budgeted, 0);
  const rehabTotalSpent = rehabItems.reduce((s, i) => s + i.spent, 0);
  const statusIcons = { "complete": "v", "in-progress": "~", "pending": "o" };
  const statusColors = { "complete": "#15803d", "in-progress": "#a16207", "pending": "#94a3b8" };
  const statusBg = { "complete": "#dcfce7", "in-progress": "#fef9c3", "pending": "#f1f5f9" };

  const flipContractors = conData;
  // Expense date filter
  const expNow = new Date();
  const expThisYear = expNow.getFullYear();
  const expThisMonth = expNow.getMonth();
  const expMatchesDate = e => {
    if (expDateFilter === "all") return true;
    const d = new Date(e.date);
    if (expDateFilter === "thisMonth") return d.getFullYear() === expThisYear && d.getMonth() === expThisMonth;
    if (expDateFilter === "lastMonth") {
      const lm = expThisMonth === 0 ? 11 : expThisMonth - 1;
      const ly = expThisMonth === 0 ? expThisYear - 1 : expThisYear;
      return d.getFullYear() === ly && d.getMonth() === lm;
    }
    if (expDateFilter === "thisYear") return d.getFullYear() === expThisYear;
    if (expDateFilter === "lastYear") return d.getFullYear() === expThisYear - 1;
    if (expDateFilter === "custom") {
      if (expDateFrom && e.date < expDateFrom) return false;
      if (expDateTo && e.date > expDateTo) return false;
      return true;
    }
    return true;
  };
  const clearExpFilters = () => { setExpSearch(""); setExpCatFilter("all"); setExpDateFilter("all"); setExpDateFrom(""); setExpDateTo(""); };
  const hasExpFilters = expSearch || expCatFilter !== "all" || expDateFilter !== "all";

  const flipExpenses = expData.filter(e => {
    if (expSearch && !e.description?.toLowerCase().includes(expSearch.toLowerCase()) && !e.vendor?.toLowerCase().includes(expSearch.toLowerCase())) return false;
    if (expCatFilter !== "all" && e.category !== expCatFilter) return false;
    if (!expMatchesDate(e)) return false;
    return true;
  });
  const totalExpensed = expData.reduce((s, e) => s + e.amount, 0);
  const filteredTotal = flipExpenses.reduce((s, e) => s + e.amount, 0);
  const doneCount = milestones.filter(m => m.done).length;
  const today = new Date().toISOString().split("T")[0];
  const overdueCount = milestones.filter(m => !m.done && m.targetDate && m.targetDate < today).length;

  const rehabComplete = rehabItems.filter(i => i.status === "complete").length;
  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "milestones", label: `Milestones (${doneCount}/${milestones.length})`, icon: CheckSquare },
    { id: "rehab", label: `Rehab (${rehabComplete}/${rehabItems.length})`, icon: Wrench },
    { id: "contractors", label: `Contractors (${flipContractors.length})`, icon: UserCheck },
    { id: "expenses", label: `Expenses (${flipExpenses.length})`, icon: Receipt },
    { id: "notes", label: `Notes (${dealNotes.length})`, icon: MessageSquare },
  ];

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "#f59e0b", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 20 }}>
        Back to Deals
      </button>
      <div style={{ background: `linear-gradient(135deg, ${flip.color}18, ${flip.color}30)`, borderRadius: 20, padding: 28, marginBottom: 20, border: `1px solid ${flip.color}30` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: flip.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 800 }}>{flip.image}</div>
            <div>
              <h1 style={{ color: "#0f172a", fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{flip.name}</h1>
              <p style={{ color: "#64748b", fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> {flip.address}</p>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                <StageBadge stage={stage} />
                <select value={stage} onChange={handleStageChange} style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "4px 8px", fontSize: 12, background: "rgba(255,255,255,0.8)", color: "#475569", cursor: "pointer", outline: "none" }}>
                  {STAGE_ORDER.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, justifyContent: "flex-end" }}>
              <button onClick={() => {
                const initials = flip.name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
                const colors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#ec4899"];
                const cloned = {
                  id: newId(), name: flip.name + " (Copy)", address: "", stage: "Under Contract",
                  image: initials, color: colors[FLIPS.length % colors.length],
                  purchasePrice: 0, arv: flip.arv, rehabBudget: flip.rehabBudget, rehabSpent: 0,
                  holdingCostsPerMonth: flip.holdingCostsPerMonth, daysOwned: 0,
                  rehabItems: rehabItems.map(r => ({ category: r.category, budgeted: r.budgeted, spent: 0, status: "pending", contractorIds: [], photos: [] })),
                };
                FLIPS.push(cloned);
                FLIP_MILESTONES[cloned.id] = milestones.map(m => ({ label: m.label, done: false, date: null, targetDate: null }));
                if (setAllFlips) setAllFlips([...FLIPS]);
                setDealNotes(prev => [{ id: newId(), date: today, text: `Deal cloned as "${cloned.name}"` }, ...prev]);
              }} style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Copy size={12} /> Clone Deal
              </button>
              <button onClick={openEditDeal} style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Pencil size={12} /> Edit Deal
              </button>
            </div>
            <p style={{ color: "#64748b", fontSize: 13 }}>{stage === "Sold" ? "Sale Price" : "ARV"}</p>
            <p style={{ color: "#0f172a", fontSize: 32, fontWeight: 800 }}>{fmt(saleOrARV)}</p>
            <p style={{ color: profit >= 0 ? "#10b981" : "#ef4444", fontSize: 15, fontWeight: 700 }}>
              {profit >= 0 ? "+" : ""}{fmt(profit)} {stage === "Sold" ? "net profit" : "projected profit"}
            </p>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, background: "#f8fafc", borderRadius: 14, padding: 5, marginBottom: 24, border: "1px solid #e2e8f0" }}>
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, border: "none", background: active ? "#f59e0b" : "transparent", color: active ? "#fff" : "#64748b", fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", boxShadow: active ? "0 2px 8px rgba(245,158,11,0.3)" : "none", whiteSpace: "nowrap", transition: "all 0.15s ease" }}>
              <t.icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>
      {activeTab === "overview" && (<>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Deal Profit &amp; Loss</h3>
          {[
            { label: stage === "Sold" ? "Sale Price" : "ARV (Target)", value: fmt(saleOrARV), color: "#15803d", sign: "+" },
            { label: "Purchase Price", value: fmt(flip.purchasePrice), color: "#b91c1c", sign: "-" },
            { label: "Rehab Cost", value: fmt(stage === "Sold" ? flip.rehabSpent : flip.rehabBudget), color: "#b91c1c", sign: "-" },
            { label: "Holding Costs", value: fmt(totalHolding), color: "#b91c1c", sign: "-" },
            { label: "Selling Costs (~6%)", value: fmt(sellingCosts), color: "#b91c1c", sign: "-" },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: r.color, fontWeight: 700, fontSize: 16, lineHeight: 1 }}>{r.sign}</span>
                <span style={{ fontSize: 14, color: "#475569" }}>{r.label}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: r.color }}>{r.value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 0", marginTop: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Net Profit</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: profit >= 0 ? "#10b981" : "#ef4444" }}>{profit >= 0 ? "+" : ""}{fmt(profit)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>ROI on cash invested</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>{roi}%</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Target size={16} color="#3b82f6" />
              <h3 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700 }}>70% Rule Check</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "ARV", value: fmt(flip.arv) },
                { label: "Rehab Budget", value: fmt(flip.rehabBudget) },
                { label: "MAO (70% Rule)", value: fmt(mao70), color: "#3b82f6" },
                { label: "Actual Purchase", value: fmt(flip.purchasePrice), color: flip.purchasePrice <= mao70 ? "#15803d" : "#b91c1c" },
              ].map((m, i) => (
                <div key={i} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
                  <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{m.label}</p>
                  <p style={{ color: m.color || "#0f172a", fontSize: 14, fontWeight: 700 }}>{m.value}</p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: flip.purchasePrice <= mao70 ? "#15803d" : "#b91c1c", background: flip.purchasePrice <= mao70 ? "#dcfce7" : "#fee2e2", borderRadius: 8, padding: "6px 10px" }}>
              {flip.purchasePrice <= mao70 ? `v Deal is ${fmt(mao70 - flip.purchasePrice)} under MAO - good spread` : `(!) Purchase is ${fmt(flip.purchasePrice - mao70)} over MAO - verify assumptions`}
            </p>
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Calendar size={16} color="#8b5cf6" />
              <h3 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700 }}>Timeline</h3>
            </div>
            {[
              { label: "Contract / Acquisition", date: flip.acquisitionDate || flip.contractDate },
              { label: "Rehab Start", date: flip.rehabStartDate },
              { label: "Rehab Complete", date: flip.rehabEndDate },
              { label: "Listed", date: flip.listDate || flip.projectedListDate },
              { label: "Close", date: flip.closeDate || flip.projectedCloseDate },
            ].filter(t => t.date).map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.date ? "#3b82f6" : "#e2e8f0", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#475569" }}>{t.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{t.date}</span>
                </div>
              </div>
            ))}
            {flip.daysOwned > 0 && (
              <div style={{ marginTop: 8, background: "#eff6ff", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>
                <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                Day {flip.daysOwned} . Est. {Math.round(flip.holdingCostsPerMonth / 30)}/day in holding costs
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Compact Rehab Summary */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Wrench size={16} color="#f59e0b" />
            <h3 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700 }}>Rehab Progress</h3>
          </div>
          <button onClick={() => setActiveTab("rehab")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            View Details <ChevronRight size={14} />
          </button>
        </div>
        <RehabProgress items={rehabItems} />
        <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
          <div style={{ flex: 1, background: "#f8fafc", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
            <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Budget</p>
            <p style={{ color: "#0f172a", fontSize: 16, fontWeight: 700 }}>{fmt(rehabTotalBudget)}</p>
          </div>
          <div style={{ flex: 1, background: "#f8fafc", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
            <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Spent</p>
            <p style={{ color: rehabTotalSpent > rehabTotalBudget ? "#b91c1c" : "#0f172a", fontSize: 16, fontWeight: 700 }}>{fmt(rehabTotalSpent)}</p>
          </div>
          <div style={{ flex: 1, background: "#f8fafc", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
            <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Remaining</p>
            <p style={{ color: "#3b82f6", fontSize: 16, fontWeight: 700 }}>{fmt(Math.max(0, rehabTotalBudget - rehabTotalSpent))}</p>
          </div>
          <div style={{ flex: 1, background: "#f8fafc", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
            <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Items</p>
            <p style={{ color: "#0f172a", fontSize: 16, fontWeight: 700 }}>{rehabComplete}/{rehabItems.length} done</p>
          </div>
        </div>
      </div>
      {/* Budget & Schedule Alerts */}
      {(() => {
        const alerts = [];
        const rehabPct = rehabTotalBudget > 0 ? (rehabTotalSpent / rehabTotalBudget) * 100 : 0;
        if (rehabPct >= 100) alerts.push({ severity: "critical", text: `Rehab spending is ${Math.round(rehabPct)}% of budget — ${fmt(rehabTotalSpent - rehabTotalBudget)} over budget`, icon: AlertTriangle });
        else if (rehabPct >= 90) alerts.push({ severity: "warning", text: `Rehab spending is at ${Math.round(rehabPct)}% of budget — only ${fmt(rehabTotalBudget - rehabTotalSpent)} remaining`, icon: AlertTriangle });
        if (overdueCount > 0) alerts.push({ severity: "warning", text: `${overdueCount} milestone${overdueCount > 1 ? "s" : ""} overdue — review your timeline`, icon: Clock });
        if (flip.daysOwned > 120 && stage !== "Sold") alerts.push({ severity: "info", text: `Day ${flip.daysOwned} of ownership — holding costs est. ${fmt(holdingCosts)} and growing`, icon: Clock });
        const pendingExpCount = expData.filter(e => e.status === "pending").length;
        if (pendingExpCount > 0) alerts.push({ severity: "info", text: `${pendingExpCount} expense${pendingExpCount > 1 ? "s" : ""} still pending payment`, icon: CreditCard });
        if (alerts.length === 0) return null;
        const colors = { critical: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", icon: "#ef4444" }, warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", icon: "#f59e0b" }, info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", icon: "#3b82f6" } };
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {alerts.map((a, i) => {
              const c = colors[a.severity];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12 }}>
                  <a.icon size={16} color={c.icon} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: c.text, fontWeight: 600, flex: 1 }}>{a.text}</p>
                </div>
              );
            })}
          </div>
        );
      })()}
      </>)}

      {activeTab === "rehab" && (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              {rehabItems.length} item{rehabItems.length !== 1 ? "s" : ""} . <strong style={{ color: "#0f172a" }}>{fmt(rehabTotalBudget)}</strong> budget . <strong style={{ color: rehabTotalSpent > rehabTotalBudget ? "#b91c1c" : "#0f172a" }}>{fmt(rehabTotalSpent)}</strong> spent
            </p>
          </div>
          <button onClick={() => { setEditingRehabIdx(null); setRehabForm(emptyRehab); setShowAddRehab(true); }} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={15} /> Add Rehab Item
          </button>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <RehabProgress items={rehabItems} />
          <div style={{ marginTop: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Category", "Budgeted", "Spent", "Remaining", "Status", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rehabItems.map((item, i) => {
                  const remaining = item.budgeted - item.spent;
                  const over = remaining < 0;
                  return (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                        {item.category}
                        {(item.photos || []).length > 0 && <span style={{ marginLeft: 6, color: "#3b82f6", fontSize: 11 }} title={`${item.photos.length} photo(s)`}><Image size={12} style={{ display: "inline" }} /> {item.photos.length}</span>}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{fmt(item.budgeted)}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{fmt(item.spent)}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: over ? "#b91c1c" : "#15803d" }}>
                        {over ? `-${fmt(Math.abs(remaining))}` : fmt(remaining)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button onClick={() => cycleRehabStatus(i)} title="Click to cycle status" style={{ background: statusBg[item.status], color: statusColors[item.status], borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
                          {statusIcons[item.status]} {item.status}
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => openEditRehab(item, i)} style={{ background: "#f1f5f9", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteConfirm({ type: "rehab", item: item, index: i })} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {showAddRehab && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "#fff", borderRadius: 20, width: 420, padding: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700 }}>{editingRehabIdx !== null ? "Edit Rehab Item" : "Add Rehab Item"}</h2>
                <button onClick={() => { setShowAddRehab(false); setRehabForm(emptyRehab); setEditingRehabIdx(null); }} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color="#64748b" /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Category *</label>
                  <input value={rehabForm.category} onChange={sfR("category")} placeholder="e.g. Kitchen, Flooring, HVAC" style={iS} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Budget *</label>
                    <input value={rehabForm.budgeted} onChange={sfR("budgeted")} type="number" placeholder="18000" style={iS} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Spent So Far</label>
                    <input value={rehabForm.spent} onChange={sfR("spent")} type="number" placeholder="0" style={iS} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Status</label>
                  <select value={rehabForm.status} onChange={sfR("status")} style={iS}>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="complete">Complete</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Photos</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {(rehabForm.photos || []).map((p, pi) => (
                      <div key={pi} style={{ position: "relative", width: 60, height: 60, borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                        <img src={p} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button onClick={() => setRehabForm(f => ({ ...f, photos: f.photos.filter((_, ii) => ii !== pi) }))} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={10} /></button>
                      </div>
                    ))}
                    <label style={{ width: 60, height: 60, borderRadius: 8, border: "2px dashed #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8", fontSize: 10, gap: 2 }}>
                      <Camera size={16} />
                      <span>Add</span>
                      <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => {
                        Array.from(e.target.files).forEach(file => {
                          const reader = new FileReader();
                          reader.onload = ev => setRehabForm(f => ({ ...f, photos: [...(f.photos || []), ev.target.result] }));
                          reader.readAsDataURL(file);
                        });
                      }} />
                    </label>
                  </div>
                  <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Before/after photos for this scope of work</p>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
                <button onClick={() => { setShowAddRehab(false); setRehabForm(emptyRehab); setEditingRehabIdx(null); }} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
                <button onClick={() => {
                  if (!rehabForm.category || !rehabForm.budgeted) return;
                  const photos = rehabForm.photos || [];
                  if (editingRehabIdx !== null) {
                    setRehabItems(prev => prev.map((item, idx) => idx === editingRehabIdx ? { ...item, category: rehabForm.category, budgeted: parseFloat(rehabForm.budgeted) || 0, spent: parseFloat(rehabForm.spent) || 0, status: rehabForm.status, photos } : item));
                    setEditingRehabIdx(null);
                  } else {
                    setRehabItems(prev => [...prev, { category: rehabForm.category, budgeted: parseFloat(rehabForm.budgeted) || 0, spent: parseFloat(rehabForm.spent) || 0, status: rehabForm.status, contractorIds: [], photos }]);
                  }
                  setRehabForm(emptyRehab);
                  setShowAddRehab(false);
                }} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: (!rehabForm.category || !rehabForm.budgeted) ? 0.5 : 1 }}>{editingRehabIdx !== null ? "Save Changes" : "Add Item"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {activeTab === "expenses" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={{ color: "#64748b", fontSize: 14 }}>
                {hasExpFilters ? `${flipExpenses.length} of ${expData.length}` : `${flipExpenses.length}`} transactions . <strong style={{ color: "#b91c1c" }}>{fmt(hasExpFilters ? filteredTotal : totalExpensed)}</strong> {hasExpFilters ? "filtered" : "total spent"}
              </p>
            </div>
            <button onClick={() => { setEditingExpId(null); setExpForm(emptyExp); setShowExpenseModal(true); }} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={15} /> Log Expense
            </button>
          </div>
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: hasExpFilters ? 10 : 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 160px", minWidth: 150 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input value={expSearch} onChange={e => setExpSearch(e.target.value)} placeholder="Search..."
                style={{ width: "100%", paddingLeft: 32, paddingRight: 10, paddingTop: 8, paddingBottom: 8, border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }} />
            </div>
            <select value={expCatFilter} onChange={e => setExpCatFilter(e.target.value)} style={{ ...iS, width: "auto", minWidth: 150, fontSize: 13, padding: "8px 10px" }}>
              <option value="all">All Categories</option>
              {FLIP_EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={expDateFilter} onChange={e => { setExpDateFilter(e.target.value); if (e.target.value !== "custom") { setExpDateFrom(""); setExpDateTo(""); } }} style={{ ...iS, width: "auto", minWidth: 130, fontSize: 13, padding: "8px 10px" }}>
              <option value="all">All Time</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="thisYear">This Year</option>
              <option value="lastYear">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>
            {expDateFilter === "custom" && (
              <>
                <input type="date" value={expDateFrom} onChange={e => setExpDateFrom(e.target.value)} style={{ ...iS, width: "auto", fontSize: 13, padding: "8px 10px" }} />
                <span style={{ color: "#94a3b8", fontSize: 13 }}>to</span>
                <input type="date" value={expDateTo} onChange={e => setExpDateTo(e.target.value)} style={{ ...iS, width: "auto", fontSize: 13, padding: "8px 10px" }} />
              </>
            )}
          </div>
          {/* Active filter chips */}
          {hasExpFilters && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>Filtered:</span>
              {expCatFilter !== "all" && <span style={{ background: "#fef9c3", color: "#854d0e", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{expCatFilter}</span>}
              {expDateFilter !== "all" && <span style={{ background: "#f0fdf4", color: "#15803d", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{{ thisMonth: "This Month", lastMonth: "Last Month", thisYear: "This Year", lastYear: "Last Year", custom: expDateFrom && expDateTo ? `${expDateFrom} – ${expDateTo}` : "Custom Range" }[expDateFilter]}</span>}
              {expSearch && <span style={{ background: "#f1f5f9", color: "#475569", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>&ldquo;{expSearch}&rdquo;</span>}
              <button onClick={clearExpFilters} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear all</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
            {Object.keys(FLIP_EXPENSE_GROUPS).map(group => {
              const subs = FLIP_EXPENSE_GROUPS[group];
              const total = flipExpenses.filter(e => subs.includes(e.category)).reduce((s, e) => s + e.amount, 0);
              return (
                <div key={group} style={{ background: "#fff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", minWidth: 130, flex: "1 0 auto" }}>
                  <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 4, whiteSpace: "nowrap" }}>{group}</p>
                  <p style={{ color: total > 0 ? "#0f172a" : "#cbd5e1", fontSize: 16, fontWeight: 700 }}>{total > 0 ? fmt(total) : "-"}</p>
                </div>
              );
            })}
          </div>

          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", overflow: "hidden" }}>
            {flipExpenses.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
                <Receipt size={32} style={{ margin: "0 auto 12px", display: "block" }} />
                {hasExpFilters ? (
                  <>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>No expenses match your filters</p>
                    <button onClick={clearExpFilters} style={{ background: "none", border: "none", color: "#f59e0b", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
                  </>
                ) : (
                  <>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>No expenses logged yet</p>
                    <p style={{ fontSize: 13 }}>Click &ldquo;Log Expense&rdquo; to start tracking spend for this flip.</p>
                  </>
                )}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Date", "Paid To", "Category", "Description", "Amount", "Status", ""].map(h => (
                      <th key={h} style={{ padding: "12px 18px", textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flipExpenses.map((e, i) => (
                    <tr key={e.id} onClick={() => onNavigateToExpense && onNavigateToExpense(e.id)} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa", cursor: onNavigateToExpense ? "pointer" : "default", transition: "background 0.15s" }}
                      onMouseEnter={ev => { if (onNavigateToExpense) ev.currentTarget.style.background = "#f0f9ff"; }}
                      onMouseLeave={ev => { ev.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"; }}>
                      <td style={{ padding: "13px 18px", fontSize: 13, color: "#64748b" }}>{e.date}</td>
                      <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                        {e.vendor}
                        {e.contractorId && <UserCheck size={11} color="#3b82f6" style={{ marginLeft: 5, display: "inline" }} title={`Linked contractor`} />}
                      </td>
                      <td style={{ padding: "13px 18px" }}>
                        {(() => { const group = getFlipExpGroup(e.category); return group && group !== e.category ? <p style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>{group}</p> : null; })()}
                        <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, color: "#475569" }}>{e.category}</span>
                      </td>
                      <td style={{ padding: "13px 18px", fontSize: 13, color: "#475569" }}>{e.description}</td>
                      <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 700, color: "#b91c1c" }}>{fmt(e.amount)}</td>
                      <td style={{ padding: "13px 18px" }}>
                        <button onClick={() => setExpData(prev => prev.map(x => x.id === e.id ? { ...x, status: x.status === "paid" ? "pending" : "paid" } : x))} style={{ background: (e.status || "paid") === "paid" ? "#dcfce7" : "#fef9c3", color: (e.status || "paid") === "paid" ? "#15803d" : "#a16207", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", textTransform: "capitalize" }}>
                          {(e.status || "paid") === "paid" ? "Paid" : "Pending"}
                        </button>
                      </td>
                      <td style={{ padding: "13px 18px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => openEditExp(e)} style={{ background: "#f1f5f9", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteConfirm({ type: "expense", item: e })} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                    <td colSpan={4} style={{ padding: "12px 18px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Total Expensed</td>
                    <td style={{ padding: "12px 18px", fontSize: 15, fontWeight: 800, color: "#b91c1c" }}>{fmt(totalExpensed)}</td>
                    <td colSpan={2} style={{ padding: "12px 18px", fontSize: 12, color: "#94a3b8" }}>
                      {expData.filter(e => (e.status || "paid") === "pending").length > 0 && <span style={{ color: "#a16207", fontWeight: 600 }}>{expData.filter(e => e.status === "pending").length} pending</span>}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          {onNavigateToExpense && flipExpenses.length > 0 && (
            <button onClick={() => onNavigateToExpense(flipExpenses[0].id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#f59e0b", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "12px 0 0", marginLeft: "auto" }}>
              View all expenses across deals <ChevronRight size={14} />
            </button>
          )}
          {showExpenseModal && (() => {
            const PaidToDropdown = () => {
              const q = (expForm.vendor || "").toLowerCase();
              // Contractors on this project
              const conMatches = q ? conData.filter(c => c.name.toLowerCase().includes(q)) : conData;
              // Previous vendors (excluding contractor names to avoid duplicates)
              const conNames = new Set(conData.map(c => c.name.toLowerCase()));
              const vendorMatches = q ? allVendors.filter(v => v.toLowerCase().includes(q) && !conNames.has(v.toLowerCase())) : allVendors.filter(v => !conNames.has(v.toLowerCase()));
              const exactExists = allVendors.some(v => v.toLowerCase() === q) || conData.some(c => c.name.toLowerCase() === q);
              const showNew = q && !exactExists;
              if (conMatches.length === 0 && vendorMatches.length === 0 && !showNew) return null;
              return (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                  {conMatches.length > 0 && (
                    <>
                      <div style={{ padding: "6px 14px", background: "#f8fafc", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Project Contractors</div>
                      {conMatches.slice(0, 5).map(c => (
                        <button key={`con-${c.id}`} onMouseDown={() => { setExpForm(f => ({ ...f, vendor: c.name, contractorId: String(c.id) })); setVendorFocus(false); }}
                          style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", textAlign: "left", cursor: "pointer", fontSize: 13, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                          <UserCheck size={13} style={{ color: "#3b82f6", flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{c.name}</span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>{c.trade}</span>
                        </button>
                      ))}
                    </>
                  )}
                  {vendorMatches.length > 0 && (
                    <>
                      <div style={{ padding: "6px 14px", background: "#f8fafc", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Previous Vendors</div>
                      {vendorMatches.slice(0, 5).map(v => (
                        <button key={v} onMouseDown={() => { setExpForm(f => ({ ...f, vendor: v, contractorId: "" })); setVendorFocus(false); }}
                          style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", textAlign: "left", cursor: "pointer", fontSize: 13, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                          <User size={13} style={{ color: "#94a3b8", flexShrink: 0 }} /> {v}
                        </button>
                      ))}
                    </>
                  )}
                  {showNew && (
                    <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "#f0f9ff", borderTop: "1px solid #e2e8f0" }}>
                      <PlusCircle size={13} style={{ color: "#3b82f6", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#3b82f6", fontWeight: 600 }}>Add "{expForm.vendor}" as new</span>
                    </div>
                  )}
                </div>
              );
            };
            // Auto-detect contractor link when vendor name changes
            const handleVendorChange = (e) => {
              const val = e.target.value;
              const matchedCon = conData.find(c => c.name.toLowerCase() === val.toLowerCase());
              setExpForm(f => ({ ...f, vendor: val, contractorId: matchedCon ? String(matchedCon.id) : "" }));
            };
            const linkedCon = expForm.contractorId ? conData.find(c => String(c.id) === String(expForm.contractorId)) : null;
            return (
            <Modal title={editingExpId ? "Edit Expense" : "Log Expense"} onClose={() => { setShowExpenseModal(false); setEditingExpId(null); setExpForm(emptyExp); }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Date</label>
                  <input type="date" value={expForm.date} onChange={sfE("date")} style={iS} />
                </div>
                <div>
                  <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Amount ($)</label>
                  <input type="number" placeholder="0.00" value={expForm.amount} onChange={sfE("amount")} style={iS} />
                </div>
                <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                  <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Paid To</label>
                  <input type="text" placeholder="Contractor name or vendor (e.g. ABC Plumbing, Home Depot)" value={expForm.vendor} onChange={handleVendorChange} onFocus={() => setVendorFocus(true)} onBlur={() => setTimeout(() => setVendorFocus(false), 150)} style={iS} autoComplete="off" />
                  {vendorFocus && <PaidToDropdown />}
                  {linkedCon && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <UserCheck size={12} color="#3b82f6" />
                      <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>Linked to {linkedCon.name} ({linkedCon.trade})</span>
                      <button onClick={() => setExpForm(f => ({ ...f, contractorId: "" }))} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>unlink</button>
                    </div>
                  )}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Description</label>
                  <input type="text" placeholder="Brief description of what was purchased or done" value={expForm.description} onChange={sfE("description")} style={iS} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Category</label>
                  <select value={expForm.category} onChange={sfE("category")} style={iS}>
                    {Object.entries(FLIP_EXPENSE_GROUPS).map(([group, subs]) => (
                      <optgroup key={group} label={group}>
                        {subs.map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Status</label>
                  <select value={expForm.status} onChange={sfE("status")} style={iS}>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => { setShowExpenseModal(false); setEditingExpId(null); setExpForm(emptyExp); }} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSaveExp} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#f59e0b", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{editingExpId ? "Save Changes" : "Save Expense"}</button>
              </div>
            </Modal>
            );
          })()}
        </div>
      )}
      {activeTab === "contractors" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <p style={{ color: "#64748b", fontSize: 14 }}>{flipContractors.length} contractor{flipContractors.length !== 1 ? "s" : ""} on this project</p>
            <button onClick={() => { setEditingConId(null); setConForm(emptyCon); setShowContractorModal(true); }} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={15} /> Add Contractor
            </button>
          </div>
          {flipContractors.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 16, padding: 48, textAlign: "center", color: "#94a3b8", border: "1px solid #f1f5f9" }}>
              <Users size={32} style={{ margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No contractors added yet</p>
              <p style={{ fontSize: 13 }}>Track subs, payment types, and amounts owed.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {flipContractors.map(c => {
                const owed = c.paymentType === "Fixed Bid" ? (c.totalBid - c.totalPaid) : null;
                const statusMap = { complete: { bg: "#dcfce7", text: "#15803d" }, active: { bg: "#dbeafe", text: "#1d4ed8" }, pending: { bg: "#f1f5f9", text: "#475569" } };
                const s = statusMap[c.status] || statusMap.pending;
                return (
                  <div key={c.id} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <UserCheck size={20} color="#64748b" />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{c.name}</p>
                          <p style={{ fontSize: 12, color: "#94a3b8" }}>{c.trade} . {c.phone}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>{c.status}</span>
                        <button onClick={() => openEditCon(c)} style={{ background: "#f1f5f9", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteConfirm({ type: "contractor", item: c })} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                      <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
                        <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>Payment Type</p>
                        <p style={{ color: "#0f172a", fontSize: 13, fontWeight: 700 }}>{c.paymentType}</p>
                      </div>
                      {c.paymentType === "Fixed Bid" ? (
                        <>
                          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
                            <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>Total Bid</p>
                            <p style={{ color: "#0f172a", fontSize: 13, fontWeight: 700 }}>{fmt(c.totalBid)}</p>
                          </div>
                          <div style={{ background: owed > 0 ? "#fef9c3" : "#dcfce7", borderRadius: 10, padding: "10px 12px" }}>
                            <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>Balance Owed</p>
                            <p style={{ color: owed > 0 ? "#a16207" : "#15803d", fontSize: 13, fontWeight: 700 }}>{owed > 0 ? fmt(owed) : "Paid in full"}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
                            <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>Day Rate</p>
                            <p style={{ color: "#0f172a", fontSize: 13, fontWeight: 700 }}>{fmt(c.dayRate)}/day</p>
                          </div>
                          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
                            <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>Total Paid</p>
                            <p style={{ color: "#0f172a", fontSize: 13, fontWeight: 700 }}>{fmt(c.totalPaid)}</p>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Paid to Date</p>
                        <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${c.paymentType === "Fixed Bid" ? Math.min(100, Math.round((c.totalPaid / c.totalBid) * 100)) : 100}%`, background: "#10b981", borderRadius: 99 }} />
                        </div>
                      </div>
                      <button onClick={() => { setShowPaymentModal(c.id); setPaymentDate(new Date().toISOString().split("T")[0]); }} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", flexShrink: 0 }}>
                        <CreditCard size={12} /> Record Payment
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {showContractorModal && (
        <Modal title={editingConId ? "Edit Contractor" : "Add Contractor"} onClose={() => { setShowContractorModal(false); setEditingConId(null); setConForm(emptyCon); }}>
          {[
            { label: "Name / Company", key: "name", type: "text", placeholder: "e.g. ABC Plumbing" },
            { label: "Trade", key: "trade", type: "text", placeholder: "e.g. Plumbing, Electrical" },
            { label: "Phone", key: "phone", type: "text", placeholder: "555-000-0000" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={conForm[f.key]} onChange={sfC(f.key)} style={iS} />
            </div>
          ))}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Payment Type</label>
            <select value={conForm.paymentType} onChange={sfC("paymentType")} style={iS}>
              <option>Fixed Bid</option><option>Day Rate</option>
            </select>
          </div>
          {conForm.paymentType === "Fixed Bid" ? (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Total Bid ($)</label>
              <input type="number" placeholder="0.00" value={conForm.totalBid} onChange={sfC("totalBid")} style={iS} />
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Day Rate ($)</label>
              <input type="number" placeholder="0.00" value={conForm.dayRate} onChange={sfC("dayRate")} style={iS} />
            </div>
          )}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Status</label>
            <select value={conForm.status} onChange={sfC("status")} style={iS}>
              <option value="pending">Pending</option><option value="active">Active</option><option value="complete">Complete</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setShowContractorModal(false); setEditingConId(null); setConForm(emptyCon); }} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveCon} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#f59e0b", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{editingConId ? "Save Changes" : "Add Contractor"}</button>
          </div>
        </Modal>
      )}
      {showPaymentModal && (() => {
        const con = conData.find(c => c.id === showPaymentModal);
        if (!con) return null;
        const owed = con.paymentType === "Fixed Bid" ? (con.totalBid - con.totalPaid) : null;
        return (
          <Modal title={`Record Payment — ${con.name}`} onClose={() => { setShowPaymentModal(null); setPaymentAmount(""); setPaymentNote(""); }}>
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14, marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Trade</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{con.trade}</span>
              </div>
              {con.paymentType === "Fixed Bid" && <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>Total Bid</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{fmt(con.totalBid)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>Paid to Date</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{fmt(con.totalPaid)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>Balance Owed</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: owed > 0 ? "#b91c1c" : "#15803d" }}>{owed > 0 ? fmt(owed) : "Paid in full"}</span>
                </div>
              </>}
              {con.paymentType === "Day Rate" && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>Day Rate</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{fmt(con.dayRate)}/day</span>
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Payment Amount ($) *</label>
                <input type="number" placeholder={owed ? String(owed) : "0.00"} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} style={iS} />
                {con.paymentType === "Fixed Bid" && owed > 0 && (
                  <button onClick={() => setPaymentAmount(String(owed))} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 11, fontWeight: 600, cursor: "pointer", marginTop: 4, padding: 0 }}>Fill remaining balance ({fmt(owed)})</button>
                )}
              </div>
              <div>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Date</label>
                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} style={iS} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Note (optional)</label>
              <input type="text" placeholder="e.g. Draw #2, final payment, materials advance" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} style={iS} />
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 10 }}>This will also create a linked expense record automatically.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => { setShowPaymentModal(null); setPaymentAmount(""); setPaymentNote(""); }} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleRecordPayment} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#10b981", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: paymentAmount ? 1 : 0.5 }}>Record Payment</button>
            </div>
          </Modal>
        );
      })()}
      {activeTab === "milestones" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <p style={{ color: "#64748b", fontSize: 14 }}>
                {doneCount} of {milestones.length} complete
                {overdueCount > 0 && <span style={{ color: "#ef4444", fontWeight: 700 }}> . {overdueCount} overdue</span>}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {milestones.some(m => !m.targetDate && !m.done) && (
                <button onClick={() => {
                  // Auto-fill target dates: spread remaining milestones evenly from today to projected close or +90 days
                  const endDate = flip.projectedCloseDate || flip.closeDate;
                  const end = endDate ? new Date(endDate) : new Date(Date.now() + 90 * 86400000);
                  const pending = milestones.map((m, i) => ({ m, i })).filter(({ m }) => !m.done && !m.targetDate);
                  if (pending.length === 0) return;
                  const start = new Date();
                  const interval = (end - start) / (pending.length + 1);
                  const updated = [...milestones];
                  pending.forEach(({ i }, idx) => {
                    const d = new Date(start.getTime() + interval * (idx + 1));
                    updated[i] = { ...updated[i], targetDate: d.toISOString().split("T")[0] };
                  });
                  setMilestones(updated);
                }} style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={15} /> Auto-Fill Dates
                </button>
              )}
              <button onClick={() => { setEditingMilestoneId(null); setMilestoneForm(emptyMilestone); setShowMilestoneModal(true); }} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <Plus size={15} /> Add Milestone
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "14px 20px", marginBottom: 16, border: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : 0}%`, background: "#10b981", borderRadius: 99, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>{milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : 0}%</span>
          </div>
          {milestones.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", textAlign: "center", padding: 48, color: "#94a3b8" }}>
              <CheckSquare size={32} style={{ margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No milestones yet</p>
              <p style={{ fontSize: 13 }}>Add milestones to track your flip's progress.</p>
            </div>
          ) : (<>
            {/* Completed section — collapsible */}
            {doneCount > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", overflow: "hidden", marginBottom: 16 }}>
                <button onClick={() => setShowCompletedMilestones(!showCompletedMilestones)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "#f8fafc", border: "none", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckSquare size={16} color="#10b981" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Completed ({doneCount})</span>
                  </div>
                  <ChevronDown size={16} color="#64748b" style={{ transform: showCompletedMilestones ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                </button>
                {showCompletedMilestones && (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["", "Milestone", "Target Date", "Completed", "Status", ""].map(h => (
                          <th key={h} style={{ padding: "8px 16px", textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {milestones.map((m, i) => {
                        if (!m.done) return null;
                        const completedLate = m.date && m.targetDate && m.date > m.targetDate;
                        return (
                          <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 16px", width: 40 }}>
                              <div onClick={() => {
                                const updated = milestones.map((item, idx) => idx === i ? { ...item, done: false, date: null } : item);
                                setMilestones(updated);
                              }} style={{ color: "#10b981", cursor: "pointer" }}>
                                <CheckSquare size={18} />
                              </div>
                            </td>
                            <td style={{ padding: "10px 16px" }}>
                              <p style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", textDecoration: "line-through", textDecorationColor: "#cbd5e1" }}>{m.label}</p>
                            </td>
                            <td style={{ padding: "10px 16px", fontSize: 12, color: "#cbd5e1" }}>{m.targetDate || "-"}</td>
                            <td style={{ padding: "10px 16px", fontSize: 12, color: completedLate ? "#f59e0b" : "#94a3b8" }}>
                              {m.date || "-"}
                              {completedLate && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600, marginLeft: 4 }}>late</span>}
                            </td>
                            <td style={{ padding: "10px 16px" }}>
                              <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>Done</span>
                            </td>
                            <td style={{ padding: "10px 16px" }}>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button onClick={() => openEditMilestone(m, i)} style={{ background: "#f1f5f9", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                                <button onClick={() => setDeleteConfirm({ type: "milestone", item: m, index: i })} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {/* Active / Upcoming section */}
            {milestones.some(m => !m.done) && (
              <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["", "Milestone", "Target Date", "Completed", "Status", ""].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map((m, i) => {
                      if (m.done) return null;
                      const isOverdue = m.targetDate && m.targetDate < today;
                      return (
                        <tr key={i} style={{ borderTop: "1px solid #f1f5f9", background: isOverdue ? "#fef2f2" : "transparent" }}>
                          <td style={{ padding: "12px 16px", width: 40 }}>
                            <div onClick={() => {
                              const updated = milestones.map((item, idx) => idx === i ? { ...item, done: true, date: today } : item);
                              setMilestones(updated);
                            }} style={{ color: "#cbd5e1", cursor: "pointer" }}>
                              <Square size={20} />
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <p style={{ fontSize: 14, fontWeight: isOverdue ? 700 : 500, color: isOverdue ? "#b91c1c" : "#0f172a" }}>{m.label}</p>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: isOverdue ? "#b91c1c" : "#64748b", fontWeight: isOverdue ? 700 : 400 }}>
                            {m.targetDate || <span style={{ color: "#cbd5e1" }}>-</span>}
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#cbd5e1" }}>-</td>
                          <td style={{ padding: "12px 16px" }}>
                            {isOverdue ? (
                              <span style={{ background: "#fee2e2", color: "#b91c1c", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>Overdue</span>
                            ) : (
                              <span style={{ background: "#f1f5f9", color: "#64748b", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>Pending</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => openEditMilestone(m, i)} style={{ background: "#f1f5f9", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                              <button onClick={() => setDeleteConfirm({ type: "milestone", item: m, index: i })} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>)}
        </div>
      )}
      {showMilestoneModal && (
        <Modal title={editingMilestoneId !== null ? "Edit Milestone" : "Add Milestone"} onClose={() => { setShowMilestoneModal(false); setEditingMilestoneId(null); setMilestoneForm(emptyMilestone); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Milestone Name *</label>
              <input value={milestoneForm.label} onChange={sfM("label")} placeholder="e.g. Demo Complete, Listed for Sale" style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Target Date</label>
              <input type="date" value={milestoneForm.targetDate} onChange={sfM("targetDate")} style={iS} />
            </div>
            {editingMilestoneId !== null && (
              <div>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Completion Date</label>
                <input type="date" value={milestoneForm.date} onChange={sfM("date")} style={iS} />
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Set to mark as complete, or clear to reopen</p>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => { setShowMilestoneModal(false); setEditingMilestoneId(null); setMilestoneForm(emptyMilestone); }} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveMilestone} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#f59e0b", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: milestoneForm.label.trim() ? 1 : 0.5 }}>{editingMilestoneId !== null ? "Save Changes" : "Add Milestone"}</button>
          </div>
        </Modal>
      )}
      {activeTab === "notes" && (() => {
        const q = noteSearch.toLowerCase().trim();
        const filtered = q ? dealNotes.filter(n => n.text.toLowerCase().includes(q) || n.date.includes(q)) : dealNotes;
        // Highlight matching text
        const highlight = (text) => {
          if (!q) return text;
          const idx = text.toLowerCase().indexOf(q);
          if (idx === -1) return text;
          return (<>{text.slice(0, idx)}<mark style={{ background: "#fef08a", borderRadius: 2, padding: "0 1px" }}>{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>);
        };
        return (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              {dealNotes.length} note{dealNotes.length !== 1 ? "s" : ""}
              {q && filtered.length !== dealNotes.length && <span style={{ color: "#f59e0b", fontWeight: 600 }}> . {filtered.length} match{filtered.length !== 1 ? "es" : ""}</span>}
            </p>
            <button onClick={() => setShowNoteInput(true)} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={15} /> Add Note
            </button>
          </div>
          {dealNotes.length > 2 && (
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input type="text" placeholder="Search notes..." value={noteSearch} onChange={e => setNoteSearch(e.target.value)} style={{ ...iS, paddingLeft: 40 }} />
              {noteSearch && (
                <button onClick={() => setNoteSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}><X size={14} /></button>
              )}
            </div>
          )}
          {showNoteInput && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, marginBottom: 16, border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note about this deal... e.g. 'Spoke with inspector, needs structural review on back wall'" rows={3} style={{ ...iS, resize: "vertical", fontFamily: "inherit" }} autoFocus />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button onClick={() => { setShowNoteInput(false); setNoteText(""); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                <button onClick={addNote} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: noteText.trim() ? 1 : 0.5 }}>Save Note</button>
              </div>
            </div>
          )}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {dealNotes.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
                <MessageSquare size={32} style={{ margin: "0 auto 12px", display: "block" }} />
                <p style={{ fontWeight: 600, marginBottom: 4 }}>No notes yet</p>
                <p style={{ fontSize: 13 }}>Keep a running journal of updates, calls, and decisions for this deal.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 36, color: "#94a3b8" }}>
                <Search size={24} style={{ margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontWeight: 600, fontSize: 14 }}>No notes match "{noteSearch}"</p>
              </div>
            ) : (
              <div>
                {filtered.map((note, i) => (
                  <div key={note.id} style={{ display: "flex", gap: 14, padding: "16px 20px", borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <MessageSquare size={16} color="#3b82f6" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.6 }}>{highlight(note.text)}</p>
                      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>{note.date}</p>
                    </div>
                    <button onClick={() => setDealNotes(prev => prev.filter(n => n.id !== note.id))} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", alignSelf: "flex-start" }} title="Delete"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        );
      })()}
      {showEditDeal && (
        <Modal title="Edit Deal" onClose={() => setShowEditDeal(false)}>
          <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
            {[
              { label: "Deal Name", key: "name", type: "text", placeholder: "e.g. Oakdale Craftsman" },
              { label: "Address", key: "address", type: "text", placeholder: "Full address" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={dealEditForm[f.key] || ""} onChange={sfD(f.key)} style={iS} />
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {[
                { label: "Purchase Price ($)", key: "purchasePrice", placeholder: "195000" },
                { label: "ARV ($)", key: "arv", placeholder: "310000" },
                { label: "Rehab Budget ($)", key: "rehabBudget", placeholder: "62000" },
                { label: "Holding Costs / Month ($)", key: "holdingCostsPerMonth", placeholder: "1850" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</label>
                  <input type="number" placeholder={f.placeholder} value={dealEditForm[f.key] || ""} onChange={sfD(f.key)} style={iS} />
                </div>
              ))}
            </div>
            {stage === "Sold" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Sale Price ($)</label>
                <input type="number" placeholder="361500" value={dealEditForm.salePrice || ""} onChange={sfD("salePrice")} style={iS} />
              </div>
            )}
            <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, marginTop: 8 }}>Key Dates</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {[
                { label: "Acquisition Date", key: "acquisitionDate" },
                { label: "Rehab Start", key: "rehabStartDate" },
                { label: "Rehab Complete", key: "rehabEndDate" },
                { label: "Listed Date", key: "listDate" },
                { label: "Projected List Date", key: "projectedListDate" },
                { label: stage === "Sold" ? "Close Date" : "Projected Close", key: stage === "Sold" ? "closeDate" : "projectedCloseDate" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</label>
                  <input type="date" value={dealEditForm[f.key] || ""} onChange={sfD(f.key)} style={iS} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={() => setShowEditDeal(false)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveDeal} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#f59e0b", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Save Changes</button>
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title={`Delete ${deleteConfirm.type === "expense" ? "Expense" : deleteConfirm.type === "contractor" ? "Contractor" : deleteConfirm.type === "rehab" ? "Rehab Item" : "Milestone"}`} onClose={() => setDeleteConfirm(null)}>
          <p style={{ color: "#475569", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this {deleteConfirm.type === "rehab" ? "rehab item" : deleteConfirm.type}?</p>
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 18 }}>
            {deleteConfirm.type === "expense" && <>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{deleteConfirm.item.description}</p>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{deleteConfirm.item.vendor} · {deleteConfirm.item.date} · <span style={{ color: "#b91c1c", fontWeight: 700 }}>{fmt(deleteConfirm.item.amount)}</span></p>
            </>}
            {deleteConfirm.type === "contractor" && <>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{deleteConfirm.item.name}</p>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{deleteConfirm.item.trade} · {deleteConfirm.item.paymentType}</p>
            </>}
            {deleteConfirm.type === "rehab" && <>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{deleteConfirm.item.category}</p>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Budget: {fmt(deleteConfirm.item.budgeted)} · Spent: {fmt(deleteConfirm.item.spent)}</p>
            </>}
            {deleteConfirm.type === "milestone" && <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{deleteConfirm.item.label}</p>}
          </div>
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => {
              if (deleteConfirm.type === "expense") setExpData(prev => prev.filter(x => x.id !== deleteConfirm.item.id));
              if (deleteConfirm.type === "contractor") setConData(prev => prev.filter(x => x.id !== deleteConfirm.item.id));
              if (deleteConfirm.type === "rehab") setRehabItems(prev => prev.filter((_, idx) => idx !== deleteConfirm.index));
              if (deleteConfirm.type === "milestone") setMilestones(prev => prev.filter((_, idx) => idx !== deleteConfirm.index));
              setDeleteConfirm(null);
            }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------
// RENT ROLL
// ---------------------------------------------
function RentRoll() {
  const [tenantData, setTenantData] = useState(TENANTS);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [propFilter, setPropFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const emptyT = { propertyId: PROPERTIES[0]?.id || 1, unit: "", name: "", rent: "", securityDeposit: "", lateFeePct: "5", renewalTerms: "Annual", notes: "", leaseStart: "", leaseEnd: "", status: "active-lease", phone: "", email: "", leaseDoc: null };
  const [form, setForm] = useState(emptyT);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleLeaseDocUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, leaseDoc: { name: file.name, size: (file.size / 1024).toFixed(0) + " KB", data: ev.target.result } }));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const openAdd = () => { setEditId(null); setForm(emptyT); setShowModal(true); };
  const openEdit = t => {
    setEditId(t.id);
    setForm({
      propertyId:      t.propertyId,
      unit:            t.unit || "",
      name:            t.name || "",
      rent:            String(t.rent || ""),
      securityDeposit: String(t.securityDeposit || ""),
      lateFeePct:      String(t.lateFeePct ?? "5"),
      renewalTerms:    t.renewalTerms || "Annual",
      notes:           t.notes || "",
      leaseStart:      t.leaseStart || "",
      leaseEnd:        t.leaseEnd || "",
      status:          t.status,
      phone:           t.phone || "",
      email:           t.email || "",
      leaseDoc:        t.leaseDoc || null,
    });
    setShowModal(true);
  };

  const handleSaveTenant = () => {
    if (!form.name && form.status !== "vacant") return;
    const calcDays = leaseEnd => {
      if (!leaseEnd) return null;
      const d = Math.ceil((new Date(leaseEnd) - new Date()) / 86400000);
      return d > 0 ? d : null;
    };
    if (editId !== null) {
      setTenantData(prev => prev.map(t => t.id === editId
        ? { ...t, propertyId: parseInt(form.propertyId), unit: form.unit || t.unit, name: form.name, rent: parseFloat(form.rent) || 0, securityDeposit: parseFloat(form.securityDeposit) || null, lateFeePct: parseFloat(form.lateFeePct) || null, renewalTerms: form.renewalTerms, notes: form.notes, leaseStart: form.leaseStart || null, leaseEnd: form.leaseEnd || null, daysUntilExpiry: calcDays(form.leaseEnd), status: form.status, phone: form.phone || null, email: form.email || null, leaseDoc: form.leaseDoc ?? t.leaseDoc }
        : t
      ));
    } else {
      setTenantData(prev => [...prev, { id: newId(), propertyId: parseInt(form.propertyId), unit: form.unit || "Main", name: form.name, rent: parseFloat(form.rent) || 0, securityDeposit: parseFloat(form.securityDeposit) || null, lateFeePct: parseFloat(form.lateFeePct) || null, renewalTerms: form.renewalTerms, notes: form.notes, leaseStart: form.leaseStart || null, leaseEnd: form.leaseEnd || null, daysUntilExpiry: calcDays(form.leaseEnd), status: form.status, lastPayment: null, phone: form.phone || null, email: form.email || null, leaseDoc: form.leaseDoc || null }]);
    }
    setForm(emptyT);
    setShowModal(false);
  };

  const handleDeleteTenant = () => {
    if (!deleteConfirm) return;
    setTenantData(prev => prev.filter(t => t.id !== deleteConfirm.id));
    setDeleteConfirm(null);
  };

  const leaseStatusStyle = {
    "active-lease":   { bg: "#dcfce7", text: "#15803d" },
    "month-to-month": { bg: "#fef9c3", text: "#a16207" },
    "vacant":         { bg: "#fee2e2", text: "#b91c1c" },
  };

  const filteredTenants = tenantData.filter(t => {
    const matchProp = propFilter === "all" || t.propertyId === Number(propFilter);
    const matchStatus = statusFilter === "all"
      || t.status === statusFilter
      || (statusFilter === "expiring" && t.daysUntilExpiry !== null && t.daysUntilExpiry <= 90);
    return matchProp && matchStatus;
  });

  const totalUnits = filteredTenants.length;
  const occupied = filteredTenants.filter(t => t.status !== "vacant").length;
  const vacancyRate = totalUnits > 0 ? ((totalUnits - occupied) / totalUnits * 100).toFixed(0) : 0;
  const grossRent = filteredTenants.filter(t => t.status !== "vacant").reduce((s, t) => s + t.rent, 0);
  const expiringIn90 = tenantData.filter(t => t.daysUntilExpiry !== null && t.daysUntilExpiry <= 90);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Rent Roll</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>All tenants, leases, and occupancy status</p>
        </div>
        <button onClick={openAdd} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Add Tenant
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Units", value: totalUnits, sub: "Across portfolio", color: "#3b82f6", icon: Home },
          { label: "Occupied", value: `${occupied}/${totalUnits}`, sub: `${100 - Number(vacancyRate)}% occupancy`, color: "#10b981", icon: CheckSquare },
          { label: "Vacancy Rate", value: `${vacancyRate}%`, sub: `${totalUnits - occupied} unit${totalUnits - occupied !== 1 ? "s" : ""} vacant`, color: Number(vacancyRate) > 10 ? "#ef4444" : "#f59e0b", icon: AlertCircle },
          { label: "Gross Monthly Rent", value: fmt(grossRent), sub: "Occupied units only", color: "#8b5cf6", icon: DollarSign },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{m.label}</p>
                <p style={{ color: "#0f172a", fontSize: 24, fontWeight: 800 }}>{m.value}</p>
                <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{m.sub}</p>
              </div>
              <div style={{ background: m.color + "18", borderRadius: 10, padding: 10 }}>
                <m.icon size={20} color={m.color} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={propFilter} onChange={e => setPropFilter(e.target.value)} style={{ ...iS, width: "auto", minWidth: 180, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All Properties</option>
          {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: 4, background: "#f8fafc", borderRadius: 10, padding: 4, border: "1px solid #e2e8f0" }}>
          {[
            ["all", "All"],
            ["active-lease", "Active Lease"],
            ["month-to-month", "Month-to-Month"],
            ["vacant", "Vacant"],
            ["expiring", "Expiring Soon"],
          ].map(([val, label]) => {
            const active = statusFilter === val;
            return (
              <button key={val} onClick={() => setStatusFilter(val)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active ? "#f59e0b" : "transparent", color: active ? "#fff" : "#64748b", fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {label}{val === "expiring" && expiringIn90.length > 0 ? ` (${expiringIn90.length})` : ""}
              </button>
            );
          })}
        </div>
        {(propFilter !== "all" || statusFilter !== "all") && (
          <button onClick={() => { setPropFilter("all"); setStatusFilter("all"); }} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      {expiringIn90.length > 0 && statusFilter !== "expiring" && (
        <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertCircle size={18} color="#a16207" />
          <p style={{ color: "#a16207", fontSize: 14, fontWeight: 600 }}>
            {expiringIn90.length} lease{expiringIn90.length !== 1 ? "s" : ""} expiring within 90 days:
            {expiringIn90.map(t => `${t.name.split(" ")[0]} (${t.daysUntilExpiry} days)`).join(", ")}
          </p>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Property / Unit", "Tenant", "Monthly Rent", "Lease Start", "Lease End", "Days Left", "Status", "Last Payment", ""].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTenants.length === 0 && (
              <tr><td colSpan={9} style={{ padding: "48px 20px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>No tenants match your filters. <button onClick={() => { setPropFilter("all"); setStatusFilter("all"); }} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button></td></tr>
            )}
            {filteredTenants.map((t, i) => {
              const prop = PROPERTIES.find(p => p.id === t.propertyId);
              const s = leaseStatusStyle[t.status];
              const expiring = t.daysUntilExpiry !== null && t.daysUntilExpiry <= 90;
              return (
                <tr key={t.id} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: prop?.color || "#94a3b8", flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{prop?.name.split(" ").slice(0,2).join(" ")}</p>
                        <p style={{ fontSize: 11, color: "#94a3b8" }}>{t.unit}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {t.status === "vacant" ? (
                      <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, fontStyle: "italic" }}>Vacant</span>
                    ) : (
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: "#94a3b8" }}>{t.email}</p>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: t.status === "vacant" ? "#94a3b8" : "#0f172a" }}>{fmt(t.rent)}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#64748b" }}>{t.leaseStart || "-"}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#64748b" }}>{t.leaseEnd || "-"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    {t.daysUntilExpiry !== null ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: expiring ? "#a16207" : "#15803d" }}>
                        {expiring ? "(!) " : ""}{t.daysUntilExpiry}d
                      </span>
                    ) : <span style={{ color: "#94a3b8", fontSize: 13 }}>-</span>}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{{ "active-lease": "Active Lease", "month-to-month": "Month-to-Month", vacant: "Vacant" }[t.status] || t.status}</span>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#64748b" }}>{t.lastPayment || "-"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openEdit(t)} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "#475569", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => setDeleteConfirm(t)} style={{ background: "#fee2e2", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", color: "#ef4444" }} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showModal && (
        <Modal title={editId ? "Edit Tenant" : "Add Tenant"} onClose={() => setShowModal(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Property</label>
              <select value={form.propertyId} onChange={sf("propertyId")} style={iS}>
                {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Unit</label>
              <input type="text" placeholder="e.g. Unit A, #4B" value={form.unit} onChange={sf("unit")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Status</label>
              <select value={form.status} onChange={sf("status")} style={iS}>
                <option value="active-lease">Active Lease</option>
                <option value="month-to-month">Month-to-Month</option>
                <option value="vacant">Vacant</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Tenant Name</label>
              <input type="text" placeholder="Full name" value={form.name} onChange={sf("name")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Monthly Rent ($)</label>
              <input type="number" placeholder="0" value={form.rent} onChange={sf("rent")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Phone</label>
              <input type="text" placeholder="555-000-0000" value={form.phone} onChange={sf("phone")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Lease Start</label>
              <input type="date" value={form.leaseStart} onChange={sf("leaseStart")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Lease End</label>
              <input type="date" value={form.leaseEnd} onChange={sf("leaseEnd")} style={iS} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Email</label>
              <input type="email" placeholder="tenant@email.com" value={form.email} onChange={sf("email")} style={iS} />
            </div>
          </div>

          {/* Lease Details Section */}
          <div style={{ background: "#f0fdf4", borderRadius: 14, padding: "16px 18px", marginTop: 18, border: "1px solid #bbf7d0" }}>
            <p style={{ color: "#166534", fontSize: 13, fontWeight: 700, marginBottom: 14, letterSpacing: "0.03em", textTransform: "uppercase" }}>Lease Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Security Deposit ($)</label>
                <input type="number" placeholder="0" value={form.securityDeposit} onChange={sf("securityDeposit")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Late Fee (%)</label>
                <input type="number" placeholder="5" value={form.lateFeePct} onChange={sf("lateFeePct")} style={iS} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Renewal Terms</label>
                <select value={form.renewalTerms} onChange={sf("renewalTerms")} style={iS}>
                  <option value="Annual">Annual</option>
                  <option value="Month-to-Month">Month-to-Month</option>
                  <option value="6-Month">6-Month</option>
                  <option value="5-Year Option">5-Year Option</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Notes</label>
                <textarea placeholder="Any additional notes about this tenant or lease..." value={form.notes} onChange={sf("notes")} rows={3} style={{ ...iS, resize: "vertical", lineHeight: 1.5 }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Lease Document</label>
                {form.leaseDoc ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #d1fae5" }}>
                    <FileText size={20} color="#10b981" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{form.leaseDoc.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{form.leaseDoc.size}</div>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, leaseDoc: null }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4, display: "flex", alignItems: "center" }}><X size={15} /></button>
                  </div>
                ) : (
                  <div onClick={() => document.getElementById("leaseDocInput").click()} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#fff", borderRadius: 10, border: "2px dashed #bbf7d0", cursor: "pointer" }}>
                    <UploadCloud size={20} color="#10b981" />
                    <span style={{ fontSize: 13, color: "#64748b" }}>Click to upload lease (PDF, DOC)</span>
                  </div>
                )}
                <input id="leaseDocInput" type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={handleLeaseDocUpload} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveTenant} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              {editId ? "Save Changes" : "Add Tenant"}
            </button>
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title="Remove Tenant" onClose={() => setDeleteConfirm(null)} width={440}>
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fee2e2", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Trash2 size={22} color="#ef4444" />
            </div>
            <p style={{ color: "#0f172a", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              Remove <strong>{deleteConfirm.name || "Vacant Unit"}</strong> from {PROPERTIES.find(p => p.id === deleteConfirm.propertyId)?.name || "property"}?
            </p>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 6 }}>
              Unit {deleteConfirm.unit} · {deleteConfirm.status === "vacant" ? "Vacant" : `Rent ${fmt(deleteConfirm.rent)}/mo`}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 24 }}>
              This will remove the tenant record and any associated lease data. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDeleteTenant} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Remove Tenant</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------
// MILEAGE TRACKER
// ---------------------------------------------
function MileageTracker() {
  const [tripData, setTripData] = useState(MILEAGE_TRIPS);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("thisYear");
  const emptyTrip = { date: "", description: "", from: "Home", to: "", miles: "", purpose: "Rental", businessPct: "100" };
  const [form, setForm] = useState(emptyTrip);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const openAdd = () => { setEditId(null); setForm(emptyTrip); setShowModal(true); };
  const openEdit = t => {
    setEditId(t.id);
    setForm({ date: t.date, description: t.description, from: t.from, to: t.to, miles: String(t.miles), purpose: t.purpose, businessPct: String(t.businessPct) });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.miles || !form.to) return;
    const built = { date: form.date || new Date().toISOString().split("T")[0], description: form.description || form.to, from: form.from, to: form.to, miles: parseFloat(form.miles) || 0, purpose: form.purpose, businessPct: parseFloat(form.businessPct) || 100 };
    if (editId !== null) {
      setTripData(prev => prev.map(t => t.id === editId ? { ...t, ...built } : t));
    } else {
      setTripData(prev => [{ id: newId(), ...built }, ...prev]);
    }
    setForm(emptyTrip);
    setEditId(null);
    setShowModal(false);
  };

  const IRS_RATE = TAX_CONFIG.mileageRate;
  const purposeColors = { Flip: "#f59e0b", Rental: "#3b82f6", Business: "#8b5cf6" };

  const mNow = new Date();
  const mThisYear = mNow.getFullYear();
  const mThisMonth = mNow.getMonth();
  const matchesMileageDate = t => {
    if (dateFilter === "all") return true;
    const d = new Date(t.date);
    if (dateFilter === "thisMonth") return d.getFullYear() === mThisYear && d.getMonth() === mThisMonth;
    if (dateFilter === "lastMonth") { const lm = mThisMonth === 0 ? 11 : mThisMonth - 1; const ly = mThisMonth === 0 ? mThisYear - 1 : mThisYear; return d.getFullYear() === ly && d.getMonth() === lm; }
    if (dateFilter === "thisYear") return d.getFullYear() === mThisYear;
    return true;
  };

  const filteredTrips = tripData.filter(t =>
    (purposeFilter === "all" || t.purpose === purposeFilter) && matchesMileageDate(t)
  );

  const totalMiles = filteredTrips.reduce((s, t) => s + t.miles, 0);
  const businessMiles = filteredTrips.filter(t => t.businessPct === 100).reduce((s, t) => s + t.miles, 0);
  const deduction = filteredTrips.reduce((s, t) => s + t.miles * IRS_RATE * t.businessPct / 100, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Mileage Tracker</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>Log business trips · IRS rate: ${IRS_RATE}/mile (${TAX_CONFIG.mileageRateYear})</p>
        </div>
        <button onClick={openAdd} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Log Trip
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Miles", value: totalMiles.toFixed(1), sub: dateFilter === "thisYear" ? "This year" : dateFilter === "thisMonth" ? "This month" : dateFilter === "lastMonth" ? "Last month" : "All time", color: "#3b82f6", icon: Car },
          { label: "Business Miles", value: businessMiles.toFixed(1), sub: "100% deductible trips", color: "#10b981", icon: Route },
          { label: "Mileage Deduction", value: fmt(deduction), sub: `@ $${IRS_RATE}/mile IRS rate`, color: "#8b5cf6", icon: DollarSign },
          { label: "Trips", value: filteredTrips.length, sub: `of ${tripData.length} total logged`, color: "#f59e0b", icon: Truck },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{m.label}</p>
                <p style={{ color: "#0f172a", fontSize: 22, fontWeight: 800 }}>{m.value}</p>
                <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{m.sub}</p>
              </div>
              <div style={{ background: m.color + "18", borderRadius: 10, padding: 10 }}>
                <m.icon size={20} color={m.color} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Mileage filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "#f8fafc", borderRadius: 10, padding: 4, border: "1px solid #e2e8f0" }}>
          {[["all", "All Purposes"], ["Rental", "Rental"], ["Flip", "Flip"], ["Business", "Business"]].map(([val, label]) => {
            const active = purposeFilter === val;
            return (
              <button key={val} onClick={() => setPurposeFilter(val)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active ? "#f59e0b" : "transparent", color: active ? "#fff" : "#64748b", fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {label}
              </button>
            );
          })}
        </div>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ ...iS, width: "auto", minWidth: 140, fontSize: 13, padding: "9px 12px", marginLeft: "auto" }}>
          <option value="thisYear">This Year</option>
          <option value="thisMonth">This Month</option>
          <option value="lastMonth">Last Month</option>
          <option value="all">All Time</option>
        </select>
        {(purposeFilter !== "all" || dateFilter !== "thisYear") && (
          <button onClick={() => { setPurposeFilter("all"); setDateFilter("thisYear"); }} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700 }}>Trip Log</h3>
          <button style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", background: "#fff", color: "#475569", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Date", "Description", "From / To", "Miles", "Purpose", "Deduction", ""].map(h => (
                <th key={h} style={{ padding: "12px 18px", textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTrips.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "40px 18px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>No trips match your filters.</td></tr>
            )}
            {filteredTrips.map((t, i) => (
              <tr key={t.id} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "13px 18px", fontSize: 13, color: "#64748b" }}>{t.date}</td>
                <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{t.description}</td>
                <td style={{ padding: "13px 18px", fontSize: 12, color: "#475569" }}>{t.from}  /  {t.to.split(",")[0]}</td>
                <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{t.miles} mi</td>
                <td style={{ padding: "13px 18px" }}>
                  <span style={{ background: (purposeColors[t.purpose] || "#94a3b8") + "20", color: purposeColors[t.purpose] || "#475569", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{t.purpose}</span>
                </td>
                <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 700, color: "#15803d" }}>{fmt(t.miles * IRS_RATE * t.businessPct / 100)}</td>
                <td style={{ padding: "13px 18px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openEdit(t)} style={{ background: "#f1f5f9", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteConfirm(t)} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
              <td colSpan={3} style={{ padding: "12px 18px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Totals ({filteredTrips.length} trips)</td>
              <td style={{ padding: "12px 18px", fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{totalMiles.toFixed(1)} mi</td>
              <td />
              <td style={{ padding: "12px 18px", fontSize: 15, fontWeight: 800, color: "#15803d" }}>{fmt(deduction)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {showModal && (
        <Modal title={editId ? "Edit Trip" : "Log Trip"} onClose={() => { setShowModal(false); setEditId(null); }} width={460}>
          {[
            { label: "Date", type: "date", key: "date" },
            { label: "Description", type: "text", key: "description", placeholder: "e.g. Inspect Oakdale Craftsman" },
            { label: "From", type: "text", key: "from", placeholder: "Starting location" },
            { label: "To", type: "text", key: "to", placeholder: "Destination" },
            { label: "Miles", type: "number", key: "miles", placeholder: "0.0" },
            { label: "Business Use %", type: "number", key: "businessPct", placeholder: "100" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={sf(f.key)} style={iS} />
            </div>
          ))}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Purpose</label>
            <select value={form.purpose} onChange={sf("purpose")} style={iS}>
              {["Flip","Rental","Business"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSave} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{editId ? "Save Changes" : "Save Trip"}</button>
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title="Delete Trip" onClose={() => setDeleteConfirm(null)}>
          <p style={{ color: "#475569", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this trip?</p>
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{deleteConfirm.from} → {deleteConfirm.to}</p>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{deleteConfirm.date} · {deleteConfirm.miles} mi · {deleteConfirm.purpose}</p>
          </div>
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { setTripData(prev => prev.filter(x => x.id !== deleteConfirm.id)); setDeleteConfirm(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------
// DEAL ANALYZER
// ---------------------------------------------
function DealAnalyzer() {
  const [mode, setMode] = useState("flip");
  const [flip, setFlip] = useState({ arv: "", purchase: "", rehab: "", holdMonths: "4", sellingPct: "6" });
  const [rental, setRental] = useState({ price: "", downPct: "20", rate: "7.25", termYears: "30", monthlyRent: "", taxes: "", insurance: "", maintenance: "", vacancy: "5", mgmtPct: "0" });

  // Flip calcs
  const fARV = parseFloat(flip.arv) || 0;
  const fPurchase = parseFloat(flip.purchase) || 0;
  const fRehab = parseFloat(flip.rehab) || 0;
  const fHold = parseFloat(flip.holdMonths) || 0;
  const fSellPct = parseFloat(flip.sellingPct) / 100 || 0.06;
  const mao70 = fARV * 0.70 - fRehab;
  const mao65 = fARV * 0.65 - fRehab;
  const holdingEst = fPurchase * 0.01 * fHold;
  const sellCosts = fARV * fSellPct;
  const totalIn = fPurchase + fRehab + holdingEst + sellCosts;
  const fProfit = fARV - totalIn;
  const fROI = totalIn > 0 ? ((fProfit / (fPurchase + fRehab)) * 100).toFixed(1) : 0;
  const spread = fPurchase > 0 ? mao70 - fPurchase : null;

  // Rental calcs
  const rPrice = parseFloat(rental.price) || 0;
  const rDown = (parseFloat(rental.downPct) / 100) * rPrice;
  const rLoan = rPrice - rDown;
  const rRate = parseFloat(rental.rate) / 100 / 12;
  const rN = parseFloat(rental.termYears) * 12;
  const mortgage = rRate > 0 && rN > 0 ? rLoan * (rRate * Math.pow(1 + rRate, rN)) / (Math.pow(1 + rRate, rN) - 1) : 0;
  const rRent = parseFloat(rental.monthlyRent) || 0;
  const rTaxMo = (parseFloat(rental.taxes) || 0) / 12;
  const rIns = (parseFloat(rental.insurance) || 0) / 12;
  const rMaint = parseFloat(rental.maintenance) || 0;
  const rVac = (parseFloat(rental.vacancy) / 100) * rRent;
  const rMgmt = (parseFloat(rental.mgmtPct) / 100) * rRent;
  const totalExpenses = mortgage + rTaxMo + rIns + rMaint + rVac + rMgmt;
  const noi = (rRent - rVac - rMgmt - rTaxMo - rIns - rMaint) * 12;
  const cashFlow = rRent - totalExpenses;
  const capRate = rPrice > 0 ? ((noi / rPrice) * 100).toFixed(2) : 0;
  const cocReturn = rDown > 0 ? (((cashFlow * 12) / rDown) * 100).toFixed(2) : 0;
  const grm = rRent > 0 ? (rPrice / (rRent * 12)).toFixed(1) : 0;

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", color: "#475569", fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Deal Analyzer</h1>
        <p style={{ color: "#64748b", fontSize: 15 }}>Run the numbers before you make an offer</p>
      </div>
      <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 12, padding: 4, width: "fit-content", marginBottom: 28 }}>
        {[{ id: "flip", label: "[Flip] Fix & Flip" }, { id: "rental", label: "[Rental] Buy & Hold" }].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{ padding: "10px 24px", borderRadius: 9, border: "none", background: mode === m.id ? "#fff" : "transparent", color: mode === m.id ? "#0f172a" : "#64748b", fontWeight: mode === m.id ? 700 : 500, fontSize: 14, cursor: "pointer", boxShadow: mode === m.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "flip" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
            <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Deal Inputs</h3>
            {[
              { label: "After Repair Value (ARV)", key: "arv", placeholder: "310,000" },
              { label: "Purchase Price", key: "purchase", placeholder: "195,000" },
              { label: "Estimated Rehab", key: "rehab", placeholder: "62,000" },
              { label: "Hold Period (months)", key: "holdMonths", placeholder: "4" },
              { label: "Selling Costs (%)", key: "sellingPct", placeholder: "6" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" placeholder={f.placeholder} value={flip[f.key]} onChange={e => setFlip({ ...flip, [f.key]: e.target.value })} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: fProfit > 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 16, padding: 24, border: `1px solid ${fProfit > 0 ? "#bbf7d0" : "#fecaca"}` }}>
              <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Projected Results</h3>
              {[
                { label: "ARV", value: fmt(fARV), color: "#15803d" },
                { label: "- Purchase Price", value: fmt(fPurchase), color: "#b91c1c" },
                { label: "- Rehab Cost", value: fmt(fRehab), color: "#b91c1c" },
                { label: "- Est. Holding Costs", value: fmt(holdingEst), color: "#b91c1c" },
                { label: "- Selling Costs", value: fmt(sellCosts), color: "#b91c1c" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <span style={{ fontSize: 13, color: "#475569" }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 4px" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Net Profit</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: fProfit > 0 ? "#15803d" : "#b91c1c" }}>{fProfit >= 0 ? "+" : ""}{fmt(fProfit)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>ROI on cash in</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>{fROI}%</span>
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
              <h3 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Max Allowable Offer</h3>
              {[
                { label: "MAO at 70% Rule", value: fmt(mao70), color: "#3b82f6" },
                { label: "MAO at 65% (conservative)", value: fmt(mao65), color: "#8b5cf6" },
                { label: "Your Offer", value: fPurchase > 0 ? fmt(fPurchase) : "-", color: "#0f172a" },
                { label: "Spread vs. 70% MAO", value: spread !== null ? (spread >= 0 ? `+${fmt(spread)} under` : `${fmt(Math.abs(spread))} over`) : "-", color: spread !== null ? (spread >= 0 ? "#15803d" : "#b91c1c") : "#94a3b8" },
              ].map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 3 ? "1px solid #f8fafc" : "none" }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{m.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === "rental" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
            <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Property Inputs</h3>
            <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Purchase</p>
            {[
              { label: "Purchase Price", key: "price", placeholder: "385,000" },
              { label: "Down Payment (%)", key: "downPct", placeholder: "20" },
              { label: "Interest Rate (%)", key: "rate", placeholder: "7.25" },
              { label: "Loan Term (years)", key: "termYears", placeholder: "30" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" placeholder={f.placeholder} value={rental[f.key]} onChange={e => setRental({ ...rental, [f.key]: e.target.value })} style={inputStyle} />
              </div>
            ))}
            <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", margin: "16px 0 10px" }}>Income &amp; Expenses</p>
            {[
              { label: "Monthly Rent", key: "monthlyRent", placeholder: "2,500" },
              { label: "Annual Property Taxes", key: "taxes", placeholder: "4,200" },
              { label: "Annual Insurance", key: "insurance", placeholder: "1,800" },
              { label: "Monthly Maintenance", key: "maintenance", placeholder: "150" },
              { label: "Vacancy Rate (%)", key: "vacancy", placeholder: "5" },
              { label: "Mgmt Fee (%)", key: "mgmtPct", placeholder: "0" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" placeholder={f.placeholder} value={rental[f.key]} onChange={e => setRental({ ...rental, [f.key]: e.target.value })} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: cashFlow > 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 16, padding: 24, border: `1px solid ${cashFlow > 0 ? "#bbf7d0" : "#fecaca"}` }}>
              <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Monthly Cash Flow</h3>
              {[
                { label: "Gross Rent", value: fmt(rRent), color: "#15803d" },
                { label: "- Mortgage (P&I)", value: fmt(mortgage), color: "#b91c1c" },
                { label: "- Property Taxes", value: fmt(rTaxMo), color: "#b91c1c" },
                { label: "- Insurance", value: fmt(rIns), color: "#b91c1c" },
                { label: "- Maintenance", value: fmt(rMaint), color: "#b91c1c" },
                { label: "- Vacancy", value: fmt(rVac), color: "#b91c1c" },
                { label: "- Mgmt Fee", value: fmt(rMgmt), color: "#b91c1c" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <span style={{ fontSize: 13, color: "#475569" }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 4px" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Net Cash Flow / mo</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: cashFlow > 0 ? "#15803d" : "#b91c1c" }}>{cashFlow >= 0 ? "+" : ""}{fmt(cashFlow)}</span>
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
              <h3 style={{ color: "#0f172a", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Key Metrics</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Down Payment", value: fmt(rDown), color: "#0f172a" },
                  { label: "Mortgage Payment", value: fmt(mortgage), color: "#0f172a" },
                  { label: "Annual NOI", value: fmt(noi), color: "#10b981" },
                  { label: "Cap Rate", value: `${capRate}%`, color: "#3b82f6" },
                  { label: "Cash-on-Cash Return", value: `${cocReturn}%`, color: "#8b5cf6" },
                  { label: "Gross Rent Multiplier", value: `${grm}x`, color: "#f59e0b" },
                ].map((m, i) => (
                  <div key={i} style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
                    <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>{m.label}</p>
                    <p style={{ color: m.color, fontSize: 16, fontWeight: 800 }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------
// MAIN APP
// ---------------------------------------------
function AppShell() {
  const { user, signOut } = useAuth();
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedFlip, setSelectedFlip] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(user?.plan === "trial");
  const [highlightTxId, setHighlightTxId] = useState(null);
  const [highlightExpId, setHighlightExpId] = useState(null);
  const [navSource, setNavSource] = useState(null);
  const [editPropertyId, setEditPropertyId] = useState(null); // triggers edit modal in Properties

  const navigateToTransaction = (txId) => {
    setHighlightTxId(txId);
    setNavSource("dashboard");
    setActiveView("transactions");
  };

  const navigateToFlipExpense = (expId) => {
    setHighlightExpId(expId);
    setNavSource("flipDetail");
    setActiveView("flipexpenses");
  };

  const rentalNavItems = [
    { id: "dashboard",    label: "Dashboard",    icon: LayoutDashboard },
    { id: "properties",   label: "Properties",   icon: Building2       },
    { id: "rentroll",     label: "Rent Roll",     icon: Users           },
    { id: "transactions", label: "Transactions",  icon: ArrowUpDown     },
    { id: "analytics",    label: "Analytics",     icon: BarChart3       },
    { id: "reports",      label: "Reports",       icon: FileText        },
  ];

  const flipNavItems = [
    { id: "flipdashboard",   label: "Dashboard",      icon: LayoutDashboard },
    { id: "flips",           label: "Deals",           icon: Hammer          },
    { id: "flipexpenses",    label: "Expenses",        icon: Receipt         },
    { id: "flipcontractors", label: "Contractors",     icon: Users           },
    { id: "flipanalytics",   label: "Analytics",       icon: BarChart3       },
  ];

  // Cross-cutting tools — apply to both rentals and flips
  const toolNavItems = [
    { id: "dealanalyzer", label: "Deal Analyzer",   icon: Calculator },
    { id: "mileage",      label: "Mileage Tracker",  icon: Car        },
  ];

  const handlePropertySelect = (p) => {
    setSelectedProperty(p);
    setActiveView("propertyDetail");
  };

  const handleFlipSelect = (f) => {
    setSelectedFlip(f);
    setActiveView("flipDetail");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ width: 240, background: "#0f172a", display: "flex", flexDirection: "column", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 100 }}>
        <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={18} color="#fff" />
            </div>
            <div>
              <p style={{ color: "#fff", fontSize: 16, fontWeight: 800, lineHeight: 1 }}>RealVault</p>
              <p style={{ color: "#64748b", fontSize: 11, lineHeight: 1.2, marginTop: 2 }}>Pro Investor Suite</p>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
          <p style={{ color: "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>Rentals</p>
          {rentalNavItems.map(item => {
            const active = activeView === item.id || (item.id === "properties" && activeView === "propertyDetail");
            return (
              <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedProperty(null); setSelectedFlip(null); setHighlightTxId(null); setNavSource(null); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: active ? "rgba(59,130,246,0.2)" : "transparent", color: active ? "#93c5fd" : "#64748b", fontWeight: active ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <item.icon size={17} />
                {item.label}
                {active && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 8px 12px" }} />
          <p style={{ color: "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>Fix &amp; Flip</p>
          {flipNavItems.map(item => {
            const active = activeView === item.id || (item.id === "flips" && activeView === "flipDetail");
            return (
              <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedFlip(null); setSelectedProperty(null); setHighlightTxId(null); setNavSource(null); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: active ? "rgba(245,158,11,0.18)" : "transparent", color: active ? "#fcd34d" : "#64748b", fontWeight: active ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <item.icon size={17} />
                {item.label}
                {active && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 8px 12px" }} />
          <p style={{ color: "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>Tools</p>
          {toolNavItems.map(item => {
            const active = activeView === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedFlip(null); setSelectedProperty(null); setHighlightTxId(null); setNavSource(null); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: active ? "rgba(139,92,246,0.18)" : "transparent", color: active ? "#c4b5fd" : "#64748b", fontWeight: active ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <item.icon size={17} />
                {item.label}
                {active && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
        </nav>
        <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ background: "rgba(59,130,246,0.15)", borderRadius: 12, padding: "12px 14px", marginBottom: 12, border: "1px solid rgba(59,130,246,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Star size={12} color="#fbbf24" fill="#fbbf24" />
              <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 700 }}>{user?.planLabel || "PRO PLAN"}</span>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12 }}>{user?.planDescription || "Unlimited properties"}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
              {user?.initials || "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "User"}</p>
              <p style={{ color: "#64748b", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email || ""}</p>
            </div>
            <SettingsIcon size={16} color="#475569" style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => setShowSettings(true)} />
          </div>
        </div>
      </div>
      <div style={{ flex: 1, marginLeft: 240, display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#0f172a", fontSize: 15, fontWeight: 600 }}>
              {activeView === "propertyDetail" && selectedProperty ? selectedProperty.name :
               activeView === "flipDetail" && selectedFlip ? selectedFlip.name :
               activeView === "dashboard" ? "Dashboard" :
               [...rentalNavItems, ...flipNavItems, ...toolNavItems].find(n => n.id === activeView)?.label || ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <Search size={14} color="#94a3b8" />
              <input placeholder="Quick search..." style={{ border: "none", background: "transparent", fontSize: 14, color: "#475569", outline: "none", width: 160 }} />
            </div>
            <div style={{ position: "relative", cursor: "pointer" }}>
              <Bell size={20} color="#64748b" />
              <div style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" }} />
            </div>
            <div onClick={() => setShowSettings(true)} style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{user?.initials || "?"}</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: 32, maxWidth: 1400, width: "100%" }}>
          {activeView === "dashboard" && <Dashboard onNavigate={setActiveView} onNavigateToTx={navigateToTransaction} />}
          {activeView === "properties" && <Properties onSelect={handlePropertySelect} editPropertyId={editPropertyId} onClearEditId={() => setEditPropertyId(null)} />}
          {activeView === "propertyDetail" && selectedProperty && <PropertyDetail property={selectedProperty} onBack={() => setActiveView("properties")} onEditProperty={(p) => { setEditPropertyId(p.id); setActiveView("properties"); }} onGoToTransactions={() => setActiveView("transactions")} />}
          {activeView === "transactions" && <Transactions highlightTxId={highlightTxId} onBack={navSource === "dashboard" ? () => { setActiveView("dashboard"); setHighlightTxId(null); setNavSource(null); } : null} onClearHighlight={() => setHighlightTxId(null)} />}
          {activeView === "analytics" && <Analytics />}
          {activeView === "reports" && <Reports />}
          {activeView === "flipdashboard"   && <FlipDashboard onSelect={handleFlipSelect} />}
          {activeView === "flips"           && <FlipPipeline onSelect={handleFlipSelect} />}
          {activeView === "flipDetail"      && selectedFlip && <FlipDetail flip={selectedFlip} onBack={() => setActiveView("flips")} onNavigateToExpense={navigateToFlipExpense} />}
          {activeView === "flipexpenses"    && <FlipExpenses highlightExpId={highlightExpId} onBack={navSource === "flipDetail" ? () => { setActiveView("flipDetail"); setHighlightExpId(null); setNavSource(null); } : null} onClearHighlight={() => setHighlightExpId(null)} />}
          {activeView === "flipcontractors" && <FlipContractors />}
          {activeView === "flipanalytics"   && <FlipAnalytics />}
          {activeView === "rentroll" && <RentRoll />}
          {activeView === "mileage" && <MileageTracker />}
          {activeView === "dealanalyzer" && <DealAnalyzer />}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: "min(880px, 95vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
            <Settings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {/* Onboarding Wizard (new users only) */}
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { user } = useAuth();
  return user ? <AppShell /> : <AuthScreen />;
}
