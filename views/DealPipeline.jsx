// =============================================================================
// StageBadge + RehabProgress — small atoms reused by DealDetail. The original
// DealPipeline + DealCard list views were retired when the unified Asset list
// took over; only these two helpers remain.
// =============================================================================
import { fmt, STAGE_COLORS } from "../api.js";

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
