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
  TrendingUp, TrendingDown, Hash,
} from "lucide-react";
import { fmt, fmtK, DEALS, DEAL_EXPENSES, CONTRACTORS } from "../api.js";
import { PROPERTIES, TRANSACTIONS, TENANTS } from "../mockData.js";
import { StatCard, EmptyState, iS } from "../shared.jsx";

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

  const rows = useMemo(() => buildRows(), []);

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

  const handleOpen = (row) => {
    if (row.kind === "rental") onOpenTx && onOpenTx(row.raw.id);
    else onOpenDealExpense && onOpenDealExpense(row.raw.id);
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
                  <tr key={r.key} onClick={() => handleOpen(r)}
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
                      <button onClick={e => { e.stopPropagation(); handleOpen(r); }}
                        title="Open in detail view"
                        style={{ background: "var(--surface-muted)", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "var(--text-label)", display: "flex", alignItems: "center" }}>
                        <ExternalLink size={13} />
                      </button>
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
    </div>
  );
}

function dateRangeLabel(r) {
  if (r === "thisMonth") return "This month";
  if (r === "lastMonth") return "Last month";
  if (r === "thisYear")  return "This year";
  return "All time";
}
