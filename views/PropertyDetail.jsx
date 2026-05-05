import { useState, useEffect, useMemo } from "react";
import {
  FileText, Home, Plus, Search, ChevronRight, CheckCircle, AlertCircle, X,
  ChevronDown, User, MapPin, Clock, Users, Receipt, Trash2, Pencil, MessageSquare,
  ArrowLeft, Paperclip, ScanLine,
} from "lucide-react";
import {
  newId, fmt,
  PROPERTY_DOCUMENTS,
  TRANSACTION_RECEIPTS, addTransactionReceipt,
  RENTAL_NOTES,
} from "../api.js";
import { createTransaction, updateTransaction, deleteTransaction } from "../db/transactions.js";
import { createRentalNote, updateNote as dbUpdateNote, deleteNote as dbDeleteNote } from "../db/notes.js";
import { createDocument as dbCreateDocument, deleteDocument as dbDeleteDocument } from "../db/documents.js";
import { calcLoanBalance, getEffectiveMonthly, calcCapRate, calcCashOnCash } from "../finance.js";
import { daysAgo, getPropertyHealth } from "../health.js";
import { InfoTip, Modal, StatCard, Badge, iS } from "../shared.jsx";
import { TRANSACTIONS, TENANTS } from "../mockData.js";
import { AttachmentZone, AttachmentList, OcrPrompt, DocumentsPanel } from "./Attachments.jsx";
import { TxDetailPanel } from "./detailPanels.jsx";

