// =============================================================================
// Ledger — unified money-in / money-out view across rentals + flips.
//
// Reads the existing TRANSACTIONS (rental income/expense) and DEAL_EXPENSES
// (flip expenses) arrays without merging schemas — schema unification is
// deferred. Each row carries a `kind` discriminator so the row click can
// route to the existing per-type detail screens (Transactions for rental,
// DealExpenses for flip), preserving the editing surface investors already
// know.
//
// Filters are by *type chip* (rental income / rental expense / flip expense),
// asset, and free-text search. The kind chip + asset link lets you skim a
// month's full money flow without flipping between two screens.
// =============================================================================
import { useState, useMemo } from "react";
import {
  Search, X, ArrowUpRight, ArrowDownRight, ExternalLink, Wallet,
  TrendingUp, TrendingDown, Hash, Plus, Home, Hammer, Building2,
  Pencil, Trash2,
} from "lucide-react";
import { fmt, fmtK, DEALS, DEAL_EXPENSES, CONTRACTORS } from "../api.js";
import { PROPERTIES, TRANSACTIONS, TENANTS } from "../mockData.js";
import { StatCard, EmptyState, Modal, iS } from "../shared.jsx";
import { createTransaction, updateTransaction, deleteTransaction } from "../db/transactions.js";
import { createDealExpense, updateDealExpense, deleteDealExpense } from "../db/dealExpenses.js";
import { updateRehabItem as dbUpdateRehabItem } from "../db/dealRehabItems.js";

// ── Row builder — one shape, two sources ─────────────────────────────────────
function buildRows() {
  const rentalRows = TRANSACTIONS.map(t => {
    const prop = PROPERTIES.find(p => p.id === t.propertyId);
    const tenant = t.tenantId ? TENANTS.find(x => x.id === t.tenantId) : null;
    return {
      key: `tx-${t.id}`,
      kind: "rental",
      type: t.type, // "income" | "expense"
      raw: t,
      date: t.date,
      assetKind: "rental",
      assetId: t.propertyId,
      assetName: prop?.name || "—",
      assetImage: prop?.image || null,
      category: t.category,
      description: t.description,
      counterparty: t.payee || tenant?.name || null,
      amount: Number(t.amount) || 0, // signed
    };
  });

  const flipRows = DEAL_EXPENSES.map(e => {
    const deal = DEALS.find(d => d.id === e.dealId);
    const con = e.contractorId ? CONTRACTORS.find(c => c.id === e.contractorId) : null;
    return {
      key: `dx-${e.id}`,
      kind: "flip",
      type: "expense", // flip rows are always expense
      raw: e,
      date: e.date,
      assetKind: "flip",
      assetId: e.dealId,
      assetName: deal?.name || "—",
      assetImage: deal?.image || null,
      category: e.category,
      description: e.description,
      counterparty: e.vendor || con?.name || null,
      amount: -(Number(e.amount) || 0), // normalize to signed (negative = out)
    };
  });

  return [...rentalRows, ...flipRows].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );
}

// ── Filter ID for the type pills ─────────────────────────────────────────────
//   "all" | "rental-income" | "rental-expense" | "flip-expense"
function matchesTypeFilter(row, filter) {
  if (filter === "all") return true;
  if (filter === "rental-income")  return row.kind === "rental" && row.type === "income";
  if (filter === "rental-expense") return row.kind === "rental" && row.type === "expense";
  if (filter === "flip-expense")   return row.kind === "flip";
  return true;
}

function dateInRange(dateStr, range) {
  if (!dateStr) return false;
  if (range === "all") return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (range === "thisMonth") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (range === "lastMonth") {
    const lm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const ly = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return d.getFullYear() === ly && d.getMonth() === lm;
  }
  if (range === "thisYear") return d.getFullYear() === now.getFullYear();
  return true;
}

