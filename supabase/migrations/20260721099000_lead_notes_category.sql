-- ============================================================================
-- Categorise notes so a customer can have separate note threads
-- ============================================================================
-- lead_notes already carries customer_id (customer-level notes). Add a category
-- so, e.g., marketing notes are their own stamped thread separate from general
-- customer notes. Default 'general'; existing rows stay null (treated as general).
-- ============================================================================

alter table public.lead_notes add column if not exists category text default 'general';
create index if not exists lead_notes_customer_category_idx
  on public.lead_notes (customer_id, category);
