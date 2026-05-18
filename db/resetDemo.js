// =============================================================================
// db/resetDemo.js — wipe the current user's rows + storage objects.
//
// Demo-account reset path. Use case: the demo Supabase user accumulates test
// rows during a session; this clears them all so the in-memory mock seed
// shows clean on next hydration (see AppShell's "demo + empty fallback").
// RLS already restricts deletes to the caller's rows, but we add an explicit
// user_id filter for clarity (and so a misconfigured RLS policy can't silently
// wipe another user's data).
// =============================================================================
import { supabase } from "../supabase.js";

const BUCKET = "documents";

// Child tables first so we don't trip a FK constraint even if cascade isn't
// configured on every relation.
const DELETE_ORDER = [
  "documents",
  "transactions",
  "deal_expenses",
  "contractor_bids",
  "contractor_deals",
  "deal_rehab_items",
  "deal_milestones",
  "maintenance_requests",
  "tenants",
  "notes",
  "mileage_trips",
  "contractors",
  "deals",
  "properties",
];

async function clearStorageFolder(userId) {
  if (!supabase) return;
  // Storage list isn't recursive, so walk the tree breadth-first.
  // Folders are entries without a `metadata` field; files have metadata.
  const queue = [userId];
  const filePaths = [];
  while (queue.length) {
    const dir = queue.shift();
    const { data, error } = await supabase.storage.from(BUCKET).list(dir, { limit: 1000 });
    if (error) throw error;
    for (const item of data || []) {
      const path = `${dir}/${item.name}`;
      if (item.metadata) filePaths.push(path);
      else queue.push(path);
    }
  }
  for (let i = 0; i < filePaths.length; i += 100) {
    const batch = filePaths.slice(i, i + 100);
    await supabase.storage.from(BUCKET).remove(batch).catch(() => {});
  }
}

export async function wipeUserData() {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  for (const table of DELETE_ORDER) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
  }

  await clearStorageFolder(user.id);
}
