-- ============================================================================
-- Contracts: fitting_* address → site_*  (the leads merge, applied to contracts)
-- ============================================================================
-- 20260723092000 merged the LEAD's installation_*/fitting_* address columns into
-- one site_* set, on the grounds that in this business installation == fitting
-- (fitting the windows is the installation) so the two were always the same
-- place. `contracts` carries its own parallel fitting_* address block and was
-- deliberately left alone at the time, because contracts was a future phase and
-- no src/ code read it. Phase 5 builds contracts, so it adopts the same concept
-- now rather than shipping a screen that calls the same place by another name.
--
-- Contracts is the SIMPLER case: unlike leads it never had a second
-- installation_* address set, so this is a pure RENAME with nothing to fold in
-- and nothing to drop. No data moves.
--
-- Only the ADDRESS columns rename. These operational columns are deliberately
-- KEPT under their existing names — they are not addresses:
--   installation_completed, installation_manager, fitting_directions,
--   estimated_fitting_days, send_letters_to_fitting, invoice_same_as_customer.
-- fitting_directions stays the site address's note, exactly as on leads.
-- ============================================================================

alter table public.contracts rename column fitting_house_name   to site_house_name;
alter table public.contracts rename column fitting_house_number to site_house_number;
alter table public.contracts rename column fitting_street       to site_street;
alter table public.contracts rename column fitting_locality     to site_locality;
alter table public.contracts rename column fitting_town         to site_town;
alter table public.contracts rename column fitting_county       to site_county;
alter table public.contracts rename column fitting_postcode     to site_postcode;
alter table public.contracts rename column fitting_what_3_words to site_what_3_words;

-- The one "same as customer" flag for the site address, matching leads.
alter table public.contracts rename column fitting_same_as_customer to site_same_as_customer;

-- RENAME carries the old default across, but state it plainly for new rows
-- (same closing line as the leads merge).
alter table public.contracts alter column site_same_as_customer set default true;
