// =============================================================================
// RealVault Auth
// =============================================================================
// Cosmetic auth UI for now — no real backend. When you add Supabase/Auth0:
//   1. Replace signIn() and signUp() with real SDK calls
//   2. Replace useAuth's localStorage stub with a real session check
//   3. The UI components below need zero changes
// =============================================================================

import { useState, createContext, useContext } from "react";
import { Building2, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";

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
  borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff",
  outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
};
const btn = (color = "#3b82f6") => ({
  width: "100%", padding: "12px", borderRadius: 10, border: "none",
  background: color, color: "#fff", fontWeight: 700, fontSize: 15,
  cursor: "pointer", display: "flex", alignItems: "center",
  justifyContent: "center", gap: 8, transition: "opacity 0.15s",
});
const errStyle = {
  background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
  padding: "10px 12px", color: "#b91c1c", fontSize: 13, marginBottom: 16,
};

// -----------------------------------------------------------------------------
// Logo / Brand mark
// -----------------------------------------------------------------------------
function Brand({ size = "lg" }) {
  const big = size === "lg";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: big ? 12 : 8, marginBottom: big ? 32 : 0 }}>
      <div style={{
        width: big ? 48 : 36, height: big ? 48 : 36, borderRadius: big ? 14 : 10,
        background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Building2 size={big ? 26 : 20} color="#fff" />
      </div>
      <div>
        <p style={{ color: "#0f172a", fontSize: big ? 22 : 16, fontWeight: 800, lineHeight: 1 }}>RealVault</p>
        {big && <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>Pro Investor Suite</p>}
      </div>
    </div>
  );
}

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    const { error: err } = await signIn(email, password);
    if (err) { setError(err.message || "Sign in failed."); setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Brand />
      <h1 style={{ color: "#0f172a", fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Welcome back</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>Sign in to your portfolio</p>

      {error && <div style={errStyle}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
          <input style={inp} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Password</label>
            <button type="button" style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
              Forgot password?
            </button>
          </div>
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} />
        </div>
      </div>

      <button type="submit" style={btn()} disabled={loading}>
        {loading ? "Signing in…" : <><span>Sign In</span><ArrowRight size={16} /></>}
      </button>

      <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, marginTop: 20 }}>
        Don't have an account?{" "}
        <button type="button" onClick={onSwitch} style={{ background: "none", border: "none", color: "#3b82f6", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
          Create one free
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
  const [step, setStep]         = useState(1); // 1 = account, 2 = plan
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
    // On success, AuthProvider sets user → App renders main app
  }

  return (
    <div>
      <Brand />
      <h1 style={{ color: "#0f172a", fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
        {step === 1 ? "Create your account" : "Choose a plan"}
      </h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>
        {step === 1 ? "Start managing your portfolio like a pro" : "You can change this any time"}
      </p>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {[1, 2].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? "#3b82f6" : "#e2e8f0", transition: "background 0.3s" }} />
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
          <button type="submit" style={btn()}>
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
                  border: plan === p.id ? "2px solid #3b82f6" : "2px solid #e2e8f0",
                  background: plan === p.id ? "#eff6ff" : "#fff",
                  transition: "all 0.15s", position: "relative",
                }}>
                {p.highlight && (
                  <span style={{ position: "absolute", top: -10, right: 10, background: "#3b82f6", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                    POPULAR
                  </span>
                )}
                <p style={{ fontWeight: 700, color: "#0f172a", fontSize: 15, marginBottom: 2 }}>{p.label}</p>
                <p style={{ color: "#3b82f6", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{p.price}</p>
                {p.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <CheckCircle size={12} color="#10b981" />
                    <span style={{ fontSize: 12, color: "#64748b" }}>{f}</span>
                  </div>
                ))}
              </button>
            ))}
          </div>
          <button onClick={handleSignUp} style={btn()} disabled={loading}>
            {loading ? "Creating account…" : <><span>Start Free Trial</span><ArrowRight size={16} /></>}
          </button>
          <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>
            14-day free trial · No credit card required
          </p>
        </div>
      )}

      <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, marginTop: 20 }}>
        Already have an account?{" "}
        <button type="button" onClick={onSwitch} style={{ background: "none", border: "none", color: "#3b82f6", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
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
      {/* Left panel – form */}
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

      {/* Right panel – visual */}
      <div style={{
        flex: 1, background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e1b4b 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 48, position: "relative", overflow: "hidden",
      }}>
        {/* Decorative circles */}
        {[
          { size: 400, top: -100, right: -100, opacity: 0.06 },
          { size: 300, bottom: -80, left: -80,  opacity: 0.05 },
          { size: 200, top: "40%", right: "10%", opacity: 0.07 },
        ].map((c, i) => (
          <div key={i} style={{
            position: "absolute", width: c.size, height: c.size, borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.3)",
            top: c.top, right: c.right, bottom: c.bottom, left: c.left, opacity: c.opacity,
          }} />
        ))}

        <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 420 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
          }}>
            <Building2 size={38} color="#fff" />
          </div>
          <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
            Your entire portfolio.<br />One clean dashboard.
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, marginBottom: 36 }}>
            Track rentals, manage flips, analyze deals, and log mileage — built for serious real estate investors.
          </p>

          {/* Feature pills */}
          {[
            "Portfolio analytics & cash flow",
            "Fix & flip pipeline tracker",
            "Rent roll & tenant management",
            "Deal analyzer & mileage log",
          ].map(f => (
            <div key={f} style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 12, textAlign: "left",
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CheckCircle size={14} color="#60a5fa" />
              </div>
              <span style={{ color: "#cbd5e1", fontSize: 14 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
