// =============================================================================
// AssetList — unified portfolio view across rentals + rehabs.
//
// First step in collapsing the parallel Rentals/Rehabs navigation. Renders
// one filterable list of every asset Brandon owns or is working on, with
// a type chip (Rental / Rehab), stage badge, and the type-appropriate
// summary stats. Clicking a card routes to PropertyDetail or DealDetail
// based on the asset's type — the detail screens stay genuinely different
// because the lifecycles are different (cap rate vs ARV is not the same
// kind of metric).
//
// Internal `kind: "rental" | "flip"` is the in-memory discriminator;
// user-facing text uses Rental / Rehab to match the codebase's existing
// vocabulary (Rehab Pipeline, Rehab Detail, Investment Analyzer, etc.).
// =============================================================================
import { useState, useMemo } from "react";
import {
  Plus, Search, MapPin, Hammer, Home, X, Clock, Building2, TrendingUp,
} from "lucide-react";
import { fmt, fmtK, DEALS, STAGE_COLORS } from "../api.js";
import { PROPERTIES, TRANSACTIONS } from "../mockData.js";
import { calcLoanBalance, getEffectiveMonthly, calcCapRate } from "../finance.js";
import { StatCard, Badge, EmptyState } from "../shared.jsx";

// ── Asset shape adapter ─────────────────────────────────────────────────────
// Builds a uniform { kind, asset, sortKey } row so the grid can sort and
// filter without each card needing to know the underlying schema.
function buildAssets() {
  const rentalRows = PROPERTIES.map(p => ({
    kind: "rental",
    asset: p,
    sortKey: (p.updatedAt || p.createdAt || "").toString(),
  }));
  const flipRows = DEALS.map(d => ({
    kind: "flip",
    asset: d,
    sortKey: (d.updatedAt || d.createdAt || "").toString(),
  }));
  return [...rentalRows, ...flipRows].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

// ── Stage chip — works for both rental statuses and rehab stages ─────────
function TypeStageChip({ row }) {
  if (row.kind === "rental") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ background: "var(--info-tint)", color: "var(--c-blue)", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Rental
        </span>
        <Badge status={row.asset.status} />
      </span>
    );
  }
  const s = STAGE_COLORS[row.asset.stage] || { bg: "var(--surface-muted)", text: "var(--text-label)", dot: "var(--text-muted)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ background: "var(--warning-btn-bg)", color: "#c2410c", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Rehab
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
        {row.asset.stage}
      </span>
    </span>
  );
}

