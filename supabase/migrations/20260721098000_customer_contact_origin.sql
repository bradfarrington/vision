-- ============================================================================
-- Track auto-created contacts from the customer's name fields
-- ============================================================================
-- The primary (first_name + last_name) and secondary (first_name_2 +
-- last_name_2) people are mirrored into customer_contacts automatically.
-- `origin` links a contact back to the name fields it came from so renames stay
-- in sync: 'primary' | 'secondary' | null (manually-added contact).
-- ============================================================================

alter table public.customer_contacts add column if not exists origin text;
create index if not exists customer_contacts_origin_idx
  on public.customer_contacts (customer_id, origin);