export function PropertyDetail({ property, onBack, backLabel, onEditProperty, onGoToTransactions, onNavigateToTransaction, onNavigateToTenant, initialTab, highlightTenantId, onClearHighlightTenant }) {
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
  }, [highlightTenantId]); // eslint-disable-line react-hooks/exhaustive-deps -- onClearHighlightTenant is an inline parent callback (new ref every render)

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

  const txHandleSave = async () => {
    if (!txForm.description || !txForm.amount) return;
    const amt = parseFloat(txForm.amount) || 0;
    const built = { date: txForm.date || new Date().toISOString().split("T")[0], propertyId: property.id, category: txForm.category || "Other", description: txForm.description, amount: txForm.type === "income" ? Math.abs(amt) : -Math.abs(amt), type: txForm.type, payee: (txForm.payee || "").trim() };
    try {
      if (txEditId !== null) {
        const saved = await updateTransaction(txEditId, built);
        const idx = TRANSACTIONS.findIndex(t => t.id === txEditId);
        if (idx !== -1) TRANSACTIONS[idx] = saved;
        txReceipts.filter(r => !TRANSACTION_RECEIPTS.some(er => er.id === r.id)).forEach(r => addTransactionReceipt({ ...r, transactionId: txEditId }));
      } else {
        const saved = await createTransaction(built);
        TRANSACTIONS.unshift(saved);
        txReceipts.forEach(r => addTransactionReceipt({ ...r, transactionId: saved.id }));
      }
      txCloseModal();
      txForceRender(n => n + 1);
    } catch (e) {
      console.error("[PropBooks] Save transaction failed:", e);
      alert("Couldn't save transaction — " + (e.message || "unknown error"));
    }
  };

  const txHandleDelete = async (t) => {
    try {
      await deleteTransaction(t.id);
      const idx = TRANSACTIONS.findIndex(tx => tx.id === t.id);
      if (idx !== -1) TRANSACTIONS.splice(idx, 1);
      setTxDeleteConfirm(null);
      txForceRender(n => n + 1);
    } catch (e) {
      console.error("[PropBooks] Delete transaction failed:", e);
      alert("Couldn't delete — " + (e.message || "unknown error"));
    }
  };

  const [notesRender, reRenderNotes] = useState(0);
  const [noteText, setNoteText] = useState("");
  const [noteEditId, setNoteEditId] = useState(null);
  const [noteDeleteConfirm, setNoteDeleteConfirm] = useState(null);
  const propNotes = useMemo(() => RENTAL_NOTES.filter(n => n.propertyId === property.id).sort((a, b) => b.date.localeCompare(a.date)), [property.id, notesRender]); // eslint-disable-line react-hooks/exhaustive-deps -- notesRender is the cache-bust counter for RENTAL_NOTES

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
              <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{property.name}</h1>
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
            <StatCard label="Total Income"   value={`+${fmt(totalIncome)}`}   valueColor="var(--c-green)" tip="Sum of all income transactions for this property (filtered if filters are active)." />
            <StatCard label="Total Expenses" value={`-${fmt(totalExpenses)}`} valueColor="var(--c-red)"   tip="Sum of all expense transactions for this property (filtered if filters are active)." />
            <StatCard label="Net"            value={`${filteredTxTotal >= 0 ? "+" : ""}${fmt(Math.abs(filteredTxTotal))}`} valueColor={filteredTxTotal >= 0 ? "var(--c-green)" : "var(--c-red)"} tip="Total Income minus Total Expenses. Positive = profitable." />
          </div>

          {/* Header row with counts + add buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {txHasFilters ? `${filteredTx.length} of ${propTransactions.length} transactions` : `${propTransactions.length} transactions`}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={txOpenAddExpense} style={{ background: "var(--danger-tint)", color: "#c0392b", border: "1px solid var(--danger-border)", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> Add Expense
              </button>
              <button onClick={txOpenAddIncome} style={{ background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
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
              {txCatFilter !== "all" && <span style={{ background: "var(--success-badge)", color: "#1a7a4a", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>{txCatFilter} <button onClick={() => setTxCatFilter("all")} style={{ background: "none", border: "none", cursor: "pointer", color: "#1a7a4a", padding: 0 }}><X size={10} /></button></span>}
              {txDateFilter !== "all" && <span style={{ background: "var(--warning-bg)", color: "var(--warning-text)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>{txDateFilter === "custom" ? `${txDateFrom || "..."} – ${txDateTo || "..."}` : txDateFilter} <button onClick={() => { setTxDateFilter("all"); setTxDateFrom(""); setTxDateTo(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--warning-text)", padding: 0 }}><X size={10} /></button></span>}
              {txSearch && <span style={{ background: "var(--surface-muted)", color: "var(--text-label)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>"{txSearch}" <button onClick={() => setTxSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-label)", padding: 0 }}><X size={10} /></button></span>}
              <button onClick={clearTxFilters} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Clear all</button>
            </div>
          )}

          {/* Transactions table */}
          <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
            {filteredTx.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: 48 }}>
                {txHasFilters ? <span>No transactions match your filters. <button onClick={clearTxFilters} style={{ background: "none", border: "none", color: "var(--c-blue)", cursor: "pointer", textDecoration: "underline", fontSize: 14 }}>Clear filters</button></span> : <span>No transactions yet. <button onClick={txOpenAddIncome} style={{ background: "none", border: "none", color: "#1a7a4a", cursor: "pointer", textDecoration: "underline", fontSize: 14 }}>Add your first transaction</button></span>}
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
                      <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: t.type === "income" ? "#1a7a4a" : "#c0392b" }}>
                        {t.type === "income" ? "+" : "-"}{fmt(Math.abs(t.amount))}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ background: t.type === "income" ? "var(--success-badge)" : "var(--danger-badge)", color: t.type === "income" ? "#1a7a4a" : "#c0392b", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{t.type}</span>
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
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 800, color: filteredTxTotal >= 0 ? "#1a7a4a" : "#c0392b" }}>
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
            const accentColor = isIncome ? "#1a7a4a" : "#c0392b";
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
                      <p style={{ fontSize: 11, color: "#1a7a4a", marginTop: 4, fontStyle: "italic" }}>
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
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{txDeleteConfirm.date} · <span style={{ color: txDeleteConfirm.type === "income" ? "#1a7a4a" : "#c0392b", fontWeight: 600 }}>{txDeleteConfirm.type === "income" ? "+" : "-"}{fmt(Math.abs(txDeleteConfirm.amount))}</span></p>
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
                  "active-lease": { bg: "var(--success-badge)", text: "#1a7a4a", label: "Active Lease" },
                  "month-to-month": { bg: "var(--warning-bg)", text: "var(--warning-text)", label: "Month-to-Month" },
                  "vacant": { bg: "var(--danger-badge)", text: "#c0392b", label: "Vacant" },
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
          onAdd={async ({ meta, file }) => {
            try {
              const saved = await dbCreateDocument({ entityType: "property", entityId: property.id, meta, file });
              PROPERTY_DOCUMENTS.unshift(saved);
              txForceRender(n => n + 1);
            } catch (e) {
              console.error("[PropBooks] Add property document failed:", e);
            }
          }}
          onDelete={async (id) => {
            try {
              const doc = PROPERTY_DOCUMENTS.find(d => d.id === id);
              if (!doc) return;
              await dbDeleteDocument(doc);
              const idx = PROPERTY_DOCUMENTS.findIndex(d => d.id === id);
              if (idx !== -1) PROPERTY_DOCUMENTS.splice(idx, 1);
              txForceRender(n => n + 1);
            } catch (e) {
              console.error("[PropBooks] Delete property document failed:", e);
            }
          }}
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
              <button onClick={async () => {
                const txt = noteText.trim();
                if (!txt) return;
                const today = new Date().toISOString().slice(0, 10);
                try {
                  if (noteEditId) {
                    const saved = await dbUpdateNote(noteEditId, { text: txt });
                    const idx = RENTAL_NOTES.findIndex(n => n.id === noteEditId);
                    if (idx !== -1) RENTAL_NOTES[idx] = { ...RENTAL_NOTES[idx], ...saved };
                    setNoteEditId(null);
                  } else {
                    const saved = await createRentalNote({ propertyId: property.id, date: today, text: txt, mentions: [] });
                    RENTAL_NOTES.unshift(saved);
                  }
                  setNoteText("");
                  reRenderNotes(n => n + 1);
                } catch (e) {
                  console.error("[PropBooks] Save note failed:", e);
                }
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
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px 0" }}>Delete Note?</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px 0" }}>This cannot be undone.</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setNoteDeleteConfirm(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  <button onClick={async () => {
                    try {
                      await dbDeleteNote(noteDeleteConfirm);
                      const idx = RENTAL_NOTES.findIndex(n => n.id === noteDeleteConfirm);
                      if (idx !== -1) RENTAL_NOTES.splice(idx, 1);
                      setNoteDeleteConfirm(null);
                      reRenderNotes(n => n + 1);
                    } catch (e) {
                      console.error("[PropBooks] Delete note failed:", e);
                    }
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
