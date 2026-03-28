import { useState, useMemo } from "react";
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
  CheckSquare, Square, PlusCircle, Receipt, UploadCloud, Trash2, Pencil
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

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const d = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  const m = Math.round(d / 30);
  return m === 1 ? "1 month ago" : `${m} months ago`;
}

const PROPERTIES = [
  { id: 1, name: "Maple Ridge Duplex", address: "2847 Maple Ridge Dr, Austin, TX 78701", type: "Multi-Family", units: 2, purchasePrice: 385000, currentValue: 462000, valueUpdatedAt: "2025-10-01", loanAmount: 308000, loanRate: 3.25, loanTermYears: 30, loanStartDate: "2021-03-15", monthlyRent: 3800, monthlyExpenses: 1640, purchaseDate: "2021-03-15", status: "Occupied", image: "MR", capRate: 7.2, cashOnCash: 9.1, color: "#3b82f6" },
  { id: 2, name: "Lakeview SFR", address: "518 Lakeview Terrace, Denver, CO 80203", type: "Single Family", units: 1, purchasePrice: 520000, currentValue: 598000, valueUpdatedAt: "2025-11-15", loanAmount: 416000, loanRate: 2.875, loanTermYears: 30, loanStartDate: "2020-07-22", monthlyRent: 2950, monthlyExpenses: 1120, purchaseDate: "2020-07-22", status: "Occupied", image: "LV", capRate: 5.6, cashOnCash: 7.4, color: "#10b981" },
  { id: 3, name: "Midtown Condo #4B", address: "1200 Peachtree St NE #4B, Atlanta, GA 30309", type: "Condo", units: 1, purchasePrice: 280000, currentValue: 315000, valueUpdatedAt: "2026-01-20", loanAmount: 224000, loanRate: 3.75, loanTermYears: 30, loanStartDate: "2022-01-10", monthlyRent: 2100, monthlyExpenses: 860, purchaseDate: "2022-01-10", status: "Occupied", image: "MC", capRate: 6.9, cashOnCash: 8.3, color: "#8b5cf6" },
  { id: 4, name: "Riverside Triplex", address: "744 Riverside Blvd, Portland, OR 97201", type: "Multi-Family", units: 3, purchasePrice: 670000, currentValue: 745000, valueUpdatedAt: "2025-08-30", loanAmount: 536000, loanRate: 4.0, loanTermYears: 30, loanStartDate: "2019-11-05", monthlyRent: 5700, monthlyExpenses: 2380, purchaseDate: "2019-11-05", status: "Partial Vacancy", image: "RT", capRate: 8.1, cashOnCash: 10.2, color: "#f59e0b" },
  { id: 5, name: "Sunset Strip Commercial", address: "9220 Sunset Blvd, West Hollywood, CA 90069", type: "Commercial", units: 1, purchasePrice: 1200000, currentValue: 1380000, valueUpdatedAt: "2025-12-05", loanAmount: 900000, loanRate: 4.5, loanTermYears: 25, loanStartDate: "2018-06-30", monthlyRent: 8500, monthlyExpenses: 3200, purchaseDate: "2018-06-30", status: "Occupied", image: "SS", capRate: 7.0, cashOnCash: 6.8, color: "#ef4444" },
];

const TRANSACTIONS = [
  { id: 1, date: "2026-03-20", property: "Maple Ridge Duplex", category: "Rent Income", description: "March rent - Unit A", amount: 1900, type: "income" },
  { id: 2, date: "2026-03-20", property: "Maple Ridge Duplex", category: "Rent Income", description: "March rent - Unit B", amount: 1900, type: "income" },
  { id: 3, date: "2026-03-18", property: "Riverside Triplex", category: "Maintenance", description: "HVAC repair - Unit 2", amount: -420, type: "expense" },
  { id: 4, date: "2026-03-15", property: "Lakeview SFR", category: "Rent Income", description: "March rent", amount: 2950, type: "income" },
  { id: 5, date: "2026-03-12", property: "Midtown Condo #4B", category: "HOA Fees", description: "Monthly HOA", amount: -285, type: "expense" },
  { id: 6, date: "2026-03-10", property: "Sunset Strip Commercial", category: "Rent Income", description: "March commercial rent", amount: 8500, type: "income" },
  { id: 7, date: "2026-03-08", property: "Riverside Triplex", category: "Rent Income", description: "March rent - Units 1,2,3", amount: 5700, type: "income" },
  { id: 8, date: "2026-03-05", property: "Maple Ridge Duplex", category: "Insurance", description: "Q1 property insurance", amount: -1200, type: "expense" },
  { id: 9, date: "2026-03-03", property: "Lakeview SFR", category: "Property Tax", description: "Semi-annual tax payment", amount: -2100, type: "expense" },
  { id: 10, date: "2026-03-01", property: "Midtown Condo #4B", category: "Rent Income", description: "March rent", amount: 2100, type: "income" },
  { id: 11, date: "2026-02-28", property: "Sunset Strip Commercial", category: "Maintenance", description: "Parking lot reseal", amount: -3500, type: "expense" },
  { id: 12, date: "2026-02-20", property: "Riverside Triplex", category: "Mortgage", description: "February mortgage", amount: -2840, type: "expense" },
  { id: 13, date: "2026-02-15", property: "Maple Ridge Duplex", category: "Mortgage", description: "February mortgage", amount: -1620, type: "expense" },
  { id: 14, date: "2026-02-10", property: "Lakeview SFR", category: "Landscaping", description: "Monthly lawn service", amount: -180, type: "expense" },
  { id: 15, date: "2026-02-05", property: "Midtown Condo #4B", category: "Utilities", description: "Common area utilities", amount: -95, type: "expense" },
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

const FLIP_EXPENSES = [
  { id: 1, flipId: 1, date: "2026-03-18", vendor: "Home Depot", category: "Materials/Supplies", description: "Hardwood flooring - 680 sqft", amount: 2890 },
  { id: 2, flipId: 1, date: "2026-03-15", vendor: "ABC Plumbing", category: "Subcontractor", description: "Master bath rough-in", amount: 3200 },
  { id: 3, flipId: 1, date: "2026-03-10", vendor: "Lowe's", category: "Materials/Supplies", description: "Kitchen cabinet hardware + fixtures", amount: 640 },
  { id: 4, flipId: 1, date: "2026-03-04", vendor: "City of Nashville", category: "Permits & Inspections", description: "Renovation permit", amount: 380 },
  { id: 5, flipId: 1, date: "2026-02-28", vendor: "Elite Electric", category: "Subcontractor", description: "Panel upgrade + recessed lighting", amount: 4100 },
  { id: 6, flipId: 1, date: "2026-02-20", vendor: "Lowe's", category: "Materials/Supplies", description: "Kitchen cabinets - shaker style", amount: 5800 },
  { id: 7, flipId: 1, date: "2026-02-14", vendor: "Budget Dumpster", category: "Dump Fees", description: "Demo debris removal", amount: 420 },
  { id: 8, flipId: 2, date: "2026-01-12", vendor: "Sherwin-Williams", category: "Materials/Supplies", description: "Interior/exterior paint + supplies", amount: 1150 },
  { id: 9, flipId: 2, date: "2026-01-08", vendor: "Pro Flooring Co.", category: "Subcontractor", description: "LVP install - 1,100 sqft", amount: 3900 },
  { id: 10, flipId: 2, date: "2025-12-20", vendor: "Home Depot", category: "Appliances", description: "Stainless appliance package", amount: 2400 },
  { id: 11, flipId: 2, date: "2025-12-10", vendor: "Jim's Windows", category: "Subcontractor", description: "Replace 8 windows", amount: 5400 },
  { id: 12, flipId: 2, date: "2025-11-18", vendor: "City of Memphis", category: "Permits & Inspections", description: "Electrical & structural permits", amount: 295 },
  { id: 13, flipId: 4, date: "2025-07-02", vendor: "Summit HVAC", category: "Subcontractor", description: "Full HVAC replacement", amount: 7200 },
  { id: 14, flipId: 4, date: "2025-06-15", vendor: "Habitat Flooring", category: "Materials/Supplies", description: "Engineered hardwood - whole house", amount: 4300 },
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
    { label: "Contract Executed", done: true, date: "2026-01-06" },
    { label: "Inspection Complete", done: true, date: "2026-01-07" },
    { label: "Purchased / Closed", done: true, date: "2026-01-08" },
    { label: "Demo Complete", done: true, date: "2026-01-22" },
    { label: "Rough-In (Plumbing/Electric)", done: true, date: "2026-02-10" },
    { label: "Drywall", done: true, date: "2026-02-24" },
    { label: "Paint", done: false, date: null },
    { label: "Flooring", done: false, date: null },
    { label: "Kitchen & Baths", done: false, date: null },
    { label: "Punch List", done: false, date: null },
    { label: "Listed for Sale", done: false, date: null },
    { label: "Sold / Closed", done: false, date: null },
  ],
  2: DEFAULT_MILESTONES.map((label, i) => ({ label, done: i < 11, date: i < 11 ? "2026-01-15" : null })),
  3: DEFAULT_MILESTONES.slice(0, 3).map((label, i) => ({ label, done: i < 2, date: i < 2 ? "2026-03-12" : null })),
  4: DEFAULT_MILESTONES.map(label => ({ label, done: true, date: "2025-08-29" })),
};