// ── Asset card — same outer shell, type-appropriate stat row ───────────────
function AssetCard({ row, onSelect }) {
  const { kind, asset } = row;
  const stats = kind === "rental" ? rentalStats(asset) : flipStats(asset);

  return (
    <div onClick={() => onSelect(row)}
      style={{ background: "var(--surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid var(--border-subtle)", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}>
      <div style={{ height: 130, background: asset.photo ? "transparent" : "var(--avatar-bg)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        {asset.photo
          ? <img src={asset.photo} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 800 }}>{asset.image}</div>
        }
        <div style={{ position: "absolute", top: 10, left: 10 }}>
          <TypeStageChip row={row} />
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <h3 style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{asset.name}</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={11} />
          {asset.address ? (asset.address.split(",")[1]?.trim() || asset.address.split(",")[0]?.trim()) : "—"}
          {kind === "rental" && asset.type ? ` · ${asset.type}` : ""}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</p>
              <p style={{ color: s.color || "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function rentalStats(p) {
  const calcBal = calcLoanBalance(p.loanAmount, p.loanRate, p.loanTermYears, p.loanStartDate);
  const effMort = calcBal !== null ? calcBal : (p.mortgage || 0);
  const equity = (p.currentValue || 0) - effMort;
  const eff = getEffectiveMonthly(p, TRANSACTIONS);
  const monthlyNet = eff.monthlyIncome - eff.monthlyExpenses;
  return [
    { label: "Value", value: fmtK(p.currentValue || 0) },
    { label: "Equity", value: fmtK(equity), color: "var(--c-green)" },
    { label: "Monthly CF", value: fmt(monthlyNet), color: monthlyNet >= 0 ? "var(--c-green)" : "var(--c-red)" },
    { label: "Cap Rate", value: `${calcCapRate(p)}%` },
  ];
}

function flipStats(d) {
  const totalCost = (d.purchasePrice || 0) + (d.rehabBudget || 0) + ((d.holdingCostsPerMonth || 0) * ((d.daysOwned || 0) / 30));
  const projectedProfit = (d.arv || 0) - totalCost - ((d.arv || 0) * ((d.sellingCostPct || 6) / 100));
  const rehabPct = d.rehabBudget > 0 ? Math.round((d.rehabSpent / d.rehabBudget) * 100) : 0;
  return [
    { label: "Purchase", value: fmtK(d.purchasePrice || 0) },
    { label: "ARV", value: fmtK(d.arv || 0) },
    {
      label: d.stage === "Sold" ? "Net Profit" : "Proj. Profit",
      value: d.stage === "Sold" ? fmt(d.netProfit || 0) : fmtK(Math.round(projectedProfit)),
      color: "var(--c-green)",
    },
    { label: "Rehab", value: `${rehabPct}%` },
  ];
}

// Treat closed rentals (status "Sold" or "Inactive") and closed rehabs
// (stage "Sold" or "Converted to Rental") as the same conceptual bucket —
// no longer in the active portfolio. They stay in the data for reports
// and tax history; AssetList just hides them by default.
function isClosed(row) {
  if (row.kind === "rental") return row.asset.status === "Sold" || row.asset.status === "Inactive";
  return row.asset.stage === "Sold" || row.asset.stage === "Converted to Rental";
}

export function AssetList({ onSelectRental, onSelectFlip, onAddRental, onAddFlip }) {
  // "all" / "rental" / "flip" show active assets of that type. "closed" shows
  // every closed asset (sold rentals + sold/converted rehabs) — mirrors how
  // TenantManagement surfaces "Past Tenants" as a pill rather than a separate
  // checkbox.
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showAddMenu, setShowAddMenu] = useState(false);

  const rows = useMemo(() => buildAssets(), []);

  const filtered = rows.filter(r => {
    if (typeFilter === "closed") {
      if (!isClosed(r)) return false;
    } else {
      if (isClosed(r)) return false;
      if (typeFilter === "rental" && r.kind !== "rental") return false;
      if (typeFilter === "flip" && r.kind !== "flip") return false;
    }
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.asset.name || "").toLowerCase().includes(q) ||
      (r.asset.address || "").toLowerCase().includes(q) ||
      (r.asset.type || "").toLowerCase().includes(q) ||
      (r.asset.stage || "").toLowerCase().includes(q)
    );
  });

  // Header stats — count + roll-up. Rental + flip metrics aren't directly
  // additive (cap rate ≠ ARV) so the four cards lean on what's comparable.
  // Stat counts always exclude closed assets so the headline numbers reflect
  // active portfolio, regardless of the showClosed toggle.
  const activeRows = rows.filter(r => !isClosed(r));
  const rentalCount = activeRows.filter(r => r.kind === "rental").length;
  const flipCount = activeRows.filter(r => r.kind === "flip").length;
  const closedCount = rows.length - activeRows.length;
  const totalValue = activeRows.reduce((s, r) => {
    if (r.kind === "rental") return s + (r.asset.currentValue || 0);
    return s + (r.asset.arv || 0);
  }, 0);
  const monthlyCF = PROPERTIES.filter(p => p.status !== "Sold" && p.status !== "Inactive").reduce((s, p) => {
    const eff = getEffectiveMonthly(p, TRANSACTIONS);
    return s + (eff.monthlyIncome - eff.monthlyExpenses);
  }, 0);
  const projectedProfit = DEALS.filter(d => d.stage !== "Sold" && d.stage !== "Converted to Rental").reduce((s, d) => {
    const totalCost = (d.purchasePrice || 0) + (d.rehabBudget || 0) + ((d.holdingCostsPerMonth || 0) * ((d.daysOwned || 0) / 30));
    return s + ((d.arv || 0) - totalCost - ((d.arv || 0) * ((d.sellingCostPct || 6) / 100)));
  }, 0);

  const handleCardClick = (row) => {
    if (row.kind === "rental") onSelectRental && onSelectRental(row.asset);
    else onSelectFlip && onSelectFlip(row.asset);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Assets</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            {rentalCount} rental{rentalCount !== 1 ? "s" : ""} · {flipCount} rehab{flipCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowAddMenu(s => !s)}
            style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Asset
          </button>
          {showAddMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden", zIndex: 50, minWidth: 180 }}>
              <button onClick={() => { setShowAddMenu(false); onAddRental && onAddRental(); }}
                style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)" }}>
                <Home size={14} color="var(--c-blue)" />
                <span style={{ fontWeight: 600 }}>Add Rental</span>
              </button>
              <button onClick={() => { setShowAddMenu(false); onAddFlip && onAddFlip(); }}
                style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-primary)" }}>
                <Hammer size={14} color="#e95e00" />
                <span style={{ fontWeight: 600 }}>Add Rehab</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {[
            { id: "all",    label: `All (${activeRows.length})` },
            { id: "rental", label: `Rentals (${rentalCount})` },
            { id: "flip",   label: `Rehabs (${flipCount})` },
            ...(closedCount > 0 ? [{ id: "closed", label: `Closed (${closedCount})` }] : []),
          ].map(t => {
            const active = typeFilter === t.id;
            return (
              <button key={t.id} onClick={() => setTypeFilter(t.id)}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: active ? "#e95e00" : "transparent", color: active ? "#fff" : "var(--text-secondary)", fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 220, maxWidth: 360 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets..."
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" }} />
        </div>
        {(typeFilter !== "all" || search) && (
          <button onClick={() => { setTypeFilter("all"); setSearch(""); }}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={Building2}  label="Total Assets"      value={activeRows.length}      sub={`${rentalCount} rentals · ${flipCount} rehabs`} color="var(--c-blue)"   tip="Active rentals + active rehabs. Closed assets are excluded — switch the filter to 'Closed' above to see them." />
        <StatCard icon={TrendingUp} label="Portfolio Value"   value={fmtK(totalValue)}       sub="Current value + ARV"                          color="var(--c-purple)" tip="Sum of current value across active rentals and ARV across active rehabs." />
        <StatCard icon={Home}       label="Monthly Cash Flow" value={fmt(monthlyCF)}         sub="Active rentals"                                color="var(--c-green)"  tip="Sum of (rent − expenses) across active rentals using the latest 3-month average where transactions exist. Closed rentals excluded." />
        <StatCard icon={Hammer}     label="Projected Profit"  value={fmtK(Math.round(projectedProfit))} sub="Active rehabs"                       color="#e95e00"         tip="ARV − purchase − rehab − holding & selling costs across active rehabs (excludes Sold and Converted to Rental)." />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {filtered.map(r => <AssetCard key={`${r.kind}-${r.asset.id}`} row={r} onSelect={handleCardClick} />)}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            {rows.length === 0
              ? <EmptyState icon={Home} title="No assets yet" subtitle="Add your first rental property or rehab to start tracking your portfolio." actionLabel="Add Rental" onAction={onAddRental} />
              : <EmptyState icon={Search} title="No assets match this filter" subtitle="Try selecting a different type or clearing the search." />
            }
          </div>
        )}
      </div>
    </div>
  );
}
