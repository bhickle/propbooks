// =============================================================================
// db/accounts.js — Supabase wrappers for the multi-user account model.
//
// Every PropBooks user belongs to exactly one account (1 owner + up to 4
// members in v1). RLS on every data table scopes by `account_id = my
// account_id`, so all account members see each other's properties, deals,
// notes, etc. The set_account_id_from_user trigger auto-populates account_id
// on INSERT — the client never has to manage it explicitly.
// =============================================================================
import { supabase } from "../supabase.js";

function memberFromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name || (row.email ? row.email.split("@")[0] : "Member"),
    email: row.email,
    initials: row.initials || (row.name ? row.name.split(/\s+/).slice(0,2).map(w => w[0]).join("").toUpperCase() : "?"),
    role: row.role || "member",
    accountId: row.account_id,
    // Stable color derived from id so two members never share one and the
    // colour persists across reloads.
    color: pickColor(row.id),
  };
}

const COLORS = ["#3b82f6","#8b5cf6","#059669","#e95e00","#dc2626","#0891b2","#ca8a04","#be185d","#4f46e5","#0d9488"];
function pickColor(id) {
  if (!id) return COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function inviteFromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    accountId: row.account_id,
    email: row.email,
    invitedBy: row.invited_by,
    token: row.token,
    role: row.role,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  };
}

// ── getCurrentAccount ───────────────────────────────────────────────────────
// Returns the row from `accounts` that the signed-in user belongs to.
// Null if they don't have an account yet (shouldn't happen post-trigger).
export async function getCurrentAccount() {
  if (!supabase) return null;
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return null;
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("account_id, role")
    .eq("id", uid)
    .maybeSingle();
  if (pErr || !profile?.account_id) return null;
  const { data: account, error: aErr } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", profile.account_id)
    .maybeSingle();
  if (aErr) throw aErr;
  return account ? { ...account, myRole: profile.role } : null;
}

// ── listAccountMembers ──────────────────────────────────────────────────────
// Returns profile rows for every member of the caller's account. Used to
// populate the @mention dropdown and the Settings → Team tab. RLS allows
// this because profiles_self_select permits reading account-mates.
export async function listAccountMembers() {
  if (!supabase) return [];
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return [];
  const { data: me } = await supabase.from("profiles").select("account_id").eq("id", uid).maybeSingle();
  if (!me?.account_id) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, initials, role, account_id")
    .eq("account_id", me.account_id)
    .order("role", { ascending: true }) // owner first
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []).map(memberFromRow);
}

// ── listPendingInvites ──────────────────────────────────────────────────────
export async function listPendingInvites() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("account_invites")
    .select("*")
    .is("accepted_at", null)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(inviteFromRow);
}

// ── inviteByEmail ───────────────────────────────────────────────────────────
// Owner-only (RLS enforces). Returns the new invite row, including its token.
// The caller is responsible for emailing the recipient. For v1 we surface the
// invite link in-app so the owner can copy/share it manually; switching to
// transactional email is a small follow-up.
export async function inviteByEmail(email) {
  const trimmed = (email || "").trim().toLowerCase();
  if (!trimmed) throw new Error("Email is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw new Error("Enter a valid email address.");

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error("Not signed in.");
  const { data: me } = await supabase.from("profiles").select("account_id, role").eq("id", uid).maybeSingle();
  if (!me?.account_id) throw new Error("No account found.");
  if (me.role !== "owner") throw new Error("Only the account owner can invite members.");

  // Don't re-invite an existing member of this account.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("account_id", me.account_id)
    .ilike("email", trimmed)
    .maybeSingle();
  if (existing) throw new Error("That person is already a member of this account.");

  // Surface a clear error before hitting the DB enforce trigger.
  const { count: memberCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("account_id", me.account_id);
  const { data: account } = await supabase.from("accounts").select("member_limit").eq("id", me.account_id).maybeSingle();
  const limit = account?.member_limit || 5;
  // Count pending invites too — sending 5 invites when you have 1 seat left
  // would over-fill the account once they all accept.
  const { count: pendingCount } = await supabase
    .from("account_invites")
    .select("id", { count: "exact", head: true })
    .eq("account_id", me.account_id)
    .is("accepted_at", null)
    .gte("expires_at", new Date().toISOString());
  if ((memberCount || 0) + (pendingCount || 0) >= limit) {
    throw new Error(`Account is at the ${limit}-member limit. Remove a member or revoke a pending invite first.`);
  }

  const { data, error } = await supabase
    .from("account_invites")
    .insert({ account_id: me.account_id, email: trimmed, invited_by: uid, role: "member" })
    .select()
    .single();
  if (error) throw error;
  return inviteFromRow(data);
}

// ── revokeInvite ────────────────────────────────────────────────────────────
export async function revokeInvite(inviteId) {
  if (!supabase) return;
  const { error } = await supabase.from("account_invites").delete().eq("id", inviteId);
  if (error) throw error;
}

// ── removeMember ────────────────────────────────────────────────────────────
// Owner-only. Removes another member from the account by giving them a fresh
// personal account of their own. Their auth login keeps working; they just
// lose access to the original account's data (which remains in place).
export async function removeMember(memberUserId) {
  if (!supabase) return;
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error("Not signed in.");
  if (uid === memberUserId) throw new Error("Owners can't remove themselves. Transfer ownership first.");

  const { data: me } = await supabase.from("profiles").select("account_id, role").eq("id", uid).maybeSingle();
  if (me?.role !== "owner") throw new Error("Only the account owner can remove members.");
  const { data: target } = await supabase.from("profiles").select("id, name, email, account_id").eq("id", memberUserId).maybeSingle();
  if (!target || target.account_id !== me.account_id) throw new Error("That member isn't part of your account.");

  // Create a personal account for the removed member and move them to it.
  const displayName = target.name || (target.email ? target.email.split("@")[0] : "User");
  const { data: newAccount, error: aErr } = await supabase
    .from("accounts")
    .insert({ owner_id: target.id, name: `${displayName}'s Portfolio` })
    .select()
    .single();
  if (aErr) throw aErr;

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ account_id: newAccount.id, role: "owner" })
    .eq("id", target.id);
  if (pErr) throw pErr;
}

// ── acceptInvite ────────────────────────────────────────────────────────────
// Used by the /accept-invite route handler for already-signed-in users.
// (New-signup-with-invite is handled server-side by the handle_new_auth_user
// trigger — it looks up a pending invite by email automatically.)
export async function acceptInvite(token) {
  if (!supabase) throw new Error("Supabase not configured.");
  if (!token) throw new Error("Invite token is missing.");
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error("Sign in to accept the invitation.");

  const { data: invite, error: iErr } = await supabase
    .from("account_invites")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();
  if (iErr) throw iErr;
  if (!invite) throw new Error("This invitation link is invalid, expired, or already used.");

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ account_id: invite.account_id, role: invite.role || "member" })
    .eq("id", uid);
  if (pErr) throw pErr;

  const { error: aErr } = await supabase
    .from("account_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);
  if (aErr) throw aErr;
  return invite.account_id;
}

// ── updateAccountName ───────────────────────────────────────────────────────
export async function updateAccountName(name) {
  if (!supabase) return;
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error("Not signed in.");
  const { data: me } = await supabase.from("profiles").select("account_id, role").eq("id", uid).maybeSingle();
  if (me?.role !== "owner") throw new Error("Only the account owner can rename the account.");
  const { error } = await supabase.from("accounts").update({ name }).eq("id", me.account_id);
  if (error) throw error;
}
