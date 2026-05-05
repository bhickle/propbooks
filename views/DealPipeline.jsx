// =============================================================================
// DealPipeline + DealCard + StageBadge + RehabProgress
//
// StageBadge and RehabProgress are reused by DealDetail; export them too so
// downstream views can pick them up after the App.jsx split lands.
// =============================================================================
import { useState } from "react";
import {
  Plus, Clock, X, Hammer, DollarSign, TrendingUp, Star, Layers, Search,
} from "lucide-react";
import { fmt, fmtK, DEALS, STAGE_COLORS, STAGE_ORDER } from "../api.js";
import { StatCard, EmptyState } from "../shared.jsx";

export function StageBadge({ stage }) {
  const s = STAGE_COLORS[stage] || { bg: "var(--surface-muted)", text: "var(--text-label)", dot: "var(--text-muted)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {stage}
    </span>
  );
}

export function RehabProgress({ items }) {
  const totalBudget = items.reduce((s, i) => s + i.budgeted, 0);
  const totalSpent = items.reduce((s, i) => s + i.spent, 0);
  const pct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const over = totalSpent > totalBudget;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{pct}% complete</span>
        <span style={{ fontSize: 13, color: over ? "#c0392b" : "var(--text-secondary)", fontWeight: over ? 700 : 400 }}>
          {fmt(totalSpent)} / {fmt(totalBudget)} {over && "(!) Over budget"}
        </span>
      </div>
      <div style={{ height: 8, background: "var(--surface-muted)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: over ? "var(--c-red)" : pct >= 80 ? "#e95e00" : "var(--c-green)", borderRadius: 99, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

export function DealCard({ deal, onSelect }) {
  const totalCost = deal.purchasePrice + deal.rehabBudget + (deal.holdingCostsPerMonth * (deal.daysOwned / 30));
  const projectedProfit = deal.arv - totalCost - (deal.arv * ((deal.sellingCostPct || 6) / 100));
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

export function DealPipeline({ onSelect, onGuidedSetup }) {
  const [activeStage, setActiveStage] = useState("all");

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
        <StatCard icon={Hammer}     label="Active Deals"     value={activeDeals.length}              sub="In pipeline"      color="#e95e00"        tip="Number of deals not yet sold." />
        <StatCard icon={DollarSign} label="Capital Deployed" value={fmtK(totalDeployed)}             sub="Purchase + rehab" color="var(--c-blue)"  tip="Sum of purchase price + rehab spent across active deals." />
        <StatCard icon={TrendingUp} label="Projected Profit" value={fmtK(Math.round(totalProjected))} sub="Active deals"     color="var(--c-green)" tip="ARV − Purchase − Rehab Budget − Estimated Holding & Selling Costs across active deals." />
        <StatCard icon={Star}       label="Realized Profit"  value={fmt(realizedProfit)}             sub="Closed deals YTD" color="var(--c-purple)" tip="Actual net profit from deals closed/sold this year." />
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
