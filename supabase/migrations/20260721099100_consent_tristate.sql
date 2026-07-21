-- ============================================================================
-- Marketing consent is tri-state: unknown (null) / yes / no
-- ============================================================================
-- A hard "No" that was never actually asked is misleading (and matters for
-- GDPR). Drop the `false` default so consent starts blank, and reset existing
-- default-false rows to null (unknown). Explicit yes/no set via the UI stays.
-- ============================================================================

alter table public.customers
  alter column email_opt_in  drop default,
  alter column sms_opt_in    drop default,
  alter column phone_opt_in  drop default,
  alter column letter_opt_in drop default;

update public.customers set email_opt_in  = null where email_opt_in  = false;
update public.customers set sms_opt_in    = null where sms_opt_in    = false;
update public.customers set phone_opt_in  = null where phone_opt_in  = false;
update public.customers set letter_opt_in = null where letter_opt_in = false;
