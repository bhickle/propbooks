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
  CheckSquare, Square, PlusCircle, Receipt, UploadCloud, Trash2, Pencil, List,
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
  PROPERTY_DOCUMENTS,
  DEAL_DOCUMENTS,
  TENANT_DOCUMENTS,
  MAINTENANCE_REQUESTS, addMaintenanceRequest, updateMaintenanceRequest,
  TRANSACTION_RECEIPTS, addTransactionReceipt, deleteTransactionReceipt,
  DEAL_EXPENSE_RECEIPTS, addDealExpenseReceipt, deleteDealExpenseReceipt,
  mockOcrScan,
  clearDemoData, restoreDemoData, DEMO_EMAIL,
} from "./api.js";
import { AuthProvider, AuthScreen, useAuth } from "./auth.jsx";
import { SUPABASE_CONFIGURED, SUPABASE_CONFIG_ERROR } from "./supabase.js";
import { InfoTip, Modal, StatCard, colorWithAlpha, sectionS as sharedSectionS, cardS as sharedCardS, Badge, EmptyState, iS } from "./shared.jsx";
import {
  PROPERTIES, TRANSACTIONS, MONTHLY_CASH_FLOW, EQUITY_GROWTH, EXPENSE_CATEGORIES,
  FLIP_EXPENSE_GROUPS, FLIP_EXPENSE_CATS, getFlipExpGroup,
  _LOCAL_FLIP_MILESTONES, TENANTS, MILEAGE_TRIPS, restoreLocalDemoData,
} from "./mockData.js";
import {
  TAX_CONFIG, getDeprBasis, calcLoanBalance, calcPaymentInterest,
  getEffectiveMonthly, calcCapRate, calcCashOnCash,
} from "./finance.js";
import { daysAgo, getPropertyHealth, healthBadge } from "./health.js";
import {
  generateAlerts, isAlertSuppressed, snoozeAlert, dismissAlert,
  wasRentPaidThisMonth, QuickPayInline,
} from "./alerts.jsx";
import { ToastProvider, useToast } from "./toast.jsx";
import { ThemeProvider, useTheme } from "./theme.jsx";
import { Settings, OnboardingWizard } from "./settings.jsx";
import { DealDashboard, RehabTracker, DealExpenses, DealContractors, ContractorDetail, DealAnalytics, DealMilestones, DealNotes } from "./deals.jsx";
import { DealReports } from "./dealReports.jsx";
import { WelcomeScreen } from "./views/WelcomeScreen.jsx";
import { GlobalSearch } from "./views/GlobalSearch.jsx";
import { MileageTracker } from "./views/MileageTracker.jsx";
import { DealAnalyzer } from "./views/DealAnalyzer.jsx";
import { RentalWizard } from "./views/RentalWizard.jsx";
import { FlipWizard } from "./views/FlipWizard.jsx";
import { UnifiedNotes } from "./views/UnifiedNotes.jsx";
import { TxDetailPanel, ExpDetailPanel } from "./views/detailPanels.jsx";
import { Properties } from "./views/Properties.jsx";
import { PortfolioDashboard } from "./views/PortfolioDashboard.jsx";
import { Dashboard } from "./views/Dashboard.jsx";
import { AttachmentZone, AttachmentList, OcrPrompt, DocumentsPanel, DOC_TYPE_OPTIONS } from "./views/Attachments.jsx";
import { PropertyDetail } from "./views/PropertyDetail.jsx";
import { Transactions } from "./views/Transactions.jsx";
import { TenantManagement } from "./views/TenantManagement.jsx";
import { TenantDetail } from "./views/TenantDetail.jsx";
import { Reports } from "./views/Reports.jsx";
import { Analytics } from "./views/Analytics.jsx";
import { DealPipeline, StageBadge, RehabProgress } from "./views/DealPipeline.jsx";
import { listProperties } from "./db/properties.js";
import { listTransactions } from "./db/transactions.js";
import { listTenants, updateTenant as dbUpdateTenant } from "./db/tenants.js";
import { listDeals, updateDeal as dbUpdateDeal, deleteDeal as dbDeleteDeal, createDeal as dbCreateDeal } from "./db/deals.js";
import { listMilestones, updateMilestone as dbUpdateMilestone } from "./db/dealMilestones.js";
import { listRehabItems, updateRehabItem as dbUpdateRehabItem } from "./db/dealRehabItems.js";
import {
  listContractors, createContractor as dbCreateContractor,
  updateContractor as dbUpdateContractor, linkContractorToDeal as dbLinkContractorToDeal,
} from "./db/contractors.js";
import { listContractorBids } from "./db/contractorBids.js";
import { listContractorPayments } from "./db/contractorPayments.js";
import { listDealExpenses } from "./db/dealExpenses.js";
import { listNotes, createDealNote as dbCreateDealNote, updateNote as dbUpdateNote, deleteNote as dbDeleteNote } from "./db/notes.js";
import { listMileageTrips } from "./db/mileageTrips.js";
import { listMaintenanceRequests } from "./db/maintenanceRequests.js";
import { listDocuments, createDocument as dbCreateDocument, deleteDocument as dbDeleteDocument } from "./db/documents.js";

