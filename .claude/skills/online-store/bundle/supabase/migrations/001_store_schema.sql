-- ============================================================================
-- Online Store skill — base schema
-- Creates every table the store + storefront features touch.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS) so it's safe to re-run, but it does
-- NOT migrate data from an older shape — if you already have differently-named
-- columns, reconcile before running.
--
-- External dependency: a `contacts` table and (optional) `companies` table
-- must exist in your host project. The `orders` table references them via
-- `contact_id` / `company_id` FKs — drop or NULL those FKs out if your
-- project has a different customer layer.
-- ============================================================================

-- ─── Lookup tables ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compatibility_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Products ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  product_type TEXT NOT NULL DEFAULT 'physical' CHECK (product_type IN ('physical', 'digital')),
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  compare_at_price NUMERIC(12,2),
  sku TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_threshold INTEGER NOT NULL DEFAULT 0,
  pack_quantity INTEGER NOT NULL DEFAULT 1,
  weight_kg NUMERIC(10,3) NOT NULL DEFAULT 0,
  continue_selling_when_out_of_stock BOOLEAN NOT NULL DEFAULT false,
  barcode TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_visible ON public.products(is_visible);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

-- Product media (images, videos, documents)
CREATE TABLE IF NOT EXISTS public.product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'document')),
  file_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_media_product ON public.product_media(product_id);

-- Product options (size, colour, etc) and their values
CREATE TABLE IF NOT EXISTS public.product_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.product_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group_id UUID NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Variants — option_values is a JSON array of { group_id, group_name, value_id, value }
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  option_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  price_override NUMERIC(12,2),
  compare_at_price NUMERIC(12,2),
  sku TEXT,
  barcode TEXT UNIQUE,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON public.product_variants(barcode);

-- Product reviews
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON public.product_reviews(product_id);

-- Junction tables — product ↔ label / compatibility / collection
CREATE TABLE IF NOT EXISTS public.product_label_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.product_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, label_id)
);

CREATE TABLE IF NOT EXISTS public.product_compatibility_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  compatibility_type_id UUID NOT NULL REFERENCES public.compatibility_types(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, compatibility_type_id)
);

-- ─── Collections ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_collection_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, collection_id)
);

-- ─── Store config (single-row theming + storefront templates) ─