const TENANTS = [
  { id: 1, propertyId: 1, unit: "Unit A", name: "Marcus & Priya Williams", rent: 1900, leaseStart: "2024-02-01", leaseEnd: "2025-01-31", status: "current", daysUntilExpiry: 40, lastPayment: "2026-03-01", phone: "512-555-0143", email: "mwilliams@email.com" },
  { id: 2, propertyId: 1, unit: "Unit B", name: "Jordan Lee", rent: 1900, leaseStart: "2023-08-01", leaseEnd: "2024-07-31", status: "month-to-month", daysUntilExpiry: null, lastPayment: "2026-03-01", phone: "512-555-0287", email: "jlee@email.com" },
  { id: 3, propertyId: 2, unit: "Main", name: "Stephanie & Dan Kowalski", rent: 2950, leaseStart: "2024-06-01", leaseEnd: "2025-05-31", status: "current", daysUntilExpiry: 68, lastPayment: "2026-03-15", phone: "303-555-0194", email: "kowalski@email.com" },
  { id: 4, propertyId: 3, unit: "#4B", name: "Alexis Fontaine", rent: 2100, leaseStart: "2025-01-01", leaseEnd: "2025-12-31", status: "current", daysUntilExpiry: 282, lastPayment: "2026-03-01", phone: "404-555-0362", email: "afontaine@email.com" },
  { id: 5, propertyId: 4, unit: "Unit 1", name: "Ryan & Keisha Thompson", rent: 1950, leaseStart: "2024-09-01", leaseEnd: "2025-08-31", status: "current", daysUntilExpiry: 159, lastPayment: "2026-03-08", phone: "503-555-0218", email: "kthompson@email.com" },
  { id: 6, propertyId: 4, unit: "Unit 2", name: "Vacant", rent: 1875, leaseStart: null, leaseEnd: null, status: "vacant", daysUntilExpiry: null, lastPayment: null, phone: null, email: null },
  { id: 7, propertyId: 4, unit: "Unit 3", name: "Carlos Mendez", rent: 1875, leaseStart: "2025-03-01", leaseEnd: "2026-02-28", status: "month-to-month", daysUntilExpiry: null, lastPayment: "2026-03-08", phone: "503-555-0445", email: "cmendez@email.com" },
  { id: 8, propertyId: 5, unit: "Commercial", name: "Pacific Rim Restaurant Group", rent: 8500, leaseStart: "2023-01-01", leaseEnd: "2027-12-31", status: "current", daysUntilExpiry: 648, lastPayment: "2026-03-10", phone: "310-555-0501", email: "leasing@pacificrimrg.com" },
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

function Dashboard() {
  const totalValue = PROPERTIES.reduce((s, p) => s + p.currentValue, 0);
  const totalEquity = PROPERTIES.reduce((s, p) => s + (p.currentValue - (calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? p.loanAmount ?? 0)), 0);
  const monthlyIncome = PROPERTIES.reduce((s, p) => s + p.monthlyRent, 0);
  const monthlyExpenses = PROPERTIES.reduce((s, p) => s + p.monthlyExpenses, 0);
  const netCashFlow = monthlyIncome - monthlyExpenses;
  const avgCapRate = (PROPERTIES.reduce((s, p) => s + p.capRate, 0) / PROPERTIES.length).toFixed(1);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: "#64748b", fontSize: 15 }}>Welcome back, Brandon — here's your portfolio at a glance.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 28 }}>
        <StatCard icon={Building2} label="Portfolio Value" value={fmtK(totalValue)} sub={`${PROPERTIES.length} properties`} trend="up" trendVal="+4.2%" color="#3b82f6" />
        <StatCard icon={Wallet} label="Total Equity" value={fmtK(totalEquity)} sub="Net of mortgages" trend="up" trendVal="+$12K" color="#10b981" />
        <StatCard icon={DollarSign} label="Monthly Cash Flow" value={fmt(netCashFlow)} sub="Net income" trend="up" trendVal="+$1,200" color="#8b5cf6" />
        <StatCard icon={Percent} label="Avg. Cap Rate" value={`${avgCapRate}%`} sub="Across portfolio" trend="up" trendVal="+0.3%" color="#f59e0b" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 28 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700 }}>Cash Flow - 6 Months</h3>
              <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>Income vs. expenses vs. net</p>
            </div>
            <select style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 12px", fontSize: 13, color: "#475569", background: "#fff", cursor: "pointer" }}>
              <option>Last 6 months</option>
              <option>Last 12 months</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={MONTHLY_CASH_FLOW}>
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
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>By category this month</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={EXPENSE_CATEGORIES} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                {EXPENSE_CATEGORIES.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {EXPENSE_CATEGORIES.slice(0, 4).map((c, i) => (
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
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Total portfolio equity over time</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={EQUITY_GROWTH}>
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
            <button style={{ color: "#3b82f6", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>View all  / </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {TRANSACTIONS.slice(0, 5).map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: t.type === "income" ? "#dcfce7" : "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {t.type === "income" ? <ArrowUp size={16} color="#15803d" /> : <ArrowDown size={16} color="#b91c1c" />}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 1 }}>{t.description}</p>
                    <p style={{ fontSize: 12, color: "#94a3b8" }}>{t.property.split(" ").slice(0, 2).join(" ")} . {t.date}</p>
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

function Properties({ onSelect }) {
  const [propData, setPropData] = useState(PROPERTIES);
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null); // null = add, id = edit
  const emptyP = { name: "", address: "", type: "Single Family", units: "1", purchasePrice: "", currentValue: "", loanAmount: "", loanRate: "", loanTermYears: "30", loanStartDate: "", monthlyRent: "", monthlyExpenses: "", status: "Occupied", purchaseDate: "" };
  const [form, setForm] = useState(emptyP);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const openAdd = () => { setEditId(null); setForm(emptyP); setShowModal(true); };
  const openEdit = (e, p) => {
    e.stopPropagation();
    setEditId(p.id);
    setForm({ name: p.name, address: p.address, type: p.type, units: String(p.units), purchasePrice: String(p.purchasePrice), currentValue: String(p.currentValue), loanAmount: String(p.loanAmount || ""), loanRate: String(p.loanRate || ""), loanTermYears: String(p.loanTermYears || "30"), loanStartDate: p.loanStartDate || "", monthlyRent: String(p.monthlyRent), monthlyExpenses: String(p.monthlyExpenses), status: p.status, purchaseDate: p.purchaseDate || "" });
    setShowModal(true);
  };

  const calcMetrics = (rent, exp, val, loanAmt, loanRate, loanTerm, loanStart) => {
    const currentBalance = calcLoanBalance(loanAmt, loanRate, loanTerm, loanStart) ?? parseFloat(loanAmt) ?? 0;
    const capRate = val > 0 ? parseFloat(((rent - exp) * 12 / val * 100).toFixed(1)) : 0;
    const equity = val - currentBalance;
    const cashOnCash = equity > 0 ? parseFloat(((rent - exp) * 12 / equity * 100).toFixed(1)) : 0;
    return { capRate, cashOnCash };
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
    const { capRate, cashOnCash } = calcMetrics(rent, exp, val, loanAmt, loanRate, loanTerm, loanStart);
    const today = new Date().toISOString().slice(0, 10);

    if (editId !== null) {
      setPropData(prev => prev.map(p => {
        if (p.id !== editId) return p;
        // only update valueUpdatedAt if the user changed the value
        const valChanged = val !== p.currentValue;
        return { ...p, name: form.name, address: form.address, type: form.type, units: parseInt(form.units) || 1, purchasePrice: parseFloat(form.purchasePrice) || 0, currentValue: val, valueUpdatedAt: valChanged ? today : (p.valueUpdatedAt || today), loanAmount: loanAmt, loanRate, loanTermYears: loanTerm, loanStartDate: loanStart, monthlyRent: rent, monthlyExpenses: exp, purchaseDate: form.purchaseDate, status: form.status, capRate, cashOnCash };
      }));
    } else {
      const usedColors = propData.map(p => p.color);
      const color = PROP_COLORS.find(c => !usedColors.includes(c)) || PROP_COLORS[propData.length % PROP_COLORS.length];
      setPropData(prev => [...prev, { id: newId(), name: form.name, address: form.address, type: form.type, units: parseInt(form.units) || 1, purchasePrice: parseFloat(form.purchasePrice) || 0, currentValue: val, valueUpdatedAt: today, loanAmount: loanAmt, loanRate, loanTermYears: loanTerm, loanStartDate: loanStart, monthlyRent: rent, monthlyExpenses: exp, purchaseDate: form.purchaseDate, status: form.status, image: form.name.slice(0, 2).toUpperCase(), capRate, cashOnCash, color }]);
    }
    setForm(emptyP);
    setShowModal(false);
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
            const monthlyNet = p.monthlyRent - p.monthlyExpenses;
            return (
              <div key={p.id} onClick={() => onSelect(p)} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}>
                <div style={{ height: 110, background: `linear-gradient(135deg, ${p.color}22, ${p.color}44)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 800 }}>{p.image}</div>
                  <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Badge status={p.status} />
                    <button onClick={e => openEdit(e, p)} title="Edit property"
                      style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 7, padding: "4px 7px", cursor: "pointer", display: "flex", alignItems: "center", backdropFilter: "blur(4px)" }}>
                      <Pencil size={12} color="#475569" />
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
                      {p.valueUpdatedAt && <p style={{ color: "#cbd5e1", fontSize: 10, marginTop: 1 }}>Updated {daysAgo(p.valueUpdatedAt)}</p>}
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
                      <p style={{ color: "#8b5cf6", fontSize: 15, fontWeight: 700 }}>{p.capRate}%</p>
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
                {["Property", "Type", "Value", "Equity", "Monthly Rent", "Net Cash Flow", "Cap Rate", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "14px 20px", textAlign: "left", color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const lBal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate);
                const effMort = lBal !== null ? lBal : (p.mortgage || 0);
                return (
                <tr key={p.id} onClick={() => onSelect(p)} style={{ borderTop: "1px solid #f1f5f9", cursor: "pointer", background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0f9ff"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"}>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>{p.image}</div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{p.name}</p>
                        <p style={{ fontSize: 12, color: "#94a3b8" }}>{p.units} unit{p.units > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: 13, color: "#475569" }}>{p.type}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{fmtK(p.currentValue)}</p>
                    {p.valueUpdatedAt && <p style={{ fontSize: 11, color: "#cbd5e1" }}>Updated {daysAgo(p.valueUpdatedAt)}</p>}
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#10b981" }}>{fmtK(p.currentValue - effMort)}</p>
                    {lBal !== null && <p style={{ fontSize: 11, color: "#cbd5e1" }}>Balance {fmtK(effMort)}</p>}
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{fmt(p.monthlyRent)}</td>
                  <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>{fmt(p.monthlyRent - p.monthlyExpenses)}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <span style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{p.capRate}%</span>
                  </td>
                  <td style={{ padding: "16px 20px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "16px 20px" }}>
                    <button onClick={e => openEdit(e, p)} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "#475569", fontSize: 12, fontWeight: 600 }}>
                      <Pencil size={12} /> Edit
                    </button>
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
          {/* Basic Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { label: "Property Name", key: "name", type: "text", placeholder: "e.g. Maple Ridge Duplex", full: true },
              { label: "Address", key: "address", type: "text", placeholder: "Street, City, State ZIP", full: true },
              { label: "Purchase Price ($)", key: "purchasePrice", type: "number", placeholder: "0" },
              { label: "Current Value ($)", key: "currentValue", type: "number", placeholder: "0" },
              { label: "Monthly Rent ($)", key: "monthlyRent", type: "number", placeholder: "0" },
              { label: "Monthly Expenses ($)", key: "monthlyExpenses", type: "number", placeholder: "0" },
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
    </div>
  );
}

function PropertyDetail({ property, onBack }) {
  const calcBal = calcLoanBalance(property.loanAmount, property.loanRate, property.loanTermYears, property.loanStartDate);
  const effectiveMortgage = calcBal !== null ? calcBal : (property.mortgage || 0);
  const equity = property.currentValue - effectiveMortgage;
  const appreciation = property.currentValue - property.purchasePrice;
  const annualNOI = (property.monthlyRent - property.monthlyExpenses) * 12;
  const propTransactions = TRANSACTIONS.filter(t => t.property === property.name);

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "#3b82f6", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 20 }}>
        Back to Properties
      </button>
      <div style={{ background: `linear-gradient(135deg, ${property.color}18, ${property.color}30)`, borderRadius: 20, padding: 28, marginBottom: 24, border: `1px solid ${property.color}30` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: property.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800 }}>{property.image}</div>
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
            {property.valueUpdatedAt && <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>Value updated {daysAgo(property.valueUpdatedAt)}</p>}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Monthly Rent", value: fmt(property.monthlyRent), color: "#10b981" },
          { label: "Monthly Expenses", value: fmt(property.monthlyExpenses), color: "#ef4444" },
          { label: "Net Cash Flow", value: fmt(property.monthlyRent - property.monthlyExpenses), color: "#3b82f6" },
          { label: "Total Equity", value: fmt(equity), color: "#8b5cf6" },
          { label: "Purchase Price", value: fmt(property.purchasePrice), color: "#0f172a" },
          { label: calcBal !== null ? "Est. Mortgage Balance" : "Mortgage Balance", value: fmt(effectiveMortgage), color: "#f59e0b", sub: calcBal !== null ? "Auto-calculated" : null },
          { label: "Cap Rate", value: `${property.capRate}%`, color: "#8b5cf6" },
          { label: "Cash-on-Cash", value: `${property.cashOnCash}%`, color: "#10b981" },
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

function Transactions() {
  const [txData, setTxData] = useState(TRANSACTIONS);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const INCOME_CATS = [
    "Rent Income",
    "Late Fees",
    "Pet Fees",
    "Parking / Storage",
    "Laundry Income",
    "Application Fees",
    "Damage Deposit Applied",
    "Other Income",
  ];
  const EXPENSE_CATS = [
    "Mortgage Payment",
    "Property Tax",
    "Insurance",
    "Repairs & Maintenance",
    "Capital Improvement",
    "HOA / Condo Fees",
    "Property Management",
    "Utilities",
    "Landscaping",
    "Advertising & Marketing",
    "Legal & Professional Fees",
    "Cleaning & Janitorial",
    "Pest Control",
    "Supplies & Materials",
    "Travel & Mileage",
    "Other Expenses",
  ];
  const catsForType = t => t === "income" ? INCOME_CATS : EXPENSE_CATS;

  const emptyForm = { date: "", property: PROPERTIES[0]?.name || "", type: "income", category: INCOME_CATS[0], description: "", amount: "" };
  const [form, setForm] = useState(emptyForm);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // When type changes, reset category to first option for that type
  const setType = e => {
    const t = e.target.value;
    setForm(f => ({ ...f, type: t, category: catsForType(t)[0] }));
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = t => {
    setEditId(t.id);
    setForm({ date: t.date, property: t.property, type: t.type, category: t.category, description: t.description, amount: String(Math.abs(t.amount)) });
    setShowModal(true);
  };

  const filtered = txData.filter(t => {
    const matchType = filter === "all" || t.type === filter;
    const matchSearch = t.description.toLowerCase().includes(search.toLowerCase()) || t.property.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

  const handleSave = () => {
    if (!form.description || !form.amount) return;
    const amt = parseFloat(form.amount) || 0;
    const built = { date: form.date || new Date().toISOString().split("T")[0], property: form.property, category: form.category || "Other", description: form.description, amount: form.type === "income" ? Math.abs(amt) : -Math.abs(amt), type: form.type };
    if (editId !== null) {
      setTxData(prev => prev.map(t => t.id === editId ? { ...t, ...built } : t));
    } else {
      setTxData(prev => [{ id: newId(), ...built }, ...prev]);
    }
    setForm(emptyForm);
    setShowModal(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Transactions</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>Track all income and expenses across your portfolio</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 16px", background: "#fff", color: "#475569", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={15} /> Export CSV
          </button>
          <button onClick={openAdd} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Transaction
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
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..." style={{ width: "100%", paddingLeft: 38, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }} />
        </div>
        {["all", "income", "expense"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "10px 18px", borderRadius: 10, border: filter === f ? "none" : "1px solid #e2e8f0", background: filter === f ? (f === "income" ? "#dcfce7" : f === "expense" ? "#fee2e2" : "#3b82f6") : "#fff", color: filter === f ? (f === "income" ? "#15803d" : f === "expense" ? "#b91c1c" : "#fff") : "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer", textTransform: "capitalize" }}>
            {f === "all" ? "All" : f === "income" ? "Income" : "Expenses"}
          </button>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Date", "Property", "Category", "Description", "Amount", "Type", ""].map(h => (
                <th key={h} style={{ padding: "14px 20px", textAlign: "left", color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={t.id} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "#64748b" }}>{t.date}</td>
                <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{t.property.split(" ").slice(0, 2).join(" ")}</td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600, color: "#475569" }}>{t.category}</span>
                </td>
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
                    <button onClick={() => setTxData(prev => prev.filter(x => x.id !== t.id))} style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <Modal title={editId ? "Edit Transaction" : "Add Transaction"} onClose={() => setShowModal(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Date</label>
              <input type="date" value={form.date} onChange={sf("date")} style={iS} />
            </div>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Amount ($)</label>
              <input type="number" placeholder="0.00" value={form.amount} onChange={sf("amount")} style={iS} />
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
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Type</label>
              <select value={form.type} onChange={setType} style={iS}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Category</label>
              <select value={form.category} onChange={sf("category")} style={iS}>
                {catsForType(form.type).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSave} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              {editId ? "Save Changes" : "Save Transaction"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Analytics() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Analytics &amp; Returns</h1>
        <p style={{ color: "#64748b", fontSize: 15 }}>Detailed performance metrics for every property</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Annual NOI", value: fmt(PROPERTIES.reduce((s, p) => s + (p.monthlyRent - p.monthlyExpenses) * 12, 0)), color: "#10b981" },
          { label: "Portfolio Cap Rate", value: "6.9%", color: "#3b82f6" },
          { label: "Avg Cash-on-Cash", value: "8.4%", color: "#8b5cf6" },
          { label: "Total Appreciation", value: fmt(PROPERTIES.reduce((s, p) => s + (p.currentValue - p.purchasePrice), 0)), color: "#f59e0b" },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
            <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>{m.label}</p>
            <p style={{ color: m.color, fontSize: 22, fontWeight: 800 }}>{m.value}</p>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", marginBottom: 24 }}>
        <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Property-by-Property Performance</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
          {PROPERTIES.map(p => {
            const annualRent = p.monthlyRent * 12;
            const annualExpenses = p.monthlyExpenses * 12;
            const NOI = annualRent - annualExpenses;
            const coC = p.cashOnCash;
            const appreciation = ((p.currentValue - p.purchasePrice) / p.purchasePrice * 100).toFixed(1);
            return (
              <div key={p.id} style={{ background: "#f8fafc", borderRadius: 14, padding: 18, border: `2px solid ${p.color}30` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>{p.image}</div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{p.name.split(" ").slice(0, 2).join(" ")}</p>
                </div>
                {[
                  { label: "Annual NOI", value: fmtK(NOI), color: "#10b981" },
                  { label: "Cap Rate", value: `${p.capRate}%`, color: "#3b82f6" },
                  { label: "Cash-on-Cash", value: `${coC}%`, color: "#8b5cf6" },
                  { label: "Appreciation", value: `+${appreciation}%`, color: "#f59e0b" },
                ].map((m, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 1 }}>{m.label}</p>
                    <p style={{ color: m.color, fontSize: 15, fontWeight: 700 }}>{m.value}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cap Rate Comparison</h3>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Annual net operating income / property value</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={PROPERTIES.map(p => ({ name: p.image, rate: p.capRate, fill: p.color }))}>
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
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cash-on-Cash Return</h3>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Annual pre-tax cash flow / total cash invested</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={PROPERTIES.map(p => ({ name: p.image, coc: p.cashOnCash }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 14]} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v) => [`${v}%`, "CoC Return"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="coc" radius={[6, 6, 0, 0]} fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Reports() {
  const [activeReport, setActiveReport] = useState("scheduleE");

  const annualIncome = PROPERTIES.reduce((s, p) => s + p.monthlyRent * 12, 0);
  const annualExpenses = PROPERTIES.reduce((s, p) => s + p.monthlyExpenses * 12, 0);
  const depreciation = PROPERTIES.reduce((s, p) => s + Math.round(p.purchasePrice * 0.8 / 27.5), 0);
  const taxableIncome = annualIncome - annualExpenses - depreciation;

  const reportTypes = [
    { id: "scheduleE", label: "Schedule E Summary", icon: FileText },
    { id: "cashflow", label: "Cash Flow Report", icon: DollarSign },
    { id: "depreciation", label: "Depreciation Schedule", icon: TrendingDown },
    { id: "yearend", label: "Year-End Summary", icon: Calendar },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Tax Reports</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>IRS-ready summaries and year-end reporting</p>
        </div>
        <button style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Download size={16} /> Export All Reports
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", height: "fit-content" }}>
          {reportTypes.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: "none", background: activeReport === r.id ? "#eff6ff" : "transparent", color: activeReport === r.id ? "#3b82f6" : "#475569", fontWeight: activeReport === r.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
              <r.icon size={16} />
              {r.label}
            </button>
          ))}
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
          {activeReport === "scheduleE" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Schedule E - Rental Income &amp; Expenses</h2>
                  <p style={{ color: "#94a3b8", fontSize: 13 }}>Tax Year 2025 . All Properties</p>
                </div>
                <button style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 14px", background: "#fff", color: "#475569", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <Download size={14} /> Export PDF
                </button>
              </div>
              <div style={{ marginBottom: 24 }}>
                {PROPERTIES.map(p => {
                  const annRent = p.monthlyRent * 12;
                  const annExp = p.monthlyExpenses * 12;
                  const depr = Math.round(p.purchasePrice * 0.8 / 27.5);
                  const pBal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount || 0);
                  const pIntEst = Math.round(pBal * (p.loanRate || 4) / 100);
                  const netIncome = annRent - annExp - depr;
                  return (
                    <div key={p.id} style={{ border: "1px solid #f1f5f9", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>{p.image}</div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{p.name}</p>
                          <p style={{ fontSize: 12, color: "#94a3b8" }}>{p.address}</p>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                        {[
                          { label: "Rents Received", value: fmt(annRent), color: "#15803d" },
                          { label: "Operating Expenses", value: `-${fmt(annExp)}`, color: "#b91c1c" },
                          { label: "Depreciation", value: `-${fmt(depr)}`, color: "#b91c1c" },
                          { label: "Mortgage Interest (est.)", value: `-${fmt(pIntEst)}`, color: "#b91c1c" },
                          { label: "Net Rental Income", value: fmt(netIncome), color: netIncome >= 0 ? "#15803d" : "#b91c1c" },
                        ].map((m, i) => (
                          <div key={i} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
                            <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>{m.label}</p>
                            <p style={{ color: m.color, fontSize: 13, fontWeight: 700 }}>{m.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ background: "#f0f9ff", borderRadius: 14, padding: 20, border: "1px solid #bae6fd" }}>
                <h3 style={{ color: "#0c4a6e", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Portfolio Totals - Schedule E Summary</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  {[
                    { label: "Total Gross Rents", value: fmt(annualIncome), color: "#15803d" },
                    { label: "Total Expenses", value: `-${fmt(annualExpenses)}`, color: "#b91c1c" },
                    { label: "Depreciation Deduction", value: `-${fmt(depreciation)}`, color: "#b91c1c" },
                    { label: "Mortgage Interest (est.)", value: `-${fmt(Math.round(PROPERTIES.reduce((s, p) => { const bal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate) ?? (p.loanAmount || 0); return s + bal * (p.loanRate || 4) / 100; }, 0)))}`, color: "#b91c1c" },
                    { label: "Net Taxable Rental Income", value: fmt(taxableIncome), color: taxableIncome >= 0 ? "#15803d" : "#b91c1c" },
                    { label: "Estimated Tax @ 28%", value: `-${fmt(taxableIncome * 0.28)}`, color: "#b91c1c" },
                  ].map((m, i) => (
                    <div key={i} style={{ background: "#fff", borderRadius: 10, padding: "12px 16px" }}>
                      <p style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{m.label}</p>
                      <p style={{ color: m.color, fontSize: 16, fontWeight: 800 }}>{m.value}</p>
                    </div>
                  ))}
                </div>
                <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 14 }}>(!) This is an estimate for planning purposes. Please consult your CPA before filing.</p>
              </div>
            </div>
          )}

          {activeReport !== "scheduleE" && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <FileText size={28} color="#3b82f6" />
              </div>
              <h3 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                {reportTypes.find(r => r.id === activeReport)?.label}
              </h3>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>This report is being generated. Click Export to download.</p>
              <button style={{ marginTop: 20, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                Generate Report
              </button>
            </div>
          )}
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
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Flip Pipeline</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>Track every deal from contract to close</p>
        </div>
        <button style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
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
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["all", ...STAGE_ORDER].map(s => {
          const active = activeStage === s;
          const sc = STAGE_COLORS[s];
          return (
            <button key={s} onClick={() => setActiveStage(s)} style={{ padding: "8px 16px", borderRadius: 10, border: active ? "none" : "1px solid #e2e8f0", background: active ? (sc ? sc.bg : "#0f172a") : "#fff", color: active ? (sc ? sc.text : "#fff") : "#64748b", fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
              {s === "all" ? `All (${FLIPS.length})` : `${s} (${FLIPS.filter(f => f.stage === s).length})`}
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
        {filtered.map(f => <FlipCard key={f.id} flip={f} onSelect={onSelect} />)}
      </div>
    </div>
  );
}

function FlipDetail({ flip, onBack, allFlips, setAllFlips }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showContractorModal, setShowContractorModal] = useState(false);
  const [expData, setExpData] = useState(FLIP_EXPENSES.filter(e => e.flipId === flip.id));
  const [conData, setConData] = useState(CONTRACTORS.filter(c => c.flipId === flip.id));
  const [rehabItems, setRehabItems] = useState(flip.rehabItems || []);
  const [milestones, setMilestones] = useState(FLIP_MILESTONES[flip.id] || DEFAULT_MILESTONES.map(label => ({ label, done: false, date: null })));
  const [stage, setStage] = useState(flip.stage);

  const emptyExp = { date: "", vendor: "", category: "Materials/Supplies", description: "", amount: "" };
  const [expForm, setExpForm] = useState(emptyExp);
  const sfE = k => e => setExpForm(f => ({ ...f, [k]: e.target.value }));

  const emptyCon = { name: "", trade: "", paymentType: "Fixed Bid", totalBid: "", dayRate: "", phone: "", status: "pending" };
  const [conForm, setConForm] = useState(emptyCon);
  const sfC = k => e => setConForm(f => ({ ...f, [k]: e.target.value }));

  const handleSaveExp = () => {
    if (!expForm.amount) return;
    setExpData(prev => [{ id: newId(), flipId: flip.id, date: expForm.date || new Date().toISOString().split("T")[0], vendor: expForm.vendor || "Unknown", category: expForm.category, description: expForm.description, amount: parseFloat(expForm.amount) || 0 }, ...prev]);
    setExpForm(emptyExp);
    setShowExpenseModal(false);
  };

  const handleSaveCon = () => {
    if (!conForm.name) return;
    setConData(prev => [...prev, { id: newId(), flipId: flip.id, name: conForm.name, trade: conForm.trade, paymentType: conForm.paymentType, totalBid: parseFloat(conForm.totalBid) || 0, dayRate: parseFloat(conForm.dayRate) || 0, totalPaid: 0, status: conForm.status, phone: conForm.phone }]);
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
  const flipExpenses = expData;
  const totalExpensed = expData.reduce((s, e) => s + e.amount, 0);
  const doneCount = milestones.filter(m => m.done).length;

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "expenses", label: `Expenses (${flipExpenses.length})`, icon: Receipt },
    { id: "contractors", label: `Contractors (${flipContractors.length})`, icon: UserCheck },
    { id: "milestones", label: `Milestones (${doneCount}/${milestones.length})`, icon: CheckSquare },
  ];

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, color: "#f59e0b", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 20 }}>
        Back to Pipeline
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
            <p style={{ color: "#64748b", fontSize: 13 }}>{stage === "Sold" ? "Sale Price" : "ARV"}</p>
            <p style={{ color: "#0f172a", fontSize: 32, fontWeight: 800 }}>{fmt(saleOrARV)}</p>
            <p style={{ color: profit >= 0 ? "#10b981" : "#ef4444", fontSize: 15, fontWeight: 700 }}>
              {profit >= 0 ? "+" : ""}{fmt(profit)} {stage === "Sold" ? "net profit" : "projected profit"}
            </p>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 12, padding: 4, marginBottom: 24, width: "fit-content" }}>
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, border: "none", background: active ? "#fff" : "transparent", color: active ? "#0f172a" : "#64748b", fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none", whiteSpace: "nowrap" }}>
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
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Wrench size={18} color="#f59e0b" />
            <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700 }}>Rehab Budget Tracker</h3>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>Budget: <strong style={{ color: "#0f172a" }}>{fmt(rehabTotalBudget)}</strong></span>
            <span style={{ fontSize: 13, color: "#64748b" }}>Spent: <strong style={{ color: rehabTotalSpent > rehabTotalBudget ? "#b91c1c" : "#0f172a" }}>{fmt(rehabTotalSpent)}</strong></span>
            <span style={{ fontSize: 13, color: "#64748b" }}>Remaining: <strong style={{ color: "#3b82f6" }}>{fmt(Math.max(0, rehabTotalBudget - rehabTotalSpent))}</strong></span>
          </div>
        </div>
        <RehabProgress items={rehabItems} />
        <div style={{ marginTop: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Category", "Budgeted", "Spent", "Remaining", "Status"].map(h => (
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
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{item.category}</td>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>)}
      {activeTab === "expenses" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <p style={{ color: "#64748b", fontSize: 14 }}>
                {flipExpenses.length} transactions . <strong style={{ color: "#b91c1c" }}>{fmt(totalExpensed)}</strong> total spent
              </p>
            </div>
            <button onClick={() => setShowExpenseModal(true)} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={15} /> Log Expense
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {["Materials/Supplies", "Subcontractor", "Permits & Inspections", "Dump Fees"].map(cat => {
              const total = flipExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
              return (
                <div key={cat} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
                  <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{cat}</p>
                  <p style={{ color: "#0f172a", fontSize: 18, fontWeight: 700 }}>{total > 0 ? fmt(total) : "-"}</p>
                </div>
              );
            })}
          </div>

          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", overflow: "hidden" }}>
            {flipExpenses.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
                <Receipt size={32} style={{ margin: "0 auto 12px", display: "block" }} />
                <p style={{ fontWeight: 600, marginBottom: 4 }}>No expenses logged yet</p>
                <p style={{ fontSize: 13 }}>Click "Log Expense" to start tracking spend for this flip.</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Date", "Vendor", "Category", "Description", "Amount"].map(h => (
                      <th key={h} style={{ padding: "12px 18px", textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flipExpenses.map((e, i) => (
                    <tr key={e.id} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "13px 18px", fontSize: 13, color: "#64748b" }}>{e.date}</td>
                      <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{e.vendor}</td>
                      <td style={{ padding: "13px 18px" }}>
                        <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, color: "#475569" }}>{e.category}</span>
                      </td>
                      <td style={{ padding: "13px 18px", fontSize: 13, color: "#475569" }}>{e.description}</td>
                      <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 700, color: "#b91c1c" }}>{fmt(e.amount)}</td>
                      <td style={{ padding: "13px 18px" }}>
                        <button onClick={() => setExpData(prev => prev.filter(x => x.id !== e.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", opacity: 0.6, padding: 4 }}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                    <td colSpan={4} style={{ padding: "12px 18px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Total Expensed</td>
                    <td style={{ padding: "12px 18px", fontSize: 15, fontWeight: 800, color: "#b91c1c" }}>{fmt(totalExpensed)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          {showExpenseModal && (
            <Modal title="Log Expense" onClose={() => setShowExpenseModal(false)}>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16, marginTop: -12 }}>For: <strong>{flip.name}</strong></p>
              {[
                { label: "Date", type: "date", key: "date" },
                { label: "Vendor / Payee", type: "text", key: "vendor", placeholder: "e.g. Home Depot" },
                { label: "Description", type: "text", key: "description", placeholder: "What was purchased or done?" },
                { label: "Amount ($)", type: "number", key: "amount", placeholder: "0.00" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} value={expForm[f.key]} onChange={sfE(f.key)} style={iS} />
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: "#475569", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Category</label>
                <select value={expForm.category} onChange={sfE("category")} style={iS}>
                  {["Materials/Supplies","Subcontractor","Dump Fees","Permits & Inspections","Appliances","Landscaping","Staging","Carrying Costs","Other"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowExpenseModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSaveExp} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#f59e0b", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Save Expense</button>
              </div>
            </Modal>
          )}
        </div>
      )}
      {activeTab === "contractors" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <p style={{ color: "#64748b", fontSize: 14 }}>{flipContractors.length} contractor{flipContractors.length !== 1 ? "s" : ""} on this project</p>
            <button onClick={() => setShowContractorModal(true)} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
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
                        <button onClick={() => setConData(prev => prev.filter(x => x.id !== c.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", opacity: 0.5, padding: 4 }}><Trash2 size={14} /></button>
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
                    <div style={{ marginTop: 10 }}>
                      <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Paid to Date</p>
                      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${c.paymentType === "Fixed Bid" ? Math.round((c.totalPaid / c.totalBid) * 100) : 100}%`, background: "#10b981", borderRadius: 99 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {showContractorModal && (
        <Modal title="Add Contractor" onClose={() => setShowContractorModal(false)}>
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
            <button onClick={() => setShowContractorModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveCon} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#f59e0b", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Add Contractor</button>
          </div>
        </Modal>
      )}
      {activeTab === "milestones" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <p style={{ color: "#64748b", fontSize: 14 }}>{doneCount} of {milestones.length} milestones complete</p>
              <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", width: 200, marginTop: 6 }}>
                <div style={{ height: "100%", width: `${Math.round((doneCount / milestones.length) * 100)}%`, background: "#10b981", borderRadius: 99, transition: "width 0.3s" }} />
              </div>
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
            {milestones.map((m, i) => (
              <div key={i} onClick={() => {
                const updated = milestones.map((item, idx) => idx === i ? { ...item, done: !item.done, date: !item.done ? new Date().toISOString().split("T")[0] : null } : item);
                setMilestones(updated);
              }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: i < milestones.length - 1 ? "1px solid #f8fafc" : "none", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ color: m.done ? "#10b981" : "#cbd5e1", flexShrink: 0 }}>
                  {m.done ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: m.done ? 600 : 500, color: m.done ? "#0f172a" : "#475569", textDecoration: m.done ? "none" : "none" }}>{m.label}</p>
                </div>
                <div>
                  {m.done && m.date ? (
                    <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>v {m.date}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: "#cbd5e1" }}>Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
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
  const emptyT = { propertyId: PROPERTIES[0]?.id || 1, unit: "", name: "", rent: "", leaseStart: "", leaseEnd: "", status: "current", phone: "", email: "" };
  const [form, setForm] = useState(emptyT);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const openAdd = () => { setEditId(null); setForm(emptyT); setShowModal(true); };
  const openEdit = t => {
    setEditId(t.id);
    setForm({
      propertyId: t.propertyId,
      unit:       t.unit || "",
      name:       t.name || "",
      rent:       String(t.rent || ""),
      leaseStart: t.leaseStart || "",
      leaseEnd:   t.leaseEnd || "",
      status:     t.status,
      phone:      t.phone || "",
      email:      t.email || "",
    });
    setShowModal(true);
  };

  const handleSaveTenant = () => {
    if (!form.name && form.status !== "vacant") return;
    if (editId !== null) {
      setTenantData(prev => prev.map(t => t.id === editId
        ? { ...t, propertyId: parseInt(form.propertyId), unit: form.unit || t.unit, name: form.name, rent: parseFloat(form.rent) || 0, leaseStart: form.leaseStart || null, leaseEnd: form.leaseEnd || null, status: form.status, phone: form.phone || null, email: form.email || null }
        : t
      ));
    } else {
      setTenantData(prev => [...prev, { id: newId(), propertyId: parseInt(form.propertyId), unit: form.unit || "Main", name: form.name, rent: parseFloat(form.rent) || 0, leaseStart: form.leaseStart || null, leaseEnd: form.leaseEnd || null, status: form.status, daysUntilExpiry: null, lastPayment: null, phone: form.phone || null, email: form.email || null }]);
    }
    setForm(emptyT);
    setShowModal(false);
  };

  const leaseStatusStyle = {
    "current":        { bg: "#dcfce7", text: "#15803d" },
    "month-to-month": { bg: "#fef9c3", text: "#a16207" },
    "vacant":         { bg: "#fee2e2", text: "#b91c1c" },
  };
  const totalUnits = tenantData.length;
  const occupied = tenantData.filter(t => t.status !== "vacant").length;
  const vacancyRate = totalUnits > 0 ? ((totalUnits - occupied) / totalUnits * 100).toFixed(0) : 0;
  const grossRent = tenantData.filter(t => t.status !== "vacant").reduce((s, t) => s + t.rent, 0);
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
      {expiringIn90.length > 0 && (
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
            {tenantData.map((t, i) => {
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
                    <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>{t.status.replace("-", " ")}</span>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#64748b" }}>{t.lastPayment || "-"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <button onClick={() => openEdit(t)} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "#475569", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                      <Pencil size={12} /> Edit
                    </button>
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
                <option value="current">Current</option>
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
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSaveTenant} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              {editId ? "Save Changes" : "Add Tenant"}
            </button>
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
  const emptyTrip = { date: "", description: "", from: "Home", to: "", miles: "", purpose: "Rental", businessPct: "100" };
  const [form, setForm] = useState(emptyTrip);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.miles || !form.to) return;
    setTripData(prev => [{ id: newId(), date: form.date || new Date().toISOString().split("T")[0], description: form.description || form.to, from: form.from, to: form.to, miles: parseFloat(form.miles) || 0, purpose: form.purpose, businessPct: parseFloat(form.businessPct) || 100 }, ...prev]);
    setForm(emptyTrip);
    setShowModal(false);
  };

  const totalMiles = tripData.reduce((s, t) => s + t.miles, 0);
  const businessMiles = tripData.filter(t => t.businessPct === 100).reduce((s, t) => s + t.miles, 0);
  const IRS_RATE = 0.70;
  const deduction = businessMiles * IRS_RATE;
  const purposeColors = { Flip: "#f59e0b", Rental: "#3b82f6", Business: "#8b5cf6" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#0f172a", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Mileage Tracker</h1>
          <p style={{ color: "#64748b", fontSize: 15 }}>Log business trips . IRS rate: $0.67/mile (2024)</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Log Trip
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Miles", value: totalMiles.toFixed(1), sub: "All trips YTD", color: "#3b82f6", icon: Car },
          { label: "Business Miles", value: businessMiles.toFixed(1), sub: "100% deductible", color: "#10b981", icon: Route },
          { label: "Mileage Deduction", value: fmt(deduction), sub: `@ $${IRS_RATE}/mile IRS rate`, color: "#8b5cf6", icon: DollarSign },
          { label: "Avg per Trip", value: tripData.length > 0 ? (totalMiles / tripData.length).toFixed(1) + " mi" : "0 mi", sub: `${tripData.length} trips logged`, color: "#f59e0b", icon: Truck },
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
              {["Date", "Description", "From / To", "Miles", "Purpose", "Deduction"].map(h => (
                <th key={h} style={{ padding: "12px 18px", textAlign: "left", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tripData.map((t, i) => (
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
                  <button onClick={() => setTripData(prev => prev.filter(x => x.id !== t.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", opacity: 0.6, padding: 4 }} title="Delete"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
              <td colSpan={3} style={{ padding: "12px 18px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Totals</td>
              <td style={{ padding: "12px 18px", fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{businessMiles.toFixed(1)} mi</td>
              <td />
              <td style={{ padding: "12px 18px", fontSize: 15, fontWeight: 800, color: "#15803d" }}>{fmt(deduction)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {showModal && (
        <Modal title="Log Trip" onClose={() => setShowModal(false)} width={460}>
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
            <button onClick={handleSave} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Save Trip</button>
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

  const rentalNavItems = [
    { id: "dashboard",    label: "Dashboard",    icon: LayoutDashboard },
    { id: "properties",   label: "Properties",   icon: Building2       },
    { id: "rentroll",     label: "Rent Roll",     icon: Users           },
    { id: "transactions", label: "Transactions",  icon: ArrowUpDown     },
    { id: "analytics",    label: "Analytics",     icon: BarChart3       },
    { id: "reports",      label: "Reports",       icon: FileText        },
  ];

  const flipNavItems = [
    { id: "flipdashboard",   label: "Overview",       icon: LayoutDashboard },
    { id: "flips",           label: "Pipeline",       icon: Hammer          },
    { id: "rehabtracker",    label: "Rehab Tracker",  icon: Wrench          },
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
              <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedProperty(null); setSelectedFlip(null); }}
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
            const active = activeView === item.id || (item.id === "flips" && activeView === "flipDetail") || (item.id === "flipdashboard" && activeView === "flipDetail");
            return (
              <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedFlip(null); setSelectedProperty(null); }}
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
              <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedFlip(null); setSelectedProperty(null); }}
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
            <span style={{ color: "#94a3b8", fontSize: 14 }}>Portfolio</span>
            <ChevronRight size={14} color="#cbd5e1" />
            <span style={{ color: "#0f172a", fontSize: 14, fontWeight: 600 }}>
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
          {activeView === "dashboard" && <Dashboard />}
          {activeView === "properties" && <Properties onSelect={handlePropertySelect} />}
          {activeView === "propertyDetail" && selectedProperty && <PropertyDetail property={selectedProperty} onBack={() => setActiveView("properties")} />}
          {activeView === "transactions" && <Transactions />}
          {activeView === "analytics" && <Analytics />}
          {activeView === "reports" && <Reports />}
          {activeView === "flipdashboard"   && <FlipDashboard onSelect={handleFlipSelect} />}
          {activeView === "flips"           && <FlipPipeline onSelect={handleFlipSelect} />}
          {activeView === "flipDetail"      && selectedFlip && <FlipDetail flip={selectedFlip} onBack={() => setActiveView("flips")} />}
          {activeView === "rehabtracker"    && <RehabTracker />}
          {activeView === "flipexpenses"    && <FlipExpenses />}
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
