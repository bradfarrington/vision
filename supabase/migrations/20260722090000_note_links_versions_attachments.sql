-- ============================================================================
-- Notes: entity links, append-only version history, and attachments
-- ============================================================================
-- `lead_notes` is the CRM's single note table (customer-level when lead_id is
-- null, lead-level otherwise, categorised via `category`). Three additions:
--
--   1. contract_id — a note can now be pinned to a lead OR a contract, so a
--      customer-record note can say "this is about contract 0042" and be read
--      from either screen. customer_id stays set either way, so the customer's
--      Notes tab is always the full picture.
--   2. note_revisions — every version of a note's text, append-only. Editing a
--      note NEVER destroys what it said before: the new text is written to the
--      live row (fast reads) and appended as the next version here, stamped
--      with who changed it and when. v1 is the original, so the history is
--      complete on its own. Nothing in the app updates or deletes a revision.
--   3. documents.note_id — attachments. Files still live in the one `documents`
--      store (same bucket, same tenant RLS, same viewer), they just also carry
--      the note they were attached to. ON DELETE SET NULL: removing a note
--      keeps the file on the customer record, it just stops being an
--      attachment — deleting a note must never destroy a document.
--
-- Tenant isolation: note_revisions carries company_id and gets the standard
-- policy; the other two columns sit on tables already isolated.
--
-- Apply BY HAND in the Supabase SQL editor (per AGENTS.md — not `db push`).
-- ============================================================================

-- 1. Notes can point at a contract, and remember their last edit ---------------
alter table public.lead_notes
  add column if not exists contract_id uuid references public.contracts (id) on delete set null,
  add column if not exists updated_at  timestamptz,
  add column if not exists updated_by  uuid references public.users (id);

create index if not exists lead_notes_contract_idx on public.lead_notes (contract_id);
create index if not exists lead_notes_lead_idx     on public.lead_notes (lead_id);

-- 2. Append-only version history ----------------------------------------------
create table if not exists public.note_revisions (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  note_id    uuid not null references public.lead_notes (id) on delete cascade,
  version    integer not null,                    -- 1 = as first written
  content    text not null,                       -- the note's text at this version
  edited_by  uuid references public.users (id),   -- who wrote this version
  edited_at  timestamptz not null default now(),
  unique (note_id, version)
);
create index if not exists note_revisions_note_idx    on public.note_revisions (note_id, version desc);
create index if not exists note_revisions_company_idx on public.note_revisions (company_id);

alter table public.note_revisions enable row level security;
drop policy if exists "note_revisions: tenant isolation" on public.note_revisions;
create policy "note_revisions: tenant isolation"
  on public.note_revisions for all to authenticated
  using ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );

-- Backfill v1 for every note written before this migration, so existing notes
-- have a complete history rather than starting at "edited once".
insert into public.note_revisions (company_id, note_id, version, content, edited_by, edited_at)
select n.company_id, n.id, 1, n.content, n.created_by, n.created_at
from public.lead_notes n
where not exists (select 1 from public.note_revisions r where r.note_id = n.id);

-- 3. Attachments: a document can belong to a note -----------------------------
alter table public.documents
  add column if not exists note_id uuid references public.lead_notes (id) on delete set null;

create index if not exists documents_note_idx on public.documents (note_id);
