-- ============================================================================
-- Address → coordinates cache
-- ============================================================================
-- Backs every map in the CRM. A building does not move, so an address is
-- geocoded ONCE per tenant and read from here forever after. That is also what
-- keeps us inside the free geocoders' fair-use policies: the provider sees one
-- request per distinct address in the tenant's book, ever — not one per page
-- view.
--
-- Keyed by the NORMALISED FULL ADDRESS (see addressKey() in lib/geo.ts), not by
-- postcode, because the map is expected to land on the door: "3 Cathedral
-- Close" and "5 Cathedral Close" share a postcode and are not the same place.
--
-- Why a lookup table rather than latitude/longitude columns on `customers`:
--   * one row serves the customer, its leads, its contracts and its fitting
--     appointments whenever they share an address;
--   * staleness is impossible by construction. Coordinates cached on a customer
--     row go wrong the moment someone corrects the street; a row keyed BY the
--     address simply stops being read.
--
-- Why it is company_id-scoped even though addresses geocode to public data:
--   a shared global table would let any tenant read which addresses another
--   tenant has looked up — a direct leak of someone else's customer list.
--   Every table in `public` follows the tenant-isolation policy.
--
-- `latitude`/`longitude` null = looked up and NOT FOUND. That negative result
-- is cached too, so a bad address on a frequently-opened record does not hammer
-- the geocoder — but `checked_at` lets the app retry it later, since OSM gains
-- house-number coverage over time.
-- ============================================================================

create table if not exists public.address_locations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id),
  address_key  text not null,                -- normalised full address, the cache key
  address_line text,                         -- the address as it was searched, for debugging
  postcode     text,                         -- normalised, so a postcode can be reported on
  latitude     double precision,
  longitude    double precision,
  -- Not called `precision`: that is a Postgres keyword (`double precision`) and
  -- an unquoted column of that name is a trap waiting for someone.
  match_precision text,                      -- 'address' | 'street' | 'postcode' | 'outcode'
  place        text,                         -- what the geocoder says it matched
  source       text not null default 'nominatim',
  checked_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (company_id, address_key)
);

create index if not exists address_locations_company_key_idx
  on public.address_locations (company_id, address_key);

alter table public.address_locations enable row level security;
create policy "address_locations: tenant isolation"
  on public.address_locations for all to authenticated
  using ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );
