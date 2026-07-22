-- ============================================================================
-- Documents: content hashing so the same file isn't stored twice
-- ============================================================================
-- Files attached to notes also land on the customer's Documents tab (and the
-- linked lead/contract), so re-attaching a file someone already uploaded used
-- to mean a second copy of the same bytes in storage.
--
-- `content_hash` is the SHA-256 of the file's bytes, computed server-side on
-- upload. Before uploading, the app looks for a document on the same customer
-- with the same hash; if one exists, the user is asked whether to attach the
-- existing file or upload another copy.
--
-- "Attach the existing file" inserts a NEW documents row that points at the
-- SAME `file_url` (storage object) — one object, many rows — so the attachment
-- can belong to its own note without stealing the file from wherever it already
-- is. Because objects are shared, `deleteDocument` removes the stored object
-- ONLY when no other row still references that file_url. Anything that deletes
-- documents in future must do the same, or it will punch holes in other rows.
--
-- Rows written before this migration have a null hash: they simply never match
-- as duplicates until re-uploaded. Nothing needs backfilling for correctness.
--
-- Apply BY HAND in the Supabase SQL editor (per AGENTS.md — not `db push`).
-- ============================================================================

alter table public.documents add column if not exists content_hash text;

-- Duplicate lookup is always scoped to one tenant + one customer.
create index if not exists documents_content_hash_idx
  on public.documents (company_id, customer_id, content_hash);

-- Reverse lookup for the shared-object refcount on delete.
create index if not exists documents_file_url_idx on public.documents (file_url);
