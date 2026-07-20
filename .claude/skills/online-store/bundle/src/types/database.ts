// Store + storefront types extracted from the CRM's full database.ts.
// Add these (or replace your equivalents) when integrating the online-store skill.
// External types referenced: Contact, Company (from your CRM's contacts/companies layer)
// — `Order.contact` / `Order.company` are optional joins, drop them if you don't have those tables.

// Configurable lookup item — used for product labels / compatibility types.
// If your project doesn't have a generic LookupItem, replace with `{ id: string; name: string; color?: string }`.
export interface LookupItem {
  id: string;
  name: string;
  color?: string;
  sort_order: number;
  created_at: string;
}

// ─── Online Store: Products ─────────────────────────────────

export type ProductType = 'physical' | 'digital';

export interface Product {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  product_type: ProductType;
  price: number;
  compare_at_price: number | null;
  sku: string | null;
  is_visible: boolean;
  stock_quantity: number;
  min_stock_threshold: number;
  pack_quantity: number;
  weight_kg: number;
  continue_selling_when_out_of_stock: boolean;
  barcode: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  labels?: LookupItem[];
  collections?: Collection[];
  compatibilities?: LookupItem[];
  media?: ProductMedia[];
  variants?: ProductVariant[];
  // Computed (product list)
  variant_count?: number;
  total_variant_stock?: number;
  variant_stock_details?: { label: string; stock: number }[];
  variant_price_min?: number | null;
  variant_price_max?: number | null;
}

export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'labels' | 'collections' | 'media' | 'variants'>;
export type ProductUpdate = Partial<Omit<ProductInsert, 'product_type'>>;

