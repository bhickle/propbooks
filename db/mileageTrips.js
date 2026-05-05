// =============================================================================
// db/mileageTrips.js — Supabase wrapper for `mileage_trips`.
//
// Schema column ↔ camelCase prop mapping:
//   from_location ↔ from
//   to_location   ↔ to
//   business_pct  ↔ businessPct
//   linked_to     ↔ linkedTo
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    from: row.from_location,
    to: row.to_location,
    miles: row.miles == null ? null : Number(row.miles),
    purpose: row.purpose,
    businessPct: row.business_pct == null ? null : Number(row.business_pct),
    linkedTo: row.linked_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(t) {
  const out = {};
  if (t.date !== undefined) out.date = t.date;
  if (t.description !== undefined) out.description = t.description;
  if (t.from !== undefined) out.from_location = t.from;
  if (t.to !== undefined) out.to_location = t.to;
  if (t.miles !== undefined) out.miles = t.miles;
  if (t.purpose !== undefined) out.purpose = t.purpose;
  if (t.businessPct !== undefined) out.business_pct = t.businessPct;
  if (t.linkedTo !== undefined) out.linked_to = t.linkedTo || null;
  return out;
}

export async function listMileageTrips() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("mileage_trips")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createMileageTrip(t) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("mileage_trips")
    .insert([{ ...toRow(t), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateMileageTrip(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("mileage_trips")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteMileageTrip(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("mileage_trips").delete().eq("id", id);
  if (error) throw error;
}