CREATE TABLE IF NOT EXISTS public.store_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL DEFAULT 'My Store',
  tagline TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  -- Colours
  color_primary TEXT NOT NULL DEFAULT '#4B0082',
  color_secondary TEXT NOT NULL DEFAULT '#374151',
  color_accent TEXT NOT NULL DEFAULT '#F59E0B',
  color_background TEXT NOT NULL DEFAULT '#FFFFFF',
  color_surface TEXT NOT NULL DEFAULT '#F9FAFB',
  color_text TEXT NOT NULL DEFAULT '#111827',
  color_text_secondary TEXT NOT NULL DEFAULT '#6B7280',
  -- Typography
  font_heading TEXT NOT NULL DEFAULT 'Inter',
  font_body TEXT NOT NULL DEFAULT 'Inter',
  -- Header
  announcement_bar_text TEXT,
  announcement_bar_active BOOLEAN NOT NULL DEFAULT false,
  header_layout JSONB NOT NULL DEFAULT '{"logo_position":"left","nav_links":[]}'::jsonb,
  -- Footer
  footer_config JSONB NOT NULL DEFAULT '{"columns":[],"social_links":[],"copyright":""}'::jsonb,
  -- Homepage hero
  hero_image_url TEXT,
  hero_title TEXT NOT NULL DEFAULT 'Welcome',
  hero_subtitle TEXT,
  hero_cta_text TEXT NOT NULL DEFAULT 'Shop now',
  hero_cta_link TEXT NOT NULL DEFAULT '/shop/products',
  featured_collection_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  featured_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Page templates (theming for /shop/* routes)
  page_templates JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- SEO defaults
  seo_title TEXT,
  seo_description TEXT,
  seo_image_url TEXT,
  -- Custom domain (e.g. shop.example.com — checked by StorefrontLayout to decide if it owns "/")
  custom_domain TEXT,
  -- Currency
  currency_symbol TEXT NOT NULL DEFAULT '£',
  currency_code TEXT NOT NULL DEFAULT 'GBP',
  -- Test mode (banner shown across storefront when true)
  test_mode BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed a default row so fetchStoreConfig().single() works on a fresh install
INSERT INTO public.store_config (store_name)
SELECT 'My Store'
WHERE NOT EXISTS (SELECT 1 FROM public.store_config);

-- ─── Orders ─────────────────────────────────────────────────
-- order_number is auto-incremented by sequence; the storefront does NOT set it.

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGINT NOT NULL DEFAULT nextval('public.order_number_seq') UNIQUE,
  -- contact_id / company_id reference the host CRM's tables. Drop the FK if your project
  -- doesn't have those tables.
  contact_id UUID,
  company_id UUID,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address JSONB,
  shipping_method TEXT,
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_code TEXT,
  gift_card_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gift_card_code TEXT,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'partially_refunded')),
  payment_intent_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'partially_refunded', 'failed')),
  tracking_number TEXT,
  tracking_url TEXT,
  shipping_carrier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_contact ON public.orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_orders_company ON public.orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON public.orders(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_label TEXT,
  product_image_url TEXT,
  sku TEXT,
  barcode TEXT,  -- added by migration 005, included here for the consolidated install
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_weight_kg NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);

-- ─── Stock movements (audit log for every adjustment) ───────

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  barcode TEXT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('adjustment', 'received', 'damaged', 'stocktake', 'order', 'manual')),
  quantity_delta INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'scan', 'order', 'import')),
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_id ON public.stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_barcode ON public.stock_movements(barcode);

-- ─── Discount Codes ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'specific')),
  product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Gift Cards ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchaser_email TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  message TEXT,
  expires_at TIMESTAMPTZ,
  design_template TEXT NOT NULL DEFAULT 'classic'
    CHECK (design_template IN ('classic', 'industrial', 'festive', 'minimal')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Shipping ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  countries JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_days_min INTEGER NOT NULL DEFAULT 1,
  estimated_days_max INTEGER NOT NULL DEFAULT 5,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_zone ON public.shipping_rates(zone_id);

-- ─── Page SEO & Page Builder ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.page_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL UNIQUE,
  meta_title TEXT,
  meta_description TEXT,
  og_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the built-in storefront pages so the Unified Builder has something to load.
-- Keys correspond to routes: home → /shop, products → /shop/products, etc.
INSERT INTO public.store_pages (page_key, title, is_published)
VALUES
  ('home', 'Home', true),
  ('products', 'Products', true),
  ('collections', 'Collections', true),
  ('product_detail', 'Product Detail', true),
  ('collection_detail', 'Collection Detail', true),
  ('checkout', 'Checkout', true),
  ('thank_you', 'Thank You', true)
ON CONFLICT (page_key) DO NOTHING;

-- ─── Analytics (used by useTracking hook in storefront) ─────

CREATE TABLE IF NOT EXISTS public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT,
  referrer TEXT,
  user_agent TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
  browser TEXT,
  country TEXT,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON public.page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON public.page_views(created_at DESC);

CREATE TABLE IF NOT EXISTS public.ecommerce_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view_item', 'add_to_cart', 'begin_checkout', 'purchase', 'form_view', 'form_submit')),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  value NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'GBP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_events_session ON public.ecommerce_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_events_type ON public.ecommerce_events(event_type);

CREATE TABLE IF NOT EXISTS public.excluded_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Stripe settings (per-org Stripe keys, used by edge functions) ─

CREATE TABLE IF NOT EXISTS public.stripe_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_publishable_key TEXT,
  stripe_secret_key TEXT,
  stripe_webhook_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed one empty row so the edge functions' `.single()` queries work after install.
-- Fill in your real Stripe keys via UPDATE before going live.
INSERT INTO public.stripe_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.stripe_settings);

-- RPC: storefront fetches the publishable key without exposing the row to anon.
-- Returns NULL if not configured.
CREATE OR REPLACE FUNCTION public.get_stripe_publishable_key()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT stripe_publishable_key FROM public.stripe_settings LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_stripe_publishable_key() TO anon, authenticated;
