-- ============================================================================
-- Vision CRM — per-tenant reference sequences
-- ============================================================================
-- Human reference numbers (lead_number, contract_number, quote refs like
-- QUOTE-1042, CT-2049, VSN-PO-2107) must be unique *per company* and start
-- fresh for each tenant. A single global Postgres SEQUENCE can't do that, so
-- we keep an atomic counter per (company_id, name).
--
-- Gap-tolerant by design: a rolled-back transaction releases its number, and
-- concurrent callers serialise on the row lock, so values are unique but may
-- skip. The app formats the returned integer (e.g. 1042 -> 'QUOTE-1042').
-- ============================================================================

create table public.tenant_counters (
  company_id uuid   not null references public.companies (id) on delete cascade,
  name       text   not null,
  value      bigint not null default 0,
  primary key (company_id, name)
);

-- Locked down entirely: no direct access for any client role. The only way to
-- touch a counter is public.next_reference(), which derives the tenant from the
-- JWT and cannot be pointed at another company.
alter table public.tenant_counters enable row level security;

-- SECURITY DEFINER so it can bump the RLS-locked counter table, but it reads the
-- tenant from current_company_id() (the verified JWT) — never from an argument —
-- so a caller can only ever advance their own company's counter.
create or replace function public.next_reference(p_name text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.current_company_id();
  v_value   bigint;
begin
  if v_company is null then
    raise exception 'next_reference: no tenant in JWT context';
  end if;

  insert into public.tenant_counters (company_id, name, value)
  values (v_company, p_name, 1)
  on conflict (company_id, name)
    do update set value = public.tenant_counters.value + 1
  returning value into v_value;

  return v_value;
end;
$$;

revoke execute on function public.next_reference(text) from anon, public;
grant   execute on function public.next_reference(text) to authenticated;
