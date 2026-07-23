-- Merge the lead's installation_* and fitting_* ADDRESS columns into ONE site_*
-- address set. In this business installation == fitting (fitting the windows is
-- the installation), so the two were always the same place; keeping them as
-- separate column sets only risked them drifting apart. A lead now has ONE site
-- address (the customer's own address is separate, on `customers`).
--
-- Only the ADDRESS columns merge. The operational fitting/installation columns
-- are deliberately KEPT and untouched:
--   installation_completed, installation_manager, fitting_directions,
--   estimated_fitting_days, send_letters_to_fitting, invoice_same_as_customer.
--
-- Strategy: RENAME installation_* → site_* (preserves the primary data with no
-- copy), fold any fitting_*-only values in as a fallback, then drop the now-empty
-- fitting_* address columns and the redundant fitting same-as flag.

alter table public.leads rename column installation_house_name   to site_house_name;
alter table public.leads rename column installation_house_number to site_house_number;
alter table public.leads rename column installation_street       to site_street;
alter table public.leads rename column installation_locality     to site_locality;
alter table public.leads rename column installation_town         to site_town;
alter table public.leads rename column installation_county       to site_county;
alter table public.leads rename column installation_postcode     to site_postcode;
alter table public.leads rename column installation_what_3_words to site_what_3_words;
-- The install/site "same as customer" flag becomes the one site flag.
alter table public.leads rename column same_as_customer_address  to site_same_as_customer;

-- Fold fitting_* in where the installation side was blank — a lead that only
-- ever had a fitting address recorded keeps it as its site address.
update public.leads set
  site_house_name    = coalesce(site_house_name,    fitting_house_name),
  site_house_number  = coalesce(site_house_number,  fitting_house_number),
  site_street        = coalesce(site_street,        fitting_street),
  site_locality      = coalesce(site_locality,      fitting_locality),
  site_town          = coalesce(site_town,          fitting_town),
  site_county        = coalesce(site_county,        fitting_county),
  site_postcode      = coalesce(site_postcode,      fitting_postcode),
  site_what_3_words  = coalesce(site_what_3_words,  fitting_what_3_words);

-- The site flag wins; only fall back to the old fitting flag if it was null.
update public.leads set
  site_same_as_customer = coalesce(site_same_as_customer, fitting_same_as_customer, true);

alter table public.leads drop column fitting_house_name;
alter table public.leads drop column fitting_house_number;
alter table public.leads drop column fitting_street;
alter table public.leads drop column fitting_locality;
alter table public.leads drop column fitting_town;
alter table public.leads drop column fitting_county;
alter table public.leads drop column fitting_postcode;
alter table public.leads drop column fitting_what_3_words;
alter table public.leads drop column fitting_same_as_customer;

-- RENAME carried the old default across, but state it plainly for new rows.
alter table public.leads alter column site_same_as_customer set default true;
