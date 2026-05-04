// =============================================================================
// db/dealRehabItems.js — Supabase wrapper for the `deal_rehab_items` table.
// Mock data stored these as a nested `deal.rehabItems[]` array; the loader in
// AppShell merges DB rows back into that nested shape so views are unchanged.
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    dealId: row.deal_id,
    category: row.category,
    slug: row.slug,
    budgeted: row.budgeted == null ? 0 : Number(row.budgeted),
    spent: row.spent == null ? 0 : Number(row.spent),
    status: row.status,
    sortOrder: row.sort_order,
    contractors: [], // populated separately from contractor_bids
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(r) {
  const out = {};
  if (r.dealId !== undefined) out.deal_id = r.dealId;
  if (r.category !== undefined) out.category = r.category;
  if (r.slug !== undefined) out.slug = r.slug;
  if (r.budgeted !== undefined) out.budgeted = r.budgeted;
  if (r.spent !== undefined) out.spent = r.spent;
  if (r.status !== undefined) out.status = r.status;
  if (r.sortOrder !== undefined) out.sort_order = r.sortOrder;
  return out;
}

export async function listRehabItems() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("deal_rehab_items")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createRehabItem(r) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("deal_rehab_items")
    .insert([{ ...toRow(r), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateRehabItem(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("deal_rehab_items")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteRehabItem(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("deal_rehab_items").delete().eq("id", id);
  if (error) throw error;
}
