// =============================================================================
// db/maintenanceRequests.js — Supabase wrapper for `maintenance_requests`.
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    propertyId: row.property_id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    vendor: row.vendor,
    cost: row.cost == null ? null : Number(row.cost),
    scheduledDate: row.scheduled_date,
    resolvedDate: row.resolved_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(r) {
  const out = {};
  if (r.propertyId !== undefined) out.property_id = r.propertyId;
  if (r.tenantId !== undefined) out.tenant_id = r.tenantId || null;
  if (r.title !== undefined) out.title = r.title;
  if (r.description !== undefined) out.description = r.description;
  if (r.priority !== undefined) out.priority = r.priority;
  if (r.status !== undefined) out.status = r.status;
  if (r.vendor !== undefined) out.vendor = r.vendor;
  if (r.cost !== undefined) out.cost = r.cost;
  if (r.scheduledDate !== undefined) out.scheduled_date = r.scheduledDate;
  if (r.resolvedDate !== undefined) out.resolved_date = r.resolvedDate;
  return out;
}

export async function listMaintenanceRequests() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("maintenance_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createMaintenanceRequest(r) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert([{ ...toRow(r), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateMaintenanceRequest(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("maintenance_requests")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteMaintenanceRequest(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("maintenance_requests").delete().eq("id", id);
  if (error) throw error;
}
