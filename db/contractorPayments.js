// =============================================================================
// db/contractorPayments.js — Supabase wrapper for `contractor_payments`.
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    contractorId: row.contractor_id,
    dealId: row.deal_id,
    amount: row.amount == null ? null : Number(row.amount),
    date: row.date,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(p) {
  const out = {};
  if (p.contractorId !== undefined) out.contractor_id = p.contractorId;
  if (p.dealId !== undefined) out.deal_id = p.dealId;
  if (p.amount !== undefined) out.amount = p.amount;
  if (p.date !== undefined) out.date = p.date;
  if (p.note !== undefined) out.note = p.note;
  return out;
}

export async function listContractorPayments() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contractor_payments")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createContractorPayment(p) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("contractor_payments")
    .insert([{ ...toRow(p), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateContractorPayment(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("contractor_payments")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteContractorPayment(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("contractor_payments").delete().eq("id", id);
  if (error) throw error;
}
