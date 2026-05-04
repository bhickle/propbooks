// =============================================================================
// shared.jsx — atoms used across App.jsx and deals.jsx
// =============================================================================
import { useState } from "react";
import { Info, X, ArrowUp, ArrowDown, Plus } from "lucide-react";

// ─── InfoTip ─────────────────────────────────────────────────────────────────
// Hover/click tooltip for KPI cards and other metrics. Per CLAUDE.md, every
// stat card and calculated value should have one explaining its formula.
export function InfoTip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 4, cursor: "pointer" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={e => { e.stopPropagation(); setShow(s => !s); }}
    >
      <Info size={13} color="var(--text-muted)" />
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "#041830", color: "#f8fafc", fontSize: 12, lineHeight: 1.5, fontWeight: 400,
          padding: "10px 14px", borderRadius: 10, width: 240, zIndex: 50,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)", pointerEvents: "none", whiteSpace: "normal", border: "1px solid var(--border)",
        }}>
          {text}
          <span style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            border: "6px solid transparent", borderTopColor: "#041830",
          }} />
        </span>
      )}
    </span>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 500 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "var(--surface)", borderRadius: 20, padding: 32, width, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Card style atoms ────────────────────────────────────────────────────────
// Per CLAUDE.md UI consistency checklist:
//   sectionS: borderRadius 16, padding 24, boxShadow, border #f1f5f9
//   cardS:    KPI/stat card, slightly tighter padding
// Components needing a per-instance override (e.g. marginBottom) should spread
// at their local declaration: `const sectionS = { ...sharedSectionS, marginBottom: 24 };`
export const sectionS = {
  background: "var(--surface)",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  border: "1px solid var(--border-subtle)",
};

export const cardS = {
  background: "var(--surface)",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  border: "1px solid var(--border-subtle)",
};

// ─── StatCard ────────────────────────────────────────────────────────────────
// Canonical KPI tile used across every dashboard. fontSize/weight/padding are
// fixed so PortfolioDashboard, DealDashboard, RehabTracker, etc. all read the
// same. Pass `tip` for the InfoTip on the label (required per CLAUDE.md spec
// for every metric). Pass `trendLabel` to override the default "vs last
// month" comparison text (deal pipeline uses "vs last quarter").
export function StatCard({
  icon: Icon, label, value, sub,
  trend, trendVal, trendLabel = "vs last month",
  color = "var(--c-blue)", semantic = false, tip,
  valueColor = "var(--text-primary)",
}) {
  const up = trend === "up";
  const iconBg = semantic ? colorWithAlpha(color, 0.1) : "#1e3a5f";
  const iconColor = semantic ? color : "#e95e00";
  return (
    <div style={{ background: "var(--surface)", borderRadius: 16, padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)", border: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
            <p style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            {tip && <InfoTip text={tip} />}
          </div>
          <p style={{ color: valueColor, fontSize: 28, fontWeight: 700, lineHeight: 1, fontFamily: "var(--font-display)" }}>{value}</p>
          {sub && <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 6 }}>{sub}</p>}
        </div>
        {Icon && (
          <div style={{ background: iconBg, borderRadius: 12, padding: 12 }}>
            <Icon size={22} color={iconColor} />
          </div>
        )}
      </div>
      {trendVal && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
          {up ? <ArrowUp size={14} color="var(--c-green)" /> : <ArrowDown size={14} color="var(--c-red)" />}
          <span style={{ fontSize: 13, fontWeight: 600, color: up ? "var(--c-green)" : "var(--c-red)" }}>{trendVal}</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

// ─── EmptyState — illustrated empty state for list views ────────────────────
export function EmptyState({ icon: Icon, title, subtitle, actionLabel, onAction }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center" }}>
      {Icon && <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--surface-alt)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Icon size={28} color="#94a3b8" /></div>}
      <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</h3>
      {subtitle && <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 340, marginBottom: onAction ? 20 : 0 }}>{subtitle}</p>}
      {onAction && actionLabel && <button onClick={onAction} style={{ background: "#e95e00", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={16} /> {actionLabel}</button>}
    </div>
  );
}

// ─── Badge — property status pill ────────────────────────────────────────────
export function Badge({ status }) {
  const map = {
    "Occupied": { bg: "var(--success-badge)", text: "#1a7a4a" },
    "Partial Vacancy": { bg: "var(--warning-bg)", text: "var(--warning-text)" },
    "Vacant": { bg: "var(--danger-badge)", text: "#c0392b" },
  };
  const s = map[status] || map["Occupied"];
  return (
    <span style={{ background: s.bg, color: s.text, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      {status}
    </span>
  );
}

// ─── Shared input style ──────────────────────────────────────────────────────
export const iS = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, color: "var(--text-primary)", background: "var(--surface)", outline: "none", boxSizing: "border-box" };

// ─── downloadFile — generic Blob/URL download ───────────────────────────────
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── colorWithAlpha ──────────────────────────────────────────────────────────
// Convert a CSS color to a translucent variant. Handles both `var(--name)`
// custom properties and `#rrggbb` hex literals.
export function colorWithAlpha(color, alpha) {
  if (color.startsWith("var(")) return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
  const n = parseInt(color.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
