-- ============================================================================
-- Attachments become links, and references count per customer
-- ============================================================================
-- Two corrections to the note/document work earlier today.
--
-- 1. ATTACHING IS A LINK, NOT A COPY.
--    `documents.note_id` made an attachment a property of the document, so
--    attaching a file that was already on the record had to write a SECOND
--    documents row (sharing the storage object) — which showed up as a
--    duplicate on the Documents tab, and renaming one made the same file look
--    like two different files. It is one file: one row, one name, renamed
--    everywhere at once. `note_attachments` is the join, so a document can be
--    referenced by several notes without ever being duplicated.
--
-- 2. REFERENCES COUNT PER CUSTOMER.
--    DOC-/NOTE- numbers were allocated per tenant, so the first document on a
--    new customer read DOC-0004. They now count within the customer, using a
--    counter per (company, customer) via the existing next_reference() —
--    `document:<customer_id>` / `note:<owner_id>`. Numbers are still allocated
--    forward and never reused within a customer (deleting DOC-0003 does not
--    free it), they simply start at 1 for each customer.
--
-- Apply BY HAND in the Supabase SQL editor (per AGENTS.md — not `db push`).
-- ============================================================================

-- ---- 1. The join table -----------------------------------------------------
create table if not exists public.note_attachments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id),
  note_id     uuid not null references public.lead_notes (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (note_id, document_id)
);
create index if not exists note_attachments_note_idx     on public.note_attachments (note_id);
create index if not exists note_attachments_document_idx on public.note_attachments (document_id);
create index if not exists note_attachments_company_idx  on public.note_attachments (company_id);

alter table public.note_attachments enable row level security;
drop policy if exists "note_attachments: tenant isolation" on public.note_attachments;
create policy "note_attachments: tenant isolation"
  on public.note_attachments for all to authenticated
  using ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );

-- ---- 2. Move existing attachments onto the join ----------------------------
insert into public.note_attachments (company_id, note_id, document_id, created_at)
select d.company_id, d.note_id, d.id, d.created_at
from public.documents d
where d.note_id is not null
on conflict (note_id, document_id) do nothing;

-- ---- 3. Merge the duplicate rows the old copy-on-attach created ------------
-- Rows sharing a storage object are the same file. Keep the oldest, move its
-- note links over, drop the rest. The storage object is untouched (the keeper
-- still references it).
do $$
declare r record;
begin
  for r in
    select d.id as dup_id, k.keep_id
    from public.documents d
    join (
      select company_id, file_url, (array_agg(id order by created_at, id))[1] as keep_id
      from public.documents
      group by company_id, file_url
      having count(*) > 1
    ) k on k.company_id = d.company_id and k.file_url = d.file_url
    where d.id <> k.keep_id
  loop
    -- Repoint links that the keeper doesn't already have.
    update public.note_attachments na
       set document_id = r.keep_id
     where na.document_id = r.dup_id
       and not exists (
         select 1 from public.note_attachments x
         where x.note_id = na.note_id and x.document_id = r.keep_id
       );
    -- Anything left was already linked to the keeper.
    delete from public.note_attachments where document_id = r.dup_id;
    delete from public.documents where id = r.dup_id;
  end loop;
end $$;

-- ---- 4. note_id has served its purpose -------------------------------------
alter table public.documents drop column if exists note_id;

-- ---- 5. Renumber per customer ----------------------------------------------
drop index if exists public.documents_company_number_idx;
drop index if exists public.lead_notes_company_number_idx;

with numbered as (
  select id,
         row_number() over (
           partition by company_id, coalesce(customer_id::text, 'none')
           order by created_at, id
         ) as n
  from public.documents
)
update public.documents d
set document_number = numbered.n
from numbered
where d.id = numbered.id;

with numbered as (
  select id,
         row_number() over (
           partition by company_id, coalesce(customer_id::text, lead_id::text, 'none')
           order by created_at, id
         ) as n
  from public.lead_notes
)
update public.lead_notes n
set note_number = numbered.n
from numbered
where n.id = numbered.id;

-- ---- 6. Seed the per-customer counters past the renumber -------------------
-- Counter names encode the owner: 'document:<customer_id>' / 'note:<owner_id>'.
insert into public.tenant_counters (company_id, name, value)
select company_id, 'document:' || customer_id::text, max(document_number)
from public.documents
where customer_id is not null and document_number is not null
group by company_id, customer_id
on conflict (company_id, name)
  do update set value = greatest(public.tenant_counters.value, excluded.value);

insert into public.tenant_counters (company_id, name, value)
select company_id, 'note:' || coalesce(customer_id::text, lead_id::text), max(note_number)
from public.lead_notes
where coalesce(customer_id, lead_id) is not null and note_number is not null
group by company_id, coalesce(customer_id::text, lead_id::text)
on conflict (company_id, name)
  do update set value = greatest(public.tenant_counters.value, excluded.value);

-- The old per-tenant counters are dead weight now.
delete from public.tenant_counters where name in ('document', 'note');

-- ---- 7. Unique within the customer, not the tenant -------------------------
create unique index if not exists documents_customer_number_idx
  on public.documents (company_id, customer_id, document_number)
  where document_number is not null;

create unique index if not exists lead_notes_owner_number_idx
  on public.lead_notes (company_id, coalesce(customer_id, lead_id), note_number)
  where note_number is not null;
