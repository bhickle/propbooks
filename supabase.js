// =============================================================================
// Supabase Client — PropBooks
// All database access goes through this singleton client.
// =============================================================================
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_CONFIGURED = !!(supabaseUrl && supabaseKey);
export const SUPABASE_CONFIG_ERROR = SUPABASE_CONFIGURED
  ? null
  : "Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file and restart the dev server.";

if (!SUPABASE_CONFIGURED) {
  console.error(`[PropBooks] ${SUPABASE_CONFIG_ERROR}`);
}

export const supabase = SUPABASE_CONFIGURED
  ? createClient(supabaseUrl, supabaseKey)
  : null;

function requireClient() {
  if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR);
  return supabase;
}

// ─── Auth helpers ────────────────────────────────────────────────────────────

export async function signUp(email, password, name) {
  const { data, error } = await requireClient().auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Listen for auth state changes (login, logout, token refresh)
export function onAuthChange(callback) {
  if (!supabase) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}
