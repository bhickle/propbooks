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
import { RehabItemDetail } from "./views/RehabItemDetail.jsx";
import { DealDetail } from "./views/DealDetail.jsx";
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

// DealDetail moved to ./views/DealDetail.jsx

// ---------------------------------------------
// RENT ROLL
// ---------------------------------------------
// TenantManagement moved to views/TenantManagement.jsx

// ---------------------------------------------
// REHAB ITEM DETAIL
// ---------------------------------------------
// RehabItemDetail moved to ./views/RehabItemDetail.jsx

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
