// =============================================================================
// shared.jsx — atoms used across App.jsx and deals.jsx
// =============================================================================
import { useState } from "react";
import { Info, X } from "lucide-react";

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

// ─── colorWithAlpha ──────────────────────────────────────────────────────────
// Convert a CSS color to a translucent variant. Handles both `var(--name)`
// custom properties and `#rrggbb` hex literals.
export function colorWithAlpha(color, alpha) {
  if (color.startsWith("var(")) return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
  const n = parseInt(color.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