// Fire-and-forget DB sync for legacy sync handlers that mutate DEALS in place.
// The optimistic in-memory mutation has already happened; this just persists.
// Errors are logged so we can spot drift; UI flow is not blocked.
function persistDealAsync(id, updates) {
  dbUpdateDeal(id, updates).catch(e =>
    console.error("[PropBooks] persistDealAsync failed for", id, e)
  );
}
function persistMilestoneAsync(id, updates) {
  dbUpdateMilestone(id, updates).catch(e =>
    console.error("[PropBooks] persistMilestoneAsync failed for", id, e)
  );
}
function persistRehabItemAsync(id, updates) {
  dbUpdateRehabItem(id, updates).catch(e =>
    console.error("[PropBooks] persistRehabItemAsync failed for", id, e)
  );
}

// TAX_CONFIG and getDeprBasis moved to finance.js

// iS, Badge, EmptyState moved to shared.jsx

// Error Boundary — catches runtime errors and displays them instead of white screen
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { this.setState({ errorInfo }); console.error("ErrorBoundary caught:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return React.createElement("div", { style: { padding: 32, maxWidth: 700, margin: "40px auto", background: "var(--danger-tint)", borderRadius: 16, border: "1px solid var(--danger-border)" } },
        React.createElement("h2", { style: { color: "#991b1b", fontSize: 20, fontWeight: 700, marginBottom: 12 } }, "Something went wrong"),
        React.createElement("pre", { style: { color: "#c0392b", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "var(--surface)", padding: 16, borderRadius: 10, border: "1px solid var(--danger-border)", marginBottom: 12 } }, String(this.state.error)),
        this.state.errorInfo && React.createElement("pre", { style: { color: "var(--text-secondary)", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 200, overflow: "auto", background: "var(--surface-alt)", padding: 12, borderRadius: 8 } }, this.state.errorInfo.componentStack),
        React.createElement("button", { onClick: () => this.setState({ hasError: false, error: null, errorInfo: null }), style: { marginTop: 12, background: "var(--c-red)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, cursor: "pointer" } }, "Try Again")
      );
    }
    return this.props.children;
  }
}

// Modal moved to shared.jsx

// ToastProvider, useToast moved to toast.jsx

// ThemeProvider, useTheme moved to theme.jsx

// EmptyState moved to shared.jsx

// calcLoanBalance, calcPaymentInterest, calcMonthlyFromTx, getEffectiveMonthly,
// calcCapRate, calcCashOnCash moved to finance.js
// daysAgo, getPropertyHealth, healthBadge moved to health.js
// PROPERTIES (and friends) moved to mockData.js

// TRANSACTIONS, MONTHLY_CASH_FLOW, EQUITY_GROWTH, EXPENSE_CATEGORIES,
// FLIP_EXPENSE_GROUPS, FLIP_EXPENSE_CATS, getFlipExpGroup,
// _LOCAL_FLIP_MILESTONES, TENANTS, MILEAGE_TRIPS,
// snapshots + restoreLocalDemoData all moved to mockData.js

// fmt, fmtK imported from api.js

// ---------------------------------------------
// COMPONENTS
// ---------------------------------------------

// InfoTip moved to shared.jsx

// colorWithAlpha moved to shared.jsx

// StatCard moved to shared.jsx

// Badge moved to shared.jsx

// Alerts (state, dismiss/snooze, generateAlerts, wasRentPaidThisMonth) and the
// rent-payment write (logRentPayment, QuickPayInline) moved to alerts.jsx




// Wizard primitives + RentalWizard + FlipWizard moved to views/
// ── WELCOME SCREEN ────────────────────────────────────────────────────────
// Shown when the user has no properties and no deals — the app is empty.
// WelcomeScreen moved to ./views/WelcomeScreen.jsx

// ---------------------------------------------
// VIEWS
// ---------------------------------------------

// PortfolioDashboard moved to views/

// Dashboard moved to views/

// Properties moved to views/Properties.jsx

// TxDetailPanel + ExpDetailPanel moved to views/detailPanels.jsx

// PropertyDetail moved to views/PropertyDetail.jsx

// Transactions moved to views/Transactions.jsx

// Analytics moved to views/Analytics.jsx

// ── REPORT EXPORT HELPERS ──
// downloadFile + exportReportCSV + exportReportPDF + Reports moved to views/Reports.jsx

// DealPipeline / DealCard / StageBadge / RehabProgress moved to ./views/DealPipeline.jsx

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
  }, [milestones]); // eslint-disable-line react-hooks/exhaustive-deps -- milestones is the cache-bust counter for DEAL_MILESTONES
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
  const dealContractorsList = useMemo(() => CONTRACTORS.filter(c => (c.dealIds || []).includes(deal.id)), [deal.id, conData]); // eslint-disable-line react-hooks/exhaustive-deps -- conData is the cache-bust counter for CONTRACTORS
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
  const pushDealNote = async (text) => {
    if (!text || !text.trim()) return;
    try {
      const saved = await dbCreateDealNote({
        dealId: deal.id,
        date: new Date().toISOString().split("T")[0],
        text: text.trim(),
        mentions: [],
      });
      DEAL_NOTES.unshift(saved);
      bumpNotes();
    } catch (e) {
      console.error("[PropBooks] Add deal note failed:", e);
    }
  };
  const removeDealNote = async (id) => {
    try {
      await dbDeleteNote(id);
      const gi = DEAL_NOTES.findIndex(n => n.id === id);
      if (gi !== -1) DEAL_NOTES.splice(gi, 1);
      bumpNotes();
    } catch (e) {
      console.error("[PropBooks] Delete deal note failed:", e);
    }
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
    persistDealAsync(deal.id, updated);
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

  const handleSaveCon = async () => {
    if (!conForm.name) return;
    const fields = {
      name: conForm.name, trade: conForm.trade, phone: conForm.phone,
      email: conForm.email || null, license: conForm.license || null,
      insuranceExpiry: conForm.insuranceExpiry || null,
      notes: conForm.notes || "",
    };
    try {
      if (editingConId) {
        const saved = await dbUpdateContractor(editingConId, fields);
        const gi = CONTRACTORS.findIndex(c => c.id === editingConId);
        if (gi !== -1) CONTRACTORS[gi] = { ...CONTRACTORS[gi], ...saved };
        setConData(prev => prev.map(c => c.id === editingConId ? { ...c, ...saved } : c));
        setEditingConId(null);
      } else {
        const saved = await dbCreateContractor({ ...fields, rating: null });
        const newCon = { ...saved, dealIds: [deal.id], bids: [], payments: [], documents: [] };
        CONTRACTORS.push(newCon);
        dbLinkContractorToDeal(saved.id, deal.id).catch(e => console.error("[PropBooks] link contractor failed:", e));
        setConData(prev => [...prev, newCon]);
        setHighlightConId(newCon.id);
        setTimeout(() => setHighlightConId(h => h === newCon.id ? null : h), 3500);
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
    } catch (e) {
      console.error("[PropBooks] save contractor failed:", e);
      showToast && showToast("Couldn't save contractor — " + (e.message || "unknown error"));
    }
  };

  // Attach an existing contractor from the global CONTRACTORS list to this deal
  const attachExistingContractor = (conId) => {
    const gi = CONTRACTORS.findIndex(c => c.id === conId);
    if (gi === -1) return;
    const existing = CONTRACTORS[gi];
    const ids = existing.dealIds || [];
    if (!ids.includes(deal.id)) {
      CONTRACTORS[gi] = { ...existing, dealIds: [...ids, deal.id] };
      dbLinkContractorToDeal(conId, deal.id).catch(e => console.error("[PropBooks] link contractor failed:", e));
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
    persistDealAsync(deal.id, { stage: newStage });
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
  const statusColors = { "complete": "#1a7a4a", "in-progress": "#9a3412", "pending": "#94a3b8" };
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
              <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{deal.name}</h1>
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
                      persistDealAsync(deal.id, { stage: nextStage });
                      if (setAllFlips) setAllFlips(prev => prev.map(f => f.id === deal.id ? { ...f, stage: nextStage } : f));
                      if (onDealUpdated) onDealUpdated();
                      pushDealNote(`Stage advanced to "${nextStage}".`);
                      showToast(`Stage advanced to "${nextStage}"`);
                    }} style={{ background: "var(--success-tint)", border: "1px solid #9fcfb4", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#1a7a4a", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
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
            {stage !== "Sold" && stage !== "Converted to Rental" && deal.arvUpdatedAt && (() => {
              const arvDays = Math.round((new Date() - new Date(deal.arvUpdatedAt)) / 86400000);
              const isStale = arvDays > 90;
              return <p style={{ color: isStale ? "#c2410c" : "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
                {isStale ? "⚠ ARV may be outdated — edit deal to update" : `ARV as of ${daysAgo(deal.arvUpdatedAt)}`}
              </p>;
            })()}
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
            { label: stage === "Sold" ? "Sale Price" : "ARV (Target)", value: fmt(saleOrARV), color: "#1a7a4a", sign: "+" },
            { label: "Purchase Price", value: fmt(deal.purchasePrice), color: "#c0392b", sign: "-" },
            { label: "Rehab Cost", value: fmt(stage === "Sold" ? deal.rehabSpent : deal.rehabBudget), color: "#c0392b", sign: "-" },
            { label: "Holding Costs", value: fmt(totalHolding), color: "#c0392b", sign: "-" },
            { label: `Selling Costs (~${currentFlip.sellingCostPct || 6}%)`, value: fmt(sellingCosts), color: "#c0392b", sign: "-" },
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
                { label: "Actual Purchase", value: fmt(deal.purchasePrice), color: deal.purchasePrice <= mao70 ? "#1a7a4a" : "#c0392b", tip: "What you actually paid for the property. Green if at or under MAO, red if over." },
              ].map((m, i) => (
                <div key={i} style={{ background: "var(--surface-alt)", borderRadius: 8, padding: "10px 12px" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 2, display: "flex", alignItems: "center" }}>{m.label}<InfoTip text={m.tip} /></p>
                  <p style={{ color: m.color || "var(--text-primary)", fontSize: 14, fontWeight: 700 }}>{m.value}</p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: deal.purchasePrice <= mao70 ? "#1a7a4a" : "#c0392b", background: deal.purchasePrice <= mao70 ? "var(--success-badge)" : "var(--danger-badge)", borderRadius: 8, padding: "5px 8px" }}>
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
            <p style={{ color: rehabTotalSpent > rehabTotalBudget ? "#c0392b" : "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>{fmt(rehabTotalSpent)}</p>
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
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: over ? "#c0392b" : "#1a7a4a" }}>
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
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, fontWeight: 600, color: "#1a7a4a" }}><CheckCircle size={11} /> Standard category</span>
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
                {hasExpFilters ? `${flipExpenses.length} of ${expData.length}` : `${flipExpenses.length}`} transactions . <strong style={{ color: "#c0392b" }}>{fmt(hasExpFilters ? filteredTotal : totalExpensed)}</strong> {hasExpFilters ? "filtered" : "total spent"}
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
              {expDateFilter !== "all" && <span style={{ background: "var(--success-tint)", color: "#1a7a4a", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{{ thisMonth: "This Month", lastMonth: "Last Month", thisYear: "This Year", lastYear: "Last Year", custom: expDateFrom && expDateTo ? `${expDateFrom} – ${expDateTo}` : "Custom Range" }[expDateFilter]}</span>}
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
                      <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 700, color: "#c0392b" }}>{fmt(e.amount)}</td>
                      <td style={{ padding: "13px 18px" }}>
                        <button onClick={ev => { ev.stopPropagation(); setExpData(prev => prev.map(x => x.id === e.id ? { ...x, status: x.status === "paid" ? "pending" : "paid" } : x)); }} style={{ background: (e.status || "paid") === "paid" ? "var(--success-badge)" : "var(--warning-bg)", color: (e.status || "paid") === "paid" ? "#1a7a4a" : "#9a3412", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", textTransform: "capitalize" }}>
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
                    <td style={{ padding: "12px 18px", fontSize: 15, fontWeight: 800, color: "#c0392b" }}>{fmt(totalExpensed)}</td>
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
                      <div style={{ padding: "6px 14px", background: "var(--surface-alt)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Previous Payees</div>
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
                        <p style={{ color: t.owed > 0 ? "#9a3412" : "#1a7a4a", fontSize: 13, fontWeight: 700 }}>{t.totalBid > 0 ? (t.owed > 0 ? fmt(t.owed) : "Paid in full") : "—"}</p>
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
                  onChange={e => { if (e.target.value) attachExistingContractor(e.target.value); }}
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
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, fontWeight: 600, color: "#1a7a4a" }}><CheckCircle size={11} /> Standard category</span>
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
                <span style={{ fontSize: 13, fontWeight: 700, color: t.owed > 0 ? "#c0392b" : "#1a7a4a" }}>{t.owed > 0 ? fmt(t.owed) : "Paid in full"}</span>
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
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--success-tint)", border: "1px solid #9fcfb4" }}>
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
          onAdd={async ({ meta, file }) => {
            try {
              const saved = await dbCreateDocument({ entityType: "deal", entityId: deal.id, meta, file });
              DEAL_DOCUMENTS.unshift(saved);
              dealDocRerender(n => n + 1);
            } catch (e) {
              console.error("[PropBooks] Add deal document failed:", e);
            }
          }}
          onDelete={async (id) => {
            try {
              const doc = DEAL_DOCUMENTS.find(d => d.id === id);
              if (!doc) return;
              await dbDeleteDocument(doc);
              const idx = DEAL_DOCUMENTS.findIndex(d => d.id === id);
              if (idx !== -1) DEAL_DOCUMENTS.splice(idx, 1);
              dealDocRerender(n => n + 1);
            } catch (e) {
              console.error("[PropBooks] Delete deal document failed:", e);
            }
          }}
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
              <button onClick={() => setCloseDealStep("sold")} style={{ display: "flex", alignItems: "center", gap: 14, padding: 18, background: "var(--success-tint)", border: "2px solid #9fcfb4", borderRadius: 14, cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" }} onMouseEnter={e => e.currentTarget.style.borderColor = "#1a7a4a"} onMouseLeave={e => e.currentTarget.style.borderColor = "var(--success-border)"}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--success-badge)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <DollarSign size={22} color="#1a7a4a" />
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
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#c0392b" }}>{fmt(deal.purchasePrice + rehabSpent + totalHolding + sc + bc)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>Net Profit</p>
                      <p style={{ fontSize: 14, fontWeight: 800, color: netProfit >= 0 ? "#1a7a4a" : "#c0392b" }}>{netProfit >= 0 ? "+" : ""}{fmt(netProfit)}</p>
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
                persistDealAsync(deal.id, soldData);
                setStage("Sold");
                if (closeForm.closingNotes.trim()) {
                  pushDealNote(closeForm.closingNotes);
                }
                pushDealNote(`Deal closed — sold for ${fmt(sp)} with net profit of ${fmt(netProfit)}.`);
                if (onDealUpdated) onDealUpdated();
                showToast(`Deal marked as sold — ${fmt(netProfit)} net profit`);
                setShowCloseDeal(false);
              }} disabled={!closeForm.salePrice || !closeForm.closeDate} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: (!closeForm.salePrice || !closeForm.closeDate) ? "#cbd5e1" : "#1a7a4a", color: "#fff", fontWeight: 700, cursor: (!closeForm.salePrice || !closeForm.closeDate) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
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
                persistDealAsync(deal.id, { stage: "Converted to Rental" });
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
              // Clean up related in-memory data (DB cascades the FKs)
              const expIdxs = [];
              DEAL_EXPENSES.forEach((e, i) => { if (e.dealId === deal.id) expIdxs.unshift(i); });
              expIdxs.forEach(i => DEAL_EXPENSES.splice(i, 1));
              const msIdxs = [];
              DEAL_MILESTONES.forEach((m, i) => { if (m.dealId === deal.id) msIdxs.unshift(i); });
              msIdxs.forEach(i => DEAL_MILESTONES.splice(i, 1));
              dbDeleteDeal(deal.id).catch(e => console.error("[PropBooks] Delete deal failed:", e));
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
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{deleteConfirm.item.vendor} · {deleteConfirm.item.date} · <span style={{ color: "#c0392b", fontWeight: 700 }}>{fmt(deleteConfirm.item.amount)}</span></p>
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
// TenantManagement moved to views/TenantManagement.jsx

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
  const statusColors = { "complete": "#1a7a4a", "in-progress": "#9a3412", "pending": "#64748b" };
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

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      const saved = await dbCreateDealNote({
        dealId: deal.id,
        rehabItemIdx: itemIdx,
        date: new Date().toISOString().split("T")[0],
        text: noteText.trim(),
        mentions: [],
      });
      DEAL_NOTES.unshift(saved);
      setNoteText("");
      setShowAddNote(false);
      bump();
      showToast("Note added");
    } catch (e) {
      console.error("[PropBooks] Add rehab note failed:", e);
      showToast("Couldn't add note — " + (e.message || "unknown error"));
    }
  };
  const deleteNote = async (id) => {
    try {
      await dbDeleteNote(id);
      const gi = DEAL_NOTES.findIndex(n => n.id === id);
      if (gi !== -1) DEAL_NOTES.splice(gi, 1);
      setDeletingNoteId(null);
      bump();
      showToast("Note deleted");
    } catch (e) {
      console.error("[PropBooks] Delete rehab note failed:", e);
      showToast("Couldn't delete note — " + (e.message || "unknown error"));
    }
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

  const sectionS = { ...sharedSectionS, marginBottom: 16 };
  const cardS = sharedCardS;
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
            <select value="" onChange={e => { if (e.target.value) { addContractor(e.target.value); e.target.value = ""; } }}
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
              const statusBidColor = bid?.status === "accepted" ? "#1a7a4a" : "#9a3412";
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
                <p style={{ fontSize: 14, fontWeight: 700, color: "#c0392b" }}>{fmt(exp.amount)}</p>
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
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, fontWeight: 600, color: "#1a7a4a" }}><CheckCircle size={11} /> Standard category</span>
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
// TenantDetail moved to views/TenantDetail.jsx

// MileageTracker moved to ./views/MileageTracker.jsx

// MentionTextarea, NoteTextWithMentions, and UnifiedNotes moved to views/

// GlobalSearch moved to ./views/GlobalSearch.jsx

// ---------------------------------------------
// MAIN APP
// ---------------------------------------------
function AppShell() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Gate demo data: real users start with a blank account.
  // Demo user (demo@propbooks.com) always sees the full sample portfolio.
  // Re-runs whenever user identity changes — so an in-session auth swap
  // (real → demo without going through null) re-syncs the data state.
  const isDemo = user?.email === DEMO_EMAIL;
  const _userKey = user?.email || "anonymous";
  const _lastDataUser = useRef(null);
  if (_lastDataUser.current !== _userKey) {
    _lastDataUser.current = _userKey;
    if (isDemo) {
      // Restore in case a prior non-demo session cleared the arrays
      restoreDemoData();
      restoreLocalDemoData();
    } else {
      // Clear api.js arrays (DEALS, CONTRACTORS, notes, docs, etc.)
      clearDemoData();
      // Clear App.jsx-local demo arrays
      PROPERTIES.length      = 0;
      TRANSACTIONS.length    = 0;
      TENANTS.length         = 0;
      MILEAGE_TRIPS.length   = 0;
      MONTHLY_CASH_FLOW.length  = 0;
      EQUITY_GROWTH.length   = 0;
      EXPENSE_CATEGORIES.length = 0;
    }
  }

  const [activeView, setActiveView] = useState("portfolio");

  // Scroll to top whenever the active view changes
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [activeView]);

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

  // Load Supabase-backed entities whenever the auth user changes. Supabase
  // is the source of truth; the in-memory mock arrays are synchronous mirrors
  // so existing component code (which reads them directly) keeps working
  // unchanged. RLS scopes every query to the current user's rows.
  const [propsVersion, setPropsVersion] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [props, txs, tns, dls, rehab, mls, cons, bids, pays, dexps, notes, trips, maint, docs] = await Promise.all([
          listProperties(), listTransactions(), listTenants(),
          listDeals(), listRehabItems(), listMilestones(),
          listContractors(), listContractorBids(), listContractorPayments(),
          listDealExpenses(), listNotes(), listMileageTrips(),
          listMaintenanceRequests(), listDocuments(),
        ]);
        if (cancelled) return;
        PROPERTIES.length = 0;
        PROPERTIES.push(...props);
        TRANSACTIONS.length = 0;
        TRANSACTIONS.push(...txs);
        TENANTS.length = 0;
        TENANTS.push(...tns);
        // Re-nest rehab items into each deal so views that read
        // `deal.rehabItems[]` keep working unchanged. The DB stores them
        // as a separate table, but the in-memory shape stays the same.
        const itemsByDeal = new Map();
        for (const r of rehab) {
          if (!itemsByDeal.has(r.dealId)) itemsByDeal.set(r.dealId, []);
          itemsByDeal.get(r.dealId).push(r);
        }
        DEALS.length = 0;
        DEALS.push(...dls.map(d => ({ ...d, rehabItems: itemsByDeal.get(d.id) || [] })));
        DEAL_MILESTONES.length = 0;
        DEAL_MILESTONES.push(...mls);
        CONTRACTORS.length = 0;
        CONTRACTORS.push(...cons);
        CONTRACTOR_BIDS.length = 0;
        CONTRACTOR_BIDS.push(...bids);
        CONTRACTOR_PAYMENTS.length = 0;
        CONTRACTOR_PAYMENTS.push(...pays);
        DEAL_EXPENSES.length = 0;
        DEAL_EXPENSES.push(...dexps);
        RENTAL_NOTES.length = 0;
        RENTAL_NOTES.push(...notes.rentalNotes);
        DEAL_NOTES.length = 0;
        DEAL_NOTES.push(...notes.dealNotes);
        GENERAL_NOTES.length = 0;
        GENERAL_NOTES.push(...notes.generalNotes);
        MILEAGE_TRIPS.length = 0;
        MILEAGE_TRIPS.push(...trips);
        MAINTENANCE_REQUESTS.length = 0;
        MAINTENANCE_REQUESTS.push(...maint);
        PROPERTY_DOCUMENTS.length = 0;
        PROPERTY_DOCUMENTS.push(...docs.propertyDocs);
        DEAL_DOCUMENTS.length = 0;
        DEAL_DOCUMENTS.push(...docs.dealDocs);
        TENANT_DOCUMENTS.length = 0;
        TENANT_DOCUMENTS.push(...docs.tenantDocs);
        CONTRACTOR_DOCUMENTS.length = 0;
        CONTRACTOR_DOCUMENTS.push(...docs.contractorDocs);
        setPropsVersion(v => v + 1);
      } catch (e) {
        console.error("[PropBooks] Failed to load Supabase data:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Auto-show welcome screen when app is empty
  useEffect(() => {
    if (PROPERTIES.length === 0 && DEALS.length === 0 && activeView === "portfolio") {
      setActiveView("welcome");
    }
  }, [propsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleTenantUpdated = async (tenantId, updates) => {
    try {
      const saved = await dbUpdateTenant(tenantId, updates);
      const idx = TENANTS.findIndex(t => t.id === tenantId);
      if (idx !== -1) TENANTS[idx] = saved;
      if (selectedTenant && selectedTenant.id === tenantId) {
        setSelectedTenant(prev => ({ ...prev, ...saved }));
      }
    } catch (e) {
      console.error("[PropBooks] Update tenant failed:", e);
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
            <LogOut size={15} color="#475569" style={{ cursor: "pointer", flexShrink: 0 }} title="Sign out" onClick={() => { if (window.confirm("Sign out of PROPBOOKS?")) signOut(); }} />
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
                      <Bell size={18} color={showNotifications ? "var(--c-blue)" : "var(--text-secondary)"} />
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
  if (!SUPABASE_CONFIGURED) {
    return <ConfigErrorScreen message={SUPABASE_CONFIG_ERROR} />;
  }
  // user === undefined means we're still resolving the session
  if (user === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e3a5f" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.2)", borderTop: "3px solid #e95e00", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Loading PROPBOOKS…</p>
        </div>
      </div>
    );
  }
  return user ? <AppShell /> : <AuthScreen />;
}

function ConfigErrorScreen({ message }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e3a5f", padding: "24px 16px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "32px 36px", maxWidth: 520, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>⚠</span>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#041830", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>Configuration Error</h2>
        </div>
        <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.55, marginBottom: 16 }}>{message}</p>
        <pre style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#1e293b", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          VITE_SUPABASE_URL=https://your-project.supabase.co{"\n"}
          VITE_SUPABASE_ANON_KEY=your-anon-key
        </pre>
      </div>
    </div>
  );
}
