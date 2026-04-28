// =============================================================================
// auth.jsx — PropBooks Authentication UI
// Login · Sign Up · Reset Password
// Also exports: AuthProvider, AuthScreen, useAuth
// =============================================================================
import { useState, useEffect, useContext, createContext } from "react";
import { signIn, signUp, signOut as supabaseSignOut, getSession, onAuthChange, supabase } from "./supabase.js";

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// Normalise raw Supabase user to shape expected by AppShell
function normalizeUser(raw) {
  if (!raw) return raw; // null | undefined pass through
  const meta = raw.user_metadata || {};
  const name = meta.name || raw.email?.split("@")[0] || "User";
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return {
    ...raw,
    name,
    initials,
    email: raw.email,
    planLabel: "PRO PLAN",
    planDescription: "Unlimited properties",
    plan: "pro",
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    // Seed initial session
    getSession().then(session => setUser(normalizeUser(session?.user ?? null)));
    // Subscribe to auth state changes
    const { data: { subscription } } = onAuthChange(u => setUser(normalizeUser(u ?? null)));
    return () => subscription?.unsubscribe();
  }, []);

  async function signOutUser() {
    await supabaseSignOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// ─── Brand ───────────────────────────────────────────────────────────────────
const NAVY   = "#1e3a5f";
const NAVY2  = "#2d5280";
const ORANGE = "#e95e00";

// ─── Logo ────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, justifyContent: "center" }}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="9" fill={ORANGE} />
        <path d="M18 7L6 17h3v12h7v-7h4v7h7V17h3L18 7z" fill="white" />
        <rect x="14" y="22" width="8" height="1.5" rx="0.75" fill={ORANGE} opacity="0.7" />
      </svg>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
          PropBooks
        </div>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, letterSpacing: "0.3px" }}>
          Real Estate Intelligence
        </div>
      </div>
    </div>
  );
}

// ─── Alert ───────────────────────────────────────────────────────────────────
function Alert({ type, message }) {
  if (!message) return null;
  const isError   = type === "error";
  const isSuccess = type === "success";
  return (
    <div style={{
      padding: "10px 14px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 500,
      marginBottom: 18,
      background: isError   ? "#fef2f2" : isSuccess ? "#f0fdf4" : "#eff6ff",
      border:     `1px solid ${isError ? "#fecaca" : isSuccess ? "#bbf7d0" : "#bfdbfe"}`,
      color:      isError   ? "#b91c1c" : isSuccess ? "#15803d" : "#1d4ed8",
      display: "flex", alignItems: "flex-start", gap: 8,
    }}>
      <span style={{ fontSize: 15, lineHeight: 1 }}>
        {isError ? "⚠" : isSuccess ? "✓" : "ℹ"}
      </span>
      <span>{message}</span>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder, autoComplete }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "10px 13px",
          borderRadius: 9,
          border: `1.5px solid ${focused ? ORANGE : "#d1d5db"}`,
          fontSize: 14,
          outline: "none",
          background: "#fff",
          color: "#111827",
          boxSizing: "border-box",
          transition: "border-color 0.15s",
          boxShadow: focused ? `0 0 0 3px rgba(233,94,0,0.12)` : "none",
        }}
      />
    </div>
  );
}

// ─── SubmitBtn ────────────────────────────────────────────────────────────────
function SubmitBtn({ label, loading }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: "100%",
        padding: "11px 0",
        borderRadius: 9,
        border: "none",
        background: loading ? "#f97316" : ORANGE,
        color: "#fff",
        fontSize: 14,
        fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.8 : 1,
        letterSpacing: "0.2px",
        transition: "opacity 0.15s",
        marginTop: 4,
      }}
    >
      {loading ? "Please wait…" : label}
    </button>
  );
}

const DEMO_EMAIL = "demo@propbooks.com";
const DEMO_PASS  = "PropBooks2024!";

// ─── LoginForm ───────────────────────────────────────────────────────────────
function LoginForm({ onSwitch, onSuccess }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [alert,    setAlert]    = useState(null);

  async function doSignIn(e, em, pw) {
    e?.preventDefault();
    setAlert(null);
    if (!em || !pw) return setAlert({ type: "error", message: "Please fill in all fields." });
    setLoading(true);
    try {
      await signIn(em, pw);
      onSuccess?.();
    } catch (err) {
      setAlert({ type: "error", message: err.message || "Invalid email or password." });
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASS);
    setAlert({ type: "info", message: "Demo credentials loaded — click Sign In to explore." });
  }

  return (
    <>
      <Logo />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: "0 0 4px", textAlign: "center" }}>
        Sign in to PropBooks
      </h2>
      <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 18 }}>
        Manage your portfolio from one place
      </p>

      {/* Try Demo banner */}
      <button
        type="button"
        onClick={loadDemo}
        style={{
          width: "100%", marginBottom: 18,
          padding: "9px 14px",
          borderRadius: 10,
          border: `1.5px dashed ${ORANGE}`,
          background: "rgba(233,94,0,0.05)",
          color: ORANGE,
          fontSize: 13, fontWeight: 600,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        <span style={{ fontSize: 16 }}>▶</span> Try the live demo
      </button>

      <Alert {...(alert || {})} />
      <form onSubmit={e => doSignIn(e, email, password)}>
        <Field label="Email address" type="email"    value={email}    onChange={setEmail}    placeholder="you@example.com" autoComplete="email" />
        <Field label="Password"      type="password" value={password} onChange={setPassword} placeholder="••••••••"        autoComplete="current-password" />
        <div style={{ textAlign: "right", marginTop: -8, marginBottom: 18 }}>
          <button type="button" onClick={() => onSwitch("reset")}
            style={{ background: "none", border: "none", color: ORANGE, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
            Forgot password?
          </button>
        </div>
        <SubmitBtn label="Sign In" loading={loading} />
      </form>
      <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 22 }}>
        Don't have an account?{" "}
        <button onClick={() => onSwitch("signup")}
          style={{ background: "none", border: "none", color: ORANGE, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0 }}>
          Sign up
        </button>
      </p>
    </>
  );
}