export interface ProductReview {
  id: string;
  product_id: string;
  author_name: string;
  rating: number; // 1-5
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

// ─── Online Store: Collections ──────────────────────────────

export interface Collection {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  cover_image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Virtual (computed from assignments)
  product_count?: number;
}

export type CollectionInsert = Omit<Collection, 'id' | 'created_at' | 'updated_at' | 'product_count'>;
export type CollectionUpdate = Partial<CollectionInsert>;

// ─── Online Store: Product Media ────────────────────────────

export type MediaType = 'image' | 'video' | 'document';

export interface ProductMedia {
  id: string;
  product_id: string;
  media_url: string;
  media_type: MediaType;
  file_name: string | null;
  sort_order: number;
  created_at: string;
}

export type ProductMediaInsert = Omit<ProductMedia, 'id' | 'created_at'>;

// ─── Online Store: Product Options ──────────────────────────

export interface ProductOptionGroup {
  id: string;
  product_id: string;
  name: string;
  sort_order: number;
  values?: ProductOptionValue[];
}

export interface ProductOptionValue {
  id: string;
  option_group_id: string;
  value: string;
  sort_order: number;
}

// ─── Online Store: Product Variants ─────────────────────────

export interface VariantOptionEntry {
  group_id: string;
  group_name: string;
  value_id: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  option_values: VariantOptionEntry[];
  price_override: number | null;
  compare_at_price: number | null;
  sku: string | null;
  barcode: string | null;
  stock_quantity: number;
  created_at: string;
}

export type ProductVariantInsert = Omit<ProductVariant, 'id' | 'created_at'>;

// ─── Online Store: Inventory Summary (virtual) ──────────────

export interface InventoryItem {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  variant_id: string | null;
  variant_label: string | null;
  variant_sku: string | null;
  barcode: string | null;
  stock_quantity: number;
  min_stock_threshold: number;
  continue_selling_when_out_of_stock: boolean;
  price: number;
}

// ─── Online Store: Stock Movements (audit log) ──────────────

export type StockMovementType = 'adjustment' | 'received' | 'damaged' | 'stocktake' | 'order' | 'manual';
export type StockMovementSource = 'manual' | 'scan' | 'order' | 'import';

export interface StockMovement {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  barcode: string | null;
  movement_type: StockMovementType;
  quantity_delta: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  source: StockMovementSource;
  performed_by: string | null;
  performed_by_name: string | null;
  created_at: string;
  // Joined
  product_name?: string | null;
  variant_label?: string | null;
}

export type StockMovementInsert = Omit<StockMovement, 'id' | 'created_at' | 'product_name' | 'variant_label'>;

// ─── Store Config (theming + page templates) ────────────────

export interface ProductsTemplateConfig {
  pageTitle: string;
  pageSubtitle: string;
  titleAlign?: 'left' | 'center' | 'right';
  titleColor?: string;
  titleSize?: 'small' | 'medium' | 'large' | 'xlarge';
  subtitleColor?: string;
  subtitleSize?: 'small' | 'medium' | 'large' | 'xlarge';
  columns: number;
  cardBgColor: string;
  cardTextColor: string;
  cardRadius: number;
  imageAspect: 'square' | 'portrait' | 'landscape';
  showPrice: boolean;
  showComparePrice: boolean;
  priceColor: string;
  showSortBar: boolean;
  showSidebar: boolean;
  sidebarPosition: 'left' | 'right';
  enableCategoryFilter: boolean;
  enableCompatibilityFilter: boolean;
}

export interface CollectionsTemplateConfig {
  pageTitle: string;
  pageSubtitle: string;
  titleAlign?: 'left' | 'center' | 'right';
  titleColor?: string;
  titleSize?: 'small' | 'medium' | 'large' | 'xlarge';
  subtitleColor?: string;
  subtitleSize?: 'small' | 'medium' | 'large' | 'xlarge';
  columns: number;
  cardRadius: number;
  overlayBgColor: string;
  overlayTextColor: string;
  overlayOpacity: number;
  showProductCount: boolean;
}

export interface ProductDetailTemplateConfig {
  imagePosition: 'left' | 'right';
  showDescription: boolean;
  showSku: boolean;
  showCompatibility: boolean;
  showRelatedProducts: boolean;
  relatedProductsTitle?: string;
  showReviews: boolean;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonRadius: number;
  buttonText: string;
  priceColor: string;
  titleFontSize: number;
  titleColor: string;
  descriptionFontSize: number;
  descriptionColor: string;
  inputLabelColor: string;
  inputBgColor: string;
  inputTextColor: string;
  inputBorderColor: string;
  inputRadius: number;
}

export interface CollectionDetailTemplateConfig {
  columns: number;
  cardBgColor: string;
  cardTextColor: string;
  cardRadius: number;
  imageAspect: 'square' | 'portrait' | 'landscape';
  showPrice: boolean;
  priceColor: string;
}

export interface CheckoutTemplateConfig {
  sectionBgColor: string;
  sectionTextColor: string;
  sectionRadius: number;
  headingColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonRadius: number;
  buttonText: string;
  inputRadius: number;
  inputBorderColor: string;
}

export interface CartSidebarTemplateConfig {
  headerBgColor: string;
  headerTextColor: string;
  bodyBgColor: string;
  emptyText: string;
  emptyButtonText: string;
  checkoutButtonBgColor: string;
  checkoutButtonTextColor: string;
  checkoutButtonRadius: number;
  checkoutButtonText: string;
}

export interface PageTemplates {
  products: Partial<ProductsTemplateConfig>;
  collections: Partial<CollectionsTemplateConfig>;
  product_detail: Partial<ProductDetailTemplateConfig>;
  collection_detail: Partial<CollectionDetailTemplateConfig>;
  checkout: Partial<CheckoutTemplateConfig>;
  cart_sidebar: Partial<CartSidebarTemplateConfig>;
}

export interface StoreConfig {
  id: string;
  store_name: string;
  tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  // Colours
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_background: string;
  color_surface: string;
  color_text: string;
  color_text_secondary: string;
  // Typography
  font_heading: string;
  font_body: string;
  // Header
  announcement_bar_text: string | null;
  announcement_bar_active: boolean;
  header_layout: {
    logo_position: 'left' | 'center';
    logo_width_desktop?: number;
    logo_width_mobile?: number;
    nav_links: { label: string; url: string }[];
    nav_font?: string;
    nav_color?: string;
    bg_color?: string;
    cart_icon_type?: 'ShoppingCart' | 'ShoppingBag' | 'ShoppingBasket';
    cart_icon_color?: string;
    announcement_type?: 'static' | 'ticker';
    announcement_bg_color?: string;
    announcement_text_color?: string;
    announcement_font?: string;
  };
  // Footer
  footer_config: {
    columns: { title: string; links: { label: string; url: string }[] }[];
    social_links: { platform: string; url: string }[];
    copyright: string;
  };
  // Homepage
  hero_image_url: string | null;
  hero_title: string;
  hero_subtitle: string | null;
  hero_cta_text: string;
  hero_cta_link: string;
  featured_collection_ids: string[];
  featured_product_ids: string[];
  // Page Templates
  page_templates: Partial<PageTemplates>;
  // SEO
  seo_title: string | null;
  seo_description: string | null;
  seo_image_url: string | null;
  // Domain
  custom_domain: string | null;
  // Currency
  currency_symbol: string;
  currency_code: string;
  // Test mode
  test_mode: boolean;
  created_at: string;
  updated_at: string;
}

export type StoreConfigUpdate = Partial<Omit<StoreConfig, 'id' | 'created_at' | 'updated_at'>>;

// ─── Orders ─────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'partially_refunded';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'partially_refunded' | 'failed';

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
}

