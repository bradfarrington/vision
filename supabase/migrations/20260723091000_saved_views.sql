-- ============================================================================
-- Saved views for the list screens
-- ============================================================================
-- A "view" is a NAMED bundle of everything that shapes a list screen: its query
-- (filters, advanced conditions, date range, sort, list-vs-board) AND its column
-- layout. Both halves have to travel together — a view called "Live leads for
-- Dave" that showed whatever columns you last set globally would defeat the
-- point.
--
-- Deliberately NOT `user_ui_layouts`. That table is one opaque blob per (user,
-- surface) and is a preference; a view is a named, listable, shareable record
-- with its own lifecycle. Different shape, different rules.
--
-- SHARING is the reason `owner_user_id` is nullable, and it is designed in from
-- the start rather than retrofitted:
--   * owner_user_id = a user  →  personal view, visible only to them
--   * owner_user_id = null    →  shared with the whole tenant
-- Everyone reads shared views; only the owner edits a personal one, and only an
-- admin creates or edits a shared one.
--
-- System views ("All leads", "Won this year") are NOT rows here. They are
-- defined in code (src/lib/views/system-views.ts) so they appear for every
-- tenant automatically, can't be deleted, and improve in a release — the same
-- trap the seeded lookup lists have, where every new default needs a migration
-- that re-seeds every existing tenant. A tenant customises one by duplicating it
-- into their own views.
-- ============================================================================

create table if not exists public.saved_views (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id),
  -- Which list screen this view belongs to: 'leads' | 'customers' | later 'contracts'.
  entity          text not null,
  -- NULL = shared with the whole tenant. Set = personal to that user.
  owner_user_id   uuid references auth.users (id) on delete cascade,
  name            text not null,
  -- URL params that make up the query: { "f_status": "quoted", "range": "90d", … }.
  -- Opaque to the DB; the list page expands it back into the URL.
  query           jsonb not null default '{}'::jsonb,
  -- { order: string[], widths: Record<string, number> } — same shape the column
  -- picker already saves to user_ui_layouts. NULL = use the user's own layout.
  columns         jsonb,
  sort_order      integer not null default 0,
  created_by      uuid references auth.users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists saved_views_company_entity_idx
  on public.saved_views (company_id, entity, sort_order);
create index if not exists saved_views_owner_idx
  on public.saved_views (owner_user_id);

alter table public.saved_views enable row level security;

-- READ: your own views plus everyone's shared ones, within your tenant.
create policy "saved_views: read own and shared"
  on public.saved_views for select to authenticated
  using (
    company_id = public.current_company_id()
    and (owner_user_id is null or owner_user_id = auth.uid())
  );

-- WRITE: a user manages their OWN views. Shared views (owner_user_id is null)
-- are deliberately not writable here — that needs an admin, added with the
-- role check when the admin UI lands. Until then a shared view can only be
-- created by a platform/DB operation, which is the safe default.
create policy "saved_views: insert own"
  on public.saved_views for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and owner_user_id = auth.uid()
  );

create policy "saved_views: update own"
  on public.saved_views for update to authenticated
  using ( company_id = public.current_company_id() and owner_user_id = auth.uid() )
  with check ( company_id = public.current_company_id() and owner_user_id = auth.uid() );

create policy "saved_views: delete own"
  on public.saved_views for delete to authenticated
  using ( company_id = public.current_company_id() and owner_user_id = auth.uid() );
