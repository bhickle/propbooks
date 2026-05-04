// =============================================================================
// db/properties.js — Supabase wrapper for the `properties` table.
//
// Purpose: keep the rest of the app speaking the camelCase shape it always has
// while talking to a snake_case Postgres schema. Auth-context-aware: every
// query is implicitly scoped to the current user's rows by RLS.
//
// Returns objects shaped exactly like the legacy mock-data PROPERTIES rows
// (camelCase keys, JS-friendly types) so component code is unchanged.
// =============================================================================
import { supabase } from "../supabase.js";

// ── snake_case ↔ camelCase mappers ──────────────────────────────────────────
// One source of truth for the mapping. Keep this aligned with the
// `properties` schema; if you add a column in a migration, add it here too.

function fromRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    type: row.type,
    units: row.units,
    status: row.status,
    image: row.image,
    photo: row.photo,
    purchasePrice: row.purchase_price == null ? null : Number(row.purchase_price),
    currentValue: row.current_value == null ? null : Number(row.current_value),
    valueUpdatedAt: row.value_updated_at,
    landValue: row.land_value == null ? null : Number(row.land_value),
    loanAmount: row.loan_amount == null ? null : Number(row.loan_amount),
    loanRate: row.loan_rate == null ? null : Number(row.loan_rate),
    loanTermYears: row.loan_term_years,
    loanStartDate: row.loan_start_date,
    closingCosts: row.closing_costs == null ? null : Number(row.closing_costs),
    monthlyRent: row.monthly_rent == null ? null : Number(row.monthly_rent),
    monthlyExpenses: row.monthly_expenses == null ? null : Number(row.monthly_expenses),
    purchaseDate: row.purchase_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(p) {
  // Only include keys the caller actually set, so updates don't clobber columns
  // with `undefined`. Maps every camelCase prop to its snake_case column.
  const out = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.address !== undefined) out.address = p.address;
  if (p.type !== undefined) out.type = p.type;
  if (p.units !== undefined) out.units = p.units;
  if (p.status !== undefined) out.status = p.status;
  if (p.image !== undefined) out.image = p.image;
  if (p.photo !== undefined) out.photo = p.photo;
  if (p.purchasePrice !== undefined) out.purchase_price = p.purchasePrice;
  if (p.currentValue !== undefined) out.current_value = p.currentValue;
  if (p.valueUpdatedAt !== undefined) out.value_updated_at = p.valueUpdatedAt;
  if (p.landValue !== undefined) out.land_value = p.landValue;
  if (p.loanAmount !== undefined) out.loan_amount = p.loanAmount;
  if (p.loanRate !== undefined) out.loan_rate = p.loanRate;
  if (p.loanTermYears !== undefined) out.loan_term_years = p.loanTermYears;
  if (p.loanStartDate !== undefined) out.loan_start_date = p.loanStartDate;
  if (p.closingCosts !== undefined) out.closing_costs = p.closingCosts;
  if (p.monthlyRent !== undefined) out.monthly_rent = p.monthlyRent;
  if (p.monthlyExpenses !== undefined) out.monthly_expenses = p.monthlyExpenses;
  if (p.purchaseDate !== undefined) out.purchase_date = p.purchaseDate;
  return out;
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listProperties() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createProperty(prop) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("properties")
    .insert([{ ...toRow(prop), user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateProperty(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("properties")
    .update(toRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteProperty(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw error;
}
