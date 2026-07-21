-- Documents storage — real file bytes for the `public.documents` metadata table.
--
-- The `documents` table already exists (tenant-scoped, RLS-isolated, polymorphic
-- via customer_id/lead_id/contract_id + context). Until now `file_url` was a bare
-- text column with no backing store. This migration adds the Supabase Storage
-- bucket the app uploads to and tenant-isolates it the same way every table is.
--
-- Object path convention (set by the app, never trusted from the client) —
-- customer-centric so files browse as a tidy per-customer tree:
--   {company_id}/{customer_id}/{uuid}.{ext}                      (customer's own docs)
--   {company_id}/{customer_id}/leads/{lead_id}/{uuid}.{ext}      (per-lead folder)
--   {company_id}/{customer_id}/contracts/{contract_id}/{uuid}.{ext}
-- The first path segment is the tenant's company_id, which the storage RLS
-- policies below compare against public.current_company_id() (the verified JWT
-- claim) — so one tenant can never read or write another tenant's objects. The
-- deeper segments are organisational only.
--
-- The object path is stored in documents.file_url; signed URLs are minted on
-- demand (private bucket), never persisted.
--
-- Apply BY HAND in the Supabase SQL editor (per AGENTS.md — not `supabase db push`).

-- 1. Private bucket, 25 MB per-object cap (mirror serverActions.bodySizeLimit).
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- 2. Tenant isolation on the bucket's objects. Top folder = company_id.
--    current_company_id() returns uuid; object folder names are text → cast.
drop policy if exists "documents tenant read"   on storage.objects;
drop policy if exists "documents tenant insert" on storage.objects;
drop policy if exists "documents tenant update" on storage.objects;
drop policy if exists "documents tenant delete" on storage.objects;

create policy "documents tenant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "documents tenant insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "documents tenant update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "documents tenant delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
