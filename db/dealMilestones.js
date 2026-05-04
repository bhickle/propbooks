// =============================================================================
// db/dealMilestones.js — Supabase wrapper for the `deal_milestones` table.
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    dealId: row.deal_id,
    label: row.label,
    done: row.done,
    date: row.date,
    targetDate: row.target_date,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(m) {
  const out = {};
  if (m.dealId !== undefined) out.deal_id = m.dealId;
  if (m.label !== undefined) out.label = m.label;
  if (m.done !== undefined) out.done = m.done;
  if (m.date !== undefined) out.date = m.date;
  if (m.targetDate !== undefined) out.target_date = m.targetDate;
  if (m.sortOrder !== undefined) out.sort_order = m.sortOrder;
  return out;
}

export async function listMilestones() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("deal_milestones")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createMilestone(m) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("deal_milestones")
    .insert([{ ...toRow(m), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateMilestone(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("deal_milestones")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteMilestone(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("deal_milestones").delete().eq("id", id);
  if (error) throw error;
}