// ── Category groups, scoped per kind ────────────────────────────────────────
// Same vocabulary the existing per-type forms use. Keeping these inline so
// the unified form is a self-contained replacement and there's no
// cross-import coupling to delete when the old forms come out.
const RENTAL_INCOME_GROUPS = {
  "Rent":         ["Rent Income", "Parking / Storage", "Laundry Income"],
  "Fees":         ["Late Fees", "Pet Fees", "Application Fees"],
  "Other Income": ["Damage Deposit Applied", "Other Income"],
};
const RENTAL_EXPENSE_GROUPS = {
  "Mortgage & Financing":  ["Mortgage Payment", "Loan Interest", "Refinance Costs"],
  "Taxes":                 ["Property Tax", "Tax Penalties"],
  "Insurance":             ["Property Insurance", "Liability Insurance", "Flood Insurance"],
  "Repairs & Maintenance": ["Plumbing", "Electrical", "HVAC", "Appliance Repair", "Roof Repair", "General Maintenance"],
  "Capital Improvement":   ["Kitchen Remodel", "Bathroom Remodel", "Flooring", "New Roof", "Other Capital"],
  "HOA / Condo Fees":      ["HOA Dues", "Special Assessment"],
  "Property Management":   ["Management Fee", "Leasing Fee"],
  "Utilities":             ["Electric", "Gas", "Water / Sewer", "Trash", "Internet / Cable"],
  "Grounds":               ["Landscaping", "Snow Removal", "Pest Control"],
  "Professional Services": ["Legal Fees", "Accounting / CPA", "Inspection Fees"],
  "Marketing":             ["Advertising", "Listing Fees", "Signage"],
  "General":               ["Cleaning", "Supplies & Materials", "Travel & Mileage", "Other Expenses"],
};
const FLIP_EXPENSE_GROUPS = {
  "Materials & Labor":  ["Materials & Supplies", "Subcontractor", "Fixtures & Hardware", "Appliances"],
  "Permits & Fees":     ["Permits", "Inspection Fees", "HOA Approvals"],
  "Site Costs":         ["Dumpster / Debris Removal", "Utilities", "Storage", "Equipment Rental"],
  "Holding & Carrying": ["Mortgage Interest", "Property Tax", "Insurance"],
  "Selling Costs":      ["Staging", "Photography", "Listing Fees", "Marketing"],
  "Other":              ["Travel & Mileage", "Other Expenses"],
};

function groupsForKind(kind) {
  if (kind === "rental-income")  return RENTAL_INCOME_GROUPS;
  if (kind === "rental-expense") return RENTAL_EXPENSE_GROUPS;
  return FLIP_EXPENSE_GROUPS;
}
function defaultCategory(kind) {
  if (kind === "rental-income")  return "Rent Income";
  if (kind === "rental-expense") return "Mortgage Payment";
  return "Materials & Supplies";
}

