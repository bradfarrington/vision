/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import {
  DOCUMENTS_BUCKET,
  OWNER_FK,
  buildDocumentPath,
  isDocumentOwnerType,
  ownerRevalidatePath,
} from "@/lib/data/documents";

// ---------------------------------------------------------------------------
// Reusable document actions — upload / rename / delete / sign. Entity-agnostic:
// every action takes (ownerType, ownerId) and defers the column mapping to
// OWNER_FK, so customers, leads and contracts all share this one pipeline.
//
// Tenant safety: company_id comes from the verified JWT (getCompanyId), the
// object path is namespaced under it, and RLS (table + storage) confines every
// read/write to the caller's tenant. Nothing here trusts a client-supplied id.
// ---------------------------------------------------------------------------

const MAX_BYTES = 25 * 1024 * 1024; // keep in step with next.config + bucket cap

/** SHA-256 of the file's bytes, hex — the identity we dedupe on. */
async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Lowercased, sanitised extension incl. leading dot, or "" if none. */
function safeExt(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext ? `.${ext}` : "";
}

/**
 * Upload one file for an owner. Called once per file (the panel loops), so each
 * upload progresses and fails independently. Multipart body flows through the
 * server action — `serverActions.bodySizeLimit` in next.config caps it.
 */
export async function uploadDocument(formData: FormData): Promise<{ error?: string }> {
  const ownerType = formData.get("ownerType");
  const ownerId = formData.get("ownerId");
  const category = (formData.get("category") as string | null)?.trim() || null;
  const displayName = (formData.get("name") as string | null)?.trim();
  // The customer a lead/contract belongs to (nests its files under the customer
  // folder). For a customer owner this is the ownerId itself.
  const customerIdRaw = (formData.get("customerId") as string | null)?.trim();
  // Set when the file is an attachment on a note — it stays an ordinary document
  // on the owner, it just also shows inside that note.
  const noteId = (formData.get("noteId") as string | null)?.trim() || null;
  const file = formData.get("file");

  if (!isDocumentOwnerType(ownerType)) return { error: "Invalid owner type." };
  if (typeof ownerId !== "string" || !ownerId) return { error: "Missing owner." };
  if (!(file instanceof File) || file.size === 0) return { error: "No file provided." };
  if (file.size > MAX_BYTES) return { error: "File exceeds the 25 MB limit." };

  const customerId = ownerType === "customer" ? ownerId : customerIdRaw || null;
  if (!customerId) return { error: "Missing owning customer for the document." };

  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Customer-centric path; first segment is the tenant, which storage RLS
  // checks against current_company_id().
  const objectPath = buildDocumentPath({
    companyId,
    customerId,
    ownerType,
    ownerId,
    fileId: crypto.randomUUID(),
    ext: safeExt(file.name),
  });

  const bytes = await file.arrayBuffer();
  const contentHash = await sha256Hex(bytes);
  const buffer = Buffer.from(bytes);
  const { error: upErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(objectPath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  // Reference counts within the customer (DOC-0001 is their first file). The
  // counter name encodes the customer; the tenant still comes from the JWT.
  const { data: documentNumber } = await supabase.rpc("next_reference", {
    p_name: `document:${customerId}`,
  });

  const db = supabase as any;
  const { data: inserted, error: insErr } = await db.from("documents").insert({
    company_id: companyId,
    document_number: documentNumber != null ? Number(documentNumber) : null,
    [OWNER_FK[ownerType]]: ownerId,
    // Always link the owning customer so the doc is reachable from the customer
    // record too (customer owner → same id; lead/contract → its customer).
    customer_id: customerId,
    context: ownerType,
    name: displayName || file.name,
    file_name: file.name,
    file_type: file.type || null,
    file_size: file.size,
    file_url: objectPath,
    category,
    content_hash: contentHash,
    uploaded_by: user?.id ?? null,
  })
  .select("id")
  .single();
  if (insErr) {
    // Don't leave an orphaned object if the metadata row failed.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([objectPath]);
    return { error: `Save failed: ${insErr.message}` };
  }

  // Attaching to a note is a link, never a second copy of the file.
  if (noteId && inserted?.id) {
    const link = await db.from("note_attachments").insert({
      company_id: companyId,
      note_id: noteId,
      document_id: inserted.id,
    });
    if (link.error) return { error: `Attach failed: ${link.error.message}` };
  }

  revalidatePath(ownerRevalidatePath(ownerType, ownerId));
  return {};
}

/**
 * Is this file already on the customer's record? Matched on the SHA-256 the
 * client computes before uploading, so a duplicate costs one small query
 * instead of a wasted round-trip of the whole file.
 */
export async function findDuplicateDocument(args: {
  contentHash: string;
  customerId: string;
}): Promise<{ id?: string; name?: string; createdAt?: string; uploader?: string | null }> {
  if (!args.contentHash || !args.customerId) return {};

  const supabase = await createClient();
  const db = supabase as any;
  const { data } = await db
    .from("documents")
    .select("id, name, created_at, uploader:uploaded_by(first_name, last_name)")
    .eq("customer_id", args.customerId)
    .eq("content_hash", args.contentHash)
    .order("created_at")
    .limit(1);

  const row = data?.[0];
  if (!row) return {};
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    uploader: row.uploader
      ? [row.uploader.first_name, row.uploader.last_name].filter(Boolean).join(" ").trim() || null
      : null,
  };
}

/**
 * Link a document that's already on the record to a note. No upload, no second
 * documents row, no new reference — the note simply points at the same file, so
 * renaming it anywhere renames it everywhere (it IS the same file).
 */
export async function attachDocumentToNote(args: {
  documentId: string;
  noteId: string;
  /** Whose record to revalidate. */
  customerId: string;
}): Promise<{ error?: string }> {
  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };

  const supabase = await createClient();
  const db = supabase as any;

  const { error } = await db
    .from("note_attachments")
    .upsert(
      { company_id: companyId, note_id: args.noteId, document_id: args.documentId },
      { onConflict: "note_id,document_id", ignoreDuplicates: true },
    );
  if (error) return { error: error.message };

  revalidatePath(`/customers/${args.customerId}`);
  return {};
}

