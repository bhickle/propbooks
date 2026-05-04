// =============================================================================
// db/dealExpenses.js — Supabase wrapper for the `deal_expenses` table.
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    dealId: row.deal_id,
    contractorId: row.contractor_id,
    date: row.date,
    vendor: row.vendor,
    category: row.category,
    description: row.description,
    amount: row.amount == null ? null : Number(row.amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(e) {
  const out = {};
  if (e.dealId !== undefined) out.deal_id = e.dealId;
  if (e.contractorId !== undefined) out.contractor_id = e.contractorId;
  if (e.date !== undefined) out.date = e.date;
  if (e.vendor !== undefined) out.vendor = e.vendor;
  if (e.category !== undefined) out.category = e.category;
  if (e.description !== undefined) out.description = e.description;
  if (e.amount !== undefined) out.amount = e.amount;
  return out;
}

export async function listDealExpenses() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("deal_expenses")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createDealExpense(e) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("deal_expenses")
    .insert([{ ...toRow(e), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateDealExpense(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("deal_expenses")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteDealExpense(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("deal_expenses").delete().eq("id", id);
  if (error) throw error;
}
