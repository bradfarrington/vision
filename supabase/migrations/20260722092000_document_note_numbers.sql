-- ============================================================================
-- Human reference numbers for documents and notes
-- ============================================================================
-- Customers (0002), leads (L-2431) and contracts (C-1892) all carry a per-tenant
-- reference so staff can quote them on the phone. Documents and notes had none,
-- so there was no way to say "see D-104" or "as per note N-18".
--
-- Both use the existing per-tenant counter (`public.next_reference`), which
-- derives the tenant from the JWT — so numbering starts at 1 for every tenant
-- and can never be pointed at another company's counter. Formatted in the app
-- as D-<n> / N-<n> (see src/lib/leads.ts).
--
-- Existing rows are backfilled per tenant in created_at order, and each tenant's
-- counter is advanced past its highest backfilled value so the next upload/note
-- continues the run rather than colliding.
--
-- Apply BY HAND in the Supabase SQL editor (per AGENTS.md — not `db push`).
-- ============================================================================

alter table public.documents  add column if not exists document_number bigint;
alter table public.lead_notes add column if not exists note_number     bigint;

-- ---- Backfill: number what's already there, oldest first, per tenant --------
with numbered as (
  select id, row_number() over (partition by company_id order by created_at, id) as n
  from public.documents
  where document_number is null
)
update public.documents d
set document_number = numbered.n
from numbered
where d.id = numbered.id;

with numbered as (
  select id, row_number() over (partition by company_id order by created_at, id) as n
  from public.lead_notes
  where note_number is null
)
update public.lead_notes n
set note_number = numbered.n
from numbered
where n.id = numbered.id;

-- ---- Advance each tenant's counter past the backfill ------------------------
insert into public.tenant_counters (company_id, name, value)
select company_id, 'document', max(document_number)
from public.documents
where document_number is not null
group by company_id
on conflict (company_id, name)
  do update set value = greatest(public.tenant_counters.value, excluded.value);

insert into public.tenant_counters (company_id, name, value)
select company_id, 'note', max(note_number)
from public.lead_notes
where note_number is not null
group by company_id
on conflict (company_id, name)
  do update set value = greatest(public.tenant_counters.value, excluded.value);

-- ---- Unique per tenant ------------------------------------------------------
create unique index if not exists documents_company_number_idx
  on public.documents (company_id, document_number)
  where document_number is not null;

create unique index if not exists lead_notes_company_number_idx
  on public.lead_notes (company_id, note_number)
  where note_number is not null;
