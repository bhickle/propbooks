// =============================================================================
// AppShell — top-level navigation shell + Supabase hydration loader.
// Owns all the cross-view state (active view, selected entity, highlighted
// items) and renders one of the imported view components based on activeView.
// =============================================================================
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import propbooksLogo from "../logos/PropBooks Horizontal Logo_transparent_white.png";
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
  CalendarDays, RefreshCw,
} from "lucide-react";
import {
  newId, fmt, fmtK,
  STAGE_ORDER, DEFAULT_MILESTONES,
  DEALS, DEAL_EXPENSES, DEAL_MILESTONES, DEAL_NOTES,
  CONTRACTORS, CONTRACTOR_BIDS, CONTRACTOR_DOCUMENTS,
  REHAB_CATEGORIES, REHAB_CATEGORY_GROUPS,
  RENTAL_NOTES, GENERAL_NOTES, MOCK_USER,
  PROPERTY_DOCUMENTS, DEAL_DOCUMENTS, TENANT_DOCUMENTS,
  MAINTENANCE_REQUESTS, TEAM_MEMBERS,
  clearDemoData, restoreDemoData, DEMO_EMAIL,
} from "../api.js";
import { AuthScreen, useAuth } from "../auth.jsx";
import { supabase } from "../supabase.js";
import { InfoTip, Modal, StatCard, iS, EmptyState, Badge } from "../shared.jsx";
import {
  PROPERTIES, TRANSACTIONS, MONTHLY_CASH_FLOW, EQUITY_GROWTH, EXPENSE_CATEGORIES,
  TENANTS, MILEAGE_TRIPS, restoreLocalDemoData,
} from "../mockData.js";
import { calcLoanBalance, getEffectiveMonthly } from "../finance.js";
import { daysAgo, getPropertyHealth } from "../health.js";
import {
  generateAlerts, isAlertSuppressed, snoozeAlert, dismissAlert,
  wasRentPaidThisMonth,
} from "../alerts.jsx";
import { useToast } from "../toast.jsx";
import { useTheme } from "../theme.jsx";
import { Settings, OnboardingWizard } from "../settings.jsx";
import {
  DealDashboard, DealContractors,
  ContractorDetail, DealMilestones,
} from "../deals.jsx";
import { WelcomeScreen } from "./WelcomeScreen.jsx";
import { ThemePicker } from "./ThemePicker.jsx";
import { ImportWizard } from "./ImportWizard.jsx";
import { GlobalSearch } from "./GlobalSearch.jsx";
import { MileageTracker } from "./MileageTracker.jsx";
import { DealAnalyzer } from "./DealAnalyzer.jsx";
import { RentalWizard } from "./RentalWizard.jsx";
import { FlipWizard } from "./FlipWizard.jsx";
import { UnifiedNotes } from "./UnifiedNotes.jsx";
import { Properties } from "./Properties.jsx";
import { PropertyDetail } from "./PropertyDetail.jsx";
import { TenantManagement } from "./TenantManagement.jsx";
import { TenantDetail } from "./TenantDetail.jsx";
import { UnifiedReports } from "./UnifiedReports.jsx";
import { UnifiedAnalytics } from "./UnifiedAnalytics.jsx";
import { UnifiedDashboard } from "./UnifiedDashboard.jsx";
import { AssetList } from "./AssetList.jsx";
import { Ledger } from "./Ledger.jsx";
import { RehabItemDetail } from "./RehabItemDetail.jsx";
import { DealDetail } from "./DealDetail.jsx";
import { listProperties } from "../db/properties.js";
import { listTransactions } from "../db/transactions.js";
import { listTenants, updateTenant as dbUpdateTenant } from "../db/tenants.js";
import {
  listDeals, updateDeal as dbUpdateDeal, deleteDeal as dbDeleteDeal,
  createDeal as dbCreateDeal,
} from "../db/deals.js";
import { listMilestones, updateMilestone as dbUpdateMilestone } from "../db/dealMilestones.js";
import { listRehabItems, updateRehabItem as dbUpdateRehabItem } from "../db/dealRehabItems.js";
import {
  listContractors, createContractor as dbCreateContractor,
  updateContractor as dbUpdateContractor,
  linkContractorToDeal as dbLinkContractorToDeal,
} from "../db/contractors.js";
import { listContractorBids } from "../db/contractorBids.js";
import { listDealExpenses } from "../db/dealExpenses.js";
import {
  listNotes, createDealNote as dbCreateDealNote,
  updateNote as dbUpdateNote, deleteNote as dbDeleteNote,
} from "../db/notes.js";
import { listMileageTrips } from "../db/mileageTrips.js";
import { listMaintenanceRequests } from "../db/maintenanceRequests.js";
import { listAccountMembers } from "../db/accounts.js";
import {
  listDocuments, createDocument as dbCreateDocument,
  deleteDocument as dbDeleteDocument,
} from "../db/documents.js";

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

