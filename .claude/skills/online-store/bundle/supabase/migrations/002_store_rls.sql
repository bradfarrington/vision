-- ============================================================================
-- Online Store skill — Row-Level Security
-- Extracted from the GamLEARN / Isobex CRM's 20260410_enable_rls.sql,
-- with the store-only subset.
--
-- Policy model:
--   • Authenticated users (your CRM team) get full CRUD on everything.
--   • Anonymous visitors get scoped SELECT/INSERT/UPDATE to make the storefront
--     work without an account.
--
-- Edge Functions use the service_role key, which bypasses RLS — no policies
-- needed for them.
-- ============================================================================

-- ─── Enable RLS on every store table ─────────────────────────

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compatibility_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_label_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_compatibility_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collection_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_seo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excluded_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- ─── Authenticated CRM team: full access ─────────────────────

CREATE POLICY "auth_all_products" ON public.products FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_product_media" ON public.product_media FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_product_option_groups" ON public.product_option_groups FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_product_option_values" ON public.product_option_values FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_product_variants" ON public.product_variants FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_product_reviews" ON public.product_reviews FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_product_labels" ON public.product_labels FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_compatibility_types" ON public.compatibility_types FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_product_label_assignments" ON public.product_label_assignments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_product_compat_assignments" ON public.product_compatibility_assignments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_product_collection_assignments" ON public.product_collection_assignments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_collections" ON public.collections FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_store_config" ON public.store_config FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_orders" ON public.orders FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_order_items" ON public.order_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_discount_codes" ON public.discount_codes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_gift_cards" ON public.gift_cards FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_shipping_zones" ON public.shipping_zones FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_shipping_rates" ON public.shipping_rates FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_page_seo" ON public.page_seo FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_store_pages" ON public.store_pages FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_page_views" ON public.page_views FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_ecommerce_events" ON public.ecommerce_events FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_excluded_ips" ON public.excluded_ips FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_stripe_settings" ON public.stripe_settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_stock_movements" ON public.stock_movements FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ─── Anonymous storefront: scoped read ───────────────────────

CREATE POLICY "anon_read_visible_products" ON public.products FOR SELECT USING (is_visible = true);
CREATE POLICY "anon_read_product_media" ON public.product_media FOR SELECT USING (true);
CREATE POLICY "anon_read_product_option_groups" ON public.product_option_groups FOR SELECT USING (true);
CREATE POLICY "anon_read_product_option_values" ON public.product_option_values FOR SELECT USING (true);
CREATE POLICY "anon_read_product_variants" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "anon_read_approved_reviews" ON public.product_reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "anon_read_collections" ON public.collections FOR SELECT USING (true);
CREATE POLICY "anon_read_product_collection_assignments" ON public.product_collection_assignments FOR SELECT USING (true);
CREATE POLICY "anon_read_compatibility_types" ON public.compatibility_types FOR SELECT USING (true);
CREATE POLICY "anon_read_product_compat_assignments" ON public.product_compatibility_assignments FOR SELECT USING (true);
CREATE POLICY "anon_read_product_label_assignments" ON public.product_label_assignments FOR SELECT USING (true);
CREATE POLICY "anon_read_product_labels" ON public.product_labels FOR SELECT USING (true);
CREATE POLICY "anon_read_store_config" ON public.store_config FOR SELECT USING (true);
CREATE POLICY "anon_read_store_pages" ON public.store_pages FOR SELECT USING (true);
CREATE POLICY "anon_read_page_seo" ON public.page_seo FOR SELECT USING (true);
CREATE POLICY "anon_read_shipping_rates" ON public.shipping_rates FOR SELECT USING (is_active = true);
CREATE POLICY "anon_read_shipping_zones" ON public.shipping_zones FOR SELECT USING (true);
CREATE POLICY "anon_read_active_discount_codes" ON public.discount_codes FOR SELECT USING (is_active = true);
CREATE POLICY "anon_read_active_gift_cards" ON public.gift_cards FOR SELECT USING (is_active = true);
CREATE POLICY "anon_read_excluded_ips" ON public.excluded_ips FOR SELECT USING (true);

-- ─── Anonymous storefront: scoped write ──────────────────────

-- Anonymous checkout creates orders + order items.
CREATE POLICY "anon_insert_orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert_order_items" ON public.order_items FOR INSERT WITH CHECK (true);

-- Public product-review submissions.
CREATE POLICY "anon_insert_product_reviews" ON public.product_reviews FOR INSERT WITH CHECK (true);

-- Analytics inserts (useTracking hook).
CREATE POLICY "anon_insert_ecommerce_events" ON public.ecommerce_events FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert_page_views" ON public.page_views FOR INSERT WITH CHECK (true);

-- Checkout increments discount-code usage counter and deducts gift card balance.
CREATE POLICY "anon_update_discount_usage" ON public.discount_codes FOR UPDATE USING (is_active = true) WITH CHECK (is_active = true);
CREATE POLICY "anon_update_gift_card_balance" ON public.gift_cards FOR UPDATE USING (is_active = true) WITH CHECK (is_active = true);

-- ─── Notes ──────────────────────────────────────────────────
-- 1. `stripe_settings` is RLS-locked to authenticated users. The storefront fetches
--    the publishable key via the SECURITY DEFINER `get_stripe_publishable_key()` RPC
--    instead — that way anon visitors never see the secret key.
-- 2. If your host project has a `contacts` table, the storefront checkout also needs
--    anon INSERT + SELECT (by email) policies on it — they're in the RLS migration
--    of the host CRM, not bundled here since the contacts table is the host project's,
--    not the skill's. See INTEGRATION.md.
