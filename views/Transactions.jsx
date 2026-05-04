import { useState, useEffect, useRef } from "react";
import {
  Search, Plus, Trash2, Pencil, ChevronRight, User, Paperclip, ScanLine, CheckCircle,
} from "lucide-react";
import {
  newId, fmt, MOCK_USER,
  TRANSACTION_RECEIPTS, addTransactionReceipt,
} from "../api.js";
import { calcPaymentInterest } from "../finance.js";
import { Modal, StatCard, iS } from "../shared.jsx";
import { PROPERTIES, TRANSACTIONS } from "../mockData.js";
import { TxDetailPanel } from "./detailPanels.jsx";
import { AttachmentZone, AttachmentList, OcrPrompt } from "./Attachments.jsx";
import { createTransaction, updateTransaction, deleteTransaction } from "../db/transactions.js";

export function Transactions({ highlightTxId, onBack, onClearHighlight, backLabel }) {
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
  }, [highlightTxId]); // eslint-disable-line react-hooks/exhaustive-deps -- onClearHighlight is an inline parent callback (new ref every render)
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
    const matchProp = propFilter === "all" || t.propertyId === propFilter;
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

  const handleSave = async () => {
    if (!form.description || !form.amount) return;
    const amt = parseFloat(form.amount) || 0;
    const isMortgage = ["Mortgage Payment", "Mortgage"].includes(form.category);
    const built = { date: form.date || new Date().toISOString().split("T")[0], propertyId: form.propertyId, category: form.category || "Other", description: form.description, amount: form.type === "income" ? Math.abs(amt) : -Math.abs(amt), type: form.type, payee: (form.payee || "").trim() };
    // Store P&I split if mortgage transaction
    if (isMortgage && form.piOverride && form.piPrincipal && form.piInterest) {
      built.piPrincipal = parseFloat(form.piPrincipal) || 0;
      built.piInterest = parseFloat(form.piInterest) || 0;
    } else if (isMortgage) {
      // Auto-calculate and store
      const prop = PROPERTIES.find(p => p.id === form.propertyId);
      if (prop) {
        const payDate = form.date || new Date().toISOString().split("T")[0];
        const interest = calcPaymentInterest(prop.loanAmount, prop.loanRate, prop.loanTermYears, prop.loanStartDate, payDate);
        if (interest !== null) {
          built.piInterest = interest;
          built.piPrincipal = Math.max(0, Math.round(amt - interest));
        }
      }
    }
    try {
      if (editId !== null) {
        const saved = await updateTransaction(editId, built);
        setTxData(prev => prev.map(t => t.id === editId ? saved : t));
        const idx = TRANSACTIONS.findIndex(t => t.id === editId);
        if (idx !== -1) TRANSACTIONS[idx] = saved;
        mainReceipts.filter(r => !TRANSACTION_RECEIPTS.some(er => er.id === r.id)).forEach(r => addTransactionReceipt({ ...r, transactionId: editId }));
      } else {
        const saved = await createTransaction(built);
        setTxData(prev => [saved, ...prev]);
        TRANSACTIONS.unshift(saved);
        mainReceipts.forEach(r => addTransactionReceipt({ ...r, transactionId: saved.id }));
      }
      setForm(emptyIncome);
      closeModal();
    } catch (e) {
      console.error("[PropBooks] Save transaction failed:", e);
      alert("Couldn't save transaction — " + (e.message || "unknown error"));
    }
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
        <StatCard label="Total Income"   value={`+${fmt(totalIncome)}`}                                        valueColor="var(--c-green)" tip="Sum of all income transactions matching the current filters." />
        <StatCard label="Total Expenses" value={`-${fmt(totalExpenses)}`}                                      valueColor="var(--c-red)"   tip="Sum of all expense transactions matching the current filters." />
        <StatCard label="Net"            value={fmt(totalIncome - totalExpenses)} valueColor={totalIncome - totalExpenses >= 0 ? "var(--c-green)" : "var(--c-red)"} tip="Total Income minus Total Expenses for the filtered period." />
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
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "9px 16px", borderRadius: 10, border: filter === f ? "none" : "1px solid var(--border)", background: filter === f ? (f === "income" ? "var(--success-badge)" : f === "expense" ? "var(--danger-badge)" : "var(--c-blue)") : "var(--surface)", color: filter === f ? (f === "income" ? "#1a7a4a" : f === "expense" ? "#c0392b" : "#fff") : "var(--text-label)", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={openAddExpense} style={{ background: "var(--danger-tint)", color: "#c0392b", border: "1px solid var(--danger-border)", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Add Expense
          </button>
          <button onClick={openAddIncome} style={{ background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Add Income
          </button>
        </div>
      </div>
      {/* Active filter chips + clear */}
      {(propFilter !== "all" || catFilter !== "all" || dateFilter !== "all" || search) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Filtered:</span>
          {propFilter !== "all" && <span style={{ background: "var(--warning-bg)", color: "#e95e00", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{(PROPERTIES.find(p => p.id === propFilter)?.name || "Property").split(" ").slice(0, 2).join(" ")}</span>}
          {catFilter !== "all" && <span style={{ background: "var(--success-tint)", color: "#1a7a4a", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{catFilter}</span>}
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
                <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 700, color: t.type === "income" ? "#1a7a4a" : "#c0392b" }}>
                  {t.type === "income" ? "+" : "-"}{fmt(Math.abs(t.amount))}
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{ background: t.type === "income" ? "var(--success-badge)" : "var(--danger-badge)", color: t.type === "income" ? "#1a7a4a" : "#c0392b", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{t.type}</span>
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
        const accentColor = isIncome ? "#1a7a4a" : "#c0392b";
        const accentBg    = isIncome ? "var(--success-tint)"  : "var(--danger-tint)";
        const accentBorder= isIncome ? "var(--success-border)"  : "var(--danger-border)";
        const saveColor   = isIncome ? "#1a7a4a"  : "#c0392b";
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
                const prop = PROPERTIES.find(p => p.id === form.propertyId);
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
                          <p style={{ gridColumn: "1 / -1", fontSize: 11, color: "#c0392b", fontWeight: 600 }}>
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
                  <p style={{ fontSize: 11, color: "#1a7a4a", marginTop: 4, fontStyle: "italic" }}>
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
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{PROPERTIES.find(p => p.id === deleteConfirm.propertyId)?.name || "Unknown"} · {deleteConfirm.date} · <span style={{ color: deleteConfirm.type === "income" ? "#1a7a4a" : "#c0392b", fontWeight: 700 }}>{deleteConfirm.type === "income" ? "+" : "-"}{fmt(Math.abs(deleteConfirm.amount))}</span></p>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={async () => {
              try {
                await deleteTransaction(deleteConfirm.id);
                setTxData(prev => prev.filter(x => x.id !== deleteConfirm.id));
                const idx = TRANSACTIONS.findIndex(t => t.id === deleteConfirm.id);
                if (idx !== -1) TRANSACTIONS.splice(idx, 1);
                setDeleteConfirm(null);
              } catch (e) {
                console.error("[PropBooks] Delete transaction failed:", e);
                alert("Couldn't delete — " + (e.message || "unknown error"));
              }
            }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