// ─── SignupForm ───────────────────────────────────────────────────────────────
function SignupForm({ onSwitch }) {
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [alert,    setAlert]    = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert(null);
    if (!name || !email || !password || !confirm)
      return setAlert({ type: "error", message: "Please fill in all fields." });
    if (password !== confirm)
      return setAlert({ type: "error", message: "Passwords do not match." });
    if (password.length < 8)
      return setAlert({ type: "error", message: "Password must be at least 8 characters." });
    setLoading(true);
    try {
      await signUp(email, password, name);
      setAlert({ type: "success", message: "Account created! Check your email to confirm your address, then sign in." });
    } catch (err) {
      setAlert({ type: "error", message: err.message || "Could not create account. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Logo />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: "0 0 4px", textAlign: "center" }}>
        Create your account
      </h2>
      <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 26 }}>
        Start your 14-day free trial — no credit card required
      </p>
      <Alert {...(alert || {})} />
      <form onSubmit={handleSubmit}>
        <Field label="Full name"        type="text"     value={name}     onChange={setName}     placeholder="Jane Smith"         autoComplete="name" />
        <Field label="Email address"    type="email"    value={email}    onChange={setEmail}    placeholder="you@example.com"    autoComplete="email" />
        <Field label="Password"         type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters"  autoComplete="new-password" />
        <Field label="Confirm password" type="password" value={confirm}  onChange={setConfirm}  placeholder="Repeat password"    autoComplete="new-password" />
        <SubmitBtn label="Create Account" loading={loading} />
      </form>
      <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 22 }}>
        Already have an account?{" "}
        <button onClick={() => onSwitch("login")}
          style={{ background: "none", border: "none", color: ORANGE, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0 }}>
          Sign in
        </button>
      </p>
      <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 14, lineHeight: 1.5 }}>
        By creating an account you agree to our{" "}
        <a href="#" style={{ color: "#9ca3af" }}>Terms of Service</a> and{" "}
        <a href="#" style={{ color: "#9ca3af" }}>Privacy Policy</a>.
      </p>
    </>
  );
}

// ─── ResetForm ───────────────────────────────────────────────────────────────
function ResetForm({ onSwitch }) {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [alert,   setAlert]   = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert(null);
    if (!email) return setAlert({ type: "error", message: "Please enter your email address." });
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setAlert({ type: "success", message: "Check your email for a password reset link." });
    } catch (err) {
      setAlert({ type: "error", message: err.message || "Could not send reset email. Try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Logo />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: "0 0 4px", textAlign: "center" }}>
        Reset your password
      </h2>
      <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 26 }}>
        Enter your email and we'll send you a link
      </p>
      <Alert {...(alert || {})} />
      <form onSubmit={handleSubmit}>
        <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
        <SubmitBtn label="Send Reset Link" loading={loading} />
      </form>
      <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 22 }}>
        <button onClick={() => onSwitch("login")}
          style={{ background: "none", border: "none", color: ORANGE, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0 }}>
          ← Back to sign in
        </button>
      </p>
    </>
  );
}

// ─── AuthUI (shared render) ───────────────────────────────────────────────────
function AuthUI({ onAuthenticated } = {}) {
  const [view, setView] = useState("login"); // "login" | "signup" | "reset"

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: `radial-gradient(ellipse at top left, ${NAVY2} 0%, ${NAVY} 50%, #1a3a5c 100%)`,
      padding: "24px 16px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Subtle dot-grid background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
      }} />

      {/* Decorative blobs */}
      <div style={{
        position: "absolute", top: "-80px", right: "-80px",
        width: 320, height: 320, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(233,94,0,0.18) 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-60px", left: "-60px",
        width: 260, height: 260, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(233,94,0,0.12) 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* Card */}
      <div style={{
        position: "relative",
        background: "#fff",
        borderRadius: 20,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 24px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.1)",
      }}>
        {view === "login"  && <LoginForm  onSwitch={setView} onSuccess={onAuthenticated ?? (() => {})} />}
        {view === "signup" && <SignupForm onSwitch={setView} />}
        {view === "reset"  && <ResetForm  onSwitch={setView} />}
      </div>

      {/* Footer tagline */}
      <div style={{
        position: "absolute", bottom: 20, left: 0, right: 0,
        textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.35)",
        pointerEvents: "none",
      }}>
        PropBooks · Built for serious real estate investors
      </div>
    </div>
  );
}

// ─── AuthScreen (used by App.jsx AuthGate) ────────────────────────────────────
export function AuthScreen() {
  return <AuthUI />;
}

// ─── Default export ───────────────────────────────────────────────────────────
export default function Auth({ onAuthenticated }) {
  return <AuthUI onAuthenticated={onAuthenticated} />;
}
