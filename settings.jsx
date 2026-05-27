// =============================================================================
// PropBooks Settings + Onboarding
// =============================================================================

import { useState, useEffect } from "react";
import { useAuth } from "./auth.jsx";
import { supabase } from "./supabase.js";
import { wipeUserData } from "./db/resetDemo.js";
import {
  getCurrentAccount, listAccountMembers, listPendingInvites,
  inviteByEmail, revokeInvite, removeMember,
} from "./db/accounts.js";
import { useToast } from "./toast.jsx";
import { Modal } from "./shared.jsx";
import {
  User, CreditCard, Bell, Shield, Building2, ChevronRight,
  CheckCircle, ArrowRight, Star, X, Pencil, Save, AlertCircle,
  RotateCcw, Users, UserPlus, Link2, Trash2, Crown, Upload, Sparkles,
} from "lucide-react";
import { ImportWizard } from "./views/ImportWizard.jsx";

const DEMO_EMAIL = "demo@propbooks.com";

// -----------------------------------------------------------------------------
// Shared input style
// -----------------------------------------------------------------------------
const inp = {
  width: "100%", padding: "10px 13px", border: "1.5px solid var(--border)",
  borderRadius: 10, fontSize: 14, color: "var(--text-primary)", background: "var(--surface)",
  outline: "none", boxSizing: "border-box",
};
const label = (text) => (
  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6 }}>{text}</p>
);
// Page header: h1 26/700 + 15pt secondary subtitle, matching every other top-level view
const section = (title, sub) => (
  <div style={{ marginBottom: 24 }}>
    <h1 style={{ color: "var(--text-primary)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{title}</h1>
    {sub && <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>{sub}</p>}
  </div>
);
const card = { background: "var(--surface)", borderRadius: 16, padding: 24, border: "1px solid var(--border-subtle)", marginBottom: 20 };

// -----------------------------------------------------------------------------
// Settings Tabs
// -----------------------------------------------------------------------------
const TABS = [
  { id: "profile",       icon: User,       label: "Profile"       },
  { id: "team",          icon: Users,      label: "Team"          },
  { id: "import",        icon: Upload,     label: "Import Data"   },
  { id: "subscription",  icon: CreditCard, label: "Subscription"  },
  { id: "notifications", icon: Bell,       label: "Notifications" },
  { id: "security",      icon: Shield,     label: "Security"      },
];

// -----------------------------------------------------------------------------
// Profile Tab
// -----------------------------------------------------------------------------
function ProfileTab() {
  const { user, signOut } = useAuth();
  const isDemo = user?.email === DEMO_EMAIL;
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(user?.name || "");
  const [email, setEmail]     = useState(user?.email || "");
  const [phone, setPhone]     = useState(user?.user_metadata?.phone || "");
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");
  const [saving, setSaving]   = useState(false);

  async function handleSave() {
    setError("");
    if (!name.trim())  return setError("Name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (isDemo) {
      return setError("Profile changes are disabled on the demo account.");
    }
    setSaving(true);
    try {
      const payload = {
        data: { ...(user?.user_metadata || {}), name: name.trim(), phone: phone.trim() },
      };
      if (email.trim() !== user?.email) payload.email = email.trim();
      const { error: updErr } = await supabase.auth.updateUser(payload);
      if (updErr) throw updErr;
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {section("Profile", "Manage your personal information")}

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: "linear-gradient(135deg, #e95e00, #041830)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 24, flexShrink: 0,
          }}>
            {user?.initials || "?"}
          </div>
          <div>
            <p style={{ color: "#041830", fontWeight: 700, fontSize: 17 }}>{user?.name}</p>
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
              {email.trim() !== user?.email && (
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  You'll receive a confirmation link at the new address before the change takes effect.
                </p>
              )}
            </div>
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fef2f2", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
                <AlertCircle size={15} color="#b91c1c" />
                <span style={{ color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>{error}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                <Save size={13} /> {saving ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => { setEditing(false); setError(""); }} disabled={saving}
                style={{ padding: "9px 16px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", color: "#64748b", opacity: saving ? 0.7 : 1 }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#dcfce7", borderRadius: 8, padding: "10px 14px", marginTop: 14 }}>
            <CheckCircle size={15} color="#15803d" />
            <span style={{ color: "#15803d", fontSize: 13, fontWeight: 600 }}>
              {email !== user?.email ? "Profile updated — check your new email to confirm the change" : "Profile saved successfully"}
            </span>
          </div>
        )}
      </div>

      {isDemo && <DemoResetCard />}

      <div style={card}>
        <p style={{ color: "#041830", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Sign Out</p>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>Sign out of your PROPBOOKS account on this device.</p>
        <button onClick={signOut}
          style={{ padding: "9px 18px", borderRadius: 9, border: "1.5px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Demo Reset Card — only rendered for the demo account. Wipes every row in
// the demo user's Supabase tables, clears the storage folder, then reloads
// so the AppShell hydration fallback re-seeds the in-memory mock data.
// -----------------------------------------------------------------------------
function DemoResetCard() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function runReset() {
    setError("");
    setRunning(true);
    try {
      await wipeUserData();
      // Hard reload so AppShell's hydration re-runs from a clean Supabase
      // state and the demo+empty fallback re-populates mock data.
      window.location.reload();
    } catch (err) {
      setError(err.message || "Reset failed. Try again or refresh.");
      setRunning(false);
    }
  }

  return (
    <>
      <div style={card}>
        <p style={{ color: "#041830", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Demo Account</p>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
          Reset the demo back to its starting portfolio. Wipes every property, tenant, rehab, contractor, transaction, note, and uploaded document tied to this account, then restores the sample data.
        </p>
        <button onClick={() => setConfirmOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, border: "1.5px solid #fed7aa", background: "#fff7ed", color: "#9a3412", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <RotateCcw size={14} /> Reset Demo Data
        </button>
      </div>

      {confirmOpen && (
        <Modal title="Reset demo data?" onClose={() => !running && setConfirmOpen(false)} width={460}>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
            This permanently deletes every row in the demo account — properties, tenants, rehabs, contractors, transactions, notes, mileage, and documents — and then restores the original sample portfolio. The app will reload when done.
          </p>
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--danger-tint)", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
              <AlertCircle size={15} color="#b91c1c" />
              <span style={{ color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>{error}</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setConfirmOpen(false)} disabled={running}
              style={{ padding: "9px 16px", borderRadius: 9, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text-label)", fontWeight: 600, fontSize: 13, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.6 : 1 }}>
              Cancel
            </button>
            <button onClick={runReset} disabled={running}
              style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: "#c0392b", color: "#fff", fontWeight: 700, fontSize: 13, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.7 : 1 }}>
              {running ? "Resetting…" : "Reset Demo Data"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Team Tab — list members, owner can invite by email + remove members.
// -----------------------------------------------------------------------------
function TeamTab() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isDemo = user?.email === DEMO_EMAIL;
  const [account, setAccount] = useState(null);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  const isOwner = account?.myRole === "owner";
  const memberLimit = account?.member_limit || 5;
  const usedSeats = members.length + invites.length;
  const seatsLeft = Math.max(0, memberLimit - usedSeats);
  const atCap = seatsLeft === 0;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [acct, mem, inv] = await Promise.all([
          getCurrentAccount(), listAccountMembers(), listPendingInvites(),
        ]);
        if (cancelled) return;
        setAccount(acct);
        setMembers(mem);
        setInvites(inv);
      } catch (e) {
        if (!cancelled) showToast("Couldn't load team — " + (e.message || "unknown error"), "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, version]);

  async function handleInvite(e) {
    e.preventDefault();
    setError("");
    if (!inviteEmail.trim()) return setError("Enter an email address.");
    if (isDemo) return setError("Inviting is disabled on the demo account.");
    setInviting(true);
    try {
      const invite = await inviteByEmail(inviteEmail);
      const link = `${window.location.origin}/?invite=${invite.token}`;
      try { await navigator.clipboard.writeText(link); } catch {}
      showToast(`Invite link for ${invite.email} copied to clipboard — share it with them to join.`, "success");
      setInviteEmail("");
      setVersion(v => v + 1);
    } catch (err) {
      setError(err.message || "Could not send invite.");
    } finally {
      setInviting(false);
    }
  }

  async function copyInviteLink(token, email) {
    const link = `${window.location.origin}/?invite=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast(`Invite link for ${email} copied to clipboard.`, "success");
    } catch { showToast("Couldn't copy — copy manually: " + link, "info"); }
  }

  async function handleRevoke(invite) {
    try {
      await revokeInvite(invite.id);
      showToast(`Revoked invite for ${invite.email}.`, "success");
      setVersion(v => v + 1);
    } catch (err) { showToast(err.message || "Couldn't revoke invite.", "error"); }
  }

  async function handleRemove(member) {
    if (!confirm(`Remove ${member.name} from the account? They'll keep their login but lose access to your portfolio data.`)) return;
    try {
      await removeMember(member.id);
      showToast(`${member.name} removed from the account.`, "success");
      setVersion(v => v + 1);
    } catch (err) { showToast(err.message || "Couldn't remove member.", "error"); }
  }

  return (
    <div>
      {section("Team", "Invite up to 5 people to collaborate on your portfolio")}

      {/* Seat counter */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={18} color="#e95e00" />
          </div>
          <div>
            <p style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 15 }}>{usedSeats} of {memberLimit} seats used</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {atCap ? "Account is full — remove a member or revoke an invite to add more." : `${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} available`}
            </p>
          </div>
        </div>
      </div>

      {/* Invite form (owner only) */}
      {isOwner && !isDemo && (
        <div style={card}>
          <p style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Invite a teammate</p>
          <form onSubmit={handleInvite} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="teammate@example.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              disabled={inviting || atCap}
              style={{ ...inp, flex: 1, minWidth: 220 }}
            />
            <button
              type="submit"
              disabled={inviting || atCap}
              style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: atCap ? "var(--surface-alt)" : "#e95e00", color: atCap ? "var(--text-dim)" : "#fff", fontWeight: 700, fontSize: 13, cursor: atCap || inviting ? "not-allowed" : "pointer", opacity: inviting ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}
            >
              <UserPlus size={14} />
              {inviting ? "Sending…" : "Send invite"}
            </button>
          </form>
          {error && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>{error}</div>
          )}
          <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-dim)" }}>
            An invite link will be copied to your clipboard — share it directly until we wire up transactional email.
          </p>
        </div>
      )}

      {isDemo && (
        <div style={{ ...card, background: "var(--surface-alt)" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Inviting teammates is disabled on the demo account.</p>
        </div>
      )}

      {/* Members list */}
      <div style={card}>
        <p style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Members ({members.length})</p>
        {loading ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Loading…</p>
        ) : members.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>No members yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--surface-alt)", borderRadius: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: m.color, color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {m.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 14 }}>{m.name}</p>
                    {m.role === "owner" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                        <Crown size={11} /> Owner
                      </span>
                    )}
                    {m.id === user?.id && (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>(you)</span>
                    )}
                  </div>
                  <p style={{ color: "var(--text-dim)", fontSize: 12 }}>{m.email}</p>
                </div>
                {isOwner && m.role !== "owner" && !isDemo && (
                  <button
                    type="button"
                    onClick={() => handleRemove(m)}
                    title="Remove from account"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 6, borderRadius: 8, display: "flex", alignItems: "center" }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div style={card}>
          <p style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Pending invites ({invites.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invites.map(inv => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--surface-alt)", borderRadius: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface)", border: "1px dashed var(--border)", color: "var(--text-dim)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <UserPlus size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 14 }}>{inv.email}</p>
                  <p style={{ color: "var(--text-dim)", fontSize: 12 }}>Invited {new Date(inv.createdAt).toLocaleDateString()} · expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                </div>
                {isOwner && !isDemo && (
                  <>
                    <button type="button" onClick={() => copyInviteLink(inv.token, inv.email)} title="Copy invite link"
                      style={{ background: "none", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-secondary)", padding: "6px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <Link2 size={13} /> Copy link
                    </button>
                    <button type="button" onClick={() => handleRevoke(inv)} title="Revoke invite"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 6, borderRadius: 8, display: "flex", alignItems: "center" }}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subscription Tab
// -----------------------------------------------------------------------------
const PROPBOOKS_FEATURES = [
  "Unlimited rental properties + rehabs",
  "Tenant management & lease tracking",
  "Mileage tracker (IRS rate)",
  "Documents & receipts",
  "Tax tools (depreciation, Schedule E export)",
  "All future AI features included",
];

// Pretty status labels for the subscription_status values Stripe sends back.
function statusBadge(status) {
  switch (status) {
    case "active":              return { label: "Active",                color: "#15803d", bg: "#dcfce7" };
    case "trialing":            return { label: "Trial",                 color: "#1d4ed8", bg: "#dbeafe" };
    case "past_due":            return { label: "Past due",              color: "#b91c1c", bg: "#fef2f2" };
    case "canceled":            return { label: "Canceled",              color: "#92400e", bg: "#fef3c7" };
    case "incomplete":
    case "incomplete_expired":  return { label: "Payment incomplete",    color: "#b91c1c", bg: "#fef2f2" };
    case "unpaid":              return { label: "Unpaid",                color: "#b91c1c", bg: "#fef2f2" };
    default:                    return { label: "No active subscription", color: "#64748b", bg: "#f1f5f9" };
  }
}

// -----------------------------------------------------------------------------
// Import Tab — entry point for the Import Wizard. The wizard itself lives in
// views/ImportWizard.jsx and is mounted at the AppShell level so the same
// instance is shared between this tab and the empty-state CTAs on AssetList /
// Ledger. This tab just hosts the launcher and explanatory copy.
// -----------------------------------------------------------------------------
function ImportTab({ onLaunchImport }) {
  const { user } = useAuth();
  const isDemo = user?.email === DEMO_EMAIL;

  return (
    <div>
      {section("Import Data", "Bring properties or transactions over from QuickBooks, Stessa, or any spreadsheet — we'll figure out the column mapping for you")}

      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(233,94,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={22} color="#e95e00" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Import Wizard</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
              Upload a CSV exported from any system. We read the header row and a few sample values, propose how each column maps into PROPBOOKS, and you review before anything is saved. Works for Properties and Transactions today; Tenants and Rehabs coming next.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          {[
            { title: "Export from your source", body: "Save as CSV or Excel (.xlsx). Works with QuickBooks reports, Stessa transaction exports, or any spreadsheet you maintain by hand." },
            { title: "Drop in & confirm", body: "We propose the mapping with a confidence score. Adjust any column with a dropdown, then confirm." },
            { title: "We import the rest", body: "Every row is normalized client-side (dates, currency, categories) and inserted. Failed rows are reported, never silently dropped." },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--surface-alt)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--border-subtle)" }}>
              <p style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{i + 1}. {s.title}</p>
              <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.4 }}>{s.body}</p>
            </div>
          ))}
        </div>

        {isDemo ? (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border-subtle)", fontSize: 13, color: "var(--text-secondary)" }}>
            Import is disabled on the demo account so the sample portfolio stays consistent across visitors.
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onLaunchImport?.()}
            style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            <Upload size={14} /> Start an import
          </button>
        )}
      </div>
    </div>
  );
}

function SubscriptionTab() {
  const { user } = useAuth();
  const isDemo = user?.email === DEMO_EMAIL;
  const status = user?.subscriptionStatus;
  const isPaying = status === "active" || status === "trialing";
  const badge = statusBadge(status);
  const renewsAt = user?.currentPeriodEnd
    ? new Date(user.currentPeriodEnd).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div>
      {section("Subscription", "Manage your PROPBOOKS plan and billing")}

      {/* Status banner */}
      <div style={{ ...card, border: `2px solid ${isPaying ? "#10b981" : "#e2e8f0"}`, background: isPaying ? "#f0fdf4" : "var(--surface-alt)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
              Current status
            </p>
            <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 12, background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 700 }}>
              {badge.label}
            </span>
          </div>
          {renewsAt && isPaying && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {status === "trialing" ? "Trial ends" : "Renews"} <strong style={{ color: "var(--text-primary)" }}>{renewsAt}</strong>
            </p>
          )}
        </div>
      </div>

      {/* The PropBooks plan */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
          <p style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: 22 }}>PROPBOOKS</p>
          <p style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: 22 }}>
            $25<span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-dim)" }}> / month</span>
          </p>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
          Everything you need to manage your rental & rehab portfolio. Cancel anytime.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {PROPBOOKS_FEATURES.map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={14} color="#10b981" />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{f}</span>
            </div>
          ))}
        </div>

        {isDemo ? (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border-subtle)", fontSize: 13, color: "var(--text-secondary)" }}>
            Subscription actions are disabled on the demo account.
          </div>
        ) : isPaying ? (
          <button
            type="button"
            disabled
            title="Stripe Customer Portal — wiring up in the next release"
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontWeight: 700, fontSize: 13, cursor: "not-allowed", opacity: 0.7 }}
          >
            Manage billing (coming soon)
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="Stripe Checkout — wiring up in the next release"
            style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "not-allowed", opacity: 0.7 }}
          >
            Subscribe — $25/mo (coming soon)
          </button>
        )}
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
      background: on ? "#e95e00" : "#e2e8f0", position: "relative", transition: "background 0.2s", flexShrink: 0,
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
    dealUpdates:  false,
    weeklyReport: true,
    marketing:    false,
  });
  const toggle = k => setPrefs(p => ({ ...p, [k]: !p[k] }));

  const items = [
    { key: "rentDue",      label: "Rent Due Reminders",     desc: "Alerts when rent payments are upcoming or overdue" },
    { key: "leaseExpiry",  label: "Lease Expiry Alerts",    desc: "Notify 60, 30, and 7 days before lease expiration" },
    { key: "maintenance",  label: "Maintenance Requests",   desc: "New maintenance requests from tenants" },
    { key: "dealUpdates",  label: "Rehab Milestone Updates", desc: "Contractor check-ins and milestone completions" },
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
              <p style={{ color: "#041830", fontWeight: 600, fontSize: 14 }}>{item.label}</p>
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
  const { user } = useAuth();
  const isDemo = user?.email === DEMO_EMAIL;
  const [current, setCurrent]   = useState("");
  const [newPass, setNewPass]   = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");
  const [saving, setSaving]     = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    if (!current || !newPass || !confirm) return setError("Please fill in all fields.");
    if (newPass !== confirm) return setError("New passwords do not match.");
    if (newPass.length < 8) return setError("Password must be at least 8 characters.");
    if (newPass === current) return setError("New password must be different from current password.");
    if (isDemo) return setError("Password changes are disabled on the demo account.");
    if (!user?.email) return setError("No active session — please sign in again.");

    setSaving(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email, password: current,
      });
      if (signInErr) throw new Error("Current password is incorrect.");

      const { error: updErr } = await supabase.auth.updateUser({ password: newPass });
      if (updErr) throw updErr;

      setSaved(true);
      setCurrent(""); setNewPass(""); setConfirm("");
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {section("Security", "Manage your password and account security")}
      <div style={card}>
        <p style={{ color: "#041830", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Change Password</p>
        <form onSubmit={handleSave}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
            <div>{label("Current Password")}<input style={inp} type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" /></div>
            <div>{label("New Password")}<input style={inp} type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min. 8 characters" /></div>
            <div>{label("Confirm New Password")}<input style={inp} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter new password" /></div>
          </div>
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fef2f2", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
              <AlertCircle size={15} color="#b91c1c" />
              <span style={{ color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>{error}</span>
            </div>
          )}
          {saved && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#dcfce7", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
              <CheckCircle size={15} color="#15803d" />
              <span style={{ color: "#15803d", fontSize: 13, fontWeight: 600 }}>Password updated successfully</span>
            </div>
          )}
          <button type="submit" disabled={saving}
            style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>

      <div style={card}>
        <p style={{ color: "#041830", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Two-Factor Authentication</p>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 14 }}>Add an extra layer of security to your account. Coming soon.</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e95e00" }} />
          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Not enabled</span>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Settings Component
// -----------------------------------------------------------------------------
export function Settings({ onClose, onLaunchImport }) {
  const [activeTab, setActiveTab] = useState("profile");

  const tabContent = {
    profile:       <ProfileTab />,
    team:          <TeamTab />,
    import:        <ImportTab onLaunchImport={onLaunchImport} />,
    subscription:  <SubscriptionTab />,
    notifications: <NotificationsTab />,
    security:      <SecurityTab />,
  };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Sidebar */}
      <div style={{ width: 220, borderRight: "1px solid #f1f5f9", paddingRight: 24, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ color: "#041830", fontSize: 18, fontWeight: 700 }}>Settings</h2>
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
  { id: "welcome",  title: "Welcome to PROPBOOKS 👋",       sub: "Let's get your portfolio set up in 2 minutes." },
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
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? "#e95e00" : "#e2e8f0", transition: "background 0.3s" }} />
          ))}
        </div>

        <h2 style={{ color: "#041830", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{current.title}</h2>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>{current.sub}</p>

        {/* Step content */}
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
            {[
              { icon: Building2, color: "#3b82f6", title: "Track your rentals",    sub: "Properties, tenants, cash flow"  },
              { icon: Star,      color: "#e95e00", title: "Manage your rehabs",    sub: "Pipeline, rehab budget, P&L"    },
              { icon: CheckCircle, color: "#10b981", title: "Analyze new rehabs",  sub: "Cap rate, CoC, GRM calculator"  },
            ].map(item => (
              <div key={item.title} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: item.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <item.icon size={18} color={item.color} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, color: "#041830", fontSize: 14 }}>{item.title}</p>
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
              <input style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#041830", background: "#fff", outline: "none", boxSizing: "border-box" }}
                placeholder="e.g. Oak Street Duplex"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Address</p>
              <input style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#041830", background: "#fff", outline: "none", boxSizing: "border-box" }}
                placeholder="123 Main St, City, State"
                value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Purchase Price</p>
                <input style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#041830", background: "#fff", outline: "none", boxSizing: "border-box" }}
                  placeholder="$350,000" type="number"
                  value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Monthly Rent</p>
                <input style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#041830", background: "#fff", outline: "none", boxSizing: "border-box" }}
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
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 24px", borderRadius: 10, border: "none", background: "#e95e00", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {step < 2 ? "Continue" : "Go to Dashboard"}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
