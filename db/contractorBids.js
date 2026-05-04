// =============================================================================
// db/contractorBids.js — Supabase wrapper for the `contractor_bids` table.
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    contractorId: row.contractor_id,
    dealId: row.deal_id,
    rehabItem: row.rehab_item,
    amount: row.amount == null ? null : Number(row.amount),
    status: row.status,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(b) {
  const out = {};
  if (b.contractorId !== undefined) out.contractor_id = b.contractorId;
  if (b.dealId !== undefined) out.deal_id = b.dealId;
  if (b.rehabItem !== undefined) out.rehab_item = b.rehabItem;
  if (b.amount !== undefined) out.amount = b.amount;
  if (b.status !== undefined) out.status = b.status;
  if (b.date !== undefined) out.date = b.date;
  return out;
}

export async function listContractorBids() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contractor_bids")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createContractorBid(b) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("contractor_bids")
    .insert([{ ...toRow(b), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateContractorBid(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("contractor_bids")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteContractorBid(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("contractor_bids").delete().eq("id", id);
  if (error) throw error;
}
