// =============================================================================
// toast.jsx — global toast notification provider
// =============================================================================
import React, { useState, useCallback } from "react";

const ToastContext = React.createContext({ showToast: () => {} });

export function useToast() { return React.useContext(ToastContext); }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {toasts.map(t => {
          const colors = { success: { bg: "var(--success-tint)", border: "var(--success-border)", text: "var(--c-green)", icon: "✓" }, error: { bg: "var(--danger-tint)", border: "var(--danger-border)", text: "var(--c-red)", icon: "✕" }, info: { bg: "var(--info-tint-alt)", border: "var(--info-border-alt)", text: "var(--c-blue)", icon: "ℹ" }, warning: { bg: "var(--warning-bg)", border: "var(--warning-border)", text: "var(--warning-text)", icon: "⚠" } };
          const c = colors[t.type] || colors.success;
          return (
            <div key={t.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "12px 18px", color: c.text, fontSize: 14, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 10, animation: "slideInRight 0.25s ease-out", pointerEvents: "auto", maxWidth: 360 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{c.icon}</span>
              {t.message}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes slideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }`}</style>
    </ToastContext.Provider>
  );
}
