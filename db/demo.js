// =============================================================================
// db/demo.js — demo-account sandbox guard for the db/*.js write layer.
//
// The demo user (demo@propbooks.com) is seeded entirely in-memory: the mock
// PROPERTIES / DEALS / CONTRACTORS arrays use numeric ids that don't exist as
// Supabase rows. Persisting a mutation would send those numeric ids to uuid
// FK columns and Postgres rejects them ("invalid input syntax for type uuid").
//
// So for the demo account every write short-circuits: the in-memory mirror
// still updates (components do that themselves with the returned row), the
// change just never hits Supabase and resets to the clean seed on next login.
// This keeps the *shared* demo a safe sandbox — one visitor's edits can't
// persist or corrupt another visitor's view.
// =============================================================================
import { supabase } from "../supabase.js";

// Keep in sync with DEMO_EMAIL in api.js. Duplicated here (rather than imported)
// so the db layer doesn't pull in the large api.js mirror module.
export const DEMO_EMAIL = "demo@propbooks.com";

// Reads the cached session — no network round-trip, unlike auth.getUser() which
// re-validates the JWT against the server. supabase-js keeps the active session
// in memory / localStorage and only refreshes when it's expired, so this is
// cheap enough to call on every write.
export async function isDemoSession() {
  if (!supabase) return false;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.email === DEMO_EMAIL;
}

// A browser-crypto uuid so synthetic demo rows carry a real-looking id that
// later in-memory lookups (delete-by-id, mirror matching) still work against.
export function demoId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Build a synthetic created row that echoes the caller's camelCase input plus a
// fresh id + timestamps — matching the shape every wrapper's fromRow() returns.
// `extra` merges in derived fields a wrapper adds on read (e.g. dealIds: []).
export function demoCreated(input, extra = {}) {
  const now = new Date().toISOString();
  return { id: demoId(), ...input, ...extra, createdAt: now, updatedAt: now };
}

// Build a synthetic updated row: the caller's id + the fields they changed.
// Partial by design — components merge it onto the existing mirror entry, so
// unspecified fields keep their previous values.
export function demoUpdated(id, updates) {
  return { id, ...updates, updatedAt: new Date().toISOString() };
}
