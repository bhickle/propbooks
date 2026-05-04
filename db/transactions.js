// =============================================================================
// db/transactions.js — Supabase wrapper for the `transactions` table.
//
// Mirrors the contract of db/properties.js: snake_case <-> camelCase mapping
// in one place, async CRUD that returns rows shaped like the legacy mock
// TRANSACTIONS entries. RLS scopes queries to the current user's rows.
//
// Note: transaction_receipts are a separate table (one-to-many to
// transactions) — those CRUD calls live in db/transactionReceipts.js when
// they get migrated.
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    propertyId: row.property_id,
    tenantId: row.tenant_id,
    date: row.date,
    type: row.type,
    category: row.category,
    description: row.description,
    amount: row.amount == null ? null : Number(row.amount),
    payee: row.payee,
    piPrincipal: row.pi_principal == null ? null : Number(row.pi_principal),
    piInterest: row.pi_interest == null ? null : Number(row.pi_interest),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(t) {
  const out = {};
  if (t.propertyId !== undefined) out.property_id = t.propertyId;
  if (t.tenantId !== undefined) out.tenant_id = t.tenantId;
  if (t.date !== undefined) out.date = t.date;
  if (t.type !== undefined) out.type = t.type;
  if (t.category !== undefined) out.category = t.category;
  if (t.description !== undefined) out.description = t.description;
  if (t.amount !== undefined) out.amount = t.amount;
  if (t.payee !== undefined) out.payee = t.payee;
  if (t.piPrincipal !== undefined) out.pi_principal = t.piPrincipal;
  if (t.piInterest !== undefined) out.pi_interest = t.piInterest;
  return out;
}

export async function listTransactions() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createTransaction(tx) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("transactions")
    .insert([{ ...toRow(tx), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateTransaction(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("transactions")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteTransaction(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}