// ── LedgerAddModal — one form, three save paths ─────────────────────────────
// Asset-first workflow: pick the entry kind, the asset dropdown filters, the
// rest of the form fields adapt. Defers receipt attachment from the legacy
// per-type forms until V2 — receipts still live on the per-type screens.
//
// editRow (optional) puts the modal in edit mode: kind is derived, asset is
// locked (changing asset = different table = different record), and Save
// updates instead of creates.
function LedgerAddModal({ initialKind, editRow, onClose, onSaved }) {
  const editing = !!editRow;

  // Derive editing kind from the row's table + sign.
  const derivedKind = editing
    ? (editRow.kind === "flip" ? "flip-expense"
       : editRow.type === "income" ? "rental-income" : "rental-expense")
    : (initialKind || "rental-expense");

  const [kind, setKind] = useState(derivedKind);
  const [form, setForm] = useState(() => {
    if (editing) {
      const raw = editRow.raw;
      return {
        date: raw.date || "",
        assetId: editRow.kind === "flip" ? raw.dealId : raw.propertyId,
        tenantId: raw.tenantId || "",
        contractorId: raw.contractorId || "",
        rehabItemIdx: raw.rehabItemIdx != null ? String(raw.rehabItemIdx) : "",
        category: raw.category || defaultCategory(derivedKind),
        description: raw.description || "",
        amount: String(Math.abs(raw.amount || 0)),
        counterparty: raw.payee || raw.vendor || "",
      };
    }
    return {
      date: new Date().toISOString().slice(0, 10),
      assetId: "",
      tenantId: "",
      contractorId: "",
      rehabItemIdx: "",
      category: defaultCategory(derivedKind),
      description: "",
      amount: "",
      counterparty: "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const setKindAndReset = (k) => {
    setKind(k);
    setForm(f => ({
      ...f,
      assetId: "",
      tenantId: "",
      contractorId: "",
      rehabItemIdx: "",
      category: defaultCategory(k),
    }));
  };

  // Asset options scoped to kind. Rentals come from PROPERTIES; flips from DEALS.
  const assetOptions = kind === "flip-expense" ? DEALS : PROPERTIES;
  const selectedAsset = assetOptions.find(a => String(a.id) === String(form.assetId));

  // Tenants on the selected rental (for income with optional tenant attribution).
  const tenantsForAsset = kind === "rental-income" && selectedAsset
    ? TENANTS.filter(t => t.propertyId === selectedAsset.id && t.status !== "past" && t.status !== "vacant")
    : [];

  // Rehab line items for the selected flip — used to scope an expense to a
  // specific scope (Materials → Kitchen Cabinets) and auto-roll the spent
  // total on that line item.
  const rehabItemsForDeal = kind === "flip-expense" && selectedAsset
    ? (selectedAsset.rehabItems || [])
    : [];

  const groups = groupsForKind(kind);

  const counterpartyLabel = kind === "rental-income" ? "Received From" : "Paid To";
  const counterpartyPlaceholder = kind === "rental-income"
    ? "Tenant name (auto-fills if you pick one above)"
    : kind === "flip-expense" ? "Vendor or contractor name" : "Vendor / payee";

  const canSave = form.assetId && form.amount && Number(form.amount) > 0 && form.category;

  // ── Rehab spent rollup helper ──
  // When a flip expense is created/updated/deleted, the linked rehab line
  // item's `spent` should reflect it. Mirrors the legacy DealExpenses form.
  const adjustRehabSpent = async (deal, itemIdx, delta) => {
    if (!deal || itemIdx == null || itemIdx === "") return;
    const idx = parseInt(itemIdx);
    const item = deal.rehabItems && deal.rehabItems[idx];
    if (!item) return;
    item.spent = Math.max(0, (item.spent || 0) + delta);
    if (item.id) {
      try { await dbUpdateRehabItem(item.id, { spent: item.spent }); }
      catch (e) { console.error("[PropBooks] update rehab spent failed:", e); }
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const amt = Number(form.amount);
      if (kind === "flip-expense") {
        const riIdx = form.rehabItemIdx === "" ? null : parseInt(form.rehabItemIdx);
        const dbFields = {
          dealId: form.assetId,
          contractorId: form.contractorId || null,
          date: form.date,
          vendor: form.counterparty || null,
          category: form.category,
          description: form.description || "",
          amount: amt,
          rehabItemIdx: riIdx,
        };
        if (editing) {
          // Reverse the previous rehab-spent contribution before applying new one
          const prev = editRow.raw;
          const prevDeal = DEALS.find(d => d.id === prev.dealId);
          if (prev.rehabItemIdx != null) {
            await adjustRehabSpent(prevDeal, prev.rehabItemIdx, -prev.amount);
          }
          const saved = await updateDealExpense(prev.id, dbFields);
          const idxG = DEAL_EXPENSES.findIndex(e => e.id === prev.id);
          if (idxG !== -1) DEAL_EXPENSES[idxG] = saved;
          const newDeal = DEALS.find(d => d.id === saved.dealId);
          if (riIdx != null) await adjustRehabSpent(newDeal, riIdx, amt);
          onSaved && onSaved({ kind: "flip", row: saved });
        } else {
          const saved = await createDealExpense(dbFields);
          DEAL_EXPENSES.unshift(saved);
          const newDeal = DEALS.find(d => d.id === saved.dealId);
          if (riIdx != null) await adjustRehabSpent(newDeal, riIdx, amt);
          onSaved && onSaved({ kind: "flip", row: saved });
        }
      } else {
        // Rental income or rental expense. Income amounts stay positive,
        // expenses are stored negative — same convention as the existing
        // TRANSACTIONS data so the Ledger sign logic keeps working.
        const isIncome = kind === "rental-income";
        // If user selected a tenant on income but didn't type a payee,
        // auto-fill from the tenant's name.
        let counterparty = form.counterparty;
        if (!counterparty && form.tenantId) {
          const t = TENANTS.find(x => String(x.id) === String(form.tenantId));
          if (t) counterparty = t.name;
        }
        const dbFields = {
          date: form.date,
          propertyId: form.assetId,
          tenantId: form.tenantId || null,
          type: isIncome ? "income" : "expense",
          category: form.category,
          description: form.description || "",
          amount: isIncome ? amt : -amt,
          payee: counterparty || null,
        };
        if (editing) {
          const saved = await updateTransaction(editRow.raw.id, dbFields);
          const idxG = TRANSACTIONS.findIndex(t => t.id === editRow.raw.id);
          if (idxG !== -1) TRANSACTIONS[idxG] = saved;
          onSaved && onSaved({ kind: "rental", row: saved });
        } else {
          const saved = await createTransaction(dbFields);
          TRANSACTIONS.unshift(saved);
          onSaved && onSaved({ kind: "rental", row: saved });
        }
      }
      onClose();
    } catch (e) {
      console.error("[PropBooks] Save ledger entry failed:", e);
      setError(e.message || "Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const kindPill = (id, label, Icon, color) => {
    const active = kind === id;
    const disabled = editing; // can't change kind on edit — it's a different table
    return (
      <button key={id} onClick={() => !disabled && setKindAndReset(id)} disabled={disabled}
        style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: active ? `1.5px solid ${color}` : "1px solid var(--border)", background: active ? `${color}14` : "var(--surface)", color: active ? color : "var(--text-secondary)", fontWeight: active ? 700 : 600, fontSize: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled && !active ? 0.4 : 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.15s" }}>
        <Icon size={14} />
        {label}
      </button>
    );
  };

  return (
    <Modal title={editing ? "Edit Ledger Entry" : "Add Ledger Entry"} onClose={onClose} width={560}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          {editing ? "Entry kind (locked on edit)" : "What kind of entry?"}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {kindPill("rental-income",  "Rental Income",  Home,   "var(--c-green)")}
          {kindPill("rental-expense", "Rental Expense", Home,   "var(--c-blue)")}
          {kindPill("flip-expense",   "Flip Expense",   Hammer, "#e95e00")}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
            {kind === "flip-expense" ? "Deal *" : "Property *"}
          </label>
          <select value={form.assetId} onChange={sf("assetId")} style={iS}>
            <option value="">Select {kind === "flip-expense" ? "a deal" : "a property"}…</option>
            {assetOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {kind === "rental-income" && tenantsForAsset.length > 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
              Tenant <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional — for rent attribution)</span>
            </label>
            <select value={form.tenantId} onChange={sf("tenantId")} style={iS}>
              <option value="">No tenant (general income)</option>
              {tenantsForAsset.map(t => <option key={t.id} value={t.id}>{t.name}{t.unit ? ` — ${t.unit}` : ""}</option>)}
            </select>
          </div>
        )}

        {kind === "flip-expense" && CONTRACTORS.length > 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
              Contractor <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
            </label>
            <select value={form.contractorId} onChange={sf("contractorId")} style={iS}>
              <option value="">No contractor (vendor / supplier)</option>
              {CONTRACTORS.map(c => <option key={c.id} value={c.id}>{c.name}{c.trade ? ` — ${c.trade}` : ""}</option>)}
            </select>
          </div>
        )}

        {kind === "flip-expense" && rehabItemsForDeal.length > 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
              Rehab line item <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional — auto-rolls into that scope's spent total)</span>
            </label>
            <select value={form.rehabItemIdx} onChange={sf("rehabItemIdx")} style={iS}>
              <option value="">Not linked to a specific scope</option>
              {rehabItemsForDeal.map((it, i) => (
                <option key={i} value={i}>{it.category} — {fmt(it.budgeted || 0)} budget</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Date *</label>
          <input type="date" value={form.date} onChange={sf("date")} style={iS} />
        </div>
        <div>
          <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Amount *</label>
          <input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={sf("amount")} style={iS} />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Category *</label>
          <select value={form.category} onChange={sf("category")} style={iS}>
            {Object.entries(groups).map(([groupName, subs]) => (
              <optgroup key={groupName} label={groupName}>
                {subs.map(c => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Description</label>
          <input type="text" placeholder={kind === "rental-income" ? "e.g. March rent — Unit A" : kind === "flip-expense" ? "e.g. Hardwood flooring — 680 sqft" : "e.g. Q1 property insurance"} value={form.description} onChange={sf("description")} style={iS} />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", color: "var(--text-label)", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{counterpartyLabel}</label>
          <input type="text" placeholder={counterpartyPlaceholder} value={form.counterparty} onChange={sf("counterparty")} style={iS} />
        </div>
      </div>

      {error && (
        <p style={{ marginTop: 14, padding: "8px 12px", background: "var(--danger-tint)", borderRadius: 8, color: "#991b1b", fontSize: 12 }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <button onClick={onClose} disabled={saving}
          style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={!canSave || saving}
          style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: kind === "rental-income" ? "var(--c-green)" : kind === "flip-expense" ? "#e95e00" : "var(--c-blue)", color: "#fff", fontWeight: 700, cursor: (!canSave || saving) ? "not-allowed" : "pointer", opacity: (!canSave || saving) ? 0.5 : 1 }}>
          {saving ? "Saving…" : editing ? "Save Changes" : "Save Entry"}
        </button>
      </div>
    </Modal>
  );
}

function TypeChip({ row }) {
  if (row.kind === "rental" && row.type === "income") {
    return <span style={{ background: "var(--success-badge)", color: "#1a7a4a", borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Rental Income</span>;
  }
  if (row.kind === "rental" && row.type === "expense") {
    return <span style={{ background: "var(--info-tint)", color: "var(--c-blue)", borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Rental</span>;
  }
  return <span style={{ background: "var(--warning-btn-bg)", color: "#c2410c", borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Flip</span>;
}

export function Ledger({ onOpenTx, onOpenDealExpense }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [dateRange, setDateRange] = useState("thisYear");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(null); // null | "rental-income" | "rental-expense" | "flip-expense"
  const [editRow, setEditRow] = useState(null);  // a built row from buildRows()
  const [deleteRow, setDeleteRow] = useState(null);
  const [renderKey, setRenderKey] = useState(0);

  const rows = useMemo(() => buildRows(), [renderKey]); // eslint-disable-line react-hooks/exhaustive-deps -- renderKey is the cache-bust counter for TRANSACTIONS / DEAL_EXPENSES

  const filtered = rows.filter(r => {
    if (!matchesTypeFilter(r, typeFilter)) return false;
    if (!dateInRange(r.date, dateRange)) return false;
    if (assetFilter !== "all") {
      const [k, idStr] = assetFilter.split(":");
      if (r.assetKind !== k || String(r.assetId) !== idStr) return false;
    }
    const q = search.toLowerCase().trim();
    if (q) {
      const hay = `${r.description || ""} ${r.category || ""} ${r.counterparty || ""} ${r.assetName || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Stat roll-up uses the *currently filtered* rows so users can scope a stat
  // (e.g., "expenses on this property this year") by adjusting the filters.
  const income   = filtered.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const expenses = filtered.filter(r => r.amount < 0).reduce((s, r) => s + r.amount, 0);
  const net      = income + expenses;

  // Row click opens the unified edit modal in-place. Routing to the legacy
  // per-type editors is still available via the small ↗ button so the
  // receipt-attachment workflow has a fallback until the unified form catches up.
  const handleEdit = (row) => setEditRow(row);
  const handleOpenLegacy = (row) => {
    if (row.kind === "rental") onOpenTx && onOpenTx(row.raw.id);
    else onOpenDealExpense && onOpenDealExpense(row.raw.id);
  };

  const handleDelete = async (row) => {
    try {
      if (row.kind === "rental") {
        await deleteTransaction(row.raw.id);
        const i = TRANSACTIONS.findIndex(t => t.id === row.raw.id);
        if (i !== -1) TRANSACTIONS.splice(i, 1);
      } else {
        // Reverse the rehab-spent rollup if this expense was linked
        if (row.raw.rehabItemIdx != null) {
          const deal = DEALS.find(d => d.id === row.raw.dealId);
          const item = deal?.rehabItems?.[row.raw.rehabItemIdx];
          if (item) {
            item.spent = Math.max(0, (item.spent || 0) - row.raw.amount);
            if (item.id) {
              try { await dbUpdateRehabItem(item.id, { spent: item.spent }); }
              catch (e) { console.error("[PropBooks] revert rehab spent failed:", e); }
            }
          }
        }
        await deleteDealExpense(row.raw.id);
        const i = DEAL_EXPENSES.findIndex(e => e.id === row.raw.id);
        if (i !== -1) DEAL_EXPENSES.splice(i, 1);
      }
      setDeleteRow(null);
      setRenderKey(k => k + 1);
    } catch (e) {
      console.error("[PropBooks] Delete ledger entry failed:", e);
    }
  };

  const clearAllFilters = () => {
    setTypeFilter("all");
    setAssetFilter("all");
    setDateRange("thisYear");
    setSearch("");
  };
  const hasNonDefaultFilters =
    typeFilter !== "all" || assetFilter !== "all" || dateRange !== "thisYear" || !!search;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Ledger</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Every dollar in and out, across rentals and flips</p>
        </div>
        <button onClick={() => setShowAdd("rental-expense")}
          style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Add Entry
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={TrendingUp}   label="Income"   value={fmt(income)}        sub={`Filtered · ${dateRangeLabel(dateRange)}`}   color="var(--c-green)"  tip="Sum of positive amounts in the filtered ledger view (rental income only — flips don't have income rows yet)." />
        <StatCard icon={TrendingDown} label="Expenses" value={fmt(Math.abs(expenses))} sub={`Filtered · ${dateRangeLabel(dateRange)}`} color="var(--c-red)" tip="Sum of money-out across both rental expenses and flip expenses, scoped to the current filters." />
        <StatCard icon={Wallet}       label="Net"      value={fmt(net)}           sub="Income − Expenses"                            color={net >= 0 ? "var(--c-green)" : "var(--c-red)"} tip="Income minus Expenses for the filtered view. For a flip-only filter this will always be negative since flips don't have income rows until sale." />
        <StatCard icon={Hash}         label="Entries"  value={filtered.length}    sub={`of ${rows.length} total`}                    color="var(--c-blue)"   tip="Count of ledger rows matching the current filters." />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {[
            { id: "all",             label: "All" },
            { id: "rental-income",   label: "Rental Income" },
            { id: "rental-expense",  label: "Rental Expense" },
            { id: "flip-expense",    label: "Flip Expense" },
          ].map(t => {
            const active = typeFilter === t.id;
            return (
              <button key={t.id} onClick={() => setTypeFilter(t.id)}
                style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {t.label}
              </button>
            );
          })}
        </div>

        <select value={assetFilter} onChange={e => setAssetFilter(e.target.value)}
          style={{ ...iS, width: "auto", minWidth: 200, fontSize: 13, padding: "9px 12px" }}>
          <option value="all">All assets</option>
          <optgroup label="Rentals">
            {PROPERTIES.map(p => <option key={`rental:${p.id}`} value={`rental:${p.id}`}>{p.name}</option>)}
          </optgroup>
          <optgroup label="Flips">
            {DEALS.map(d => <option key={`flip:${d.id}`} value={`flip:${d.id}`}>{d.name}</option>)}
          </optgroup>
        </select>

        <select value={dateRange} onChange={e => setDateRange(e.target.value)}
          style={{ ...iS, width: "auto", minWidth: 140, fontSize: 13, padding: "9px 12px" }}>
          <option value="thisYear">This Year</option>
          <option value="thisMonth">This Month</option>
          <option value="lastMonth">Last Month</option>
          <option value="all">All Time</option>
        </select>

        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 200, maxWidth: 320 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description, vendor, category..."
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" }} />
        </div>

        {hasNonDefaultFilters && (
          <button onClick={clearAllFilters}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["Date", "Type", "Asset", "Category", "Description", "Paid To / From", "Amount", ""].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 0 }}>
                <EmptyState
                  icon={Wallet}
                  title={rows.length === 0 ? "No transactions yet" : "No entries match your filters"}
                  subtitle={rows.length === 0 ? "Income and expenses recorded across your rentals and flips will appear here." : "Try clearing some filters or expanding the date range."}
                />
              </td></tr>
            ) : (
              filtered.map((r, i) => {
                const isIncome = r.amount > 0;
                return (
                  <tr key={r.key} onClick={() => handleEdit(r)}
                    style={{ borderTop: "1px solid var(--border-subtle)", cursor: "pointer", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--info-tint-alt)"}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)"}>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{r.date}</td>
                    <td style={{ padding: "12px 16px" }}><TypeChip row={r} /></td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{r.assetImage || "•"}</div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.assetName}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-label)" }}>{r.category || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-primary)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.description || ""}>{r.description || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: r.counterparty ? "var(--text-label)" : "var(--text-muted)" }}>{r.counterparty || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: isIncome ? "var(--c-green)" : "var(--c-red)", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        {isIncome ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        {fmt(Math.abs(r.amount))}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); handleEdit(r); }}
                          title="Edit"
                          style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setDeleteRow(r); }}
                          title="Delete"
                          style={{ background: "var(--danger-badge)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--c-red)", display: "flex", alignItems: "center" }}>
                          <Trash2 size={13} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleOpenLegacy(r); }}
                          title="Open in legacy editor (with receipts)"
                          style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer summary — handy when filtered to one asset for a tax sub-total */}
      {filtered.length > 0 && (
        <p style={{ marginTop: 14, fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
          Showing {filtered.length} of {rows.length} entries · Net {fmt(net)} ({fmtK(income)} in, {fmtK(Math.abs(expenses))} out)
        </p>
      )}

      {showAdd && (
        <LedgerAddModal
          initialKind={showAdd}
          onClose={() => setShowAdd(null)}
          onSaved={() => setRenderKey(k => k + 1)}
        />
      )}

      {editRow && (
        <LedgerAddModal
          editRow={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => setRenderKey(k => k + 1)}
        />
      )}

      {deleteRow && (
        <Modal title="Delete Ledger Entry" onClose={() => setDeleteRow(null)} width={420}>
          <p style={{ color: "var(--text-label)", fontSize: 14, marginBottom: 8 }}>Are you sure you want to delete this entry?</p>
          <div style={{ background: "var(--surface-alt)", borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{deleteRow.description || deleteRow.category || "(no description)"}</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{deleteRow.date} · {deleteRow.assetName} · {fmt(Math.abs(deleteRow.amount))}</p>
          </div>
          {deleteRow.kind === "flip" && deleteRow.raw.rehabItemIdx != null && (
            <p style={{ color: "#9a3412", fontSize: 12, marginBottom: 14, padding: "8px 10px", background: "var(--warning-bg)", borderRadius: 8 }}>
              Heads up: this expense is linked to a rehab line item. Deleting will subtract it from that scope's spent total.
            </p>
          )}
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 18 }}>This action cannot be undone.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDeleteRow(null)} style={{ flex: 1, padding: "12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => handleDelete(deleteRow)} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "var(--c-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function dateRangeLabel(r) {
  if (r === "thisMonth") return "This month";
  if (r === "lastMonth") return "Last month";
  if (r === "thisYear")  return "This year";
  return "All time";
}
