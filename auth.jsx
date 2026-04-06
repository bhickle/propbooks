// =============================================================================
// PropBooks Auth
// =============================================================================
// Cosmetic auth UI for now — no real backend. When you add Supabase/Auth0:
//   1. Replace signIn() and signUp() with real SDK calls
//   2. Replace useAuth's localStorage stub with a real session check
//   3. The UI components below need zero changes
// =============================================================================

import { useState, createContext, useContext } from "react";
import { Eye, EyeOff, ArrowRight, CheckCircle, Building2, TrendingUp, PieChart, Hammer, Car } from "lucide-react";
import propbooksLogoDark from "./logos/PropBooks Horizontal Logo (3).png";

// -----------------------------------------------------------------------------
// Auth Context
// -----------------------------------------------------------------------------
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // TODO: replace with real session check (e.g. supabase.auth.getSession())
  const [user, setUser] = useState(null);

  async function signIn(email, password) {
    // TODO: return await supabase.auth.signInWithPassword({ email, password })
    await new Promise(r => setTimeout(r, 700));
    setUser({ id: "usr_001", email, name: email.split("@")[0], initials: email[0].toUpperCase(), plan: "pro" });
    return { error: null };
  }

  async function signUp(email, password, name) {
    // TODO: return await supabase.auth.signUp({ email, password, options: { data: { name } } })
    await new Promise(r => setTimeout(r, 700));
    setUser({ id: "usr_new", email, name, initials: name[0].toUpperCase(), plan: "trial" });
    return { error: null, isNew: true };
  }

  function signOut() {
    // TODO: await supabase.auth.signOut()
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// -----------------------------------------------------------------------------
// Shared styles
// -----------------------------------------------------------------------------
const inp = {
  width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0",
  borderRadius: 10, fontSize: 14, color: "#041830", background: "#fff",
  outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
};
const primaryBtn = (loading) => ({
  width: "100%", padding: "12px", borderRadius: 10, border: "none",
  background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 15,
  cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center",
  justifyContent: "center", gap: 8, transition: "all 0.15s",
  opacity: loading ? 0.7 : 1,
});
const errStyle = {
  background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 8,
  padding: "10px 12px", color: "#9a3412", fontSize: 13, marginBottom: 16,
};

// -----------------------------------------------------------------------------
// Password input with show/hide toggle
// -----------------------------------------------------------------------------
function PasswordInput({ value, onChange, placeholder = "Password", id }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id} type={show ? "text" : "password"}
        value={value} onChange={onChange}
        placeholder={placeholder}
        style={{ ...inp, paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sign In Screen
// -----------------------------------------------------------------------------
function SignIn({ onSwitch }) {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    const { error: err } = await signIn(email, password);
    if (err) { setError(err.message || "Sign in failed."); setLoading(false); }
  }

  if (forgotMode) {
    return (
      <div>
        <h1 style={{ color: "#041830", fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Reset password</h1>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>
          {resetSent ? "Check your inbox for a reset link." : "Enter your email and we'll send a reset link."}
        </p>
        {resetSent ? (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 16, textAlign: "center", marginBottom: 20 }}>
            <CheckCircle size={28} color="#15803d" style={{ marginBottom: 8 }} />
            <p style={{ color: "#15803d", fontSize: 14, fontWeight: 600 }}>Reset email sent to {email}</p>
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Didn't get it? Check your spam folder or try again.</p>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
            <input style={inp} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => { setForgotMode(false); setResetSent(false); }} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
            Back to sign in
          </button>
          {!resetSent && (
            <button type="button" onClick={() => { if (email) { setResetSent(true); } }} style={{ ...primaryBtn(false), flex: 1, width: "auto" }}>
              Send reset link
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 style={{ color: "#041830", fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Welcome back</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>Sign in to manage your portfolio</p>

      {error && <div style={errStyle}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
          <input style={inp} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Password</label>
            <button type="button" onClick={() => setForgotMode(true)} style={{ background: "none", border: "none", color: "#e95e00", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
              Forgot password?
            </button>
          </div>
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} />
        </div>
      </div>

      <button type="submit" style={primaryBtn(loading)} disabled={loading}>
        {loading ? "Signing in..." : <><span>Sign In</span><ArrowRight size={16} /></>}
      </button>

      <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, marginTop: 20 }}>
        Don't have an account?{" "}
        <button type="button" onClick={onSwitch} style={{ background: "none", border: "none", color: "#e95e00", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
          Start free trial
        </button>
      </p>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Sign Up Screen
// -----------------------------------------------------------------------------
const PLANS = [
  { id: "starter", label: "Starter", price: "$25/mo", features: ["Up to 3 properties", "Transactions & reports", "Deal Analyzer"] },
  { id: "pro",     label: "Pro",     price: "$45/mo", features: ["Unlimited properties", "Flip Pipeline", "Tenant Management", "Mileage tracker"], highlight: true },
];

function SignUp({ onSwitch }) {
  const { signUp } = useAuth();
  const [step, setStep]         = useState(1);
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan]         = useState("pro");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleAccount(e) {
    e.preventDefault();
    if (!name || !email || !password) { setError("Please fill in all fields."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError(""); setStep(2);
  }

  async function handleSignUp() {
    setLoading(true); setError("");
    const { error: err } = await signUp(email, password, name);
    if (err) { setError(err.message || "Sign up failed."); setLoading(false); }
  }

  return (
    <div>
      <h1 style={{ color: "#041830", fontSize: 26, fontWeight: 800, marginBottom: 6 }}>
        {step === 1 ? "Create your account" : "Choose a plan"}
      </h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>
        {step === 1 ? "Start managing your portfolio like a pro" : "You can change this any time"}
      </p>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {[1, 2].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? "#e95e00" : "#e2e8f0", transition: "background 0.3s" }} />
        ))}
      </div>

      {error && <div style={errStyle}>{error}</div>}

      {step === 1 && (
        <form onSubmit={handleAccount}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Full Name</label>
              <input style={inp} placeholder="Brandon Hickle" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
              <input style={inp} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Password</label>
              <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" />
            </div>
          </div>
          <button type="submit" style={primaryBtn(false)}>
            <span>Continue</span><ArrowRight size={16} />
          </button>
        </form>
      )}

      {step === 2 && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            {PLANS.map(p => (
              <button key={p.id} type="button" onClick={() => setPlan(p.id)}
                style={{
                  flex: 1, padding: "16px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                  border: plan === p.id ? "2px solid #e95e00" : "2px solid #e2e8f0",
                  background: plan === p.id ? "#fff7ed" : "#fff",
                  transition: "all 0.15s", position: "relative",
                }}>
                {p.highlight && (
                  <span style={{ position: "absolute", top: -10, right: 10, background: "#e95e00", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                    POPULAR
                  </span>
                )}
                <p style={{ fontWeight: 700, color: "#041830", fontSize: 15, marginBottom: 2 }}>{p.label}</p>
                <p style={{ color: "#e95e00", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{p.price}</p>
                {p.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <CheckCircle size={12} color="#10b981" />
                    <span style={{ fontSize: 12, color: "#64748b" }}>{f}</span>
                  </div>
                ))}
              </button>
            ))}
          </div>
          <button onClick={handleSignUp} style={primaryBtn(loading)} disabled={loading}>
            {loading ? "Creating account..." : <><span>Start Free Trial</span><ArrowRight size={16} /></>}
          </button>
          <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>
            14-day free trial · No credit card required
          </p>
        </div>
      )}

      <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, marginTop: 20 }}>
        Already have an account?{" "}
        <button type="button" onClick={onSwitch} style={{ background: "none", border: "none", color: "#e95e00", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
          Sign in
        </button>
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Auth Screen (wrapper that toggles between SignIn / SignUp)
// -----------------------------------------------------------------------------
export function AuthScreen() {
  const [mode, setMode] = useState("signin");

  return (
    <div style={{
      minHeight: "100vh", display: "flex", background: "#f8fafc",
    }}>
      {/* Left panel - form */}
      <div style={{
        width: "100%", maxWidth: 480, padding: "48px 48px",
        display: "flex", flexDirection: "column", justifyContent: "center",
        background: "#fff", boxShadow: "2px 0 20px rgba(0,0,0,0.06)",
        minHeight: "100vh",
      }}>
        {mode === "signin"
          ? <SignIn onSwitch={() => setMode("signup")} />
          : <SignUp onSwitch={() => setMode("signin")} />}
      </div>

      {/* Right panel - branded visual */}
      <div style={{
        flex: 1, background: "linear-gradient(135deg, #041830 0%, #0a2a4a 50%, #0e3460 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 48, position: "relative", overflow: "hidden",
      }}>
        {/* Decorative orange glow circles */}
        <div style={{ position: "absolute", top: -120, right: -120, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(233,94,0,0.15) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(233,94,0,0.1) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: "35%", right: "8%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(233,94,0,0.08) 0%, transparent 70%)" }} />

        {/* Subtle grid pattern overlay */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.03, backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 440 }}>
          {/* Logo */}
          <img src={propbooksLogoDark} alt="PropBooks" style={{ height: 56, objectFit: "contain", marginBottom: 40, mixBlendMode: "screen" }} />

          <h2 style={{ color: "#fff", fontSize: 30, fontWeight: 800, marginBottom: 14, lineHeight: 1.25 }}>
            Whether you hold it or flip it,<br />we've got you covered.
          </h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 1.7, marginBottom: 40 }}>
            The only platform that treats your rentals and flips as equals — cash flow tracking, rehab budgets, tenant management, and deal analysis, all under one roof.
          </p>

          {/* Feature cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "left" }}>
            {[
              { icon: PieChart, label: "Rental Cash Flow", sub: "Income, expenses & equity across every door" },
              { icon: Hammer, label: "Flip Pipeline", sub: "Rehab budgets, milestones & contractor tracking" },
              { icon: Building2, label: "Tenant Management", sub: "Leases, vacancies & expiration alerts" },
              { icon: TrendingUp, label: "Deal Analyzer", sub: "Run the numbers before you buy" },
            ].map((f, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
                background: "rgba(255,255,255,0.06)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(233,94,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <f.icon size={16} color="#fb923c" />
                </div>
                <div>
                  <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: "0 0 2px 0" }}>{f.label}</p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0 }}>{f.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust line */}
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, marginTop: 36, fontWeight: 500 }}>
            Built for serious real estate investors
          </p>
        </div>
      </div>
    </div>
  );
}
