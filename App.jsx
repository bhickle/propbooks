// =============================================================================
// App.jsx — top-level entrypoint. The actual app shell, navigation, hydration,
// and view routing live in views/AppShell.jsx. Everything here is just the
// provider stack + the "are we configured / authenticated yet" gate.
// =============================================================================
import { AuthProvider, AuthScreen, useAuth } from "./auth.jsx";
import { SUPABASE_CONFIGURED, SUPABASE_CONFIG_ERROR } from "./supabase.js";
import { ToastProvider } from "./toast.jsx";
import { ThemeProvider } from "./theme.jsx";
import { AppShell } from "./views/AppShell.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

function AuthGate() {
  const { user } = useAuth();
  if (!SUPABASE_CONFIGURED) {
    return <ConfigErrorScreen message={SUPABASE_CONFIG_ERROR} />;
  }
  // user === undefined means we're still resolving the session
  if (user === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e3a5f" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.2)", borderTop: "3px solid #e95e00", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Loading PROPBOOKS…</p>
        </div>
      </div>
    );
  }
  return user ? <AppShell /> : <AuthScreen />;
}

function ConfigErrorScreen({ message }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e3a5f", padding: "24px 16px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "32px 36px", maxWidth: 520, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>⚠</span>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#041830", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>Configuration Error</h2>
        </div>
        <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.55, marginBottom: 16 }}>{message}</p>
        <pre style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#1e293b", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          VITE_SUPABASE_URL=https://your-project.supabase.co{"\n"}
          VITE_SUPABASE_ANON_KEY=your-anon-key
        </pre>
      </div>
    </div>
  );
}