/**
 * Unlink a document from a note. The file stays on the record — this only
 * removes the reference, which is the whole point of attachments being links.
 */
export async function detachDocumentFromNote(args: {
  documentId: string;
  noteId: string;
  customerId: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const db = supabase as any;

  const { error } = await db
    .from("note_attachments")
    .delete()
    .eq("note_id", args.noteId)
    .eq("document_id", args.documentId);
  if (error) return { error: error.message };

  revalidatePath(`/customers/${args.customerId}`);
  return {};
}

/** Rename a document's display name (the stored file/object is untouched). */
export async function renameDocument(
  id: string,
  name: string,
  ownerType: string,
  ownerId: string,
): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name can't be empty." };
  if (!isDocumentOwnerType(ownerType)) return { error: "Invalid owner type." };

  const supabase = await createClient();
  const db = supabase as any;
  const { error } = await db.from("documents").update({ name: trimmed }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(ownerRevalidatePath(ownerType, ownerId));
  return {};
}

/** Set/clear a document's category label. */
export async function setDocumentCategory(
  id: string,
  category: string | null,
  ownerType: string,
  ownerId: string,
): Promise<{ error?: string }> {
  if (!isDocumentOwnerType(ownerType)) return { error: "Invalid owner type." };
  const value = category?.trim() || null;

  const supabase = await createClient();
  const db = supabase as any;
  const { error } = await db.from("documents").update({ category: value }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(ownerRevalidatePath(ownerType, ownerId));
  return {};
}

/** Delete a document — removes the stored object then the metadata row. */
export async function deleteDocument(
  id: string,
  ownerType: string,
  ownerId: string,
): Promise<{ error?: string }> {
  if (!isDocumentOwnerType(ownerType)) return { error: "Invalid owner type." };

  const supabase = await createClient();
  const db = supabase as any;

  const { data: row } = await db
    .from("documents")
    .select("file_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await db.from("documents").delete().eq("id", id);
  if (error) return { error: error.message };

  if (row?.file_url) {
    // De-duplicated uploads share one storage object across rows, so the object
    // only goes when the last row referencing it has gone.
    const { count } = await db
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("file_url", row.file_url);
    if (!count) await supabase.storage.from(DOCUMENTS_BUCKET).remove([row.file_url]);
  }

  revalidatePath(ownerRevalidatePath(ownerType, ownerId));
  return {};
}

// --- Categories -------------------------------------------------------------
// Document categories are generic tenant_options under the `document_category`
// list_key (seeded for all tenants in 20260721101100). Kept here so the module
// is self-contained and doesn't reach into customer-specific actions.
const CATEGORY_LIST_KEY = "document_category";

/** Add (or reuse) a tenant document category. */
export async function addDocumentCategory(
  label: string,
): Promise<{ id?: string; label?: string; error?: string }> {
  const clean = label.trim();
  if (!clean) return { error: "Enter a name." };

  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };

  const supabase = await createClient();
  const db = supabase as any;

  const existing = await db
    .from("tenant_options")
    .select("id, label")
    .eq("list_key", CATEGORY_LIST_KEY)
    .eq("label", clean)
    .limit(1);
  if (existing.data?.[0]) return { id: existing.data[0].id, label: clean };

  const ins = await db
    .from("tenant_options")
    .insert({ company_id: companyId, list_key: CATEGORY_LIST_KEY, label: clean })
    .select("id, label")
    .single();
  if (ins.error) return { error: ins.error.message };
  return { id: ins.data.id, label: clean };
}

/** Remove a tenant document category. */
export async function deleteDocumentCategory(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const db = supabase as any;
  const { error } = await db.from("tenant_options").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

/**
 * Mint a short-lived signed URL for viewing or downloading. The bucket is
 * private, so the viewer/download always goes through this (RLS-checked) path
 * rather than storing a public URL.
 */
export async function getDocumentSignedUrl(
  id: string,
  opts?: { download?: boolean },
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const db = supabase as any;

  const { data: row, error } = await db
    .from("documents")
    .select("file_url, file_name")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!row?.file_url) return { error: "File not found." };

  const { data, error: signErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(row.file_url, 60 * 10, opts?.download ? { download: row.file_name } : undefined);
  if (signErr) return { error: signErr.message };

  return { url: data.signedUrl };
}
