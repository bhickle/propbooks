// =============================================================================
// App.jsx — top-level entrypoint. The actual app shell, navigation, hydration,
// and view routing live in views/AppShell.jsx. Everything here is just the
// provider stack + the "are we configured / authenticated yet" gate.
// =============================================================================
import { useEffect, useState } from "react";
import { AuthProvider, AuthScreen, SetPasswordScreen, useAuth } from "./auth.jsx";
import { SUPABASE_CONFIGURED, SUPABASE_CONFIG_ERROR } from "./supabase.js";
import { ToastProvider, useToast } from "./toast.jsx";
import { ThemeProvider } from "./theme.jsx";
import { AppShell } from "./views/AppShell.jsx";
import { acceptInvite } from "./db/accounts.js";

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

// Reads an invite token from the URL exactly once. Returns the token (or null)
// and a clearer that drops it from the URL after the flow completes — so a
// refresh doesn't re-trigger the accept-invite handler.
function useInviteToken() {
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("invite");
  });
  function clear() {
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState(null, "", url.pathname + (url.search || ""));
    setToken(null);
  }
  return [token, clear];
}

// Banner shown after a signed-in user clicks an invite link. Calls
// acceptInvite() then refreshes the profile so AppShell re-hydrates against
// the new account's data.
function InviteAcceptHandler({ token, onDone }) {
  const { refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [state, setState] = useState("working"); // working | done | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await acceptInvite(token);
        if (cancelled) return;
        setState("done");
        showToast("Joined the account — loading your portfolio…", "success");
        refreshProfile?.();
        setTimeout(() => { if (!cancelled) onDone(); }, 900);
      } catch (e) {
        if (cancelled) return;
        setState("error");
        setMessage(e.message || "Could not accept invitation.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e3a5f", padding: "24px 16px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "32px 36px", maxWidth: 460, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.28)", textAlign: "center" }}>
        {state === "working" && (
          <>
            <div style={{ width: 40, height: 40, border: "3px solid rgba(30,58,95,0.15)", borderTop: "3px solid #e95e00", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#041830", marginBottom: 6, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>Joining the account…</h2>
            <p style={{ fontSize: 13, color: "#64748b" }}>One moment.</p>
          </>
        )}
        {state === "done" && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#15803d", marginBottom: 6, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>You're in.</h2>
            <p style={{ fontSize: 13, color: "#64748b" }}>Redirecting to the dashboard…</p>
          </>
        )}
        {state === "error" && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#b91c1c", marginBottom: 6, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>Couldn't accept the invite</h2>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{message}</p>
            <button onClick={onDone} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Continue</button>
          </>
        )}
      </div>
    </div>
  );
}

function AuthGate() {
  const { user, passwordRecoveryMode } = useAuth();
  const [inviteToken, clearInviteToken] = useInviteToken();

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
  // Supabase fires PASSWORD_RECOVERY after the user clicks the email reset
  // link. Show the "Set new password" screen before letting them into the
  // shell — otherwise they'd land in the app with no UI to actually set one.
  if (passwordRecoveryMode) return <SetPasswordScreen />;
  // Signed-in user clicked an invite link → run the accept-invite flow first.
  // Signed-out users land on AuthScreen with the token still in the URL;
  // signing up via the trigger auto-joins them based on email match
  // (handle_new_auth_user looks up account_invites by email). Existing
  // accounts that sign in keep the token in the URL, which this gate then
  // picks up on the post-login render.
  if (user && inviteToken) return <InviteAcceptHandler token={inviteToken} onDone={clearInviteToken} />;
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
