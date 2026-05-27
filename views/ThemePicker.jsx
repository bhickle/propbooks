// =============================================================================
// ThemePicker — one-time modal shown to new users on first login. Asks them
// to pick Light or Dark, persists the choice to profiles.theme_preference,
// and never appears again. Skipped for the demo account (which uses whatever
// the previous user picked, falling back to localStorage).
// =============================================================================
import { Sun, Moon } from "lucide-react";
import { Modal } from "../shared.jsx";
import { useTheme } from "../theme.jsx";
import { supabase } from "../supabase.js";

export function ThemePicker({ user, onComplete }) {
  const { setTheme } = useTheme();

  // Dismissal is instant; the server write is fire-and-forget so the modal
  // closes without waiting on network latency, and a slow DB write can't
  // make the picker visibly hang or flicker. AppShell's dismiss guard
  // ensures the picker stays gone even if profile state briefly churns
  // before the saved preference reflects back.
  function pick(choice) {
    setTheme(choice);
    onComplete?.(choice);
    supabase
      .from("profiles")
      .update({ theme_preference: choice })
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) console.error("[PROPBOOKS] Save theme preference failed:", error);
      });
  }

  return (
    <Modal title="Choose your look" onClose={() => pick("light")} width={560}>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20, marginTop: -8 }}>
        Pick what feels right — you can change this anytime from Settings.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <PreviewCard mode="light" onClick={() => pick("light")} />
        <PreviewCard mode="dark"  onClick={() => pick("dark")} />
      </div>
    </Modal>
  );
}

// Each card renders a hardcoded mini-mock of the dashboard in the chosen
// theme. Hardcoded (not using theme tokens) because both cards need to render
// in their respective palettes regardless of which one is currently active.
function PreviewCard({ mode, onClick }) {
  const palette = mode === "dark"
    ? {
        bg: "#1e293b", surfaceAlt: "#0f172a", border: "#334155",
        textPrimary: "#f1f5f9", textMuted: "#94a3b8", accent: "#e95e00",
        cardBg: "#0a2240",
      }
    : {
        bg: "#ffffff", surfaceAlt: "#f8fafc", border: "#e2e8f0",
        textPrimary: "#041830", textMuted: "#94a3b8", accent: "#e95e00",
        cardBg: "#1e3a5f",
      };
  const Icon = mode === "dark" ? Moon : Sun;
  const label = mode === "dark" ? "Dark" : "Light";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1.5px solid var(--border)",
        borderRadius: 14,
        padding: 14,
        background: "var(--surface)",
        cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 12,
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#e95e00"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Mini dashboard preview */}
      <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 12, height: 140, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Fake header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ width: 60, height: 8, borderRadius: 4, background: palette.textPrimary, opacity: 0.85 }} />
          <div style={{ width: 18, height: 18, borderRadius: 6, background: palette.accent }} />
        </div>
        {/* Fake stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: 6, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ width: "60%", height: 5, borderRadius: 3, background: palette.textMuted, opacity: 0.6 }} />
              <div style={{ width: "80%", height: 8, borderRadius: 3, background: palette.textPrimary, opacity: 0.85 }} />
            </div>
          ))}
        </div>
        {/* Fake list rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: palette.cardBg }} />
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: palette.textMuted, opacity: 0.5 }} />
              <div style={{ width: 20, height: 4, borderRadius: 2, background: palette.textPrimary, opacity: 0.75 }} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface-alt)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color="var(--text-secondary)" />
        </div>
        <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 16 }}>{label}</span>
      </div>
    </button>
  );
}
