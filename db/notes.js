// =============================================================================
// db/notes.js — Supabase wrapper for the polymorphic `notes` table.
//
// One DB table, three logical kinds:
//   note_type='rental'  → has property_id, optional tenant_id
//   note_type='deal'    → has deal_id
//   note_type='general' → no entity ref
//
// We expose three create helpers (one per kind) so callers don't need to know
// the discriminator column. listNotes() returns the rows pre-partitioned into
// the same three buckets the app already keeps as in-memory arrays.
// =============================================================================
import { supabase } from "../supabase.js";

function fromRow(row) {
  if (!row) return row;
  const base = {
    id: row.id,
    date: row.date,
    text: row.text,
    mentions: row.mentions || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
  if (row.note_type === "rental") {
    return { ...base, propertyId: row.property_id, tenantId: row.tenant_id };
  }
  if (row.note_type === "deal") {
    return {
      ...base,
      dealId: row.deal_id,
      rehabItemIdx: row.rehab_item_idx == null ? undefined : row.rehab_item_idx,
    };
  }
  return base;
}

function commonToRow(n) {
  const out = {};
  if (n.text !== undefined) out.text = n.text;
  if (n.date !== undefined) out.date = n.date;
  if (n.mentions !== undefined) out.mentions = n.mentions;
  return out;
}

export async function listNotes() {
  const empty = { rentalNotes: [], dealNotes: [], generalNotes: [] };
  if (!supabase) return empty;
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  const rentalNotes = [];
  const dealNotes = [];
  const generalNotes = [];
  for (const row of data || []) {
    const note = fromRow(row);
    if (row.note_type === "rental") rentalNotes.push(note);
    else if (row.note_type === "deal") dealNotes.push(note);
    else generalNotes.push(note);
  }
  return { rentalNotes, dealNotes, generalNotes };
}

async function insertNote(payload) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("notes")
    .insert([{ ...payload, user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function createRentalNote(n) {
  return insertNote({
    ...commonToRow(n),
    note_type: "rental",
    property_id: n.propertyId,
    tenant_id: n.tenantId || null,
  });
}

export async function createDealNote(n) {
  return insertNote({
    ...commonToRow(n),
    note_type: "deal",
    deal_id: n.dealId,
    rehab_item_idx: n.rehabItemIdx == null ? null : n.rehabItemIdx,
  });
}

export async function createGeneralNote(n) {
  return insertNote({
    ...commonToRow(n),
    note_type: "general",
  });
}

export async function updateNote(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("notes")
    .update(commonToRow(updates))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteNote(id) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}
