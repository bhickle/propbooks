// =============================================================================
// PropBooks Settings + Onboarding
// =============================================================================

import { useState } from "react";
import { useAuth } from "./auth.jsx";
import {
  User, CreditCard, Bell, Shield, Building2, ChevronRight,
  CheckCircle, ArrowRight, Star, X, Pencil, Save,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Shared input style
// -----------------------------------------------------------------------------
const inp = {
  width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0",
  borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff",
  outline: "none", boxSizing: "border-box",
};
const label = (text) => (
  <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{text}</p>
);
const section = (title, sub) => (
  <div style={{ marginBottom: 20 }}>
    <h3 style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{title}</h3>
    {sub && <p style={{ color: "#94a3b8", fontSize: 13 }}>{sub}</p>}
  </div>
);
const card = { background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #f1f5f9", marginBottom: 20 };

// -----------------------------------------------------------------------------
// Settings Tabs
// -----------------------------------------------------------------------------
const TABS = [
  { id: "profile",       icon: User,       label: "Profile"       },
  { id: "subscription",  icon: CreditCard, label: "Subscription"  },
  { id: "notifications", icon: Bell,       label: "Notifications" },
  { id: "security",      icon: Shield,     label: "Security"      },
];

// -----------------------------------------------------------------------------
// Profile Tab
// -----------------------------------------------------------------------------
function ProfileTab() {
  const { user, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(user?.name || "");
  const [email, setEmail]     = useState(user?.email || "");
  const [phone, setPhone]     = useState("");
  const [saved, setSaved]     = useState(false);

  function handleSave() {
    // TODO: await api.updateUser({ name, email, phone })
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      {section("Profile", "Manage your personal information")}

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 24, flexShrink: 0,
          }}>
            {user?.initials || "?"}
          </div>
          <div>
            <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 17 }}>{user?.name}</p>
            <p style={{ color: "#64748b", fontSize: 13 }}>{user?.email}</p>
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
              Member since {user?.memberSince || "2024"}
            </p>
          </div>
          <button onClick={() => setEditing(e => !e)}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
            <Pencil size={13} /> Edit
          </button>
        </div>

        {editing && (
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>{label("Full Name")}<input style={inp} value={name} onChange={e => setName(e.target.value)} /></div>
              <div>{label("Phone")}<input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="555-000-0000" /></div>
            </div>
            <div style={{ marginBottom: 20 }}>
              {label("Email")}
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSave}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <Save size={13} /> Save Changes
              </button>
              <button onClick={() => setEditing(false)}
                style={{ padding: "9px 16px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#64748b" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#dcfce7", borderRadius: 8, padding: "10px 14px", marginTop: 14 }}>
            <CheckCircle size={15} color="#15803d" />
            <span style={{ color: "#15803d", fontSize: 13, fontWeight: 600 }}>Profile saved successfully</span>
          </div>
        )}
      </div>

      <div style={card}>
        <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Sign Out</p>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>Sign out of your PropBooks account on this device.</p>
        <button onClick={signOut}
          style={{ padding: "9px 18px", borderRadius: 9, border: "1.5px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subscription Tab
// -----------------------------------------------------------------------------
const PLAN_FEATURES = {
  starter: ["Up to 3 properties", "Transactions & reports", "Deal Analyzer", "Email support"],
  pro:     ["Unlimited properties", "Fix & Flip Pipeline", "Tenant Management", "Mileage tracker", "Priority support", "Advanced analytics"],
  team:    ["Everything in Pro", "Up to 5 team members", "Shared portfolio access", "Admin controls", "Dedicated support"],
};

function SubscriptionTab() {
  const { user } = useAuth();
  const current = user?.plan || "pro";

  return (
    <div>
      {section("Subscription", "Manage your plan and billing")}

      {/* Current plan */}
      <div style={{ ...card, border: "2px solid #3b82f6", background: "#eff6ff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Star size={16} color="#f59e0b" fill="#f59e0b" />
          <span style={{ color: "#1d4ed8", fontWeight: 700, fontSize: 14 }}>
            {current.toUpperCase()} PLAN — Active
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {(PLAN_FEATURES[current] || []).map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle size={13} color="#10b981" />
              <span style={{ fontSize: 13, color: "#374151" }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan comparison */}
      <div style={card}>
        <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>All Plans</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { id: "starter", label: "Starter", price: "$25", period: "/mo" },
            { id: "pro",     label: "Pro",     price: "$45", period: "/mo", popular: true },
            { id: "team",    label: "Team",    price: "$99", period: "/mo" },
          ].map(p => (
            <div key={p.id} style={{
              padding: 16, borderRadius: 12, border: current === p.id ? "2px solid #3b82f6" : "2px solid #e2e8f0",
              background: current === p.id ? "#eff6ff" : "#fafafa", position: "relative",
            }}>
              {p.popular && current !== p.id && (
                <span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: "#3b82f6", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                  POPULAR
                </span>
              )}
              <p style={{ fontWeight: 700, color: "#0f172a", fontSize: 15, marginBottom: 4 }}>{p.label}</p>
              <p style={{ fontWeight: 800, color: "#0f172a", fontSize: 20 }}>
                {p.price}<span style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8" }}>{p.period}</span>
              </p>
              <div style={{ marginTop: 10 }}>
                {(PLAN_FEATURES[p.id] || []).map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                    <CheckCircle size={11} color="#10b981" />
                    <span style={{ fontSize: 11, color: "#64748b" }}>{f}</span>
                  </div>
                ))}
              </div>
              {current !== p.id && (
                <button style={{ width: "100%", marginTop: 12, padding: "7px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  {current === "starter" ? "Upgrade" : "Switch"}
                </button>
              )}
              {current === p.id && (
                <div style={{ marginTop: 12, padding: "7px", borderRadius: 8, background: "#dbeafe", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>
                  Current Plan
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Billing</p>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>Billing management will be available when payments are enabled.</p>
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0" }}>
          <p style={{ color: "#64748b", fontSize: 13 }}>Next billing date: <strong style={{ color: "#0f172a" }}>April 15, 2026</strong></p>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Notifications Tab
// -----------------------------------------------------------------------------
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
      background: on ? "#3b82f6" : "#e2e8f0", position: "relative", transition: "background 0.2s", flexShrink: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3, left: on ? 23 : 3, transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    rentDue:      true,
    leaseExpiry:  true,
    maintenance:  true,
    flipUpdates:  false,
    weeklyReport: true,
    marketing:    false,
  });
  const toggle = k => setPrefs(p => ({ ...p, [k]: !p[k] }));

  const items = [
    { key: "rentDue",      label: "Rent Due Reminders",     desc: "Alerts when rent payments are upcoming or overdue" },
    { key: "leaseExpiry",  label: "Lease Expiry Alerts",    desc: "Notify 60, 30, and 7 days before lease expiration" },
    { key: "maintenance",  label: "Maintenance Requests",   desc: "New maintenance requests from tenants" },
    { key: "flipUpdates",  label: "Flip Milestone Updates", desc: "Contractor check-ins and milestone completions" },
    { key: "weeklyReport", label: "Weekly Portfolio Report",desc: "Sunday summary of cash flow and key metrics" },
    { key: "marketing",    label: "Product Updates & Tips", desc: "New features and real estate investing tips" },
  ];

  return (
    <div>
      {section("Notifications", "Choose what you want to be notified about")}
      <div style={card}>
        {items.map((item, i) => (
          <div key={item.key} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingBottom: i < items.length - 1 ? 16 : 0,
            marginBottom: i < items.length - 1 ? 16 : 0,
            borderBottom: i < items.length - 1 ? "1px solid #f1f5f9" : "none",
          }}>
            <div>
              <p style={{ color: "#0f172a", fontWeight: 600, fontSize: 14 }}>{item.label}</p>
              <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{item.desc}</p>
            </div>
            <Toggle on={prefs[item.key]} onChange={() => toggle(item.key)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Security Tab
// -----------------------------------------------------------------------------
function SecurityTab() {
  const [current, setCurrent]   = useState("");
  const [newPass, setNewPass]   = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saved, setSaved]       = useState(false);

  function handleSave(e) {
    e.preventDefault();
    if (!current || !newPass || !confirm) return;
    // TODO: await supabase.auth.updateUser({ password: newPass })
    setSaved(true);
    setCurrent(""); setNewPass(""); setConfirm("");
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      {section("Security", "Manage your password and account security")}
      <div style={card}>
        <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Change Password</p>
        <form onSubmit={handleSave}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
            <div>{label("Current Password")}<input style={inp} type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" /></div>
            <div>{label("New Password")}<input style={inp} type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min. 8 characters" /></div>
            <div>{label("Confirm New Password")}<input style={inp} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter new password" /></div>
          </div>
          {saved && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#dcfce7", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
              <CheckCircle size={15} color="#15803d" />
              <span style={{ color: "#15803d", fontSize: 13, fontWeight: 600 }}>Password updated successfully</span>
            </div>
          )}
          <button type="submit"
            style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Update Password
          </button>
        </form>
      </div>

      <div style={card}>
        <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Two-Factor Authentication</p>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 14 }}>Add an extra layer of security to your account. Coming soon.</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Not enabled</span>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Settings Component
// -----------------------------------------------------------------------------
export function Settings({ onClose }) {
  const [activeTab, setActiveTab] = useState("profile");

  const tabContent = {
    profile:       <ProfileTab />,
    subscription:  <SubscriptionTab />,
    notifications: <NotificationsTab />,
    security:      <SecurityTab />,
  };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Sidebar */}
      <div style={{ width: 220, borderRight: "1px solid #f1f5f9", paddingRight: 24, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ color: "#0f172a", fontSize: 18, fontWeight: 700 }}>Settings</h2>
          {onClose && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
              <X size={18} />
            </button>
          )}
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left",
                  background: active ? "#eff6ff" : "transparent",
                  color: active ? "#1d4ed8" : "#64748b",
                  fontWeight: active ? 700 : 500, fontSize: 14,
                  transition: "all 0.15s",
                }}>
                <tab.icon size={16} />
                {tab.label}
                {active && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingLeft: 32, overflowY: "auto" }}>
        {tabContent[activeTab]}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Onboarding Wizard (shown to new users after signup)
// -----------------------------------------------------------------------------
const ONBOARDING_STEPS = [
  { id: "welcome",  title: "Welcome to PropBooks 👋",       sub: "Let's get your portfolio set up in 2 minutes." },
  { id: "property", title: "Add your first property",        sub: "You can always add more later." },
  { id: "done",     title: "You're all set!",                sub: "Your portfolio dashboard is ready." },
];

export function OnboardingWizard({ onComplete }) {
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState({ name: "", address: "", type: "Single Family", purchasePrice: "", monthlyRent: "" });

  const current = ONBOARDING_STEPS[step];

  function handleNext() {
    if (step < ONBOARDING_STEPS.length - 1) setStep(s => s + 1);
    else onComplete();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000,
    }}>
      <div style={{ background: "#fff", borderRadius: 24, padding: 40, width: 520, boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? "#3b82f6" : "#e2e8f0", transition: "background 0.3s" }} />
          ))}
        </div>

        <h2 style={{ color: "#0f172a", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{current.title}</h2>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>{current.sub}</p>

        {/* Step content */}
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
            {[
              { icon: Building2, color: "#3b82f6", title: "Track your rentals",    sub: "Properties, tenants, cash flow"  },
              { icon: Star,      color: "#f59e0b", title: "Manage your flips",     sub: "Pipeline, rehab budget, P&L"     },
              { icon: CheckCircle, color: "#10b981", title: "Analyze new deals",   sub: "Cap rate, CoC, GRM calculator"  },
            ].map(item => (
              <div key={item.title} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: item.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <item.icon size={18} color={item.color} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{item.title}</p>
                  <p style={{ color: "#94a3b8", fontSize: 12 }}>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Property Name</p>
              <input style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
                placeholder="e.g. Oak Street Duplex"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Address</p>
              <input style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
                placeholder="123 Main St, City, State"
                value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Purchase Price</p>
                <input style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
                  placeholder="$350,000" type="number"
                  value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Monthly Rent</p>
                <input style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
                  placeholder="$2,500" type="number"
                  value={form.monthlyRent} onChange={e => setForm(f => ({ ...f, monthlyRent: e.target.value }))} />
              </div>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12 }}>You can skip this and add properties from the dashboard.</p>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: "center", padding: "10px 0 28px" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", background: "#dcfce7",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <CheckCircle size={36} color="#15803d" />
            </div>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              Your portfolio dashboard is ready. Start by exploring the Dashboard or adding more properties.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={onComplete}
            style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>
            {step < 2 ? "Skip for now" : ""}
          </button>
          <button onClick={handleNext}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 24px", borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {step < 2 ? "Continue" : "Go to Dashboard"}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