export interface Order {
  id: string;
  order_number: number;
  contact_id: string | null;
  company_id: string | null;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  shipping_address: ShippingAddress | null;
  shipping_method: string | null;
  shipping_cost: number;
  subtotal: number;
  discount_amount: number;
  discount_code: string | null;
  gift_card_amount: number;
  gift_card_code: string | null;
  tax_amount: number;
  total: number;
  status: OrderStatus;
  payment_intent_id: string | null;
  payment_status: PaymentStatus;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_carrier: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined — host project supplies Contact / Company types from its CRM layer.
  items?: OrderItem[];
  contact?: any | null;
  company?: any | null;
}

export type OrderInsert = Omit<Order, 'id' | 'order_number' | 'created_at' | 'updated_at' | 'items' | 'contact' | 'company'>;

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  product_image_url: string | null;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_weight_kg: number;
  created_at: string;
  // Enriched from linked product (not stored in DB)
  pack_quantity?: number;
}

export type OrderItemInsert = Omit<OrderItem, 'id' | 'created_at'>;

// ─── Discount Codes ─────────────────────────────────────────

export type DiscountType = 'percentage' | 'fixed';
export type DiscountAppliesTo = 'all' | 'specific';

export interface DiscountCode {
  id: string;
  code: string;
  discount_type: DiscountType;
  value: number;
  min_order_amount: number;
  max_uses: number | null;
  current_uses: number;
  starts_at: string | null;
  expires_at: string | null;
  applies_to: DiscountAppliesTo;
  product_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DiscountCodeInsert = Omit<DiscountCode, 'id' | 'created_at' | 'updated_at' | 'current_uses'>;
export type DiscountCodeUpdate = Partial<DiscountCodeInsert>;

// ─── Gift Cards ─────────────────────────────────────────────

export interface GiftCard {
  id: string;
  code: string;
  initial_balance: number;
  current_balance: number;
  purchaser_email: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  message: string | null;
  expires_at: string | null;
  design_template: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type GiftCardDesignTemplate = 'classic' | 'industrial' | 'festive' | 'minimal';

export type GiftCardInsert = Omit<GiftCard, 'id' | 'created_at' | 'updated_at'>;
export type GiftCardUpdate = Partial<GiftCardInsert>;

// ─── Shipping ───────────────────────────────────────────────

export interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  is_default: boolean;
  created_at: string;
  // Joined
  rates?: ShippingRate[];
}

export type ShippingZoneInsert = Omit<ShippingZone, 'id' | 'created_at' | 'rates'>;
export type ShippingZoneUpdate = Partial<ShippingZoneInsert>;

export interface ShippingRate {
  id: string;
  zone_id: string;
  name: string;
  price: number;
  estimated_days_min: number;
  estimated_days_max: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export type ShippingRateInsert = Omit<ShippingRate, 'id' | 'created_at'>;
export type ShippingRateUpdate = Partial<ShippingRateInsert>;

// ─── Page SEO ───────────────────────────────────────────────

export interface PageSeo {
  id: string;
  page_key: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type PageSeoInsert = Omit<PageSeo, 'id' | 'created_at' | 'updated_at'>;
export type PageSeoUpdate = Partial<PageSeoInsert>;

// ─── Cart (client-side only, not in DB) ─────────────────────

export interface CartItem {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  price: number;
  compareAtPrice: number | null;
  quantity: number;
  imageUrl: string | null;
  weightKg: number;
  sku: string | null;
  barcode: string | null;
  slug: string;
}

// ─── Store Pages (Page Builder) ─────────────────────────────

export type BlockType =
  | 'columns'
  | 'container'
  | 'hero'
  | 'half_hero'
  | 'heading'
  | 'text'
  | 'image'
  | 'image_gallery'
  | 'button'
  | 'product_grid'
  | 'collection_grid'
  | 'collection_showcase'
  | 'category_links'
  | 'product_carousel'
  | 'featured_product'
  | 'spacer'
  | 'divider'
  | 'video'
  | 'testimonials'
  | 'faq'
  | 'banner'
  | 'ticker'
  | 'features'
  | 'custom_html';

export interface PageBlock {
  id: string;
  type: BlockType;
  config: Record<string, any>;
}

export interface StorePage {
  id: string;
  page_key: string;
  title: string;
  blocks: PageBlock[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type StorePageInsert = Omit<StorePage, 'id' | 'created_at' | 'updated_at'>;
export type StorePageUpdate = Partial<StorePageInsert>;
