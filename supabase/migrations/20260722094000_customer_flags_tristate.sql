-- Customer flags are TRISTATE, not boolean.
--
-- do_not_contact / bad_payer / customer_moved_away were created `default false`,
-- so every customer read back as an explicit "No" the moment the row existed —
-- indistinguishable from a flag someone had actually assessed and cleared.
-- Blank (null) = never asked; false = asked and the answer was No.
--
-- Same rule as the marketing-consent tristates: absence of an answer is data.

alter table public.customers
  alter column do_not_contact      drop default,
  alter column bad_payer           drop default,
  alter column customer_moved_away drop default;

-- Backfill: existing `false` values were never recorded by a user — they are
-- the column default from the migration above. Reset them to "never asked" so
-- the flag reads honestly. Any true stays true.
update public.customers set do_not_contact      = null where do_not_contact      = false;
update public.customers set bad_payer           = null where bad_payer           = false;
update public.customers set customer_moved_away = null where customer_moved_away = false;
