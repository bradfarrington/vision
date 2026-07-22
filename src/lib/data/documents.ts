/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Documents — a reusable, entity-agnostic file store.
//
// The `public.documents` table is polymorphic: it carries a nullable FK per
// owner kind (customer_id / lead_id / contract_id) plus a `context` label. This
// module is the single place that maps an abstract (ownerType, ownerId) onto the
// right column so the upload/list/rename/delete pipeline is written ONCE and
// reused for customers, leads, contracts and anything added later.
//
// Files live in the private `documents` storage bucket, partitioned per tenant:
//   {company_id}/{owner_type}/{owner_id}/{uuid}.{ext}
// The object path is stored in documents.file_url; signed URLs are minted on
// demand (see getDocumentSignedUrl in the actions file).
// ---------------------------------------------------------------------------

export const DOCUMENTS_BUCKET = "documents";

export type DocumentOwnerType = "customer" | "lead" | "contract";

/** owner type → the FK column on public.documents. Single source of truth. */
export const OWNER_FK: Record<DocumentOwnerType, "customer_id" | "lead_id" | "contract_id"> = {
  customer: "customer_id",
  lead: "lead_id",
  contract: "contract_id",
};

/** Every owner type the module knows about — used to validate untrusted input. */
export function isDocumentOwnerType(v: unknown): v is DocumentOwnerType {
  return v === "customer" || v === "lead" || v === "contract";
}

/**
 * Storage object path — customer-centric so a tenant's files browse as a tidy
 * tree in the bucket:
 *   {company_id}/{customer_id}/{file}                      ← the customer's own docs
 *   {company_id}/{customer_id}/leads/{lead_id}/{file}      ← per-lead folder
 *   {company_id}/{customer_id}/contracts/{contract_id}/{file}
 *
 * Every path lives under the owning customer, so leads/contracts nest beneath
 * the customer they belong to. The first segment is always company_id, which
 * the storage RLS policies check — the rest is organisational.
 *
 * customerId is required: for a customer owner it IS the ownerId; for a
 * lead/contract owner it's the customer that lead/contract belongs to.
 */
export function buildDocumentPath(args: {
  companyId: string;
  customerId: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  fileId: string;
  ext: string;
}): string {
  const { companyId, customerId, ownerType, ownerId, fileId, ext } = args;
  const root = `${companyId}/${customerId}`;
  const leaf = `${fileId}${ext}`;
  if (ownerType === "lead") return `${root}/leads/${ownerId}/${leaf}`;
  if (ownerType === "contract") return `${root}/contracts/${ownerId}/${leaf}`;
  return `${root}/${leaf}`;
}

/** The revalidation path for an owner's detail screen (customers → /customers/:id). */
export function ownerRevalidatePath(ownerType: DocumentOwnerType, ownerId: string): string {
  return `/${ownerType}s/${ownerId}`;
}

export type DocumentItem = {
  id: string;
  /** Per-tenant reference number, shown as D-<n>. */
  number: number | null;
  name: string; // display name (renameable)
  file_name: string; // original uploaded filename
  file_type: string | null; // MIME type
  file_size: number | null; // bytes
  storage_path: string; // object path within the bucket (stored in file_url)
  category: string | null;
  created_at: string;
  uploaded_by: string | null;
  uploader: string | null; // resolved display name
  /** Set when the file was attached to a note (it's still a normal document). */
  noteId: string | null;
  /** The reference number of that note, for "from N-18" labels. */
  noteNumber: number | null;
};

// Columns selected for a document row, plus the uploader name join. Kept here so
// getCustomerRecord (and future lead/contract loaders) select an identical shape.
export const DOCUMENT_SELECT =
  "id, document_number, name, file_name, file_type, file_size, file_url, category, created_at, note_id, note:note_id(note_number), uploaded_by, uploader:uploaded_by(first_name, last_name)";

// Same shape minus anything added by a migration that may not be applied yet.
// Schema is applied by hand here (see AGENTS.md), so a loader that asks for a
// not-yet-existing column gets its WHOLE query rejected and the screen renders
// as if the customer had no files. Falling back keeps the record readable —
// references just show as "D-—" until the migration lands.
export const DOCUMENT_SELECT_BASE =
  "id, name, file_name, file_type, file_size, file_url, category, created_at, uploaded_by, uploader:uploaded_by(first_name, last_name)";

/**
 * Run a select that uses newest-migration columns, retrying with a safe subset
 * if the database hasn't caught up. Only the retry path loses fields.
 */
export async function selectWithFallback<T = any>(
  primary: () => PromiseLike<{ data: T | null; error: unknown }>,
  fallback: () => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<{ data: T | null; error: unknown }> {
  const res = await primary();
  if (!res.error) return res;
  return fallback();
}

type RawDocRow = {
  id: string;
  document_number: number | null;
  name: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  file_url: string;
  category: string | null;
  created_at: string;
  note_id: string | null;
  note: { note_number: number | null } | null;
  uploaded_by: string | null;
  uploader: { first_name: string | null; last_name: string | null } | null;
};

/** Normalise a raw `documents` row (with uploader join) into a DocumentItem. */
export function mapDocumentRow(row: RawDocRow): DocumentItem {
  return {
    id: row.id,
    number: row.document_number ?? null,
    name: row.name,
    file_name: row.file_name,
    file_type: row.file_type,
    file_size: row.file_size,
    storage_path: row.file_url,
    category: row.category,
    created_at: row.created_at,
    uploaded_by: row.uploaded_by,
    noteId: row.note_id ?? null,
    noteNumber: row.note?.note_number ?? null,
    uploader: row.uploader
      ? [row.uploader.first_name, row.uploader.last_name].filter(Boolean).join(" ").trim() || null
      : null,
  };
}

/** List an owner's documents, newest first. RLS confines this to the tenant. */
export async function getDocuments(
  ownerType: DocumentOwnerType,
  ownerId: string,
): Promise<DocumentItem[]> {
  const supabase = await createClient();
  const db = supabase as unknown as { from(table: string): any };

  const { data, error } = await selectWithFallback(
    () =>
      db
        .from("documents")
        .select(DOCUMENT_SELECT)
        .eq(OWNER_FK[ownerType], ownerId)
        .order("created_at", { ascending: false }),
    () =>
      db
        .from("documents")
        .select(DOCUMENT_SELECT_BASE)
        .eq(OWNER_FK[ownerType], ownerId)
        .order("created_at", { ascending: false }),
  );

  if (error) throw new Error(`getDocuments: ${(error as { message?: string }).message}`);
  return ((data ?? []) as RawDocRow[]).map(mapDocumentRow);
}
