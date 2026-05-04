// =============================================================================
// db/contractors.js — Supabase wrapper for `contractors` + `contractor_deals`.
//
// The mock kept `dealIds: []` on each contractor record. Here we expose the
// same shape on read by joining contractor_deals into a `dealIds` array, so
// downstream filtering by deal still works without changes.
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row, dealIds = []) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    trade: row.trade,
    phone: row.phone,
    email: row.email,
    license: row.license,
    insuranceExpiry: row.insurance_expiry,
    rating: row.rating,
    notes: row.notes,
    dealIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(c) {
  const out = {};
  if (c.name !== undefined) out.name = c.name;
  if (c.trade !== undefined) out.trade = c.trade;
  if (c.phone !== undefined) out.phone = c.phone;
  if (c.email !== undefined) out.email = c.email;
  if (c.license !== undefined) out.license = c.license;
  if (c.insuranceExpiry !== undefined) out.insurance_expiry = c.insuranceExpiry;
  if (c.rating !== undefined) out.rating = c.rating;
  if (c.notes !== undefined) out.notes = c.notes;
  return out;
}

export async function listContractors() {
  if (!supabase) return [];
  const [{ data: cons, error: err1 }, { data: links, error: err2 }] = await Promise.all([
    supabase.from("contractors").select("*").order("created_at", { ascending: true }),
    supabase.from("contractor_deals").select("contractor_id, deal_id"),
  ]);
  if (err1) throw err1;
  if (err2) throw err2;
  const dealsByContractor = new Map();
  for (const link of links || []) {
    if (!dealsByContractor.has(link.contractor_id)) dealsByContractor.set(link.contractor_id, []);
    dealsByContractor.get(link.contractor_id).push(link.deal_id);
  }
  return (cons || []).map(c => fromRow(c, dealsByContractor.get(c.id) || []));
}

export async function createContractor(c) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("contractors")
    .insert([{ ...toRow(c), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data, []);
}

export async function updateContractor(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("contractors")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteContractor(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("contractors").delete().eq("id", id);
  if (error) throw error;
}

// ── contractor_deals junction helpers ──────────────────────────────────────

export async function linkContractorToDeal(contractorId, dealId) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("contractor_deals")
    .upsert({ contractor_id: contractorId, deal_id: dealId }, { onConflict: "contractor_id,deal_id" });
  if (error) throw error;
}

export async function unlinkContractorFromDeal(contractorId, dealId) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("contractor_deals")
    .delete()
    .eq("contractor_id", contractorId)
    .eq("deal_id", dealId);
  if (error) throw error;
}
