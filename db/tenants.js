// =============================================================================
// db/tenants.js — Supabase wrapper for the `tenants` table.
//
// Same shape contract as db/properties.js + db/transactions.js: snake/camel
// mapping in one place, async CRUD that returns rows shaped like the legacy
// mock TENANTS entries. RLS scopes every query to the current user's rows.
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    propertyId: row.property_id,
    unit: row.unit,
    name: row.name,
    email: row.email,
    phone: row.phone,
    rent: row.rent == null ? null : Number(row.rent),
    leaseStart: row.lease_start,
    leaseEnd: row.lease_end,
    status: row.status,
    lastPayment: row.last_payment,
    securityDeposit: row.security_deposit == null ? null : Number(row.security_deposit),
    moveOutDate: row.move_out_date,
    moveOutReason: row.move_out_reason,
    lateFeePct: row.late_fee_pct == null ? null : Number(row.late_fee_pct),
    renewalTerms: row.renewal_terms,
    notes: row.notes,
    leaseDoc: row.lease_doc,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(t) {
  const out = {};
  if (t.propertyId !== undefined) out.property_id = t.propertyId;
  if (t.unit !== undefined) out.unit = t.unit;
  if (t.name !== undefined) out.name = t.name;
  if (t.email !== undefined) out.email = t.email;
  if (t.phone !== undefined) out.phone = t.phone;
  if (t.rent !== undefined) out.rent = t.rent;
  if (t.leaseStart !== undefined) out.lease_start = t.leaseStart;
  if (t.leaseEnd !== undefined) out.lease_end = t.leaseEnd;
  if (t.status !== undefined) out.status = t.status;
  if (t.lastPayment !== undefined) out.last_payment = t.lastPayment;
  if (t.securityDeposit !== undefined) out.security_deposit = t.securityDeposit;
  if (t.moveOutDate !== undefined) out.move_out_date = t.moveOutDate;
  if (t.moveOutReason !== undefined) out.move_out_reason = t.moveOutReason;
  if (t.lateFeePct !== undefined) out.late_fee_pct = t.lateFeePct;
  if (t.renewalTerms !== undefined) out.renewal_terms = t.renewalTerms;
  if (t.notes !== undefined) out.notes = t.notes;
  if (t.leaseDoc !== undefined) out.lease_doc = t.leaseDoc;
  return out;
}

export async function listTenants() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createTenant(t) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("tenants")
    .insert([{ ...toRow(t), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateTenant(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("tenants")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteTenant(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("tenants").delete().eq("id", id);
  if (error) throw error;
}