export function AppShell() {
  const { user, signOut, refreshProfile } = useAuth();
  const { theme, toggleTheme, applyServerTheme } = useTheme();

  // Sync the server-side theme preference into the live ThemeProvider whenever
  // the profile hydrates with a saved value. localStorage carries the splash
  // through to first paint; this overrides if the user picked something on
  // another device.
  useEffect(() => {
    if (!user) return;
    if (user.themePreference && user.themePreference !== theme) {
      applyServerTheme(user.themePreference);
    }
  }, [user?.themePreference, user?.id]);

  // Persist toggle changes back to profile.theme_preference so the choice
  // follows the user across devices. Skipped when the value is already in
  // sync (initial hydration, or right after an explicit pick).
  useEffect(() => {
    if (!user?.id) return;
    if (!user.themePreference) return; // first-time picker handles the initial write
    if (user.themePreference === theme) return;
    supabase.from("profiles").update({ theme_preference: theme }).eq("id", user.id)
      .then(({ error }) => {
        if (error) { console.error("[PropBooks] Save theme preference failed:", error); return; }
        refreshProfile?.();
      });
  }, [theme, user?.id, user?.themePreference]);

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
  // Show onboarding when the profile.has_onboarded flag is false. Demo
  // users never see it (their account is pre-populated; the migration
  // marked all pre-launch profiles as onboarded).
  const isDemoForOnboarding = user?.email === DEMO_EMAIL;
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (isDemoForOnboarding) { setShowOnboarding(false); return; }
    if (user && user.hasOnboarded === false) setShowOnboarding(true);
  }, [user?.id, user?.hasOnboarded, isDemoForOnboarding]);

  // Import Wizard is mounted at the shell level so any screen (empty-state
  // CTAs on Assets / Ledger, Settings → Import tab, future spots) can open
  // it without each one re-mounting the component.
  const [showImportWizard, setShowImportWizard] = useState(false);

  // ThemePicker dismissal guard. Once the user picks (or closes the modal),
  // we never re-mount it in this session — even if profile state briefly
  // shows themePreference as null between the local setTheme and the
  // server write reflecting back. Resets per user.id (new login).
  const [themePickerDismissed, setThemePickerDismissed] = useState(false);
  useEffect(() => { setThemePickerDismissed(false); }, [user?.id]);
  const [hydrating, setHydrating] = useState(true);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const { showToast } = useToast();
  // Ledger highlight key: "tx-<id>" or "dx-<id>" — used when routing in from
  // Dashboard / PortfolioDashboard / global search now that the legacy
  // Transactions and DealExpenses screens are gone.
  const [highlightLedgerKey, setHighlightLedgerKey] = useState(null);
  const [ledgerInitialAssetFilter, setLedgerInitialAssetFilter] = useState(null);
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
  // Bump version + replace selectedDeal with a fresh shallow copy so DealDetail
  // sees a new prop reference and re-renders. Without the new reference,
  // mutations to DEALS[idx] in place don't propagate (same object identity).
  const onDealUpdated = useCallback(() => {
    setDealVersion(v => v + 1);
    setSelectedDeal(prev => {
      if (!prev) return prev;
      const fresh = DEALS.find(d => d.id === prev.id);
      return fresh ? { ...fresh } : prev;
    });
  }, []);
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
    setHydrating(true);
    (async () => {
      try {
        const [props, txs, tns, dls, rehab, mls, cons, bids, dexps, notes, trips, maint, docs, members] = await Promise.all([
          listProperties(), listTransactions(), listTenants(),
          listDeals(), listRehabItems(), listMilestones(),
          listContractors(), listContractorBids(),
          listDealExpenses(), listNotes(), listMileageTrips(),
          listMaintenanceRequests(), listDocuments(),
          listAccountMembers(),
        ]);
        if (cancelled) return;
        // Demo account fallback: if the demo user's Supabase rows are empty
        // (e.g. just after Reset Demo Data), keep the in-memory mock seed
        // populated by restoreDemoData()/restoreLocalDemoData() above instead
        // of overwriting it with empty arrays. Without this, a hard refresh
        // after a reset would show a blank app.
        const supabaseEmpty = props.length === 0 && txs.length === 0 && tns.length === 0 && dls.length === 0;
        if (isDemo && supabaseEmpty) {
          restoreDemoData();
          restoreLocalDemoData();
          setPropsVersion(v => v + 1);
          setHydrating(false);
          return;
        }
        PROPERTIES.length = 0;
        PROPERTIES.push(...props);
        TRANSACTIONS.length = 0;
        TRANSACTIONS.push(...txs);
        TENANTS.length = 0;
        TENANTS.push(...tns);
        // Re-nest rehab items into each deal so views that read
        // `deal.rehabItems[]` keep working unchanged. The DB stores them
        // as a separate table, but the in-memory shape stays the same.
        // Each rehab item's contractors[] is derived from contractor_bids
        // (a bid linking the contractor to the item's category counts as
        // an assignment; bid.amount populates the per-contractor bid).
        const bidsByDealItem = new Map();
        for (const b of bids) {
          const key = `${b.dealId}::${b.rehabItem || ""}`;
          if (!bidsByDealItem.has(key)) bidsByDealItem.set(key, []);
          bidsByDealItem.get(key).push(b);
        }
        const itemsByDeal = new Map();
        for (const r of rehab) {
          if (!itemsByDeal.has(r.dealId)) itemsByDeal.set(r.dealId, []);
          const itemBids = bidsByDealItem.get(`${r.dealId}::${r.category}`) || [];
          const seen = new Set();
          const contractors = [];
          for (const b of itemBids) {
            if (seen.has(b.contractorId)) continue;
            seen.add(b.contractorId);
            contractors.push({ id: b.contractorId, bid: b.amount || 0 });
          }
          // The DB stores the canonical slug as `slug`; the UI reads
          // `canonicalCategory`. Mirror it back so linked-expense matching
          // and category lookups keep working after hydration.
          itemsByDeal.get(r.dealId).push({ ...r, canonicalCategory: r.slug, contractors });
        }
        DEALS.length = 0;
        DEALS.push(...dls.map(d => ({ ...d, rehabItems: itemsByDeal.get(d.id) || [] })));
        DEAL_MILESTONES.length = 0;
        DEAL_MILESTONES.push(...mls);
        CONTRACTORS.length = 0;
        CONTRACTORS.push(...cons);
        CONTRACTOR_BIDS.length = 0;
        CONTRACTOR_BIDS.push(...bids);
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
        // Real teammates for @mention support. Empty array is fine —
        // single-user accounts just won't surface a dropdown.
        TEAM_MEMBERS.length = 0;
        TEAM_MEMBERS.push(...(members || []));
        setPropsVersion(v => v + 1);
        setHydrating(false);
      } catch (e) {
        console.error("[PropBooks] Failed to load Supabase data:", e);
        if (!cancelled) {
          setHydrating(false);
          showToast("Couldn't load your data — " + (e.message || "check your connection and refresh"));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- showToast is stable from provider

  // (Removed: legacy redirect to the standalone WelcomeScreen on empty
  // portfolio. The new welcome card lives inside PortfolioDashboard so users
  // land on the dashboard with onboarding choices in-context rather than on
  // a separate route that has no Import option.)

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
      showToast("Couldn't update tenant — " + (e.message || "unknown error"));
    }
  };

  const navigateToTransaction = (txId) => {
    setHighlightLedgerKey("tx-" + txId);
    setLedgerInitialAssetFilter(null);
    setActiveView("ledger");
  };

  const navigateToDealExpense = (expId) => {
    setHighlightLedgerKey("dx-" + expId);
    setLedgerInitialAssetFilter(null);
    setActiveView("ledger");
  };

  // After consolidation: a single flat top-level nav. Portfolio + the per-kind
  // dashboards live behind one "Dashboard" entry (UnifiedDashboard wraps them
  // with a tab toggle). Rentals/Rehabs sub-sections are gone — the unified
  // Assets / Ledger / Contractors / Tenants / Analytics / Reports cover both.
  // The "properties" / "deals" / "dealdashboard" / "portfolio" activeView IDs
  // stay registered downstream so deep-link back-nav from detail screens
  // doesn't break.

  // Cross-cutting tools — apply to both rentals and rehabs
  const toolNavItems = [
    { id: "notes",         label: "Notes",            icon: MessageSquare },
    { id: "dealanalyzer",  label: "Investment Analyzer", icon: Calculator },
    { id: "mileage",       label: "Mileage Tracker",  icon: Car        },
  ];

  const handlePropertySelect = (p) => {
    setSelectedProperty(p);
    setActiveView("propertyDetail");
  };

  const [dealInitialTab, setDealInitialTab] = useState(null);
  const [dealNavSource, setDealNavSource] = useState(null); // "dealdashboard" | "deals" | "portfolio" | null
  const [prevDealNavSource, setPrevDealNavSource] = useState(null); // preserves dealNavSource during sub-navigation

  // ── Browser back/forward sync ──────────────────────────────────────────
  // Keep window.history in lockstep with the navigation state so the browser
  // back/forward arrows feel native. We push a new entry on every meaningful
  // navigation change and restore the matching state on popstate.
  // URL stays at "/" — this is just session history, not bookmarkable URLs.
  const isInitialNav = useRef(true);
  const isPopping = useRef(false);
  useEffect(() => {
    const navState = {
      activeView,
      selectedPropertyId: selectedProperty?.id || null,
      selectedDealId: selectedDeal?.id || null,
      selectedTenantId: selectedTenant?.id || null,
      selectedContractorId: selectedContractor?.id || null,
      selectedRehabItem,
      propDetailTab,
      dealInitialTab,
      contractorInitialTab,
      navSource,
      dealNavSource,
    };
    if (isInitialNav.current) {
      isInitialNav.current = false;
      window.history.replaceState(navState, "");
      return;
    }
    if (isPopping.current) {
      isPopping.current = false;
      return;
    }
    window.history.pushState(navState, "");
  }, [
    activeView,
    selectedProperty?.id, selectedDeal?.id, selectedTenant?.id,
    selectedContractor?.id, selectedRehabItem,
    propDetailTab, dealInitialTab, contractorInitialTab,
    navSource, dealNavSource,
  ]);

  useEffect(() => {
    const onPop = (e) => {
      isPopping.current = true;
      const s = e.state;
      if (!s) {
        setActiveView("portfolio");
        setSelectedProperty(null);
        setSelectedDeal(null);
        setSelectedTenant(null);
        setSelectedContractor(null);
        setSelectedRehabItem(null);
        setPropDetailTab(null);
        setDealInitialTab(null);
        setContractorInitialTab(null);
        setNavSource(null);
        setDealNavSource(null);
        return;
      }
      setActiveView(s.activeView || "portfolio");
      setSelectedProperty(s.selectedPropertyId ? PROPERTIES.find(p => p.id === s.selectedPropertyId) || null : null);
      setSelectedDeal(s.selectedDealId ? (() => { const d = DEALS.find(x => x.id === s.selectedDealId); return d ? { ...d } : null; })() : null);
      setSelectedTenant(s.selectedTenantId ? TENANTS.find(t => t.id === s.selectedTenantId) || null : null);
      setSelectedContractor(s.selectedContractorId ? CONTRACTORS.find(c => c.id === s.selectedContractorId) || null : null);
      setSelectedRehabItem(s.selectedRehabItem || null);
      setPropDetailTab(s.propDetailTab || null);
      setDealInitialTab(s.dealInitialTab || null);
      setContractorInitialTab(s.contractorInitialTab || null);
      setNavSource(s.navSource || null);
      setDealNavSource(s.dealNavSource || null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Unified back handler used by every detail screen's onBack callback.
  // Routes through window.history.back() so the in-app back button and
  // the browser back arrow share the same history stack — popstate
  // restores activeView / selected entity / tab from the previous entry.
  // Falls back to setActiveView for the rare case there's no history yet
  // (e.g. user landed directly on a deep view).
  const goBack = (fallbackView = "portfolio") => {
    // Short-lived UI flags aren't part of nav state — clear them so a
    // stale highlight doesn't carry across.
    setHighlightLedgerKey(null);
    setHighlightTenantId(null);
    setHighlightNoteId(null);
    setHighlightDealNoteId(null);
    setHighlightMilestoneKey(null);
    setPropDetailTenantHighlight(null);
    setNotesAutoAdd(false);
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    setActiveView(fallbackView);
    setSelectedProperty(null);
    setSelectedDeal(null);
    setSelectedTenant(null);
    setSelectedContractor(null);
    setSelectedRehabItem(null);
    setPropDetailTab(null);
    setDealInitialTab(null);
    setContractorInitialTab(null);
    setNavSource(null);
    setDealNavSource(null);
    setPrevNavSource(null);
    setPrevDealNavSource(null);
  };

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
            <img src={propbooksLogo} alt="PROPBOOKS" style={{ height: 40, objectFit: "contain" }} />
          </div>
        </div>
        <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
          {/* Dashboard — UnifiedDashboard wraps Portfolio + rental + rehab dashboards */}
          {(() => {
            const isDashActive = activeView === "dashboard" || activeView === "portfolio" || activeView === "dealdashboard";
            return (
              <>
                <button onClick={() => { setActiveView("dashboard"); setSelectedProperty(null); setSelectedDeal(null); setHighlightLedgerKey(null); setNavSource(null); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: isDashActive ? "rgba(139,92,246,0.2)" : "transparent", color: isDashActive ? "#c4b5fd" : "#64748b", fontWeight: isDashActive ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
                  onMouseEnter={e => { if (!isDashActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { if (!isDashActive) e.currentTarget.style.background = "transparent"; }}>
                  <PieChartIcon size={17} />
                  Dashboard
                  {isDashActive && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
                </button>
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 8px 12px" }} />
              </>
            );
          })()}
          {/* Assets — unified rental + rehab listing */}
          <button onClick={() => { setActiveView("assets"); setSelectedProperty(null); setSelectedDeal(null); setHighlightLedgerKey(null); setNavSource(null); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: activeView === "assets" ? "rgba(233,94,0,0.2)" : "transparent", color: activeView === "assets" ? "#fbbf77" : "#64748b", fontWeight: activeView === "assets" ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
            onMouseEnter={e => { if (activeView !== "assets") e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { if (activeView !== "assets") e.currentTarget.style.background = "transparent"; }}>
            <Building2 size={17} />
            Assets
          </button>
          {/* Ledger (preview) — unified money in/out across rentals + rehabs */}
          <button onClick={() => { setActiveView("ledger"); setSelectedProperty(null); setSelectedDeal(null); setHighlightLedgerKey(null); setNavSource(null); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: activeView === "ledger" ? "rgba(233,94,0,0.2)" : "transparent", color: activeView === "ledger" ? "#fbbf77" : "#64748b", fontWeight: activeView === "ledger" ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
            onMouseEnter={e => { if (activeView !== "ledger") e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { if (activeView !== "ledger") e.currentTarget.style.background = "transparent"; }}>
            <ArrowUpDown size={17} />
            Ledger
          </button>
          {/* Contractors — top-level so the same plumber who fixes a tenant
              drain and the one demoing a rehab lives in one place */}
          <button onClick={() => { setActiveView("dealcontractors"); setSelectedProperty(null); setSelectedDeal(null); setHighlightLedgerKey(null); setNavSource(null); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: activeView === "dealcontractors" ? "rgba(233,94,0,0.2)" : "transparent", color: activeView === "dealcontractors" ? "#fbbf77" : "#64748b", fontWeight: activeView === "dealcontractors" ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
            onMouseEnter={e => { if (activeView !== "dealcontractors") e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { if (activeView !== "dealcontractors") e.currentTarget.style.background = "transparent"; }}>
            <Users size={17} />
            Contractors
          </button>
          {/* Tenants — promoted to top-level. Conceptually rental-only, but
              there's no longer a Rentals sub-section to bury it under. */}
          {(() => {
            const isActive = activeView === "tenants" || activeView === "tenantDetail";
            return (
              <button onClick={() => { setActiveView("tenants"); setSelectedProperty(null); setSelectedDeal(null); setHighlightLedgerKey(null); setNavSource(null); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: isActive ? "rgba(59,130,246,0.2)" : "transparent", color: isActive ? "#93c5fd" : "#64748b", fontWeight: isActive ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                <UserCheck size={17} />
                Tenants
                {isActive && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })()}
          {/* Analytics (unified across rentals + rehabs, tab toggle inside) */}
          <button onClick={() => { setActiveView("analytics"); setSelectedProperty(null); setSelectedDeal(null); setHighlightLedgerKey(null); setNavSource(null); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: activeView === "analytics" ? "rgba(233,94,0,0.2)" : "transparent", color: activeView === "analytics" ? "#fbbf77" : "#64748b", fontWeight: activeView === "analytics" ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
            onMouseEnter={e => { if (activeView !== "analytics") e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { if (activeView !== "analytics") e.currentTarget.style.background = "transparent"; }}>
            <BarChart3 size={17} />
            Analytics
          </button>
          {/* Reports (unified across rentals + rehabs, tab toggle inside) */}
          <button onClick={() => { setActiveView("reports"); setSelectedProperty(null); setSelectedDeal(null); setHighlightLedgerKey(null); setNavSource(null); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: activeView === "reports" ? "rgba(233,94,0,0.2)" : "transparent", color: activeView === "reports" ? "#fbbf77" : "#64748b", fontWeight: activeView === "reports" ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}
            onMouseEnter={e => { if (activeView !== "reports") e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { if (activeView !== "reports") e.currentTarget.style.background = "transparent"; }}>
            <FileText size={17} />
            Reports
          </button>
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "14px 8px 12px" }} />
          <p style={{ color: "var(--text-label)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>Tools</p>
          {toolNavItems.map(item => {
            const active = activeView === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedDeal(null); setSelectedProperty(null); setHighlightLedgerKey(null); setNavSource(null); }}
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
            <LogOut size={15} color="#475569" style={{ cursor: "pointer", flexShrink: 0 }} title="Sign out" onClick={() => setShowSignOutConfirm(true)} />
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
               activeView === "portfolio" ? "Dashboard" :
               activeView === "dashboard" ? "Dashboard" :
               activeView === "dealdashboard" ? "Dashboard" :
               activeView === "assets" ? "Assets" :
               activeView === "ledger" ? "Ledger" :
               activeView === "dealcontractors" ? "Contractors" :
               activeView === "contractorDetail" && selectedContractor ? selectedContractor.name :
               activeView === "tenants" ? "Tenants" :
               activeView === "analytics" ? "Analytics" :
               activeView === "reports" ? "Reports" :
               activeView === "properties" ? "Properties" :
               activeView === "deals" ? "Rehabs" :
               activeView === "dealrehab" ? "Rehab Tracker" :
               activeView === "dealmilestones" ? "Milestones" :
               activeView === "rehabItemDetail" ? "Scope Item" :
               toolNavItems.find(n => n.id === activeView)?.label || ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <GlobalSearch onNavigate={(item) => {
              if (item.type === "property") { handlePropertySelect(item.data); }
              else if (item.type === "tenant") { handleTenantSelect(item.data, "tenants"); }
              else if (item.type === "deal") { handleDealSelect(item.data, null, "deals"); }
              else if (item.type === "transaction") { setHighlightLedgerKey("tx-" + item.data.id); setLedgerInitialAssetFilter(null); setActiveView("ledger"); }
              else if (item.type === "contractor") { setSelectedContractor(item.data); setActiveView("contractorDetail"); }
              else if (item.type === "rental-note") { setHighlightNoteId(item.data.id); setActiveView("notes"); }
              else if (item.type === "deal-note") { setHighlightDealNoteId(item.data.id); setActiveView("notes"); }
              else if (item.type === "deal-expense") { setHighlightLedgerKey("dx-" + item.data.id); setLedgerInitialAssetFilter(null); setActiveView("ledger"); }
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
                TENANTS.filter(t => (t.status === "active-lease" || t.status === "month-to-month") && t.leaseEnd).forEach(t => {
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
                DEAL_MILESTONES.forEach(ms => {
                  if (ms.done || !ms.targetDate) return;
                  const overdueDays = Math.round((today - new Date(ms.targetDate)) / 86400000);
                  if (overdueDays <= 0) return;
                  const deal = DEALS.find(d => d.id === ms.dealId);
                  if (!deal) return;
                  notifications.push({ id: "ms-" + deal.id + "-" + ms.id, type: "danger", icon: "flag", title: "Overdue milestone", body: `${ms.label} — ${deal.name} (${overdueDays}d overdue)`, action: () => { handleDealSelect(deal, "milestones", "notifications"); setShowNotifications(false); } });
                });
                // Vacant units
                PROPERTIES.forEach(p => {
                  const occupied = TENANTS.filter(t => t.propertyId === p.id && (t.status === "active-lease" || t.status === "month-to-month")).length;
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
        <div style={{ flex: 1, padding: 32, maxWidth: 1400, width: "100%", position: "relative" }}>
          {hydrating && (
            <div style={{ position: "absolute", inset: 0, background: "var(--app-bg, rgba(255,255,255,0.85))", backdropFilter: "blur(2px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 50, gap: 12 }}>
              <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "#e95e00", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Loading your portfolio…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {(activeView === "dashboard" || activeView === "portfolio" || activeView === "dealdashboard") && (
            <UnifiedDashboard
              portfolioProps={{
                onNavigate: (view) => { if (view === "notes-add") { setNotesAutoAdd(true); setActiveView("notes"); } else { setActiveView(view); } },
                onSelectProperty: (p, tab) => { setNavSource("portfolio"); setPropDetailTab(tab || null); setPropDetailTenantHighlight(null); handlePropertySelect(p); },
                onSelectFlip:     (f, tab) => { setNavSource("portfolio"); handleDealSelect(f, tab || null, "portfolio"); },
                onNavigateToTx:   (txId) => { setHighlightLedgerKey("tx-" + txId); setLedgerInitialAssetFilter(null); setActiveView("ledger"); },
                onNavigateToDealExpense: (expId) => { setHighlightLedgerKey("dx-" + expId); setLedgerInitialAssetFilter(null); setActiveView("ledger"); },
                onNavigateToLease: (prop, tenantId) => { setSelectedProperty(prop); setPropDetailTab("tenants"); setPropDetailTenantHighlight(tenantId); setNavSource("portfolio"); setActiveView("propertyDetail"); },
                onSelectContractor: (c) => { setSelectedContractor(c); setContractorInitialTab(null); setNavSource("portfolio"); setActiveView("contractorDetail"); },
                onAddRental: () => setActiveView("rentalWizard"),
                onAddFlip:   () => setActiveView("flipWizard"),
                onImport:    () => setShowImportWizard(true),
                isDemo:      isDemoForOnboarding,
              }}
              rentalProps={{
                onNavigate: setActiveView,
                onNavigateToTx: navigateToTransaction,
                onSelectProperty: handlePropertySelect,
                onNavigateToTenantAdd: (propId, unit) => { setPrefillTenant({ propertyId: propId, unit }); setActiveView("tenants"); },
                onNavigateToNote: (noteId) => { setHighlightNoteId(noteId); setNavSource("dashboard"); setActiveView("notes"); },
                onNavigateToLease: (prop, tenantId) => { setSelectedProperty(prop); setPropDetailTab("tenants"); setPropDetailTenantHighlight(tenantId); setNavSource("dashboard"); setActiveView("propertyDetail"); },
              }}
              projectProps={{
                onSelect: (f, tab) => handleDealSelect(f, tab, "dealdashboard"),
                onNavigateToNote: (noteId) => { setHighlightDealNoteId(noteId); setNavSource("dealdashboard"); setActiveView("notes"); },
                onNavigateToExpense: (expId) => { setHighlightLedgerKey("dx-" + expId); setLedgerInitialAssetFilter(null); setActiveView("ledger"); },
                onNavigateToMilestone: (msKey) => { setHighlightMilestoneKey(msKey); setNavSource("dealdashboard"); setActiveView("dealmilestones"); },
              }}
            />
          )}
          {activeView === "assets" && <AssetList
            onSelectRental={handlePropertySelect}
            onSelectFlip={(f) => handleDealSelect(f, null, "assets")}
            onAddRental={() => setActiveView("rentalWizard")}
            onAddFlip={() => setActiveView("flipWizard")}
            onImport={() => setShowImportWizard(true)}
            isDemo={isDemoForOnboarding}
          />}
          {activeView === "ledger" && <Ledger
            highlightRowKey={highlightLedgerKey}
            initialAssetFilter={ledgerInitialAssetFilter}
            onClearHighlight={() => { setHighlightLedgerKey(null); setLedgerInitialAssetFilter(null); }}
            onImport={() => setShowImportWizard(true)}
            isDemo={isDemoForOnboarding}
          />}
          {/* Properties view is gone — AssetList replaced the list. The
              edit/add modal lives in <Properties> below, rendered outside
              the activeView switch so it pops up wherever the user is. */}
          {activeView === "propertyDetail" && selectedProperty && <PropertyDetail key={selectedProperty.id + "-" + (propDetailTab || "overview") + "-" + (propDetailTenantHighlight || "")} property={selectedProperty} onBack={() => goBack(navSource === "dashboard" ? "dashboard" : navSource === "portfolio" ? "portfolio" : "assets")} backLabel={navSource === "dashboard" ? "Back to Dashboard" : navSource === "portfolio" ? "Back to Portfolio" : "Back to Assets"} onEditProperty={(p) => { setEditPropertyId(p.id); }} onGoToTransactions={() => { setHighlightLedgerKey(null); setLedgerInitialAssetFilter("rental:" + selectedProperty.id); setActiveView("ledger"); }} onNavigateToTransaction={(txId) => { if (txId) setHighlightLedgerKey("tx-" + txId); setLedgerInitialAssetFilter("rental:" + selectedProperty.id); setActiveView("ledger"); }} onNavigateToTenant={(tenantId) => { const t = TENANTS.find(x => x.id === tenantId); if (t) { handleTenantSelect(t, "propertyDetail"); } }} onPropertyUpdated={() => { const fresh = PROPERTIES.find(p => p.id === selectedProperty.id); if (fresh) setSelectedProperty({ ...fresh }); }} initialTab={propDetailTab} highlightTenantId={propDetailTenantHighlight} onClearHighlightTenant={() => setPropDetailTenantHighlight(null)} />}
          {activeView === "analytics" && <UnifiedAnalytics />}
          {activeView === "notes" && <UnifiedNotes highlightNoteId={highlightNoteId} highlightDealNoteId={highlightDealNoteId} autoOpenAdd={notesAutoAdd} onBack={(navSource === "dashboard" || navSource === "dealdashboard") ? () => goBack(navSource) : null} onClearHighlight={() => { setHighlightNoteId(null); setHighlightDealNoteId(null); setNotesAutoAdd(false); }} />}
          {activeView === "reports" && <UnifiedReports />}
          {/* Old "dealdashboard" route folded into UnifiedDashboard above */}
          {/* "deals" route retired — Assets covers the rehab list. */}
          {activeView === "dealDetail"      && selectedDeal && <ErrorBoundary key={"eb-" + selectedDeal.id}><DealDetail key={selectedDeal.id + "-" + (dealInitialTab || "overview")} deal={selectedDeal} onBack={() => goBack(dealNavSource || "assets")} backLabel={dealNavSource === "dealdashboard" ? "Back to Dashboard" : dealNavSource === "portfolio" ? "Back to Portfolio" : "Back to Assets"} onNavigateToExpense={navigateToDealExpense} onNavigateToContractor={(con, tab) => { setSelectedContractor(con); setContractorInitialTab(tab || null); setPrevDealNavSource(dealNavSource); setNavSource("dealDetail"); setActiveView("contractorDetail"); }} onNavigateToRehabItem={(idx) => { setSelectedRehabItem({ dealId: selectedDeal.id, itemIdx: idx }); setNavSource("dealDetail"); setPrevDealNavSource(dealNavSource); setActiveView("rehabItemDetail"); }} initialTab={dealInitialTab} onConvertToRental={(flipData) => { setConvertDealData(flipData); }} onDealUpdated={onDealUpdated} onNavigateToDeal={(f) => handleDealSelect(f, null, dealNavSource || "assets")} /></ErrorBoundary>}
          {activeView === "rehabItemDetail" && selectedRehabItem && (() => {
            const rDeal = DEALS.find(f => f.id === selectedRehabItem.dealId);
            if (!rDeal) return null;
            return <RehabItemDetail
              deal={rDeal}
              itemIdx={selectedRehabItem.itemIdx}
              onBack={() => goBack("dealDetail")}
              backLabel={`Back to ${rDeal.name}`}
              onNavigateToContractor={(con, tab) => { setSelectedContractor(con); setContractorInitialTab(tab || null); setNavSource("rehabItemDetail"); setActiveView("contractorDetail"); }}
              onNavigateToExpense={(expId) => { setHighlightLedgerKey("dx-" + expId); setLedgerInitialAssetFilter(null); setActiveView("ledger"); }}
            />;
          })()}
          {activeView === "dealcontractors" && <DealContractors onSelectContractor={handleSelectContractor} />}
          {activeView === "contractorDetail" && selectedContractor && <ContractorDetail contractor={selectedContractor} initialTab={contractorInitialTab} onBack={() => goBack(navSource === "portfolio" ? "portfolio" : "dealcontractors")} />}
          {activeView === "dealmilestones"  && <DealMilestones highlightMilestoneKey={highlightMilestoneKey} onBack={navSource === "dealdashboard" ? () => goBack("dealdashboard") : null} onClearHighlight={() => setHighlightMilestoneKey(null)} />}
          {activeView === "tenants" && <TenantManagement onBack={navSource === "propertyDetail" ? () => goBack("propertyDetail") : null} highlightTenantId={highlightTenantId} onClearHighlight={() => setHighlightTenantId(null)} prefillTenant={prefillTenant} onClearPrefill={() => setPrefillTenant(null)} onSelectTenant={(t) => handleTenantSelect(t, "tenants")} />}
          {activeView === "tenantDetail" && selectedTenant && <TenantDetail tenant={selectedTenant} onBack={() => goBack(navSource || "tenants")} backLabel={navSource === "propertyDetail" ? "Back to Property" : "Back to Tenants"} onTenantUpdated={handleTenantUpdated} />}
          {activeView === "mileage" && <MileageTracker />}
          {activeView === "dealanalyzer" && <DealAnalyzer />}
          {activeView === "rentalWizard" && <RentalWizard onComplete={() => setActiveView("assets")} onExit={() => setActiveView("assets")} />}
          {activeView === "flipWizard" && <FlipWizard onComplete={() => setActiveView("assets")} onExit={() => setActiveView("assets")} />}
          {activeView === "welcome" && <WelcomeScreen onStartRental={() => setActiveView("rentalWizard")} onStartFlip={() => setActiveView("flipWizard")} />}
        </div>
      </div>

      {/* Property edit/convert modal — rendered as a permanent overlay so
          PropertyDetail's Edit button and DealDetail's Convert-to-Rental
          button can trigger it without changing activeView. */}
      <Properties
        onSelect={handlePropertySelect}
        editPropertyId={editPropertyId}
        onClearEditId={() => setEditPropertyId(null)}
        convertDealData={convertDealData}
        onClearConvertFlip={() => setConvertDealData(null)}
        onGuidedSetup={() => setActiveView("rentalWizard")}
        onComplete={() => {
          setEditPropertyId(null);
          setConvertDealData(null);
          // Refresh selectedProperty from the global PROPERTIES array so
          // PropertyDetail re-renders with the saved values. Without this,
          // PropertyDetail keeps holding the stale object reference it had
          // before the edit modal opened.
          if (selectedProperty) {
            const fresh = PROPERTIES.find(p => p.id === selectedProperty.id);
            if (fresh) setSelectedProperty(fresh);
          }
        }}
      />

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width: "min(880px, 95vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
            <Settings onClose={() => setShowSettings(false)} onLaunchImport={() => { setShowSettings(false); setShowImportWizard(true); }} />
          </div>
        </div>
      )}

      {/* ThemePicker — one-time on first login (themePreference is null).
          Shown before OnboardingWizard so onboarding renders in the chosen
          theme. The dismiss guard makes this a strict once-per-session
          modal so any profile-state churn between local setTheme and the
          server write reflecting back can't make it flicker. */}
      {user && user.themePreference === null && !themePickerDismissed && (
        <ThemePicker user={user} onComplete={() => {
          setThemePickerDismissed(true);
          refreshProfile?.();
        }} />
      )}

      {/* Onboarding Wizard (new users only — and only after they've picked a theme) */}
      {showOnboarding && user?.themePreference !== null && (
        <OnboardingWizard onComplete={async () => {
          setShowOnboarding(false);
          // Persist so the wizard doesn't reappear on next login. RLS scopes
          // the update to this user's own row; the trigger ensures the row
          // exists. Silent failure here just means the modal returns later —
          // an inconvenience, not a data integrity issue.
          if (user?.id) {
            try {
              await supabase.from("profiles").update({ has_onboarded: true }).eq("id", user.id);
              refreshProfile?.();
            } catch (e) { console.error("[PropBooks] Failed to mark onboarded:", e); }
          }
        }} />
      )}

      {/* Import Wizard — opened from Settings → Import or from empty-state
          CTAs on AssetList / Ledger. Disabled on demo so the shared sample
          portfolio doesn't get clobbered. */}
      {showImportWizard && !isDemoForOnboarding && (
        <ImportWizard
          onClose={() => setShowImportWizard(false)}
          onComplete={() => { setPropsVersion(v => v + 1); }}
        />
      )}

      {/* Sign-out confirmation */}
      {showSignOutConfirm && (
        <Modal title="Sign out?" onClose={() => setShowSignOutConfirm(false)} width={400}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>You'll need to sign in again to get back to your portfolio.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowSignOutConfirm(false)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { setShowSignOutConfirm(false); signOut(); }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#e95e00", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Sign out</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
