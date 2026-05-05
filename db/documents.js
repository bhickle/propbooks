// =============================================================================
// db/documents.js — Supabase wrapper for the polymorphic `documents` table
// plus Storage-bucket integration for the actual file uploads.
//
// One DB row per logical document. The optional `storage_path` column points
// at an object in the private "documents" bucket; documents without an
// uploaded file (legacy / placeholder records) leave it null.
//
// Bucket layout:
//   <auth.uid()>/<entityType>/<entityId>/<docId>-<filename>
// RLS pins each user to their own folder (see migration
// documents_storage_rls_policies).
// =============================================================================
import { supabase } from "../supabase.js";

const BUCKET = "documents";

function fromRow(row) {
  if (!row) return row;
  const base = {
    id: row.id,
    name: row.name,
    type: row.type,
    mimeType: row.mime_type,
    size: row.size,
    url: row.url,
    storagePath: row.storage_path,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
  if (row.entity_type === "property") return { ...base, propertyId: row.entity_id };
  if (row.entity_type === "deal")     return { ...base, dealId: row.entity_id };
  if (row.entity_type === "tenant")   return { ...base, tenantId: row.entity_id };
  if (row.entity_type === "contractor") return { ...base, contractorId: row.entity_id, dealId: row.deal_id || null };
  return base;
}

export async function listDocuments() {
  const empty = { propertyDocs: [], dealDocs: [], tenantDocs: [], contractorDocs: [] };
  if (!supabase) return empty;
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const propertyDocs = [];
  const dealDocs = [];
  const tenantDocs = [];
  const contractorDocs = [];
  for (const row of data || []) {
    const doc = fromRow(row);
    if (row.entity_type === "property")        propertyDocs.push(doc);
    else if (row.entity_type === "deal")       dealDocs.push(doc);
    else if (row.entity_type === "tenant")     tenantDocs.push(doc);
    else if (row.entity_type === "contractor") contractorDocs.push(doc);
  }
  return { propertyDocs, dealDocs, tenantDocs, contractorDocs };
}

function formatSize(bytes) {
  if (bytes == null) return null;
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

// ── Create a document. If `file` (a File/Blob) is provided, upload it to
// Storage first and store the resulting path on the row. Returns the same
// camelCase shape consumers already use.
//
// args:
//   entityType: "property" | "deal" | "tenant" | "contractor"
//   entityId:   uuid
//   meta:       { name, type, date?, mimeType?, size? }
//   file?:      File | Blob (optional — placeholder records can omit it)
//   dealId?:    uuid (only used for contractor docs that link to a specific deal)
export async function createDocument({ entityType, entityId, meta, file = null, dealId = null }) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let storagePath = null;
  let url = null;
  let mimeType = meta.mimeType ?? null;
  let size = meta.size ?? null;

  if (file) {
    mimeType = mimeType || file.type || null;
    size = size || formatSize(file.size);
    const safeName = (file.name || meta.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    const tmpId = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    storagePath = `${user.id}/${entityType}/${entityId}/${tmpId}-${safeName}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: mimeType || undefined,
      upsert: false,
    });
    if (upErr) throw upErr;
    // Bucket is private; we'll generate signed URLs on read. Store path only.
    url = null;
  }

  const insertRow = {
    user_id: user.id,
    entity_type: entityType,
    entity_id: entityId,
    deal_id: entityType === "contractor" ? dealId : null,
    name: meta.name,
    type: meta.type || "other",
    mime_type: mimeType,
    size,
    url,
    storage_path: storagePath,
    date: meta.date || new Date().toISOString().slice(0, 10),
  };

  const { data, error } = await supabase
    .from("documents")
    .insert([insertRow])
    .select()
    .single();
  if (error) {
    // Best-effort cleanup if the row insert fails after upload.
    if (storagePath) {
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    }
    throw error;
  }
  return fromRow(data);
}

// Updates editable metadata on an existing document row (name/type/date and,
// for contractor docs, the linked dealId). Does not move the file in Storage.
export async function updateDocument(id, updates) {
  if (!supabase) throw new Error("Supabase not configured");
  const out = {};
  if (updates.name !== undefined) out.name = updates.name;
  if (updates.type !== undefined) out.type = updates.type;
  if (updates.date !== undefined) out.date = updates.date;
  if (updates.dealId !== undefined) out.deal_id = updates.dealId || null;
  const { data, error } = await supabase
    .from("documents")
    .update(out)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteDocument(doc) {
  if (!supabase) throw new Error("Supabase not configured");
  if (doc.storagePath) {
    await supabase.storage.from(BUCKET).remove([doc.storagePath]).catch(() => {});
  }
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw error;
}

// Returns a short-lived signed URL for opening a stored document. Returns
// the row's existing `url` (or null) if there is no storage_path.
export async function getDocumentUrl(doc, expiresInSeconds = 60 * 60) {
  if (!supabase) return doc.url || null;
  if (!doc.storagePath) return doc.url || null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storagePath, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl || null;
}
