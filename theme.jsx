// =============================================================================
// theme.jsx — light/dark theme provider
//
// All neutral colors in the app reference CSS custom properties. The
// `data-theme` attribute on the document root swaps the palette globally.
// Brand (#e95e00) and semantic (#1a7a4a, #c0392b, #3b82f6, #f59e0b) colors
// stay consistent in both themes — only neutrals and surfaces flip.
// =============================================================================
import React, { useState, useCallback, useEffect } from "react";

const ThemeContext = React.createContext({ theme: "light", toggleTheme: () => {} });

export function useTheme() { return React.useContext(ThemeContext); }

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return window.__pb_theme || "light";
    }
    return "light";
  });
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
      window.__pb_theme = theme;
    }
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme(t => t === "light" ? "dark" : "light"), []);
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <style>{`
        :root {
          --font-display: 'Space Grotesk', 'Inter', sans-serif;
          --surface: #ffffff;
          --surface-alt: #f8fafc;
          --surface-muted: #f1f5f9;
          --page-bg: #f8fafc;
          --sidebar-bg: #041830;
          --text-primary: #041830;
          --text-secondary: #64748b;
          --text-muted: #94a3b8;
          --text-label: #475569;
          --text-dim: #374151;
          --border: #e2e8f0;
          --border-subtle: #f1f5f9;
          --border-strong: #cbd5e1;
          --c-green: #1a7a4a;
          --c-red: #c0392b;
          --c-blue: #3b82f6;
          --c-purple: #8b5cf6;
          --hover-surface: #f8fafc;
          --chart-axis: #94a3b8;
          --chart-grid: #f1f5f9;
          --chart-bar-primary: #1e3a5f;
          --tooltip-bg: #ffffff;
          --tooltip-border: #e2e8f0;
          --tooltip-text: #041830;
          --warning-bg: #fff7ed;
          --warning-border: #fdba74;
          --warning-text: #9a3412;
          --warning-text-secondary: #c2410c;
          --warning-btn-bg: #ffedd5;
          --warning-btn-bg-hover: #fdba74;
          --warning-btn-text: #c2410c;
          --warning-btn-text-hover: #9a3412;
          --success-tint: #edf7f2;
          --success-border: #9fcfb4;
          --danger-tint: #faeeed;
          --danger-border: #e8b0aa;
          --info-tint: #eff6ff;
          --info-border: #bfdbfe;
          --info-border-alt: #bae6fd;
          --info-tint-alt: #f0f9ff;
          --purple-tint: #f5f3ff;
          --active-highlight: rgba(233, 94, 0, 0.07);
          --success-badge: #cce8d8;
          --danger-badge: #f5d0cc;
          --warning-border-soft: #fed7aa;
          --yellow-tint: #fef3c7;
          --hero-bg: linear-gradient(135deg, #f0f4f8, #e8edf5);
          --hero-border: #e2e8f0;
          --hero-badge-bg: rgba(255,255,255,0.7);
          --hero-select-bg: rgba(255,255,255,0.8);
        }
        :root[data-theme="dark"] {
          --surface: #1e293b;
          --surface-alt: #0f172a;
          --surface-muted: #334155;
          --page-bg: #020617;
          --sidebar-bg: #020617;
          --text-primary: #f1f5f9;
          --text-secondary: #cbd5e1;
          --text-muted: #94a3b8;
          --text-label: #cbd5e1;
          --text-dim: #e2e8f0;
          --border: #334155;
          --border-subtle: #1e293b;
          --border-strong: #475569;
          --c-green: #2ea86a;
          --c-red: #e05040;
          --c-blue: #60a5fa;
          --c-purple: #a78bfa;
          --hover-surface: #334155;
          --chart-axis: #64748b;
          --chart-grid: #1e293b;
          --chart-bar-primary: #4878a8;
          --tooltip-bg: #1e293b;
          --tooltip-border: #334155;
          --tooltip-text: #f1f5f9;
          --warning-bg: rgba(245, 158, 11, 0.08);
          --warning-border: rgba(245, 158, 11, 0.25);
          --warning-text: #fbbf24;
          --warning-text-secondary: #d97706;
          --warning-btn-bg: rgba(245, 158, 11, 0.12);
          --warning-btn-bg-hover: rgba(245, 158, 11, 0.25);
          --warning-btn-text: #fbbf24;
          --warning-btn-text-hover: #fde68a;
          --success-tint: rgba(16, 185, 129, 0.08);
          --success-border: rgba(16, 185, 129, 0.2);
          --danger-tint: rgba(239, 68, 68, 0.08);
          --danger-border: rgba(239, 68, 68, 0.2);
          --info-tint: rgba(59, 130, 246, 0.08);
          --info-border: rgba(59, 130, 246, 0.2);
          --info-border-alt: rgba(59, 130, 246, 0.25);
          --info-tint-alt: rgba(59, 130, 246, 0.06);
          --purple-tint: rgba(139, 92, 246, 0.08);
          --active-highlight: rgba(233, 94, 0, 0.1);
          --success-badge: rgba(16, 185, 129, 0.15);
          --danger-badge: rgba(239, 68, 68, 0.15);
          --warning-border-soft: rgba(245, 158, 11, 0.2);
          --yellow-tint: rgba(245, 158, 11, 0.12);
          --hero-bg: linear-gradient(135deg, #1e293b, #0f172a);
          --hero-border: #334155;
          --hero-badge-bg: rgba(255,255,255,0.08);
          --hero-select-bg: rgba(255,255,255,0.06);
        }
        :root[data-theme="dark"] body { background: var(--page-bg); }
        :root[data-theme="dark"] input, :root[data-theme="dark"] select, :root[data-theme="dark"] textarea {
          background: var(--surface-alt) !important;
          color: var(--text-primary) !important;
          border-color: var(--border) !important;
        }
        :root[data-theme="dark"] input::placeholder, :root[data-theme="dark"] textarea::placeholder { color: var(--text-muted) !important; }
        :root[data-theme="dark"] ::-webkit-scrollbar-track { background: var(--surface-alt); }
        :root[data-theme="dark"] ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 6px; }
        h1 { font-family: var(--font-display); }
      `}</style>
      {children}
    </ThemeContext.Provider>
  );
}
