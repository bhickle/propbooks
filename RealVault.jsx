import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
// Build trigger: 2026-04-06
import propbooksLogo from "./logos/PropBooks Horizontal Logo_transparent_white.png";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Building2, LayoutDashboard, ArrowUpDown, BarChart3, FileText,
  TrendingUp, TrendingDown, DollarSign, Home, Plus, Search, Bell,
  ChevronRight, ChevronLeft, Settings as SettingsIcon, LogOut, Filter, Download, Eye, MoreHorizontal,
  Calendar, Tag, CheckCircle, Circle, AlertCircle, X, ChevronDown, User,
  Percent, ArrowUp, ArrowDown, Star, MapPin, Wallet, PieChartIcon,
  Hammer, Clock, Target, Flag, Wrench,
  Users, Route, Calculator, FileCheck, UserCheck, Truck, Layers, Car,
  CheckSquare, Square, PlusCircle, Receipt, UploadCloud, Trash2, Pencil, Info, List,
  CreditCard, MessageSquare, Copy, Camera, Image, AlertTriangle, ArrowRight, ArrowLeft, ExternalLink,
  Paperclip, ScanLine, FileImage, FilePlus, Loader, Phone, Mail, Shield, Sun, Moon,
  CalendarDays, RefreshCw
} from "lucide-react";
import {
  newId, fmt, fmtK,
  PROP_COLORS, DEAL_COLORS, STAGE_ORDER, STAGE_COLORS, DEFAULT_MILESTONES,
  getProperties, addProperty, getTransactions, addTransaction,
  getMonthlyCashFlow, getEquityGrowth, getExpenseCategories,
  getDeals, addDeal, updateDeal, DEALS,
  getDealExpenses, addDealExpense, getContractors, addContractor, CONTRACTORS, DEAL_EXPENSES,
  CONTRACTOR_BIDS, CONTRACTOR_PAYMENTS, CONTRACTOR_DOCUMENTS,
  getDealMilestones, updateDealMilestones, DEAL_MILESTONES,
  REHAB_CATEGORIES, REHAB_CATEGORY_GROUPS, REHAB_TEMPLATES, getCanonicalBySlug, getCanonicalByLabel,
  getTenants, getMileageTrips, addMileageTrip, RENTAL_NOTES, DEAL_NOTES, GENERAL_NOTES, TEAM_MEMBERS, MOCK_USER,
  PROPERTY_DOCUMENTS, addPropertyDocument, deletePropertyDocument,
  DEAL_DOCUMENTS, addDealDocument, deleteDealDocument,
  TENANT_DOCUMENTS, addTenantDocument, deleteTenantDocument,
  MAINTENANCE_REQUESTS, addMaintenanceRequest, updateMaintenanceRequest,
  TRANSACTION_RECEIPTS, addTransactionReceipt, deleteTransactionReceipt,
  DEAL_EXPENSE_RECEIPTS, addDealExpenseReceipt, deleteDealExpenseReceipt,
  mockOcrScan,
} from "./api.js";
import { AuthProvider, AuthScreen, useAuth } from "./auth.jsx";
import { Settings, OnboardingWizard } from "./settings.jsx";
import { DealDashboard, RehabTracker, DealExpenses, DealContractors, ContractorDetail, DealAnalytics, DealMilestones, DealNotes } from "./deals.jsx";
import { DealReports } from "./dealReports.jsx";

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

// Helper: compute depreciable basis for a property
// Uses per-property landValue when available, falls back to TAX_CONFIG.landValuePct estimate
function getDeprBasis(p) {
  const pp = p.purchasePrice || 0;
  if (p.landValue != null && p.landValue > 0) {
    return { basis: Math.max(0, Math.round(pp - p.landValue)), estimated: false, landValue: p.landValue };
  }
  const estLand = Math.round(pp * TAX_CONFIG.landValuePct);
  return { basis: Math.round(pp * TAX_CONFIG.buildingValuePct), estimated: true, landValue: estLand };
}
// ────────────────────────────────────────────────────────────────────

const iS = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" };

// Error Boundary — catches runtime errors and displays them instead of white screen
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { this.setState({ errorInfo }); console.error("ErrorBoundary caught:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return React.createElement("div", { style: { padding: 32, maxWidth: 700, margin: "40px auto", background: "var(--danger-tint)", borderRadius: 16, border: "1px solid var(--danger-border)" } },
        React.createElement("h2", { style: { color: "#991b1b", fontSize: 20, fontWeight: 700, marginBottom: 12 } }, "Something went wrong"),
        React.createElement("pre", { style: { color: "#b91c1c", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "var(--surface)", padding: 16, borderRadius: 10, border: "1px solid var(--danger-border)", marginBottom: 12 } }, String(this.state.error)),
        this.state.errorInfo && React.createElement("pre", { style: { color: "var(--text-secondary)", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 200, overflow: "auto", background: "var(--surface-alt)", padding: 12, borderRadius: 8 } }, this.state.errorInfo.componentStack),
        React.createElement("button", { onClick: () => this.setState({ hasError: false, error: null, errorInfo: null }), style: { marginTop: 12, background: "var(--c-red)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, cursor: "pointer" } }, "Try Again")
      );
    }
    return this.props.children;
  }
}

function Modal({ title, onClose, children, width = 500 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Toast notification context & component
const ToastContext = React.createContext({ showToast: () => {} });
function useToast() { return React.useContext(ToastContext); }
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {toasts.map(t => {
          const colors = { success: { bg: "var(--success-tint)", border: "var(--success-border)", text: "var(--c-green)", icon: "✓" }, error: { bg: "var(--danger-tint)", border: "var(--danger-border)", text: "var(--c-red)", icon: "✕" }, info: { bg: "var(--info-tint-alt)", border: "var(--info-border-alt)", text: "var(--c-blue)", icon: "ℹ" }, warning: { bg: "var(--warning-bg)", border: "var(--warning-border)", text: "var(--warning-text)", icon: "⚠" } };
          const c = colors[t.type] || colors.success;
          return (
            <div key={t.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "12px 18px", color: c.text, fontSize: 14, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 10, animation: "slideInRight 0.25s ease-out", pointerEvents: "auto", maxWidth: 360 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{c.icon}</span>
              {t.message}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes slideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }`}</style>
    </ToastContext.Provider>
  );
}

// ─── THEME CONTEXT (Light / Dark mode) ────────────────────────────────────
// All neutral colors in the app reference CSS custom properties. The
// `data-theme` attribute on the document root swaps the palette globally.
// Brand (#e95e00) and semantic (#10b981, #ef4444, #3b82f6, #f59e0b) colors
// stay consistent in both themes — only neutrals and surfaces flip.
const ThemeContext = React.createContext({ theme: "light", toggleTheme: () => {} });
function useTheme() { return React.useContext(ThemeContext); }
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return window.__pb_theme || "light";
    }
    return "light";
  });
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
      window.__pb_theme = theme;
    }
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme(t => t === "light" ? "dark" : "light"), []);
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <style>{`
        :root {
          --font-display: 'Space Grotesk', 'Inter', sans-serif;
          --surface: #ffffff;
          --surface-alt: #f8fafc;
          --surface-muted: #f1f5f9;
          --page-bg: #f8fafc;
          --sidebar-bg: #041830;
          --text-primary: #041830;
          --text-secondary: #64748b;
          --text-muted: #94a3b8;
          --text-label: #475569;
          --text-dim: #374151;
          --border: #e2e8f0;
          --border-subtle: #f1f5f9;
          --border-strong: #cbd5e1;
          --c-green: #10b981;
          --c-red: #ef4444;
          --c-blue: #3b82f6;
          --c-purple: #8b5cf6;
          --hover-surface: #f8fafc;
          --chart-axis: #94a3b8;
          --chart-grid: #f1f5f9;
          --chart-bar-primary: #1e3a5f;
          --tooltip-bg: #ffffff;
          --tooltip-border: #e2e8f0;
          --tooltip-text: #041830;
          --warning-bg: #fff7ed;
          --warning-border: #fdba74;
          --warning-text: #9a3412;
          --warning-text-secondary: #c2410c;
          --warning-btn-bg: #ffedd5;
          --warning-btn-bg-hover: #fdba74;
          --warning-btn-text: #c2410c;
          --warning-btn-text-hover: #9a3412;
          --success-tint: #f0fdf4;
          --success-border: #bbf7d0;
          --danger-tint: #fef2f2;
          --danger-border: #fecaca;
          --info-tint: #eff6ff;
          --info-border: #bfdbfe;
          --info-border-alt: #bae6fd;
          --info-tint-alt: #f0f9ff;
          --purple-tint: #f5f3ff;
          --active-highlight: #eff6ff;
          --success-badge: #dcfce7;
          --danger-badge: #fee2e2;
          --warning-border-soft: #fed7aa;
          --yellow-tint: #fef3c7;
          --hero-bg: linear-gradient(135deg, #f0f4f8, #e8edf5);
          --hero-border: #e2e8f0;
          --hero-badge-bg: rgba(255,255,255,0.7);
          --hero-select-bg: rgba(255,255,255,0.8);
        }
        :root[data-theme="dark"] {
          --surface: #1e293b;
          --surface-alt: #0f172a;
          --surface-muted: #334155;
          --page-bg: #020617;
          --sidebar-bg: #020617;
          --text-primary: #f1f5f9;
          --text-secondary: #cbd5e1;
          --text-muted: #94a3b8;
          --text-label: #cbd5e1;
          --text-dim: #e2e8f0;
          --border: #334155;
          --border-subtle: #1e293b;
          --border-strong: #475569;
          --c-green: #34d399;
          --c-red: #f87171;
          --c-blue: #60a5fa;
          --c-purple: #a78bfa;
          --hover-surface: #334155;
          --chart-axis: #64748b;
          --chart-grid: #1e293b;
          --chart-bar-primary: #4878a8;
          --tooltip-bg: #1e293b;
          --tooltip-border: #334155;
          --tooltip-text: #f1f5f9;
          --warning-bg: rgba(245, 158, 11, 0.08);
          --warning-border: rgba(245, 158, 11, 0.25);
          --warning-text: #fbbf24;
          --warning-text-secondary: #d97706;
          --warning-btn-bg: rgba(245, 158, 11, 0.12);
          --warning-btn-bg-hover: rgba(245, 158, 11, 0.25);
          --warning-btn-text: #fbbf24;
          --warning-btn-text-hover: #fde68a;
          --success-tint: rgba(16, 185, 129, 0.08);
          --success-border: rgba(16, 185, 129, 0.2);
          --danger-tint: rgba(239, 68, 68, 0.08);
          --danger-border: rgba(239, 68, 68, 0.2);
          --info-tint: rgba(59, 130, 246, 0.08);
          --info-border: rgba(59, 130, 246, 0.2);
          --info-border-alt: rgba(59, 130, 246, 0.25);
          --info-tint-alt: rgba(59, 130, 246, 0.06);
          --purple-tint: rgba(139, 92, 246, 0.08);
          --active-highlight: rgba(59, 130, 246, 0.12);
          --success-badge: rgba(16, 185, 129, 0.15);
          --danger-badge: rgba(239, 68, 68, 0.15);
          --warning-border-soft: rgba(245, 158, 11, 0.2);
          --yellow-tint: rgba(245, 158, 11, 0.12);
          --hero-bg: linear-gradient(135deg, #1e293b, #0f172a);
          --hero-border: #334155;
          --hero-badge-bg: rgba(255,255,255,0.08);
          --hero-select-bg: rgba(255,255,255,0.06);
        }
        :root[data-theme="dark"] body { background: var(--page-bg); }
        :root[data-theme="dark"] input, :root[data-theme="dark"] select, :root[data-theme="dark"] textarea {
          background: var(--surface-alt) !important;
          color: var(--text-primary) !important;
          border-color: var(--border) !important;
        }
        :root[data-theme="dark"] input::placeholder, :root[data-theme="dark"] textarea::placeholder { color: var(--text-muted) !important; }
        :root[data-theme="dark"] ::-webkit-scrollbar-track { background: var(--surface-alt); }
        :root[data-theme="dark"] ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 6px; }
        h1 { font-family: var(--font-display); }
      `}</style>
      {children}
    </ThemeContext.Provider>
  );
}

// Empty state component for list views
function EmptyState({ icon: Icon, title, subtitle, actionLabel, onAction }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center" }}>
      {Icon && <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--surface-alt)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Icon size={28} color="#94a3b8" /></div>}
      <h3 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{title}</h3>
      {subtitle && <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 340, marginBottom: onAction ? 20 : 0 }}>{subtitle}</p>}
      {onAction && actionLabel && <button onClick={onAction} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={16} /> {actionLabel}</button>}
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
  // 5b. Missing land value (depreciation accuracy)
  if (!p.landValue && p.purchasePrice > 0) items.push({ key: "landValue", severity: "low", label: "Land value", detail: "Using 20% estimate — depreciation may be inaccurate", action: "Add land value from tax assessment", field: "landValue" });
  // 6. Income/expenses still estimated (no transactions)
  const eff = getEffectiveMonthly(p, transactions);
  if (eff.source === "estimate") items.push({ key: "transactions", severity: "low", label: "Income & expenses", detail: "Using manual estimates — no transaction history yet", action: "Log transactions for actual averages", field: null });
  // 7. No estimated rent/expenses AND no transactions
  if (!p.monthlyRent && eff.source === "estimate") items.push({ key: "rent", severity: "medium", label: "Monthly rent", detail: "No rent entered and no income transactions logged", action: "Add estimated rent or log income", field: "monthlyRent" });
  return items;
}

function healthBadge(items) {
  if (items.length === 0) return { color: "var(--c-green)", bg: "var(--success-badge)", label: "Up to date" };
  const hasHigh = items.some(i => i.severity === "high");
  const hasMedium = items.some(i => i.severity === "medium");
  if (hasHigh) return { color: "#b91c1c", bg: "var(--danger-badge)", label: `${items.length} update${items.length > 1 ? "s" : ""} needed` };
  if (hasMedium) return { color: "#c2410c", bg: "var(--warning-btn-bg)", label: `${items.length} update${items.length > 1 ? "s" : ""} suggested` };
  return { color: "#6366f1", bg: "#e0e7ff", label: `${items.length} optional update${items.length > 1 ? "s" : ""}` };
}

const PROPERTIES = [
  { id: 1, name: "Maple Ridge Duplex", address: "2847 Maple Ridge Dr, Austin, TX 78701", type: "Multi-Family", units: 2, purchasePrice: 385000, currentValue: 462000, valueUpdatedAt: "2025-10-01", loanAmount: 308000, loanRate: 3.25, loanTermYears: 30, loanStartDate: "2021-03-15", closingCosts: 8470, monthlyRent: 3800, monthlyExpenses: 1640, purchaseDate: "2021-03-15", status: "Occupied", image: "MR", color: "var(--c-blue)", photo: null },
  { id: 2, name: "Lakeview SFR", address: "518 Lakeview Terrace, Denver, CO 80203", type: "Single Family", units: 1, purchasePrice: 520000, currentValue: 598000, valueUpdatedAt: "2025-11-15", loanAmount: 416000, loanRate: 2.875, loanTermYears: 30, loanStartDate: "2020-07-22", closingCosts: 11440, monthlyRent: 2950, monthlyExpenses: 1120, purchaseDate: "2020-07-22", status: "Occupied", image: "LV", color: "var(--c-green)", photo: null },
  { id: 3, name: "Midtown Condo #4B", address: "1200 Peachtree St NE #4B, Atlanta, GA 30309", type: "Condo", units: 1, purchasePrice: 280000, currentValue: 315000, valueUpdatedAt: "2026-01-20", loanAmount: 224000, loanRate: 3.75, loanTermYears: 30, loanStartDate: "2022-01-10", closingCosts: 6160, monthlyRent: 2100, monthlyExpenses: 860, purchaseDate: "2022-01-10", status: "Occupied", image: "MC", color: "var(--c-purple)", photo: null },
  { id: 4, name: "Riverside Triplex", address: "744 Riverside Blvd, Portland, OR 97201", type: "Multi-Family", units: 3, purchasePrice: 670000, currentValue: 745000, valueUpdatedAt: "2025-08-30", loanAmount: 536000, loanRate: 4.0, loanTermYears: 30, loanStartDate: "2019-11-05", closingCosts: 14740, monthlyRent: 5700, monthlyExpenses: 2380, purchaseDate: "2019-11-05", status: "Partial Vacancy", image: "RT", color: "#e95e00", photo: null },
  { id: 5, name: "Sunset Strip Commercial", address: "9220 Sunset Blvd, West Hollywood, CA 90069", type: "Commercial", units: 1, purchasePrice: 1200000, currentValue: 1380000, valueUpdatedAt: "2025-12-05", loanAmount: 900000, loanRate: 4.5, loanTermYears: 25, loanStartDate: "2018-06-30", closingCosts: 26400, monthlyRent: 8500, monthlyExpenses: 3200, purchaseDate: "2018-06-30", status: "Occupied", image: "SS", color: "var(--c-red)", photo: null },
];

// ── Derived financials from transactions ──
// Returns { monthlyIncome, monthlyExpenses, months, source } for a property
// "source" = "transactions" if 2+ months of data, else "estimate" (falls back to property fields)
function calcMonthlyFromTx(propertyId, transactions, fallbackRent, fallbackExp) {
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
function getEffectiveMonthly(p, transactions) {
  return calcMonthlyFromTx(p.id, transactions, p.monthlyRent, p.monthlyExpenses);
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
  { id: 1,  date: "2026-03-20", propertyId: 1, tenantId: 1, category: "Rent Income", description: "March rent - Unit A",       amount:  1900, type: "income",  payee: "Jordan Williams" },
  { id: 2,  date: "2026-03-20", propertyId: 1, tenantId: 2, category: "Rent Income", description: "March rent - Unit B",       amount:  1900, type: "income",  payee: "Priya Patel" },
  { id: 3,  date: "2026-03-18", propertyId: 4, category: "Maintenance", description: "HVAC repair - Unit 2",      amount:  -420, type: "expense", payee: "AirPro HVAC Services" },
  { id: 4,  date: "2026-03-15", propertyId: 2, tenantId: 3, category: "Rent Income", description: "March rent",               amount:  2950, type: "income",  payee: "Marcus Thompson" },
  { id: 5,  date: "2026-03-12", propertyId: 3, category: "HOA Fees",    description: "Monthly HOA",              amount:  -285, type: "expense", payee: "Midtown HOA" },
  { id: 6,  date: "2026-03-10", propertyId: 5, tenantId: 8, category: "Rent Income", description: "March commercial rent",    amount:  8500, type: "income",  payee: "Acme Retail LLC" },
  { id: 7,  date: "2026-03-08", propertyId: 4, tenantId: 5, category: "Rent Income", description: "March rent - Unit 1",      amount:  1950, type: "income",  payee: "Ryan & Keisha Thompson" },
  { id: 16, date: "2026-03-08", propertyId: 4, tenantId: 7, category: "Rent Income", description: "March rent - Unit 3",      amount:  1875, type: "income",  payee: "Carlos Mendez" },
  { id: 8,  date: "2026-03-05", propertyId: 1, category: "Insurance",   description: "Q1 property insurance",   amount: -1200, type: "expense", payee: "State Farm" },
  { id: 9,  date: "2026-03-03", propertyId: 2, category: "Property Tax",description: "Semi-annual tax payment",  amount: -2100, type: "expense", payee: "Denver County Assessor" },
  { id: 10, date: "2026-03-01", propertyId: 3, tenantId: 4, category: "Rent Income", description: "March rent",               amount:  2100, type: "income",  payee: "Keisha Brown" },
  { id: 11, date: "2026-02-28", propertyId: 5, category: "Maintenance", description: "Parking lot reseal",       amount: -3500, type: "expense", payee: "Pacific Paving Co." },
  { id: 12, date: "2026-02-20", propertyId: 4, category: "Mortgage",    description: "February mortgage",        amount: -2840, type: "expense", payee: "US Bank" },
  { id: 13, date: "2026-02-15", propertyId: 1, category: "Mortgage",    description: "February mortgage",        amount: -1620, type: "expense", payee: "Chase Mortgage" },
  { id: 14, date: "2026-02-10", propertyId: 2, category: "Landscaping", description: "Monthly lawn service",     amount:  -180, type: "expense", payee: "Green Thumb Landscaping" },
  { id: 15, date: "2026-02-05", propertyId: 3, category: "Utilities",   description: "Common area utilities",    amount:   -95, type: "expense", payee: "Georgia Power" },
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
  { name: "Mortgage", value: 42, color: "var(--c-blue)" },
  { name: "Maintenance", value: 22, color: "var(--c-green)" },
  { name: "Property Tax", value: 16, color: "var(--c-purple)" },
  { name: "Insurance", value: 10, color: "#e95e00" },
  { name: "HOA", value: 6, color: "var(--c-red)" },
  { name: "Other", value: 4, color: "#6b7280" },
];

// DEALS imported from api.js — using the shared store so new deals created here
// are visible to deals.jsx (ContractorDetail bid dropdown, RehabTracker, etc.)
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

// DEAL_EXPENSES and CONTRACTORS imported from api.js above

// DEFAULT_MILESTONES imported from api.js
// DEAL_MILESTONES is now imported as a flat array from api.js

// Local runtime state: maps deal IDs to milestone arrays with targetDate field added for UI
const _LOCAL_FLIP_MILESTONES = {};

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
  { id: 1, date: "2026-03-22", description: "Inspect Oakdale Craftsman - contractor walkthrough", from: "Home", to: "1422 Oakdale Ave, Nashville", miles: 14.2, purpose: "Deal", businessPct: 100 },
  { id: 2, date: "2026-03-20", description: "Collect rent - Maple Ridge Duplex", from: "Home", to: "2847 Maple Ridge Dr, Austin", miles: 8.5, purpose: "Rental", businessPct: 100 },
  { id: 3, date: "2026-03-18", description: "Meet plumber - Oakdale Craftsman", from: "Home", to: "1422 Oakdale Ave, Nashville", miles: 14.2, purpose: "Deal", businessPct: 100 },
  { id: 4, date: "2026-03-15", description: "Annual inspection - Lakeview SFR", from: "Home", to: "518 Lakeview Terrace, Denver", miles: 22.7, purpose: "Rental", businessPct: 100 },
  { id: 5, date: "2026-03-12", description: "Pine Street Ranch showing", from: "Home", to: "874 Pine Street, Memphis", miles: 18.9, purpose: "Deal", businessPct: 100 },
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
          background: "#041830", color: "#f8fafc", fontSize: 12, lineHeight: 1.5, fontWeight: 400,
          padding: "10px 14px", borderRadius: 10, width: 240, zIndex: 50,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)", pointerEvents: "none", whiteSpace: "normal", border: "1px solid var(--border)",
        }}>
          {text}
          <span style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            border: "6px solid transparent", borderTopColor: "#041830",
          }} />
        </span>
      )}
    </span>
  );
}

// ── AttachmentZone — reusable drag-and-drop / click-to-browse file upload ──
function AttachmentZone({ onFiles, accept = "image/*,.pdf", label = "Drop file here or click to browse", compact = false, scanning = false }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const handleDrop = e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); };
  const handleChange = e => { if (e.target.files.length) { onFiles([...e.target.files]); e.target.value = ""; } };
  if (scanning) {
    return (
      <div style={{ border: "2px dashed #e95e00", borderRadius: 12, padding: compact ? "12px 16px" : "20px 24px", textAlign: "center", background: "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <Loader size={18} color="#e95e00" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, color: "#9a3412", fontWeight: 600 }}>Scanning receipt...</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{ border: `2px dashed ${dragOver ? "#e95e00" : "var(--border)"}`, borderRadius: 12, padding: compact ? "12px 16px" : "20px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "var(--warning-bg)" : "var(--surface-alt)", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <input ref={inputRef} type="file" accept={accept} multiple onChange={handleChange} style={{ display: "none" }} />
      <UploadCloud size={compact ? 16 : 20} color="#94a3b8" />
      <span style={{ fontSize: compact ? 12 : 13, color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}

// ── AttachmentList — shows files with thumbnails, names, and remove buttons ──
function AttachmentList({ items, onRemove, compact = false }) {
  if (!items || items.length === 0) return null;
  const iconForType = mime => {
    if (!mime) return FileText;
    if (mime.startsWith("image/")) return FileImage;
    if (mime.includes("pdf")) return FileText;
    return FileText;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map(item => {
        const Icon = iconForType(item.mimeType);
        return (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-alt)", borderRadius: 10, padding: compact ? "6px 10px" : "8px 12px", border: "1px solid var(--border-subtle)" }}>
            <Icon size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
              {item.size && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.size}</p>}
            </div>
            {item.ocrData && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "#15803d", background: "var(--success-badge)", borderRadius: 6, padding: "2px 6px", flexShrink: 0 }}>OCR</span>
            )}
            {onRemove && (
              <button onClick={e => { e.stopPropagation(); onRemove(item.id); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", color: "var(--text-muted)" }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--c-red)"} onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── OcrPrompt — shown after a receipt is attached, offers to auto-fill form ──
function OcrPrompt({ attachment, onResult, onDismiss }) {
  const [scanning, setScanning] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || attachment.ocrData) return null;

  const isImage = attachment.mimeType?.startsWith("image/");
  const isPdf = attachment.mimeType?.includes("pdf");
  if (!isImage && !isPdf) return null; // only offer OCR for images/PDFs

  const runOcr = async () => {
    setScanning(true);
    try {
      const ocrData = await mockOcrScan({ name: attachment.name, type: attachment.mimeType });
      if (onResult) onResult(ocrData, attachment);
    } catch (err) {
      console.error("OCR failed:", err);
    } finally {
      setScanning(false);
    }
  };

  if (scanning) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--warning-bg)", borderRadius: 10, border: "1px solid var(--warning-border)", marginTop: 6 }}>
        <Loader size={14} color="#e95e00" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 12, color: "var(--warning-text)", fontWeight: 600 }}>Reading receipt...</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--info-tint-alt)", borderRadius: 10, border: "1px solid var(--info-border-alt)", marginTop: 6 }}>
      <ScanLine size={15} color="var(--c-blue)" />
      <span style={{ fontSize: 12, color: "var(--text-primary)", flex: 1 }}>Auto-fill from this receipt?</span>
      <button onClick={runOcr}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: "none", background: "#1e3a5f", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
        <Star size={12} /> Auto-fill
      </button>
      <button onClick={() => { setDismissed(true); if (onDismiss) onDismiss(); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-muted)", display: "flex" }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ── DocumentsPanel — reusable documents tab content for any entity ──
const DOC_TYPE_OPTIONS = [
  { value: "lease", label: "Lease" }, { value: "contract", label: "Contract" }, { value: "insurance", label: "Insurance" },
  { value: "inspection", label: "Inspection" }, { value: "appraisal", label: "Appraisal" }, { value: "closing", label: "Closing Statement" },
  { value: "scope", label: "Scope of Work" }, { value: "addendum", label: "Addendum" }, { value: "application", label: "Application" },
  { value: "w9", label: "W-9" }, { value: "warranty", label: "Warranty" }, { value: "receipt", label: "Receipt" },
  { value: "photo", label: "Photo" }, { value: "other", label: "Other" },
];

function DocumentsPanel({ documents, onAdd, onDelete, entityLabel = "item" }) {
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [docForm, setDocForm] = useState({ name: "", type: "other" });
  const [pendingFiles, setPendingFiles] = useState([]);
  const dsf = k => e => setDocForm(f => ({ ...f, [k]: e.target.value }));

  const handleFilesSelected = (files) => {
    const newPending = files.map(f => ({
      id: newId(), name: f.name, mimeType: f.type,
      size: f.size > 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(1) + " MB" : Math.round(f.size / 1024) + " KB",
      url: URL.createObjectURL(f), file: f,
    }));
    setPendingFiles(prev => [...prev, ...newPending]);
    if (!docForm.name && files.length === 1) setDocForm(f => ({ ...f, name: files[0].name.replace(/\.[^.]+$/, "") }));
  };

  const handleSave = () => {
    if (!docForm.name && pendingFiles.length === 0) return;
    pendingFiles.forEach((pf, idx) => {
      const doc = {
        id: newId(),
        name: docForm.name || pf.name,
        type: docForm.type,
        mimeType: pf.mimeType,
        size: pf.size,
        date: new Date().toISOString().slice(0, 10),
        url: pf.url,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: "usr_001",
      };
      onAdd(doc);
    });
    // If no files but a name, add as a record placeholder
    if (pendingFiles.length === 0 && docForm.name) {
      onAdd({
        id: newId(), name: docForm.name, type: docForm.type, mimeType: null,
        size: null, date: new Date().toISOString().slice(0, 10), url: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: "usr_001",
      });
    }
    setDocForm({ name: "", type: "other" }); setPendingFiles([]); setShowModal(false);
  };

  const typeLabel = t => (DOC_TYPE_OPTIONS.find(o => o.value === t) || {}).label || t;
  const typeColor = t => {
    const colors = { lease: "var(--c-blue)", contract: "var(--c-purple)", insurance: "var(--c-green)", inspection: "#e95e00", appraisal: "#06b6d4", closing: "var(--c-red)", scope: "#ec4899", addendum: "#64748b", application: "#a855f7", w9: "#0ea5e9", warranty: "#22c55e", receipt: "#f97316", photo: "#6366f1" };
    return colors[t] || "#94a3b8";
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Documents</h3>
        <button onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <FilePlus size={14} /> Add Document
        </button>
      </div>

      {documents.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface-alt)", borderRadius: 12, border: "1px dashed var(--border)" }}>
          <FileText size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
          <p>No documents yet</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Upload leases, inspections, receipts, and more</p>
        </div>
      )}

      {documents.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {documents.map(doc => (
            <div key={doc.id} style={{ background: "var(--surface)", borderRadius: 12, padding: 16, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ background: typeColor(doc.type) + "18", borderRadius: 8, padding: 8, flexShrink: 0 }}>
                  {doc.mimeType?.startsWith("image/") ? <FileImage size={18} color={typeColor(doc.type)} /> : <FileText size={18} color={typeColor(doc.type)} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: typeColor(doc.type), background: typeColor(doc.type) + "18", borderRadius: 6, padding: "2px 8px", textTransform: "uppercase" }}>{typeLabel(doc.type)}</span>
                    {doc.size && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{doc.size}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{doc.date}</span>
                <button onClick={() => setDeleteConfirm(doc)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)", borderRadius: 6 }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--c-red)"} onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Document Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { setShowModal(false); setPendingFiles([]); setDocForm({ name: "", type: "other" }); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 28, width: 440, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Add Document</h3>
              <button onClick={() => { setShowModal(false); setPendingFiles([]); setDocForm({ name: "", type: "other" }); }}
                style={{ background: "var(--surface-muted)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}><X size={16} color="var(--text-secondary)" /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Document Name *</label>
                <input type="text" value={docForm.name} onChange={dsf("name")} placeholder="e.g. Lease Agreement" style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Type</label>
                <select value={docForm.type} onChange={dsf("type")} style={iS}>
                  {DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>File</label>
                <AttachmentZone onFiles={handleFilesSelected} accept="image/*,.pdf,.doc,.docx" label="Drop file here or click to browse" />
                {pendingFiles.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <AttachmentList items={pendingFiles} onRemove={id => setPendingFiles(prev => prev.filter(p => p.id !== id))} compact />
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} disabled={!docForm.name && pendingFiles.length === 0}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: (!docForm.name && pendingFiles.length === 0) ? 0.5 : 1 }}>
                Save Document
              </button>
              <button onClick={() => { setShowModal(false); setPendingFiles([]); setDocForm({ name: "", type: "other" }); }}
                style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 28, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Delete Document?</h3>
            <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 20 }}>Remove <strong>{deleteConfirm.name}</strong>? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { onDelete(deleteConfirm.id); setDeleteConfirm(null); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "var(--c-red)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Delete
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function colorWithAlpha(color, alpha) {
  if (color.startsWith("var(")) return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
  const n = parseInt(color.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function StatCard({ icon: Icon, label, value, sub, trend, trendVal, color = "var(--c-blue)", semantic = false, tip }) {
  const up = trend === "up";
  const iconBg = semantic ? colorWithAlpha(color, 0.1) : "#1e3a5f";
  const iconColor = semantic ? color : "#e95e00";
  return (
    <div style={{ background: "var(--surface)", borderRadius: 16, padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)", border: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
            <p style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            {tip && <InfoTip text={tip} />}
          </div>
          <p style={{ color: "var(--text-primary)", fontSize: 28, fontWeight: 700, lineHeight: 1, fontFamily: "var(--font-display)" }}>{value}</p>
          {sub && <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 6 }}>{sub}</p>}
        </div>
        <div style={{ background: iconBg, borderRadius: 12, padding: 12 }}>
          <Icon size={22} color={iconColor} />
        </div>
      </div>
      {trendVal && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
          {up ? <ArrowUp size={14} color="var(--c-green)" /> : <ArrowDown size={14} color="var(--c-red)" />}
          <span style={{ fontSize: 13, fontWeight: 600, color: up ? "var(--c-green)" : "var(--c-red)" }}>{trendVal}</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>vs last month</span>
        </div>
      )}
    </div>
  );
}

function Badge({ status }) {
  const map = {
    "Occupied": { bg: "var(--success-badge)", text: "#15803d" },
    "Partial Vacancy": { bg: "var(--warning-bg)", text: "var(--warning-text)" },
    "Vacant": { bg: "var(--danger-badge)", text: "#b91c1c" },
  };
  const s = map[status] || map["Occupied"];
  return (
    <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      {status}
    </span>
  );
}

// =============================================================================
// NEEDS ATTENTION — action center alerts store and generators
// =============================================================================
// Module-level mutable store. Each entry is keyed by a deterministic ID of the
// form `{alertType}:{entityId}:{period}` where period narrows the alert to a
// specific occurrence (e.g. "rentOverdue:3:2026-04") so dismissing March's
// alert never suppresses April's.
//
// Shape: { id, state: "dismissed" | "snoozed", snoozeUntil: "YYYY-MM-DD" | null, updatedAt }
const _ALERT_STATE = {};

const alertStateFor = (id) => _ALERT_STATE[id] || null;
const dismissAlert  = (id) => { _ALERT_STATE[id] = { id, state: "dismissed", snoozeUntil: null, updatedAt: new Date().toISOString() }; };
const snoozeAlert   = (id, days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  _ALERT_STATE[id] = { id, state: "snoozed", snoozeUntil: d.toISOString().slice(0, 10), updatedAt: new Date().toISOString() };
};
const clearAlertState = (id) => { delete _ALERT_STATE[id]; };

// Is the alert currently suppressed by snooze/dismiss?
function isAlertSuppressed(id) {
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
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

// Canonical "did this tenant pay rent this month?" check — single source of
// truth used by both the Needs Attention alert generator and the Rental
// Dashboard's Rent Collection card. Reads TRANSACTIONS, not tenant.lastPayment,
// so the two views can never drift apart.
//
// Match logic:
//   1. Any income tx on the tenant's property this month where payee === tenant.name → paid
//   2. Fallback: if every rent-income tx on the property this month has no payee set,
//      assume the property-level rent covers its tenants (handles seed data and
//      single-tenant properties).
function wasRentPaidThisMonth(tenant, transactions, monthStr) {
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

// Build the alert list from current app state. Each call is pure — no side
// effects — so the list auto-refreshes when underlying data changes. Alerts
// are filtered through `isAlertSuppressed` so dismissed/snoozed items don't
// appear until the condition recurs (new period key) or the snooze expires.
function generateAlerts({ properties, tenants, transactions, deals, contractors }) {
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

// =============================================================================
// SHARED RENT-PAYMENT ACTION — used by both dashboards
// =============================================================================
// Canonical "log a rent payment" write. The only place TRANSACTIONS is mutated
// for a rent payment so Rental Dashboard's Rent Collection card and the
// Needs Attention card on Portfolio Dashboard produce identical records.
function logRentPayment(tenant, { amount, date, mode }) {
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

// Inline Mark-Paid form — rendered under an alert row or unpaid-tenant row.
// Self-contained state. Parent only supplies the tenant, a todayStr default,
// and an onConfirm callback invoked after logRentPayment writes.
function QuickPayInline({ tenant, defaultDate, onConfirm }) {
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
          style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: mode === "full" ? "1.5px solid #10b981" : "1.5px solid var(--border)", background: mode === "full" ? "var(--success-badge)" : "var(--surface)", color: mode === "full" ? "#15803d" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
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

// =============================================================================
// ONBOARDING WIZARDS — full-screen guided flows for adding rentals and flips
// =============================================================================

// Shared wizard shell: progress bar + step navigation + layout
function WizardShell({ steps, currentStep, onStepClick, title, subtitle, onExit, children }) {
  const sectionS = { background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" };
  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-alt)" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", background: "var(--surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "2px 0 0" }}>{subtitle}</p>}
        </div>
        <button onClick={onExit} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <X size={14} /> Exit
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: "24px 32px 0" }}>
        {steps.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <React.Fragment key={i}>
              <div onClick={() => i < currentStep && onStepClick(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: i < currentStep ? "pointer" : "default", minWidth: 100 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? "var(--c-green)" : active ? "#e95e00" : "var(--surface-muted)", color: done || active ? "#fff" : "#94a3b8", fontSize: 14, fontWeight: 700, transition: "all 0.2s" }}>
                  {done ? <CheckCircle size={18} /> : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "var(--text-primary)" : done ? "var(--c-green)" : "var(--text-muted)", textAlign: "center" }}>{step}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ height: 2, width: 60, background: done ? "var(--c-green)" : "var(--border)", marginBottom: 20, transition: "background 0.2s" }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step content */}
      <div style={{ maxWidth: 700, margin: "28px auto 0", padding: "0 32px 60px" }}>
        {children}
      </div>
    </div>
  );
}

// Shared wizard step navigation buttons
function WizardNav({ onBack, onNext, onSkip, nextLabel, backLabel, nextDisabled }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
      {onBack ? (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          <ArrowLeft size={16} /> {backLabel || "Back"}
        </button>
      ) : <div />}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {onSkip && (
          <button onClick={onSkip} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "10px 4px" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text-secondary)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>
            Skip this step
          </button>
        )}
        <button onClick={onNext} disabled={nextDisabled}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 24px", borderRadius: 10, border: "none", background: nextDisabled ? "var(--border-strong)" : "#e95e00", color: "#fff", fontSize: 14, fontWeight: 700, cursor: nextDisabled ? "not-allowed" : "pointer", transition: "background 0.15s" }}>
          {nextLabel || "Continue"} {nextLabel !== "Add to Portfolio" && nextLabel !== "Add to Pipeline" && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  );
}

// Shared form field component for wizard steps
function WizardField({ label, hint, required, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
        {label} {required && <span style={{ color: "var(--c-red)" }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>{hint}</p>}
    </div>
  );
}

const wizardInput = { padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 14, color: "var(--text-primary)", background: "var(--surface)", outline: "none", width: "100%", boxSizing: "border-box" };
const wizardSelect = { ...wizardInput, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" };

// ── RENTAL WIZARD ─────────────────────────────────────────────────────────
function RentalWizard({ onComplete, onExit }) {
  const { showToast } = useToast();
  const steps = ["Property", "Financials", "Tenants", "Review"];
  const [step, setStep] = useState(0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Step 1: Property basics
  const [basics, setBasics] = useState({ name: "", address: "", type: "Single Family", units: "1", status: "Occupied", purchaseDate: todayStr });
  const sb = k => e => setBasics(f => ({ ...f, [k]: e.target.value }));

  // Step 2: Financials
  const [fin, setFin] = useState({ purchasePrice: "", currentValue: "", closingCosts: "", loanAmount: "", loanRate: "", loanTermYears: "30", loanStartDate: todayStr, monthlyRent: "", monthlyExpenses: "" });
  const sf = k => e => setFin(f => ({ ...f, [k]: e.target.value }));

  // Mortgage calc
  const loanAmt = parseFloat(fin.loanAmount) || 0;
  const loanRate = parseFloat(fin.loanRate) || 0;
  const loanTerm = parseFloat(fin.loanTermYears) || 30;
  const monthlyMortgage = loanAmt > 0 && loanRate > 0
    ? (loanAmt * (loanRate / 100 / 12)) / (1 - Math.pow(1 + loanRate / 100 / 12, -loanTerm * 12))
    : 0;

  // Step 3: Tenants
  const unitCount = parseInt(basics.units) || 1;
  const [tenants, setTenants] = useState([]);
  useEffect(() => {
    setTenants(prev => {
      const arr = [];
      for (let i = 0; i < unitCount; i++) {
        arr.push(prev[i] || { name: "", unit: unitCount === 1 ? "Main" : `Unit ${i + 1}`, rent: fin.monthlyRent && unitCount === 1 ? fin.monthlyRent : "", leaseStart: "", leaseEnd: "", status: "active-lease", vacant: false });
      }
      return arr;
    });
  }, [unitCount]);
  const setTenant = (i, k, v) => setTenants(prev => prev.map((t, j) => j === i ? { ...t, [k]: v } : t));

  const canProceed = [
    basics.name.trim().length > 0,  // step 0
    true,  // step 1 — financials are optional
    true,  // step 2 — tenants optional
    true,  // step 3 — review, always submittable
  ];

  const handleSave = () => {
    const val = parseFloat(fin.currentValue) || parseFloat(fin.purchasePrice) || 0;
    const usedColors = PROPERTIES.map(p => p.color);
    const color = PROP_COLORS.find(c => !usedColors.includes(c)) || PROP_COLORS[PROPERTIES.length % PROP_COLORS.length];
    const propId = newId();
    PROPERTIES.push({
      id: propId, name: basics.name, address: basics.address, type: basics.type,
      units: unitCount, purchasePrice: parseFloat(fin.purchasePrice) || 0,
      currentValue: val, valueUpdatedAt: todayStr,
      loanAmount: loanAmt, loanRate, loanTermYears: loanTerm,
      loanStartDate: fin.loanStartDate || "",
      closingCosts: parseFloat(fin.closingCosts) || 0, landValue: null,
      monthlyRent: parseFloat(fin.monthlyRent) || 0,
      monthlyExpenses: parseFloat(fin.monthlyExpenses) || 0,
      purchaseDate: basics.purchaseDate || "",
      status: basics.status,
      image: basics.name.slice(0, 2).toUpperCase(), color, photo: null,
    });
    // Create tenants
    tenants.forEach(t => {
      if (t.vacant) {
        TENANTS.push({ id: newId(), propertyId: propId, name: "", unit: t.unit, rent: parseFloat(t.rent) || 0, leaseStart: "", leaseEnd: "", status: "vacant", lastPayment: null, phone: "", email: "" });
      } else if (t.name.trim()) {
        TENANTS.push({ id: newId(), propertyId: propId, name: t.name, unit: t.unit, rent: parseFloat(t.rent) || 0, leaseStart: t.leaseStart || "", leaseEnd: t.leaseEnd || "", status: t.status || "active-lease", lastPayment: null, phone: "", email: "" });
      }
    });
    showToast(`"${basics.name}" added to portfolio with ${tenants.filter(t => !t.vacant && t.name.trim()).length} tenant(s)`);
    onComplete && onComplete();
  };

  const handleExit = () => {
    if (basics.name.trim()) { setShowExitConfirm(true); } else { onExit(); }
  };
  const handleSaveAndExit = () => {
    handleSave();
    showToast(`"${basics.name}" saved — you can finish editing from the property detail screen`);
  };

  return (
    <WizardShell steps={steps} currentStep={step} onStepClick={setStep} title="Add Rental Property" subtitle="We'll walk you through setting up your property, financials, and tenants." onExit={handleExit}>
      {showExitConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Save before leaving?</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
              You've started adding "{basics.name}". Would you like to save what you have so far? You can finish filling in the details later.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onExit} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Discard</button>
              <button onClick={handleSaveAndExit} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save & Exit</button>
            </div>
          </div>
        </div>
      )}

      {step === 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Property Details</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Basic info about the property — you can always edit this later.</p>
          <WizardField label="Property Name" required hint="e.g. 'Maple Street Duplex' or '123 Main St'">
            <input value={basics.name} onChange={sb("name")} style={wizardInput} placeholder="Enter property name" autoFocus />
          </WizardField>
          <WizardField label="Address" hint="Full street address">
            <input value={basics.address} onChange={sb("address")} style={wizardInput} placeholder="123 Main St, City, State ZIP" />
          </WizardField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WizardField label="Property Type">
              <select value={basics.type} onChange={sb("type")} style={wizardSelect}>
                {["Single Family", "Duplex", "Triplex", "Fourplex", "Apartment", "Condo", "Townhouse", "Commercial", "Mixed Use"].map(t => <option key={t}>{t}</option>)}
              </select>
            </WizardField>
            <WizardField label="Units" hint="Total rentable units">
              <input type="number" min="1" value={basics.units} onChange={sb("units")} style={wizardInput} />
            </WizardField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WizardField label="Purchase Date">
              <input type="date" value={basics.purchaseDate} onChange={sb("purchaseDate")} style={wizardInput} />
            </WizardField>
            <WizardField label="Status">
              <select value={basics.status} onChange={sb("status")} style={wizardSelect}>
                {["Occupied", "Partially Vacant", "Vacant", "Renovating"].map(s => <option key={s}>{s}</option>)}
              </select>
            </WizardField>
          </div>
          <WizardNav onNext={() => setStep(1)} nextDisabled={!canProceed[0]} />
        </div>
      )}

      {step === 1 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Financials</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Purchase details and loan info. Skip anything you don't have yet.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WizardField label="Purchase Price">
              <input type="number" value={fin.purchasePrice} onChange={sf("purchasePrice")} style={wizardInput} placeholder="$0" />
            </WizardField>
            <WizardField label="Current Market Value" hint="Zillow, appraisal, or your best estimate">
              <input type="number" value={fin.currentValue} onChange={sf("currentValue")} style={wizardInput} placeholder="$0" />
            </WizardField>
          </div>
          <WizardField label="Closing Costs">
            <input type="number" value={fin.closingCosts} onChange={sf("closingCosts")} style={wizardInput} placeholder="$0" />
          </WizardField>

          <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "20px 0", paddingTop: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Loan Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <WizardField label="Loan Amount">
                <input type="number" value={fin.loanAmount} onChange={sf("loanAmount")} style={wizardInput} placeholder="$0" />
              </WizardField>
              <WizardField label="Interest Rate (%)">
                <input type="number" step="0.01" value={fin.loanRate} onChange={sf("loanRate")} style={wizardInput} placeholder="0.00" />
              </WizardField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <WizardField label="Loan Term (years)">
                <input type="number" value={fin.loanTermYears} onChange={sf("loanTermYears")} style={wizardInput} placeholder="30" />
              </WizardField>
              <WizardField label="Loan Start Date">
                <input type="date" value={fin.loanStartDate} onChange={sf("loanStartDate")} style={wizardInput} />
              </WizardField>
            </div>
            {monthlyMortgage > 0 && (
              <div style={{ background: "var(--success-tint)", border: "1px solid var(--success-border)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <DollarSign size={16} color="var(--c-green)" />
                <span style={{ fontSize: 13, color: "#15803d" }}>Estimated monthly payment: <strong>{fmt(Math.round(monthlyMortgage))}</strong></span>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "20px 0", paddingTop: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Monthly Cash Flow</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <WizardField label="Monthly Rent" hint="Total across all units">
                <input type="number" value={fin.monthlyRent} onChange={sf("monthlyRent")} style={wizardInput} placeholder="$0" />
              </WizardField>
              <WizardField label="Monthly Expenses" hint="Taxes, insurance, maintenance, etc.">
                <input type="number" value={fin.monthlyExpenses} onChange={sf("monthlyExpenses")} style={wizardInput} placeholder="$0" />
              </WizardField>
            </div>
          </div>
          <WizardNav onBack={() => setStep(0)} onNext={() => setStep(2)} onSkip={() => setStep(2)} />
        </div>
      )}

      {step === 2 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Tenants</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            {unitCount === 1 ? "Add your tenant info, or mark as vacant." : `${unitCount} units detected — add tenant info for each, or mark vacant units.`}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {tenants.slice(0, unitCount).map((t, i) => (
              <div key={i} style={{ borderRadius: 12, border: t.vacant ? "1.5px dashed #cbd5e1" : "1px solid var(--border)", padding: 20, background: t.vacant ? "var(--surface-alt)" : "var(--surface)", transition: "all 0.15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: t.vacant ? 0 : 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: t.vacant ? "var(--surface-muted)" : "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {t.vacant ? <Home size={14} color="#94a3b8" /> : <User size={14} color="var(--c-blue)" />}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{t.unit}</span>
                  </div>
                  <button onClick={() => setTenant(i, "vacant", !t.vacant)}
                    style={{ fontSize: 12, fontWeight: 600, color: t.vacant ? "var(--c-blue)" : "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>
                    {t.vacant ? "Add Tenant" : "Mark Vacant"}
                  </button>
                </div>
                {!t.vacant && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <WizardField label="Tenant Name">
                        <input value={t.name} onChange={e => setTenant(i, "name", e.target.value)} style={wizardInput} placeholder="Full name" />
                      </WizardField>
                      <WizardField label="Monthly Rent">
                        <input type="number" value={t.rent} onChange={e => setTenant(i, "rent", e.target.value)} style={wizardInput} placeholder="$0" />
                      </WizardField>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <WizardField label="Lease Start">
                        <input type="date" value={t.leaseStart} onChange={e => setTenant(i, "leaseStart", e.target.value)} style={wizardInput} />
                      </WizardField>
                      <WizardField label="Lease End">
                        <input type="date" value={t.leaseEnd} onChange={e => setTenant(i, "leaseEnd", e.target.value)} style={wizardInput} />
                      </WizardField>
                      <WizardField label="Status">
                        <select value={t.status} onChange={e => setTenant(i, "status", e.target.value)} style={wizardSelect}>
                          <option value="active-lease">Active Lease</option>
                          <option value="month-to-month">Month-to-Month</option>
                        </select>
                      </WizardField>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <WizardNav onBack={() => setStep(1)} onNext={() => setStep(3)} onSkip={() => setStep(3)} />
        </div>
      )}

      {step === 3 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Review & Save</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Everything look right? You can always edit details later.</p>

          {/* Property summary */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-alt)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Home size={16} color="var(--c-blue)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Property</span>
              </div>
              <button onClick={() => setStep(0)} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-blue)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            </div>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Name:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.name || "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Type:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.type}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Address:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.address || "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Units:</span> <strong style={{ color: "var(--text-primary)" }}>{unitCount}</strong></div>
            </div>
          </div>

          {/* Financials summary */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-alt)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <DollarSign size={16} color="var(--c-green)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Financials</span>
              </div>
              <button onClick={() => setStep(1)} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-blue)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            </div>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Purchase:</span> <strong style={{ color: "var(--text-primary)" }}>{fin.purchasePrice ? fmt(parseFloat(fin.purchasePrice)) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Value:</span> <strong style={{ color: "var(--text-primary)" }}>{fin.currentValue ? fmt(parseFloat(fin.currentValue)) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Loan:</span> <strong style={{ color: "var(--text-primary)" }}>{fin.loanAmount ? fmt(parseFloat(fin.loanAmount)) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Mortgage:</span> <strong style={{ color: "var(--text-primary)" }}>{monthlyMortgage > 0 ? `${fmt(Math.round(monthlyMortgage))}/mo` : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Rent:</span> <strong style={{ color: "var(--c-green)" }}>{fin.monthlyRent ? `${fmt(parseFloat(fin.monthlyRent))}/mo` : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Expenses:</span> <strong style={{ color: "var(--c-red)" }}>{fin.monthlyExpenses ? `${fmt(parseFloat(fin.monthlyExpenses))}/mo` : "—"}</strong></div>
            </div>
          </div>

          {/* Tenants summary */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-alt)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} color="var(--c-purple)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Tenants ({tenants.filter(t => !t.vacant && t.name.trim()).length})</span>
              </div>
              <button onClick={() => setStep(2)} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-blue)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            </div>
            <div style={{ padding: 16 }}>
              {tenants.slice(0, unitCount).map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < unitCount - 1 ? "1px solid var(--border-subtle)" : "none", fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.unit}</span>
                    <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{t.vacant ? "Vacant" : t.name || "No tenant"}</span>
                  </div>
                  {!t.vacant && t.rent && <span style={{ fontWeight: 600, color: "var(--c-green)" }}>{fmt(parseFloat(t.rent))}/mo</span>}
                </div>
              ))}
            </div>
          </div>
          <WizardNav onBack={() => setStep(2)} onNext={handleSave} nextLabel="Add to Portfolio" nextDisabled={!basics.name.trim()} />
        </div>
      )}
    </WizardShell>
  );
}

// ── FLIP WIZARD ───────────────────────────────────────────────────────────
function FlipWizard({ onComplete, onExit }) {
  const { showToast } = useToast();
  const steps = ["Deal Info", "Financials", "Rehab Scope", "Review"];
  const [step, setStep] = useState(0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Step 1: Deal basics
  const [basics, setBasics] = useState({ name: "", address: "", stage: "Under Contract", acquisitionDate: todayStr, projectedCloseDate: "" });
  const sb = k => e => setBasics(f => ({ ...f, [k]: e.target.value }));

  // Step 2: Financials
  const [fin, setFin] = useState({ purchasePrice: "", arv: "", rehabBudget: "", holdingCostsPerMonth: "" });
  const sf = k => e => setFin(f => ({ ...f, [k]: e.target.value }));

  // Projected profit calc
  const pp = parseFloat(fin.purchasePrice) || 0;
  const arv = parseFloat(fin.arv) || 0;
  const rb = parseFloat(fin.rehabBudget) || 0;
  const hc = parseFloat(fin.holdingCostsPerMonth) || 0;
  const sellingCostPct = 6;
  const projectedProfit = arv > 0 ? arv - pp - rb - (hc * 6) - (arv * sellingCostPct / 100) : 0;

  // Step 3: Rehab scope — uses same canonical category taxonomy as RehabTracker
  const allCategories = useMemo(() => {
    const canonicalLabels = new Set(REHAB_CATEGORIES.map(c => c.label.toLowerCase()));
    const customSet = new Set();
    DEALS.forEach(f => (f.rehabItems || []).forEach(i => {
      if (i.category && !canonicalLabels.has(i.category.toLowerCase())) customSet.add(i.category);
    }));
    return { canonical: REHAB_CATEGORIES, custom: [...customSet].sort() };
  }, []);
  const [rehabItems, setRehabItems] = useState([]);
  const [catFocusIdx, setCatFocusIdx] = useState(-1);
  const setRehab = (i, k, v) => setRehabItems(prev => prev.map((item, j) => j === i ? { ...item, [k]: v } : item));
  const addRehabItem = () => setRehabItems(prev => [...prev, { label: "", budgeted: "", canonicalCategory: null }]);
  const removeRehabItem = (i) => { setRehabItems(prev => prev.filter((_, j) => j !== i)); if (catFocusIdx === i) setCatFocusIdx(-1); };
  const rehabTotal = rehabItems.reduce((s, item) => s + (parseFloat(item.budgeted) || 0), 0);

  const handleSave = () => {
    const initials = basics.name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
    const colors = ["#e95e00", "var(--c-blue)", "var(--c-green)", "var(--c-purple)", "var(--c-red)", "#ec4899"];
    const color = colors[DEALS.length % colors.length];
    const rehabBudgetTotal = rehabTotal || rb;
    const newDeal = {
      id: newId(), name: basics.name, address: basics.address || "",
      stage: basics.stage, image: initials, color,
      purchasePrice: pp, arv, rehabBudget: rehabBudgetTotal, rehabSpent: 0,
      holdingCostsPerMonth: hc,
      acquisitionDate: basics.acquisitionDate || "",
      projectedCloseDate: basics.projectedCloseDate || "",
      daysOwned: 0,
      rehabItems: rehabItems.filter(item => item.label.trim() && (parseFloat(item.budgeted) || 0) > 0).map(item => {
        const canon = item.canonicalCategory || getCanonicalByLabel(item.label)?.slug || null;
        return { id: newId(), category: item.label, canonicalCategory: canon, budgeted: parseFloat(item.budgeted) || 0, spent: 0, status: "pending", notes: "" };
      }),
    };
    DEALS.push(newDeal);
    if (typeof _LOCAL_FLIP_MILESTONES !== "undefined") {
      _LOCAL_FLIP_MILESTONES[newDeal.id] = DEFAULT_MILESTONES.map(label => ({ label, done: false, date: null, targetDate: null }));
    }
    showToast(`"${basics.name}" added to pipeline with ${newDeal.rehabItems.length} rehab line items`);
    onComplete && onComplete();
  };

  const handleExit = () => {
    if (basics.name.trim()) { setShowExitConfirm(true); } else { onExit(); }
  };
  const handleSaveAndExit = () => {
    handleSave();
    showToast(`"${basics.name}" saved — you can finish editing from the deal detail screen`);
  };

  return (
    <WizardShell steps={steps} currentStep={step} onStepClick={setStep} title="Add Fix & Flip Deal" subtitle="We'll walk you through the deal details, financials, and rehab scope." onExit={handleExit}>
      {showExitConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Save before leaving?</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
              You've started adding "{basics.name}". Would you like to save what you have so far? You can finish filling in the details later.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onExit} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Discard</button>
              <button onClick={handleSaveAndExit} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save & Exit</button>
            </div>
          </div>
        </div>
      )}

      {step === 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Deal Information</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Basic info about the deal — name it something memorable.</p>
          <WizardField label="Deal Name" required hint="e.g. '42 Oak Ave Flip' or 'The Blue House'">
            <input value={basics.name} onChange={sb("name")} style={wizardInput} placeholder="Enter deal name" autoFocus />
          </WizardField>
          <WizardField label="Address">
            <input value={basics.address} onChange={sb("address")} style={wizardInput} placeholder="123 Main St, City, State ZIP" />
          </WizardField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <WizardField label="Stage">
              <select value={basics.stage} onChange={sb("stage")} style={wizardSelect}>
                {STAGE_ORDER.filter(s => s !== "Sold" && s !== "Converted to Rental").map(s => <option key={s}>{s}</option>)}
              </select>
            </WizardField>
            <WizardField label="Acquisition Date">
              <input type="date" value={basics.acquisitionDate} onChange={sb("acquisitionDate")} style={wizardInput} />
            </WizardField>
            <WizardField label="Projected Close">
              <input type="date" value={basics.projectedCloseDate} onChange={sb("projectedCloseDate")} style={wizardInput} />
            </WizardField>
          </div>
          <WizardNav onNext={() => setStep(1)} nextDisabled={!basics.name.trim()} />
        </div>
      )}

      {step === 1 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Financials</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Purchase price, ARV, and budget. You'll add detailed rehab line items in the next step.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WizardField label="Purchase Price" required>
              <input type="number" value={fin.purchasePrice} onChange={sf("purchasePrice")} style={wizardInput} placeholder="$0" />
            </WizardField>
            <WizardField label="After Repair Value (ARV)" hint="What you expect to sell for">
              <input type="number" value={fin.arv} onChange={sf("arv")} style={wizardInput} placeholder="$0" />
            </WizardField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WizardField label="Estimated Rehab Budget" hint="Rough total — you'll itemize in the next step">
              <input type="number" value={fin.rehabBudget} onChange={sf("rehabBudget")} style={wizardInput} placeholder="$0" />
            </WizardField>
            <WizardField label="Monthly Holding Costs" hint="Taxes, insurance, utilities, loan payments">
              <input type="number" value={fin.holdingCostsPerMonth} onChange={sf("holdingCostsPerMonth")} style={wizardInput} placeholder="$0" />
            </WizardField>
          </div>
          {projectedProfit !== 0 && (
            <div style={{ background: projectedProfit > 0 ? "var(--success-tint)" : "var(--danger-tint)", border: `1px solid ${projectedProfit > 0 ? "var(--success-border)" : "var(--danger-border)"}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <TrendingUp size={16} color={projectedProfit > 0 ? "var(--c-green)" : "var(--c-red)"} />
              <span style={{ fontSize: 13, color: projectedProfit > 0 ? "#15803d" : "#b91c1c" }}>
                Projected profit: <strong>{fmt(Math.round(projectedProfit))}</strong>
                <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>(assumes 6% selling costs, 6 month hold)</span>
              </span>
            </div>
          )}
          <WizardNav onBack={() => setStep(0)} onNext={() => setStep(2)} onSkip={() => setStep(2)} />
        </div>
      )}

      {step === 2 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Rehab Scope</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            {rehabItems.length === 0
              ? "Pick a template to pre-populate standard scopes with suggested budgets, or build your own from scratch."
              : "Adjust budgets, remove items you don't need, or add custom line items."}
          </p>

          {/* Template picker — shown when no items yet (mirrors RehabTracker empty state) */}
          {rehabItems.length === 0 && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Wrench size={24} color="#e95e00" />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Start your rehab scope</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 460, margin: "0 auto" }}>Pick a template to pre-populate standard scopes with suggested budgets, or build your own from scratch.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginBottom: 14 }}>
                {REHAB_TEMPLATES.map(tpl => {
                  const total = tpl.items.reduce((s, i) => s + (i.budgeted || 0), 0);
                  return (
                    <button key={tpl.id} onClick={() => {
                      const seeded = tpl.items.map(i => {
                        const canon = getCanonicalBySlug(i.slug);
                        return { label: canon?.label || i.slug, canonicalCategory: i.slug, budgeted: String(i.budgeted || 0) };
                      });
                      setRehabItems(seeded);
                    }} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 18, textAlign: "left", cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#e95e00"; e.currentTarget.style.background = "var(--warning-bg)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{tpl.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10, minHeight: 30 }}>{tpl.description}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{tpl.items.length} items</span>
                        <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>{fmt(total)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ textAlign: "center" }}>
                <button onClick={addRehabItem} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>or start from scratch</button>
              </div>
            </div>
          )}

          {/* Rehab item list — shown after template selection or manual add */}
          {rehabItems.length > 0 && (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rehabItems.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ position: "relative", flex: 2 }}>
                      <input value={item.label}
                        onChange={e => { setRehab(i, "label", e.target.value); setRehab(i, "canonicalCategory", null); setCatFocusIdx(i); }}
                        onFocus={() => setCatFocusIdx(i)}
                        onBlur={() => setTimeout(() => setCatFocusIdx(-1), 150)}
                        style={wizardInput} placeholder="Start typing to search categories..." />
                      {catFocusIdx === i && (() => {
                        const q = item.label.toLowerCase().trim();
                        const canonMatches = q ? allCategories.canonical.filter(c => c.label.toLowerCase().includes(q)) : allCategories.canonical;
                        const customMatches = q ? allCategories.custom.filter(c => c.toLowerCase().includes(q)) : allCategories.custom;
                        const alreadyUsed = new Set(rehabItems.map((r, j) => j !== i ? r.label.toLowerCase() : null).filter(Boolean));
                        const filteredCanon = canonMatches.filter(c => !alreadyUsed.has(c.label.toLowerCase()));
                        const filteredCustom = customMatches.filter(c => !alreadyUsed.has(c.toLowerCase()));
                        const exactExists = [...allCategories.canonical.map(c => c.label), ...allCategories.custom].some(c => c.toLowerCase() === q);
                        const showNew = q && !exactExists;
                        if (filteredCanon.length === 0 && filteredCustom.length === 0 && !showNew) return null;
                        const grouped = REHAB_CATEGORY_GROUPS.map(g => ({ group: g, items: filteredCanon.filter(c => c.group === g) })).filter(g => g.items.length > 0);
                        return (
                          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                            {grouped.map(({ group, items }) => (
                              <div key={group}>
                                <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)", borderBottom: "1px solid var(--border-subtle)" }}>{group}</div>
                                {items.map(c => (
                                  <button key={c.slug} type="button"
                                    onMouseDown={() => { setRehab(i, "label", c.label); setRehab(i, "canonicalCategory", c.slug); setCatFocusIdx(-1); }}
                                    style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                                    <Wrench size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                    <span>{c.label}</span>
                                  </button>
                                ))}
                              </div>
                            ))}
                            {filteredCustom.length > 0 && (
                              <div>
                                <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)", borderBottom: "1px solid var(--border-subtle)" }}>Custom</div>
                                {filteredCustom.map(c => (
                                  <button key={c} type="button"
                                    onMouseDown={() => { setRehab(i, "label", c); setRehab(i, "canonicalCategory", null); setCatFocusIdx(-1); }}
                                    style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                                    <Wrench size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                    <span>{c}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {showNew && (
                              <button type="button" onMouseDown={() => setCatFocusIdx(-1)}
                                style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "var(--warning-bg)", border: "none", cursor: "pointer", textAlign: "left" }}>
                                <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                                <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{item.label}&rdquo; as custom</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ position: "relative", flex: 1 }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>$</span>
                      <input type="number" value={item.budgeted} onChange={e => setRehab(i, "budgeted", e.target.value)}
                        style={{ ...wizardInput, paddingLeft: 24 }} placeholder="0" />
                    </div>
                    <button onClick={() => removeRehabItem(i)} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", padding: 6, borderRadius: 6, display: "flex", marginTop: 8 }}
                      onMouseEnter={e => e.currentTarget.style.color = "var(--c-red)"}
                      onMouseLeave={e => e.currentTarget.style.color = "#cbd5e1"}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                <button onClick={addRehabItem} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={14} /> Add Rehab Item
                </button>
                <button onClick={() => setRehabItems([])} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <X size={12} style={{ marginRight: 4 }} />Clear all &amp; pick new template
                </button>
              </div>
              {rehabTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, fontSize: 14 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Total Rehab Budget: </span>
                  <strong style={{ color: "var(--text-primary)", marginLeft: 8 }}>{fmt(rehabTotal)}</strong>
                </div>
              )}
            </div>
          )}
          <WizardNav onBack={() => setStep(1)} onNext={() => setStep(3)} onSkip={() => setStep(3)} />
        </div>
      )}

      {step === 3 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Review & Save</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Everything look right? You can always edit details later.</p>

          {/* Deal summary */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-alt)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Hammer size={16} color="#e95e00" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Deal Info</span>
              </div>
              <button onClick={() => setStep(0)} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-blue)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            </div>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Name:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.name || "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Stage:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.stage}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Address:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.address || "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Close:</span> <strong style={{ color: "var(--text-primary)" }}>{basics.projectedCloseDate || "—"}</strong></div>
            </div>
          </div>

          {/* Financials summary */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-alt)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <DollarSign size={16} color="var(--c-green)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Financials</span>
              </div>
              <button onClick={() => setStep(1)} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-blue)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            </div>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Purchase:</span> <strong style={{ color: "var(--text-primary)" }}>{pp > 0 ? fmt(pp) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>ARV:</span> <strong style={{ color: "var(--text-primary)" }}>{arv > 0 ? fmt(arv) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Rehab Budget:</span> <strong style={{ color: "var(--text-primary)" }}>{(rehabTotal || rb) > 0 ? fmt(rehabTotal || rb) : "—"}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Holding:</span> <strong style={{ color: "var(--text-primary)" }}>{hc > 0 ? `${fmt(hc)}/mo` : "—"}</strong></div>
              {projectedProfit !== 0 && (
                <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "var(--text-muted)" }}>Projected Profit:</span> <strong style={{ color: projectedProfit > 0 ? "var(--c-green)" : "var(--c-red)" }}>{fmt(Math.round(projectedProfit))}</strong></div>
              )}
            </div>
          </div>

          {/* Rehab scope summary */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-alt)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wrench size={16} color="var(--c-purple)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Rehab Scope ({rehabItems.filter(i => i.label.trim() && (parseFloat(i.budgeted) || 0) > 0).length} items)</span>
              </div>
              <button onClick={() => setStep(2)} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-blue)", background: "none", border: "none", cursor: "pointer" }}>Edit</button>
            </div>
            <div style={{ padding: 16 }}>
              {rehabItems.filter(i => i.label.trim() && (parseFloat(i.budgeted) || 0) > 0).length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>No line items budgeted</p>
              ) : rehabItems.filter(i => i.label.trim() && (parseFloat(i.budgeted) || 0) > 0).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f8fafc", fontSize: 13 }}>
                  <span style={{ color: "var(--text-primary)" }}>{item.label}</span>
                  <strong style={{ color: "var(--text-primary)" }}>{fmt(parseFloat(item.budgeted))}</strong>
                </div>
              ))}
              {rehabTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "1px solid var(--border)", marginTop: 8, fontSize: 13 }}>
                  <strong style={{ color: "var(--text-secondary)" }}>Total</strong>
                  <strong style={{ color: "var(--text-primary)" }}>{fmt(rehabTotal)}</strong>
                </div>
              )}
            </div>
          </div>
          <WizardNav onBack={() => setStep(2)} onNext={handleSave} nextLabel="Add to Pipeline" nextDisabled={!basics.name.trim()} />
        </div>
      )}
    </WizardShell>
  );
}

// ── WELCOME SCREEN ────────────────────────────────────────────────────────
// Shown when the user has no properties and no deals — the app is empty.
function WelcomeScreen({ onStartRental, onStartFlip }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #e95e00 0%, #f59e0b 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 4px 12px rgba(233,94,0,0.25)" }}>
          <Building2 size={32} color="#fff" />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>Welcome to PropBooks</h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
          Let's get your first property or deal set up. The guided setup will walk you through everything step by step.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 600, width: "100%" }}>
        <button onClick={onStartRental}
          style={{ background: "var(--surface)", border: "2px solid var(--border)", borderRadius: 16, padding: "32px 24px", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--c-blue)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(59,130,246,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Home size={24} color="var(--c-blue)" />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>Add Rental Property</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>Buy & hold — track rent, tenants, leases, and cash flow.</p>
        </button>
        <button onClick={onStartFlip}
          style={{ background: "var(--surface)", border: "2px solid var(--border)", borderRadius: 16, padding: "32px 24px", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#e95e00"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(233,94,0,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Hammer size={24} color="#e95e00" />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>Add Fix & Flip Deal</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>Track rehab budget, contractors, milestones, and profit.</p>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------
// VIEWS
// ---------------------------------------------

function PortfolioDashboard({ onNavigate, onSelectProperty, onSelectFlip, onNavigateToTx, onNavigateToDealExpense, onNavigateToLease, onSelectContractor }) {
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
      color: t.type === "income" ? "#15803d" : "#b91c1c",
      bg: t.type === "income" ? "var(--success-badge)" : "var(--danger-badge)",
      title: t.description, sourceName: prop?.name || "Unknown",
      amount: t.amount, txType: t.type, txId: t.id, propertyId: t.propertyId });
  });
  [...DEAL_EXPENSES].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).forEach(e => {
    const deal = DEALS.find(f => f.id === e.dealId);
    recentItems.push({ source: "deal", type: "deal-expense", date: e.date,
      icon: ArrowDown, color: "#b91c1c", bg: "var(--danger-badge)",
      title: e.description || `${e.vendor || "Expense"}`, sourceName: deal?.name || "Unknown",
      amount: e.amount, expId: e.id, dealId: e.dealId });
  });
  const recentActivity = recentItems.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  const sectionS = { background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" };
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
          { label: "Log Rental Transaction", icon: ArrowUpDown, action: () => onNavigate("transactions") },
          { label: "Log Deal Expense", icon: Hammer, action: () => onNavigate("dealexpenses") },
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
                <span style={{ background: highCount > 0 ? "var(--danger-badge)" : "var(--yellow-tint)", color: highCount > 0 ? "#b91c1c" : "#92400e", borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{attentionAlerts.length}</span>
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
                            <button onClick={() => { dismissAlert(a.id); setAlertMenuOpen(null); bumpAlerts(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#b91c1c", borderRadius: 6 }} onMouseEnter={e => e.currentTarget.style.background = "var(--danger-tint)"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
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

function Dashboard({ onNavigate, onNavigateToTx, onSelectProperty, onNavigateToTenantAdd, onNavigateToNote, onNavigateToLease }) {
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
        color: t.type === "income" ? "#15803d" : "#b91c1c", bg: t.type === "income" ? "var(--success-badge)" : "var(--danger-badge)",
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
  }, [renderKey]);

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

  const sectionS = { background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Welcome back, Brandon — here's what needs your attention.</p>
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
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#b91c1c" }}>{fmt(t.rent)}</span>
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
                    <span style={{ fontSize: 14, fontWeight: 700, color: p.monthlyNet >= 0 ? "#15803d" : "#b91c1c" }}>{p.monthlyNet >= 0 ? "+" : ""}{fmt(p.monthlyNet)}<span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>/mo</span></span>
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
                  <span style={{ fontWeight: 700, fontSize: 13, color: a.txType === "income" ? "#15803d" : "#b91c1c", whiteSpace: "nowrap" }}>
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

function Properties({ onSelect, editPropertyId, onClearEditId, convertDealData, onClearConvertFlip, onGuidedSetup }) {
  const { showToast } = useToast();
  // Read/write the global PROPERTIES store directly — same pattern DEALS and
  // TRANSACTIONS use. A local React state copy here caused add/edit/delete
  // (and the deal→rental conversion flow) to mutate only the local copy,
  // leaving the rest of the app unaware of the change.
  const [, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null); // null = add, id = edit
  const [deleteConfirm, setDeleteConfirm] = useState(null); // property object to confirm delete
  const emptyP = { name: "", address: "", type: "Single Family", units: "1", purchasePrice: "", currentValue: "", closingCosts: "", landValue: "", loanAmount: "", loanRate: "", loanTermYears: "30", loanStartDate: "", monthlyRent: "", monthlyExpenses: "", status: "Occupied", purchaseDate: "", photo: null };
  const [form, setForm] = useState(emptyP);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-open edit modal when navigated from PropertyDetail health banner
  useEffect(() => {
    if (editPropertyId) {
      const p = PROPERTIES.find(pr => pr.id === editPropertyId);
      if (p) {
        setEditId(p.id);
        setForm({ name: p.name, address: p.address, type: p.type, units: String(p.units), purchasePrice: String(p.purchasePrice), currentValue: String(p.currentValue), closingCosts: String(p.closingCosts || ""), landValue: String(p.landValue || ""), loanAmount: String(p.loanAmount || ""), loanRate: String(p.loanRate || ""), loanTermYears: String(p.loanTermYears || "30"), loanStartDate: p.loanStartDate || "", monthlyRent: String(p.monthlyRent), monthlyExpenses: String(p.monthlyExpenses), status: p.status, purchaseDate: p.purchaseDate || "", photo: p.photo || null });
        setShowModal(true);
      }
      onClearEditId && onClearEditId();
    }
  }, [editPropertyId]);

  // Auto-open Add Property modal when converting a deal to rental
  useEffect(() => {
    if (convertDealData) {
      setEditId(null);
      setForm({
        ...emptyP,
        name: convertDealData.name || "",
        address: convertDealData.address || "",
        type: convertDealData.type || "Single Family",
        units: convertDealData.units || "1",
        purchasePrice: convertDealData.purchasePrice || "",
        currentValue: convertDealData.currentValue || "",
        closingCosts: convertDealData.closingCosts || "",
        purchaseDate: convertDealData.purchaseDate || "",
      });
      setShowModal(true);
      onClearConvertFlip && onClearConvertFlip();
    }
  }, [convertDealData]);

  const handlePhotoUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, photo: ev.target.result }));
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-upload of same file
  };

  const openEdit = (e, p) => {
    e.stopPropagation();
    setEditId(p.id);
    setForm({ name: p.name, address: p.address, type: p.type, units: String(p.units), purchasePrice: String(p.purchasePrice), currentValue: String(p.currentValue), closingCosts: String(p.closingCosts || ""), landValue: String(p.landValue || ""), loanAmount: String(p.loanAmount || ""), loanRate: String(p.loanRate || ""), loanTermYears: String(p.loanTermYears || "30"), loanStartDate: p.loanStartDate || "", monthlyRent: String(p.monthlyRent), monthlyExpenses: String(p.monthlyExpenses), status: p.status, purchaseDate: p.purchaseDate || "", photo: p.photo || null });
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
      const idx = PROPERTIES.findIndex(p => p.id === editId);
      if (idx !== -1) {
        const p = PROPERTIES[idx];
        const valChanged = val !== p.currentValue;
        const land = parseFloat(form.landValue) || null;
        PROPERTIES[idx] = { ...p, name: form.name, address: form.address, type: form.type, units: parseInt(form.units) || 1, purchasePrice: parseFloat(form.purchasePrice) || 0, currentValue: val, valueUpdatedAt: valChanged ? today : (p.valueUpdatedAt || today), loanAmount: loanAmt, loanRate, loanTermYears: loanTerm, loanStartDate: loanStart, closingCosts: cc, landValue: land, monthlyRent: rent, monthlyExpenses: exp, purchaseDate: form.purchaseDate, status: form.status, photo: form.photo ?? p.photo };
      }
    } else {
      const usedColors = PROPERTIES.map(p => p.color);
      const color = PROP_COLORS.find(c => !usedColors.includes(c)) || PROP_COLORS[PROPERTIES.length % PROP_COLORS.length];
      const land = parseFloat(form.landValue) || null;
      PROPERTIES.push({ id: newId(), name: form.name, address: form.address, type: form.type, units: parseInt(form.units) || 1, purchasePrice: parseFloat(form.purchasePrice) || 0, currentValue: val, valueUpdatedAt: today, loanAmount: loanAmt, loanRate, loanTermYears: loanTerm, loanStartDate: loanStart, closingCosts: cc, landValue: land, monthlyRent: rent, monthlyExpenses: exp, purchaseDate: form.purchaseDate, status: form.status, image: form.name.slice(0, 2).toUpperCase(), color, photo: form.photo || null });
    }
    const wasEdit = editId !== null;
    setForm(emptyP);
    setShowModal(false);
    rerender();
    showToast(wasEdit ? "Property updated" : "Property added to portfolio");
  };

  const handleDeleteProp = () => {
    if (!deleteConfirm) return;
    const idx = PROPERTIES.findIndex(p => p.id === deleteConfirm.id);
    if (idx !== -1) PROPERTIES.splice(idx, 1);
    setDeleteConfirm(null);
    rerender();
  };

  const filtered = PROPERTIES.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.type.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Properties</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>{PROPERTIES.length} properties in your portfolio</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onGuidedSetup} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Property
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search properties..." style={{ width: "100%", paddingLeft: 38, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" }} />
        </div>
        <button style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px", background: "var(--surface)", color: "var(--text-label)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Filter size={15} /> Filter
        </button>
        <div style={{ display: "flex", background: "var(--surface-muted)", borderRadius: 10, padding: 3 }}>
          {["grid", "list"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: view === v ? "var(--surface)" : "transparent", color: view === v ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
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
              <div key={p.id} onClick={() => onSelect(p)} style={{ background: "var(--surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}>
                <div style={{ height: 130, background: p.photo ? "transparent" : "linear-gradient(135deg, #1e3a5f, #0a2240)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                  {p.photo
                    ? <img src={p.photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 800 }}>{p.image}</div>
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
                      <Trash2 size={12} color="var(--c-red)" />
                    </button>
                  </div>
                </div>
                <div style={{ padding: 18 }}>
                  <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{p.name}</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={11} /> {p.address.split(",")[1]?.trim()} . {p.type}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Value</p>
                      <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>{fmtK(p.currentValue)}</p>
                      {p.valueUpdatedAt && (() => {
                        const staleD = Math.round((new Date() - new Date(p.valueUpdatedAt)) / 86400000);
                        const staleV = staleD > 90;
                        return <p style={{ color: staleV ? "#c2410c" : "#cbd5e1", fontSize: 10, marginTop: 1 }}>{staleV ? "⚠ Value may be outdated" : `Value as of ${daysAgo(p.valueUpdatedAt)}`}</p>;
                      })()}
                    </div>
                    <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Equity</p>
                      <p style={{ color: "var(--c-green)", fontSize: 15, fontWeight: 700 }}>{fmtK(equity)}</p>
                      {calcBal !== null && <p style={{ color: "#cbd5e1", fontSize: 10, marginTop: 1 }}>Balance {fmtK(effectiveMortgage)}</p>}
                    </div>
                    <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Monthly CF</p>
                      <p style={{ color: monthlyNet >= 0 ? "var(--c-green)" : "var(--c-red)", fontSize: 15, fontWeight: 700 }}>{fmt(monthlyNet)}</p>
                    </div>
                    <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Cap Rate</p>
                      <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>{calcCapRate(p)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: "1 / -1" }}>
              {PROPERTIES.length === 0
                ? <EmptyState icon={Home} title="No properties yet" subtitle="Add your first rental property to start tracking your portfolio." actionLabel="Add Property" onAction={onGuidedSetup} />
                : <EmptyState icon={Search} title="No properties found" subtitle="Try adjusting your search or filters." />
              }
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-alt)" }}>
                {["Property", "Type", "Value", "Equity", "Monthly Income", "Net Cash Flow", "Cap Rate", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "14px 20px", textAlign: "left", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
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
                <tr key={p.id} onClick={() => onSelect(p)} style={{ borderTop: "1px solid var(--border-subtle)", cursor: "pointer", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--info-tint-alt)"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)"}>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, position: "relative" }}>
                        {p.image}
                        {tHealth.length > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: "50%", background: tBadge.color, border: "2px solid var(--surface)" }} />}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.units} unit{p.units > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: 13, color: "var(--text-label)" }}>{p.type}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{fmtK(p.currentValue)}</p>
                    {p.valueUpdatedAt && (() => {
                      const staleD = Math.round((new Date() - new Date(p.valueUpdatedAt)) / 86400000);
                      const staleV = staleD > 90;
                      return <p style={{ fontSize: 11, color: staleV ? "#c2410c" : "#cbd5e1" }}>{staleV ? "⚠ Value may be outdated" : `Value as of ${daysAgo(p.valueUpdatedAt)}`}</p>;
                    })()}
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-green)" }}>{fmtK(p.currentValue - effMort)}</p>
                    {lBal !== null && <p style={{ fontSize: 11, color: "#cbd5e1" }}>Balance {fmtK(effMort)}</p>}
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{fmt(getEffectiveMonthly(p, TRANSACTIONS).monthlyIncome)}</td>
                  <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(getEffectiveMonthly(p, TRANSACTIONS).monthlyIncome - getEffectiveMonthly(p, TRANSACTIONS).monthlyExpenses)}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <span style={{ background: "var(--purple-tint)", color: "#6d28d9", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{calcCapRate(p, TRANSACTIONS)}%</span>
                  </td>
                  <td style={{ padding: "16px 20px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={e => openEdit(e, p)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "var(--text-label)", fontSize: 12, fontWeight: 600 }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirm(p); }} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--c-red)" }} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9}>
                  {PROPERTIES.length === 0
                    ? <EmptyState icon={Home} title="No properties yet" subtitle="Add your first rental property to start tracking your portfolio." actionLabel="Add Property" onAction={onGuidedSetup} />
                    : <EmptyState icon={Search} title="No properties found" subtitle="Try adjusting your search or filters." />
                  }
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <Modal title={editId ? "Edit Property" : "Add Property"} onClose={() => setShowModal(false)} width={580}>
          {/* Photo Upload */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Property Photo</label>
            <div
              onClick={() => document.getElementById("propPhotoInput").click()}
              style={{ position: "relative", height: form.photo ? 160 : 100, borderRadius: 14, border: "2px dashed var(--border)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: form.photo ? "transparent" : "var(--surface-alt)", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--c-blue)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
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
                <div style={{ textAlign: "center", color: "var(--text-muted)", pointerEvents: "none" }}>
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
              { label: "Property Name *", key: "name", type: "text", placeholder: "e.g. Maple Ridge Duplex", full: true },
              { label: "Address", key: "address", type: "text", placeholder: "Street, City, State ZIP", full: true },
              { label: "Purchase Price ($)", key: "purchasePrice", type: "number", placeholder: "0" },
              { label: "Current Value ($)", key: "currentValue", type: "number", placeholder: "0" },
              { label: "Closing Costs ($)", key: "closingCosts", type: "number", placeholder: "0" },
              { label: "Land Value ($)", key: "landValue", type: "number", placeholder: "From tax assessment" },
              { label: "Est. Monthly Rent ($)", key: "monthlyRent", type: "number", placeholder: "0" },
              { label: "Est. Monthly Expenses ($)", key: "monthlyExpenses", type: "number", placeholder: "0" },
              { label: "Units", key: "units", type: "number", placeholder: "1" },
              { label: "Purchase Date", key: "purchaseDate", type: "date", placeholder: "" },
            ].map(f => (
              <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : "auto" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={sf(f.key)} style={iS} />
                {f.key === "landValue" && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {form.landValue && parseFloat(form.purchasePrice) > 0
                      ? `Building value: ${fmt(parseFloat(form.purchasePrice) - parseFloat(form.landValue))} (depreciable basis for Schedule E)`
                      : "From county tax assessment. Used for depreciation — if blank, 20% of purchase price is estimated."}
                  </p>
                )}
              </div>
            ))}
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Type</label>
              <select value={form.type} onChange={sf("type")} style={iS}>
                {["Single Family","Multi-Family","Condo","Commercial","Land"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Status</label>
              <select value={form.status} onChange={sf("status")} style={iS}>
                {["Occupied","Partial Vacancy","Vacant"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Loan Details Section */}
          <div style={{ margin: "20px 0 14px", padding: "14px 16px", background: "var(--warning-bg)", borderRadius: 12, border: "1px solid var(--warning-border)" }}>
            <p style={{ color: "var(--c-blue)", fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              🏦 Loan Details — balance calculated automatically from these
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Original Loan Amount ($)</label>
                <input type="number" placeholder="e.g. 308000" value={form.loanAmount} onChange={sf("loanAmount")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Interest Rate (%)</label>
                <input type="number" step="0.01" placeholder="e.g. 3.25" value={form.loanRate} onChange={sf("loanRate")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Loan Term (years)</label>
                <input type="number" placeholder="30" value={form.loanTermYears} onChange={sf("loanTermYears")} style={iS} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Loan Start Date</label>
                <input type="date" value={form.loanStartDate} onChange={sf("loanStartDate")} style={iS} />
              </div>
              {form.loanAmount && form.loanRate && form.loanTermYears && form.loanStartDate && (() => {
                const b = calcLoanBalance(form.loanAmount, form.loanRate, form.loanTermYears, form.loanStartDate);
                return b !== null ? (
                  <div style={{ gridColumn: "1 / -1", background: "var(--surface)", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--info-border-alt)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Estimated current balance:</span>
                    <span style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>{fmt(b)}</span>
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveProp} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              {editId ? "Save Changes" : "Add Property"}
            </button>
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title="Delete Property" onClose={() => setDeleteConfirm(null)} width={440}>
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--danger-badge)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Trash2 size={22} color="var(--c-red)" />
            </div>
            <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 6 }}>
              {deleteConfirm.address}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 24 }}>
              This will remove the property and its data from your portfolio. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDeleteProp} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete Property</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Transaction Detail Slide-Over ─────────────────────────────────────────
function TxDetailPanel({ tx, onClose, onEdit, onDelete }) {
  if (!tx) return null;
  const property = PROPERTIES.find(p => p.id === tx.propertyId);
  const tenant = tx.tenantId ? TENANTS.find(t => t.id === tx.tenantId) : null;
  const receipts = TRANSACTION_RECEIPTS.filter(r => r.transactionId === tx.id);
  const isIncome = tx.type === "income";
  const color = isIncome ? "#15803d" : "#b91c1c";
  const bgColor = isIncome ? "var(--success-badge)" : "var(--danger-badge)";
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,24,48,0.35)", zIndex: 1200 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 460, background: "var(--surface)", boxShadow: "-8px 0 40px rgba(0,0,0,0.14)", zIndex: 1201, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "28px 28px 20px", background: "var(--surface-alt)", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ background: bgColor, color, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{tx.type}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 8, lineHeight: 1 }}><X size={20} /></button>
          </div>
          <p style={{ fontSize: 32, fontWeight: 800, color, margin: "0 0 4px" }}>{isIncome ? "+" : "−"}{fmt(Math.abs(tx.amount))}</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{tx.date}</p>
        </div>
        <div style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Tag size={14} color="#94a3b8" /></div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Category</p>
                <span style={{ background: "var(--surface-muted)", color: "var(--text-label)", borderRadius: 6, padding: "3px 9px", fontSize: 13, fontWeight: 600 }}>{tx.category}</span>
              </div>
            </div>
            {[
              { label: "Property", value: property?.name || "Unknown", icon: <Building2 size={14} color="#94a3b8" /> },
              ...(tenant ? [{ label: "Tenant", value: tenant.name + (tenant.unit ? ` · ${tenant.unit}` : ""), icon: <Users size={14} color="#94a3b8" /> }] : []),
              { label: isIncome ? "Received From" : "Paid To", value: tx.payee || "—", icon: <User size={14} color="#94a3b8" /> },
              { label: "Description", value: tx.description || "—", icon: <MessageSquare size={14} color="#94a3b8" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>{icon}</div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</p>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
          {(tx.piPrincipal || tx.piInterest) && (
            <div style={{ background: "var(--surface-alt)", borderRadius: 12, padding: "16px 18px", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Principal & Interest</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div><p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 3 }}>Principal</p><p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(tx.piPrincipal || 0)}</p></div>
                <div><p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 3 }}>Interest</p><p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(tx.piInterest || 0)}</p></div>
              </div>
            </div>
          )}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Paperclip size={12} /> Attachments{receipts.length > 0 && <span style={{ background: "var(--border)", borderRadius: 20, padding: "1px 7px", fontSize: 11, color: "var(--text-label)", marginLeft: 2 }}>{receipts.length}</span>}
            </p>
            {receipts.length === 0 ? (
              <div style={{ background: "var(--surface-alt)", border: "1px dashed var(--border)", borderRadius: 12, padding: "28px 20px", textAlign: "center" }}>
                <Paperclip size={20} color="#cbd5e1" style={{ display: "block", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No receipts attached</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {receipts.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: r.mimeType?.includes("pdf") ? "var(--danger-badge)" : "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {r.mimeType?.includes("pdf") ? <FileText size={16} color="var(--c-red)" /> : <FileImage size={16} color="var(--c-blue)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.size}</p>
                    </div>
                    {r.ocrData && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 1 }}>{r.ocrData.vendor}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(r.ocrData.amount)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: "18px 28px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 10, background: "var(--surface)" }}>
          <button onClick={() => { onClose(); onEdit(tx); }} style={{ flex: 1, padding: "11px 0", background: "var(--surface-muted)", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-label)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Pencil size={14} /> Edit</button>
          <button onClick={() => { onClose(); onDelete(tx); }} style={{ padding: "11px 18px", background: "var(--danger-badge)", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--c-red)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Trash2 size={14} /> Delete</button>
        </div>
      </div>
    </>
  );
}

// ─── Deal Expense Detail Slide-Over ────────────────────────────────────────
function ExpDetailPanel({ exp, onClose, onEdit, onDelete }) {
  if (!exp) return null;
  const deal = DEALS.find(d => d.id === exp.dealId);
  const contractor = CONTRACTORS.find(c => c.id === exp.contractorId);
  const rehabItem = (exp.rehabItemIdx != null && deal?.rehabItems) ? deal.rehabItems[exp.rehabItemIdx] : null;
  const receipts = DEAL_EXPENSE_RECEIPTS.filter(r => r.expenseId === exp.id);
  const isPaid = (exp.status || "paid") === "paid";
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,24,48,0.35)", zIndex: 1200 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 460, background: "var(--surface)", boxShadow: "-8px 0 40px rgba(0,0,0,0.14)", zIndex: 1201, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "28px 28px 20px", background: "var(--surface-alt)", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ background: isPaid ? "var(--success-badge)" : "var(--warning-bg)", color: isPaid ? "#15803d" : "var(--warning-text)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{isPaid ? "Paid" : "Pending"}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 8, lineHeight: 1 }}><X size={20} /></button>
          </div>
          <p style={{ fontSize: 32, fontWeight: 800, color: "#b91c1c", margin: "0 0 4px" }}>−{fmt(exp.amount)}</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{exp.date}</p>
        </div>
        <div style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Tag size={14} color="#94a3b8" /></div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Category</p>
                <span style={{ background: "var(--surface-muted)", color: "var(--text-label)", borderRadius: 6, padding: "3px 9px", fontSize: 13, fontWeight: 600 }}>{exp.category}</span>
              </div>
            </div>
            {deal && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Hammer size={14} color="#94a3b8" /></div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Deal</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", display: "inline-block" }} /><p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{deal.name}</p></div>
                </div>
              </div>
            )}
            {[
              { label: "Paid To", value: exp.vendor || "—", icon: <User size={14} color="#94a3b8" /> },
              { label: "Description", value: exp.description || "—", icon: <MessageSquare size={14} color="#94a3b8" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>{icon}</div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</p>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{value}</p>
                </div>
              </div>
            ))}
            {rehabItem && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><Layers size={14} color="#e95e00" /></div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Rehab Line Item</p>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{rehabItem.category}</p>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Budget: <strong style={{ color: "var(--text-primary)" }}>{fmt(rehabItem.budgeted || 0)}</strong></p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Spent: <strong style={{ color: "#b91c1c" }}>{fmt(rehabItem.spent || 0)}</strong></p>
                  </div>
                </div>
              </div>
            )}
            {contractor && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><UserCheck size={14} color="var(--c-blue)" /></div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Linked Contractor</p>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{contractor.name}</p>
                  {contractor.trade && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{contractor.trade}</p>}
                </div>
              </div>
            )}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Paperclip size={12} /> Attachments{receipts.length > 0 && <span style={{ background: "var(--border)", borderRadius: 20, padding: "1px 7px", fontSize: 11, color: "var(--text-label)", marginLeft: 2 }}>{receipts.length}</span>}
            </p>
            {receipts.length === 0 ? (
              <div style={{ background: "var(--surface-alt)", border: "1px dashed var(--border)", borderRadius: 12, padding: "28px 20px", textAlign: "center" }}>
                <Paperclip size={20} color="#cbd5e1" style={{ display: "block", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No receipts attached</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {receipts.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: r.mimeType?.includes("pdf") ? "var(--danger-badge)" : "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {r.mimeType?.includes("pdf") ? <FileText size={16} color="var(--c-red)" /> : <FileImage size={16} color="#e95e00" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.size}</p>
                    </div>
                    {r.ocrData && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 1 }}>{r.ocrData.vendor}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(r.ocrData.amount)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: "18px 28px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 10, background: "var(--surface)" }}>
          <button onClick={() => { onClose(); onEdit(exp); }} style={{ flex: 1, padding: "11px 0", background: "var(--surface-muted)", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-label)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Pencil size={14} /> Edit</button>
          <button onClick={() => { onClose(); onDelete(exp); }} style={{ padding: "11px 18px", background: "var(--danger-badge)", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--c-red)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Trash2 size={14} /> Delete</button>
        </div>
      </div>
    </>
  );
}

function PropertyDetail({ property, onBack, backLabel, onEditProperty, onGoToTransactions, onNavigateToTransaction, onNavigateToTenant, initialTab, highlightTenantId, onClearHighlightTenant }) {
  const calcBal = calcLoanBalance(property.loanAmount, property.loanRate, property.loanTermYears, property.loanStartDate);
  const effectiveMortgage = calcBal !== null ? calcBal : (property.mortgage || 0);
  const equity = property.currentValue - effectiveMortgage;
  const appreciation = property.currentValue - property.purchasePrice;
  const eff = getEffectiveMonthly(property, TRANSACTIONS);
  const annualNOI = (eff.monthlyIncome - eff.monthlyExpenses) * 12;
  const propTransactions = TRANSACTIONS.filter(t => t.propertyId === property.id);
  const propTenants = TENANTS.filter(t => t.propertyId === property.id && t.status !== "past");
  const propPastTenants = TENANTS.filter(t => t.propertyId === property.id && t.status === "past");
  const detailHealth = getPropertyHealth(property, TRANSACTIONS);
  const [healthOpen, setHealthOpen] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab || "overview");
  const [flashTenantId, setFlashTenantId] = useState(highlightTenantId);

  useEffect(() => {
    if (highlightTenantId) {
      setActiveTab("tenants");
      setFlashTenantId(highlightTenantId);
      setTimeout(() => {
        const el = document.getElementById("tenant-" + highlightTenantId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      const timer = setTimeout(() => { setFlashTenantId(null); onClearHighlightTenant && onClearHighlightTenant(); }, 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightTenantId]);

  // Transaction tab filters
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const [txCatFilter, setTxCatFilter] = useState("all");
  const [txDateFilter, setTxDateFilter] = useState("all");
  const [txDateFrom, setTxDateFrom] = useState("");
  const [txDateTo, setTxDateTo] = useState("");

  const filteredTx = useMemo(() => {
    let list = propTransactions;
    if (txTypeFilter !== "all") list = list.filter(t => t.type === txTypeFilter);
    if (txCatFilter !== "all") list = list.filter(t => t.category === txCatFilter);
    if (txSearch) { const q = txSearch.toLowerCase(); list = list.filter(t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || (t.payee || "").toLowerCase().includes(q)); }
    if (txDateFilter !== "all") {
      const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
      let from, to;
      if (txDateFilter === "thisMonth")  { from = new Date(y, m, 1); to = new Date(y, m + 1, 0); }
      if (txDateFilter === "lastMonth")  { from = new Date(y, m - 1, 1); to = new Date(y, m, 0); }
      if (txDateFilter === "thisYear")   { from = new Date(y, 0, 1); to = new Date(y, 11, 31); }
      if (txDateFilter === "lastYear")   { from = new Date(y - 1, 0, 1); to = new Date(y - 1, 11, 31); }
      if (txDateFilter === "custom")     { from = txDateFrom ? new Date(txDateFrom) : null; to = txDateTo ? new Date(txDateTo) : null; }
      if (from || to) list = list.filter(t => { const d = new Date(t.date); return (!from || d >= from) && (!to || d <= to); });
    }
    return list;
  }, [propTransactions, txSearch, txTypeFilter, txCatFilter, txDateFilter, txDateFrom, txDateTo]);

  const txHasFilters = txSearch || txTypeFilter !== "all" || txCatFilter !== "all" || txDateFilter !== "all";
  const clearTxFilters = () => { setTxSearch(""); setTxTypeFilter("all"); setTxCatFilter("all"); setTxDateFilter("all"); setTxDateFrom(""); setTxDateTo(""); };

  const txCategories = [...new Set(propTransactions.map(t => t.category))].sort();
  const filteredTxTotal = filteredTx.reduce((s, t) => s + (t.type === "income" ? t.amount : -Math.abs(t.amount)), 0);
  const totalIncome = filteredTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filteredTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

  // ── Inline transaction CRUD ───────────────────────────────────────────
  const [txDetailItem, setTxDetailItem] = useState(null);
  const [txShowModal, setTxShowModal] = useState(false);  // "income" | "expense" | false
  const [txEditId, setTxEditId] = useState(null);
  const [txDeleteConfirm, setTxDeleteConfirm] = useState(null);
  const [txPayeeFocus, setTxPayeeFocus] = useState(false);
  const [txRenderKey, txForceRender] = useState(0);
  const [txReceipts, setTxReceipts] = useState([]);  // receipts attached to current transaction in modal
  const [txScanning, setTxScanning] = useState(false);

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
  const txGroupsForType = t => t === "income" ? INCOME_GROUPS : EXPENSE_GROUPS;
  const txParentOf = (cat, type) => {
    const groups = txGroupsForType(type);
    for (const [parent, subs] of Object.entries(groups)) { if (subs.includes(cat)) return parent; }
    const alt = type === "income" ? EXPENSE_GROUPS : INCOME_GROUPS;
    for (const [parent, subs] of Object.entries(alt)) { if (subs.includes(cat)) return parent; }
    return "";
  };

  const txEmptyIncome  = { date: "", propertyId: property.id, type: "income",  category: "Rent Income",      description: "", amount: "", payee: "" };
  const txEmptyExpense = { date: "", propertyId: property.id, type: "expense", category: "Mortgage Payment", description: "", amount: "", payee: "" };
  const [txForm, setTxForm] = useState(txEmptyIncome);
  const txSf = k => e => setTxForm(f => ({ ...f, [k]: e.target.value }));

  const txCloseModal = () => { setTxShowModal(false); setTxPayeeFocus(false); setTxReceipts([]); setTxScanning(false); };
  const txOpenAddIncome  = () => { setTxEditId(null); setTxForm(txEmptyIncome);  setTxPayeeFocus(false); setTxReceipts([]); setTxShowModal("income");  };
  const txOpenAddExpense = () => { setTxEditId(null); setTxForm(txEmptyExpense); setTxPayeeFocus(false); setTxReceipts([]); setTxShowModal("expense"); };
  const txOpenEdit = t => {
    setTxEditId(t.id);
    setTxForm({ date: t.date, propertyId: t.propertyId, type: t.type, category: t.category, description: t.description, amount: String(Math.abs(t.amount)), payee: t.payee || "" });
    setTxPayeeFocus(false);
    // Load existing receipts for this transaction
    setTxReceipts(TRANSACTION_RECEIPTS.filter(r => r.transactionId === t.id));
    setTxShowModal(t.type);
  };

  const allPayees = [...new Set(TRANSACTIONS.filter(t => t.type === "expense").map(t => t.payee).filter(Boolean))].sort();
  const allPayers = [...new Set(TRANSACTIONS.filter(t => t.type === "income").map(t => t.payee).filter(Boolean))].sort();

  const txHandleSave = () => {
    if (!txForm.description || !txForm.amount) return;
    const amt = parseFloat(txForm.amount) || 0;
    const built = { date: txForm.date || new Date().toISOString().split("T")[0], propertyId: property.id, category: txForm.category || "Other", description: txForm.description, amount: txForm.type === "income" ? Math.abs(amt) : -Math.abs(amt), type: txForm.type, payee: (txForm.payee || "").trim() };
    if (txEditId !== null) {
      const idx = TRANSACTIONS.findIndex(t => t.id === txEditId);
      if (idx !== -1) Object.assign(TRANSACTIONS[idx], built);
      // Persist new receipts
      txReceipts.filter(r => !TRANSACTION_RECEIPTS.some(er => er.id === r.id)).forEach(r => addTransactionReceipt({ ...r, transactionId: txEditId }));
    } else {
      const txId = newId();
      TRANSACTIONS.unshift({ id: txId, ...built });
      // Persist attached receipts
      txReceipts.forEach(r => addTransactionReceipt({ ...r, transactionId: txId }));
    }
    txCloseModal();
    txForceRender(n => n + 1);
  };

  const txHandleDelete = (t) => {
    const idx = TRANSACTIONS.findIndex(tx => tx.id === t.id);
    if (idx !== -1) TRANSACTIONS.splice(idx, 1);
    setTxDeleteConfirm(null);
    txForceRender(n => n + 1);
  };

  const [notesRender, reRenderNotes] = useState(0);
  const [noteText, setNoteText] = useState("");
  const [noteEditId, setNoteEditId] = useState(null);
  const [noteDeleteConfirm, setNoteDeleteConfirm] = useState(null);
  const propNotes = useMemo(() => RENTAL_NOTES.filter(n => n.propertyId === property.id).sort((a, b) => b.date.localeCompare(a.date)), [notesRender]);

  const propDocs = PROPERTY_DOCUMENTS.filter(d => d.propertyId === property.id);

  const tabs = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "transactions", label: "Transactions", icon: Receipt, count: propTransactions.length },
    { id: "tenants", label: "Tenants", icon: Users, count: propTenants.filter(t => t.status !== "vacant").length },
    { id: "documents", label: "Documents", icon: FileText, count: propDocs.length },
    { id: "notes", label: "Notes", icon: MessageSquare, count: propNotes.length },
  ];

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-blue)", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 20 }}>
        <ArrowLeft size={15} /> {backLabel || "Back to Properties"}
      </button>

      {/* Property header card */}
      <div style={{ background: "var(--hero-bg)", borderRadius: 20, padding: 28, marginBottom: 24, border: "1px solid var(--hero-border)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {property.photo
              ? <img src={property.photo} alt={property.name} style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", border: "3px solid rgba(30,58,95,0.2)" }} />
              : <div style={{ width: 64, height: 64, borderRadius: 18, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800 }}>{property.image}</div>
            }
            <div>
              <h1 style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{property.name}</h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> {property.address}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <span style={{ background: "var(--hero-badge-bg)", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: "var(--text-label)", fontWeight: 600 }}>{property.type}</span>
                <span style={{ background: "var(--hero-badge-bg)", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: "var(--text-label)", fontWeight: 600 }}>{property.units} unit{property.units > 1 ? "s" : ""}</span>
                <Badge status={property.status} />
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Current Value</p>
            <p style={{ color: "var(--text-primary)", fontSize: 32, fontWeight: 800 }}>{fmt(property.currentValue)}</p>
            <p style={{ color: "var(--c-green)", fontSize: 14, fontWeight: 600 }}>+{fmt(appreciation)} since purchase</p>
            {property.valueUpdatedAt && (() => {
              const staleD = Math.round((new Date() - new Date(property.valueUpdatedAt)) / 86400000);
              const staleV = staleD > 90;
              return <p style={{ color: staleV ? "#c2410c" : "#94a3b8", fontSize: 12, marginTop: 2 }}>
                {staleV ? "⚠ Property value may be outdated — edit property to update" : `Value as of ${daysAgo(property.valueUpdatedAt)}`}
              </p>;
            })()}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #f1f5f9" }}>
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "12px 20px", border: "none", background: "none", color: active ? "#e95e00" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 14, cursor: "pointer", borderBottom: active ? "2px solid #e95e00" : "2px solid transparent", marginBottom: -2, transition: "all 0.15s" }}>
              <tab.icon size={15} />
              {tab.label}
              {tab.count !== undefined && (
                <span style={{ background: active ? "var(--warning-btn-bg)" : "var(--surface-muted)", color: active ? "#c2410c" : "var(--text-muted)", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === "overview" && (
        <div>
          {/* Recommended Updates Banner */}
          {detailHealth.length > 0 && (
            <div style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 14, padding: healthOpen ? "16px 20px" : "12px 20px", marginBottom: 20, transition: "all 0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setHealthOpen(h => !h)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={16} color="var(--warning-text-secondary)" />
                  <span style={{ color: "var(--warning-text)", fontSize: 14, fontWeight: 700 }}>
                    {detailHealth.length} Recommended Update{detailHealth.length > 1 ? "s" : ""}
                  </span>
                  <span style={{ color: "var(--warning-text-secondary)", fontSize: 12 }}>— improve the accuracy of your analytics</span>
                </div>
                <ChevronDown size={16} color="var(--warning-text-secondary)" style={{ transform: healthOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
              </div>
              {healthOpen && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {detailHealth.map(item => (
                    <div key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--surface)", borderRadius: 10, padding: "12px 16px", border: "1px solid var(--warning-border)" }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                        background: item.severity === "high" ? "#dc2626" : item.severity === "medium" ? "#e95e00" : "#6366f1"
                      }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{item.label}</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.5 }}>{item.detail}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); item.field ? onEditProperty && onEditProperty(property) : onGoToTransactions && onGoToTransactions(); }} style={{
                        fontSize: 11, fontWeight: 600, color: "var(--warning-btn-text)", background: "var(--warning-btn-bg)", borderRadius: 6, padding: "5px 12px", whiteSpace: "nowrap", flexShrink: 0,
                        border: "1px solid var(--warning-border)", cursor: "pointer", transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--warning-btn-bg-hover)"; e.currentTarget.style.color = "var(--warning-btn-text-hover)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "var(--warning-btn-bg)"; e.currentTarget.style.color = "var(--warning-btn-text)"; }}
                      >{item.field ? "Edit Property" : "Go to Transactions"}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Monthly Income", value: fmt(eff.monthlyIncome), color: "var(--c-green)", sub: eff.source === "transactions" ? `Avg from ${eff.months}mo of transactions` : "Manual estimate — log transactions for actuals", tip: "Average monthly rental income. Derived from transaction history when available, otherwise uses manually entered estimate." },
              { label: "Monthly Expenses", value: fmt(eff.monthlyExpenses), color: "var(--c-red)", sub: eff.source === "transactions" ? `Avg from ${eff.months}mo of transactions` : "Manual estimate — log transactions for actuals", tip: "Average monthly operating expenses. Derived from transaction history when available, otherwise uses manually entered estimate." },
              { label: "Net Cash Flow", value: fmt(eff.monthlyIncome - eff.monthlyExpenses), color: (eff.monthlyIncome - eff.monthlyExpenses) >= 0 ? "var(--c-green)" : "var(--c-red)", tip: "Monthly Income − Monthly Expenses. Positive means the property cash-flows." },
              { label: "Total Equity", value: fmt(equity), color: "var(--text-primary)", tip: "Current Property Value − Mortgage Balance." },
              { label: "Purchase Price", value: fmt(property.purchasePrice), color: "var(--text-primary)", tip: "Original acquisition cost of the property." },
              { label: "Closing Costs", value: property.closingCosts ? fmt(property.closingCosts) : "—", color: "var(--text-secondary)", tip: "One-time costs paid at closing (title, legal, inspection, etc.)." },
              { label: calcBal !== null ? "Est. Mortgage Balance" : "Mortgage Balance", value: fmt(effectiveMortgage), color: "var(--text-primary)", sub: calcBal !== null ? "Calculated from loan terms" : null, tip: "Current outstanding loan balance. Calculated from loan terms if amortization data is available." },
              { label: "Cap Rate", value: `${calcCapRate(property, TRANSACTIONS)}%`, color: "var(--text-primary)", tip: "Annual NOI ÷ Current Property Value × 100. Measures return independent of financing." },
              { label: "Cash-on-Cash", value: `${calcCashOnCash(property, TRANSACTIONS)}%`, color: parseFloat(calcCashOnCash(property, TRANSACTIONS)) >= 0 ? "var(--c-green)" : "var(--c-red)", tip: "Annual Cash Flow After Debt Service ÷ Total Cash Invested × 100." },
            ].map((m, i) => (
              <div key={i} style={{ background: "var(--surface)", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>{m.label}</p>
                  {m.tip && <InfoTip text={m.tip} />}
                </div>
                <p style={{ color: m.color, fontSize: 18, fontWeight: 700 }}>{m.value}</p>
                {m.sub && <p style={{ color: "#cbd5e1", fontSize: 10, marginTop: 2 }}>{m.sub}</p>}
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ═══ TRANSACTIONS TAB ═══ */}
      {activeTab === "transactions" && (
        <div>
          {/* Summary stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Total Income</p>
                <InfoTip text="Sum of all income transactions for this property (filtered if filters are active)." />
              </div>
              <p style={{ color: "var(--c-green)", fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)" }}>+{fmt(totalIncome)}</p>
            </div>
            <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Total Expenses</p>
                <InfoTip text="Sum of all expense transactions for this property (filtered if filters are active)." />
              </div>
              <p style={{ color: "var(--c-red)", fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)" }}>-{fmt(totalExpenses)}</p>
            </div>
            <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Net</p>
                <InfoTip text="Total Income minus Total Expenses. Positive = profitable." />
              </div>
              <p style={{ color: filteredTxTotal >= 0 ? "var(--c-green)" : "var(--c-red)", fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)" }}>{filteredTxTotal >= 0 ? "+" : ""}{fmt(Math.abs(filteredTxTotal))}</p>
            </div>
          </div>

          {/* Header row with counts + add buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {txHasFilters ? `${filteredTx.length} of ${propTransactions.length} transactions` : `${propTransactions.length} transactions`}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={txOpenAddExpense} style={{ background: "var(--danger-tint)", color: "#b91c1c", border: "1px solid var(--danger-border)", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> Add Expense
              </button>
              <button onClick={txOpenAddIncome} style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> Add Income
              </button>
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: txHasFilters ? 10 : 20, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
              <Search size={14} color="#94a3b8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search transactions..." style={{ width: "100%", border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px 9px 32px", fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none" }} />
            </div>
            <select value={txTypeFilter} onChange={e => setTxTypeFilter(e.target.value)} style={{ border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "var(--text-label)", background: "var(--surface)" }}>
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <select value={txCatFilter} onChange={e => setTxCatFilter(e.target.value)} style={{ border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "var(--text-label)", background: "var(--surface)" }}>
              <option value="all">All Categories</option>
              {txCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={txDateFilter} onChange={e => setTxDateFilter(e.target.value)} style={{ border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "var(--text-label)", background: "var(--surface)" }}>
              <option value="all">All Time</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="thisYear">This Year</option>
              <option value="lastYear">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>
            {txDateFilter === "custom" && (
              <>
                <input type="date" value={txDateFrom} onChange={e => setTxDateFrom(e.target.value)} style={{ border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "var(--text-label)", background: "var(--surface)" }} />
                <input type="date" value={txDateTo} onChange={e => setTxDateTo(e.target.value)} style={{ border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "var(--text-label)", background: "var(--surface)" }} />
              </>
            )}
          </div>

          {/* Filter chips */}
          {txHasFilters && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              {txTypeFilter !== "all" && <span style={{ background: "var(--info-tint)", color: "var(--c-blue)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>{txTypeFilter} <button onClick={() => setTxTypeFilter("all")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-blue)", padding: 0 }}><X size={10} /></button></span>}
              {txCatFilter !== "all" && <span style={{ background: "var(--success-badge)", color: "#15803d", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>{txCatFilter} <button onClick={() => setTxCatFilter("all")} style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d", padding: 0 }}><X size={10} /></button></span>}
              {txDateFilter !== "all" && <span style={{ background: "var(--warning-bg)", color: "var(--warning-text)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>{txDateFilter === "custom" ? `${txDateFrom || "..."} – ${txDateTo || "..."}` : txDateFilter} <button onClick={() => { setTxDateFilter("all"); setTxDateFrom(""); setTxDateTo(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--warning-text)", padding: 0 }}><X size={10} /></button></span>}
              {txSearch && <span style={{ background: "var(--surface-muted)", color: "var(--text-label)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>"{txSearch}" <button onClick={() => setTxSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-label)", padding: 0 }}><X size={10} /></button></span>}
              <button onClick={clearTxFilters} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Clear all</button>
            </div>
          )}

          {/* Transactions table */}
          <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
            {filteredTx.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: 48 }}>
                {txHasFilters ? <span>No transactions match your filters. <button onClick={clearTxFilters} style={{ background: "none", border: "none", color: "var(--c-blue)", cursor: "pointer", textDecoration: "underline", fontSize: 14 }}>Clear filters</button></span> : <span>No transactions yet. <button onClick={txOpenAddIncome} style={{ background: "none", border: "none", color: "#15803d", cursor: "pointer", textDecoration: "underline", fontSize: 14 }}>Add your first transaction</button></span>}
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-alt)" }}>
                    {["Date", "Category", "Paid To", "Description", "Amount", "Type", ""].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((t, i) => (
                    <tr key={t.id}
                      onClick={() => setTxDetailItem(t)}
                      style={{ borderTop: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)", transition: "background 0.15s", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--info-tint-alt)"}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)"}>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{t.date}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {(() => { const group = txParentOf(t.category, t.type); return group && group !== t.category ? <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>{group}</p> : null; })()}
                        <span style={{ background: "var(--surface-muted)", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600, color: "var(--text-label)" }}>{t.category}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-label)" }}>{t.payee || <span style={{ color: "#cbd5e1", fontStyle: "italic" }}>—</span>}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-primary)" }}>{t.description}</td>
                      <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: t.type === "income" ? "#15803d" : "#b91c1c" }}>
                        {t.type === "income" ? "+" : "-"}{fmt(Math.abs(t.amount))}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ background: t.type === "income" ? "var(--success-badge)" : "var(--danger-badge)", color: t.type === "income" ? "#15803d" : "#b91c1c", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{t.type}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={e => { e.stopPropagation(); txOpenEdit(t); }} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                          <button onClick={e => { e.stopPropagation(); setTxDeleteConfirm(t); }} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)", background: "var(--surface-alt)" }}>
                    <td colSpan={4} style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                      {filteredTx.length} transaction{filteredTx.length !== 1 ? "s" : ""}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 800, color: filteredTxTotal >= 0 ? "#15803d" : "#b91c1c" }}>
                      {filteredTxTotal >= 0 ? "+" : ""}{fmt(Math.abs(filteredTxTotal))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* ── Transaction Detail Panel ── */}
          {txDetailItem && <TxDetailPanel tx={txDetailItem} onClose={() => setTxDetailItem(null)} onEdit={t => { setTxDetailItem(null); txOpenEdit(t); }} onDelete={t => { setTxDetailItem(null); setTxDeleteConfirm(t); }} />}

          {/* ── Add / Edit Transaction Modal ── */}
          {(txShowModal === "income" || txShowModal === "expense") && (() => {
            const isIncome = txShowModal === "income";
            const accentColor = isIncome ? "#15803d" : "#b91c1c";
            const accentBg    = isIncome ? "var(--success-tint)"  : "var(--danger-tint)";
            const accentBorder= isIncome ? "var(--success-border)"  : "var(--danger-border)";
            const payeeLabel  = isIncome ? "Received From" : "Paid To *";
            const payeePlaceholder = isIncome ? "Who paid?" : "Who was paid?";
            const payeePool   = isIncome ? allPayers : allPayees;
            const payeeHint   = <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>Type to search previous entries or add new</p>;

            const TxPayeeDropdown = () => {
              const q = (txForm.payee || "").toLowerCase();
              const matches = q ? payeePool.filter(p => p.toLowerCase().includes(q) && p.toLowerCase() !== q) : payeePool.slice(0, 6);
              const exactExists = payeePool.some(p => p.toLowerCase() === q);
              const showNew = q && !exactExists;
              if (matches.length === 0 && !showNew) return null;
              return (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                  {matches.slice(0, 6).map(p => (
                    <button key={p} onMouseDown={() => { setTxForm(f => ({ ...f, payee: p })); setTxPayeeFocus(false); }}
                      style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                      <User size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> {p}
                    </button>
                  ))}
                  {showNew && (
                    <button onMouseDown={() => setTxPayeeFocus(false)}
                      style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "var(--warning-bg)", border: "none", borderTop: matches.length > 0 ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left" }}>
                      <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{txForm.payee}&rdquo; as new</span>
                    </button>
                  )}
                </div>
              );
            };

            return (
              <Modal title={txEditId ? `Edit ${isIncome ? "Income" : "Expense"}` : `Add ${isIncome ? "Income" : "Expense"}`} onClose={txCloseModal}>
                {/* Colored type badge at top */}
                <div style={{ background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: 10, padding: "8px 14px", marginBottom: 20, display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: accentColor, display: "inline-block" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{isIncome ? "Income" : "Expense"}</span>
                </div>

                {/* OCR hint — expense only, hides once a receipt is attached */}
                {!isIncome && txReceipts.length === 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--info-tint-alt)", borderRadius: 10, border: "1px solid var(--info-border-alt)", marginBottom: 16 }}>
                    <ScanLine size={16} color="var(--c-blue)" />
                    <p style={{ fontSize: 12, color: "var(--text-primary)", margin: 0 }}>
                      <strong>Have a receipt?</strong> Attach it below and we can auto-fill the details for you.
                    </p>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Date</label>
                    <input type="date" value={txForm.date} onChange={txSf("date")} style={iS} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Amount ($) *</label>
                    <input type="number" placeholder="0.00" value={txForm.amount} onChange={txSf("amount")} style={iS} />
                  </div>

                  {/* Payee / Received From — typeahead */}
                  <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                    <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      {payeeLabel} {isIncome && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>}
                    </label>
                    <input type="text" placeholder={payeePlaceholder} value={txForm.payee} onChange={txSf("payee")}
                      onFocus={() => setTxPayeeFocus(true)} onBlur={() => setTimeout(() => setTxPayeeFocus(false), 150)}
                      style={iS} autoComplete="off" />
                    {txPayeeFocus && <TxPayeeDropdown />}
                    {!txPayeeFocus && !txForm.payee && payeeHint}
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Description *</label>
                    <input type="text" placeholder="Brief description" value={txForm.description} onChange={txSf("description")} style={iS} />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Category</label>
                    <select value={txForm.category} onChange={txSf("category")} style={iS}>
                      {Object.entries(txGroupsForType(txForm.type)).map(([group, subs]) => (
                        <optgroup key={group} label={group}>
                          {subs.map(s => <option key={s} value={s}>{s}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Receipt / Attachment */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      <Paperclip size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />Receipt / Attachment
                    </label>
                    <AttachmentZone
                      onFiles={files => {
                        const newAtts = files.map(f => ({
                          id: newId(), name: f.name, mimeType: f.type,
                          size: f.size > 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(1) + " MB" : Math.round(f.size / 1024) + " KB",
                          url: URL.createObjectURL(f), ocrData: null, createdAt: new Date().toISOString(), userId: "usr_001",
                        }));
                        setTxReceipts(prev => [...prev, ...newAtts]);
                      }}
                      compact label="Attach receipt or document" />
                    {txReceipts.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <AttachmentList items={txReceipts} onRemove={id => setTxReceipts(prev => prev.filter(r => r.id !== id))} compact />
                        {!isIncome && txReceipts.filter(r => !r.ocrData).map(att => (
                          <OcrPrompt key={att.id} attachment={att}
                            onResult={(ocrData, a) => {
                              setTxForm(f => ({
                                ...f,
                                payee: f.payee || ocrData.vendor || "",
                                amount: f.amount || String(ocrData.amount || ""),
                                date: f.date || ocrData.date || "",
                                description: f.description || `Receipt — ${ocrData.vendor || "scanned"}`,
                              }));
                              setTxReceipts(prev => prev.map(r => r.id === a.id ? { ...r, ocrData } : r));
                            }} />
                        ))}
                      </div>
                    )}
                    {txReceipts.some(r => r.ocrData) && (
                      <p style={{ fontSize: 11, color: "#15803d", marginTop: 4, fontStyle: "italic" }}>
                        <CheckCircle size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />
                        Fields auto-filled from receipt — please verify
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                  <button onClick={txCloseModal} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
                  <button onClick={txHandleSave} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: accentColor, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{txEditId ? "Save Changes" : isIncome ? "Save Income" : "Save Expense"}</button>
                </div>
              </Modal>
            );
          })()}

          {/* ── Delete Confirmation Modal ── */}
          {txDeleteConfirm && (
            <Modal title="Delete Transaction" onClose={() => setTxDeleteConfirm(null)} width={420}>
              <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--danger-badge)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Trash2 size={22} color="var(--c-red)" />
                </div>
                <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>{txDeleteConfirm.description}</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{txDeleteConfirm.date} · <span style={{ color: txDeleteConfirm.type === "income" ? "#15803d" : "#b91c1c", fontWeight: 600 }}>{txDeleteConfirm.type === "income" ? "+" : "-"}{fmt(Math.abs(txDeleteConfirm.amount))}</span></p>
                <p style={{ fontSize: 13, color: "var(--c-red)", marginTop: 12 }}>This action cannot be undone.</p>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setTxDeleteConfirm(null)} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={() => txHandleDelete(txDeleteConfirm)} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--c-red)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Delete</button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ═══ TENANTS TAB ═══ */}
      {activeTab === "tenants" && (
        <div>
          {/* Summary stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
            {[
              { label: "Total Units", value: propTenants.length || property.units, color: "var(--c-blue)", tip: "Number of units at this property based on tenant records." },
              { label: "Occupied", value: propTenants.filter(t => t.status !== "vacant").length, color: "var(--c-green)", tip: "Units with an active or month-to-month tenant." },
              { label: "Vacant", value: propTenants.filter(t => t.status === "vacant").length, color: propTenants.some(t => t.status === "vacant") ? "var(--c-red)" : "#94a3b8", tip: "Units without an active tenant. Vacant units don't generate rental income." },
              { label: "Monthly Rent", value: fmt(propTenants.filter(t => t.status !== "vacant" && t.status !== "past").reduce((s, t) => s + (t.rent || 0), 0)), color: "var(--c-green)", tip: "Combined rent from all active tenants at this property." },
            ].map((m, i) => (
              <div key={i} style={{ background: "var(--surface)", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</p>
                  {m.tip && <InfoTip text={m.tip} />}
                </div>
                <p style={{ color: m.color, fontSize: 22, fontWeight: 700 }}>{m.value}</p>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{propTenants.length} active unit{propTenants.length !== 1 ? "s" : ""}{propPastTenants.length > 0 ? ` · ${propPastTenants.length} past tenant${propPastTenants.length !== 1 ? "s" : ""}` : ""}</p>
          </div>

          {propTenants.length === 0 ? (
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: 48, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
              <Users size={32} color="#cbd5e1" style={{ marginBottom: 12 }} />
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No tenants on record for this property.</p>
              <p style={{ color: "#cbd5e1", fontSize: 13, marginTop: 4 }}>Add tenants from the Tenants page.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {propTenants.map(t => {
                const isVacant = t.status === "vacant";
                const statusMap = {
                  "active-lease": { bg: "var(--success-badge)", text: "#15803d", label: "Active Lease" },
                  "month-to-month": { bg: "var(--warning-bg)", text: "var(--warning-text)", label: "Month-to-Month" },
                  "vacant": { bg: "var(--danger-badge)", text: "#b91c1c", label: "Vacant" },
                };
                const st = statusMap[t.status] || statusMap["active-lease"];
                const daysLeft = t.leaseEnd ? Math.round((new Date(t.leaseEnd) - new Date()) / 86400000) : null;
                return (
                  <div key={t.id} id={"tenant-" + t.id} onClick={() => onNavigateToTenant && onNavigateToTenant(t.id)}
                    style={{ background: flashTenantId === t.id ? "var(--purple-tint)" : "var(--surface)", borderRadius: 14, padding: "18px 22px", boxShadow: flashTenantId === t.id ? "0 0 0 2px #8b5cf6" : "0 1px 3px rgba(0,0,0,0.06)", border: `1px solid ${flashTenantId === t.id ? "var(--c-purple)" : isVacant ? "var(--danger-badge)" : "var(--border-subtle)"}`, cursor: "pointer", transition: "all 0.4s ease" }}
                    onMouseEnter={e => { if (flashTenantId !== t.id) { e.currentTarget.style.background = "var(--info-tint-alt)"; e.currentTarget.style.borderColor = "var(--info-border)"; } }}
                    onMouseLeave={e => { if (flashTenantId !== t.id) { e.currentTarget.style.background = flashTenantId === t.id ? "var(--purple-tint)" : "var(--surface)"; e.currentTarget.style.borderColor = flashTenantId === t.id ? "var(--c-purple)" : isVacant ? "var(--danger-badge)" : "var(--border-subtle)"; } }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: isVacant ? "var(--danger-tint)" : "var(--info-tint-alt)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isVacant ? <Home size={17} color="var(--c-red)" /> : <User size={17} color="var(--c-blue)" />}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{isVacant ? "Vacant" : t.name}</p>
                          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.unit}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ background: st.bg, color: st.text, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(t.rent)}<span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>/mo</span></span>
                        <ChevronRight size={14} color="#94a3b8" />
                      </div>
                    </div>
                    {!isVacant && (
                      <div style={{ display: "flex", gap: 24, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f8fafc" }}>
                        <div>
                          <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Lease</p>
                          <p style={{ color: "var(--text-dim)", fontSize: 12, fontWeight: 500 }}>{t.leaseStart} — {t.leaseEnd || "MTM"}</p>
                        </div>
                        {daysLeft !== null && (
                          <div>
                            <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Expires In</p>
                            <p style={{ color: daysLeft < 60 ? "var(--c-red)" : "#374151", fontSize: 12, fontWeight: daysLeft < 60 ? 700 : 500 }}>{daysLeft > 0 ? `${daysLeft} days` : "Expired"}</p>
                          </div>
                        )}
                        <div>
                          <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Last Payment</p>
                          <p style={{ color: "var(--text-dim)", fontSize: 12, fontWeight: 500 }}>{t.lastPayment || "—"}</p>
                        </div>
                        {t.phone && (
                          <div>
                            <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Phone</p>
                            <p style={{ color: "var(--text-dim)", fontSize: 12, fontWeight: 500 }}>{t.phone}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Past Tenants Section */}
          {propPastTenants.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Past Tenants</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Previous tenants who have moved out</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {propPastTenants.map(t => (
                  <div key={t.id} style={{ background: "var(--surface-alt)", borderRadius: 12, padding: "14px 18px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Clock size={15} color="#94a3b8" />
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{t.name}</p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.unit} &middot; {t.leaseStart} — {t.leaseEnd}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ background: "var(--surface-muted)", color: "var(--text-secondary)", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{t.moveOutReason || "Moved out"}</span>
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{fmt(t.rent)}/mo</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <DocumentsPanel
          documents={propDocs}
          onAdd={doc => { addPropertyDocument({ ...doc, propertyId: property.id }); txForceRender(n => n + 1); }}
          onDelete={id => { deletePropertyDocument(id); txForceRender(n => n + 1); }}
          entityLabel="property"
        />
      )}

      {activeTab === "notes" && (
        <div>
          {/* Add / Edit note form */}
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-label)", marginBottom: 8 }}>
              {noteEditId ? "Edit Note" : "Add Note"}
            </label>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Write a note about this property..."
              rows={3}
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 14, color: "var(--text-primary)", resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
              {noteEditId && (
                <button onClick={() => { setNoteEditId(null); setNoteText(""); }}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              )}
              <button onClick={() => {
                const txt = noteText.trim();
                if (!txt) return;
                const now = new Date().toISOString();
                const today = now.slice(0, 10);
                if (noteEditId) {
                  const idx = RENTAL_NOTES.findIndex(n => n.id === noteEditId);
                  if (idx !== -1) RENTAL_NOTES[idx] = { ...RENTAL_NOTES[idx], text: txt, updatedAt: now };
                  setNoteEditId(null);
                } else {
                  RENTAL_NOTES.unshift({ id: newId(), propertyId: property.id, date: today, text: txt, createdAt: now, updatedAt: now, userId: MOCK_USER.id, mentions: [] });
                }
                setNoteText("");
                reRenderNotes(n => n + 1);
              }} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--c-blue)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {noteEditId ? "Save Changes" : "Add Note"}
              </button>
            </div>
          </div>

          {/* Notes list */}
          {propNotes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
              <MessageSquare size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
              <p style={{ fontSize: 14, margin: 0 }}>No notes yet — add one above.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {propNotes.map(n => (
                <div key={n.id} style={{ background: "var(--surface)", borderRadius: 14, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{n.date}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setNoteEditId(n.id); setNoteText(n.text); }}
                        style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "4px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => setNoteDeleteConfirm(n.id)}
                        style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "4px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Delete confirm */}
          {noteDeleteConfirm && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}>
              <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, width: 360, boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px 0" }}>Delete Note?</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px 0" }}>This cannot be undone.</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setNoteDeleteConfirm(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  <button onClick={() => {
                    const idx = RENTAL_NOTES.findIndex(n => n.id === noteDeleteConfirm);
                    if (idx !== -1) RENTAL_NOTES.splice(idx, 1);
                    setNoteDeleteConfirm(null);
                    reRenderNotes(n => n + 1);
                  }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--c-red)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Transactions({ highlightTxId, onBack, onClearHighlight, backLabel }) {
  const [txData, setTxData] = useState(TRANSACTIONS);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [propFilter, setPropFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [detailTx, setDetailTx] = useState(null);
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

  const emptyIncome  = { date: "", propertyId: PROPERTIES[0]?.id || "", type: "income",  category: "Rent Income",      description: "", amount: "", payee: "", piOverride: false, piPrincipal: "", piInterest: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
  const emptyExpense = { date: "", propertyId: PROPERTIES[0]?.id || "", type: "expense", category: "Mortgage Payment", description: "", amount: "", payee: "", piOverride: false, piPrincipal: "", piInterest: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
  const [form, setForm] = useState(emptyIncome);
  const [payeeFocus, setPayeeFocus] = useState(false);
  const [mainReceipts, setMainReceipts] = useState([]);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const closeModal = () => { setShowModal(false); setPayeeFocus(false); setMainReceipts([]); };
  const openAddIncome  = () => { setEditId(null); setForm(emptyIncome);  setPayeeFocus(false); setMainReceipts([]); setShowModal("income");  };
  const openAddExpense = () => { setEditId(null); setForm(emptyExpense); setPayeeFocus(false); setMainReceipts([]); setShowModal("expense"); };
  const openEdit = t => {
    setEditId(t.id);
    setForm({ date: t.date, propertyId: t.propertyId, type: t.type, category: t.category, description: t.description, amount: String(Math.abs(t.amount)), payee: t.payee || "", piOverride: !!(t.piPrincipal || t.piInterest), piPrincipal: t.piPrincipal ? String(t.piPrincipal) : "", piInterest: t.piInterest ? String(t.piInterest) : "" });
    setPayeeFocus(false);
    setMainReceipts(TRANSACTION_RECEIPTS.filter(r => r.transactionId === t.id));
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
    const matchProp = propFilter === "all" || t.propertyId === Number(propFilter);
    const matchCat = catFilter === "all" || t.category === catFilter;
    const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "";
    const matchSearch = t.description.toLowerCase().includes(search.toLowerCase()) || propName.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()) || (t.payee || "").toLowerCase().includes(search.toLowerCase());
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
    const built = { date: form.date || new Date().toISOString().split("T")[0], propertyId: Number(form.propertyId), category: form.category || "Other", description: form.description, amount: form.type === "income" ? Math.abs(amt) : -Math.abs(amt), type: form.type, payee: (form.payee || "").trim() };
    // Store P&I split if mortgage transaction
    if (isMortgage && form.piOverride && form.piPrincipal && form.piInterest) {
      built.piPrincipal = parseFloat(form.piPrincipal) || 0;
      built.piInterest = parseFloat(form.piInterest) || 0;
    } else if (isMortgage) {
      // Auto-calculate and store
      const prop = PROPERTIES.find(p => p.id === Number(form.propertyId));
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
      mainReceipts.filter(r => !TRANSACTION_RECEIPTS.some(er => er.id === r.id)).forEach(r => addTransactionReceipt({ ...r, transactionId: editId }));
    } else {
      const txId = newId();
      setTxData(prev => [{ id: txId, ...built }, ...prev]);
      mainReceipts.forEach(r => addTransactionReceipt({ ...r, transactionId: txId }));
    }
    setForm(emptyIncome);
    closeModal();
  };

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--c-blue)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 0 12px", marginBottom: 0 }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> {backLabel || "Back to Dashboard"}
        </button>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Transactions</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Track all income and expenses across your portfolio</p>
        </div>
        <select value={propFilter} onChange={e => setPropFilter(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
          <option value="all">All Properties</option>
          {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Total Income</p>
          <p style={{ color: "var(--c-green)", fontSize: 24, fontWeight: 800, marginTop: 4, fontFamily: "var(--font-display)" }}>+{fmt(totalIncome)}</p>
        </div>
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Total Expenses</p>
          <p style={{ color: "var(--c-red)", fontSize: 24, fontWeight: 800, marginTop: 4, fontFamily: "var(--font-display)" }}>-{fmt(totalExpenses)}</p>
        </div>
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Net</p>
          <p style={{ color: totalIncome - totalExpenses >= 0 ? "var(--c-green)" : "var(--c-red)", fontSize: 24, fontWeight: 800, marginTop: 4, fontFamily: "var(--font-display)" }}>{fmt(totalIncome - totalExpenses)}</p>
        </div>
      </div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" }} />
        </div>
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
            <span style={{ color: "var(--text-muted)", fontSize: 13, alignSelf: "center" }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...iS, width: "auto", fontSize: 13, padding: "9px 12px" }} placeholder="To" />
          </>
        )}
        {/* Income / Expense toggle */}
        <div style={{ display: "flex", gap: 6 }}>
          {[["all", "All"], ["income", "Income"], ["expense", "Expenses"]].map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "9px 16px", borderRadius: 10, border: filter === f ? "none" : "1px solid var(--border)", background: filter === f ? (f === "income" ? "var(--success-badge)" : f === "expense" ? "var(--danger-badge)" : "var(--c-blue)") : "var(--surface)", color: filter === f ? (f === "income" ? "#15803d" : f === "expense" ? "#b91c1c" : "#fff") : "var(--text-label)", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={openAddExpense} style={{ background: "var(--danger-tint)", color: "#b91c1c", border: "1px solid var(--danger-border)", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Add Expense
          </button>
          <button onClick={openAddIncome} style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Add Income
          </button>
        </div>
      </div>
      {/* Active filter chips + clear */}
      {(propFilter !== "all" || catFilter !== "all" || dateFilter !== "all" || search) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Filtered:</span>
          {propFilter !== "all" && <span style={{ background: "var(--warning-bg)", color: "#e95e00", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{(PROPERTIES.find(p => p.id === Number(propFilter))?.name || "Property").split(" ").slice(0, 2).join(" ")}</span>}
          {catFilter !== "all" && <span style={{ background: "var(--success-tint)", color: "#15803d", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{catFilter}</span>}
          {dateFilter !== "all" && <span style={{ background: "var(--warning-bg)", color: "var(--warning-text)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{{ thisMonth: "This Month", lastMonth: "Last Month", thisYear: "This Year", lastYear: "Last Year", custom: dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : "Custom Range" }[dateFilter]}</span>}
          {search && <span style={{ background: "var(--surface-muted)", color: "var(--text-label)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>"{search}"</span>}
          <button onClick={() => { setPropFilter("all"); setCatFilter("all"); setDateFilter("all"); setDateFrom(""); setDateTo(""); setSearch(""); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear all</button>
        </div>
      )}
      <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["Date", "Property", "Category", "Paid To", "Description", "Amount", "Type", ""].map(h => (
                <th key={h} style={{ padding: "14px 20px", textAlign: "left", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No transactions match your filters. <button onClick={() => { setPropFilter("all"); setCatFilter("all"); setDateFilter("all"); setDateFrom(""); setDateTo(""); setSearch(""); setFilter("all"); }} style={{ background: "none", border: "none", color: "var(--c-blue)", fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button></td></tr>
            )}
            {filtered.map((t, i) => (
              <tr key={t.id} ref={t.id === flashId ? highlightRef : undefined}
                onClick={() => setDetailTx(t)}
                style={{ borderTop: "1px solid var(--border-subtle)", background: t.id === flashId ? "var(--info-tint)" : i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)", transition: "background 1.5s ease", cursor: "pointer" }}
                onMouseEnter={e => { if (t.id !== flashId) e.currentTarget.style.background = "var(--info-tint-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = t.id === flashId ? "var(--info-tint)" : i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)"; }}>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--text-secondary)" }}>{t.date}</td>
                <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{(PROPERTIES.find(p => p.id === t.propertyId)?.name || "Unknown").split(" ").slice(0, 2).join(" ")}</td>
                <td style={{ padding: "14px 20px" }}>
                  {(() => { const group = parentOf(t.category, t.type); return group && group !== t.category ? <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>{group}</p> : null; })()}
                  <span style={{ background: "var(--surface-muted)", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600, color: "var(--text-label)" }}>{t.category}</span>
                </td>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--text-label)" }}>{t.payee || <span style={{ color: "#cbd5e1", fontStyle: "italic" }}>—</span>}</td>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--text-primary)" }}>{t.description}</td>
                <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 700, color: t.type === "income" ? "#15803d" : "#b91c1c" }}>
                  {t.type === "income" ? "+" : "-"}{fmt(Math.abs(t.amount))}
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{ background: t.type === "income" ? "var(--success-badge)" : "var(--danger-badge)", color: t.type === "income" ? "#15803d" : "#b91c1c", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{t.type}</span>
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); openEdit(t); }} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                    <button onClick={e => { e.stopPropagation(); setDeleteConfirm(t); }} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* ── Transaction Detail Panel ── */}
      {detailTx && <TxDetailPanel tx={detailTx} onClose={() => setDetailTx(null)} onEdit={t => { setDetailTx(null); openEdit(t); }} onDelete={t => { setDetailTx(null); setDeleteConfirm(t); }} />}
      {/* ── Shared payee typeahead — rendered inside whichever modal is open ── */}
      {(showModal === "income" || showModal === "expense") && (() => {
        const isIncome = showModal === "income";
        const accentColor = isIncome ? "#15803d" : "#b91c1c";
        const accentBg    = isIncome ? "var(--success-tint)"  : "var(--danger-tint)";
        const accentBorder= isIncome ? "var(--success-border)"  : "var(--danger-border)";
        const saveColor   = isIncome ? "#15803d"  : "#b91c1c";
        const payeeLabel  = isIncome ? "Received From" : "Paid To *";
        const payeePlaceholder = isIncome
          ? "Who paid?"
          : "Who was paid?";
        const payeePool = isIncome ? allPayers : allPayees;

        const typeaheadHint = <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>Type to search previous entries or add new</p>;

        const PayeeDropdown = () => {
          const q = form.payee.toLowerCase();
          const matches = q ? payeePool.filter(p => p.toLowerCase().includes(q) && p.toLowerCase() !== q) : payeePool.slice(0, 6);
          const exactExists = payeePool.some(p => p.toLowerCase() === q);
          const showNew = q && !exactExists;
          if (matches.length === 0 && !showNew) return null;
          return (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
              {matches.slice(0, 6).map(p => (
                <button key={p} onMouseDown={() => { setForm(f => ({ ...f, payee: p })); setPayeeFocus(false); }}
                  style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> {p}
                </button>
              ))}
              {showNew && (
                <button onMouseDown={() => setPayeeFocus(false)}
                  style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "var(--warning-bg)", border: "none", borderTop: matches.length > 0 ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left" }}>
                  <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{form.payee}&rdquo; as new</span>
                </button>
              )}
            </div>
          );
        };

        return (
          <Modal
            title={editId
              ? `Edit ${isIncome ? "Income" : "Expense"}`
              : isIncome ? "Add Income" : "Add Expense"}
            onClose={closeModal}
          >
            {/* Colored type badge at top */}
            <div style={{ background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: 10, padding: "8px 14px", marginBottom: 20, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: accentColor, display: "inline-block" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{isIncome ? "Income" : "Expense"}</span>
            </div>

            {/* OCR hint — expense only, hides once a receipt is attached */}
            {!isIncome && mainReceipts.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--info-tint-alt)", borderRadius: 10, border: "1px solid var(--info-border-alt)", marginBottom: 16 }}>
                <ScanLine size={16} color="var(--c-blue)" />
                <p style={{ fontSize: 12, color: "var(--text-primary)", margin: 0 }}>
                  <strong>Have a receipt?</strong> Attach it below and we can auto-fill the details for you.
                </p>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Date</label>
                <input type="date" value={form.date} onChange={sf("date")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Amount ($) *</label>
                <input type="number" placeholder="0.00" value={form.amount} onChange={sf("amount")} style={iS} />
              </div>

              {/* P&I Split for mortgage payments */}
              {["Mortgage Payment", "Mortgage"].includes(form.category) && form.amount && (() => {
                const prop = PROPERTIES.find(p => p.id === Number(form.propertyId));
                const amt = parseFloat(form.amount) || 0;
                const payDate = form.date || new Date().toISOString().split("T")[0];
                const autoInterest = prop ? calcPaymentInterest(prop.loanAmount, prop.loanRate, prop.loanTermYears, prop.loanStartDate, payDate) : null;
                const autoPrincipal = autoInterest !== null ? Math.max(0, Math.round(amt - autoInterest)) : null;
                const hasLoanTerms = prop && prop.loanAmount && prop.loanRate && prop.loanTermYears && prop.loanStartDate;
                return (
                  <div style={{ gridColumn: "1 / -1", background: "var(--info-tint-alt)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--info-border-alt)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: form.piOverride ? 10 : 0 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#0c4a6e", marginBottom: 2 }}>Principal & Interest Split</p>
                        {hasLoanTerms && !form.piOverride ? (
                          <p style={{ fontSize: 12, color: "var(--text-label)" }}>
                            <span style={{ fontWeight: 700, color: "var(--c-blue)" }}>{fmt(autoPrincipal)}</span> principal + <span style={{ fontWeight: 700, color: "#e95e00" }}>{fmt(autoInterest)}</span> interest
                            <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>(auto from loan terms)</span>
                          </p>
                        ) : !hasLoanTerms && !form.piOverride ? (
                          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Add loan terms to this property for auto-calculation, or enter manually below</p>
                        ) : null}
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, piOverride: !f.piOverride, piPrincipal: f.piOverride ? "" : String(autoPrincipal ?? ""), piInterest: f.piOverride ? "" : String(autoInterest ?? "") }))} style={{ background: form.piOverride ? "var(--info-tint)" : "var(--surface)", border: "1px solid var(--info-border-alt)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "var(--c-blue)", cursor: "pointer", whiteSpace: "nowrap" }}>
                        {form.piOverride ? "Use Auto" : "Override"}
                      </button>
                    </div>
                    {form.piOverride && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ display: "block", color: "var(--c-blue)", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Principal ($)</label>
                          <input type="number" placeholder="0.00" value={form.piPrincipal} onChange={e => setForm(f => ({ ...f, piPrincipal: e.target.value }))} style={{ ...iS, fontSize: 13 }} />
                        </div>
                        <div>
                          <label style={{ display: "block", color: "#e95e00", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Interest ($)</label>
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
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {payeeLabel} {isIncome && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>}
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
                {!payeeFocus && !form.payee && typeaheadHint}
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Description *</label>
                <input type="text" placeholder="Brief description" value={form.description} onChange={sf("description")} style={iS} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Property</label>
                <select value={form.propertyId} onChange={sf("propertyId")} style={iS}>
                  {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Category</label>
                <select value={form.category} onChange={sf("category")} style={iS}>
                  {Object.entries(groupsForType(form.type)).map(([group, subs]) => (
                    <optgroup key={group} label={group}>
                      {subs.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Receipt / Attachment */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <Paperclip size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />Receipt / Attachment
                </label>
                <AttachmentZone
                  onFiles={files => {
                    const newAtts = files.map(f => ({
                      id: newId(), name: f.name, mimeType: f.type,
                      size: f.size > 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(1) + " MB" : Math.round(f.size / 1024) + " KB",
                      url: URL.createObjectURL(f), ocrData: null, createdAt: new Date().toISOString(), userId: "usr_001",
                    }));
                    setMainReceipts(prev => [...prev, ...newAtts]);
                  }}
                  compact label="Attach receipt or document" />
                {mainReceipts.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <AttachmentList items={mainReceipts} onRemove={id => setMainReceipts(prev => prev.filter(r => r.id !== id))} compact />
                    {!isIncome && mainReceipts.filter(r => !r.ocrData).map(att => (
                      <OcrPrompt key={att.id} attachment={att}
                        onResult={(ocrData, a) => {
                          setForm(f => ({
                            ...f,
                            payee: f.payee || ocrData.vendor || "",
                            amount: f.amount || String(ocrData.amount || ""),
                            date: f.date || ocrData.date || "",
                            description: f.description || `Receipt — ${ocrData.vendor || "scanned"}`,
                          }));
                          setMainReceipts(prev => prev.map(r => r.id === a.id ? { ...r, ocrData } : r));
                        }} />
                    ))}
                  </div>
                )}
                {mainReceipts.some(r => r.ocrData) && (
                  <p style={{ fontSize: 11, color: "#15803d", marginTop: 4, fontStyle: "italic" }}>
                    <CheckCircle size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />
                    Fields auto-filled from receipt — please verify
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: saveColor, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                {editId ? "Save Changes" : isIncome ? "Save Income" : "Save Expense"}
              </button>
            </div>
          </Modal>
        );
      })()}
      {deleteConfirm && (
        <Modal title="Delete Transaction" onClose={() => setDeleteConfirm(null)}>
          <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this transaction?</p>
          <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{deleteConfirm.description}</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{PROPERTIES.find(p => p.id === deleteConfirm.propertyId)?.name || "Unknown"} · {deleteConfirm.date} · <span style={{ color: deleteConfirm.type === "income" ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{deleteConfirm.type === "income" ? "+" : "-"}{fmt(Math.abs(deleteConfirm.amount))}</span></p>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { setTxData(prev => prev.filter(x => x.id !== deleteConfirm.id)); setDeleteConfirm(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
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

  const cardS = { background: "var(--surface)", borderRadius: 14, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" };
  const sectionS = { background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", marginBottom: 24 };

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
                        { label: "Annual NOI", value: fmtK(NOI), color: "var(--c-green)" },
                        { label: "Cap Rate", value: `${calcCapRate(p)}%`, color: "var(--c-blue)" },
                        { label: "Cash-on-Cash", value: `${coC}%`, color: "var(--c-purple)" },
                        { label: "Appreciation", value: `+${appreciation}%`, color: "#e95e00" },
                        { label: "Expense Ratio", value: `${expRatio}%`, color: "var(--c-red)" },
                        { label: "DSCR", value: pDSCR, color: "var(--c-blue)" },
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
                  color: parseFloat(propDSCR) >= 1.25 ? "var(--c-green)" : parseFloat(propDSCR) >= 1.0 ? "#e95e00" : "var(--c-red)",
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
                  const scMap = { "active-lease": { bg: "var(--success-badge)", text: "#15803d" }, "month-to-month": { bg: "var(--warning-bg)", text: "#7c2d12" }, vacant: { bg: "var(--danger-badge)", text: "#b91c1c" } };
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
                            { label: "Days Remaining", value: t.daysUntilExpiry !== null ? `${t.daysUntilExpiry}d ${expiring ? "⚠️" : "✓"}` : "—", color: expiring ? "#c2410c" : "#15803d" },
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

// ── REPORT EXPORT HELPERS ──
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}


function exportReportCSV(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear, ownerMonth) {
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
    csv = "Property,Placed in Service,Purchase Price,Land Value,Land Source,Depr Basis,Annual Deduction,Years Held,Cumulative,Remaining\n";
    deprRows.forEach(({ p, basis, annual, yearsHeld, cumul, remaining, estimated, landValue }) => {
      csv += `"${p.name}",${p.purchaseDate || ""},${p.purchasePrice},${landValue},${estimated ? "Estimated (20%)" : "User Entered"},${basis},${annual},${yearsHeld},${cumul},${remaining}\n`;
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
      const depr = Math.round(getDeprBasis(p).basis / yrs);
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
        return d.getMonth() === ownerMonth && d.getFullYear() === Number(taxYear) && t.propertyId === p.id;
      });
      monthTx.forEach(t => { csv += `${t.type},${t.date},"${t.description}","${t.category}",${t.amount}\n`; });
    }
  } else if (activeReport === "transactions") {
    const reportPropIds = new Set(reportProps.map(p => p.id));
    const allTx = TRANSACTIONS.filter(t => reportPropIds.has(t.propertyId));
    csv = "Date,Property,Category,Type,Description,Amount\n";
    allTx.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
      const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "Unknown";
      csv += `${t.date},"${propName}","${t.category}",${t.type},"${t.description || t.vendor || ""}",${t.amount}\n`;
    });
  }
  downloadFile(csv, `PropBooks_${activeReport}_${taxYear}.csv`, "text/csv");
}

function exportReportPDF(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear, propFilter, ownerMonth) {
  // Build printable HTML and open in new window for browser print-to-PDF
  const reportNames = { scheduleE: "Schedule E", cashflow: "Cash Flow Report", ownerStatement: "Owner's Statement", lenderPackage: "Lender Package", depreciation: "Depreciation Schedule", yearend: "Year-End Summary" };
  let tableHTML = "";

  if (activeReport === "scheduleE") {
    reportProps.forEach(p => {
      const { lines, grossRent, totalExp, net, interestSource } = calcPropLines(p);
      tableHTML += `<h3>${p.name}</h3><p style="color:#888">${p.address}</p><table><tr><th>Line</th><th>Description</th><th style="text-align:right">Amount</th></tr>`;
      tableHTML += `<tr><td>3</td><td>Rents Received</td><td style="text-align:right;color:green">+$${grossRent.toLocaleString()}</td></tr>`;
      const deprLabel = getDeprBasis(p).estimated ? "Depreciation (est. — no land value entered)" : "Depreciation";
      const labels = { "5":"Advertising","6":"Auto & Travel","7":"Cleaning","9":"Insurance","10":"Legal & Professional","11":"Management Fees","12":`Mortgage Interest (${interestSource})`,"14":"Repairs","15":"Supplies","16":"Taxes","17":"Utilities","18":deprLabel,"19":"Other" };
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
    const reportPropIds = new Set(reportProps.map(p => p.id));
    const allTx = TRANSACTIONS.filter(t => reportPropIds.has(t.propertyId));
    allTx.sort((a, b) => new Date(b.date) - new Date(a.date));
    tableHTML = `<table><tr><th>Date</th><th>Property</th><th>Category</th><th>Type</th><th>Description</th><th style="text-align:right">Amount</th></tr>`;
    allTx.forEach(t => {
      const isIncome = t.type === "income";
      const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "Unknown";
      tableHTML += `<tr><td>${t.date}</td><td>${propName}</td><td>${t.category}</td><td>${t.type}</td><td>${t.description || t.vendor || ""}</td><td style="text-align:right;color:${isIncome ? 'green' : '#b91c1c'}">${isIncome ? '+' : '-'}$${Math.abs(t.amount).toLocaleString()}</td></tr>`;
    });
    const totIn = allTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totOut = allTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    tableHTML += `<tr style="border-top:2px solid #333;font-weight:bold"><td colspan="5">Totals (${allTx.length} transactions)</td><td style="text-align:right">In: $${totIn.toLocaleString()} | Out: $${totOut.toLocaleString()}</td></tr></table>`;
  } else if (activeReport === "ownerStatement") {
    tableHTML = `<table><tr><th>Type</th><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr>`;
    const p = reportProps[0];
    if (p) {
      const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const monthTx = TRANSACTIONS.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === ownerMonth && d.getFullYear() === Number(taxYear) && t.propertyId === p.id;
      });
      monthTx.forEach(t => {
        const isIncome = t.type === "income";
        tableHTML += `<tr><td>${t.type}</td><td>${t.date}</td><td>${t.description}</td><td>${t.category}</td><td style="text-align:right;color:${isIncome ? 'green' : '#b91c1c'}">${isIncome ? '+' : '-'}$${Math.abs(t.amount).toLocaleString()}</td></tr>`;
      });
      const totIn = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const totOut = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
      tableHTML += `<tr style="border-top:2px solid #333;font-weight:bold"><td colspan="4">Totals</td><td style="text-align:right">In: $${totIn.toLocaleString()} | Out: $${totOut.toLocaleString()}</td></tr></table>`;
    }
  } else if (activeReport === "yearend") {
    tableHTML = `<table><tr><th>Property</th><th style="text-align:right">Annual Rent</th><th style="text-align:right">Annual Expenses</th><th style="text-align:right">Depreciation</th><th style="text-align:right">Mortgage Interest (est)</th><th style="text-align:right">Net</th></tr>`;
    reportProps.forEach(p => {
      const cEff = getEffectiveMonthly(p, TRANSACTIONS);
      const annRent = cEff.monthlyIncome * 12;
      const annExp = cEff.monthlyExpenses * 12;
      const yrs = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
      const depr = Math.round(getDeprBasis(p).basis / yrs);
      const bal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount || 0);
      const intEst = Math.round(bal * (p.loanRate || 4) / 100);
      const net = annRent - annExp - depr - intEst;
      tableHTML += `<tr><td>${p.name}</td><td style="text-align:right">$${Math.round(annRent).toLocaleString()}</td><td style="text-align:right">$${Math.round(annExp).toLocaleString()}</td><td style="text-align:right">$${depr.toLocaleString()}</td><td style="text-align:right">$${intEst.toLocaleString()}</td><td style="text-align:right;color:${net >= 0 ? 'green' : '#b91c1c'}">$${Math.round(net).toLocaleString()}</td></tr>`;
    });
    tableHTML += `</table>`;
  } else {
    tableHTML = `<p>Use your browser's print dialog to save as PDF.</p>`;
  }

  const reportNames2 = { ...reportNames, transactions: "Transaction Detail" };
  const isTaxRpt = ["scheduleE", "depreciation", "yearend"].includes(activeReport);
  const scopeLabel = propFilter === "all" ? "All Properties" : (reportProps[0]?.name || "");
  const html = `<!DOCTYPE html><html><head><title>PropBooks — ${reportNames2[activeReport] || activeReport}</title>
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
    <div class="footer">Generated by PropBooks · For planning purposes only — consult your CPA before filing.</div>
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
  const [ownerMonth, setOwnerMonth] = useState(() => {
    // Default to the most recent month that has transaction data (current year), or current month
    const yr = TAX_CONFIG.currentYear;
    const yrTx = TRANSACTIONS.filter(t => new Date(t.date).getFullYear() === yr);
    if (yrTx.length > 0) return Math.max(...yrTx.map(t => new Date(t.date).getMonth()));
    return new Date().getMonth();
  });
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

  // Smart-default ownerMonth: when a property is selected, jump to the most recent month with data
  useEffect(() => {
    if (propFilter === "all" || activeReport !== "ownerStatement") return;
    const p = PROPERTIES.find(pr => pr.id === Number(propFilter));
    if (!p) return;
    const propTx = TRANSACTIONS.filter(t => t.propertyId === p.id && new Date(t.date).getFullYear() === Number(taxYear));
    if (propTx.length === 0) return; // no data at all — keep current month so the warning shows
    // Find the most recent month with transactions
    const latestMonth = Math.max(...propTx.map(t => new Date(t.date).getMonth()));
    setOwnerMonth(latestMonth);
  }, [propFilter, taxYear, activeReport]);

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
      new Date(t.date).getFullYear() === Number(taxYear) && t.propertyId === p.id && t.type === "expense"
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
      t.propertyId === p.id &&
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

    // Line 18: Depreciation — uses per-property land value when available
    const deprYrs = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
    const deprInfo = getDeprBasis(p);
    lines["18"] = Math.round(deprInfo.basis / deprYrs);

    const txIncome = TRANSACTIONS.filter(t =>
      new Date(t.date).getFullYear() === Number(taxYear) && t.propertyId === p.id && t.type === "income"
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
    const depr = Math.round(getDeprBasis(p).basis / (p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential));
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
      return d.getFullYear() === Number(taxYear) && d.getMonth() === i && reportProps.some(p => p.id === t.propertyId);
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

  // Depreciation schedule — uses per-property landValue when available, falls back to TAX_CONFIG estimate
  const taxYearEnd = new Date(`${taxYear}-12-31`);
  const deprRows = reportProps.map(p => {
    const depr = getDeprBasis(p);
    const basis = depr.basis;
    const deprLife = p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential;
    const annual = Math.round(basis / deprLife);
    const start = p.purchaseDate ? new Date(p.purchaseDate) : new Date("2020-01-01");
    const yearsHeld = Math.max(0, (taxYearEnd - start) / (365.25 * 86400000));
    const cumul = Math.min(basis, Math.round(annual * yearsHeld));
    return { p, basis, annual, deprLife, yearsHeld: yearsHeld.toFixed(1), cumul, remaining: basis - cumul, estimated: depr.estimated, landValue: depr.landValue };
  });
  const hasAnyEstimatedDepr = deprRows.some(r => r.estimated);

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

  const thStyle = { padding: "11px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" };
  const tdStyle = { padding: "12px 16px", fontSize: 13, color: "var(--text-primary)", borderTop: "1px solid var(--border-subtle)" };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Reports</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Financial summaries, tax reports, and lender packages</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {activeReport !== "transactions" && activeReport !== "ownerStatement" && (
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
          <button onClick={() => exportReportCSV(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear, ownerMonth)} style={{ background: "var(--surface)", color: "var(--text-label)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={16} /> CSV
          </button>
          <button onClick={() => exportReportPDF(activeReport, reportProps, monthlyData, deprRows, lenderData, calcPropLines, taxYear, propFilter, ownerMonth)} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
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
            return s + Math.round(getDeprBasis(p).basis / yrs);
          }, 0);
          const actualPct = Math.round((allCalc.filter(c => c.hasActual).length / Math.max(1, allCalc.length)) * 100);
          return [
            { label: "Gross Rental Income", value: fmt(tRent), color: "var(--c-green)", bg: "var(--success-tint)" },
            { label: "Total Expenses", value: fmt(tExp), color: "var(--c-red)", bg: "var(--danger-tint)" },
            { label: isTaxReport ? "Net Taxable Income" : "Net Operating Income", value: fmt(tNet), color: tNet >= 0 ? "var(--c-green)" : "var(--c-red)", bg: "var(--info-tint-alt)" },
            { label: isTaxReport ? "Annual Depreciation" : "Portfolio Properties", value: isTaxReport ? fmt(tDepr) : String(reportProps.length), color: isTaxReport ? "var(--c-purple)" : "var(--c-purple)", bg: "var(--purple-tint)" },
            { label: "Actual Data Coverage", value: `${actualPct}%`, color: "var(--c-blue)", bg: "var(--info-tint)" },
          ].map((m, i) => (
            <div key={i} style={{ background: "var(--surface)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border-subtle)" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{m.label}</p>
              <p style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
            </div>
          ));
        })()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
        {/* Sidebar nav */}
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", height: "fit-content" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 14px 4px" }}>Tax Reports</p>
          {taxReports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: activeReport === r.id ? "var(--active-highlight)" : "transparent", color: activeReport === r.id ? "var(--c-blue)" : "var(--text-label)", fontWeight: activeReport === r.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
              <r.icon size={16} /> {r.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "8px 14px", paddingTop: 0 }} />
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 14px 4px" }}>Financial Reports</p>
          {financialReports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, border: "none", background: activeReport === r.id ? "var(--active-highlight)" : "transparent", color: activeReport === r.id ? "var(--c-blue)" : "var(--text-label)", fontWeight: activeReport === r.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
              <r.icon size={16} /> {r.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 12, paddingTop: 12 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", padding: "0 14px", marginBottom: 6 }}>Scope</p>
            <p style={{ fontSize: 12, color: "var(--text-label)", padding: "0 14px", fontWeight: 600 }}>{propFilter === "all" ? `All ${PROPERTIES.length} properties` : PROPERTIES.find(p => p.id === Number(propFilter))?.name}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "0 14px" }}>{activeReport === "transactions" ? `${txDateFrom} – ${txDateTo}` : isTaxReport ? `Tax Year ${taxYear}` : `Year ${taxYear}`}</p>
          </div>
        </div>

        {/* Report content */}
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>

          {/* ── SCHEDULE E ── */}
          {activeReport === "scheduleE" && (
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Schedule E — Supplemental Income &amp; Loss</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Tax Year {taxYear} · Part I: Income or Loss From Rental Real Estate</p>
              {reportProps.map(p => {
                const { lines, grossRent, totalExp, net, hasActual, interestSource } = calcPropLines(p);
                const pDeprEst = getDeprBasis(p).estimated;
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
                  { n: "18", label: pDeprEst ? "Depreciation (est. *)" : "Depreciation" },
                  { n: "19", label: "Other" },
                ];
                const filledLines = lineOrder.filter(l => l.income ? grossRent > 0 : (lines[l.n] || 0) > 0);
                return (
                  <div key={p.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>{p.image}</div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{p.name}</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.address}</p>
                      </div>
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                        {hasActual && <span style={{ fontSize: 11, background: "var(--success-badge)", color: "#15803d", borderRadius: 6, padding: "3px 8px", fontWeight: 700 }}>Actual Data</span>}
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Net Income / (Loss)</p>
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
                            <tr key={l.n} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                              <td style={{ ...tdStyle, color: "var(--text-muted)", fontWeight: 700, width: 50 }}>{l.n}</td>
                              <td style={{ ...tdStyle, color: "var(--text-label)" }}>{l.label}</td>
                              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: l.income ? "#15803d" : "#b91c1c" }}>
                                {l.income ? "+" : "-"}{fmt(val)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: "var(--info-tint-alt)", borderTop: "2px solid var(--info-border-alt)" }}>
                          <td style={{ ...tdStyle, fontWeight: 800, color: "var(--text-primary)" }} colSpan={2}>26. Total Expenses &amp; Net Income / (Loss)</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, fontSize: 15, color: net >= 0 ? "#15803d" : "#b91c1c" }}>
                            {net >= 0 ? "+" : "-"}{fmt(Math.abs(net))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
              <div style={{ background: "var(--info-tint-alt)", borderRadius: 14, padding: 20, border: "1px solid var(--info-border-alt)" }}>
                <h3 style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Portfolio Totals</h3>
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
                      { label: "Total Depreciation", value: `-${fmt(reportProps.reduce((s, p) => s + Math.round(getDeprBasis(p).basis/(p.type === "Commercial" ? TAX_CONFIG.depreciationCommercial : TAX_CONFIG.depreciationResidential)), 0))}`, color: "#b91c1c" },
                      { label: "Mortgage Interest (est.)", value: `-${fmt(reportProps.reduce((s, p) => { const b = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount||0); return s + Math.round(b*(p.loanRate||4)/100); }, 0))}`, color: "#b91c1c" },
                      { label: "Est. Tax Liability @ 28%", value: tNet > 0 ? `-${fmt(Math.round(tNet * 0.28))}` : "$0", color: "#b91c1c" },
                    ].map((m, i) => (
                      <div key={i} style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 16px" }}>
                        <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}</p>
                        <p style={{ color: m.color, fontSize: 16, fontWeight: 800 }}>{m.value}</p>
                      </div>
                    ));
                  })()}
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 14 }}>⚠️ Estimates for planning only. Mortgage interest is estimated from outstanding loan balance. Consult your CPA before filing.</p>
              </div>
            </div>
          )}

          {/* ── CASH FLOW REPORT ── */}
          {activeReport === "cashflow" && (
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Cash Flow Report</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 6 }}>{taxYear} · Monthly income and expense detail</p>
              <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--c-green)", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "var(--text-label)" }}>Income</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--c-red)", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "var(--text-label)" }}>Expenses</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--c-blue)", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "var(--text-label)" }}>Net Cash Flow</span>
                </div>
              </div>

              {/* Cash Flow Bar Chart */}
              <div style={{ background: "var(--surface-alt)", borderRadius: 14, padding: "20px 16px 10px", marginBottom: 24, border: "1px solid var(--border-subtle)" }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v, name) => [`$${v.toLocaleString()}`, name]} cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--tooltip-border)", fontSize: 12, background: "var(--tooltip-bg)", color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
                    <Bar dataKey="income" name="Income" fill="var(--c-green)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="var(--c-red)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="net" name="Net" fill="var(--chart-bar-primary)" radius={[6, 6, 0, 0]} />
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
                      <th style={{ ...thStyle, color: "var(--c-blue)" }}>Net Cash Flow</th>
                      <th style={thStyle}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m, i) => {
                      const margin = m.income > 0 ? ((m.net / m.income) * 100).toFixed(0) : 0;
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{m.month}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 8px", background: m.isActual ? "var(--success-badge)" : "var(--surface-muted)", color: m.isActual ? "#15803d" : "var(--text-muted)" }}>
                              {m.isActual ? "Actual" : "Est."}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: "#15803d", fontWeight: 600 }}>+{fmt(m.income)}</td>
                          <td style={{ ...tdStyle, color: "#b91c1c" }}>-{fmt(m.expenses)}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: m.net >= 0 ? "#15803d" : "#b91c1c" }}>{m.net >= 0 ? "+" : ""}{fmt(m.net)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: "var(--surface-muted)", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, Number(margin)))}%`, background: Number(margin) >= 30 ? "var(--c-green)" : Number(margin) >= 10 ? "#e95e00" : "var(--c-red)", borderRadius: 99 }} />
                              </div>
                              <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 34, textAlign: "right" }}>{margin}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--info-tint-alt)", borderTop: "2px solid var(--info-border-alt)" }}>
                      <td style={{ ...tdStyle, fontWeight: 800, color: "var(--text-primary)" }}>Full Year</td>
                      <td style={tdStyle} />
                      <td style={{ ...tdStyle, fontWeight: 800, color: "var(--c-green)" }}>+{fmt(monthlyData.reduce((s, m) => s + m.income, 0))}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: "var(--c-red)" }}>-{fmt(monthlyData.reduce((s, m) => s + m.expenses, 0))}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: "var(--c-green)" }}>{fmt(monthlyData.reduce((s, m) => s + m.net, 0))}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "var(--text-primary)" }}>{((monthlyData.reduce((s, m) => s + m.net, 0) / Math.max(1, monthlyData.reduce((s, m) => s + m.income, 0))) * 100).toFixed(0)}% avg</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── OWNER'S STATEMENT ── */}
          {activeReport === "ownerStatement" && (
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Owner's Statement</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Monthly P&amp;L summary per property — select a property and month to generate</p>
              {propFilter === "all" ? (
                <div style={{ background: "var(--surface-alt)", borderRadius: 14, padding: 40, textAlign: "center", border: "1px dashed #cbd5e1" }}>
                  <Home size={36} style={{ color: "#cbd5e1", marginBottom: 12 }} />
                  <p style={{ color: "var(--text-label)", fontWeight: 600, marginBottom: 6 }}>Select a Property to Generate Owner's Statement</p>
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Use the property dropdown above to filter to a single property.</p>
                </div>
              ) : (() => {
                const p = reportProps[0];
                const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
                const monthTx = TRANSACTIONS.filter(t => {
                  const d = new Date(t.date);
                  return d.getMonth() === ownerMonth && d.getFullYear() === Number(taxYear) && t.propertyId === p.id;
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
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{p.image}</div>
                      <div>
                        <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>{p.name}</p>
                        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{p.address}</p>
                      </div>
                      <div style={{ marginLeft: "auto" }}>
                        <select value={ownerMonth} onChange={e => setOwnerMonth(Number(e.target.value))} style={{ ...iS, width: 160 }}>
                          {MONTH_NAMES.map((mn, i) => <option key={i} value={i}>{mn} {taxYear}</option>)}
                        </select>
                      </div>
                    </div>

                    {!hasData ? (
                      <div style={{ background: "var(--warning-bg)", borderRadius: 12, padding: "14px 18px", border: "1px solid var(--warning-border)", marginBottom: 20 }}>
                        <p style={{ color: "var(--warning-text)", fontSize: 13, fontWeight: 600 }}>No transactions logged for {MONTH_NAMES[ownerMonth]} {taxYear}. Add transactions to see actual data here.</p>
                      </div>
                    ) : null}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                      {[
                        { label: "Total Income", value: fmt(totalIn), color: "#15803d", bg: "var(--success-tint)" },
                        { label: "Total Expenses", value: fmt(totalOut), color: "#b91c1c", bg: "var(--danger-tint)" },
                        { label: "Net Operating Income", value: fmt(net), color: net >= 0 ? "#15803d" : "#b91c1c", bg: "var(--info-tint-alt)" },
                      ].map((kpi, i) => (
                        <div key={i} style={{ background: kpi.bg, borderRadius: 12, padding: "16px 18px" }}>
                          <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>{kpi.label}</p>
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
                              <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                <td style={{ padding: "8px 0", fontSize: 13, color: "var(--text-primary)" }}>
                                  <div>{t.description}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.date}</div>
                                </td>
                                <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 700, color: "#15803d", textAlign: "right" }}>+{fmt(t.amount)}</td>
                              </tr>
                            )) : (
                              <tr><td colSpan={2} style={{ padding: "12px 0", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>No income recorded</td></tr>
                            )}
                            <tr style={{ borderTop: "2px solid var(--border)" }}>
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
                              <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                <td style={{ padding: "8px 0", fontSize: 13, color: "var(--text-primary)" }}>
                                  <div>{t.description}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.category} · {t.date}</div>
                                </td>
                                <td style={{ padding: "8px 0", fontSize: 13, fontWeight: 600, color: "#b91c1c", textAlign: "right" }}>-{fmt(Math.abs(t.amount))}</td>
                              </tr>
                            )) : (
                              <tr><td colSpan={2} style={{ padding: "12px 0", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>No expenses recorded</td></tr>
                            )}
                            <tr style={{ borderTop: "2px solid var(--border)" }}>
                              <td style={{ padding: "10px 0", fontWeight: 700, fontSize: 13 }}>Total Expenses</td>
                              <td style={{ padding: "10px 0", fontWeight: 800, color: "#b91c1c", textAlign: "right" }}>-{fmt(totalOut)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Income → Operating Expenses → NOI → Debt Service → Owner Distribution */}
                    {(() => {
                      const mgmtTx = expenses.filter(t => ["Property Management", "Management Fee", "Leasing Fee"].includes(t.category));
                      const mgmtFee = mgmtTx.reduce((s, t) => s + Math.abs(t.amount), 0);
                      const debtTx = expenses.filter(t => ["Mortgage", "Mortgage Payment"].includes(t.category));
                      const debtService = debtTx.reduce((s, t) => s + Math.abs(t.amount), 0);
                      const opEx = totalOut - debtService;
                      const noi = totalIn - opEx;
                      const cashFlow = noi - debtService;
                      return (
                        <div style={{ marginTop: 20 }}>
                          <div style={{ background: noi >= 0 ? "var(--success-tint)" : "var(--danger-tint)", borderRadius: "12px 12px 0 0", padding: "14px 20px", border: `1px solid ${noi >= 0 ? "var(--success-border)" : "var(--danger-border)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>Net Operating Income — {MONTH_NAMES[ownerMonth]} {taxYear}</p>
                            <p style={{ fontWeight: 800, fontSize: 20, color: noi >= 0 ? "#15803d" : "#b91c1c" }}>{noi >= 0 ? "+" : "-"}{fmt(Math.abs(noi))}</p>
                          </div>
                          <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderTop: "none", padding: "14px 20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                              <span style={{ fontSize: 13, color: "var(--text-label)" }}>Operating Expenses (incl. mgmt{mgmtFee > 0 ? ` ${fmt(mgmtFee)}` : ""})</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>-{fmt(opEx)}</span>
                            </div>
                            {debtService > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                                <span style={{ fontSize: 13, color: "var(--text-label)" }}>Less: Debt Service (P&I)</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>-{fmt(debtService)}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ background: "var(--info-tint)", borderRadius: "0 0 12px 12px", padding: "14px 20px", border: "1px solid var(--info-border)", borderTop: "2px solid #3b82f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--c-blue)" }}>Owner Distribution (Cash Flow)</p>
                            <p style={{ fontWeight: 800, fontSize: 20, color: cashFlow >= 0 ? "var(--c-blue)" : "#b91c1c" }}>{cashFlow >= 0 ? "+" : "-"}{fmt(Math.abs(cashFlow))}</p>
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
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Lender / Refinance Package</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Key metrics lenders evaluate — NOI, DSCR, LTV, equity, and debt service</p>
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
                    const dscrBg   = dscr === null ? "var(--surface-alt)" : dscr >= 1.25 ? "var(--success-badge)" : dscr >= 1.0 ? "var(--warning-bg)" : "var(--danger-badge)";
                    const ltvColor = ltv < 70 ? "#15803d" : ltv < 80 ? "#d97706" : "#b91c1c";
                    const capColor = capRate >= 6 ? "#15803d" : capRate >= 4 ? "#d97706" : "#b91c1c";
                    return (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{p.image}</div>
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
                  <tr style={{ background: "var(--info-tint-alt)", borderTop: "2px solid var(--info-border-alt)" }}>
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
              <div style={{ background: "var(--surface-alt)", borderRadius: 14, padding: 18, border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>DSCR Reference Guide</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                  {[
                    { label: "Strong — Lender Favorable", range: "≥ 1.25", bg: "var(--success-badge)", color: "#15803d", note: "Most lenders approve at this threshold. Strong cash coverage." },
                    { label: "Marginal — Borderline", range: "1.00 – 1.24", bg: "var(--warning-bg)", color: "#d97706", note: "Debt is covered but thin. Some lenders require reserves or higher rates." },
                    { label: "Negative Coverage", range: "< 1.00", bg: "var(--danger-badge)", color: "#b91c1c", note: "Property cash flow doesn't cover debt. Refinance may be difficult." },
                  ].map((g, i) => (
                    <div key={i} style={{ background: g.bg, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: g.color }}>{g.label}</p>
                        <span style={{ fontSize: 14, fontWeight: 800, color: g.color }}>{g.range}</span>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-label)" }}>{g.note}</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>DSCR = Net Operating Income ÷ Annual Debt Service. LTV = Outstanding Loan Balance ÷ Current Property Value. Loan balances estimated via amortization formula.</p>
              </div>
            </div>
          )}

          {/* ── DEPRECIATION SCHEDULE ── */}
          {activeReport === "depreciation" && (
            <div>
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Depreciation Schedule</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 6 }}>Tax Year {taxYear} · IRS MACRS — Residential ({TAX_CONFIG.depreciationResidential} yr) &amp; Commercial ({TAX_CONFIG.depreciationCommercial} yr), straight-line</p>
              <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 24 }}>Depreciable basis = Purchase Price − Land Value. Land is not depreciable per IRS rules.</p>
              {hasAnyEstimatedDepr && (
                <div style={{ background: "var(--warning-bg)", border: "1px solid #fed7aa", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <AlertTriangle size={16} color="#c2410c" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#c2410c", marginBottom: 2 }}>Estimated land values in use</p>
                    <p style={{ fontSize: 12, color: "#9a3412" }}>
                      {deprRows.filter(r => r.estimated).map(r => r.p.name.split(" ").slice(0,2).join(" ")).join(", ")} {deprRows.filter(r => r.estimated).length === 1 ? "is" : "are"} using the default {TAX_CONFIG.landValuePct * 100}% land estimate.
                      Enter actual land values (from county tax assessment) in each property's settings for accurate depreciation.
                    </p>
                  </div>
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Property", "Placed in Service", "Purchase Price", "Land Value", "Depr. Basis", "Life", "Annual Deduction", "Yrs Held", "Cumul. Taken", "Remaining"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deprRows.map(({ p, basis, annual, yearsHeld, cumul, remaining, deprLife, estimated, landValue }, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{p.image}</div>
                          {p.name.split(" ").slice(0, 2).join(" ")}
                        </div>
                      </td>
                      <td style={tdStyle}>{p.purchaseDate || "—"}</td>
                      <td style={tdStyle}>{fmt(p.purchasePrice)}</td>
                      <td style={tdStyle}>
                        <span style={{ color: estimated ? "#c2410c" : "var(--text-secondary)" }}>
                          {fmt(landValue)}{estimated ? " *" : ""}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--c-purple)", fontWeight: 600 }}>{fmt(basis)}</td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>{deprLife} yr</td>
                      <td style={{ ...tdStyle, color: "#b91c1c", fontWeight: 700 }}>-{fmt(annual)}</td>
                      <td style={tdStyle}>{yearsHeld} yrs</td>
                      <td style={{ ...tdStyle, color: "#b91c1c" }}>-{fmt(cumul)}</td>
                      <td style={{ ...tdStyle, color: "var(--text-primary)", fontWeight: 600 }}>{fmt(remaining)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--info-tint-alt)", borderTop: "2px solid var(--info-border-alt)" }}>
                    <td colSpan={6} style={{ ...tdStyle, fontWeight: 800, color: "#0c4a6e" }}>Portfolio Total</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: "#b91c1c" }}>-{fmt(deprRows.reduce((s, r) => s + r.annual, 0))}</td>
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#b91c1c" }}>-{fmt(deprRows.reduce((s, r) => s + r.cumul, 0))}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(deprRows.reduce((s, r) => s + r.remaining, 0))}</td>
                  </tr>
                </tfoot>
              </table>
              {hasAnyEstimatedDepr && (
                <p style={{ fontSize: 11, color: "#9a3412", marginTop: 10 }}>* Estimated — land value not entered, using default {TAX_CONFIG.landValuePct * 100}% of purchase price</p>
              )}
              <div style={{ background: "var(--warning-bg)", border: "1px solid #fdba74", borderRadius: 12, padding: "12px 16px", marginTop: 16 }}>
                <p style={{ fontSize: 12, color: "#7c2d12" }}>⚠️ Depreciation recapture at {TAX_CONFIG.recaptureRate * 100}% applies if you sell. Buildings placed in service mid-year use the mid-month convention for the first year. This report is for informational purposes — consult your CPA for your exact tax deduction.</p>
              </div>
            </div>
          )}

          {/* ── YEAR-END SUMMARY ── */}
          {activeReport === "yearend" && (() => {
            // Pull actual other income (late fees, pet fees, app fees) from transactions
            const otherIncomeTx = TRANSACTIONS.filter(t =>
              new Date(t.date).getFullYear() === Number(taxYear) && t.type === "income" && reportProps.some(p => p.id === t.propertyId)
              && !["Rent", "Rent Payment", "Monthly Rent"].includes(t.category)
            );
            const otherIncome = otherIncomeTx.reduce((s, t) => s + t.amount, 0);

            // Pull actual property tax from transactions
            const propTaxTx = TRANSACTIONS.filter(t =>
              new Date(t.date).getFullYear() === Number(taxYear) && reportProps.some(p => p.id === t.propertyId)
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
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Year-End Tax Summary</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Tax Year {taxYear} · Full rental P&amp;L for your records and CPA</p>

              {/* Income section */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Income</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      { label: "Gross Rents Received", value: totIncome },
                      { label: otherIncome > 0 ? `Other Income (late fees, deposits, etc.)` : "Other Income", value: otherIncome, note: otherIncome === 0 ? "No non-rent income transactions logged" : null },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "10px 0", fontSize: 14, color: "var(--text-primary)" }}>{row.label}{row.note && <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 8 }}>({row.note})</span>}</td>
                        <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 700, color: "#15803d", textAlign: "right" }}>+{fmt(row.value)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Total Gross Income</td>
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
                      { label: hasAnyEstimatedDepr ? "Depreciation — straight-line (some land values estimated *)" : "Depreciation — straight-line", value: totDepr },
                      { label: propTaxHasActual ? "Property Taxes (from transactions)" : "Property Taxes (no transactions logged)", value: propTaxActual, note: !propTaxHasActual },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)", background: row.isInfo ? "var(--surface-alt)" : "transparent" }}>
                        <td style={{ padding: "10px 0", fontSize: row.isInfo ? 13 : 14, color: row.isInfo ? "var(--text-secondary)" : "var(--text-primary)", paddingLeft: row.isInfo ? 16 : 0 }}>
                          {row.label}
                          {row.note && <span style={{ color: "#e95e00", fontSize: 12, marginLeft: 8 }}>— log property tax payments for accuracy</span>}
                        </td>
                        <td style={{ padding: "10px 0", fontSize: row.isInfo ? 13 : 14, fontWeight: 600, color: row.isInfo ? "#94a3b8" : "#b91c1c", textAlign: "right" }}>{row.isInfo ? fmt(row.value) : `-${fmt(row.value)}`}</td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Total Deductions</td>
                      <td style={{ padding: "10px 0", fontSize: 15, fontWeight: 800, color: "#b91c1c", textAlign: "right" }}>-{fmt(totalDeductions)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bottom line */}
              <div style={{ background: totNet >= 0 ? "var(--success-tint)" : "var(--danger-tint)", borderRadius: 14, padding: 20, border: `1px solid ${totNet >= 0 ? "var(--success-border)" : "var(--danger-border)"}`, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Net Taxable Rental Income</p>
                  <p style={{ fontSize: 24, fontWeight: 800, color: totNet >= 0 ? "#15803d" : "#b91c1c" }}>{totNet >= 0 ? "" : "-"}{fmt(Math.abs(totNet))}</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
                  <div style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 14px" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Marginal Tax Rate</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <select value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 15, fontWeight: 800, color: "var(--text-label)", cursor: "pointer" }}>
                        {TAX_CONFIG.brackets.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                  </div>
                  {[
                    { label: `Est. Federal Tax @ ${taxRate}%`, value: totNet > 0 ? `-${fmt(Math.round(totNet * rate))}` : "No liability", color: "#b91c1c" },
                    { label: "Net After Est. Taxes", value: fmt(totNet - Math.max(0, Math.round(totNet * rate))), color: "#15803d" },
                    { label: "Effective Rate", value: totNet > 0 ? `${((Math.round(totNet * rate) / totalGross) * 100).toFixed(1)}%` : "N/A", color: "var(--text-label)" },
                  ].map((m, i) => (
                    <div key={i} style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 14px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}</p>
                      <p style={{ color: m.color, fontSize: 15, fontWeight: 800 }}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>⚠️ Estimates for planning only — does not account for the {TAX_CONFIG.qbiDeductionPct * 100}% QBI deduction (Sec. 199A), passive activity loss rules, or state taxes. Please consult your CPA before filing.</p>
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
              return d >= fromDate && d <= toDate && reportProps.some(p => p.id === t.propertyId);
            });

            // Unique categories
            const categories = [...new Set(allTx.map(t => t.category))].sort();

            // Apply filters
            let filtered = allTx;
            if (txTypeFilter !== "all") filtered = filtered.filter(t => t.type === txTypeFilter);
            if (txCatFilter !== "all") filtered = filtered.filter(t => t.category === txCatFilter);
            if (txSearch.trim()) {
              const q = txSearch.toLowerCase();
              filtered = filtered.filter(t => {
                const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "";
                return (t.description || "").toLowerCase().includes(q) ||
                  (t.category || "").toLowerCase().includes(q) ||
                  propName.toLowerCase().includes(q) ||
                  (t.vendor || "").toLowerCase().includes(q);
              });
            }

            // Sort
            const sorted = [...filtered].sort((a, b) => {
              if (txSort === "date-desc") return new Date(b.date) - new Date(a.date);
              if (txSort === "date-asc") return new Date(a.date) - new Date(b.date);
              if (txSort === "amount-desc") return Math.abs(b.amount) - Math.abs(a.amount);
              if (txSort === "amount-asc") return Math.abs(a.amount) - Math.abs(b.amount);
              if (txSort === "property") {
                const aPropName = PROPERTIES.find(p => p.id === a.propertyId)?.name || "";
                const bPropName = PROPERTIES.find(p => p.id === b.propertyId)?.name || "";
                return aPropName.localeCompare(bPropName);
              }
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
              <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Transaction Detail</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>All transactions for selected date range · Filter by property, type, or category</p>

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
                  { label: "Total Income", value: `+${fmt(totalIncome)}`, color: "#15803d", bg: "var(--success-tint)" },
                  { label: "Total Expenses", value: `-${fmt(totalExpenses)}`, color: "#b91c1c", bg: "var(--danger-tint)" },
                  { label: "Net Cash Flow", value: `${netFlow >= 0 ? "+" : ""}${fmt(netFlow)}`, color: netFlow >= 0 ? "#15803d" : "#b91c1c", bg: "var(--info-tint-alt)" },
                  { label: "Transactions", value: `${filtered.length}`, color: "var(--c-blue)", bg: "var(--info-tint)" },
                ].map((m, i) => (
                  <div key={i} style={{ background: m.bg, borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border-subtle)" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{m.label}</p>
                    <p style={{ color: m.color, fontSize: 20, fontWeight: 800 }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                  <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search description, vendor, property..." style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13, color: "var(--text-primary)", outline: "none" }} />
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
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No transactions match your filters</td></tr>
                    ) : sorted.slice(0, 200).map((t, i) => {
                      const isIncome = t.type === "income";
                      return (
                        <tr key={t.id || i} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                          <td style={{ ...tdStyle, fontSize: 12, whiteSpace: "nowrap" }}>{new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>
                            <span style={{ fontWeight: 600 }}>{(PROPERTIES.find(p => p.id === t.propertyId)?.name || "Unknown").split(" ").slice(0, 2).join(" ")}</span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 8px", background: isIncome ? "var(--success-badge)" : "var(--danger-badge)", color: isIncome ? "#15803d" : "#b91c1c" }}>{t.category}</span>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-label)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description || t.vendor || "—"}</td>
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
                      <tr style={{ background: "var(--info-tint-alt)", borderTop: "2px solid var(--info-border-alt)" }}>
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
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Category Breakdown</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                    {catRows.map(([cat, data]) => {
                      const total = data.income + data.expense;
                      const isIncomeCat = data.income > data.expense;
                      return (
                        <div key={cat} style={{ background: "var(--surface-alt)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{cat}</p>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", background: "var(--surface-muted)", borderRadius: 6, padding: "2px 6px" }}>{data.count}</span>
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
// DEAL COMPONENTS
// ---------------------------------------------

function StageBadge({ stage }) {
  const s = STAGE_COLORS[stage] || { bg: "var(--surface-muted)", text: "var(--text-label)", dot: "var(--text-muted)" };
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
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{pct}% complete</span>
        <span style={{ fontSize: 13, color: over ? "#b91c1c" : "var(--text-secondary)", fontWeight: over ? 700 : 400 }}>
          {fmt(totalSpent)} / {fmt(totalBudget)} {over && "(!) Over budget"}
        </span>
      </div>
      <div style={{ height: 8, background: "var(--surface-muted)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: over ? "var(--c-red)" : pct >= 80 ? "#e95e00" : "var(--c-green)", borderRadius: 99, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function DealCard({ deal, onSelect }) {
  const s = STAGE_COLORS[deal.stage];
  const totalCost = deal.purchasePrice + deal.rehabBudget + (deal.holdingCostsPerMonth * (deal.daysOwned / 30));
  const projectedProfit = deal.arv - totalCost - (deal.arv * ((deal.sellingCostPct || 6) / 100));
  const mao70 = (deal.arv * 0.70) - deal.rehabBudget;
  const rehabPct = deal.rehabBudget > 0 ? Math.round((deal.rehabSpent / deal.rehabBudget) * 100) : 0;

  return (
    <div onClick={() => onSelect(deal)}
      style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800 }}>{deal.image}</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{deal.name}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{deal.address.split(",")[1]?.trim()}</p>
          </div>
        </div>
        <StageBadge stage={deal.stage} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Purchase", value: fmtK(deal.purchasePrice) },
          { label: "ARV", value: fmtK(deal.arv) },
          { label: deal.stage === "Sold" ? "Net Profit" : "Proj. Profit", value: deal.stage === "Sold" ? fmt(deal.netProfit) : fmtK(Math.round(projectedProfit)), color: "var(--c-green)" },
        ].map((m, i) => (
          <div key={i} style={{ background: "var(--surface-alt)", borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{m.label}</p>
            <p style={{ color: m.color || "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>{m.value}</p>
          </div>
        ))}
      </div>

      {deal.stage !== "Sold" && deal.stage !== "Under Contract" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>REHAB PROGRESS</span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{rehabPct}%</span>
          </div>
          <div style={{ height: 6, background: "var(--surface-muted)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${rehabPct}%`, background: rehabPct >= 80 ? "var(--c-green)" : "#e95e00", borderRadius: 99 }} />
          </div>
        </div>
      )}

      {deal.stage === "Under Contract" && (
        <p style={{ fontSize: 12, color: "var(--c-purple)", fontWeight: 600 }}>
          <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
          Closing {deal.projectedCloseDate}
        </p>
      )}

      {deal.daysOwned > 0 && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          <Clock size={11} style={{ display: "inline", marginRight: 3 }} />
          Day {deal.daysOwned} of hold
        </p>
      )}
    </div>
  );
}

function DealPipeline({ onSelect, onGuidedSetup }) {
  const { showToast } = useToast();
  const [activeStage, setActiveStage] = useState("all");
  const [, forceRender] = useState(0);

  const activeDeals = DEALS.filter(f => f.stage !== "Sold");
  const totalDeployed = activeDeals.reduce((s, f) => s + f.purchasePrice + f.rehabSpent, 0);
  const projectedProfits = DEALS.filter(f => f.stage !== "Sold").map(f => {
    const totalCost = f.purchasePrice + f.rehabBudget + (f.holdingCostsPerMonth * (f.daysOwned / 30));
    return f.arv - totalCost - (f.arv * ((f.sellingCostPct || 6) / 100));
  });
  const totalProjected = projectedProfits.reduce((s, v) => s + v, 0);
  const realizedProfit = DEALS.filter(f => f.stage === "Sold").reduce((s, f) => s + (f.netProfit || 0), 0);

  const filtered = activeStage === "all" ? DEALS : DEALS.filter(f => f.stage === activeStage);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Deals</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Track every deal from contract to close</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onGuidedSetup} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Deal
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { icon: Hammer, label: "Active Deals", value: activeDeals.length, sub: "In pipeline", color: "#e95e00" },
          { icon: DollarSign, label: "Capital Deployed", value: fmtK(totalDeployed), sub: "Purchase + rehab", color: "var(--c-blue)" },
          { icon: TrendingUp, label: "Projected Profit", value: fmtK(Math.round(totalProjected)), sub: "Active deals", color: "var(--c-green)" },
          { icon: Star, label: "Realized Profit", value: fmt(realizedProfit), sub: "Closed deals YTD", color: "var(--c-purple)" },
        ].map((m, i) => (
          <div key={i} style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{m.label}</p>
                <p style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
                {m.sub && <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{m.sub}</p>}
              </div>
              <div style={{ background: "#1e3a5f", borderRadius: 10, padding: 10 }}>
                <m.icon size={20} color="#e95e00" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {["all", ...STAGE_ORDER].map(s => {
            const active = activeStage === s;
            return (
              <button key={s} onClick={() => setActiveStage(s)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {s === "all" ? `All (${DEALS.length})` : `${s} (${DEALS.filter(f => f.stage === s).length})`}
              </button>
            );
          })}
        </div>
        {activeStage !== "all" && (
          <button onClick={() => setActiveStage("all")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filter
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
        {filtered.map(f => <DealCard key={f.id} deal={f} onSelect={onSelect} />)}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            {DEALS.length === 0
              ? <EmptyState icon={Layers} title="No deals yet" subtitle="Add your first deal to start tracking your pipeline." actionLabel="Add Deal" onAction={onGuidedSetup} />
              : <EmptyState icon={Search} title="No deals match this filter" subtitle="Try selecting a different stage or clear the filter." />
            }
          </div>
        )}
      </div>

    </div>
  );
}

function DealDetail({ deal, onBack, backLabel, allDeals, setAllFlips, onNavigateToExpense, onNavigateToContractor, onNavigateToRehabItem, initialTab, onConvertToRental, onDealUpdated, onNavigateToDeal }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab || "overview");
  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showContractorModal, setShowContractorModal] = useState(false);
  // Quick bid modal — opened from a contractor tile. Skips deal + contractor selection.
  const [quickBid, setQuickBid] = useState(null); // { contractorId, rehabItem, canonicalCategory, amount } | null
  const [quickBidRehabFocus, setQuickBidRehabFocus] = useState(false);
  // (legacy inline first-bid fields kept as no-ops for compat until refs are removed)
  // Optional first-bid fields tacked onto the Add Contractor modal
  const [expDetailItem, setExpDetailItem] = useState(null);
  const [expData, setExpData] = useState(DEAL_EXPENSES.filter(e => e.dealId === deal.id));
  const [conData, setConData] = useState(CONTRACTORS.filter(c => (c.dealIds || []).includes(deal.id)));
  const [rehabItems, setRehabItems] = useState(deal.rehabItems || []);
  const flipMsFromApi = DEAL_MILESTONES.filter(m => m.dealId === deal.id);
  const [milestones, setMilestones] = useState(
    flipMsFromApi.length > 0
      ? flipMsFromApi.map(m => ({ ...m }))
      : DEFAULT_MILESTONES.map(label => ({ label, done: false, date: null, targetDate: null }))
  );
  // Sync local milestone state back to global DEAL_MILESTONES array
  useEffect(() => {
    // Remove old entries for this deal
    const idx = DEAL_MILESTONES.findIndex(m => m.dealId === deal.id);
    while (idx >= 0 && DEAL_MILESTONES.findIndex(m => m.dealId === deal.id) >= 0) {
      DEAL_MILESTONES.splice(DEAL_MILESTONES.findIndex(m => m.dealId === deal.id), 1);
    }
    // Push current state back
    milestones.forEach((m, i) => {
      DEAL_MILESTONES.push({ id: m.id || newId(), dealId: deal.id, label: m.label, done: !!m.done, date: m.date || null, targetDate: m.targetDate || null, createdAt: m.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), userId: m.userId || MOCK_USER.id });
    });
  }, [milestones, deal.id]);

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showCompletedMilestones, setShowCompletedMilestones] = useState(false);
  const emptyMilestone = { label: "", targetDate: "", date: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
  const [milestoneForm, setMilestoneForm] = useState(emptyMilestone);
  const sfM = k => e => setMilestoneForm(f => ({ ...f, [k]: e.target.value }));
  const [editingMilestoneId, setEditingMilestoneId] = useState(null); // index when editing
  const [msLabelFocus, setMsLabelFocus] = useState(false);
  const allMilestoneLabels = useMemo(() => {
    const labels = new Set(DEFAULT_MILESTONES);
    DEAL_MILESTONES.forEach(m => { if (m.label) labels.add(m.label); });
    return [...labels].sort();
  }, [milestones]);
  const [completingMsIdx, setCompletingMsIdx] = useState(null);
  const [msCompletionDate, setMsCompletionDate] = useState(new Date().toISOString().split("T")[0]);
  const [showAddRehab, setShowAddRehab] = useState(false);
  const emptyRehab = { category: "", canonicalCategory: null, budgeted: "", spent: "0", status: "pending", photos: [] };
  const [rehabForm, setRehabForm] = useState(emptyRehab);
  const sfR = k => e => setRehabForm(f => ({ ...f, [k]: e.target.value }));
  const [catFocus, setCatFocus] = useState(false);
  // Union of canonical categories + any custom strings already in use across deals
  const allCategories = useMemo(() => {
    const custom = new Set(DEALS.flatMap(f => (f.rehabItems || []).map(i => i.category)).filter(Boolean));
    REHAB_CATEGORIES.forEach(c => custom.delete(c.label));
    return {
      canonical: REHAB_CATEGORIES,
      custom: [...custom].sort(),
    };
  }, []);
  // Rehab contractor assignment helpers — mutate deal.rehabItems in place so
  // the change is visible on the Contractors tab and Rehab Tracker too
  const [rehabVersion, setRehabVersion] = useState(0);
  const bumpRehab = () => setRehabVersion(v => v + 1);
  const dealContractorsList = useMemo(() => CONTRACTORS.filter(c => (c.dealIds || []).includes(deal.id)), [deal.id, conData]);
  const addContractorToRehabItem = (itemIdx, contractorId) => {
    const item = rehabItems[itemIdx];
    if (!item) return;
    const cons = item.contractors || [];
    if (cons.some(c => c.id === contractorId)) return;
    const next = [...rehabItems];
    next[itemIdx] = { ...item, contractors: [...cons, { id: contractorId, bid: 0 }] };
    setRehabItems(next);
    if (deal.rehabItems && deal.rehabItems[itemIdx]) deal.rehabItems[itemIdx].contractors = next[itemIdx].contractors;
    bumpRehab();
  };
  const removeContractorFromRehabItem = (itemIdx, contractorId) => {
    const item = rehabItems[itemIdx];
    if (!item) return;
    const next = [...rehabItems];
    next[itemIdx] = { ...item, contractors: (item.contractors || []).filter(c => c.id !== contractorId) };
    setRehabItems(next);
    if (deal.rehabItems && deal.rehabItems[itemIdx]) deal.rehabItems[itemIdx].contractors = next[itemIdx].contractors;
    bumpRehab();
  };
  // Option 2 — single "Assigned To" per rehab line item with typeahead + Add-new button
  const [assignTA, setAssignTA] = useState({ rowIdx: null, query: "" });
  const [pendingAssignRowIdx, setPendingAssignRowIdx] = useState(null);
  const assignContractorToRow = (itemIdx, contractorId) => {
    // Auto-attach to this deal if not already
    const gi = CONTRACTORS.findIndex(c => c.id === contractorId);
    if (gi !== -1) {
      const ids = CONTRACTORS[gi].dealIds || [];
      if (!ids.includes(deal.id)) {
        CONTRACTORS[gi] = { ...CONTRACTORS[gi], dealIds: [...ids, deal.id] };
        setConData(prev => prev.some(c => c.id === contractorId) ? prev : [...prev, CONTRACTORS[gi]]);
      }
    }
    const item = rehabItems[itemIdx];
    if (!item) return;
    const existing = item.contractors || [];
    if (existing.some(c => c.id === contractorId)) {
      setAssignTA({ rowIdx: null, query: "" });
      return;
    }
    const next = [...rehabItems];
    next[itemIdx] = { ...item, contractors: [...existing, { id: contractorId, bid: 0 }] };
    setRehabItems(next);
    if (deal.rehabItems && deal.rehabItems[itemIdx]) deal.rehabItems[itemIdx].contractors = next[itemIdx].contractors;
    bumpRehab();
    setAssignTA({ rowIdx: null, query: "" });
  };
  // Open the Add Contractor modal from a rehab row's typeahead.
  // Stores the originating row so handleSaveCon can auto-assign the new contractor when saved.
  // Pre-fills Trade with the rehab item's category so the user doesn't have to retype it.
  const openAddContractorForRow = (itemIdx, prefillName) => {
    setPendingAssignRowIdx(itemIdx);
    setAssignTA({ rowIdx: null, query: "" });
    const rowCategory = (rehabItems[itemIdx] && rehabItems[itemIdx].category) || "";
    setConForm({ name: (prefillName || "").trim(), trade: rowCategory, phone: "", email: "", license: "", insuranceExpiry: "", notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id });
    setEditingConId(null);
    setShowContractorModal(true);
  };
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: "expense"|"contractor"|"rehab"|"milestone", item, index? }
  const [showDeleteDeal, setShowDeleteDeal] = useState(false);
  const [stage, setStage] = useState(deal.stage);
  const [showCloseDeal, setShowCloseDeal] = useState(false);
  const [closeDealStep, setCloseDealStep] = useState("choose"); // "choose" | "sold" | "convert"
  const [closeForm, setCloseForm] = useState({ salePrice: "", closeDate: "", sellingCosts: "", buyerCredit: "", closingNotes: "" });
  const sfClose = k => e => setCloseForm(f => ({ ...f, [k]: e.target.value }));

  // Expense tab filters
  const [expSearch, setExpSearch] = useState("");
  const [expCatFilter, setExpCatFilter] = useState("all");
  const [expDateFilter, setExpDateFilter] = useState("all");
  const [expDateFrom, setExpDateFrom] = useState("");
  const [expDateTo, setExpDateTo] = useState("");

  // Deal notes — read/write directly to the global DEAL_NOTES store so notes
  // persist across navigation and show up in the unified Notes screen.
  const [notesVersion, setNotesVersion] = useState(0);
  const bumpNotes = () => setNotesVersion(v => v + 1);
  const dealNotes = DEAL_NOTES
    .filter(n => n.dealId === deal.id)
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const pushDealNote = (text) => {
    if (!text || !text.trim()) return;
    const now = new Date().toISOString();
    DEAL_NOTES.unshift({
      id: newId(),
      dealId: deal.id,
      date: now.split("T")[0],
      text: text.trim(),
      createdAt: now,
      updatedAt: now,
      userId: "usr_001",
      mentions: [],
    });
    bumpNotes();
  };
  const removeDealNote = (id) => {
    const gi = DEAL_NOTES.findIndex(n => n.id === id);
    if (gi !== -1) DEAL_NOTES.splice(gi, 1);
    bumpNotes();
  };
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const addNote = () => {
    if (!noteText.trim()) return;
    pushDealNote(noteText);
    setNoteText("");
    setShowNoteInput(false);
  };

  // Edit deal state
  const [showEditDeal, setShowEditDeal] = useState(false);
  const [dealEditForm, setDealEditForm] = useState({});
  const sfD = k => e => setDealEditForm(f => ({ ...f, [k]: e.target.value }));
  const openEditDeal = () => {
    setDealEditForm({
      name: deal.name || "", address: deal.address || "",
      purchasePrice: String(deal.purchasePrice || ""), arv: String(deal.arv || ""),
      rehabBudget: String(deal.rehabBudget || ""), holdingCostsPerMonth: String(deal.holdingCostsPerMonth || ""),
      acquisitionDate: deal.acquisitionDate || deal.contractDate || "",
      rehabStartDate: deal.rehabStartDate || "", rehabEndDate: deal.rehabEndDate || "",
      listDate: deal.listDate || "", projectedListDate: deal.projectedListDate || "",
      closeDate: deal.closeDate || "", projectedCloseDate: deal.projectedCloseDate || "",
      salePrice: String(deal.salePrice || ""),
    });
    setShowEditDeal(true);
  };
  const handleSaveDeal = () => {
    if (!dealEditForm.name) return;
    const updated = {
      ...deal, name: dealEditForm.name, address: dealEditForm.address,
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
    // Update the global DEALS array directly
    const idx = DEALS.findIndex(f => f.id === deal.id);
    if (idx !== -1) Object.assign(DEALS[idx], updated);
    if (setAllFlips) setAllFlips(prev => prev.map(f => f.id === deal.id ? { ...f, ...updated } : f));
    if (onDealUpdated) onDealUpdated();
    showToast("Deal updated");
    setShowEditDeal(false);
  };

  // Expense edit state
  const emptyExp = { date: "", vendor: "", category: "Materials & Supplies", description: "", amount: "", status: "paid", contractorId: "", rehabItemIdx: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
  const [expForm, setExpForm] = useState(emptyExp);
  const sfE = k => e => setExpForm(f => ({ ...f, [k]: e.target.value }));
  const [editingExpId, setEditingExpId] = useState(null);
  const [vendorFocus, setVendorFocus] = useState(false);
  const allVendors = [...new Set(expData.map(e => e.vendor).filter(Boolean))].sort();
  const openEditExp = (e) => {
    setEditingExpId(e.id);
    setExpForm({ date: e.date, vendor: e.vendor, category: e.category, description: e.description, amount: String(e.amount), status: e.status || "paid", contractorId: e.contractorId || "", rehabItemIdx: e.rehabItemIdx != null ? String(e.rehabItemIdx) : "", createdAt: e.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), userId: e.userId || MOCK_USER.id });
    setShowExpenseModal(true);
  };

  // Contractor edit state
  const emptyCon = { name: "", trade: "", phone: "", email: "", license: "", insuranceExpiry: "", notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
  const [conForm, setConForm] = useState(emptyCon);
  const [highlightConId, setHighlightConId] = useState(null);
  const sfC = k => e => setConForm(f => ({ ...f, [k]: e.target.value }));
  const [editingConId, setEditingConId] = useState(null);
  const openEditCon = (c) => {
    setEditingConId(c.id);
    setConForm({ name: c.name, trade: c.trade, phone: c.phone || "", email: c.email || "", license: c.license || "", insuranceExpiry: c.insuranceExpiry || "", notes: c.notes || "" });
    setShowContractorModal(true);
  };

  // Helper: derive bid/payment totals for this deal
  const conTotals = (c) => {
    const flipBids = CONTRACTOR_BIDS.filter(b => b.contractorId === c.id && b.dealId === deal.id);
    const flipPayments = CONTRACTOR_PAYMENTS.filter(p => p.contractorId === c.id && p.dealId === deal.id);
    const totalBid = flipBids.reduce((s, b) => s + (b.amount || 0), 0);
    const totalPaid = flipPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const acceptedBids = flipBids.filter(b => b.status === "accepted").length;
    const pendingBids = flipBids.filter(b => b.status === "pending").length;
    return { totalBid, totalPaid, owed: totalBid - totalPaid, acceptedBids, pendingBids, bidCount: flipBids.length };
  };

  // Contractor payment state
  const [showPaymentModal, setShowPaymentModal] = useState(null); // contractor id
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentNote, setPaymentNote] = useState("");
  const handleRecordPayment = () => {
    if (!paymentAmount || !showPaymentModal) return;
    const amt = parseFloat(paymentAmount) || 0;
    // Push payment into CONTRACTOR_PAYMENTS array
    const con = conData.find(c => c.id === showPaymentModal);
    if (con) {
      const newPayment = { id: newId(), contractorId: con.id, dealId: deal.id, amount: amt, date: paymentDate, note: paymentNote || `Payment to ${con.name}` };
      CONTRACTOR_PAYMENTS.push(newPayment);
      setConData(prev => [...prev]); // trigger re-render
      // Also log as an expense automatically (linked to contractor)
      setExpData(prev => [{ id: newId(), dealId: deal.id, date: paymentDate, vendor: con.name, category: con.trade === "General Contractor" ? "General Contractor" : "Subcontractor", description: paymentNote || `Payment to ${con.name}`, amount: amt, status: "paid", contractorId: showPaymentModal }, ...prev]);
      // Add to activity log
      pushDealNote(`Recorded ${fmt(amt)} payment to ${con.name}`);
    }
    setShowPaymentModal(null);
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
  };

  // Rehab edit state
  const [editingRehabIdx, setEditingRehabIdx] = useState(null);
  const openEditRehab = (item, idx) => {
    setEditingRehabIdx(idx);
    setRehabForm({ category: item.category, canonicalCategory: item.canonicalCategory || getCanonicalByLabel(item.category)?.slug || null, budgeted: String(item.budgeted), spent: String(item.spent), status: item.status, photos: item.photos || [] });
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
    if (!expForm.amount || !expForm.vendor || !expForm.description) return;
    const riIdx = expForm.rehabItemIdx !== "" ? parseInt(expForm.rehabItemIdx) : null;
    const amt = parseFloat(expForm.amount) || 0;
    const parsed = { date: expForm.date || new Date().toISOString().split("T")[0], vendor: expForm.vendor || "Unknown", category: expForm.category, description: expForm.description, amount: amt, status: expForm.status || "paid", contractorId: expForm.contractorId || null, rehabItemIdx: riIdx };
    if (editingExpId) {
      // If the rehab item link or amount changed, adjust spent totals accordingly
      const oldExp = expData.find(e => e.id === editingExpId);
      if (oldExp) {
        const oldIdx = oldExp.rehabItemIdx != null ? oldExp.rehabItemIdx : null;
        const oldAmt = oldExp.amount || 0;
        if (oldIdx != null && rehabItems[oldIdx]) {
          setRehabItems(prev => prev.map((it, i) => i === oldIdx ? { ...it, spent: Math.max(0, (it.spent || 0) - oldAmt) } : it));
          if (deal.rehabItems && deal.rehabItems[oldIdx]) deal.rehabItems[oldIdx] = { ...deal.rehabItems[oldIdx], spent: Math.max(0, (deal.rehabItems[oldIdx].spent || 0) - oldAmt) };
        }
      }
      setExpData(prev => prev.map(e => e.id === editingExpId ? { ...e, ...parsed } : e));
      setEditingExpId(null);
    } else {
      setExpData(prev => [{ id: newId(), dealId: deal.id, ...parsed }, ...prev]);
    }
    // Bump spent on the newly-linked rehab item
    if (riIdx != null && rehabItems[riIdx]) {
      setRehabItems(prev => prev.map((it, i) => i === riIdx ? { ...it, spent: (it.spent || 0) + amt } : it));
      if (deal.rehabItems && deal.rehabItems[riIdx]) deal.rehabItems[riIdx] = { ...deal.rehabItems[riIdx], spent: (deal.rehabItems[riIdx].spent || 0) + amt };
    }
    setExpForm(emptyExp);
    setShowExpenseModal(false);
  };

  // Push a bid into the shared CONTRACTOR_BIDS store. Returns the new bid.
  const pushContractorBid = (contractorId, rehabItem, canonicalCategory, amount) => {
    const amt = parseFloat(amount) || 0;
    if (!contractorId || !rehabItem || !amt) return null;
    const newBid = {
      id: newId(),
      contractorId,
      dealId: deal.id,
      rehabItem,
      canonicalCategory: canonicalCategory || null,
      amount: amt,
      status: "pending",
      date: new Date().toISOString().slice(0, 10),
    };
    CONTRACTOR_BIDS.push(newBid);
    // Also wire the contractor into the matching rehab item's contractors[] if we can match
    const matchingIdx = rehabItems.findIndex(ri =>
      (canonicalCategory && ri.canonicalCategory === canonicalCategory) ||
      ri.category === rehabItem
    );
    if (matchingIdx !== -1) {
      const existing = rehabItems[matchingIdx].contractors || [];
      if (!existing.some(c => c.id === contractorId)) {
        const updatedContractors = [...existing, { id: contractorId, bid: amt }];
        setRehabItems(prev => prev.map((it, i) => i === matchingIdx ? { ...it, contractors: updatedContractors } : it));
        if (deal.rehabItems && deal.rehabItems[matchingIdx]) {
          deal.rehabItems[matchingIdx] = { ...deal.rehabItems[matchingIdx], contractors: updatedContractors };
        }
      }
    }
    return newBid;
  };

  const handleSaveCon = () => {
    if (!conForm.name) return;
    if (editingConId) {
      setConData(prev => prev.map(c => c.id === editingConId ? { ...c, name: conForm.name, trade: conForm.trade, phone: conForm.phone, email: conForm.email, license: conForm.license || c.license, insuranceExpiry: conForm.insuranceExpiry || c.insuranceExpiry, notes: conForm.notes || c.notes } : c));
      // Also update the canonical CONTRACTORS store so other deals/screens see the edit
      const gi = CONTRACTORS.findIndex(c => c.id === editingConId);
      if (gi !== -1) CONTRACTORS[gi] = { ...CONTRACTORS[gi], name: conForm.name, trade: conForm.trade, phone: conForm.phone, email: conForm.email, license: conForm.license || CONTRACTORS[gi].license, insuranceExpiry: conForm.insuranceExpiry || CONTRACTORS[gi].insuranceExpiry, notes: conForm.notes || CONTRACTORS[gi].notes };
      setEditingConId(null);
    } else {
      const newCon = { id: newId(), name: conForm.name, trade: conForm.trade, phone: conForm.phone, email: conForm.email || "", license: conForm.license || null, insuranceExpiry: conForm.insuranceExpiry || null, rating: 0, notes: conForm.notes || "", dealIds: [deal.id], bids: [], payments: [], documents: [] };
      CONTRACTORS.push(newCon);
      setConData(prev => [...prev, newCon]);
      // Highlight the just-added contractor on the tile for a few seconds
      setHighlightConId(newCon.id);
      setTimeout(() => setHighlightConId(h => h === newCon.id ? null : h), 3500);
      // If this Add was triggered from a rehab row's typeahead, auto-assign to that row
      if (pendingAssignRowIdx != null) {
        const idx = pendingAssignRowIdx;
        const item = rehabItems[idx];
        if (item) {
          const existing = item.contractors || [];
          const next = [...rehabItems];
          next[idx] = { ...item, contractors: [...existing, { id: newCon.id, bid: 0 }] };
          setRehabItems(next);
          if (deal.rehabItems && deal.rehabItems[idx]) deal.rehabItems[idx].contractors = next[idx].contractors;
          bumpRehab();
        }
        setPendingAssignRowIdx(null);
      }
    }
    setConForm(emptyCon);
    setShowContractorModal(false);
  };

  // Attach an existing contractor from the global CONTRACTORS list to this deal
  const attachExistingContractor = (conId) => {
    const gi = CONTRACTORS.findIndex(c => c.id === conId);
    if (gi === -1) return;
    const existing = CONTRACTORS[gi];
    const ids = existing.dealIds || [];
    if (!ids.includes(deal.id)) {
      CONTRACTORS[gi] = { ...existing, dealIds: [...ids, deal.id] };
    }
    setConData(prev => prev.some(c => c.id === conId) ? prev : [...prev, CONTRACTORS[gi]]);
    // If this Add was opened from a rehab row's typeahead, also assign to that row
    if (pendingAssignRowIdx != null) {
      const idx = pendingAssignRowIdx;
      const item = rehabItems[idx];
      if (item) {
        const existingCons = item.contractors || [];
        if (!existingCons.some(c => c.id === conId)) {
          const next = [...rehabItems];
          next[idx] = { ...item, contractors: [...existingCons, { id: conId, bid: 0 }] };
          setRehabItems(next);
          if (deal.rehabItems && deal.rehabItems[idx]) deal.rehabItems[idx].contractors = next[idx].contractors;
          bumpRehab();
        }
      }
      setPendingAssignRowIdx(null);
    }
    setShowContractorModal(false);
    setConForm(emptyCon);
    // Highlight the newly attached contractor on the tile for a few seconds
    setHighlightConId(conId);
    setTimeout(() => setHighlightConId(h => h === conId ? null : h), 3500);
  };

  const handleStageChange = (e) => {
    const newStage = e.target.value;
    if (newStage === "Sold") {
      // Intercept — open Close Deal modal at the "sold" step
      const estSellingCosts = Math.round((deal.arv || 0) * ((deal.sellingCostPct || 6) / 100));
      setCloseForm({ salePrice: String(deal.arv || ""), closeDate: today, sellingCosts: String(estSellingCosts || ""), buyerCredit: "", closingNotes: "" });
      setCloseDealStep("sold");
      setShowCloseDeal(true);
      return;
    }
    setStage(newStage);
    const idx = DEALS.findIndex(f => f.id === deal.id);
    if (idx !== -1) DEALS[idx].stage = newStage;
    if (setAllFlips) setAllFlips(prev => prev.map(f => f.id === deal.id ? { ...f, stage: newStage } : f));
  };

  const cycleRehabStatus = (idx) => {
    const order = ["pending", "in-progress", "complete"];
    const updated = rehabItems.map((item, i) => i !== idx ? item : { ...item, status: order[(order.indexOf(item.status) + 1) % order.length] });
    setRehabItems(updated);
  };

  const currentFlip = { ...deal, stage };
  const holdingCosts = currentFlip.daysOwned > 0 ? Math.round(currentFlip.holdingCostsPerMonth * (currentFlip.daysOwned / 30)) : 0;
  const totalHolding = currentFlip.stage === "Sold" ? currentFlip.totalHoldingCosts : holdingCosts;
  const sellingCosts = currentFlip.stage === "Sold" ? currentFlip.sellingCosts : Math.round((currentFlip.arv || 0) * ((currentFlip.sellingCostPct || 6) / 100));
  const totalCost = currentFlip.purchasePrice + (currentFlip.stage === "Sold" ? currentFlip.rehabSpent : currentFlip.rehabBudget) + totalHolding + sellingCosts;
  const saleOrARV = currentFlip.stage === "Sold" ? currentFlip.salePrice : currentFlip.arv;
  const profit = saleOrARV - totalCost;
  const roi = totalCost > 0 ? ((profit / (currentFlip.purchasePrice + currentFlip.rehabBudget)) * 100).toFixed(1) : 0;
  const mao70 = (currentFlip.arv * 0.70) - currentFlip.rehabBudget;
  const rehabTotalBudget = rehabItems.reduce((s, i) => s + i.budgeted, 0);
  const rehabTotalSpent = rehabItems.reduce((s, i) => s + i.spent, 0);
  const statusIcons = { "complete": "v", "in-progress": "~", "pending": "o" };
  const statusColors = { "complete": "#15803d", "in-progress": "#9a3412", "pending": "#94a3b8" };
  const statusBg = { "complete": "var(--success-badge)", "in-progress": "var(--warning-bg)", "pending": "var(--surface-muted)" };

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
  const dealDocs = DEAL_DOCUMENTS.filter(d => d.dealId === deal.id);
  const [, dealDocRerender] = useState(0);
  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "milestones", label: `Milestones (${doneCount}/${milestones.length})`, icon: CheckSquare },
    { id: "rehab", label: `Rehab (${rehabComplete}/${rehabItems.length})`, icon: Wrench },
    { id: "contractors", label: `Contractors (${flipContractors.length})`, icon: UserCheck },
    { id: "expenses", label: `Expenses (${flipExpenses.length})`, icon: Receipt },
    { id: "documents", label: `Documents (${dealDocs.length})`, icon: FileText },
    { id: "notes", label: `Notes (${dealNotes.length})`, icon: MessageSquare },
  ];

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "#e95e00", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 20 }}>
        {backLabel || "Back to Deals"}
      </button>
      <div style={{ background: "var(--hero-bg)", borderRadius: 20, padding: 28, marginBottom: 20, border: "1px solid var(--hero-border)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 800 }}>{deal.image}</div>
            <div>
              <h1 style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{deal.name}</h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> {deal.address}</p>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                <StageBadge stage={stage} />
                {stage === "Sold" || stage === "Converted to Rental" ? (
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>Deal closed</span>
                ) : (
                  <select value={stage} onChange={handleStageChange} style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "4px 8px", fontSize: 12, background: "var(--hero-select-bg)", color: "var(--text-label)", cursor: "pointer", outline: "none" }}>
                    {STAGE_ORDER.filter(s => s !== "Converted to Rental").map(s => <option key={s}>{s}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, justifyContent: "flex-end" }}>
              <button onClick={() => {
                const initials = deal.name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
                const colors = ["#e95e00", "var(--c-blue)", "var(--c-green)", "var(--c-purple)", "var(--c-red)", "#ec4899"];
                const cloned = {
                  id: newId(), name: deal.name + " (Copy)", address: "", stage: "Under Contract",
                  image: initials, color: colors[DEALS.length % colors.length],
                  purchasePrice: 0, arv: deal.arv, rehabBudget: deal.rehabBudget, rehabSpent: 0,
                  holdingCostsPerMonth: deal.holdingCostsPerMonth, daysOwned: 0,
                  rehabItems: rehabItems.map(r => ({ category: r.category, budgeted: r.budgeted, spent: 0, status: "pending", contractors: [], photos: [] })),
                };
                DEALS.push(cloned);
                _LOCAL_FLIP_MILESTONES[cloned.id] = milestones.map(m => ({ label: m.label, done: false, date: null, targetDate: null }));
                if (setAllFlips) setAllFlips([...DEALS]);
                if (onDealUpdated) onDealUpdated();
                showToast(`"${cloned.name}" created`);
                if (onNavigateToDeal) onNavigateToDeal(cloned);
              }} style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-label)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Copy size={12} /> Clone Deal
              </button>
              <button onClick={openEditDeal} style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-label)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Pencil size={12} /> Edit Deal
              </button>
              <button onClick={() => setShowDeleteDeal(true)} style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "var(--c-red)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Trash2 size={12} /> Delete
              </button>
              {stage !== "Converted to Rental" && stage !== "Sold" && (() => {
                const workflowStages = ["Under Contract", "Active Rehab", "Listed"];
                const currentIdx = workflowStages.indexOf(stage);
                const nextStage = currentIdx >= 0 && currentIdx < workflowStages.length - 1 ? workflowStages[currentIdx + 1] : null;
                return (<>
                  {nextStage && (
                    <button onClick={() => {
                      setStage(nextStage);
                      const idx = DEALS.findIndex(f => f.id === deal.id);
                      if (idx !== -1) DEALS[idx].stage = nextStage;
                      if (setAllFlips) setAllFlips(prev => prev.map(f => f.id === deal.id ? { ...f, stage: nextStage } : f));
                      if (onDealUpdated) onDealUpdated();
                      pushDealNote(`Stage advanced to "${nextStage}".`);
                      showToast(`Stage advanced to "${nextStage}"`);
                    }} style={{ background: "var(--success-tint)", border: "1px solid #bbf7d0", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#15803d", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      <ArrowRight size={12} /> {nextStage}
                    </button>
                  )}
                  <button onClick={() => {
                    const rehabSpent = (rehabItems || []).reduce((s, i) => s + (i.spent || 0), 0);
                    const estSellingCosts = Math.round((deal.arv || 0) * ((deal.sellingCostPct || 6) / 100));
                    setCloseForm({ salePrice: String(deal.arv || ""), closeDate: today, sellingCosts: String(estSellingCosts || ""), buyerCredit: "", closingNotes: "" });
                    setCloseDealStep("choose");
                    setShowCloseDeal(true);
                  }} style={{ background: "#e95e00", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <CheckCircle size={12} /> Close Deal
                  </button>
                </>);
              })()}
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{stage === "Sold" ? "Sale Price" : "ARV"}</p>
            <p style={{ color: "var(--text-primary)", fontSize: 32, fontWeight: 800 }}>{fmt(saleOrARV)}</p>
            <p style={{ color: profit >= 0 ? "var(--c-green)" : "var(--c-red)", fontSize: 15, fontWeight: 700 }}>
              {profit >= 0 ? "+" : ""}{fmt(profit)} {stage === "Sold" ? "net profit" : "projected profit"}
            </p>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, background: "var(--surface-alt)", borderRadius: 14, padding: 5, marginBottom: 24, border: "1px solid var(--border)" }}>
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", boxShadow: active ? "0 2px 8px rgba(245,158,11,0.3)" : "none", whiteSpace: "nowrap", transition: "all 0.15s ease" }}>
              <t.icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>
      {activeTab === "overview" && (<>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Deal Profit &amp; Loss</h3>
          {[
            { label: stage === "Sold" ? "Sale Price" : "ARV (Target)", value: fmt(saleOrARV), color: "#15803d", sign: "+" },
            { label: "Purchase Price", value: fmt(deal.purchasePrice), color: "#b91c1c", sign: "-" },
            { label: "Rehab Cost", value: fmt(stage === "Sold" ? deal.rehabSpent : deal.rehabBudget), color: "#b91c1c", sign: "-" },
            { label: "Holding Costs", value: fmt(totalHolding), color: "#b91c1c", sign: "-" },
            { label: `Selling Costs (~${currentFlip.sellingCostPct || 6}%)`, value: fmt(sellingCosts), color: "#b91c1c", sign: "-" },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: r.color, fontWeight: 700, fontSize: 16, lineHeight: 1 }}>{r.sign}</span>
                <span style={{ fontSize: 14, color: "var(--text-label)" }}>{r.label}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: r.color }}>{r.value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 0", marginTop: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>Net Profit</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: profit >= 0 ? "var(--c-green)" : "var(--c-red)" }}>{profit >= 0 ? "+" : ""}{fmt(profit)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center" }}>ROI on cash invested<InfoTip text="Net Profit ÷ Total Cash Invested × 100. Measures return as a percentage of the actual cash you put into the deal." /></span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-blue)" }}>{roi}%</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Target size={16} color="var(--c-blue)" />
              <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>70% Rule Check</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "ARV", value: fmt(deal.arv), tip: "After Repair Value — estimated market value once rehab is complete." },
                { label: "Rehab Budget", value: fmt(deal.rehabBudget), tip: "Total planned renovation budget across all line items." },
                { label: "MAO (70% Rule)", value: fmt(mao70), color: "var(--c-blue)", tip: "Maximum Allowable Offer = (ARV × 70%) − Rehab Budget. The 70% rule is a rule of thumb for flip offers to leave room for profit and costs." },
                { label: "Actual Purchase", value: fmt(deal.purchasePrice), color: deal.purchasePrice <= mao70 ? "#15803d" : "#b91c1c", tip: "What you actually paid for the property. Green if at or under MAO, red if over." },
              ].map((m, i) => (
                <div key={i} style={{ background: "var(--surface-alt)", borderRadius: 8, padding: "10px 12px" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 2, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                  <p style={{ color: m.color || "var(--text-primary)", fontSize: 14, fontWeight: 700 }}>{m.value}</p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: deal.purchasePrice <= mao70 ? "#15803d" : "#b91c1c", background: deal.purchasePrice <= mao70 ? "var(--success-badge)" : "var(--danger-badge)", borderRadius: 8, padding: "5px 8px" }}>
              {deal.purchasePrice <= mao70 ? `v Deal is ${fmt(mao70 - deal.purchasePrice)} under MAO - good spread` : `(!) Purchase is ${fmt(deal.purchasePrice - mao70)} over MAO - verify assumptions`}
            </p>
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Calendar size={16} color="var(--c-purple)" />
              <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>Timeline</h3>
            </div>
            {[
              { label: "Contract / Acquisition", date: deal.acquisitionDate || deal.contractDate },
              { label: "Rehab Start", date: deal.rehabStartDate },
              { label: "Rehab Complete", date: deal.rehabEndDate },
              { label: "Listed", date: deal.listDate || deal.projectedListDate },
              { label: "Close", date: deal.closeDate || deal.projectedCloseDate },
            ].filter(t => t.date).map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.date ? "var(--c-blue)" : "var(--border)", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--text-label)" }}>{t.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.date}</span>
                </div>
              </div>
            ))}
            {deal.daysOwned > 0 && (
              <div style={{ marginTop: 8, background: "var(--info-tint)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--c-blue)", fontWeight: 600 }}>
                <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                Day {deal.daysOwned} . Est. {Math.round(deal.holdingCostsPerMonth / 30)}/day in holding costs
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Compact Rehab Summary */}
      <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Wrench size={16} color="#e95e00" />
            <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>Rehab Progress</h3>
          </div>
          <button onClick={() => setActiveTab("rehab")} style={{ background: "none", border: "none", color: "var(--c-blue)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            View Details <ChevronRight size={14} />
          </button>
        </div>
        <RehabProgress items={rehabItems} />
        <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
          <div style={{ flex: 1, background: "var(--surface-alt)", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>Budget<InfoTip text="Sum of budgeted amounts across all rehab line items for this deal." /></p>
            <p style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>{fmt(rehabTotalBudget)}</p>
          </div>
          <div style={{ flex: 1, background: "var(--surface-alt)", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>Spent<InfoTip text="Sum of amounts spent to date across all rehab line items. Red if over budget." /></p>
            <p style={{ color: rehabTotalSpent > rehabTotalBudget ? "#b91c1c" : "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>{fmt(rehabTotalSpent)}</p>
          </div>
          <div style={{ flex: 1, background: "var(--surface-alt)", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>Remaining<InfoTip text="Budget − Spent. Shown as 0 if over budget (see Spent for overage)." /></p>
            <p style={{ color: "var(--c-blue)", fontSize: 16, fontWeight: 700 }}>{fmt(Math.max(0, rehabTotalBudget - rehabTotalSpent))}</p>
          </div>
          <div style={{ flex: 1, background: "var(--surface-alt)", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>Items<InfoTip text="Rehab line items marked complete out of the total count for this deal." /></p>
            <p style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>{rehabComplete}/{rehabItems.length} done</p>
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
        if (deal.daysOwned > 120 && stage !== "Sold") alerts.push({ severity: "info", text: `Day ${deal.daysOwned} of ownership — holding costs est. ${fmt(holdingCosts)} and growing`, icon: Clock });
        const pendingExpCount = expData.filter(e => e.status === "pending").length;
        if (pendingExpCount > 0) alerts.push({ severity: "info", text: `${pendingExpCount} expense${pendingExpCount > 1 ? "s" : ""} still pending payment`, icon: CreditCard });
        if (alerts.length === 0) return null;
        const colors = { critical: { bg: "var(--danger-tint)", border: "var(--danger-border)", text: "#991b1b", icon: "var(--c-red)" }, warning: { bg: "var(--warning-bg)", border: "var(--warning-border)", text: "#9a3412", icon: "#e95e00" }, info: { bg: "var(--info-tint)", border: "var(--info-border)", text: "#1e40af", icon: "var(--c-blue)" } };
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
        {/* Stat cards — matches RehabTracker pattern */}
        {(() => {
          const rehabBudgetLeft = rehabTotalBudget - rehabTotalSpent;
          const rehabInProgress = rehabItems.filter(i => i.status === "in-progress").length;
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              <StatCard icon={Target}      label="Total Budget"  value={fmt(rehabTotalBudget)} sub="This deal"                                     color="var(--c-blue)" tip="Sum of budgeted amounts across all rehab line items for this deal." />
              <StatCard icon={Receipt}     label="Total Spent"   value={fmt(rehabTotalSpent)}  sub="To date"                                       color="#e95e00" tip="Sum of amounts spent to date across all rehab line items for this deal." />
              <StatCard icon={DollarSign}  label="Budget Left"   value={fmt(rehabBudgetLeft)}  sub={rehabBudgetLeft < 0 ? "OVER BUDGET" : "Remaining"} color={rehabBudgetLeft < 0 ? "var(--c-red)" : "var(--c-green)"} semantic tip="Total Budget − Total Spent. Negative means over budget." />
              <StatCard icon={CheckCircle} label="Tasks Done"    value={`${rehabComplete}/${rehabItems.length}`} sub={`${rehabInProgress} in progress`} color="var(--c-purple)" tip="Completed rehab line items out of the total for this deal." />
            </div>
          );
        })()}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              {rehabItems.length} item{rehabItems.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={() => { setEditingRehabIdx(null); setRehabForm(emptyRehab); setShowAddRehab(true); }} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={15} /> Add Rehab Item
          </button>
        </div>
        {rehabItems.length === 0 ? (
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Wrench size={24} color="#e95e00" />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Start your rehab scope</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 460, margin: "0 auto" }}>Pick a template to pre-populate standard scopes with suggested budgets, or build your own from scratch.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginBottom: 14 }}>
              {REHAB_TEMPLATES.map(tpl => {
                const total = tpl.items.reduce((s, i) => s + (i.budgeted || 0), 0);
                return (
                  <button key={tpl.id} onClick={() => {
                    const seeded = tpl.items.map(i => {
                      const canon = getCanonicalBySlug(i.slug);
                      return { category: canon?.label || i.slug, canonicalCategory: i.slug, budgeted: i.budgeted || 0, spent: 0, status: "pending", contractors: [], photos: [] };
                    });
                    setRehabItems(seeded);
                    if (!deal.rehabItems) deal.rehabItems = [];
                    deal.rehabItems.splice(0, deal.rehabItems.length, ...seeded);
                    showToast(`${tpl.name} template loaded — ${seeded.length} items`);
                  }} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 18, textAlign: "left", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#e95e00"; e.currentTarget.style.background = "var(--warning-bg)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{tpl.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10, minHeight: 30 }}>{tpl.description}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{tpl.items.length} items</span>
                      <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>{fmt(total)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ textAlign: "center" }}>
              <button onClick={() => { setEditingRehabIdx(null); setRehabForm(emptyRehab); setShowAddRehab(true); }} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>or start from scratch</button>
            </div>
          </div>
        ) : (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
          <RehabProgress items={rehabItems} />
          <div style={{ marginTop: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)" }}>
                  {["Category", "Contractor", "Budgeted", "Spent", "Remaining", "Status", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rehabItems.map((item, i) => {
                  const remaining = item.budgeted - item.spent;
                  const over = remaining < 0;
                  const assigned = item.contractors || [];
                  const assignedIds = assigned.map(c => c.id);
                  const unassigned = dealContractorsList.filter(c => !assignedIds.includes(c.id));
                  const stop = e => e.stopPropagation();
                  return (
                    <tr key={i} onClick={() => onNavigateToRehabItem && onNavigateToRehabItem(i)}
                      onMouseEnter={e => { if (onNavigateToRehabItem) e.currentTarget.style.background = "var(--surface-alt)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                      style={{ borderTop: "1px solid var(--border-subtle)", cursor: onNavigateToRehabItem ? "pointer" : "default", transition: "background 0.15s" }}>
                      <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {item.category}
                          {(item.photos || []).length > 0 && <span style={{ color: "var(--c-blue)", fontSize: 11 }} title={`${item.photos.length} photo(s)`}><Image size={12} style={{ display: "inline" }} /> {item.photos.length}</span>}
                          {onNavigateToRehabItem && <ChevronRight size={14} color="#cbd5e1" />}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", minWidth: 220 }} onClick={stop}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                          {assigned.map(asgn => {
                            const con = CONTRACTORS.find(c => c.id === asgn.id);
                            if (!con) return null;
                            return (
                              <div key={asgn.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--surface-muted)", borderRadius: 20, padding: "4px 8px 4px 6px" }}>
                                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg, #e95e00, #041830)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <Truck size={9} color="#fff" />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>{con.name}</span>
                                {asgn.bid > 0 && <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>{fmt(asgn.bid)}</span>}
                                <button onClick={(e) => { e.stopPropagation(); removeContractorFromRehabItem(i, asgn.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex", alignItems: "center" }}>
                                  <X size={10} />
                                </button>
                              </div>
                            );
                          })}
                        {assignTA.rowIdx === i ? (
                          <div style={{ position: "relative" }}>
                            <input
                              autoFocus
                              value={assignTA.query}
                              onChange={e => setAssignTA({ rowIdx: i, query: e.target.value })}
                              onBlur={() => setTimeout(() => setAssignTA(s => s.rowIdx === i ? { rowIdx: null, query: "" } : s), 180)}
                              onKeyDown={e => { if (e.key === "Escape") setAssignTA({ rowIdx: null, query: "" }); }}
                              placeholder="Type contractor name..."
                              style={{ border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "var(--text-dim)", background: "var(--surface)", outline: "none", width: 200 }} />
                            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", zIndex: 100, minWidth: 240, maxHeight: 240, overflowY: "auto" }}>
                              {(() => {
                                const q = assignTA.query.trim().toLowerCase();
                                const matches = CONTRACTORS.filter(c => !assignedIds.includes(c.id) && (!q || c.name.toLowerCase().includes(q))).slice(0, 8);
                                return (
                                  <>
                                    {matches.length === 0 && (
                                      <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)" }}>{q ? "No matches" : "No contractors yet"}</div>
                                    )}
                                    {matches.map(c => {
                                      const onDeal = (c.dealIds || []).includes(deal.id);
                                      return (
                                        <div key={c.id}
                                          onMouseDown={e => { e.preventDefault(); assignContractorToRow(i, c.id); }}
                                          style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                                          onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
                                          onMouseLeave={e => e.currentTarget.style.background = "var(--surface)"}>
                                          <span style={{ color: "var(--text-dim)", fontWeight: 600 }}>{c.name}</span>
                                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.trade || ""}{!onDeal ? " · not on deal" : ""}</span>
                                        </div>
                                      );
                                    })}
                                    <div onMouseDown={e => { e.preventDefault(); openAddContractorForRow(i, assignTA.query); }}
                                      style={{ padding: "10px 12px", fontSize: 12, cursor: "pointer", color: "#e95e00", fontWeight: 700, background: "var(--warning-bg)", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 6 }}
                                      onMouseEnter={e => e.currentTarget.style.background = "var(--warning-btn-bg)"}
                                      onMouseLeave={e => e.currentTarget.style.background = "var(--warning-bg)"}>
                                      <Plus size={12} /> Add new contractor{assignTA.query.trim() ? ` "${assignTA.query.trim()}"` : ""}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setAssignTA({ rowIdx: i, query: "" })}
                            style={{ border: "1.5px dashed #cbd5e1", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "var(--text-muted)", background: "var(--surface-alt)", cursor: "pointer" }}>
                            {assigned.length > 0 ? "+ Add" : "+ Assign contractor"}
                          </button>
                        )}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-label)" }}>{fmt(item.budgeted)}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fmt(item.spent)}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: over ? "#b91c1c" : "#15803d" }}>
                        {over ? `-${fmt(Math.abs(remaining))}` : fmt(remaining)}
                      </td>
                      <td style={{ padding: "12px 16px" }} onClick={stop}>
                        <button onClick={() => cycleRehabStatus(i)} title="Click to cycle status" style={{ background: statusBg[item.status], color: statusColors[item.status], borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
                          {statusIcons[item.status]} {item.status}
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px" }} onClick={stop}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => openEditRehab(item, i)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteConfirm({ type: "rehab", item: item, index: i })} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {showAddRehab && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "var(--surface)", borderRadius: 20, width: 480, padding: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700 }}>{editingRehabIdx !== null ? "Edit Rehab Item" : "Add Rehab Item"}</h2>
                <button onClick={() => { setShowAddRehab(false); setRehabForm(emptyRehab); setEditingRehabIdx(null); }} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color="var(--text-secondary)" /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ position: "relative" }}>
                  <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Category *</label>
                  <input value={rehabForm.category} placeholder="Start typing or pick from the list..." style={iS}
                    onChange={e => { setRehabForm(f => ({ ...f, category: e.target.value, canonicalCategory: null })); setCatFocus(true); }}
                    onFocus={() => setCatFocus(true)} onBlur={() => setTimeout(() => setCatFocus(false), 150)} />
                  {!catFocus && !rehabForm.category && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>Pick a standard category or type your own</p>}
                  {rehabForm.canonicalCategory && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, fontWeight: 600, color: "#15803d" }}><CheckCircle size={11} /> Standard category</span>
                  )}
                  {catFocus && (() => {
                    const q = rehabForm.category.toLowerCase().trim();
                    const canonMatches = REHAB_CATEGORIES.filter(c => !q || c.label.toLowerCase().includes(q));
                    const customMatches = allCategories.custom.filter(c => !q || c.toLowerCase().includes(q));
                    const exactCanon = REHAB_CATEGORIES.some(c => c.label.toLowerCase() === q);
                    const exactCustom = allCategories.custom.some(c => c.toLowerCase() === q);
                    const showNew = q && !exactCanon && !exactCustom;
                    const grouped = {};
                    canonMatches.forEach(c => { if (!grouped[c.group]) grouped[c.group] = []; grouped[c.group].push(c); });
                    const groupKeys = REHAB_CATEGORY_GROUPS.filter(g => grouped[g] && grouped[g].length > 0);
                    if (groupKeys.length === 0 && customMatches.length === 0 && !showNew) return null;
                    return (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
                        {groupKeys.map(g => (
                          <div key={g}>
                            <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" }}>{g}</div>
                            {grouped[g].map(c => (
                              <button key={c.slug} onMouseDown={() => { setRehabForm(f => ({ ...f, category: c.label, canonicalCategory: c.slug })); setCatFocus(false); }}
                                style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid #f8fafc", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                                <Wrench size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                <span>{c.label}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                        {customMatches.length > 0 && (
                          <div>
                            <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" }}>Your Custom</div>
                            {customMatches.slice(0, 6).map(c => (
                              <button key={c} onMouseDown={() => { setRehabForm(f => ({ ...f, category: c, canonicalCategory: null })); setCatFocus(false); }}
                                style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid #f8fafc", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                                <Wrench size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                <span>{c}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {showNew && (
                          <button onMouseDown={() => setCatFocus(false)}
                            style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "var(--warning-bg)", border: "none", borderTop: "1px solid var(--border)", cursor: "pointer", textAlign: "left" }}>
                            <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{rehabForm.category}&rdquo; as custom</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Budget *</label>
                    <input value={rehabForm.budgeted} onChange={sfR("budgeted")} type="number" placeholder="18000" style={iS} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Spent So Far</label>
                    <input value={rehabForm.spent} onChange={sfR("spent")} type="number" placeholder="0" style={iS} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Status</label>
                  <select value={rehabForm.status} onChange={sfR("status")} style={iS}>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="complete">Complete</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Photos</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {(rehabForm.photos || []).map((p, pi) => (
                      <div key={pi} style={{ position: "relative", width: 60, height: 60, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
                        <img src={p} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button onClick={() => setRehabForm(f => ({ ...f, photos: f.photos.filter((_, ii) => ii !== pi) }))} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={10} /></button>
                      </div>
                    ))}
                    <label style={{ width: 60, height: 60, borderRadius: 8, border: "2px dashed var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)", fontSize: 10, gap: 2 }}>
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
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Before/after photos for this scope of work</p>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
                <button onClick={() => { setShowAddRehab(false); setRehabForm(emptyRehab); setEditingRehabIdx(null); }} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
                <button onClick={() => {
                  if (!rehabForm.category || !rehabForm.budgeted) return;
                  const photos = rehabForm.photos || [];
                  // Infer canonical slug if user typed a label that matches one exactly
                  const canon = rehabForm.canonicalCategory || getCanonicalByLabel(rehabForm.category)?.slug || null;
                  if (editingRehabIdx !== null) {
                    setRehabItems(prev => prev.map((item, idx) => idx === editingRehabIdx ? { ...item, category: rehabForm.category, canonicalCategory: canon, budgeted: parseFloat(rehabForm.budgeted) || 0, spent: parseFloat(rehabForm.spent) || 0, status: rehabForm.status, photos } : item));
                    if (deal.rehabItems && deal.rehabItems[editingRehabIdx]) {
                      deal.rehabItems[editingRehabIdx] = { ...deal.rehabItems[editingRehabIdx], category: rehabForm.category, canonicalCategory: canon, budgeted: parseFloat(rehabForm.budgeted) || 0, spent: parseFloat(rehabForm.spent) || 0, status: rehabForm.status, photos };
                    }
                    setEditingRehabIdx(null);
                  } else {
                    const newItem = { category: rehabForm.category, canonicalCategory: canon, budgeted: parseFloat(rehabForm.budgeted) || 0, spent: parseFloat(rehabForm.spent) || 0, status: rehabForm.status, contractors: [], photos };
                    setRehabItems(prev => [...prev, newItem]);
                    if (deal.rehabItems) deal.rehabItems.push(newItem); else deal.rehabItems = [newItem];
                  }
                  setRehabForm(emptyRehab);
                  setShowAddRehab(false);
                }} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: (!rehabForm.category || !rehabForm.budgeted) ? 0.5 : 1 }}>{editingRehabIdx !== null ? "Save Changes" : "Add Item"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {activeTab === "expenses" && (
        <div>
          {/* Category group stat cards — matches PropertyDetail Transactions pattern (stat cards first) */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
            {Object.keys(FLIP_EXPENSE_GROUPS).map(group => {
              const subs = FLIP_EXPENSE_GROUPS[group];
              const total = flipExpenses.filter(e => subs.includes(e.category)).reduce((s, e) => s + e.amount, 0);
              return (
                <div key={group} style={{ background: "var(--surface)", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", minWidth: 130, flex: "1 0 auto" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 4, whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>{group}<InfoTip text={`Sum of ${group} expenses for this deal. Includes categories: ${subs.join(", ")}.`} /></p>
                  <p style={{ color: total > 0 ? "var(--text-primary)" : "var(--border-strong)", fontSize: 16, fontWeight: 700 }}>{total > 0 ? fmt(total) : "-"}</p>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                {hasExpFilters ? `${flipExpenses.length} of ${expData.length}` : `${flipExpenses.length}`} transactions . <strong style={{ color: "#b91c1c" }}>{fmt(hasExpFilters ? filteredTotal : totalExpensed)}</strong> {hasExpFilters ? "filtered" : "total spent"}
              </p>
            </div>
            <button onClick={() => { setEditingExpId(null); setExpForm(emptyExp); setShowExpenseModal(true); }} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={15} /> Add Expense
            </button>
          </div>
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: hasExpFilters ? 10 : 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 160px", minWidth: 150 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input value={expSearch} onChange={e => setExpSearch(e.target.value)} placeholder="Search..."
                style={{ width: "100%", paddingLeft: 32, paddingRight: 10, paddingTop: 8, paddingBottom: 8, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" }} />
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
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>to</span>
                <input type="date" value={expDateTo} onChange={e => setExpDateTo(e.target.value)} style={{ ...iS, width: "auto", fontSize: 13, padding: "8px 10px" }} />
              </>
            )}
          </div>
          {/* Active filter chips */}
          {hasExpFilters && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Filtered:</span>
              {expCatFilter !== "all" && <span style={{ background: "var(--warning-bg)", color: "#7c2d12", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{expCatFilter}</span>}
              {expDateFilter !== "all" && <span style={{ background: "var(--success-tint)", color: "#15803d", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{{ thisMonth: "This Month", lastMonth: "Last Month", thisYear: "This Year", lastYear: "Last Year", custom: expDateFrom && expDateTo ? `${expDateFrom} – ${expDateTo}` : "Custom Range" }[expDateFilter]}</span>}
              {expSearch && <span style={{ background: "var(--surface-muted)", color: "var(--text-label)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>&ldquo;{expSearch}&rdquo;</span>}
              <button onClick={clearExpFilters} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear all</button>
            </div>
          )}
          <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
            {flipExpenses.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
                <Receipt size={32} style={{ margin: "0 auto 12px", display: "block" }} />
                {hasExpFilters ? (
                  <>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>No expenses match your filters</p>
                    <button onClick={clearExpFilters} style={{ background: "none", border: "none", color: "#e95e00", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
                  </>
                ) : (
                  <>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>No expenses logged yet</p>
                    <p style={{ fontSize: 13 }}>Click &ldquo;Add Expense&rdquo; to start tracking spend for this deal.</p>
                  </>
                )}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-alt)" }}>
                    {["Date", "Paid To", "Category", "Description", "Amount", "Status", ""].map(h => (
                      <th key={h} style={{ padding: "12px 18px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flipExpenses.map((e, i) => (
                    <tr key={e.id} onClick={() => setExpDetailItem(e)} style={{ borderTop: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)", cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={ev => { ev.currentTarget.style.background = "var(--info-tint-alt)"; }}
                      onMouseLeave={ev => { ev.currentTarget.style.background = i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)"; }}>
                      <td style={{ padding: "13px 18px", fontSize: 13, color: "var(--text-secondary)" }}>{e.date}</td>
                      <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {e.vendor}
                        {e.contractorId && <UserCheck size={11} color="var(--c-blue)" style={{ marginLeft: 5, display: "inline" }} title={`Linked contractor`} />}
                      </td>
                      <td style={{ padding: "13px 18px" }}>
                        {(() => { const group = getFlipExpGroup(e.category); return group && group !== e.category ? <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 2 }}>{group}</p> : null; })()}
                        <span style={{ background: "var(--surface-muted)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, color: "var(--text-label)" }}>{e.category}</span>
                      </td>
                      <td style={{ padding: "13px 18px", fontSize: 13, color: "var(--text-label)" }}>{e.description}</td>
                      <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 700, color: "#b91c1c" }}>{fmt(e.amount)}</td>
                      <td style={{ padding: "13px 18px" }}>
                        <button onClick={ev => { ev.stopPropagation(); setExpData(prev => prev.map(x => x.id === e.id ? { ...x, status: x.status === "paid" ? "pending" : "paid" } : x)); }} style={{ background: (e.status || "paid") === "paid" ? "var(--success-badge)" : "var(--warning-bg)", color: (e.status || "paid") === "paid" ? "#15803d" : "#9a3412", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", textTransform: "capitalize" }}>
                          {(e.status || "paid") === "paid" ? "Paid" : "Pending"}
                        </button>
                      </td>
                      <td style={{ padding: "13px 18px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={ev => { ev.stopPropagation(); openEditExp(e); }} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                          <button onClick={ev => { ev.stopPropagation(); setDeleteConfirm({ type: "expense", item: e }); }} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--surface-alt)", borderTop: "2px solid var(--border)" }}>
                    <td colSpan={4} style={{ padding: "12px 18px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Total Expensed</td>
                    <td style={{ padding: "12px 18px", fontSize: 15, fontWeight: 800, color: "#b91c1c" }}>{fmt(totalExpensed)}</td>
                    <td colSpan={2} style={{ padding: "12px 18px", fontSize: 12, color: "var(--text-muted)" }}>
                      {expData.filter(e => (e.status || "paid") === "pending").length > 0 && <span style={{ color: "#9a3412", fontWeight: 600 }}>{expData.filter(e => e.status === "pending").length} pending</span>}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          {expDetailItem && <ExpDetailPanel exp={expDetailItem} onClose={() => setExpDetailItem(null)} onEdit={e => { setExpDetailItem(null); openEditExp(e); }} onDelete={e => { setExpDetailItem(null); setDeleteConfirm({ type: "expense", item: e }); }} />}
          {onNavigateToExpense && flipExpenses.length > 0 && (
            <button onClick={() => onNavigateToExpense(flipExpenses[0].id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#e95e00", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "12px 0 0", marginLeft: "auto" }}>
              View all expenses across deals <ChevronRight size={14} />
            </button>
          )}
          {showExpenseModal && (() => {
            const PaidToDropdown = () => {
              const q = (expForm.vendor || "").toLowerCase();
              // Contractors on this project — show all on empty, filter on query
              const conMatches = q ? conData.filter(c => c.name.toLowerCase().includes(q)) : conData.slice(0, 6);
              // Previous vendors (excluding contractor names to avoid duplicates) — show first 6 on empty
              const conNames = new Set(conData.map(c => c.name.toLowerCase()));
              const vendorMatches = q
                ? allVendors.filter(v => v.toLowerCase().includes(q) && !conNames.has(v.toLowerCase()))
                : allVendors.filter(v => !conNames.has(v.toLowerCase())).slice(0, 6);
              const exactExists = allVendors.some(v => v.toLowerCase() === q) || conData.some(c => c.name.toLowerCase() === q);
              const showNew = q && !exactExists;
              if (conMatches.length === 0 && vendorMatches.length === 0 && !showNew) return null;
              return (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                  {conMatches.length > 0 && (
                    <>
                      <div style={{ padding: "6px 14px", background: "var(--surface-alt)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Project Contractors</div>
                      {conMatches.slice(0, 5).map(c => (
                        <button key={`con-${c.id}`} onMouseDown={() => { setExpForm(f => ({ ...f, vendor: c.name, contractorId: String(c.id) })); setVendorFocus(false); }}
                          style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                          <UserCheck size={13} style={{ color: "var(--c-blue)", flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{c.name}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.trade}</span>
                        </button>
                      ))}
                    </>
                  )}
                  {vendorMatches.length > 0 && (
                    <>
                      <div style={{ padding: "6px 14px", background: "var(--surface-alt)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Previous Vendors</div>
                      {vendorMatches.slice(0, 5).map(v => (
                        <button key={v} onMouseDown={() => { setExpForm(f => ({ ...f, vendor: v, contractorId: "" })); setVendorFocus(false); }}
                          style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                          <User size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> {v}
                        </button>
                      ))}
                    </>
                  )}
                  {showNew && (
                    <button onMouseDown={() => setVendorFocus(false)}
                      style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "var(--warning-bg)", border: "none", borderTop: "1px solid var(--border)", cursor: "pointer", textAlign: "left" }}>
                      <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{expForm.vendor}&rdquo; as new</span>
                    </button>
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
            <Modal title={editingExpId ? "Edit Expense" : "Add Expense"} onClose={() => { setShowExpenseModal(false); setEditingExpId(null); setExpForm(emptyExp); }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Date</label>
                  <input type="date" value={expForm.date} onChange={sfE("date")} style={iS} />
                </div>
                <div>
                  <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Amount ($) *</label>
                  <input type="number" placeholder="0.00" value={expForm.amount} onChange={sfE("amount")} style={iS} />
                </div>
                <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                  <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Paid To *</label>
                  <input type="text" placeholder="Who was paid?" value={expForm.vendor} onChange={handleVendorChange} onFocus={() => setVendorFocus(true)} onBlur={() => setTimeout(() => setVendorFocus(false), 150)} style={iS} autoComplete="off" />
                  {vendorFocus && <PaidToDropdown />}
                  {!vendorFocus && !expForm.vendor && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>Type to search previous entries or add new</p>}
                  {linkedCon && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <UserCheck size={12} color="var(--c-blue)" />
                      <span style={{ fontSize: 12, color: "var(--c-blue)", fontWeight: 600 }}>Linked to {linkedCon.name} ({linkedCon.trade})</span>
                      <button onClick={() => setExpForm(f => ({ ...f, contractorId: "" }))} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>unlink</button>
                    </div>
                  )}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Description *</label>
                  <input type="text" placeholder="Brief description" value={expForm.description} onChange={sfE("description")} style={iS} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Category</label>
                  <select value={expForm.category} onChange={sfE("category")} style={iS}>
                    {Object.entries(FLIP_EXPENSE_GROUPS).map(([group, subs]) => (
                      <optgroup key={group} label={group}>
                        {subs.map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Rehab Item <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
                  <select value={expForm.rehabItemIdx} onChange={sfE("rehabItemIdx")} style={iS}>
                    <option value="">None — general expense</option>
                    {rehabItems.map((item, idx) => (
                      <option key={idx} value={idx}>{item.category} ({fmt(item.spent || 0)} / {fmt(item.budgeted || 0)})</option>
                    ))}
                  </select>
                  {rehabItems.length === 0 && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>No rehab items on this deal yet — add them in the Rehab tab to link expenses</p>
                  )}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Status</label>
                  <select value={expForm.status} onChange={sfE("status")} style={iS}>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => { setShowExpenseModal(false); setEditingExpId(null); setExpForm(emptyExp); }} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSaveExp} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{editingExpId ? "Save Changes" : "Save Expense"}</button>
              </div>
            </Modal>
            );
          })()}
        </div>
      )}
      {activeTab === "contractors" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{flipContractors.length} contractor{flipContractors.length !== 1 ? "s" : ""} on this project</p>
            <button onClick={() => { setEditingConId(null); setConForm(emptyCon); setShowContractorModal(true); }} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={15} /> Add Contractor
            </button>
          </div>
          {flipContractors.length === 0 ? (
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: 48, textAlign: "center", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
              <Users size={32} style={{ margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No contractors added yet</p>
              <p style={{ fontSize: 13 }}>Track subs, payment types, and amounts owed.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {flipContractors.map(c => {
                const t = conTotals(c);
                const pct = t.totalBid > 0 ? Math.min(100, Math.round((t.totalPaid / t.totalBid) * 100)) : 0;
                const stop = e => e.stopPropagation();
                const isHighlighted = highlightConId === c.id;
                return (
                  <div key={c.id}
                    ref={el => { if (el && isHighlighted) { el.scrollIntoView({ behavior: "smooth", block: "center" }); } }}
                    onClick={() => onNavigateToContractor && onNavigateToContractor(c)}
                    onMouseEnter={e => { if (onNavigateToContractor && !isHighlighted) { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border)"; } }}
                    onMouseLeave={e => { if (!isHighlighted) { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--border-subtle)"; } }}
                    style={{ background: isHighlighted ? "var(--warning-bg)" : "var(--surface)", borderRadius: 16, padding: 20, boxShadow: isHighlighted ? "0 0 0 3px var(--warning-border-soft), 0 4px 14px rgba(233,94,0,0.15)" : "0 1px 3px rgba(0,0,0,0.06)", border: isHighlighted ? "1px solid var(--warning-border)" : "1px solid var(--border-subtle)", cursor: onNavigateToContractor ? "pointer" : "default", transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <UserCheck size={20} color="var(--text-secondary)" />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{c.name}</p>
                          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.trade}{c.phone ? ` · ${c.phone}` : ""}</p>
                        </div>
                        {onNavigateToContractor && <ChevronRight size={16} color="#cbd5e1" style={{ marginLeft: 4, flexShrink: 0 }} />}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={stop}>
                        <button onClick={() => openEditCon(c)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteConfirm({ type: "contractor", item: c })} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                      <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
                        <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3, display: "flex", alignItems: "center" }}>Bids (This Deal)<InfoTip text="Number of bids this contractor has submitted on this deal. Pending count shown in parentheses if any are awaiting acceptance." /></p>
                        <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>{t.bidCount}{t.pendingBids > 0 ? ` (${t.pendingBids} pending)` : ""}</p>
                      </div>
                      <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
                        <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3, display: "flex", alignItems: "center" }}>Total Bid<InfoTip text="Sum of all accepted bid amounts from this contractor on this deal." /></p>
                        <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>{fmt(t.totalBid)}</p>
                      </div>
                      <div style={{ background: t.owed > 0 ? "var(--warning-bg)" : t.totalBid > 0 ? "var(--success-badge)" : "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
                        <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3, display: "flex", alignItems: "center" }}>Balance Owed<InfoTip text="Total Bid − Paid to Date. What you still owe this contractor on this deal." /></p>
                        <p style={{ color: t.owed > 0 ? "#9a3412" : "#15803d", fontSize: 13, fontWeight: 700 }}>{t.totalBid > 0 ? (t.owed > 0 ? fmt(t.owed) : "Paid in full") : "—"}</p>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Paid to Date · {fmt(t.totalPaid)}</p>
                        <div style={{ height: 6, background: "var(--surface-muted)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "var(--c-green)", borderRadius: 99 }} />
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setQuickBid({ contractorId: c.id, rehabItem: "", canonicalCategory: null, amount: "" }); }} style={{ background: "var(--surface)", color: "#e95e00", border: "1px solid #fed7aa", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", flexShrink: 0 }}>
                        <Plus size={12} /> Bid
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setShowPaymentModal(c.id); setPaymentDate(new Date().toISOString().split("T")[0]); }} style={{ background: "var(--c-green)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", flexShrink: 0 }}>
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
        <Modal title={editingConId ? "Edit Contractor" : "Add Contractor"} onClose={() => { setShowContractorModal(false); setEditingConId(null); setConForm(emptyCon); setPendingAssignRowIdx(null); }}>
          {!editingConId && (() => {
            const onDealIds = new Set((conData || []).map(c => c.id));
            const existingAvailable = CONTRACTORS.filter(c => !onDealIds.has(c.id));
            if (existingAvailable.length === 0) return null;
            return (
              <div style={{ marginBottom: 18, padding: 14, background: "var(--surface-alt)", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Add from your existing contractors</label>
                <select
                  defaultValue=""
                  onChange={e => { if (e.target.value) attachExistingContractor(parseInt(e.target.value)); }}
                  style={iS}>
                  <option value="">Select a contractor you've worked with before…</option>
                  {existingAvailable.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.trade ? ` — ${c.trade}` : ""}</option>
                  ))}
                </select>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>— or create a new contractor below —</p>
              </div>
            );
          })()}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Company / Name *</label><input type="text" placeholder="e.g. ABC Plumbing" value={conForm.name} onChange={sfC("name")} style={iS} /></div>
            <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Trade</label><input type="text" placeholder="e.g. Plumbing, Electrical" value={conForm.trade} onChange={sfC("trade")} style={iS} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Phone <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label><input type="tel" placeholder="555-000-0000" value={conForm.phone} onChange={sfC("phone")} style={iS} /></div>
            <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Email <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label><input type="email" placeholder="info@contractor.com" value={conForm.email} onChange={sfC("email")} style={iS} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>License # <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label><input type="text" placeholder="e.g. PL-2024-1847" value={conForm.license} onChange={sfC("license")} style={iS} /></div>
            <div><label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Insurance Expiry <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label><input type="date" value={conForm.insuranceExpiry} onChange={sfC("insuranceExpiry")} style={iS} /></div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Notes <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
            <textarea style={{ ...iS, minHeight: 70, resize: "vertical" }} placeholder="Notes about this contractor..." value={conForm.notes} onChange={sfC("notes")} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setShowContractorModal(false); setEditingConId(null); setConForm(emptyCon); setPendingAssignRowIdx(null); }} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveCon} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{editingConId ? "Save Changes" : "Add Contractor"}</button>
          </div>
        </Modal>
      )}
      {quickBid && (() => {
        const con = conData.find(c => c.id === quickBid.contractorId) || CONTRACTORS.find(c => c.id === quickBid.contractorId);
        if (!con) return null;
        return (
          <Modal title={`Add Bid — ${con.name}`} onClose={() => { setQuickBid(null); setQuickBidRehabFocus(false); }}>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: -6, marginBottom: 14 }}>For <strong style={{ color: "var(--text-primary)" }}>{deal.address}</strong></p>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Rehab Item *</label>
              <input value={quickBid.rehabItem} placeholder="Start typing or pick from the list..." style={iS}
                onChange={e => setQuickBid(q => ({ ...q, rehabItem: e.target.value, canonicalCategory: null }))}
                onFocus={() => setQuickBidRehabFocus(true)} onBlur={() => setTimeout(() => setQuickBidRehabFocus(false), 150)} />
              {quickBid.canonicalCategory && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, fontWeight: 600, color: "#15803d" }}><CheckCircle size={11} /> Standard category</span>
              )}
              {quickBidRehabFocus && (() => {
                const q = quickBid.rehabItem.toLowerCase().trim();
                const canonMatches = REHAB_CATEGORIES.filter(c => !q || c.label.toLowerCase().includes(q));
                const rehabLabels = (rehabItems || []).map(ri => ri.category).filter(Boolean);
                const customMatches = [...new Set(rehabLabels)].filter(c => !q || c.toLowerCase().includes(q)).filter(c => !REHAB_CATEGORIES.some(cc => cc.label === c));
                const exactCanon = REHAB_CATEGORIES.some(c => c.label.toLowerCase() === q);
                const exactCustom = customMatches.some(c => c.toLowerCase() === q);
                const showNew = q && !exactCanon && !exactCustom;
                const grouped = {};
                canonMatches.forEach(c => { if (!grouped[c.group]) grouped[c.group] = []; grouped[c.group].push(c); });
                const groupKeys = REHAB_CATEGORY_GROUPS.filter(g => grouped[g] && grouped[g].length > 0);
                if (groupKeys.length === 0 && customMatches.length === 0 && !showNew) return null;
                return (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 300, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
                    {groupKeys.map(g => (
                      <div key={g}>
                        <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" }}>{g}</div>
                        {grouped[g].map(c => (
                          <button key={c.slug} onMouseDown={() => { setQuickBid(qq => ({ ...qq, rehabItem: c.label, canonicalCategory: c.slug })); setQuickBidRehabFocus(false); }}
                            style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid #f8fafc", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                            <Wrench size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                            <span>{c.label}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                    {customMatches.length > 0 && (
                      <div>
                        <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" }}>On This Deal</div>
                        {customMatches.slice(0, 6).map(c => (
                          <button key={c} onMouseDown={() => { setQuickBid(qq => ({ ...qq, rehabItem: c, canonicalCategory: null })); setQuickBidRehabFocus(false); }}
                            style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid #f8fafc", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                            <Wrench size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                            <span>{c}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showNew && (
                      <button onMouseDown={() => setQuickBidRehabFocus(false)}
                        style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "var(--warning-bg)", border: "none", borderTop: "1px solid var(--border)", cursor: "pointer", textAlign: "left" }}>
                        <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Use &ldquo;{quickBid.rehabItem}&rdquo;</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Bid Amount ($) *</label>
              <input value={quickBid.amount} onChange={e => setQuickBid(q => ({ ...q, amount: e.target.value }))} type="number" placeholder="0" style={iS} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setQuickBid(null); setQuickBidRehabFocus(false); }} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button disabled={!quickBid.rehabItem || !quickBid.amount} onClick={() => {
                const canon = quickBid.canonicalCategory || getCanonicalByLabel(quickBid.rehabItem)?.slug || null;
                pushContractorBid(quickBid.contractorId, quickBid.rehabItem, canon, quickBid.amount);
                setQuickBid(null);
                setQuickBidRehabFocus(false);
              }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 600, cursor: (quickBid.rehabItem && quickBid.amount) ? "pointer" : "not-allowed", opacity: (quickBid.rehabItem && quickBid.amount) ? 1 : 0.5 }}>Add Bid</button>
            </div>
          </Modal>
        );
      })()}
      {showPaymentModal && (() => {
        const con = conData.find(c => c.id === showPaymentModal);
        if (!con) return null;
        const t = conTotals(con);
        return (
          <Modal title={`Record Payment — ${con.name}`} onClose={() => { setShowPaymentModal(null); setPaymentAmount(""); setPaymentNote(""); }}>
            <div style={{ background: "var(--surface-alt)", borderRadius: 12, padding: 14, marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Trade</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{con.trade}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total Bid (This Deal)</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fmt(t.totalBid)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Paid to Date</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fmt(t.totalPaid)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Balance Owed</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.owed > 0 ? "#b91c1c" : "#15803d" }}>{t.owed > 0 ? fmt(t.owed) : "Paid in full"}</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Payment Amount ($) *</label>
                <input type="number" placeholder={t.owed > 0 ? String(t.owed) : "0.00"} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} style={iS} />
                {t.owed > 0 && (
                  <button onClick={() => setPaymentAmount(String(t.owed))} style={{ background: "none", border: "none", color: "var(--c-blue)", fontSize: 11, fontWeight: 600, cursor: "pointer", marginTop: 4, padding: 0 }}>Fill remaining balance ({fmt(t.owed)})</button>
                )}
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Date</label>
                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} style={iS} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Note (optional)</label>
              <input type="text" placeholder="e.g. Draw #2, final payment, materials advance" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} style={iS} />
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>This will also create a linked expense record automatically.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => { setShowPaymentModal(null); setPaymentAmount(""); setPaymentNote(""); }} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleRecordPayment} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-green)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: paymentAmount ? 1 : 0.5 }}>Record Payment</button>
            </div>
          </Modal>
        );
      })()}
      {activeTab === "milestones" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                {doneCount} of {milestones.length} complete
                {overdueCount > 0 && <span style={{ color: "var(--c-red)", fontWeight: 700 }}> . {overdueCount} overdue</span>}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {milestones.some(m => !m.targetDate && !m.done) && (
                <button onClick={() => {
                  // Auto-fill target dates: spread remaining milestones evenly from today to projected close or +90 days
                  const endDate = deal.projectedCloseDate || deal.closeDate;
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
                }} style={{ background: "var(--info-tint)", color: "var(--c-blue)", border: "1px solid var(--info-border)", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={15} /> Auto-Fill Dates
                </button>
              )}
              <button onClick={() => { setEditingMilestoneId(null); setMilestoneForm(emptyMilestone); setShowMilestoneModal(true); }} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <Plus size={15} /> Add Milestone
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: "14px 20px", marginBottom: 16, border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, height: 8, background: "var(--surface-muted)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : 0}%`, background: "var(--c-green)", borderRadius: 99, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : 0}%</span>
          </div>
          {milestones.length === 0 ? (
            <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
              <CheckSquare size={32} style={{ margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No milestones yet</p>
              <p style={{ fontSize: 13 }}>Add milestones to track your deal's progress.</p>
            </div>
          ) : (
            <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", padding: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {milestones.map((m, i) => {
                  const overdue = !m.done && m.targetDate && m.targetDate < today;
                  const isCompleting = completingMsIdx === i;
                  return isCompleting ? (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--success-tint)", border: "1px solid #bbf7d0" }}>
                      <CheckCircle size={18} color="var(--c-green)" />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>{m.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Completed:</span>
                      <input type="date" value={msCompletionDate} onChange={e => setMsCompletionDate(e.target.value)} style={{ ...iS, width: 140, padding: "5px 10px", fontSize: 12 }} />
                      <button onClick={() => { const updated = milestones.map((item, idx) => idx === i ? { ...item, done: true, date: msCompletionDate } : item); setMilestones(updated); setCompletingMsIdx(null); }} style={{ background: "var(--c-green)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Confirm</button>
                      <button onClick={() => setCompletingMsIdx(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}><X size={14} /></button>
                    </div>
                  ) : (
                    <div key={i} onMouseEnter={e => { e.currentTarget.style.background = m.done ? "var(--success-tint)" : overdue ? "var(--danger-tint)" : "var(--surface-muted)"; }} onMouseLeave={e => { e.currentTarget.style.background = m.done ? "var(--success-tint)" : overdue ? "var(--danger-tint)" : "var(--surface-alt)"; }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 8, background: m.done ? "var(--success-tint)" : overdue ? "var(--danger-tint)" : "var(--surface-alt)", border: `1px solid ${m.done ? "var(--success-border)" : overdue ? "var(--danger-border)" : "var(--border-subtle)"}`, transition: "all 0.15s ease" }}>
                      <button onClick={() => m.done ? (() => { const updated = milestones.map((item, idx) => idx === i ? { ...item, done: false, date: null } : item); setMilestones(updated); })() : (() => { setCompletingMsIdx(i); setMsCompletionDate(today); })()} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
                        {m.done ? <CheckCircle size={18} color="var(--c-green)" /> : <Circle size={18} color={overdue ? "var(--c-red)" : "#cbd5e1"} />}
                      </button>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: m.done ? "var(--text-secondary)" : "var(--text-primary)", textDecoration: m.done ? "line-through" : "none" }}>{m.label}</span>
                      {m.targetDate && !m.done && (
                        <span style={{ fontSize: 11, color: overdue ? "var(--c-red)" : "#94a3b8", fontWeight: overdue ? 600 : 400, flexShrink: 0 }}>
                          {overdue ? "Overdue: " : "Target: "}{new Date(m.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {m.done && m.date && (
                        <span style={{ fontSize: 11, color: "var(--c-green)", flexShrink: 0 }}>
                          {new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 4 }}>
                        <button onClick={() => openEditMilestone(m, i)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteConfirm({ type: "milestone", item: m, index: i })} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {showMilestoneModal && (
        <Modal title={editingMilestoneId !== null ? "Edit Milestone" : "Add Milestone"} onClose={() => { setShowMilestoneModal(false); setEditingMilestoneId(null); setMilestoneForm(emptyMilestone); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ position: "relative" }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Milestone Name *</label>
              <input value={milestoneForm.label} style={iS} placeholder="Start typing to search or add new..."
                onChange={e => { setMilestoneForm(f => ({ ...f, label: e.target.value })); setMsLabelFocus(true); }}
                onFocus={() => setMsLabelFocus(true)} onBlur={() => setTimeout(() => setMsLabelFocus(false), 150)} />
              {!msLabelFocus && !milestoneForm.label && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>Type to search previous milestones or add new</p>}
              {msLabelFocus && (() => {
                const q = milestoneForm.label.toLowerCase();
                const matches = q ? allMilestoneLabels.filter(l => l.toLowerCase().includes(q) && l.toLowerCase() !== q) : allMilestoneLabels.slice(0, 6);
                const exactExists = allMilestoneLabels.some(l => l.toLowerCase() === q);
                const showNew = q && !exactExists;
                if (matches.length === 0 && !showNew) return null;
                return (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
                    {matches.slice(0, 6).map(l => (
                      <button key={l} onMouseDown={() => { setMilestoneForm(f => ({ ...f, label: l })); setMsLabelFocus(false); }}
                        style={{ width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                        <Flag size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <span>{l}</span>
                      </button>
                    ))}
                    {showNew && (
                      <button onMouseDown={() => { setMilestoneForm(f => ({ ...f, label: f.label })); setMsLabelFocus(false); }}
                        style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "var(--warning-bg)", border: "none", borderTop: matches.length > 0 ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left" }}>
                        <Plus size={13} style={{ color: "#e95e00", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#e95e00", fontWeight: 600 }}>Add &ldquo;{milestoneForm.label}&rdquo; as new</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Target Date</label>
              <input type="date" value={milestoneForm.targetDate} onChange={sfM("targetDate")} style={iS} />
            </div>
            {editingMilestoneId !== null && (
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Completion Date</label>
                <input type="date" value={milestoneForm.date} onChange={sfM("date")} style={iS} />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Set to mark as complete, or clear to reopen</p>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => { setShowMilestoneModal(false); setEditingMilestoneId(null); setMilestoneForm(emptyMilestone); }} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveMilestone} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: milestoneForm.label.trim() ? 1 : 0.5 }}>{editingMilestoneId !== null ? "Save Changes" : "Add Milestone"}</button>
          </div>
        </Modal>
      )}
      {activeTab === "documents" && (
        <DocumentsPanel
          documents={dealDocs}
          onAdd={doc => { addDealDocument({ ...doc, dealId: deal.id }); dealDocRerender(n => n + 1); }}
          onDelete={id => { deleteDealDocument(id); dealDocRerender(n => n + 1); }}
          entityLabel="deal"
        />
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
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              {dealNotes.length} note{dealNotes.length !== 1 ? "s" : ""}
              {q && filtered.length !== dealNotes.length && <span style={{ color: "#e95e00", fontWeight: 600 }}> . {filtered.length} match{filtered.length !== 1 ? "es" : ""}</span>}
            </p>
            <button onClick={() => setShowNoteInput(true)} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={15} /> Add Note
            </button>
          </div>
          {dealNotes.length > 2 && (
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input type="text" placeholder="Search notes..." value={noteSearch} onChange={e => setNoteSearch(e.target.value)} style={{ ...iS, paddingLeft: 40 }} />
              {noteSearch && (
                <button onClick={() => setNoteSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}><X size={14} /></button>
              )}
            </div>
          )}
          {showNoteInput && (
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, marginBottom: 16, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note about this deal... e.g. 'Spoke with inspector, needs structural review on back wall'" rows={3} style={{ ...iS, resize: "vertical", fontFamily: "inherit" }} autoFocus />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button onClick={() => { setShowNoteInput(false); setNoteText(""); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                <button onClick={addNote} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#e95e00", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: noteText.trim() ? 1 : 0.5 }}>Save Note</button>
              </div>
            </div>
          )}
          <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {dealNotes.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
                <MessageSquare size={32} style={{ margin: "0 auto 12px", display: "block" }} />
                <p style={{ fontWeight: 600, marginBottom: 4 }}>No notes yet</p>
                <p style={{ fontSize: 13 }}>Keep a running journal of updates, calls, and decisions for this deal.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 36, color: "var(--text-muted)" }}>
                <Search size={24} style={{ margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontWeight: 600, fontSize: 14 }}>No notes match "{noteSearch}"</p>
              </div>
            ) : (
              <div>
                {filtered.map((note, i) => (
                  <div key={note.id} style={{ display: "flex", gap: 14, padding: "16px 20px", borderBottom: i < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <MessageSquare size={16} color="var(--c-blue)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>{highlight(note.text)}</p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{note.date}</p>
                    </div>
                    <button onClick={() => removeDealNote(note.id)} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center", alignSelf: "flex-start" }} title="Delete"><Trash2 size={13} /></button>
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
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</label>
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
                  <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</label>
                  <input type="number" placeholder={f.placeholder} value={dealEditForm[f.key] || ""} onChange={sfD(f.key)} style={iS} />
                </div>
              ))}
            </div>
            {stage === "Sold" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Sale Price ($)</label>
                <input type="number" placeholder="361500" value={dealEditForm.salePrice || ""} onChange={sfD("salePrice")} style={iS} />
              </div>
            )}
            <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, marginTop: 8 }}>Key Dates</p>
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
                  <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</label>
                  <input type="date" value={dealEditForm[f.key] || ""} onChange={sfD(f.key)} style={iS} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={() => setShowEditDeal(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveDeal} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Save Changes</button>
          </div>
        </Modal>
      )}
      {showCloseDeal && (
        <Modal title={closeDealStep === "choose" ? "Close Deal" : closeDealStep === "sold" ? "Mark as Sold" : "Convert to Rental"} onClose={() => setShowCloseDeal(false)}>
          {/* Step 1: Choose path */}
          {closeDealStep === "choose" && (<>
            <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 20 }}>
              How would you like to close out <strong>{deal.name}</strong>?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 8 }}>
              <button onClick={() => setCloseDealStep("sold")} style={{ display: "flex", alignItems: "center", gap: 14, padding: 18, background: "var(--success-tint)", border: "2px solid #bbf7d0", borderRadius: 14, cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" }} onMouseEnter={e => e.currentTarget.style.borderColor = "#15803d"} onMouseLeave={e => e.currentTarget.style.borderColor = "var(--success-border)"}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--success-badge)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <DollarSign size={22} color="#15803d" />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>Mark as Sold</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Enter sale price, close date, and selling costs to finalize the deal</p>
                </div>
              </button>
              {onConvertToRental && (
                <button onClick={() => setCloseDealStep("convert")} style={{ display: "flex", alignItems: "center", gap: 14, padding: 18, background: "var(--info-tint-alt)", border: "2px solid var(--info-border-alt)", borderRadius: 14, cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" }} onMouseEnter={e => e.currentTarget.style.borderColor = "var(--c-blue)"} onMouseLeave={e => e.currentTarget.style.borderColor = "var(--info-border-alt)"}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Home size={22} color="var(--c-blue)" />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>Convert to Rental</p>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Keep the property and add it to your rental portfolio</p>
                  </div>
                </button>
              )}
            </div>
          </>)}

          {/* Step 2a: Sold form */}
          {closeDealStep === "sold" && (<>
            <button onClick={() => setCloseDealStep("choose")} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <ArrowLeft size={12} /> Back
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Sale Price *</label>
                <input type="number" placeholder="361500" value={closeForm.salePrice} onChange={sfClose("salePrice")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Close Date *</label>
                <input type="date" value={closeForm.closeDate} onChange={sfClose("closeDate")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Selling Costs ($)</label>
                <input type="number" placeholder="Agent commissions, title, etc." value={closeForm.sellingCosts} onChange={sfClose("sellingCosts")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Buyer Credit ($)</label>
                <input type="number" placeholder="0" value={closeForm.buyerCredit} onChange={sfClose("buyerCredit")} style={iS} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Closing Notes (optional)</label>
              <textarea placeholder="Any notes about the sale..." value={closeForm.closingNotes} onChange={sfClose("closingNotes")} rows={2} style={{ ...iS, resize: "vertical", fontFamily: "inherit" }} />
            </div>
            {(() => {
              const sp = parseFloat(closeForm.salePrice) || 0;
              const sc = parseFloat(closeForm.sellingCosts) || 0;
              const bc = parseFloat(closeForm.buyerCredit) || 0;
              const rehabSpent = (rehabItems || []).reduce((s, i) => s + (i.spent || 0), 0);
              const holdDays = closeForm.closeDate && deal.acquisitionDate ? Math.max(0, Math.ceil((new Date(closeForm.closeDate) - new Date(deal.acquisitionDate)) / 86400000)) : (deal.daysOwned || 0);
              const totalHolding = Math.round((deal.holdingCostsPerMonth || 0) * (holdDays / 30));
              const netProfit = sp - deal.purchasePrice - rehabSpent - totalHolding - sc - bc;
              return (
                <div style={{ background: netProfit >= 0 ? "var(--success-tint)" : "var(--danger-tint)", borderRadius: 12, padding: 16, marginBottom: 20, border: `1px solid ${netProfit >= 0 ? "var(--success-border)" : "var(--danger-border)"}` }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Profit Preview</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>Sale Price</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(sp)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>Total Costs</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#b91c1c" }}>{fmt(deal.purchasePrice + rehabSpent + totalHolding + sc + bc)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>Net Profit</p>
                      <p style={{ fontSize: 14, fontWeight: 800, color: netProfit >= 0 ? "#15803d" : "#b91c1c" }}>{netProfit >= 0 ? "+" : ""}{fmt(netProfit)}</p>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 16, fontSize: 11, color: "var(--text-secondary)" }}>
                    <span>Purchase: {fmt(deal.purchasePrice)}</span>
                    <span>Rehab: {fmt(rehabSpent)}</span>
                    <span>Holding ({holdDays}d): {fmt(totalHolding)}</span>
                    <span>Selling: {fmt(sc)}</span>
                    {bc > 0 && <span>Credit: {fmt(bc)}</span>}
                  </div>
                </div>
              );
            })()}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowCloseDeal(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => {
                const sp = parseFloat(closeForm.salePrice) || 0;
                if (!sp || !closeForm.closeDate) return;
                const sc = parseFloat(closeForm.sellingCosts) || 0;
                const bc = parseFloat(closeForm.buyerCredit) || 0;
                const rehabSpent = (rehabItems || []).reduce((s, i) => s + (i.spent || 0), 0);
                const holdDays = Math.max(0, Math.ceil((new Date(closeForm.closeDate) - new Date(deal.acquisitionDate || deal.contractDate)) / 86400000));
                const totalHolding = Math.round((deal.holdingCostsPerMonth || 0) * (holdDays / 30));
                const netProfit = sp - deal.purchasePrice - rehabSpent - totalHolding - sc - bc;
                const soldData = {
                  stage: "Sold", salePrice: sp, closeDate: closeForm.closeDate,
                  sellingCosts: sc, buyerCredit: bc, rehabSpent, daysOwned: holdDays,
                  totalHoldingCosts: totalHolding, netProfit,
                };
                const idx = DEALS.findIndex(f => f.id === deal.id);
                if (idx !== -1) Object.assign(DEALS[idx], soldData);
                if (setAllFlips) setAllFlips(prev => prev.map(f => f.id === deal.id ? { ...f, ...soldData } : f));
                setStage("Sold");
                if (closeForm.closingNotes.trim()) {
                  pushDealNote(closeForm.closingNotes);
                }
                pushDealNote(`Deal closed — sold for ${fmt(sp)} with net profit of ${fmt(netProfit)}.`);
                if (onDealUpdated) onDealUpdated();
                showToast(`Deal marked as sold — ${fmt(netProfit)} net profit`);
                setShowCloseDeal(false);
              }} disabled={!closeForm.salePrice || !closeForm.closeDate} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: (!closeForm.salePrice || !closeForm.closeDate) ? "#cbd5e1" : "#15803d", color: "#fff", fontWeight: 700, cursor: (!closeForm.salePrice || !closeForm.closeDate) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <DollarSign size={14} /> Mark as Sold
              </button>
            </div>
          </>)}

          {/* Step 2b: Convert to rental confirmation */}
          {closeDealStep === "convert" && (<>
            <button onClick={() => setCloseDealStep("choose")} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <ArrowLeft size={12} /> Back
            </button>
            <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 16 }}>
              Convert this flip deal into a rental property in your portfolio. The deal will be marked as "Converted to Rental" and a new property will be created with the details below.
            </p>
            <div style={{ background: "var(--surface-alt)", borderRadius: 12, padding: 16, marginBottom: 16, border: "1px solid var(--border)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Purchase Price</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(deal.purchasePrice)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current Value (ARV)</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(deal.arv)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Rehab Spent</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{fmt((deal.rehabItems || []).reduce((s, i) => s + (i.spent || 0), 0))}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Acquisition Date</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{deal.acquisitionDate || deal.contractDate || "—"}</p>
                </div>
              </div>
            </div>
            <div style={{ background: "var(--warning-bg)", borderRadius: 10, padding: 12, marginBottom: 20, border: "1px solid #fdba74" }}>
              <p style={{ fontSize: 13, color: "#9a3412", fontWeight: 600 }}>What happens next:</p>
              <p style={{ fontSize: 12, color: "#9a3412", marginTop: 4 }}>
                You'll be taken to the Add Property form pre-filled with this deal's info. You can review and adjust the details (rent amount, loan info, etc.) before saving.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowCloseDeal(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => {
                const rehabSpent = (deal.rehabItems || []).reduce((s, i) => s + (i.spent || 0), 0);
                onConvertToRental({
                  name: deal.name, address: deal.address, type: "Single Family", units: "1",
                  purchasePrice: String(deal.purchasePrice || ""), currentValue: String(deal.arv || ""),
                  closingCosts: String(rehabSpent || ""), purchaseDate: deal.acquisitionDate || deal.contractDate || "",
                  fromFlipId: deal.id, fromFlipName: deal.name,
                });
                setStage("Converted to Rental");
                const idx = DEALS.findIndex(f => f.id === deal.id);
                if (idx !== -1) DEALS[idx].stage = "Converted to Rental";
                pushDealNote("Deal converted to rental property.");
                if (onDealUpdated) onDealUpdated();
                showToast("Converting to rental — review the property details");
                setShowCloseDeal(false);
              }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#1e3a5f", color: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Home size={14} /> Convert to Rental
              </button>
            </div>
          </>)}
        </Modal>
      )}
      {showDeleteDeal && (
        <Modal title="Delete Deal" onClose={() => setShowDeleteDeal(false)}>
          <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Are you sure you want to permanently delete <strong>{deal.name}</strong>?</p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 18 }}>This will remove the deal, its expenses, rehab items, milestones, and notes. This action cannot be undone.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowDeleteDeal(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => {
              const idx = DEALS.findIndex(f => f.id === deal.id);
              if (idx !== -1) DEALS.splice(idx, 1);
              // Clean up related data
              const expIdxs = [];
              DEAL_EXPENSES.forEach((e, i) => { if (e.dealId === deal.id) expIdxs.unshift(i); });
              expIdxs.forEach(i => DEAL_EXPENSES.splice(i, 1));
              const msIdxs = [];
              DEAL_MILESTONES.forEach((m, i) => { if (m.dealId === deal.id) msIdxs.unshift(i); });
              msIdxs.forEach(i => DEAL_MILESTONES.splice(i, 1));
              if (onDealUpdated) onDealUpdated();
              showToast(`"${deal.name}" deleted`);
              setShowDeleteDeal(false);
              if (onBack) onBack();
            }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Trash2 size={14} /> Delete Deal
            </button>
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title={`Delete ${deleteConfirm.type === "expense" ? "Expense" : deleteConfirm.type === "contractor" ? "Contractor" : deleteConfirm.type === "rehab" ? "Rehab Item" : "Milestone"}`} onClose={() => setDeleteConfirm(null)}>
          <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this {deleteConfirm.type === "rehab" ? "rehab item" : deleteConfirm.type}?</p>
          <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: 14, marginBottom: 18 }}>
            {deleteConfirm.type === "expense" && <>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{deleteConfirm.item.description}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{deleteConfirm.item.vendor} · {deleteConfirm.item.date} · <span style={{ color: "#b91c1c", fontWeight: 700 }}>{fmt(deleteConfirm.item.amount)}</span></p>
            </>}
            {deleteConfirm.type === "contractor" && <>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{deleteConfirm.item.name}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{deleteConfirm.item.trade}{deleteConfirm.item.phone ? ` · ${deleteConfirm.item.phone}` : ""}</p>
            </>}
            {deleteConfirm.type === "rehab" && <>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{deleteConfirm.item.category}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Budget: {fmt(deleteConfirm.item.budgeted)} · Spent: {fmt(deleteConfirm.item.spent)}</p>
            </>}
            {deleteConfirm.type === "milestone" && <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{deleteConfirm.item.label}</p>}
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => {
              if (deleteConfirm.type === "expense") setExpData(prev => prev.filter(x => x.id !== deleteConfirm.item.id));
              if (deleteConfirm.type === "contractor") setConData(prev => prev.filter(x => x.id !== deleteConfirm.item.id));
              if (deleteConfirm.type === "rehab") setRehabItems(prev => prev.filter((_, idx) => idx !== deleteConfirm.index));
              if (deleteConfirm.type === "milestone") setMilestones(prev => prev.filter((_, idx) => idx !== deleteConfirm.index));
              setDeleteConfirm(null);
            }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------
// RENT ROLL
// ---------------------------------------------
function TenantManagement({ onBack, highlightTenantId, onClearHighlight, prefillTenant, onClearPrefill, onSelectTenant }) {
  const { showToast } = useToast();
  const [tenantData, setTenantData] = useState(TENANTS);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [propFilter, setPropFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [flashId, setFlashId] = useState(highlightTenantId);
  const highlightRef = useRef(null);
  const [closingTenant, setClosingTenant] = useState(null);
  const [closeForm, setCloseForm] = useState({ moveOutDate: "", moveOutReason: "Lease ended" });

  // Compute days until lease expiry dynamically
  const getDaysLeft = (leaseEnd) => {
    if (!leaseEnd) return null;
    const d = Math.ceil((new Date(leaseEnd) - new Date()) / 86400000);
    return d > 0 ? d : 0;
  };

  useEffect(() => {
    if (highlightTenantId) {
      setFlashId(highlightTenantId);
      setTimeout(() => {
        if (highlightRef.current) highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      const timer = setTimeout(() => { setFlashId(null); onClearHighlight && onClearHighlight(); }, 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightTenantId]);
  const emptyT = { propertyId: PROPERTIES[0]?.id || 1, unit: "", name: "", rent: "", securityDeposit: "", lateFeePct: "5", renewalTerms: "Annual", notes: "", leaseStart: "", leaseEnd: "", status: "active-lease", phone: "", email: "", leaseDoc: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
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

  // Auto-open add form when navigating from Dashboard "List Unit" quick action
  useEffect(() => {
    if (prefillTenant) {
      setEditId(null);
      setForm({ ...emptyT, propertyId: prefillTenant.propertyId, unit: prefillTenant.unit || "" });
      setShowModal(true);
      onClearPrefill && onClearPrefill();
    }
  }, [prefillTenant]);

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
    if (editId !== null) {
      setTenantData(prev => prev.map(t => t.id === editId
        ? { ...t, propertyId: parseInt(form.propertyId), unit: form.unit || t.unit, name: form.name, rent: parseFloat(form.rent) || 0, securityDeposit: parseFloat(form.securityDeposit) || null, lateFeePct: parseFloat(form.lateFeePct) || null, renewalTerms: form.renewalTerms, notes: form.notes, leaseStart: form.leaseStart || null, leaseEnd: form.leaseEnd || null, status: form.status, phone: form.phone || null, email: form.email || null, leaseDoc: form.leaseDoc ?? t.leaseDoc }
        : t
      ));
    } else {
      setTenantData(prev => [...prev, { id: newId(), propertyId: parseInt(form.propertyId), unit: form.unit || "Main", name: form.name, rent: parseFloat(form.rent) || 0, securityDeposit: parseFloat(form.securityDeposit) || null, lateFeePct: parseFloat(form.lateFeePct) || null, renewalTerms: form.renewalTerms, notes: form.notes, leaseStart: form.leaseStart || null, leaseEnd: form.leaseEnd || null, status: form.status, lastPayment: null, phone: form.phone || null, email: form.email || null, leaseDoc: form.leaseDoc || null, moveOutDate: null, moveOutReason: null }]);
    }
    const wasEdit = editId !== null;
    setForm(emptyT);
    setShowModal(false);
    showToast(wasEdit ? "Tenant updated" : "Tenant added");
  };

  const handleDeleteTenant = () => {
    if (!deleteConfirm) return;
    setTenantData(prev => prev.filter(t => t.id !== deleteConfirm.id));
    setDeleteConfirm(null);
  };

  // Close lease: move tenant to "past" and create a vacant unit record
  const handleCloseLease = () => {
    if (!closingTenant) return;
    const t = closingTenant;
    setTenantData(prev => {
      const updated = prev.map(rec => rec.id === t.id
        ? { ...rec, status: "past", moveOutDate: closeForm.moveOutDate || new Date().toISOString().split("T")[0], moveOutReason: closeForm.moveOutReason }
        : rec
      );
      // Check if another active tenant already exists for this unit
      const hasActiveOnUnit = updated.some(rec => rec.id !== t.id && rec.propertyId === t.propertyId && rec.unit === t.unit && rec.status !== "past");
      if (!hasActiveOnUnit) {
        updated.push({ id: newId(), propertyId: t.propertyId, unit: t.unit, name: "Vacant", rent: t.rent, leaseStart: null, leaseEnd: null, status: "vacant", lastPayment: null, phone: null, email: null, securityDeposit: null, moveOutDate: null, moveOutReason: null, leaseDoc: null });
      }
      return updated;
    });
    setClosingTenant(null);
    setCloseForm({ moveOutDate: "", moveOutReason: "Lease ended" });
  };

  const leaseStatusStyle = {
    "active-lease":   { bg: "var(--success-badge)", text: "#15803d" },
    "month-to-month": { bg: "var(--warning-bg)", text: "var(--warning-text)" },
    "vacant":         { bg: "var(--danger-badge)", text: "#b91c1c" },
    "past":           { bg: "var(--surface-muted)", text: "var(--text-secondary)" },
  };

  const STATUS_LABELS = { "active-lease": "Active Lease", "month-to-month": "Month-to-Month", "vacant": "Vacant", "past": "Past Tenant" };

  // Active tenants = everything except "past" status
  const activeTenants = tenantData.filter(t => t.status !== "past");
  const pastTenants = tenantData.filter(t => t.status === "past");
  const isPastView = statusFilter === "past";

  const filteredTenants = tenantData.filter(t => {
    const matchProp = propFilter === "all" || t.propertyId === Number(propFilter);
    if (statusFilter === "past") return matchProp && t.status === "past";
    if (statusFilter === "all") return matchProp && t.status !== "past";
    if (statusFilter === "expiring") {
      const days = getDaysLeft(t.leaseEnd);
      return matchProp && t.status !== "past" && t.status !== "vacant" && days !== null && days <= 90;
    }
    return matchProp && t.status === statusFilter;
  });

  const totalUnits = activeTenants.filter(t => propFilter === "all" || t.propertyId === Number(propFilter)).length;
  const occupied = activeTenants.filter(t => (propFilter === "all" || t.propertyId === Number(propFilter)) && t.status !== "vacant").length;
  const vacancyRate = totalUnits > 0 ? ((totalUnits - occupied) / totalUnits * 100).toFixed(0) : 0;
  const grossRent = activeTenants.filter(t => (propFilter === "all" || t.propertyId === Number(propFilter)) && t.status !== "vacant").reduce((s, t) => s + t.rent, 0);
  const expiringIn90 = activeTenants.filter(t => { const d = getDaysLeft(t.leaseEnd); return d !== null && d <= 90 && t.status !== "vacant"; });

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-blue)", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 14 }}>
          Back to Property
        </button>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Tenants</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>All tenants, leases, and occupancy status</p>
        </div>
        <select value={propFilter} onChange={e => setPropFilter(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
          <option value="all">All Properties</option>
          {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Units", value: totalUnits, sub: "Across portfolio", color: "var(--c-blue)", icon: Home, tip: "Count of all active unit records (excludes past tenants)" },
          { label: "Occupied", value: `${occupied}/${totalUnits}`, sub: `${100 - Number(vacancyRate)}% occupancy`, color: "var(--c-green)", icon: CheckSquare, tip: "Units with an active-lease or month-to-month tenant divided by total units" },
          { label: "Vacancy Rate", value: `${vacancyRate}%`, sub: `${totalUnits - occupied} unit${totalUnits - occupied !== 1 ? "s" : ""} vacant`, color: Number(vacancyRate) > 10 ? "var(--c-red)" : "#e95e00", icon: AlertCircle, semantic: true, tip: "Vacant units / total units. Red when above 10%" },
          { label: "Gross Monthly Rent", value: fmt(grossRent), sub: "Occupied units only", color: "var(--c-purple)", icon: DollarSign, tip: "Sum of monthly rent for all occupied units (excludes vacant)" },
        ].map((m, i) => (
          <div key={i} style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</p>
                  <InfoTip text={m.tip} />
                </div>
                <p style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
                <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{m.sub}</p>
              </div>
              <div style={{ background: m.semantic ? colorWithAlpha(m.color, 0.1) : "#1e3a5f", borderRadius: 10, padding: 10 }}>
                <m.icon size={20} color={m.semantic ? m.color : "#e95e00"} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {[
            ["all", "All"],
            ["active-lease", "Active Lease"],
            ["month-to-month", "Month-to-Month"],
            ["vacant", "Vacant"],
            ["expiring", "Expiring Soon"],
            ["past", "Past Tenants"],
          ].map(([val, label]) => {
            const active = statusFilter === val;
            const count = val === "expiring" ? expiringIn90.length : val === "past" ? pastTenants.filter(t => propFilter === "all" || t.propertyId === Number(propFilter)).length : 0;
            return (
              <button key={val} onClick={() => setStatusFilter(val)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {label}{(val === "expiring" || val === "past") && count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
        {(propFilter !== "all" || statusFilter !== "all") && (
          <button onClick={() => { setPropFilter("all"); setStatusFilter("all"); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filters
          </button>
        )}
        <button onClick={openAdd} style={{ marginLeft: "auto", background: "var(--c-blue)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Add Tenant
        </button>
      </div>

      {expiringIn90.length > 0 && statusFilter !== "expiring" && !isPastView && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid #fdba74", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertCircle size={18} color="#9a3412" />
          <p style={{ color: "#9a3412", fontSize: 14, fontWeight: 600 }}>
            {expiringIn90.length} lease{expiringIn90.length !== 1 ? "s" : ""} expiring within 90 days:{" "}
            {expiringIn90.map(t => { const d = getDaysLeft(t.leaseEnd); return `${t.name.split(" ")[0]} (${d}d)`; }).join(", ")}
          </p>
        </div>
      )}
      <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {(isPastView
                ? ["Property / Unit", "Tenant", "Rent (was)", "Lease Period", "Move-Out Date", "Reason", ""]
                : ["Property / Unit", "Tenant", "Monthly Rent", "Lease Start", "Lease End", "Days Left", "Status", "Last Payment", ""]
              ).map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTenants.length === 0 && (
              <tr><td colSpan={isPastView ? 7 : 9}>
                {tenantData.length === 0 && !isPastView
                  ? <EmptyState icon={Users} title="No tenants yet" subtitle="Add your first tenant to start tracking leases and rent." actionLabel="Add Tenant" onAction={() => setShowModal(true)} />
                  : <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                      {isPastView ? "No past tenant records found." : "No tenants match your filters."}{" "}
                      <button onClick={() => { setPropFilter("all"); setStatusFilter("all"); }} style={{ background: "none", border: "none", color: "#e95e00", fontSize: 14, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
                    </div>
                }
              </td></tr>
            )}
            {filteredTenants.map((t, i) => {
              const prop = PROPERTIES.find(p => p.id === t.propertyId);
              const s = leaseStatusStyle[t.status] || leaseStatusStyle["vacant"];
              const daysLeft = getDaysLeft(t.leaseEnd);
              const expiring = daysLeft !== null && daysLeft <= 90 && t.status !== "vacant" && t.status !== "past";
              const isFlash = flashId === t.id;
              const isActiveTenant = t.status === "active-lease" || t.status === "month-to-month";

              if (isPastView) {
                return (
                  <tr key={t.id} style={{ borderTop: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{prop?.name.split(" ").slice(0,2).join(" ")}</p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.email}</p>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>{fmt(t.rent)}</td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-secondary)" }}>
                      {t.leaseStart || "?"} &mdash; {t.leaseEnd || "?"}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{t.moveOutDate || "-"}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ background: "var(--surface-muted)", color: "var(--text-secondary)", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{t.moveOutReason || "-"}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button onClick={() => setDeleteConfirm(t)} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--c-red)" }} title="Delete record">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={t.id} ref={isFlash ? highlightRef : null} style={{ borderTop: "1px solid var(--border-subtle)", background: isFlash ? "var(--warning-btn-bg)" : i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)", transition: "background 2.5s ease" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{prop?.name.split(" ").slice(0,2).join(" ")}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.unit}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {t.status === "vacant" ? (
                      <span style={{ color: "var(--c-red)", fontSize: 13, fontWeight: 600, fontStyle: "italic" }}>Vacant</span>
                    ) : (
                      <div onClick={() => onSelectTenant && onSelectTenant(t)} style={{ cursor: onSelectTenant ? "pointer" : "default" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.email}</p>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: t.status === "vacant" ? "var(--text-muted)" : "var(--text-primary)" }}>{fmt(t.rent)}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{t.leaseStart || "-"}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{t.leaseEnd || "-"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    {daysLeft !== null && t.status !== "vacant" ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: expiring ? "#9a3412" : "#15803d" }}>
                        {expiring ? "(!) " : ""}{daysLeft}d
                      </span>
                    ) : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{STATUS_LABELS[t.status] || t.status}</span>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{t.lastPayment || "-"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {isActiveTenant && (
                        <button onClick={() => { setClosingTenant(t); setCloseForm({ moveOutDate: new Date().toISOString().split("T")[0], moveOutReason: "Lease ended" }); }} style={{ background: "var(--warning-btn-bg)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "#9a3412", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }} title="Close this lease and move tenant to past records">
                          <LogOut size={12} /> Close
                        </button>
                      )}
                      <button onClick={() => openEdit(t)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "var(--text-label)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => setDeleteConfirm(t)} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--c-red)" }} title="Delete">
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

      {/* ── Turnover Analytics ── */}
      {!isPastView && pastTenants.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", marginTop: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Turnover Analytics</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Historical tenant turnover and rent trends</p>
          {(() => {
            const relevantPast = pastTenants.filter(t => propFilter === "all" || t.propertyId === Number(propFilter));
            if (relevantPast.length === 0) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No past tenant data for this property.</p>;

            // Turnover rate: past tenants / (past + current active non-vacant) over all time
            const relevantActive = activeTenants.filter(t => (propFilter === "all" || t.propertyId === Number(propFilter)) && t.status !== "vacant");
            const turnoverRate = relevantActive.length + relevantPast.length > 0
              ? ((relevantPast.length / (relevantActive.length + relevantPast.length)) * 100).toFixed(0) : 0;

            // Avg vacancy days: for each past tenant, find the next tenant on same property+unit
            const vacancyDays = [];
            relevantPast.forEach(pt => {
              if (!pt.moveOutDate) return;
              // Find if a current or another past tenant took over this unit after this one left
              const successors = tenantData.filter(t => t.id !== pt.id && t.propertyId === pt.propertyId && t.unit === pt.unit && t.leaseStart && new Date(t.leaseStart) >= new Date(pt.moveOutDate));
              if (successors.length > 0) {
                successors.sort((a, b) => new Date(a.leaseStart) - new Date(b.leaseStart));
                const gap = Math.round((new Date(successors[0].leaseStart) - new Date(pt.moveOutDate)) / 86400000);
                if (gap >= 0) vacancyDays.push(gap);
              }
            });
            const avgVacancy = vacancyDays.length > 0 ? Math.round(vacancyDays.reduce((s, d) => s + d, 0) / vacancyDays.length) : null;

            // Rent growth per unit: compare past tenant's rent to current tenant's rent on same unit
            const rentChanges = [];
            relevantPast.forEach(pt => {
              const current = activeTenants.find(t => t.propertyId === pt.propertyId && t.unit === pt.unit && t.status !== "vacant");
              if (current && pt.rent > 0) {
                rentChanges.push({ unit: pt.unit, property: PROPERTIES.find(p => p.id === pt.propertyId)?.name?.split(" ").slice(0,2).join(" ") || "", from: pt.rent, to: current.rent, pct: ((current.rent - pt.rent) / pt.rent * 100).toFixed(1) });
              }
            });
            const avgRentGrowth = rentChanges.length > 0 ? (rentChanges.reduce((s, r) => s + parseFloat(r.pct), 0) / rentChanges.length).toFixed(1) : null;

            return (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                  <div style={{ background: "var(--surface-alt)", borderRadius: 12, padding: "16px 18px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Turnover Rate</p>
                      <InfoTip text="Past tenants / (past + current active tenants). Higher rates may indicate tenant satisfaction issues." />
                    </div>
                    <p style={{ color: Number(turnoverRate) > 50 ? "var(--c-red)" : "var(--text-primary)", fontSize: 22, fontWeight: 700 }}>{turnoverRate}%</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{relevantPast.length} past · {relevantActive.length} active</p>
                  </div>
                  <div style={{ background: "var(--surface-alt)", borderRadius: 12, padding: "16px 18px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg Vacancy Gap</p>
                      <InfoTip text="Average days between a tenant moving out and the next tenant's lease starting on the same unit." />
                    </div>
                    <p style={{ color: avgVacancy !== null && avgVacancy > 30 ? "#e95e00" : "var(--text-primary)", fontSize: 22, fontWeight: 700 }}>{avgVacancy !== null ? `${avgVacancy} days` : "—"}</p>
                    <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{vacancyDays.length > 0 ? `Based on ${vacancyDays.length} transition${vacancyDays.length !== 1 ? "s" : ""}` : "No transition data yet"}</p>
                  </div>
                  <div style={{ background: "var(--surface-alt)", borderRadius: 12, padding: "16px 18px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg Rent Growth</p>
                      <InfoTip text="Average rent increase (%) when a new tenant replaces a previous tenant on the same unit." />
                    </div>
                    <p style={{ color: avgRentGrowth !== null && parseFloat(avgRentGrowth) > 0 ? "var(--c-green)" : "var(--text-primary)", fontSize: 22, fontWeight: 700 }}>
                      {avgRentGrowth !== null ? `${parseFloat(avgRentGrowth) > 0 ? "+" : ""}${avgRentGrowth}%` : "—"}
                    </p>
                    <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{rentChanges.length > 0 ? `Across ${rentChanges.length} unit${rentChanges.length !== 1 ? "s" : ""}` : "No comparable data"}</p>
                  </div>
                </div>

                {/* Rent growth breakdown per unit */}
                {rentChanges.length > 0 && (
                  <div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Rent Growth by Unit</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {rentChanges.map((r, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-label)", minWidth: 120 }}>{r.property} · {r.unit}</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmt(r.from)}</span>
                          <ArrowRight size={12} color="#94a3b8" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(r.to)}</span>
                          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: parseFloat(r.pct) > 0 ? "var(--c-green)" : parseFloat(r.pct) < 0 ? "var(--c-red)" : "#94a3b8" }}>
                            {parseFloat(r.pct) > 0 ? "+" : ""}{r.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Close Lease Modal */}
      {closingTenant && (
        <Modal title="Close Lease" onClose={() => setClosingTenant(null)} width={480}>
          <div style={{ padding: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--warning-bg)", borderRadius: 12, border: "1px solid #fdba74", marginBottom: 20 }}>
              <AlertTriangle size={20} color="#9a3412" />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#9a3412" }}>This will end the lease for <strong>{closingTenant.name}</strong></p>
                <p style={{ fontSize: 12, color: "#9a3412", marginTop: 2 }}>
                  {PROPERTIES.find(p => p.id === closingTenant.propertyId)?.name} &middot; {closingTenant.unit} &middot; {fmt(closingTenant.rent)}/mo
                </p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              The tenant will be moved to past records and the unit will be marked as vacant.
            </p>
            <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Move-Out Date</label>
                <input type="date" value={closeForm.moveOutDate} onChange={e => setCloseForm(f => ({ ...f, moveOutDate: e.target.value }))} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Reason</label>
                <select value={closeForm.moveOutReason} onChange={e => setCloseForm(f => ({ ...f, moveOutReason: e.target.value }))} style={iS}>
                  <option>Lease ended</option>
                  <option>Lease not renewed</option>
                  <option>Relocated for work</option>
                  <option>Purchased own home</option>
                  <option>Lease ended, rent increase</option>
                  <option>Eviction</option>
                  <option>Mutual agreement</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setClosingTenant(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCloseLease} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Close Lease</button>
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal title={editId ? "Edit Tenant" : "Add Tenant"} onClose={() => setShowModal(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Property</label>
              <select value={form.propertyId} onChange={sf("propertyId")} style={iS}>
                {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Unit</label>
              <input type="text" placeholder="e.g. Unit A, #4B" value={form.unit} onChange={sf("unit")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Status</label>
              <select value={form.status} onChange={sf("status")} style={iS}>
                <option value="active-lease">Active Lease</option>
                <option value="month-to-month">Month-to-Month</option>
                <option value="vacant">Vacant</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Tenant Name *</label>
              <input type="text" placeholder="Full name" value={form.name} onChange={sf("name")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Monthly Rent ($)</label>
              <input type="number" placeholder="0" value={form.rent} onChange={sf("rent")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Phone</label>
              <input type="text" placeholder="555-000-0000" value={form.phone} onChange={sf("phone")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Lease Start</label>
              <input type="date" value={form.leaseStart} onChange={sf("leaseStart")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Lease End</label>
              <input type="date" value={form.leaseEnd} onChange={sf("leaseEnd")} style={iS} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Email</label>
              <input type="email" placeholder="tenant@email.com" value={form.email} onChange={sf("email")} style={iS} />
            </div>
          </div>

          {/* Lease Details Section */}
          <div style={{ background: "var(--success-tint)", borderRadius: 14, padding: "16px 18px", marginTop: 18, border: "1px solid #bbf7d0" }}>
            <p style={{ color: "#166534", fontSize: 13, fontWeight: 700, marginBottom: 14, letterSpacing: "0.03em", textTransform: "uppercase" }}>Lease Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Security Deposit ($)</label>
                <input type="number" placeholder="0" value={form.securityDeposit} onChange={sf("securityDeposit")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Late Fee (%)</label>
                <input type="number" placeholder="5" value={form.lateFeePct} onChange={sf("lateFeePct")} style={iS} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Renewal Terms</label>
                <select value={form.renewalTerms} onChange={sf("renewalTerms")} style={iS}>
                  <option value="Annual">Annual</option>
                  <option value="Month-to-Month">Month-to-Month</option>
                  <option value="6-Month">6-Month</option>
                  <option value="5-Year Option">5-Year Option</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Notes</label>
                <textarea placeholder="Any additional notes about this tenant or lease..." value={form.notes} onChange={sf("notes")} rows={3} style={{ ...iS, resize: "vertical", lineHeight: 1.5 }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Lease Document</label>
                {form.leaseDoc ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--surface)", borderRadius: 10, border: "1px solid #d1fae5" }}>
                    <FileText size={20} color="var(--c-green)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{form.leaseDoc.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{form.leaseDoc.size}</div>
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, leaseDoc: null }))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-red)", padding: 4, display: "flex", alignItems: "center" }}><X size={15} /></button>
                  </div>
                ) : (
                  <div onClick={() => document.getElementById("leaseDocInput").click()} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--surface)", borderRadius: 10, border: "2px dashed #bbf7d0", cursor: "pointer" }}>
                    <UploadCloud size={20} color="var(--c-green)" />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Click to upload lease (PDF, DOC)</span>
                  </div>
                )}
                <input id="leaseDocInput" type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={handleLeaseDocUpload} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveTenant} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-blue)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              {editId ? "Save Changes" : "Add Tenant"}
            </button>
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title={deleteConfirm.status === "past" ? "Delete Past Tenant Record" : "Remove Tenant"} onClose={() => setDeleteConfirm(null)} width={440}>
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--danger-badge)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Trash2 size={22} color="var(--c-red)" />
            </div>
            <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              {deleteConfirm.status === "past" ? "Delete" : "Remove"} <strong>{deleteConfirm.name || "Vacant Unit"}</strong> from {PROPERTIES.find(p => p.id === deleteConfirm.propertyId)?.name || "property"}?
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 6 }}>
              Unit {deleteConfirm.unit} · {deleteConfirm.status === "vacant" ? "Vacant" : deleteConfirm.status === "past" ? `Past tenant · Moved out ${deleteConfirm.moveOutDate || "N/A"}` : `Rent ${fmt(deleteConfirm.rent)}/mo`}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 24 }}>
              This will permanently remove this {deleteConfirm.status === "past" ? "historical" : "tenant"} record. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDeleteTenant} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{deleteConfirm.status === "past" ? "Delete Record" : "Remove Tenant"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------
// REHAB ITEM DETAIL
// ---------------------------------------------
function RehabItemDetail({ deal, itemIdx, onBack, backLabel, onNavigateToContractor, onNavigateToExpense }) {
  const { showToast } = useToast();
  const [version, setVersion] = useState(0);
  const bump = () => setVersion(v => v + 1);
  const item = deal.rehabItems && deal.rehabItems[itemIdx];
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ category: "", canonicalCategory: null, budgeted: "", spent: "", status: "pending" });
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState(null);

  const allCategories = useMemo(() => {
    const custom = new Set(DEALS.flatMap(f => (f.rehabItems || []).map(i => i.category)).filter(Boolean));
    REHAB_CATEGORIES.forEach(c => custom.delete(c.label));
    return { canonical: REHAB_CATEGORIES, custom: [...custom].sort() };
  }, []);
  const [catFocus, setCatFocus] = useState(false);

  if (!item) {
    return (
      <div>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}><ChevronLeft size={16} /> {backLabel || "Back"}</button>
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Rehab item not found.</div>
      </div>
    );
  }

  const remaining = (item.budgeted || 0) - (item.spent || 0);
  const over = remaining < 0;
  const statusBg = { "complete": "var(--success-badge)", "in-progress": "var(--warning-bg)", "pending": "var(--hover-surface)" };
  const statusColors = { "complete": "#15803d", "in-progress": "#9a3412", "pending": "#64748b" };
  const statusLabel = { "complete": "Complete", "in-progress": "In Progress", "pending": "Pending" };

  const assigned = item.contractors || [];
  const assignedIds = assigned.map(c => c.id);
  const dealContractors = CONTRACTORS.filter(c => (c.dealIds || []).includes(deal.id));
  const unassigned = dealContractors.filter(c => !assignedIds.includes(c.id));
  // Look up each contractor's bid for this scope from the shared bids store
  const getBidFor = (conId) => CONTRACTOR_BIDS.find(b => b.contractorId === conId && b.dealId === deal.id && b.rehabItem === item.category);

  // Linked expenses: match by explicit rehabItemIdx, canonical slug, OR raw category label
  const linkedExpenses = DEAL_EXPENSES
    .filter(e => e.dealId === deal.id && (
      e.rehabItemIdx === itemIdx ||
      (item.canonicalCategory && e.canonicalCategory === item.canonicalCategory) ||
      e.category === item.category
    ))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const linkedTotal = linkedExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Notes live in the global DEAL_NOTES store, scoped by rehabItemIdx
  const notes = DEAL_NOTES
    .filter(n => n.dealId === deal.id && n.rehabItemIdx === itemIdx)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const openEdit = () => {
    setEditForm({
      category: item.category || "",
      canonicalCategory: item.canonicalCategory || getCanonicalByLabel(item.category)?.slug || null,
      budgeted: String(item.budgeted || ""),
      spent: String(item.spent || ""),
      status: item.status || "pending",
    });
    setShowEdit(true);
  };
  const saveEdit = () => {
    if (!editForm.category) return;
    const canon = editForm.canonicalCategory || getCanonicalByLabel(editForm.category)?.slug || null;
    deal.rehabItems[itemIdx] = {
      ...item,
      category: editForm.category,
      canonicalCategory: canon,
      budgeted: parseFloat(editForm.budgeted) || 0,
      spent: parseFloat(editForm.spent) || 0,
      status: editForm.status,
    };
    setShowEdit(false);
    bump();
    showToast("Rehab item updated");
  };

  const addContractor = (conId) => {
    const cons = item.contractors || [];
    if (cons.some(c => c.id === conId)) return;
    deal.rehabItems[itemIdx] = { ...item, contractors: [...cons, { id: conId, bid: 0 }] };
    bump();
  };
  const removeContractor = (conId) => {
    deal.rehabItems[itemIdx] = { ...item, contractors: (item.contractors || []).filter(c => c.id !== conId) };
    bump();
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    const now = new Date().toISOString();
    const today = now.split("T")[0];
    DEAL_NOTES.unshift({
      id: newId(),
      dealId: deal.id,
      rehabItemIdx: itemIdx,
      date: today,
      text: noteText.trim(),
      createdAt: now,
      updatedAt: now,
      userId: "usr_001",
      mentions: [],
    });
    setNoteText("");
    setShowAddNote(false);
    bump();
    showToast("Note added");
  };
  const deleteNote = (id) => {
    const gi = DEAL_NOTES.findIndex(n => n.id === id);
    if (gi !== -1) DEAL_NOTES.splice(gi, 1);
    setDeletingNoteId(null);
    bump();
    showToast("Note deleted");
  };

  const addPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      deal.rehabItems[itemIdx] = { ...item, photos: [...(item.photos || []), ev.target.result] };
      bump();
      showToast("Photo added");
    };
    reader.readAsDataURL(file);
  };
  const removePhoto = (pIdx) => {
    deal.rehabItems[itemIdx] = { ...item, photos: (item.photos || []).filter((_, i) => i !== pIdx) };
    bump();
  };

  const sectionS = { background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", marginBottom: 16 };
  const cardS = { background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" };
  const iS = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none", fontFamily: "inherit" };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}><ChevronLeft size={16} /> {backLabel || "Back"}</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{item.category}</h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>{deal.name} · Rehab scope</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ background: statusBg[item.status], color: statusColors[item.status], borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>{statusLabel[item.status] || item.status}</span>
          <button onClick={openEdit} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Pencil size={14} /> Edit</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <div style={cardS}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Budget</p>
            <InfoTip text="The amount budgeted for this rehab scope. Edit via the Edit button." />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{fmt(item.budgeted || 0)}</p>
        </div>
        <div style={cardS}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Spent</p>
            <InfoTip text="Total spent on this scope. Updated manually or from linked expenses." />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{fmt(item.spent || 0)}</p>
        </div>
        <div style={cardS}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{over ? "Over Budget" : "Remaining"}</p>
            <InfoTip text="Budget minus Spent. Negative means over budget." />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: over ? "var(--c-red)" : "var(--c-green)", fontFamily: "var(--font-display)" }}>{over ? `-${fmt(Math.abs(remaining))}` : fmt(remaining)}</p>
        </div>
        <div style={cardS}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contractors</p>
            <InfoTip text="Number of contractors assigned to this scope." />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{assigned.length}</p>
        </div>
      </div>

      {/* Contractors section */}
      <div style={sectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Assigned Contractors</h3>
          {unassigned.length > 0 && (
            <select value="" onChange={e => { if (e.target.value) { addContractor(parseInt(e.target.value)); e.target.value = ""; } }}
              style={{ border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--text-secondary)", background: "var(--surface-alt)", cursor: "pointer", outline: "none" }}>
              <option value="">+ Assign contractor</option>
              {unassigned.map(c => <option key={c.id} value={c.id}>{c.name} ({c.trade})</option>)}
            </select>
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Contractors working on this scope and their bid amounts</p>
        {assigned.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--surface-alt)", borderRadius: 12 }}>
            {dealContractors.length === 0 ? "No contractors on this deal yet. Add contractors from the deal's Contractors tab." : "No contractors assigned to this scope yet."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {assigned.map(asgn => {
              const con = CONTRACTORS.find(c => c.id === asgn.id);
              if (!con) return null;
              const bid = getBidFor(con.id);
              const statusBidBg = bid?.status === "accepted" ? "var(--success-badge)" : "var(--warning-bg)";
              const statusBidColor = bid?.status === "accepted" ? "#15803d" : "#9a3412";
              return (
                <div key={asgn.id} onClick={() => onNavigateToContractor && onNavigateToContractor(con, "bids")}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "var(--surface-alt)", borderRadius: 12, border: "1px solid var(--border-subtle)", cursor: onNavigateToContractor ? "pointer" : "default", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface-muted)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--surface-alt)"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #e95e00, #041830)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Truck size={16} color="#fff" />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{con.name}</p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{con.trade}{con.phone ? ` · ${con.phone}` : ""}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>Bid</p>
                      {bid ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(bid.amount)}</span>
                          <span style={{ background: statusBidBg, color: statusBidColor, borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 600, textTransform: "capitalize" }}>{bid.status}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No bid yet</span>
                      )}
                    </div>
                    <ChevronRight size={16} color="#cbd5e1" />
                    <button onClick={(e) => { e.stopPropagation(); removeContractor(asgn.id); }} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Remove from scope"><X size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Photos section */}
      <div style={sectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Photos</h3>
          <label style={{ background: "var(--surface-muted)", color: "var(--text-label)", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Add Photo
            <input type="file" accept="image/*" onChange={addPhoto} style={{ display: "none" }} />
          </label>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Before, during, and after shots for this scope</p>
        {(item.photos || []).length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--surface-alt)", borderRadius: 12 }}>No photos yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {(item.photos || []).map((p, pi) => (
              <div key={pi} style={{ position: "relative", aspectRatio: "1", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                <img src={p} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => removePhoto(pi)} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Expenses */}
      <div style={sectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Linked Expenses</h3>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fmt(linkedTotal)} total</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Deal expenses tagged to this rehab scope or matching category</p>
        {linkedExpenses.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--surface-alt)", borderRadius: 12 }}>No expenses linked to this scope yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {linkedExpenses.map(exp => (
              <div key={exp.id} onClick={() => onNavigateToExpense && onNavigateToExpense(exp.id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border-subtle)", cursor: onNavigateToExpense ? "pointer" : "default" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{exp.description || exp.vendor}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{exp.date} · {exp.vendor} · {exp.category}</p>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#b91c1c" }}>{fmt(exp.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div style={sectionS}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Notes</h3>
          <button onClick={() => setShowAddNote(true)} style={{ background: "var(--surface-muted)", color: "var(--text-label)", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Add Note
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Scope-specific notes like change orders, delays, or permit status</p>
        {showAddNote && (
          <div style={{ marginBottom: 16, padding: 14, background: "var(--surface-alt)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Type your note..."
              style={{ ...iS, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={addNote} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Save Note</button>
              <button onClick={() => { setShowAddNote(false); setNoteText(""); }} style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
        {notes.length === 0 && !showAddNote ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--surface-alt)", borderRadius: 12 }}>No notes yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.map(n => (
              <div key={n.id} style={{ padding: 14, background: "var(--surface-alt)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>{n.date}</p>
                    <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.text}</p>
                  </div>
                  <button onClick={() => setDeletingNoteId(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex", alignItems: "center" }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 28, width: 480, boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>Edit Rehab Item</h2>
              <button onClick={() => setShowEdit(false)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color="var(--text-secondary)" /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ position: "relative" }}>
                <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Category *</label>
                <input value={editForm.category} onChange={e => { setEditForm(f => ({ ...f, category: e.target.value, canonicalCategory: null })); setCatFocus(true); }}
                  onFocus={() => setCatFocus(true)} onBlur={() => setTimeout(() => setCatFocus(false), 150)} style={iS} />
                {editForm.canonicalCategory && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, fontWeight: 600, color: "#15803d" }}><CheckCircle size={11} /> Standard category</span>
                )}
                {catFocus && (() => {
                  const q = editForm.category.toLowerCase().trim();
                  const canonMatches = REHAB_CATEGORIES.filter(c => !q || c.label.toLowerCase().includes(q));
                  const customMatches = allCategories.custom.filter(c => !q || c.toLowerCase().includes(q));
                  const exactCanon = REHAB_CATEGORIES.some(c => c.label.toLowerCase() === q);
                  const exactCustom = allCategories.custom.some(c => c.toLowerCase() === q);
                  const showNew = q && !exactCanon && !exactCustom;
                  const grouped = {};
                  canonMatches.forEach(c => { if (!grouped[c.group]) grouped[c.group] = []; grouped[c.group].push(c); });
                  const groupKeys = REHAB_CATEGORY_GROUPS.filter(g => grouped[g] && grouped[g].length > 0);
                  if (groupKeys.length === 0 && customMatches.length === 0 && !showNew) return null;
                  return (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 200, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
                      {groupKeys.map(g => (
                        <div key={g}>
                          <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" }}>{g}</div>
                          {grouped[g].map(c => (
                            <button key={c.slug} onMouseDown={() => { setEditForm(f => ({ ...f, category: c.label, canonicalCategory: c.slug })); setCatFocus(false); }}
                              style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid #f8fafc", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                              <Wrench size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                              <span>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                      {customMatches.length > 0 && (
                        <div>
                          <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--surface-alt)" }}>Your Custom</div>
                          {customMatches.slice(0, 6).map(c => (
                            <button key={c} onMouseDown={() => { setEditForm(f => ({ ...f, category: c, canonicalCategory: null })); setCatFocus(false); }}
                              style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", borderBottom: "1px solid #f8fafc", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                              <Wrench size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                              <span>{c}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Budget *</label>
                  <input value={editForm.budgeted} onChange={e => setEditForm(f => ({ ...f, budgeted: e.target.value }))} type="number" style={iS} />
                </div>
                <div>
                  <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Spent</label>
                  <input value={editForm.spent} onChange={e => setEditForm(f => ({ ...f, spent: e.target.value }))} type="number" style={iS} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={iS}>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowEdit(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveEdit} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete note confirm */}
      {deletingNoteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 28, width: 400, boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Delete note?</h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeletingNoteId(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteNote(deletingNoteId)} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------
// TENANT DETAIL
// ---------------------------------------------
function TenantDetail({ tenant, onBack, backLabel, onTenantUpdated, onSelectTenant }) {
  const { showToast } = useToast();
  const property = PROPERTIES.find(p => p.id === tenant.propertyId);
  const [activeTab, setActiveTab] = useState("overview");
  // Payments: read from existing transactions (rent income tied to this tenant)
  const [txVersion, setTxVersion] = useState(0);
  const payments = useMemo(() => TRANSACTIONS.filter(t => t.tenantId === tenant.id && t.type === "income" && t.category === "Rent Income").sort((a, b) => b.date.localeCompare(a.date)), [tenant.id, txVersion]);
  const [documents, setDocuments] = useState(TENANT_DOCUMENTS.filter(d => d.tenantId === tenant.id));
  // Notes: read from RENTAL_NOTES filtered by tenantId
  const [noteVersion, setNoteVersion] = useState(0);
  const notes = useMemo(() => RENTAL_NOTES.filter(n => n.tenantId === tenant.id).sort((a, b) => b.date.localeCompare(a.date)), [tenant.id, noteVersion]);
  const [requests, setRequests] = useState(MAINTENANCE_REQUESTS.filter(r => r.tenantId === tenant.id));

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});
  const sef = k => e => setEditForm(f => ({ ...f, [k]: e.target.value }));

  // Close lease modal
  const [showClose, setShowClose] = useState(false);
  const [closeForm, setCloseForm] = useState({ moveOutDate: new Date().toISOString().split("T")[0], moveOutReason: "Lease ended" });

  // Record payment modal (creates a real transaction)
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [payForm, setPayForm] = useState({ date: new Date().toISOString().split("T")[0], amount: String(tenant.rent || ""), description: "" });
  const spf = k => e => setPayForm(f => ({ ...f, [k]: e.target.value }));

  // Add note modal
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Add maintenance modal
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [maintForm, setMaintForm] = useState({ title: "", description: "", priority: "medium" });
  const smf = k => e => setMaintForm(f => ({ ...f, [k]: e.target.value }));

  const openEdit = () => {
    setEditForm({
      name: tenant.name || "", phone: tenant.phone || "", email: tenant.email || "",
      rent: String(tenant.rent || ""), securityDeposit: String(tenant.securityDeposit || ""),
      leaseStart: tenant.leaseStart || "", leaseEnd: tenant.leaseEnd || "",
      unit: tenant.unit || "", status: tenant.status,
    });
    setShowEdit(true);
  };

  const handleSaveEdit = () => {
    const updates = {
      name: editForm.name, phone: editForm.phone || null, email: editForm.email || null,
      rent: parseFloat(editForm.rent) || 0, securityDeposit: parseFloat(editForm.securityDeposit) || null,
      leaseStart: editForm.leaseStart || null, leaseEnd: editForm.leaseEnd || null,
      unit: editForm.unit, status: editForm.status,
    };
    onTenantUpdated && onTenantUpdated(tenant.id, updates);
    setShowEdit(false);
    showToast("Tenant updated");
  };

  const handleCloseLease = () => {
    onTenantUpdated && onTenantUpdated(tenant.id, { status: "past", moveOutDate: closeForm.moveOutDate || new Date().toISOString().split("T")[0], moveOutReason: closeForm.moveOutReason });
    setShowClose(false);
    showToast("Lease closed");
    onBack && onBack();
  };

  const handleAddPayment = () => {
    const amt = parseFloat(payForm.amount) || 0;
    const desc = payForm.description || `Rent payment - ${tenant.name}`;
    const txn = { id: newId(), date: payForm.date, propertyId: tenant.propertyId, tenantId: tenant.id, category: "Rent Income", description: desc, amount: amt, type: "income", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
    TRANSACTIONS.unshift(txn);
    setTxVersion(v => v + 1);
    setShowAddPayment(false);
    setPayForm({ date: new Date().toISOString().split("T")[0], amount: String(tenant.rent || ""), description: "" });
    showToast("Payment recorded as transaction");
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const n = { id: newId(), propertyId: tenant.propertyId, tenantId: tenant.id, date: new Date().toISOString().split("T")[0], text: noteText.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
    RENTAL_NOTES.push(n);
    setNoteVersion(v => v + 1);
    setNoteText("");
    setShowAddNote(false);
    showToast("Note added");
  };

  const handleDeleteNote = (id) => {
    const idx = RENTAL_NOTES.findIndex(n => n.id === id);
    if (idx !== -1) RENTAL_NOTES.splice(idx, 1);
    setNoteVersion(v => v + 1);
    showToast("Note deleted");
  };

  const handleAddMaint = () => {
    if (!maintForm.title.trim()) return;
    const r = { id: newId(), tenantId: tenant.id, propertyId: tenant.propertyId, title: maintForm.title, description: maintForm.description, priority: maintForm.priority, status: "open", createdAt: new Date().toISOString(), scheduledDate: null, resolvedDate: null, cost: null, vendor: null };
    MAINTENANCE_REQUESTS.push(r);
    setRequests(prev => [r, ...prev]);
    setMaintForm({ title: "", description: "", priority: "medium" });
    setShowAddMaint(false);
    showToast("Maintenance request created");
  };

  const handleResolveMaint = (id) => {
    const idx = MAINTENANCE_REQUESTS.findIndex(r => r.id === id);
    if (idx !== -1) Object.assign(MAINTENANCE_REQUESTS[idx], { status: "resolved", resolvedDate: new Date().toISOString().split("T")[0] });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "resolved", resolvedDate: new Date().toISOString().split("T")[0] } : r));
    showToast("Marked as resolved");
  };

  const getDaysLeft = (leaseEnd) => {
    if (!leaseEnd) return null;
    const d = Math.ceil((new Date(leaseEnd) - new Date()) / 86400000);
    return d > 0 ? d : 0;
  };
  const daysLeft = getDaysLeft(tenant.leaseEnd);
  const isActive = tenant.status === "active-lease" || tenant.status === "month-to-month";
  const leaseStatusStyle = { "active-lease": { bg: "var(--success-badge)", text: "#15803d", label: "Active Lease" }, "month-to-month": { bg: "var(--warning-bg)", text: "var(--warning-text)", label: "Month-to-Month" }, "vacant": { bg: "var(--danger-badge)", text: "#b91c1c", label: "Vacant" }, "past": { bg: "var(--surface-muted)", text: "var(--text-secondary)", label: "Past Tenant" } };
  const s = leaseStatusStyle[tenant.status] || leaseStatusStyle["vacant"];

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const paymentCount = payments.length;

  const openRequests = requests.filter(r => r.status === "open" || r.status === "scheduled").length;
  const resolvedRequests = requests.filter(r => r.status === "resolved").length;

  const tabs = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "payments", label: "Payments", icon: DollarSign },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "maintenance", label: "Maintenance", icon: Wrench },
    { id: "notes", label: "Notes", icon: MessageSquare },
  ];

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-blue)", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 14 }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> {backLabel || "Back to Tenants"}
        </button>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 800 }}>
            {tenant.name?.charAt(0) || "?"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700 }}>{tenant.name}</h1>
              <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700 }}>{s.label}</span>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
              {property?.name || "Unknown Property"} &middot; {tenant.unit}
              {tenant.rent ? ` · ${fmt(tenant.rent)}/mo` : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isActive && (
            <button onClick={() => { setCloseForm({ moveOutDate: new Date().toISOString().split("T")[0], moveOutReason: "Lease ended" }); setShowClose(true); }} style={{ background: "var(--warning-btn-bg)", border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#9a3412", fontSize: 13, fontWeight: 600 }}>
              <LogOut size={14} /> Close Lease
            </button>
          )}
          <button onClick={openEdit} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--text-label)", fontSize: 13, fontWeight: 600 }}>
            <Pencil size={14} /> Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 24, border: "1px solid var(--border)" }}>
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
              <t.icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Contact Info */}
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Contact Information</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {tenant.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "var(--info-tint)", borderRadius: 8, padding: 8 }}><Phone size={14} color="var(--c-blue)" /></div>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Phone</p>
                    <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>{tenant.phone}</p>
                  </div>
                </div>
              )}
              {tenant.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "var(--success-tint)", borderRadius: 8, padding: 8 }}><Mail size={14} color="var(--c-green)" /></div>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Email</p>
                    <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>{tenant.email}</p>
                  </div>
                </div>
              )}
              {tenant.securityDeposit && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "var(--purple-tint)", borderRadius: 8, padding: 8 }}><Shield size={14} color="var(--c-purple)" /></div>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Security Deposit</p>
                    <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>{fmt(tenant.securityDeposit)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lease Info */}
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Lease Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Lease Period</span>
                <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{tenant.leaseStart || "-"} to {tenant.leaseEnd || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Monthly Rent</span>
                <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>{fmt(tenant.rent)}</span>
              </div>
              {daysLeft !== null && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Days Until Expiry</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: daysLeft <= 90 ? "#9a3412" : "#15803d" }}>
                    {daysLeft <= 90 ? `(!) ${daysLeft} days` : `${daysLeft} days`}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Last Payment</span>
                <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{tenant.lastPayment || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Property</span>
                <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{property?.name || "-"}</span>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              { label: "Total Paid", value: fmt(totalPaid), color: "var(--c-green)", icon: DollarSign, tip: "Sum of all rent transactions recorded for this tenant" },
              { label: "Payments", value: paymentCount, color: "var(--c-blue)", icon: CheckCircle, tip: `${paymentCount} rent payment${paymentCount !== 1 ? "s" : ""} recorded as transactions` },
              { label: "Open Requests", value: openRequests, color: openRequests > 0 ? "#e95e00" : "var(--c-green)", icon: Wrench, tip: "Active or scheduled maintenance requests" },
              { label: "Documents", value: documents.length, color: "var(--c-blue)", icon: FileText, tip: "Total tenant documents on file" },
            ].map((m, i) => (
              <div key={i} style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</p>
                      <InfoTip text={m.tip} />
                    </div>
                    <p style={{ color: m.color, fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
                  </div>
                  <div style={{ background: colorWithAlpha(m.color, 0.1), borderRadius: 10, padding: 10 }}><m.icon size={20} color={m.color} /></div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div style={{ gridColumn: "1 / -1", background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Recent Activity</h3>
            {[...payments.slice(0, 3).map(p => ({ type: "payment", date: p.date, text: `Payment: ${fmt(p.amount)} — ${p.description}`, color: "var(--c-green)", icon: DollarSign })),
              ...requests.filter(r => r.status !== "resolved").map(r => ({ type: "maintenance", date: r.createdAt.split("T")[0], text: `Maintenance: ${r.title}`, color: "#e95e00", icon: Wrench })),
              ...notes.slice(0, 2).map(n => ({ type: "note", date: n.date, text: `Note: ${n.text.substring(0, 80)}${n.text.length > 80 ? "..." : ""}`, color: "var(--c-blue)", icon: MessageSquare })),
            ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}>
                <div style={{ background: colorWithAlpha(item.color, 0.1), borderRadius: 8, padding: 8 }}><item.icon size={14} color={item.color} /></div>
                <p style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{item.text}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.date}</p>
              </div>
            ))}
            {payments.length === 0 && requests.length === 0 && notes.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No activity recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {activeTab === "payments" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Payment History</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{payments.length} payments recorded &middot; {fmt(totalPaid)} total</p>
            </div>
            <button onClick={() => setShowAddPayment(true)} style={{ background: "var(--c-green)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Record Payment
            </button>
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)" }}>
                  {["Date", "Amount", "Description", "Category"].map(h => (
                    <th key={h} style={{ padding: "14px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{p.date}</td>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: "var(--c-green)" }}>{fmt(p.amount)}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{p.description}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ background: "var(--success-badge)", color: "#15803d", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{p.category}</span>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No rent payments recorded yet. Use "Record Payment" to log rent as a transaction.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {activeTab === "documents" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Documents</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Lease agreements, applications, addenda, and tenant files</p>
            </div>
            <label style={{ background: "var(--c-blue)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <UploadCloud size={14} /> Upload
              <input type="file" style={{ display: "none" }} onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const doc = { id: newId(), tenantId: tenant.id, name: file.name, type: "other", mimeType: file.type, size: (file.size / 1024).toFixed(0) + " KB", date: new Date().toISOString().split("T")[0], url: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
                TENANT_DOCUMENTS.push(doc);
                setDocuments(prev => [...prev, doc]);
                showToast("Document uploaded");
                e.target.value = "";
              }} />
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {documents.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ background: "var(--info-tint)", borderRadius: 10, padding: 10 }}><FileText size={18} color="var(--c-blue)" /></div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.type} &middot; {d.size} &middot; {d.date}</p>
                </div>
                <button onClick={() => { const idx = TENANT_DOCUMENTS.findIndex(td => td.id === d.id); if (idx !== -1) TENANT_DOCUMENTS.splice(idx, 1); setDocuments(prev => prev.filter(td => td.id !== d.id)); showToast("Document removed"); }} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {documents.length === 0 && (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                No documents on file. Upload lease agreements, applications, or addenda.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MAINTENANCE TAB ── */}
      {activeTab === "maintenance" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Maintenance Requests</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{openRequests} open &middot; {resolvedRequests} resolved</p>
            </div>
            <button onClick={() => setShowAddMaint(true)} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> New Request
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => {
              const prioStyle = { high: { bg: "var(--danger-badge)", text: "#b91c1c" }, medium: { bg: "var(--warning-bg)", text: "#9a3412" }, low: { bg: "var(--surface-muted)", text: "var(--text-secondary)" } };
              const statusStyle = { open: { bg: "var(--danger-badge)", text: "var(--c-red)" }, scheduled: { bg: "var(--info-tint)", text: "var(--c-blue)" }, resolved: { bg: "var(--success-badge)", text: "var(--c-green)" } };
              const ps = prioStyle[r.priority] || prioStyle.medium;
              const ss = statusStyle[r.status] || statusStyle.open;
              return (
                <div key={r.id} style={{ background: "var(--surface)", borderRadius: 12, padding: 20, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{r.title}</p>
                        <span style={{ background: ps.bg, color: ps.text, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{r.priority}</span>
                        <span style={{ background: ss.bg, color: ss.text, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{r.status}</span>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.description}</p>
                    </div>
                    {r.status !== "resolved" && (
                      <button onClick={() => handleResolveMaint(r.id)} style={{ background: "var(--success-badge)", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#15803d", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                        <CheckCircle size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> Resolve
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
                    <span>Created: {r.createdAt.split("T")[0]}</span>
                    {r.scheduledDate && <span>Scheduled: {r.scheduledDate}</span>}
                    {r.resolvedDate && <span>Resolved: {r.resolvedDate}</span>}
                    {r.vendor && <span>Vendor: {r.vendor}</span>}
                    {r.cost && <span>Cost: {fmt(r.cost)}</span>}
                  </div>
                </div>
              );
            })}
            {requests.length === 0 && (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                No maintenance requests for this tenant.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NOTES TAB ── */}
      {activeTab === "notes" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Notes</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Private notes about this tenant</p>
            </div>
            <button onClick={() => setShowAddNote(true)} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Add Note
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notes.map(n => (
              <div key={n.id} style={{ display: "flex", gap: 14, padding: "16px 20px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ background: "#eef2ff", borderRadius: 10, padding: 10, height: "fit-content" }}><MessageSquare size={16} color="#6366f1" /></div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{n.text}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{n.date}</p>
                </div>
                <button onClick={() => handleDeleteNote(n.id)} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", height: "fit-content" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {notes.length === 0 && (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                No notes for this tenant. Notes added here also appear in the unified Notes hub.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Edit Tenant Modal */}
      {showEdit && (
        <Modal title="Edit Tenant" onClose={() => setShowEdit(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Name</label>
              <input value={editForm.name} onChange={sef("name")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Unit</label>
              <input value={editForm.unit} onChange={sef("unit")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Status</label>
              <select value={editForm.status} onChange={sef("status")} style={iS}>
                <option value="active-lease">Active Lease</option>
                <option value="month-to-month">Month-to-Month</option>
                <option value="vacant">Vacant</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Monthly Rent</label>
              <input type="number" value={editForm.rent} onChange={sef("rent")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Security Deposit</label>
              <input type="number" value={editForm.securityDeposit} onChange={sef("securityDeposit")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Phone</label>
              <input value={editForm.phone} onChange={sef("phone")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Email</label>
              <input value={editForm.email} onChange={sef("email")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Lease Start</label>
              <input type="date" value={editForm.leaseStart} onChange={sef("leaseStart")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Lease End</label>
              <input type="date" value={editForm.leaseEnd} onChange={sef("leaseEnd")} style={iS} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowEdit(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveEdit} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-blue)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Save Changes</button>
          </div>
        </Modal>
      )}

      {/* Close Lease Modal */}
      {showClose && (
        <Modal title="Close Lease" onClose={() => setShowClose(false)} width={480}>
          <div style={{ padding: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--warning-bg)", borderRadius: 12, border: "1px solid #fdba74", marginBottom: 20 }}>
              <AlertTriangle size={20} color="#9a3412" />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#9a3412" }}>This will end the lease for <strong>{tenant.name}</strong></p>
                <p style={{ fontSize: 12, color: "#9a3412", marginTop: 2 }}>{property?.name} &middot; {tenant.unit} &middot; {fmt(tenant.rent)}/mo</p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Move-Out Date</label>
                <input type="date" value={closeForm.moveOutDate} onChange={e => setCloseForm(f => ({ ...f, moveOutDate: e.target.value }))} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Reason</label>
                <select value={closeForm.moveOutReason} onChange={e => setCloseForm(f => ({ ...f, moveOutReason: e.target.value }))} style={iS}>
                  <option>Lease ended</option><option>Lease not renewed</option><option>Relocated for work</option><option>Purchased own home</option><option>Lease ended, rent increase</option><option>Eviction</option><option>Mutual agreement</option><option>Other</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowClose(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCloseLease} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Close Lease</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <Modal title="Record Rent Payment" onClose={() => setShowAddPayment(false)} width={480}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>This creates a rent income transaction on {property?.name || "the property"}.</p>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Date</label>
                <input type="date" value={payForm.date} onChange={spf("date")} style={iS} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Amount</label>
                <input type="number" value={payForm.amount} onChange={spf("amount")} style={iS} />
              </div>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Description <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
              <input value={payForm.description} onChange={spf("description")} placeholder={`Rent payment - ${tenant.name}`} style={iS} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowAddPayment(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAddPayment} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-green)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Record Payment</button>
          </div>
        </Modal>
      )}

      {/* Add Note Modal */}
      {showAddNote && (
        <Modal title="Add Note" onClose={() => setShowAddNote(false)} width={520}>
          <div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write a private note about this tenant..." rows={4} style={{ ...iS, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => setShowAddNote(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAddNote} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#6366f1", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Add Note</button>
          </div>
        </Modal>
      )}

      {/* Add Maintenance Modal */}
      {showAddMaint && (
        <Modal title="New Maintenance Request" onClose={() => setShowAddMaint(false)} width={520}>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Title</label>
              <input value={maintForm.title} onChange={smf("title")} placeholder="e.g., Leaky faucet in bathroom" style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Description</label>
              <textarea value={maintForm.description} onChange={smf("description")} placeholder="Details about the issue..." rows={3} style={{ ...iS, resize: "vertical" }} />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Priority</label>
              <select value={maintForm.priority} onChange={smf("priority")} style={iS}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowAddMaint(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAddMaint} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Create Request</button>
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
  const [search, setSearch] = useState("");
  const [linkedFilter, setLinkedFilter] = useState("all"); // "all" | property name | deal name
  const emptyTrip = { date: "", description: "", from: "Home", to: "", miles: "", purpose: "Rental", businessPct: "100", linkedTo: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: MOCK_USER.id };
  const [form, setForm] = useState(emptyTrip);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const openAdd = () => { setEditId(null); setForm(emptyTrip); setShowModal(true); };
  const openEdit = t => {
    setEditId(t.id);
    setForm({ date: t.date, description: t.description, from: t.from, to: t.to, miles: String(t.miles), purpose: t.purpose, businessPct: String(t.businessPct), linkedTo: t.linkedTo || "", createdAt: t.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), userId: t.userId || MOCK_USER.id });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.miles || !form.to) return;
    const built = { date: form.date || new Date().toISOString().split("T")[0], description: form.description || form.to, from: form.from, to: form.to, miles: parseFloat(form.miles) || 0, purpose: form.purpose, businessPct: parseFloat(form.businessPct) || 100, linkedTo: form.linkedTo || "" };
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
  const purposeColors = { Deal: "#e95e00", Rental: "var(--c-blue)", Business: "var(--c-purple)" };

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
    (purposeFilter === "all" || t.purpose === purposeFilter) &&
    matchesMileageDate(t) &&
    (linkedFilter === "all" || (t.linkedTo || "") === linkedFilter) &&
    (!search || t.description.toLowerCase().includes(search.toLowerCase()) || t.from.toLowerCase().includes(search.toLowerCase()) || t.to.toLowerCase().includes(search.toLowerCase()))
  );

  // Get unique linked properties/deals for filter dropdown
  const linkedOptions = [...new Set(tripData.map(t => t.linkedTo).filter(Boolean))].sort();

  const totalMiles = filteredTrips.reduce((s, t) => s + t.miles, 0);
  const businessMiles = filteredTrips.filter(t => t.businessPct === 100).reduce((s, t) => s + t.miles, 0);
  const deduction = filteredTrips.reduce((s, t) => s + t.miles * IRS_RATE * t.businessPct / 100, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Mileage Tracker</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Log business trips · IRS rate: ${IRS_RATE}/mile (${TAX_CONFIG.mileageRateYear})</p>
        </div>
        <button onClick={openAdd} style={{ background: "var(--c-blue)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Log Trip
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Miles", value: totalMiles.toFixed(1), sub: dateFilter === "thisYear" ? "This year" : dateFilter === "thisMonth" ? "This month" : dateFilter === "lastMonth" ? "Last month" : "All time", color: "var(--c-blue)", icon: Car, tip: "Sum of all miles logged for the selected time period and purpose filter." },
          { label: "Business Miles", value: businessMiles.toFixed(1), sub: "100% deductible trips", color: "var(--c-green)", icon: Route, tip: "Miles from trips marked as 100% business deductible." },
          { label: "Mileage Deduction", value: fmt(deduction), sub: `@ $${IRS_RATE}/mile IRS rate`, color: "var(--c-purple)", icon: DollarSign, tip: "Total deductible miles × IRS standard mileage rate. Each trip's miles are multiplied by its business-use percentage." },
          { label: "Trips", value: filteredTrips.length, sub: `of ${tripData.length} total logged`, color: "#e95e00", icon: Truck, tip: "Number of trips matching the current filters out of all logged trips." },
        ].map((m, i) => (
          <div key={i} style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</p>
                  {m.tip && <InfoTip text={m.tip} />}
                </div>
                <p style={{ color: "var(--text-primary)", fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.value}</p>
                <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{m.sub}</p>
              </div>
              <div style={{ background: "#1e3a5f", borderRadius: 10, padding: 10 }}>
                <m.icon size={20} color="#e95e00" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Mileage filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {[["all", "All Purposes"], ["Rental", "Rental"], ["Deal", "Deal"], ["Business", "Business"]].map(([val, label]) => {
            const active = purposeFilter === val;
            return (
              <button key={val} onClick={() => setPurposeFilter(val)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "0 12px" }}>
          <Search size={14} color="#94a3b8" />
          <input placeholder="Search trips..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: "none", background: "transparent", fontSize: 13, color: "var(--text-label)", outline: "none", padding: "9px 0", width: 140 }} />
        </div>
        {linkedOptions.length > 0 && (
          <select value={linkedFilter} onChange={e => setLinkedFilter(e.target.value)} style={{ ...iS, width: "auto", minWidth: 160, fontSize: 13, padding: "9px 12px" }}>
            <option value="all">All Properties / Deals</option>
            {linkedOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ ...iS, width: "auto", minWidth: 140, fontSize: 13, padding: "9px 12px", marginLeft: "auto" }}>
          <option value="thisYear">This Year</option>
          <option value="thisMonth">This Month</option>
          <option value="lastMonth">Last Month</option>
          <option value="all">All Time</option>
        </select>
        {(purposeFilter !== "all" || dateFilter !== "thisYear" || search || linkedFilter !== "all") && (
          <button onClick={() => { setPurposeFilter("all"); setDateFilter("thisYear"); setSearch(""); setLinkedFilter("all"); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>Trip Log</h3>
          <button onClick={() => {
            let csv = "Date,Description,From,To,Miles,Purpose,Business%,Deduction,Linked To\n";
            filteredTrips.forEach(t => {
              csv += `${t.date},"${t.description}","${t.from}","${t.to}",${t.miles},${t.purpose},${t.businessPct},${(t.miles * IRS_RATE * t.businessPct / 100).toFixed(2)},"${t.linkedTo || ""}"\n`;
            });
            csv += `\nTotal,,,,${totalMiles.toFixed(1)},,,${deduction.toFixed(2)},\n`;
            downloadFile(csv, `PropBooks_Mileage_${mThisYear}.csv`, "text/csv");
          }} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", background: "var(--surface)", color: "var(--text-label)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["Date", "Description", "From / To", "Linked To", "Miles", "Purpose", "Deduction", ""].map(h => (
                <th key={h} style={{ padding: "12px 18px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTrips.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "40px 18px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No trips match your filters.</td></tr>
            )}
            {filteredTrips.map((t, i) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                <td style={{ padding: "13px 18px", fontSize: 13, color: "var(--text-secondary)" }}>{t.date}</td>
                <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.description}</td>
                <td style={{ padding: "13px 18px", fontSize: 12, color: "var(--text-label)" }}>{t.from}  /  {t.to.split(",")[0]}</td>
                <td style={{ padding: "13px 18px", fontSize: 12, color: t.linkedTo ? "var(--text-label)" : "var(--text-muted)" }}>{t.linkedTo || "—"}</td>
                <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{t.miles} mi</td>
                <td style={{ padding: "13px 18px" }}>
                  <span style={{ background: (purposeColors[t.purpose] || "#94a3b8") + "20", color: purposeColors[t.purpose] || "var(--text-label)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{t.purpose}</span>
                </td>
                <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 700, color: "#15803d" }}>{fmt(t.miles * IRS_RATE * t.businessPct / 100)}</td>
                <td style={{ padding: "13px 18px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openEdit(t)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteConfirm(t)} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--surface-alt)", borderTop: "2px solid var(--border)" }}>
              <td colSpan={4} style={{ padding: "12px 18px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Totals ({filteredTrips.length} trips)</td>
              <td style={{ padding: "12px 18px", fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{totalMiles.toFixed(1)} mi</td>
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
            { label: "To *", type: "text", key: "to", placeholder: "Destination" },
            { label: "Miles *", type: "number", key: "miles", placeholder: "0.0" },
            { label: "Business Use %", type: "number", key: "businessPct", placeholder: "100" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={sf(f.key)} style={iS} />
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Purpose</label>
            <select value={form.purpose} onChange={sf("purpose")} style={iS}>
              {["Deal","Rental","Business"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Linked Property / Deal</label>
            <select value={form.linkedTo} onChange={sf("linkedTo")} style={iS}>
              <option value="">None</option>
              <optgroup label="Properties">
                {PROPERTIES.map(p => <option key={`p-${p.id}`} value={p.name}>{p.name}</option>)}
              </optgroup>
              <optgroup label="Deals">
                {DEALS.map(f => <option key={`f-${f.id}`} value={f.name}>{f.name}</option>)}
              </optgroup>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSave} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-blue)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{editId ? "Save Changes" : "Save Trip"}</button>
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title="Delete Trip" onClose={() => setDeleteConfirm(null)}>
          <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this trip?</p>
          <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{deleteConfirm.from} → {deleteConfirm.to}</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{deleteConfirm.date} · {deleteConfirm.miles} mi · {deleteConfirm.purpose}</p>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { setTripData(prev => prev.filter(x => x.id !== deleteConfirm.id)); setDeleteConfirm(null); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
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
  const [mode, setMode] = useState("deal");
  const [dealCalc, setDealCalc] = useState({ arv: "", purchase: "", rehab: "", holdMonths: "4", sellingPct: "6" });
  const [rental, setRental] = useState({ price: "", downPct: "20", rate: "7.25", termYears: "30", monthlyRent: "", taxes: "", insurance: "", maintenance: "", vacancy: "5", mgmtPct: "0" });

  // Deal calcs
  const fARV = parseFloat(dealCalc.arv) || 0;
  const fPurchase = parseFloat(dealCalc.purchase) || 0;
  const fRehab = parseFloat(dealCalc.rehab) || 0;
  const fHold = parseFloat(dealCalc.holdMonths) || 0;
  const fSellPct = parseFloat(dealCalc.sellingPct) / 100 || 0.06;
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

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", color: "var(--text-label)", fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Deal Analyzer</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Run the numbers before you make an offer</p>
      </div>
      <div style={{ display: "flex", background: "var(--surface-alt)", borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 28, border: "1px solid var(--border)" }}>
        {[{ id: "deal", label: "Fix & Flip", icon: Hammer }, { id: "rental", label: "Buy & Hold", icon: Building2 }].map(m => {
          const active = mode === m.id;
          return (
            <button key={m.id} onClick={() => setMode(m.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 14, cursor: "pointer", transition: "all 0.15s" }}>
              <m.icon size={15} /> {m.label}
            </button>
          );
        })}
      </div>

      {mode === "deal" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Deal Inputs</h3>
              {(dealCalc.arv || dealCalc.purchase || dealCalc.rehab) && (
                <button onClick={() => setDealCalc({ arv: "", purchase: "", rehab: "", holdMonths: "4", sellingPct: "6" })} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <X size={13} /> Reset
                </button>
              )}
            </div>
            {[
              { label: "After Repair Value (ARV)", key: "arv", placeholder: "310000" },
              { label: "Purchase Price", key: "purchase", placeholder: "195000" },
              { label: "Estimated Rehab", key: "rehab", placeholder: "62000" },
              { label: "Hold Period (months)", key: "holdMonths", placeholder: "4" },
              { label: "Selling Costs (%)", key: "sellingPct", placeholder: "6" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" placeholder={f.placeholder} value={dealCalc[f.key]} onChange={e => setDealCalc({ ...dealCalc, [f.key]: e.target.value })} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: fProfit > 0 ? "var(--success-tint)" : "var(--danger-tint)", borderRadius: 16, padding: 24, border: `1px solid ${fProfit > 0 ? "var(--success-border)" : "var(--danger-border)"}` }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Projected Results</h3>
              {[
                { label: "ARV", value: fmt(fARV), color: "#15803d" },
                { label: "- Purchase Price", value: fmt(fPurchase), color: "#b91c1c" },
                { label: "- Rehab Cost", value: fmt(fRehab), color: "#b91c1c" },
                { label: "- Est. Holding Costs", value: fmt(holdingEst), color: "#b91c1c" },
                { label: "- Selling Costs", value: fmt(sellCosts), color: "#b91c1c" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-label)" }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 4px" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Net Profit</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: fProfit > 0 ? "#15803d" : "#b91c1c" }}>{fProfit >= 0 ? "+" : ""}{fmt(fProfit)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>ROI on cash in</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-blue)" }}>{fROI}%</span>
              </div>
            </div>
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Max Allowable Offer</h3>
              {[
                { label: "MAO at 70% Rule", value: fmt(mao70), color: "var(--c-blue)" },
                { label: "MAO at 65% (conservative)", value: fmt(mao65), color: "var(--c-purple)" },
                { label: "Your Offer", value: fPurchase > 0 ? fmt(fPurchase) : "-", color: "var(--text-primary)" },
                { label: "Spread vs. 70% MAO", value: spread !== null ? (spread >= 0 ? `+${fmt(spread)} under` : `${fmt(Math.abs(spread))} over`) : "-", color: spread !== null ? (spread >= 0 ? "#15803d" : "#b91c1c") : "#94a3b8" },
              ].map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 3 ? "1px solid #f8fafc" : "none" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{m.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
            {fARV > 0 && fPurchase > 0 && (
              <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
                <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Quick Checks</h3>
                {(() => {
                  const purchasePctARV = (fPurchase / fARV * 100).toFixed(0);
                  const rehabPctARV = fARV > 0 ? (fRehab / fARV * 100).toFixed(0) : 0;
                  const profitMargin = fARV > 0 ? (fProfit / fARV * 100).toFixed(1) : 0;
                  const checks = [
                    { label: "Purchase / ARV", value: `${purchasePctARV}%`, pass: purchasePctARV <= 70, tip: "Ideally under 70% of ARV" },
                    { label: "Rehab / ARV", value: `${rehabPctARV}%`, pass: rehabPctARV <= 25, tip: "Keep under 25% of ARV" },
                    { label: "Profit Margin", value: `${profitMargin}%`, pass: profitMargin >= 10, tip: "Target 10%+ of ARV" },
                    { label: "ROI", value: `${fROI}%`, pass: parseFloat(fROI) >= 15, tip: "Target 15%+ return on cash" },
                  ];
                  return checks.map((c, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < checks.length - 1 ? "1px solid #f8fafc" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.pass ? "var(--c-green)" : "var(--c-red)" }} />
                        <span style={{ fontSize: 13, color: "var(--text-label)" }}>{c.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.pass ? "#15803d" : "#b91c1c" }}>{c.value}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.tip}</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "rental" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>Property Inputs</h3>
              {(rental.price || rental.monthlyRent) && (
                <button onClick={() => setRental({ price: "", downPct: "20", rate: "7.25", termYears: "30", monthlyRent: "", taxes: "", insurance: "", maintenance: "", vacancy: "5", mgmtPct: "0" })} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <X size={13} /> Reset
                </button>
              )}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Purchase</p>
            {[
              { label: "Purchase Price", key: "price", placeholder: "385000" },
              { label: "Down Payment (%)", key: "downPct", placeholder: "20" },
              { label: "Interest Rate (%)", key: "rate", placeholder: "7.25" },
              { label: "Loan Term (years)", key: "termYears", placeholder: "30" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" placeholder={f.placeholder} value={rental[f.key]} onChange={e => setRental({ ...rental, [f.key]: e.target.value })} style={inputStyle} />
              </div>
            ))}
            <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", margin: "16px 0 10px" }}>Income &amp; Expenses</p>
            {[
              { label: "Monthly Rent", key: "monthlyRent", placeholder: "2500" },
              { label: "Annual Property Taxes", key: "taxes", placeholder: "4200" },
              { label: "Annual Insurance", key: "insurance", placeholder: "1800" },
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
            <div style={{ background: cashFlow > 0 ? "var(--success-tint)" : "var(--danger-tint)", borderRadius: 16, padding: 24, border: `1px solid ${cashFlow > 0 ? "var(--success-border)" : "var(--danger-border)"}` }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Monthly Cash Flow</h3>
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
                  <span style={{ fontSize: 13, color: "var(--text-label)" }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 4px" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Net Cash Flow / mo</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: cashFlow > 0 ? "#15803d" : "#b91c1c" }}>{cashFlow >= 0 ? "+" : ""}{fmt(cashFlow)}</span>
              </div>
            </div>
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
              <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Key Metrics</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Down Payment", value: fmt(rDown), color: "var(--text-primary)" },
                  { label: "Mortgage Payment", value: fmt(mortgage), color: "var(--text-primary)" },
                  { label: "Annual NOI", value: fmt(noi), color: "var(--c-green)" },
                  { label: "Cap Rate", value: `${capRate}%`, color: "var(--c-blue)" },
                  { label: "Cash-on-Cash Return", value: `${cocReturn}%`, color: "var(--c-purple)" },
                  { label: "Gross Rent Multiplier", value: `${grm}x`, color: "#e95e00" },
                ].map((m, i) => (
                  <div key={i} style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "12px 14px" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>{m.label}</p>
                    <p style={{ color: m.color, fontSize: 16, fontWeight: 800 }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
            {rPrice > 0 && rRent > 0 && (
              <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)" }}>
                <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Quick Checks</h3>
                {(() => {
                  const onePercent = rRent >= rPrice * 0.01;
                  const onePctVal = (rRent / rPrice * 100).toFixed(2);
                  const fiftyRule = totalExpenses <= rRent * 0.5;
                  const expPct = rRent > 0 ? ((totalExpenses / rRent) * 100).toFixed(0) : 0;
                  const checks = [
                    { label: "1% Rule", value: `${onePctVal}%`, pass: onePercent, tip: "Monthly rent should be ≥ 1% of purchase price" },
                    { label: "50% Rule", value: `${expPct}% of rent`, pass: fiftyRule, tip: "Total expenses should be ≤ 50% of gross rent" },
                    { label: "Cap Rate", value: `${capRate}%`, pass: parseFloat(capRate) >= 5, tip: "Target 5%+ for rentals" },
                    { label: "Cash-on-Cash", value: `${cocReturn}%`, pass: parseFloat(cocReturn) >= 8, tip: "Target 8%+ return on cash invested" },
                    { label: "DSCR", value: mortgage > 0 ? (noi / (mortgage * 12)).toFixed(2) : "N/A", pass: mortgage > 0 && (noi / (mortgage * 12)) >= 1.25, tip: "Lenders want ≥ 1.25" },
                  ];
                  return checks.map((c, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < checks.length - 1 ? "1px solid #f8fafc" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.pass ? "var(--c-green)" : "var(--c-red)" }} />
                        <span style={{ fontSize: 13, color: "var(--text-label)" }}>{c.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.pass ? "#15803d" : "#b91c1c" }}>{c.value}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.tip}</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------
// @MENTION TEXTAREA COMPONENT
// ---------------------------------------------
function MentionTextarea({ value, onChange, placeholder, mentions, onMentionsChange }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIdx, setMentionStartIdx] = useState(null);
  const [dropdownIdx, setDropdownIdx] = useState(0);
  const textareaRef = useRef(null);

  const filteredMembers = TEAM_MEMBERS.filter(m =>
    mentionQuery === "" || m.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setDropdownIdx(i => Math.min(i + 1, filteredMembers.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setDropdownIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && filteredMembers.length > 0) {
      e.preventDefault();
      insertMention(filteredMembers[dropdownIdx]);
    }
    else if (e.key === "Escape") { setShowDropdown(false); setMentionStartIdx(null); }
  };

  const insertMention = (member) => {
    const before = value.substring(0, mentionStartIdx);
    const after = value.substring(textareaRef.current?.selectionStart || mentionStartIdx);
    const newText = before + "@" + member.name + " " + after;
    onChange(newText);
    const newMentions = [...(mentions || [])];
    if (!newMentions.includes(member.id)) newMentions.push(member.id);
    onMentionsChange(newMentions);
    setShowDropdown(false);
    setMentionStartIdx(null);
    setTimeout(() => {
      const pos = before.length + member.name.length + 2;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    }, 0);
  };

  const handleInput = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    onChange(val);

    // Detect @ trigger
    const textBefore = val.substring(0, pos);
    const atIdx = textBefore.lastIndexOf("@");
    if (atIdx !== -1) {
      const charBefore = atIdx > 0 ? textBefore[atIdx - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || atIdx === 0) {
        const query = textBefore.substring(atIdx + 1);
        if (!query.includes(" ") || query.length < 20) {
          setMentionQuery(query);
          setMentionStartIdx(atIdx);
          setShowDropdown(true);
          setDropdownIdx(0);
          return;
        }
      }
    }
    setShowDropdown(false);
    setMentionStartIdx(null);
  };

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={textareaRef}
        style={{ ...iS, minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
        placeholder={placeholder || "Write a note... Type @ to mention a team member"}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && filteredMembers.length > 0 && (
        <div style={{ position: "absolute", bottom: "100%", left: 0, width: 280, background: "var(--surface)", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.15)", border: "1px solid var(--border)", maxHeight: 200, overflowY: "auto", zIndex: 100, marginBottom: 4 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 12px 4px" }}>Team Members</p>
          {filteredMembers.map((m, i) => (
            <div key={m.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", background: i === dropdownIdx ? "var(--surface-muted)" : "transparent", transition: "background 0.1s" }}
              onMouseEnter={() => setDropdownIdx(i)}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: colorWithAlpha(m.color, 0.1), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: m.color }}>{m.initials}</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.email}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Show mention chips */}
      {mentions && mentions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {mentions.map(mId => {
            const member = TEAM_MEMBERS.find(m => m.id === mId);
            if (!member) return null;
            return (
              <span key={mId} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: member.color + "15", color: member.color, fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 6, border: "1px solid " + member.color + "30" }}>
                @{member.name}
                <button onClick={() => onMentionsChange(mentions.filter(id => id !== mId))} style={{ background: "none", border: "none", cursor: "pointer", color: member.color, padding: 0, display: "flex", alignItems: "center", marginLeft: 2 }}><X size={10} /></button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Render note text with highlighted @mentions
function NoteTextWithMentions({ text }) {
  const parts = text.split(/(@[\w\s]+?)(?=\s|$|,|\.)/g);
  return (
    <p style={{ fontSize: 13, color: "var(--text-label)", lineHeight: 1.6 }}>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const name = part.substring(1).trim();
          const member = TEAM_MEMBERS.find(m => m.name.toLowerCase() === name.toLowerCase());
          if (member) {
            return <span key={i} style={{ background: member.color + "15", color: member.color, fontWeight: 600, padding: "1px 4px", borderRadius: 4 }}>{part}</span>;
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

// ---------------------------------------------
// UNIFIED NOTES HUB
// ---------------------------------------------
function UnifiedNotes({ highlightNoteId, highlightDealNoteId, onBack, onClearHighlight, autoOpenAdd }) {
  const [activeTab, setActiveTab] = useState("all");
  const [propFilter, setPropFilter] = useState("all");
  const [flipFilter, setFlipFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [renderKey, rerender] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [flashId, setFlashId] = useState(highlightNoteId || highlightDealNoteId);
  const [noteForm, setNoteForm] = useState({ category: "general", entityId: "", tenantId: "", text: "", mentions: [] });

  // Auto-open add modal when navigating from quick action
  useEffect(() => {
    if (autoOpenAdd) {
      setEditId(null);
      setNoteForm({ category: "general", entityId: "", tenantId: "", text: "", mentions: [] });
      setShowAdd(true);
    }
  }, [autoOpenAdd]);

  // Flash highlight on mount
  useEffect(() => {
    const hId = highlightNoteId || highlightDealNoteId;
    if (hId) {
      setFlashId(hId);
      if (highlightNoteId) setActiveTab("properties");
      if (highlightDealNoteId) setActiveTab("deals");
      setTimeout(() => {
        const el = document.getElementById("unote-" + hId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      const timer = setTimeout(() => { setFlashId(null); onClearHighlight && onClearHighlight(); }, 2500);
      return () => clearTimeout(timer);
    }
  }, [highlightNoteId, highlightDealNoteId]);

  // Build unified list
  const allNotes = (() => {
    const list = [];
    RENTAL_NOTES.forEach(n => {
      const prop = PROPERTIES.find(p => p.id === n.propertyId);
      if (prop) {
        const ten = n.tenantId ? TENANTS.find(t => t.id === n.tenantId) : null;
        list.push({ ...n, noteType: "property", entityId: n.propertyId, entityName: prop.name, entityColor: prop.color, entityImage: prop.image, tenantName: ten?.name || null, mentions: n.mentions || [] });
      }
    });
    DEAL_NOTES.forEach(n => {
      const deal = DEALS.find(f => f.id === n.dealId);
      if (deal) {
        const rehabCat = (typeof n.rehabItemIdx === "number" && deal.rehabItems && deal.rehabItems[n.rehabItemIdx])
          ? deal.rehabItems[n.rehabItemIdx].category
          : null;
        list.push({ ...n, noteType: "deal", entityId: n.dealId, entityName: deal.name, entityColor: deal.color, entityImage: deal.image, rehabScope: rehabCat, mentions: n.mentions || [] });
      }
    });
    GENERAL_NOTES.forEach(n => {
      list.push({ ...n, noteType: "general", entityId: null, entityName: "General", entityColor: "var(--c-purple)", entityImage: null, mentions: n.mentions || [] });
    });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  })();

  // Filter
  const filtered = allNotes.filter(n => {
    if (activeTab === "properties" && n.noteType !== "property") return false;
    if (activeTab === "deals" && n.noteType !== "deal") return false;
    if (activeTab === "general" && n.noteType !== "general") return false;
    if (activeTab === "properties" && propFilter !== "all" && n.entityId !== parseInt(propFilter)) return false;
    if (activeTab === "deals" && flipFilter !== "all" && n.entityId !== parseInt(flipFilter)) return false;
    if (search && !n.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const clearFilters = () => { setPropFilter("all"); setFlipFilter("all"); setSearch(""); };
  const hasFilters = propFilter !== "all" || flipFilter !== "all" || search;

  // Tab counts
  const propCount = allNotes.filter(n => n.noteType === "property").length;
  const dealCount = allNotes.filter(n => n.noteType === "deal").length;
  const genCount = allNotes.filter(n => n.noteType === "general").length;

  const tabs = [
    { id: "all", label: "All", count: allNotes.length },
    { id: "properties", label: "Properties", count: propCount },
    { id: "deals", label: "Deals", count: dealCount },
    { id: "general", label: "General", count: genCount },
  ];

  // Type badge color
  const typeBadge = (type) => {
    if (type === "property") return { bg: "var(--info-tint)", color: "#2563eb", label: "Property" };
    if (type === "deal") return { bg: "var(--warning-btn-bg)", color: "#c2410c", label: "Deal" };
    return { bg: "var(--purple-tint)", color: "#7c3aed", label: "General" };
  };

  // Save
  const handleSave = () => {
    if (!noteForm.text.trim()) return;
    const now = new Date().toISOString();
    const today = now.split("T")[0];

    if (editId !== null) {
      // Find and update across all arrays
      let idx = RENTAL_NOTES.findIndex(n => n.id === editId);
      if (idx !== -1) { RENTAL_NOTES[idx] = { ...RENTAL_NOTES[idx], text: noteForm.text.trim(), mentions: noteForm.mentions, updatedAt: now }; }
      idx = DEAL_NOTES.findIndex(n => n.id === editId);
      if (idx !== -1) { DEAL_NOTES[idx] = { ...DEAL_NOTES[idx], text: noteForm.text.trim(), mentions: noteForm.mentions, updatedAt: now }; }
      idx = GENERAL_NOTES.findIndex(n => n.id === editId);
      if (idx !== -1) { GENERAL_NOTES[idx] = { ...GENERAL_NOTES[idx], text: noteForm.text.trim(), mentions: noteForm.mentions, updatedAt: now }; }
    } else {
      const base = { id: newId(), date: today, text: noteForm.text.trim(), createdAt: now, updatedAt: now, userId: "usr_001", mentions: noteForm.mentions };
      if (noteForm.category === "property") {
        if (!noteForm.entityId) return;
        RENTAL_NOTES.unshift({ ...base, propertyId: parseInt(noteForm.entityId), tenantId: noteForm.tenantId ? parseInt(noteForm.tenantId) : null });
      } else if (noteForm.category === "deal") {
        if (!noteForm.entityId) return;
        DEAL_NOTES.unshift({ ...base, dealId: parseInt(noteForm.entityId) });
      } else {
        GENERAL_NOTES.unshift(base);
      }
    }
    setNoteForm({ category: "general", entityId: "", tenantId: "", text: "", mentions: [] });
    setEditId(null);
    setShowAdd(false);
    rerender(n => n + 1);
  };

  const handleDelete = (note) => {
    if (note.noteType === "property") {
      const idx = RENTAL_NOTES.findIndex(n => n.id === note.id);
      if (idx !== -1) RENTAL_NOTES.splice(idx, 1);
    } else if (note.noteType === "deal") {
      const idx = DEAL_NOTES.findIndex(n => n.id === note.id);
      if (idx !== -1) DEAL_NOTES.splice(idx, 1);
    } else {
      const idx = GENERAL_NOTES.findIndex(n => n.id === note.id);
      if (idx !== -1) GENERAL_NOTES.splice(idx, 1);
    }
    setDeleteConfirm(null);
    rerender(n => n + 1);
  };

  const openEdit = (note) => {
    setEditId(note.id);
    const cat = note.noteType === "property" ? "property" : note.noteType === "deal" ? "deal" : "general";
    setNoteForm({ category: cat, entityId: note.entityId ? String(note.entityId) : "", tenantId: note.tenantId ? String(note.tenantId) : "", text: note.text, mentions: note.mentions || [] });
    setShowAdd(true);
  };

  const openAdd = () => {
    const cat = activeTab === "properties" ? "property" : activeTab === "deals" ? "deal" : activeTab === "general" ? "general" : "general";
    const defaultEntity = cat === "property" ? (PROPERTIES[0] ? String(PROPERTIES[0].id) : "") : cat === "deal" ? (DEALS[0] ? String(DEALS[0].id) : "") : "";
    setEditId(null);
    setNoteForm({ category: cat, entityId: defaultEntity, tenantId: "", text: "", mentions: [] });
    setShowAdd(true);
  };

  // Group by date
  const grouped = {};
  filtered.forEach(n => {
    const label = new Date(n.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (!grouped[n.date]) grouped[n.date] = { label, notes: [] };
    grouped[n.date].notes.push(n);
  });

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-blue)", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 14 }}>
          <ArrowLeft size={15} /> Back to Dashboard
        </button>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Notes</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>{allNotes.length} note{allNotes.length !== 1 ? "s" : ""} across properties, deals, and general</p>
        </div>
        <button onClick={openAdd} style={{ background: "var(--c-blue)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Add Note
        </button>
      </div>

      {/* Tab pills */}
      <div style={{ display: "flex", gap: 6, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", marginBottom: 16, width: "fit-content" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setPropFilter("all"); setFlipFilter("all"); }}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: activeTab === t.id ? "#e95e00" : "transparent", color: activeTab === t.id ? "#fff" : "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
            {t.label}
            <span style={{ background: activeTab === t.id ? "rgba(255,255,255,0.3)" : "var(--surface-muted)", color: activeTab === t.id ? "#fff" : "var(--text-muted)", fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 6, minWidth: 18, textAlign: "center" }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: hasFilters ? 10 : 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..."
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" }} />
        </div>
        {activeTab === "properties" && (
          <select value={propFilter} onChange={e => setPropFilter(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Properties</option>
            {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {activeTab === "deals" && (
          <select value={flipFilter} onChange={e => setFlipFilter(e.target.value)} style={{ ...iS, width: 200, fontSize: 14, padding: "9px 14px", fontWeight: 600 }}>
            <option value="all">All Deals</option>
            {DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
        {hasFilters && (
          <button onClick={clearFilters} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}><X size={11} /> Clear filters</button>
        )}
      </div>

      {/* Notes grouped by date */}
      {Object.keys(grouped).length === 0 ? (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: 48, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", textAlign: "center", color: "var(--text-muted)" }}>
          <MessageSquare size={32} style={{ margin: "0 auto 12px", display: "block" }} />
          {hasFilters ? (
            <>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No notes match your filters</p>
              <button onClick={clearFilters} style={{ background: "none", border: "none", color: "var(--c-blue)", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No notes yet</p>
              <p style={{ fontSize: 13 }}>Click "Add Note" to start documenting.</p>
            </>
          )}
        </div>
      ) : Object.entries(grouped).map(([dateKey, { label, notes }]) => (
        <div key={dateKey} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>{label}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.map(n => {
              const badge = typeBadge(n.noteType);
              return (
                <div key={n.id} id={"unote-" + n.id}
                  onMouseEnter={e => { if (flashId !== n.id) e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={e => { if (flashId !== n.id) e.currentTarget.style.background = "var(--surface)"; }}
                  style={{ background: flashId === n.id ? "var(--purple-tint)" : "var(--surface)", borderRadius: 16, padding: 18, boxShadow: flashId === n.id ? "0 0 0 2px #8b5cf6" : "0 1px 3px rgba(0,0,0,0.06)", border: flashId === n.id ? "1px solid #8b5cf6" : "1px solid var(--border-subtle)", transition: "all 0.4s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {n.entityImage ? (
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{n.entityImage}</div>
                      ) : (
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: n.entityColor + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <MessageSquare size={12} color={n.entityColor} />
                        </div>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{n.entityName}</span>
                      {n.tenantName && (
                        <span style={{ fontSize: 10, fontWeight: 600, background: "var(--info-tint)", color: "var(--c-blue)", padding: "2px 7px", borderRadius: 5 }}>{n.tenantName}</span>
                      )}
                      {n.rehabScope && (
                        <span style={{ fontSize: 10, fontWeight: 600, background: "var(--warning-btn-bg)", color: "#c2410c", padding: "2px 7px", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <Wrench size={9} /> {n.rehabScope}
                        </span>
                      )}
                      {activeTab === "all" && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color, padding: "2px 7px", borderRadius: 5 }}>{badge.label}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openEdit(n)} style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }} title="Edit"><Pencil size={12} /></button>
                      <button onClick={() => setDeleteConfirm(n)} style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <NoteTextWithMentions text={n.text} />
                  {/* Mention chips */}
                  {n.mentions && n.mentions.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                      {n.mentions.map(mId => {
                        const member = TEAM_MEMBERS.find(m => m.id === mId);
                        if (!member) return null;
                        return (
                          <span key={mId} style={{ display: "inline-flex", alignItems: "center", gap: 3, background: member.color + "12", color: member.color, fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 5 }}>
                            @{member.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add/Edit Note Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>{editId ? "Edit Note" : "Add Note"}</h2>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Category selector */}
              {!editId && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Category *</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[{ id: "general", label: "General", color: "var(--c-purple)" }, { id: "property", label: "Property", color: "var(--c-blue)" }, { id: "deal", label: "Deal", color: "#e95e00" }].map(c => (
                      <button key={c.id} onClick={() => setNoteForm(f => ({ ...f, category: c.id, entityId: c.id === "property" ? (PROPERTIES[0] ? String(PROPERTIES[0].id) : "") : c.id === "deal" ? (DEALS[0] ? String(DEALS[0].id) : "") : "" }))}
                        style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: noteForm.category === c.id ? "2px solid " + c.color : "1.5px solid var(--border)", background: noteForm.category === c.id ? c.color + "10" : "#fff", color: noteForm.category === c.id ? c.color : "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Entity selector (property/deal) */}
              {noteForm.category === "property" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Property *</p>
                    <select style={iS} value={noteForm.entityId} onChange={e => setNoteForm(f => ({ ...f, entityId: e.target.value, tenantId: "" }))} disabled={!!editId}>
                      <option value="">Select property...</option>
                      {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Tenant <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></p>
                    <select style={iS} value={noteForm.tenantId} onChange={e => setNoteForm(f => ({ ...f, tenantId: e.target.value }))} disabled={!noteForm.entityId}>
                      <option value="">No tenant</option>
                      {noteForm.entityId && TENANTS.filter(t => t.propertyId === parseInt(noteForm.entityId) && t.status !== "past" && t.status !== "vacant").map(t => <option key={t.id} value={t.id}>{t.name} — {t.unit}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {noteForm.category === "deal" && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Deal *</p>
                  <select style={iS} value={noteForm.entityId} onChange={e => setNoteForm(f => ({ ...f, entityId: e.target.value }))} disabled={!!editId}>
                    <option value="">Select deal...</option>
                    {DEALS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}
              {/* Note text with @mention */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 5 }}>Note *</p>
                <MentionTextarea
                  value={noteForm.text}
                  onChange={(text) => setNoteForm(f => ({ ...f, text }))}
                  mentions={noteForm.mentions}
                  onMentionsChange={(mentions) => setNoteForm(f => ({ ...f, mentions }))}
                  placeholder="Write a note... Type @ to mention a team member"
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "var(--c-blue)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: (!noteForm.text.trim() || (noteForm.category !== "general" && !noteForm.entityId)) ? 0.5 : 1 }}>{editId ? "Save Changes" : "Add Note"}</button>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, width: 480, padding: 28 }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Delete Note</h2>
            <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this note?</p>
            <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 13, color: "var(--text-label)", lineHeight: 1.5 }}>{deleteConfirm.text.substring(0, 120)}{deleteConfirm.text.length > 120 ? "..." : ""}</p>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------
// GLOBAL SEARCH
// ---------------------------------------------
function GlobalSearch({ onNavigate }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setFocused(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+K to focus
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); setFocused(true); }
      if (e.key === "Escape") { setFocused(false); setQuery(""); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const q = query.toLowerCase().trim();
  const results = useMemo(() => {
    if (!q) return [];
    const r = [];
    const MAX_PER = 4;

    // Properties
    const props = PROPERTIES.filter(p => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || p.type.toLowerCase().includes(q));
    props.slice(0, MAX_PER).forEach(p => r.push({ type: "property", id: p.id, title: p.name, sub: p.address, icon: Building2, color: "#1e3a5f", image: p.image, data: p }));

    // Tenants
    const tenants = TENANTS.filter(t => t.name.toLowerCase().includes(q) || (t.email && t.email.toLowerCase().includes(q)) || (t.phone && t.phone.includes(q)));
    tenants.slice(0, MAX_PER).forEach(t => {
      const prop = PROPERTIES.find(p => p.id === t.propertyId);
      r.push({ type: "tenant", id: t.id, title: t.name, sub: `${prop?.name || ""} · ${t.unit}`, icon: User, color: "var(--c-blue)", data: t });
    });

    // Deals (Flips)
    const deals = DEALS.filter(f => f.name.toLowerCase().includes(q) || f.address.toLowerCase().includes(q) || f.stage.toLowerCase().includes(q));
    deals.slice(0, MAX_PER).forEach(f => r.push({ type: "deal", id: f.id, title: f.name, sub: `${f.stage} · ${f.address.split(",")[1]?.trim() || f.address}`, icon: Hammer, color: "#1e3a5f", image: f.image, data: f }));

    // Transactions
    const txs = TRANSACTIONS.filter(t => {
      const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "";
      return t.description.toLowerCase().includes(q) || propName.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || (t.payee && t.payee.toLowerCase().includes(q));
    });
    txs.slice(0, MAX_PER).forEach(t => {
      const propName = PROPERTIES.find(p => p.id === t.propertyId)?.name || "Unknown";
      r.push({ type: "transaction", id: t.id, title: t.description, sub: `${propName} · ${t.date} · ${fmt(Math.abs(t.amount))}`, icon: ArrowUpDown, color: t.type === "income" ? "var(--c-green)" : "var(--c-red)", data: t });
    });

    // Contractors
    const cons = CONTRACTORS.filter(c => c.name.toLowerCase().includes(q) || c.trade.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)));
    cons.slice(0, MAX_PER).forEach(c => r.push({ type: "contractor", id: c.id, title: c.name, sub: c.trade, icon: UserCheck, color: "var(--c-purple)", data: c }));

    // Rental Notes
    RENTAL_NOTES.forEach(n => {
      if (n.text.toLowerCase().includes(q)) {
        const prop = PROPERTIES.find(p => p.id === n.propertyId);
        r.push({ type: "rental-note", id: n.id, title: n.text.length > 60 ? n.text.slice(0, 60) + "…" : n.text, sub: `${prop?.name || "Property"} · ${n.date}`, icon: MessageSquare, color: "#1e3a5f", data: { ...n, propId: n.propertyId } });
      }
    });

    // Deal Notes
    DEAL_NOTES.forEach(n => {
      if (n.text.toLowerCase().includes(q)) {
        const deal = DEALS.find(f => f.id === n.dealId);
        r.push({ type: "deal-note", id: n.id, title: n.text.length > 60 ? n.text.slice(0, 60) + "…" : n.text, sub: `${deal?.name || "Deal"} · ${n.date}`, icon: MessageSquare, color: "#1e3a5f", data: { ...n, dealId: n.dealId } });
      }
    });

    // Deal Expenses
    DEAL_EXPENSES.filter(e => e.description.toLowerCase().includes(q) || (e.vendor && e.vendor.toLowerCase().includes(q)))
      .slice(0, MAX_PER).forEach(e => {
        const deal = DEALS.find(f => f.id === e.dealId);
        r.push({ type: "deal-expense", id: e.id, title: e.description, sub: `${deal?.name || "Deal"} · ${e.vendor} · ${fmt(e.amount)}`, icon: Receipt, color: "var(--c-red)", data: e });
      });

    return r.slice(0, 12); // Cap total results
  }, [q]);

  // Group results by type for display
  const grouped = useMemo(() => {
    const map = new Map();
    const labels = { property: "Properties", tenant: "Tenants", deal: "Deals", transaction: "Transactions", contractor: "Contractors", "rental-note": "Rental Notes", "deal-note": "Flip Notes", "deal-expense": "Flip Expenses" };
    results.forEach(r => {
      const label = labels[r.type] || r.type;
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    });
    return map;
  }, [results]);

  const handleSelect = (item) => {
    setQuery("");
    setFocused(false);
    if (onNavigate) onNavigate(item);
  };

  const show = focused && q.length > 0;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ background: focused ? "var(--surface)" : "var(--surface-muted)", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, border: focused ? "1px solid var(--border)" : "1px solid transparent", boxShadow: focused ? "0 4px 16px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
        <Search size={14} color="#94a3b8" />
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onFocus={() => setFocused(true)} placeholder="Search everything…" style={{ border: "none", background: "transparent", fontSize: 14, color: "var(--text-primary)", outline: "none", width: 200 }} />
        {!query && <kbd style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px", fontFamily: "inherit" }}>{navigator.platform?.includes("Mac") ? "⌘" : "Ctrl+"}K</kbd>}
        {query && <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}><X size={14} /></button>}
      </div>

      {show && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 420, background: "var(--surface)", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.15)", border: "1px solid var(--border)", maxHeight: 440, overflowY: "auto", zIndex: 999 }}>
          {results.length === 0 ? (
            <div style={{ padding: "28px 20px", textAlign: "center" }}>
              <Search size={28} color="#cbd5e1" style={{ marginBottom: 8 }} />
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No results for "{query}"</p>
              <p style={{ color: "#cbd5e1", fontSize: 12, marginTop: 4 }}>Try searching by name, address, category, or description</p>
            </div>
          ) : (
            <div style={{ padding: "6px 0" }}>
              {[...grouped.entries()].map(([label, items]) => (
                <div key={label}>
                  <p style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                  {items.map(item => (
                    <div key={item.type + "-" + item.id} onClick={() => handleSelect(item)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: item.image ? "#1e3a5f" : (item.color || "#64748b") + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {item.image ? <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{item.image}</span> : <item.icon size={14} color={item.color || "#64748b"} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.sub}</p>
                      </div>
                      <ChevronRight size={14} color="#cbd5e1" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
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
  const { theme, toggleTheme } = useTheme();
  const [activeView, setActiveView] = useState("portfolio");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(user?.plan === "trial");
  const [highlightTxId, setHighlightTxId] = useState(null);
  const [highlightExpId, setHighlightExpId] = useState(null);
  const [highlightTenantId, setHighlightTenantId] = useState(null);
  const [highlightNoteId, setHighlightNoteId] = useState(null);
  const [highlightDealNoteId, setHighlightDealNoteId] = useState(null);
  const [notesAutoAdd, setNotesAutoAdd] = useState(false);
  const [highlightMilestoneKey, setHighlightMilestoneKey] = useState(null);
  const [navSource, setNavSource] = useState(null);
  const [prevNavSource, setPrevNavSource] = useState(null); // preserves navSource during sub-navigation (e.g., PropertyDetail → Transactions → back)
  const [editPropertyId, setEditPropertyId] = useState(null); // triggers edit modal in Properties
  const [prefillTenant, setPrefillTenant] = useState(null);  // { propertyId, unit } for quick-add from Dashboard
  const [propDetailTab, setPropDetailTab] = useState(null);  // initial tab for PropertyDetail
  const [propDetailTenantHighlight, setPropDetailTenantHighlight] = useState(null); // tenant id to highlight in PropertyDetail
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [contractorInitialTab, setContractorInitialTab] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedRehabItem, setSelectedRehabItem] = useState(null); // { dealId, itemIdx }
  const [convertDealData, setConvertDealData] = useState(null); // deal data to pre-fill Add Property for flip-to-rental conversion
  const [dealVersion, setDealVersion] = useState(0); // bump to force re-render of deal-dependent views
  const onDealUpdated = useCallback(() => setDealVersion(v => v + 1), []);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  // Auto-show welcome screen when app is empty
  useEffect(() => {
    if (PROPERTIES.length === 0 && DEALS.length === 0 && activeView === "portfolio") {
      setActiveView("welcome");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectContractor = (contractor) => {
    setSelectedContractor(contractor);
    setNavSource("dealcontractors");
    setActiveView("contractorDetail");
  };

  const handleTenantSelect = (tenant, source) => {
    setSelectedTenant(tenant);
    setNavSource(source || "tenants");
    setActiveView("tenantDetail");
  };

  const handleTenantUpdated = (tenantId, updates) => {
    // Update the tenant in the mock data
    const idx = TENANTS.findIndex(t => t.id === tenantId);
    if (idx !== -1) Object.assign(TENANTS[idx], updates);
    // Update selectedTenant if it's the same one
    if (selectedTenant && selectedTenant.id === tenantId) {
      setSelectedTenant(prev => ({ ...prev, ...updates }));
    }
  };

  const navigateToTransaction = (txId) => {
    setHighlightTxId(txId);
    setNavSource("dashboard");
    setActiveView("transactions");
  };

  const navigateToDealExpense = (expId) => {
    setHighlightExpId(expId);
    setPrevDealNavSource(dealNavSource);
    setNavSource("dealDetail");
    setActiveView("dealexpenses");
  };

  const portfolioNavItem = { id: "portfolio", label: "Portfolio", icon: PieChartIcon };

  const rentalNavItems = [
    { id: "dashboard",    label: "Dashboard",    icon: LayoutDashboard },
    { id: "properties",   label: "Properties",   icon: Building2       },
    { id: "tenants",      label: "Tenants",        icon: Users           },
    { id: "transactions", label: "Transactions",  icon: ArrowUpDown     },
    { id: "analytics",    label: "Analytics",     icon: BarChart3       },
    { id: "reports",      label: "Reports",       icon: FileText        },
  ];

  const dealNavItems = [
    { id: "dealdashboard",   label: "Dashboard",      icon: LayoutDashboard },
    { id: "deals",           label: "Deals",           icon: Hammer          },
    { id: "dealrehab",       label: "Rehab",           icon: Wrench          },
    { id: "dealexpenses",    label: "Expenses",        icon: Receipt         },
    { id: "dealcontractors", label: "Contractors",     icon: Users           },
    { id: "dealmilestones",  label: "Milestones",      icon: Flag            },
    { id: "dealanalytics",   label: "Analytics",       icon: BarChart3       },
    { id: "dealreports",    label: "Reports",         icon: FileText        },
  ];

  // Cross-cutting tools — apply to both rentals and flips
  const toolNavItems = [
    { id: "notes",         label: "Notes",            icon: MessageSquare },
    { id: "dealanalyzer",  label: "Deal Analyzer",    icon: Calculator },
    { id: "mileage",       label: "Mileage Tracker",  icon: Car        },
  ];

  const handlePropertySelect = (p) => {
    setSelectedProperty(p);
    setActiveView("propertyDetail");
  };

  const [dealInitialTab, setDealInitialTab] = useState(null);
  const [dealNavSource, setDealNavSource] = useState(null); // "dealdashboard" | "deals" | "portfolio" | null
  const [prevDealNavSource, setPrevDealNavSource] = useState(null); // preserves dealNavSource during sub-navigation
  const handleDealSelect = (f, tab, source) => {
    setSelectedDeal(f);
    setDealInitialTab(tab || null);
    setDealNavSource(source || null);
    setActiveView("dealDetail");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-alt)", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ width: 240, background: "var(--sidebar-bg)", display: "flex", flexDirection: "column", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 100 }}>
        <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <img src={propbooksLogo} alt="PropBooks" style={{ height: 40, objectFit: "contain" }} />
          </div>
        </div>
        <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
          {/* Portfolio button */}
          {portfolioNavItem && (
            <>
              <button onClick={() => { setActiveView(portfolioNavItem.id); setSelectedProperty(null); setSelectedDeal(null); setHighlightTxId(null); setNavSource(null); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: activeView === portfolioNavItem.id ? "rgba(139,92,246,0.2)" : "transparent", color: activeView === portfolioNavItem.id ? "#c4b5fd" : "#64748b", fontWeight: activeView === portfolioNavItem.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
                onMouseEnter={e => { if (activeView !== portfolioNavItem.id) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (activeView !== portfolioNavItem.id) e.currentTarget.style.background = "transparent"; }}>
                <portfolioNavItem.icon size={17} />
                {portfolioNavItem.label}
                {activeView === portfolioNavItem.id && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
              </button>
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 8px 12px" }} />
            </>
          )}
          <p style={{ color: "var(--text-label)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>Rentals</p>
          {rentalNavItems.map(item => {
            const active = activeView === item.id || (item.id === "properties" && activeView === "propertyDetail");
            return (
              <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedProperty(null); setSelectedDeal(null); setHighlightTxId(null); setNavSource(null); }}
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
          <p style={{ color: "var(--text-label)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>Deals</p>
          {dealNavItems.map(item => {
            const active = activeView === item.id || (item.id === "deals" && activeView === "dealDetail");
            return (
              <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedDeal(null); setSelectedProperty(null); setHighlightTxId(null); setNavSource(null); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: active ? "rgba(233,94,0,0.18)" : "transparent", color: active ? "#fb923c" : "#64748b", fontWeight: active ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <item.icon size={17} />
                {item.label}
                {active && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 8px 12px" }} />
          <p style={{ color: "var(--text-label)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>Tools</p>
          {toolNavItems.map(item => {
            const active = activeView === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedDeal(null); setSelectedProperty(null); setHighlightTxId(null); setNavSource(null); }}
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
          <div style={{ background: "rgba(233,94,0,0.12)", borderRadius: 12, padding: "12px 14px", marginBottom: 12, border: "1px solid rgba(233,94,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Star size={12} color="#f97316" fill="#f97316" />
              <span style={{ color: "#f97316", fontSize: 11, fontWeight: 700 }}>{user?.planLabel || "PRO PLAN"}</span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>{user?.planDescription || "Unlimited properties"}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #e95e00, #041830)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
              {user?.initials || "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "User"}</p>
              <p style={{ color: "var(--text-secondary)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email || ""}</p>
            </div>
            <SettingsIcon size={16} color="#475569" style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => setShowSettings(true)} />
          </div>
        </div>
      </div>
      <div style={{ flex: 1, marginLeft: 240, display: "flex", flexDirection: "column" }}>
        <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border-subtle)", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600 }}>
              {activeView === "propertyDetail" && selectedProperty ? selectedProperty.name :
               activeView === "dealDetail" && selectedDeal ? selectedDeal.name :
               activeView === "tenantDetail" && selectedTenant ? selectedTenant.name :
               activeView === "portfolio" ? "Portfolio" :
               activeView === "dashboard" ? "Dashboard" :
               [...rentalNavItems, ...dealNavItems, ...toolNavItems].find(n => n.id === activeView)?.label || ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <GlobalSearch onNavigate={(item) => {
              if (item.type === "property") { handlePropertySelect(item.data); }
              else if (item.type === "tenant") { handleTenantSelect(item.data, "tenants"); }
              else if (item.type === "deal") { handleDealSelect(item.data, null, "deals"); }
              else if (item.type === "transaction") { setHighlightTxId(item.data.id); setActiveView("transactions"); }
              else if (item.type === "contractor") { setSelectedContractor(item.data); setActiveView("contractorDetail"); }
              else if (item.type === "rental-note") { setHighlightNoteId(item.data.id); setActiveView("notes"); }
              else if (item.type === "deal-note") { setHighlightDealNoteId(item.data.id); setActiveView("notes"); }
              else if (item.type === "deal-expense") { setHighlightExpId(item.data.id); setActiveView("dealexpenses"); }
            }} />
            <button onClick={toggleTheme} title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--hover-surface)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              {theme === "light" ? <Moon size={18} color="var(--text-secondary)" /> : <Sun size={18} color="#f59e0b" />}
            </button>
            <div ref={notifRef} style={{ position: "relative" }}>
              {/* Bell button */}
              {(() => {
                const today = new Date();
                const notifications = [];
                // Expiring leases (within 60 days)
                TENANTS.filter(t => t.status === "active" && t.leaseEnd).forEach(t => {
                  const daysLeft = Math.round((new Date(t.leaseEnd) - today) / 86400000);
                  if (daysLeft <= 60 && daysLeft >= 0) {
                    const prop = PROPERTIES.find(p => p.id === t.propertyId);
                    notifications.push({ id: "lease-" + t.id, type: "warning", icon: "calendar", title: "Lease expiring soon", body: `${t.name} — ${prop?.name || "Unknown"} (${daysLeft}d left)`, action: () => { handleTenantSelect(t, "notifications"); setShowNotifications(false); } });
                  }
                });
                // Stale property values (90+ days)
                PROPERTIES.forEach(p => {
                  if (p.valueUpdatedAt) {
                    const staleDays = Math.round((today - new Date(p.valueUpdatedAt)) / 86400000);
                    if (staleDays >= 90) notifications.push({ id: "stale-" + p.id, type: "info", icon: "refresh", title: "Stale property value", body: `${p.name} — last updated ${staleDays}d ago`, action: () => { handlePropertySelect(p); setShowNotifications(false); } });
                  }
                });
                // Overdue milestones
                DEALS.forEach(deal => {
                  if (!deal.milestones) return;
                  deal.milestones.forEach(ms => {
                    if (!ms.completed && ms.dueDate) {
                      const overdueDays = Math.round((today - new Date(ms.dueDate)) / 86400000);
                      if (overdueDays > 0) notifications.push({ id: "ms-" + deal.id + "-" + ms.id, type: "danger", icon: "flag", title: "Overdue milestone", body: `${ms.title} — ${deal.name} (${overdueDays}d overdue)`, action: () => { handleDealSelect(deal, "milestones", "notifications"); setShowNotifications(false); } });
                    }
                  });
                });
                // Vacant units
                PROPERTIES.forEach(p => {
                  const occupied = TENANTS.filter(t => t.propertyId === p.id && t.status === "active").length;
                  const vacant = p.units - occupied;
                  if (vacant > 0) notifications.push({ id: "vacant-" + p.id, type: "info", icon: "home", title: "Vacant unit", body: `${p.name} — ${vacant} unit${vacant > 1 ? "s" : ""} vacant`, action: () => { handlePropertySelect(p); setShowNotifications(false); } });
                });
                const typeColors = { warning: "#f59e0b", info: "var(--c-blue)", danger: "var(--c-red)" };
                const typeBgs = { warning: "var(--yellow-tint)", info: "var(--info-tint)", danger: "var(--danger-tint)" };
                return (
                  <>
                    <button onClick={() => setShowNotifications(v => !v)} title="Notifications" style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--hover-surface)"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}>
                      <Bell size={20} color={showNotifications ? "var(--c-blue)" : "var(--text-secondary)"} />
                      {notifications.length > 0 && <div style={{ position: "absolute", top: 3, right: 3, width: 8, height: 8, borderRadius: "50%", background: "var(--c-red)", border: "2px solid var(--surface)" }} />}
                    </button>
                    {showNotifications && (
                      <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, background: "var(--surface)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", border: "1px solid var(--border)", zIndex: 9999, overflow: "hidden" }}>
                        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>Notifications</p>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{notifications.length} item{notifications.length !== 1 ? "s" : ""} need attention</p>
                          </div>
                          {notifications.length > 0 && <span style={{ background: "var(--c-red)", color: "#fff", borderRadius: 20, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{notifications.length}</span>}
                        </div>
                        <div style={{ maxHeight: 380, overflowY: "auto" }}>
                          {notifications.length === 0 ? (
                            <div style={{ padding: 32, textAlign: "center" }}>
                              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--success-tint)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                                <CheckCircle size={22} color="var(--c-green)" />
                              </div>
                              <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>All clear!</p>
                              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>No items need your attention right now.</p>
                            </div>
                          ) : notifications.map(n => (
                            <button key={n.id} onClick={n.action} style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 18px", background: "none", border: "none", borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", textAlign: "left" }}
                              onMouseEnter={e => e.currentTarget.style.background = "var(--hover-surface)"}
                              onMouseLeave={e => e.currentTarget.style.background = "none"}>
                              <div style={{ width: 34, height: 34, borderRadius: 9, background: typeBgs[n.type], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                                {n.icon === "calendar" && <CalendarDays size={16} color={typeColors[n.type]} />}
                                {n.icon === "refresh" && <RefreshCw size={16} color={typeColors[n.type]} />}
                                {n.icon === "flag" && <Flag size={16} color={typeColors[n.type]} />}
                                {n.icon === "home" && <Home size={16} color={typeColors[n.type]} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>{n.title}</p>
                                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</p>
                              </div>
                              <ChevronRight size={14} color="var(--text-muted)" style={{ marginTop: 8, flexShrink: 0 }} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div onClick={() => setShowSettings(true)} style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #e95e00, #041830)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{user?.initials || "?"}</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: 32, maxWidth: 1400, width: "100%" }}>
          {activeView === "portfolio" && <PortfolioDashboard onNavigate={(view) => { if (view === "notes-add") { setNotesAutoAdd(true); setActiveView("notes"); } else { setActiveView(view); } }} onSelectProperty={(p, tab) => { setNavSource("portfolio"); setPropDetailTab(tab || null); setPropDetailTenantHighlight(null); handlePropertySelect(p); }} onSelectFlip={(f, tab) => { setNavSource("portfolio"); handleDealSelect(f, tab || null, "portfolio"); }} onNavigateToTx={(txId) => { setHighlightTxId(txId); setNavSource("portfolio"); setActiveView("transactions"); }} onNavigateToDealExpense={(expId) => { setHighlightExpId(expId); setNavSource("portfolio"); setActiveView("dealexpenses"); }} onNavigateToLease={(prop, tenantId) => { setSelectedProperty(prop); setPropDetailTab("tenants"); setPropDetailTenantHighlight(tenantId); setNavSource("portfolio"); setActiveView("propertyDetail"); }} onSelectContractor={(c) => { setSelectedContractor(c); setContractorInitialTab(null); setNavSource("portfolio"); setActiveView("contractorDetail"); }} />}
          {activeView === "dashboard" && <Dashboard onNavigate={setActiveView} onNavigateToTx={navigateToTransaction} onSelectProperty={handlePropertySelect} onNavigateToTenantAdd={(propId, unit) => { setPrefillTenant({ propertyId: propId, unit }); setActiveView("tenants"); }} onNavigateToNote={(noteId) => { setHighlightNoteId(noteId); setNavSource("dashboard"); setActiveView("notes"); }} onNavigateToLease={(prop, tenantId) => { setSelectedProperty(prop); setPropDetailTab("tenants"); setPropDetailTenantHighlight(tenantId); setNavSource("dashboard"); setActiveView("propertyDetail"); }} />}
          {activeView === "properties" && <Properties onSelect={handlePropertySelect} editPropertyId={editPropertyId} onClearEditId={() => setEditPropertyId(null)} convertDealData={convertDealData} onClearConvertFlip={() => setConvertDealData(null)} onGuidedSetup={() => setActiveView("rentalWizard")} />}
          {activeView === "propertyDetail" && selectedProperty && <PropertyDetail key={selectedProperty.id + "-" + (propDetailTab || "overview") + "-" + (propDetailTenantHighlight || "")} property={selectedProperty} onBack={() => { setActiveView(navSource === "dashboard" ? "dashboard" : navSource === "portfolio" ? "portfolio" : "properties"); setPropDetailTab(null); setPropDetailTenantHighlight(null); setPrevNavSource(null); setNavSource(null); }} backLabel={navSource === "dashboard" ? "Back to Dashboard" : navSource === "portfolio" ? "Back to Portfolio" : "Back to Properties"} onEditProperty={(p) => { setEditPropertyId(p.id); setActiveView("properties"); }} onGoToTransactions={() => setActiveView("transactions")} onNavigateToTransaction={(txId) => { if (txId) { setHighlightTxId(txId); } setPrevNavSource(navSource); setNavSource("propertyDetail"); setActiveView("transactions"); }} onNavigateToTenant={(tenantId) => { const t = TENANTS.find(x => x.id === tenantId); if (t) { handleTenantSelect(t, "propertyDetail"); } }} initialTab={propDetailTab} highlightTenantId={propDetailTenantHighlight} onClearHighlightTenant={() => setPropDetailTenantHighlight(null)} />}
          {activeView === "transactions" && <Transactions highlightTxId={highlightTxId} backLabel={navSource === "propertyDetail" ? "Back to Property" : navSource === "portfolio" ? "Back to Portfolio" : "Back to Dashboard"} onBack={navSource === "dashboard" ? () => { setActiveView("dashboard"); setHighlightTxId(null); setNavSource(null); setPrevNavSource(null); } : navSource === "portfolio" ? () => { setActiveView("portfolio"); setHighlightTxId(null); setNavSource(null); setPrevNavSource(null); } : navSource === "propertyDetail" ? () => { setActiveView("propertyDetail"); setHighlightTxId(null); setNavSource(prevNavSource); setPrevNavSource(null); } : null} onClearHighlight={() => setHighlightTxId(null)} />}
          {activeView === "analytics" && <Analytics />}
          {activeView === "notes" && <UnifiedNotes highlightNoteId={highlightNoteId} highlightDealNoteId={highlightDealNoteId} autoOpenAdd={notesAutoAdd} onBack={navSource === "dashboard" ? () => { setActiveView("dashboard"); setHighlightNoteId(null); setNavSource(null); setNotesAutoAdd(false); } : navSource === "dealdashboard" ? () => { setActiveView("dealdashboard"); setHighlightDealNoteId(null); setNavSource(null); setNotesAutoAdd(false); } : null} onClearHighlight={() => { setHighlightNoteId(null); setHighlightDealNoteId(null); setNotesAutoAdd(false); }} />}
          {activeView === "reports" && <Reports />}
          {activeView === "dealdashboard"   && <DealDashboard onSelect={(f, tab) => handleDealSelect(f, tab, "dealdashboard")} onNavigateToNote={(noteId) => { setHighlightDealNoteId(noteId); setNavSource("dealdashboard"); setActiveView("notes"); }} onNavigateToExpense={(expId) => { setHighlightExpId(expId); setNavSource("dealdashboard"); setActiveView("dealexpenses"); }} onNavigateToMilestone={(msKey) => { setHighlightMilestoneKey(msKey); setNavSource("dealdashboard"); setActiveView("dealmilestones"); }} />}
          {activeView === "deals"           && <DealPipeline onSelect={(f, tab) => handleDealSelect(f, tab, "deals")} onGuidedSetup={() => setActiveView("flipWizard")} />}
          {activeView === "dealDetail"      && selectedDeal && <ErrorBoundary key={"eb-" + selectedDeal.id}><DealDetail key={selectedDeal.id + "-" + (dealInitialTab || "overview")} deal={selectedDeal} onBack={() => { setActiveView(dealNavSource || "deals"); setDealNavSource(null); setPrevDealNavSource(null); setDealInitialTab(null); }} backLabel={dealNavSource === "dealdashboard" ? "Back to Dashboard" : dealNavSource === "portfolio" ? "Back to Portfolio" : "Back to Deals"} onNavigateToExpense={navigateToDealExpense} onNavigateToContractor={(con, tab) => { setSelectedContractor(con); setContractorInitialTab(tab || null); setPrevDealNavSource(dealNavSource); setNavSource("dealDetail"); setActiveView("contractorDetail"); }} onNavigateToRehabItem={(idx) => { setSelectedRehabItem({ dealId: selectedDeal.id, itemIdx: idx }); setNavSource("dealDetail"); setPrevDealNavSource(dealNavSource); setActiveView("rehabItemDetail"); }} initialTab={dealInitialTab} onConvertToRental={(flipData) => { setConvertDealData(flipData); setActiveView("properties"); }} onDealUpdated={onDealUpdated} onNavigateToDeal={(f) => handleDealSelect(f, null, dealNavSource || "deals")} /></ErrorBoundary>}
          {activeView === "dealrehab"        && <RehabTracker onSelectRehabItem={(dealId, idx) => { setSelectedRehabItem({ dealId, itemIdx: idx }); setNavSource("dealrehab"); setActiveView("rehabItemDetail"); }} />}
          {activeView === "rehabItemDetail" && selectedRehabItem && (() => {
            const rDeal = DEALS.find(f => f.id === selectedRehabItem.dealId);
            if (!rDeal) return null;
            const backToDeal = navSource === "dealDetail";
            return <RehabItemDetail
              deal={rDeal}
              itemIdx={selectedRehabItem.itemIdx}
              onBack={() => {
                if (backToDeal) {
                  setSelectedRehabItem(null);
                  setActiveView("dealDetail");
                  setDealInitialTab("rehab");
                  setNavSource(null);
                  setDealNavSource(prevDealNavSource);
                  setPrevDealNavSource(null);
                } else {
                  setSelectedRehabItem(null);
                  setActiveView("dealrehab");
                  setNavSource(null);
                }
              }}
              backLabel={backToDeal ? `Back to ${rDeal.name}` : "Back to Rehab Tracker"}
              onNavigateToContractor={(con, tab) => { setSelectedContractor(con); setContractorInitialTab(tab || null); setNavSource("rehabItemDetail"); setActiveView("contractorDetail"); }}
              onNavigateToExpense={(expId) => { setHighlightExpId(expId); setNavSource("rehabItemDetail"); setActiveView("dealexpenses"); }}
            />;
          })()}
          {activeView === "dealexpenses"    && <DealExpenses highlightExpId={highlightExpId} onBack={navSource === "dealDetail" ? () => { setActiveView("dealDetail"); setHighlightExpId(null); setNavSource(null); setDealNavSource(prevDealNavSource); setPrevDealNavSource(null); } : navSource === "dealdashboard" ? () => { setActiveView("dealdashboard"); setHighlightExpId(null); setNavSource(null); } : navSource === "portfolio" ? () => { setActiveView("portfolio"); setHighlightExpId(null); setNavSource(null); } : null} backLabel={navSource === "dealdashboard" ? "Back to Dashboard" : navSource === "portfolio" ? "Back to Portfolio" : "Back to Deal"} onClearHighlight={() => setHighlightExpId(null)} />}
          {activeView === "dealcontractors" && <DealContractors onSelectContractor={handleSelectContractor} />}
          {activeView === "contractorDetail" && selectedContractor && <ContractorDetail contractor={selectedContractor} initialTab={contractorInitialTab} onBack={() => { setSelectedContractor(null); setContractorInitialTab(null); if (navSource === "dealDetail" && selectedDeal) { setActiveView("dealDetail"); setDealInitialTab("contractors"); setNavSource(null); setDealNavSource(prevDealNavSource); setPrevDealNavSource(null); } else if (navSource === "rehabItemDetail" && selectedRehabItem) { setActiveView("rehabItemDetail"); setNavSource("dealDetail"); } else if (navSource === "portfolio") { setActiveView("portfolio"); setNavSource(null); } else { setActiveView("dealcontractors"); } }} />}
          {activeView === "dealmilestones"  && <DealMilestones highlightMilestoneKey={highlightMilestoneKey} onBack={navSource === "dealdashboard" ? () => { setActiveView("dealdashboard"); setHighlightMilestoneKey(null); setNavSource(null); } : null} onClearHighlight={() => setHighlightMilestoneKey(null)} />}
          {activeView === "dealnotes"       && <UnifiedNotes highlightDealNoteId={highlightDealNoteId} onBack={navSource === "dealdashboard" ? () => { setActiveView("dealdashboard"); setHighlightDealNoteId(null); setNavSource(null); } : null} onClearHighlight={() => setHighlightDealNoteId(null)} />}
          {activeView === "dealanalytics"   && <DealAnalytics />}
          {activeView === "dealreports"    && <DealReports />}
          {activeView === "tenants" && <TenantManagement onBack={navSource === "propertyDetail" ? () => { setActiveView("propertyDetail"); setHighlightTenantId(null); setNavSource(prevNavSource); setPrevNavSource(null); } : null} highlightTenantId={highlightTenantId} onClearHighlight={() => setHighlightTenantId(null)} prefillTenant={prefillTenant} onClearPrefill={() => setPrefillTenant(null)} onSelectTenant={(t) => handleTenantSelect(t, "tenants")} />}
          {activeView === "tenantDetail" && selectedTenant && <TenantDetail tenant={selectedTenant} onBack={() => { setSelectedTenant(null); setActiveView(navSource || "tenants"); setNavSource(null); }} backLabel={navSource === "propertyDetail" ? "Back to Property" : "Back to Tenants"} onTenantUpdated={handleTenantUpdated} />}
          {activeView === "mileage" && <MileageTracker />}
          {activeView === "dealanalyzer" && <DealAnalyzer />}
          {activeView === "rentalWizard" && <RentalWizard onComplete={() => setActiveView("properties")} onExit={() => setActiveView("portfolio")} />}
          {activeView === "flipWizard" && <FlipWizard onComplete={() => setActiveView("deals")} onExit={() => setActiveView("portfolio")} />}
          {activeView === "welcome" && <WelcomeScreen onStartRental={() => setActiveView("rentalWizard")} onStartFlip={() => setActiveView("flipWizard")} />}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: "min(880px, 95vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
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
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

function AuthGate() {
  const { user } = useAuth();
  return user ? <AppShell /> : <AuthScreen />;
}
