// Store + storefront API functions extracted from the host CRM's monolithic api.ts.
//
// Integration: either drop this file in alongside your project's existing api.ts
// (and adjust imports inside the bundle to point at it), or merge these functions
// into your existing api.ts. The store/storefront bundle calls them as `api.fetchProducts()`
// etc. via `import * as api from '@/lib/api'`.
//
// Dependencies the host project MUST supply:
//   - `supabase` client (anon for browser, service_role bypasses RLS in edge fns)
//   - A `contacts` table with at least the columns referenced in findOrCreateContact()
//     and a `createContact()` helper (or inline an insert here)
//   - An `app_users` table with `auth_user_id`, `full_name`, `email` columns for stock-movement audit attribution
//     (best-effort — adjustStock degrades gracefully if missing)

import { supabase } from './supabase';
import type {
  LookupItem,
  Product,
  ProductInsert,
  ProductUpdate,
  ProductReview,
  Collection,
  CollectionInsert,
  CollectionUpdate,
  ProductMedia,
  ProductMediaInsert,
  ProductOptionGroup,
  ProductOptionValue,
  ProductVariant,
  ProductVariantInsert,
  InventoryItem,
  StockMovement,
  StockMovementType,
  StockMovementSource,
  StoreConfig,
  StoreConfigUpdate,
  Order,
  OrderInsert,
  OrderItem,
  OrderItemInsert,
  DiscountCode,
  DiscountCodeInsert,
  DiscountCodeUpdate,
  GiftCard,
  GiftCardInsert,
  GiftCardUpdate,
  ShippingZone,
  ShippingZoneInsert,
  ShippingZoneUpdate,
  ShippingRate,
  ShippingRateInsert,
  ShippingRateUpdate,
  PageSeo,
  PageSeoUpdate,
  StorePage,
  StorePageUpdate,
} from '@/types/database';

// ─── Slug Helper ────────────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Online Store: Products ─────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const products = data as Product[];

  const { data: variants, error: vErr } = await supabase
    .from('product_variants')
    .select('product_id, option_values, stock_quantity, price_override');
  if (vErr) throw vErr;

  const variantsByProduct = new Map<string, any[]>();
  (variants || []).forEach((v: any) => {
    const list = variantsByProduct.get(v.product_id) || [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  });

  return products.map((p) => {
    const pvariants = variantsByProduct.get(p.id);
    if (pvariants && pvariants.length > 0) {
      const details = pvariants.map((v: any) => ({
        label: (v.option_values || []).map((ov: any) => `${ov.group_name}: ${ov.value}`).join(' / ') || 'Default',
        stock: v.stock_quantity ?? 0,
      }));
      const total = details.reduce((sum: number, d: { stock: number }) => sum + d.stock, 0);
      const prices = pvariants
        .map((v: any) => v.price_override as number | null)
        .filter((p): p is number => p != null && p > 0);
      const priceMin = prices.length > 0 ? Math.min(...prices) : null;
      const priceMax = prices.length > 0 ? Math.max(...prices) : null;
      return {
        ...p,
        variant_count: pvariants.length,
        total_variant_stock: total,
        variant_stock_details: details,
        variant_price_min: priceMin,
        variant_price_max: priceMax,
      };
    }
    return p;
  });
}

export async function fetchProduct(productId: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();
  if (error) throw error;
  return data as Product;
}

export async function createProduct(product: ProductInsert): Promise<Product> {
  const { data, error } = await supabase.from('products').insert(product).select().single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, updates: ProductUpdate): Promise<Product> {
  const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ─── Product Media ──────────────────────────────────────────

export async function fetchProductMedia(productId: string): Promise<ProductMedia[]> {
  const { data, error } = await supabase
    .from('product_media').select('*').eq('product_id', productId).order('sort_order', { ascending: true });
  if (error) throw error;
  return data as ProductMedia[];
}

export async function fetchProductImages(productId: string): Promise<ProductMedia[]> {
  const { data, error } = await supabase
    .from('product_media').select('*').eq('product_id', productId)
    .in('media_type', ['image', 'video']).order('sort_order', { ascending: true });
  if (error) throw error;
  return data as ProductMedia[];
}

export async function fetchProductDocuments(productId: string): Promise<ProductMedia[]> {
  const { data, error } = await supabase
    .from('product_media').select('*').eq('product_id', productId)
    .eq('media_type', 'document').order('sort_order', { ascending: true });
  if (error) throw error;
  return data as ProductMedia[];
}

export async function addProductMedia(media: ProductMediaInsert): Promise<ProductMedia> {
  const { data, error } = await supabase.from('product_media').insert(media).select().single();
  if (error) throw error;
  return data as ProductMedia;
}

export async function deleteProductMedia(id: string): Promise<void> {
  const { error } = await supabase.from('product_media').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderProductMedia(_productId: string, orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    supabase.from('product_media').update({ sort_order: index }).eq('id', id)
  );
  await Promise.all(updates);
}

// ─── Product Options & Variants ─────────────────────────────

export async function fetchProductOptions(productId: string): Promise<ProductOptionGroup[]> {
  const { data: groups, error: gErr } = await supabase
    .from('product_option_groups').select('*').eq('product_id', productId).order('sort_order', { ascending: true });
  if (gErr) throw gErr;

  const groupIds = (groups || []).map((g: ProductOptionGroup) => g.id);
  if (groupIds.length === 0) return [];

  const { data: values, error: vErr } = await supabase
    .from('product_option_values').select('*').in('option_group_id', groupIds).order('sort_order', { ascending: true });
  if (vErr) throw vErr;

  return (groups as ProductOptionGroup[]).map((g) => ({
    ...g,
    values: (values as ProductOptionValue[]).filter((v) => v.option_group_id === g.id),
  }));
}

export async function saveProductOptions(
  productId: string,
  groups: { name: string; values: string[] }[]
): Promise<ProductOptionGroup[]> {
  await supabase.from('product_option_groups').delete().eq('product_id', productId);
  const result: ProductOptionGroup[] = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const { data: group, error: gErr } = await supabase
      .from('product_option_groups').insert({ product_id: productId, name: g.name, sort_order: gi }).select().single();
    if (gErr) throw gErr;

    const valRows = g.values.map((v, vi) => ({ option_group_id: group.id, value: v, sort_order: vi }));
    const { data: vals, error: vErr } = await supabase.from('product_option_values').insert(valRows).select();
    if (vErr) throw vErr;
    result.push({ ...group, values: vals as ProductOptionValue[] } as ProductOptionGroup);
  }
  return result;
}

export async function fetchProductVariants(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from('product_variants').select('*').eq('product_id', productId).order('created_at', { ascending: true });
  if (error) throw error;
  return data as ProductVariant[];
}

export async function saveProductVariants(productId: string, variants: ProductVariantInsert[]): Promise<ProductVariant[]> {
  await supabase.from('product_variants').delete().eq('product_id', productId);
  if (variants.length === 0) return [];
  const { data, error } = await supabase.from('product_variants').insert(variants).select();
  if (error) throw error;
  return data as ProductVariant[];
}

export async function updateProductVariant(
  id: string,
  updates: Partial<Pick<ProductVariant, 'price_override' | 'sku' | 'stock_quantity'>>
): Promise<ProductVariant> {
  const { data, error } = await supabase.from('product_variants').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as ProductVariant;
}

// ─── Collections ────────────────────────────────────────────

export async function fetchCollections(): Promise<Collection[]> {
  const { data, error } = await supabase.from('collections').select('*').order('sort_order', { ascending: true });
  if (error) throw error;

  const { data: counts } = await supabase.from('product_collection_assignments').select('collection_id');
  const countMap: Record<string, number> = {};
  (counts || []).forEach((row: { collection_id: string }) => {
    countMap[row.collection_id] = (countMap[row.collection_id] || 0) + 1;
  });
  return (data as Collection[]).map((c) => ({ ...c, product_count: countMap[c.id] || 0 }));
}

export async function createCollection(collection: CollectionInsert): Promise<Collection> {
  const { data, error } = await supabase.from('collections').insert(collection).select().single();
  if (error) throw error;
  return { ...data, product_count: 0 } as Collection;
}

export async function updateCollection(id: string, updates: CollectionUpdate): Promise<Collection> {
  const { data, error } = await supabase.from('collections').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Collection;
}

export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id);
  if (error) throw error;
}

// ─── Product ↔ Label / Compatibility / Collection links ─────

export async function fetchProductLabelIds(productId: string): Promise<string[]> {
  const { data, error } = await supabase.from('product_label_assignments').select('label_id').eq('product_id', productId);
  if (error) throw error;
  return (data || []).map((r: { label_id: string }) => r.label_id);
}

export async function assignProductLabels(productId: string, labelIds: string[]): Promise<void> {
  await supabase.from('product_label_assignments').delete().eq('product_id', productId);
  if (labelIds.length === 0) return;
  const rows = labelIds.map((labelId) => ({ product_id: productId, label_id: labelId }));
  const { error } = await supabase.from('product_label_assignments').insert(rows);
  if (error) throw error;
}

export async function fetchProductCompatibilityIds(productId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('product_compatibility_assignments').select('compatibility_type_id').eq('product_id', productId);
  if (error) throw error;
  return (data || []).map((r: { compatibility_type_id: string }) => r.compatibility_type_id);
}

export async function assignProductCompatibilities(productId: string, typeIds: string[]): Promise<void> {
  await supabase.from('product_compatibility_assignments').delete().eq('product_id', productId);
  if (typeIds.length === 0) return;
  const rows = typeIds.map((typeId) => ({ product_id: productId, compatibility_type_id: typeId }));
  const { error } = await supabase.from('product_compatibility_assignments').insert(rows);
  if (error) throw error;
}

export async function fetchProductCompatibilities(productId: string): Promise<LookupItem[]> {
  const { data, error } = await supabase
    .from('product_compatibility_assignments').select('compatibility_type_id').eq('product_id', productId);
  if (error) throw error;
  const ids = (data || []).map((r: { compatibility_type_id: string }) => r.compatibility_type_id);
  if (ids.length === 0) return [];

  const { data: types, error: tErr } = await supabase
    .from('compatibility_types').select('*').in('id', ids).order('sort_order', { ascending: true });
  if (tErr) throw tErr;
  return types as LookupItem[];
}

export async function fetchProductCollectionIds(productId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('product_collection_assignments').select('collection_id').eq('product_id', productId);
  if (error) throw error;
  return (data || []).map((r: { collection_id: string }) => r.collection_id);
}

export async function assignProductCollections(productId: string, collectionIds: string[]): Promise<void> {
  await supabase.from('product_collection_assignments').delete().eq('product_id', productId);
  if (collectionIds.length === 0) return;
  const rows = collectionIds.map((collectionId) => ({ product_id: productId, collection_id: collectionId }));
  const { error } = await supabase.from('product_collection_assignments').insert(rows);
  if (error) throw error;
}

// ─── Product Reviews ────────────────────────────────────────

export async function fetchProductReviews(productId: string, statusFilter?: 'approved' | 'rejected' | 'pending'): Promise<ProductReview[]> {
  let query = supabase.from('product_reviews').select('*').eq('product_id', productId).order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductReview[];
}

export async function updateProductReviewStatus(reviewId: string, status: 'approved' | 'rejected' | 'pending'): Promise<void> {
  const { data, error } = await supabase.from('product_reviews').update({ status }).eq('id', reviewId).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Review update failed — no rows affected. Check RLS policies.');
}

export async function deleteProductReview(reviewId: string): Promise<void> {
  const { error } = await supabase.from('product_reviews').delete().eq('id', reviewId);
  if (error) throw error;
}

// ─── Inventory Summary ──────────────────────────────────────

export async function fetchInventorySummary(): Promise<InventoryItem[]> {
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id, name, sku, barcode, price, stock_quantity, min_stock_threshold, continue_selling_when_out_of_stock')
    .order('name', { ascending: true });
  if (pErr) throw pErr;

  const { data: variants, error: vErr } = await supabase
    .from('product_variants')
    .select('id, product_id, option_values, price_override, sku, barcode, stock_quantity');
  if (vErr) throw vErr;

  const items: InventoryItem[] = [];
  const productMap = new Map((products || []).map((p: any) => [p.id, p]));

  const variantsByProduct = new Map<string, any[]>();
  (variants || []).forEach((v: any) => {
    const list = variantsByProduct.get(v.product_id) || [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  });

  for (const [pid, product] of productMap.entries()) {
    const pvariants = variantsByProduct.get(pid);
    if (pvariants && pvariants.length > 0) {
      for (const v of pvariants) {
        const label = (v.option_values || []).map((ov: any) => ov.value).join(' / ');
        items.push({
          product_id: pid,
          product_name: product.name,
          product_sku: product.sku,
          variant_id: v.id,
          variant_label: label || null,
          variant_sku: v.sku,
          stock_quantity: v.stock_quantity ?? 0,
          min_stock_threshold: product.min_stock_threshold ?? 0,
          continue_selling_when_out_of_stock: product.continue_selling_when_out_of_stock ?? false,
          price: v.price_override ?? product.price ?? 0,
          barcode: v.barcode || product.barcode || null,
        });
      }
    } else {
      items.push({
        product_id: pid,
        product_name: product.name,
        product_sku: product.sku,
        variant_id: null,
        variant_label: null,
        variant_sku: null,
        stock_quantity: product.stock_quantity ?? 0,
        min_stock_threshold: product.min_stock_threshold ?? 0,
        continue_selling_when_out_of_stock: product.continue_selling_when_out_of_stock ?? false,
        price: product.price ?? 0,
        barcode: product.barcode || null,
      });
    }
  }
  return items;
}

// ─── Stock Movements (barcode-scan flow) ────────────────────

export interface BarcodeLookupResult {
  kind: 'product' | 'variant';
  product_id: string;
  product_name: string;
  variant_id: string | null;
  variant_label: string | null;
  sku: string | null;
  barcode: string;
  stock_quantity: number;
}

export async function lookupByBarcode(rawBarcode: string): Promise<BarcodeLookupResult | null> {
  const barcode = rawBarcode.trim();
  if (!barcode) return null;

  const { data: variant } = await supabase
    .from('product_variants')
    .select('id, product_id, sku, barcode, stock_quantity, option_values, products!inner(id, name)')
    .eq('barcode', barcode).maybeSingle();

  if (variant) {
    const v = variant as any;
    const label = (v.option_values || []).map((ov: any) => ov.value).join(' / ');
    return {
      kind: 'variant',
      product_id: v.product_id,
      product_name: v.products?.name ?? '',
      variant_id: v.id,
      variant_label: label || null,
      sku: v.sku ?? null,
      barcode: v.barcode,
      stock_quantity: v.stock_quantity ?? 0,
    };
  }

  const { data: product } = await supabase
    .from('products').select('id, name, sku, barcode, stock_quantity').eq('barcode', barcode).maybeSingle();

  if (product) {
    const p = product as any;
    return {
      kind: 'product',
      product_id: p.id,
      product_name: p.name,
      variant_id: null,
      variant_label: null,
      sku: p.sku ?? null,
      barcode: p.barcode,
      stock_quantity: p.stock_quantity ?? 0,
    };
  }
  return null;
}

export interface AdjustStockArgs {
  target: BarcodeLookupResult;
  delta: number;
  movement_type: StockMovementType;
  reason?: string | null;
  source?: StockMovementSource;
}

export async function adjustStock(args: AdjustStockArgs): Promise<StockMovement> {
  const { target, delta, movement_type, reason = null, source = 'scan' } = args;

  let quantity_before = 0;
  if (target.kind === 'variant' && target.variant_id) {
    const { data, error } = await supabase
      .from('product_variants').select('stock_quantity').eq('id', target.variant_id).single();
    if (error) throw error;
    quantity_before = data?.stock_quantity ?? 0;
  } else {
    const { data, error } = await supabase
      .from('products').select('stock_quantity').eq('id', target.product_id).single();
    if (error) throw error;
    quantity_before = data?.stock_quantity ?? 0;
  }

  const quantity_after = Math.max(0, quantity_before + delta);
  const actualDelta = quantity_after - quantity_before;

  if (target.kind === 'variant' && target.variant_id) {
    const { error } = await supabase
      .from('product_variants').update({ stock_quantity: quantity_after }).eq('id', target.variant_id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('products').update({ stock_quantity: quantity_after }).eq('id', target.product_id);
    if (error) throw error;
  }

  // Resolve current user for audit (best-effort)
  let performed_by: string | null = null;
  let performed_by_name: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    performed_by = user?.id ?? null;
    if (user) {
      const { data: appUser } = await supabase
        .from('app_users').select('full_name, email').eq('auth_user_id', user.id).maybeSingle();
      performed_by_name = (appUser as any)?.full_name || (appUser as any)?.email || user.email || null;
    }
  } catch {
    // ignore — audit metadata is best-effort
  }

  const { data: inserted, error: insErr } = await supabase
    .from('stock_movements')
    .insert({
      product_id: target.product_id,
      variant_id: target.variant_id,
      barcode: target.barcode,
      movement_type,
      quantity_delta: actualDelta,
      quantity_before,
      quantity_after,
      reason,
      source,
      performed_by,
      performed_by_name,
    })
    .select().single();

  if (insErr) throw insErr;
  return inserted as StockMovement;
}

export interface FetchStockMovementsOpts {
  productId?: string;
  variantId?: string;
  limit?: number;
}

export async function fetchStockMovements(opts: FetchStockMovementsOpts = {}): Promise<StockMovement[]> {
  let q = supabase
    .from('stock_movements')
    .select('*, products(name), product_variants(option_values)')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 200);

  if (opts.productId) q = q.eq('product_id', opts.productId);
  if (opts.variantId) q = q.eq('variant_id', opts.variantId);

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    product_name: row.products?.name ?? null,
    variant_label: row.product_variants?.option_values
      ? (row.product_variants.option_values as any[]).map((ov: any) => ov.value).join(' / ')
      : null,
  })) as StockMovement[];
}

// ─── Storefront: visible products / slug lookups ────────────

export async function fetchVisibleProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products').select('*').eq('is_visible', true).order('created_at', { ascending: false });
  if (error) throw error;
  const products = data as Product[];

  const { data: variants, error: vErr } = await supabase
    .from('product_variants').select('product_id, option_values, stock_quantity, price_override');
  if (vErr) throw vErr;

  const { data: compatAssignments, error: cErr } = await supabase
    .from('product_compatibility_assignments').select('product_id, compatibility_type_id');
  if (cErr) throw cErr;

  const { data: colAssignments, error: colErr } = await supabase
    .from('product_collection_assignments').select('product_id, collection_id');
  if (colErr) throw colErr;

  const variantsByProduct = new Map<string, any[]>();
  (variants || []).forEach((v: any) => {
    const list = variantsByProduct.get(v.product_id) || [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  });

  const compatByProduct = new Map<string, string[]>();
  (compatAssignments || []).forEach((ca: any) => {
    const list = compatByProduct.get(ca.product_id) || [];
    list.push(ca.compatibility_type_id);
    compatByProduct.set(ca.product_id, list);
  });

  const colByProduct = new Map<string, string[]>();
  (colAssignments || []).forEach((ca: any) => {
    const list = colByProduct.get(ca.product_id) || [];
    list.push(ca.collection_id);
    colByProduct.set(ca.product_id, list);
  });

  return products.map((p) => {
    const pvariants = variantsByProduct.get(p.id);
    let extras: Partial<Product> = {
      compatibilities: (compatByProduct.get(p.id) || []).map(id => ({ id } as any)),
      collections: (colByProduct.get(p.id) || []).map(id => ({ id } as any)),
    };
    if (pvariants && pvariants.length > 0) {
      const prices = pvariants.map((v: any) => v.price_override != null ? Number(v.price_override) : Number(p.price));
      extras.variant_count = pvariants.length;
      extras.variant_price_min = Math.min(...prices);
      extras.variant_price_max = Math.max(...prices);
    }
    return { ...p, ...extras };
  });
}

export async function fetchProductBySlug(slugOrId: string): Promise<Product> {
  const { data: bySlug } = await supabase
    .from('products').select('*').eq('slug', slugOrId).eq('is_visible', true).maybeSingle();
  let baseProduct = bySlug || null;

  if (!baseProduct) {
    const { data: byId, error } = await supabase
      .from('products').select('*').eq('id', slugOrId).eq('is_visible', true).single();
    if (error) throw error;
    baseProduct = byId;
  }

  const { data: variants } = await supabase
    .from('product_variants').select('price_override').eq('product_id', baseProduct.id);

  if (variants && variants.length > 0) {
    const prices = variants.map(v => v.price_override != null ? Number(v.price_override) : Number(baseProduct!.price));
    return {
      ...baseProduct,
      variant_count: variants.length,
      variant_price_min: Math.min(...prices),
      variant_price_max: Math.max(...prices),
    } as Product;
  }
  return baseProduct as Product;
}

export async function fetchCollectionBySlug(slugOrId: string): Promise<Collection> {
  const { data: bySlug } = await supabase.from('collections').select('*').eq('slug', slugOrId).maybeSingle();
  if (bySlug) return bySlug as Collection;

  const { data: byId, error } = await supabase.from('collections').select('*').eq('id', slugOrId).single();
  if (error) throw error;
  return byId as Collection;
}

export async function fetchCollectionProductsBySlugOrId(slugOrId: string): Promise<Product[]> {
  const collection = await fetchCollectionBySlug(slugOrId);
  if (!collection) return [];
  return fetchProductsByCollectionId(collection.id);
}

export async function fetchProductThumbnails(productIds: string[]): Promise<Record<string, string>> {
  if (productIds.length === 0) return {};
  const { data, error } = await supabase
    .from('product_media').select('product_id, media_url, sort_order')
    .in('product_id', productIds).in('media_type', ['image', 'video']).order('sort_order', { ascending: true });
  if (error) throw error;

  const result: Record<string, string> = {};
  (data || []).forEach((m: any) => {
    if (!result[m.product_id]) result[m.product_id] = m.media_url;
  });
  return result;
}

export async function fetchProductsByCollectionId(collectionId: string): Promise<Product[]> {
  const { data: assignments, error: aErr } = await supabase
    .from('product_collection_assignments').select('product_id').eq('collection_id', collectionId);
  if (aErr) throw aErr;
  const ids = (assignments || []).map((a: { product_id: string }) => a.product_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('products').select('*').in('id', ids).eq('is_visible', true).order('name', { ascending: true });
  if (error) throw error;
  const products = data as Product[];

  const { data: variants, error: vErr } = await supabase
    .from('product_variants').select('product_id, option_values, stock_quantity, price_override').in('product_id', ids);
  if (vErr) throw vErr;

  const variantsByProduct = new Map<string, any[]>();
  (variants || []).forEach((v: any) => {
    const list = variantsByProduct.get(v.product_id) || [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  });

  return products.map((p) => {
    const pvariants = variantsByProduct.get(p.id);
    if (pvariants && pvariants.length > 0) {
      const prices = pvariants.map((v: any) => v.price_override as number | null).filter((p): p is number => p != null && p > 0);
      return {
        ...p,
        variant_count: pvariants.length,
        variant_price_min: prices.length > 0 ? Math.min(...prices) : null,
        variant_price_max: prices.length > 0 ? Math.max(...prices) : null,
      };
    }
    return p;
  });
}

// ─── Store Config ───────────────────────────────────────────

export async function fetchStoreConfig(): Promise<StoreConfig> {
  const { data, error } = await supabase.from('store_config').select('*').limit(1).single();
  if (error) throw error;
  return data as StoreConfig;
}

export async function updateStoreConfig(updates: StoreConfigUpdate): Promise<StoreConfig> {
  const config = await fetchStoreConfig();
  const safeUpdates = { ...updates };
  delete (safeUpdates as any).id;
  delete (safeUpdates as any).created_at;
  delete (safeUpdates as any).updated_at;
  const { data, error } = await supabase.from('store_config').update(safeUpdates).eq('id', config.id).select().single();
  if (error) throw error;
  return data as StoreConfig;
}

// ─── Orders ─────────────────────────────────────────────────

export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as Order[];
}

export async function fetchOrder(id: string): Promise<Order> {
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Order;
}

export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('order_items').select('*').eq('order_id', orderId).order('created_at', { ascending: true });
  if (error) throw error;
  const items = data as OrderItem[];

  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
  if (productIds.length === 0) return items;

  const thumbnails = await fetchProductThumbnails(productIds);
  const { data: products } = await supabase
    .from('products').select('id, name, pack_quantity, sku, barcode').in('id', productIds);
  const productMap = new Map((products || []).map((p: any) => [p.id, p]));

  const variantIds = [...new Set(items.map((i) => i.variant_id).filter(Boolean))] as string[];
  let variantMap = new Map<string, any>();
  if (variantIds.length > 0) {
    const { data: variants } = await supabase
      .from('product_variants').select('id, option_values, sku, barcode').in('id', variantIds);
    variantMap = new Map((variants || []).map((v: any) => [v.id, v]));
  }

  return items.map((item) => {
    if (!item.product_id) return item;
    const product = productMap.get(item.product_id);
    if (!product) return item;
    const variant = item.variant_id ? variantMap.get(item.variant_id) : null;
    const variantLabel = variant
      ? (variant.option_values || []).map((ov: any) => ov.value).join(' / ')
      : item.variant_label;
    return {
      ...item,
      product_name: product.name,
      product_image_url: thumbnails[item.product_id] || item.product_image_url,
      sku: variant?.sku || product.sku || item.sku,
      barcode: variant?.barcode || product.barcode || item.barcode || null,
      variant_label: variantLabel,
      pack_quantity: product.pack_quantity ?? 1,
    };
  });
}

export async function fetchOrdersByContact(contactId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });
  if (error) throw error;
  return data as Order[];
}

export async function fetchOrdersByCompany(companyId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
  if (error) throw error;
  return data as Order[];
}

export async function createOrder(order: OrderInsert): Promise<Order> {
  const { data, error } = await supabase.from('orders').insert(order).select().single();
  if (error) throw error;
  return data as Order;
}

export async function createOrderItems(items: OrderItemInsert[]): Promise<OrderItem[]> {
  const { data, error } = await supabase.from('order_items').insert(items).select();
  if (error) throw error;
  return data as OrderItem[];
}

export async function updateOrderStatus(id: string, status: Order['status'], paymentStatus?: Order['payment_status']): Promise<Order> {
  const updates: Record<string, any> = { status };
  if (paymentStatus !== undefined) updates.payment_status = paymentStatus;
  const { data, error } = await supabase.from('orders').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Order;
}

export async function updateOrderTracking(
  id: string,
  trackingNumber: string | null,
  trackingUrl: string | null,
  shippingCarrier: string | null
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ tracking_number: trackingNumber, tracking_url: trackingUrl, shipping_carrier: shippingCarrier })
    .eq('id', id).select().single();
  if (error) throw error;
  return data as Order;
}

// ─── Discount Codes ─────────────────────────────────────────

export async function fetchDiscountCodes(): Promise<DiscountCode[]> {
  const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as DiscountCode[];
}

export async function createDiscountCode(code: DiscountCodeInsert): Promise<DiscountCode> {
  const { data, error } = await supabase.from('discount_codes').insert(code).select().single();
  if (error) throw error;
  return data as DiscountCode;
}

export async function updateDiscountCode(id: string, updates: DiscountCodeUpdate): Promise<DiscountCode> {
  const { data, error } = await supabase.from('discount_codes').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as DiscountCode;
}

export async function deleteDiscountCode(id: string): Promise<void> {
  const { error } = await supabase.from('discount_codes').delete().eq('id', id);
  if (error) throw error;
}

export async function validateDiscountCode(code: string, orderTotal: number): Promise<DiscountCode | null> {
  const { data, error } = await supabase
    .from('discount_codes').select('*').eq('code', code.toUpperCase()).eq('is_active', true).single();
  if (error || !data) return null;
  const dc = data as DiscountCode;
  if (dc.expires_at && new Date(dc.expires_at) < new Date()) return null;
  if (dc.starts_at && new Date(dc.starts_at) > new Date()) return null;
  if (dc.max_uses !== null && dc.current_uses >= dc.max_uses) return null;
  if (orderTotal < dc.min_order_amount) return null;
  return dc;
}

export async function incrementDiscountCodeUsage(id: string): Promise<void> {
  const { data } = await supabase.from('discount_codes').select('current_uses').eq('id', id).single();
  if (data) {
    await supabase.from('discount_codes').update({ current_uses: (data.current_uses || 0) + 1 }).eq('id', id);
  }
}

// ─── Gift Cards ─────────────────────────────────────────────

export async function fetchGiftCards(): Promise<GiftCard[]> {
  const { data, error } = await supabase.from('gift_cards').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as GiftCard[];
}

export async function createGiftCard(card: GiftCardInsert): Promise<GiftCard> {
  const { data, error } = await supabase.from('gift_cards').insert(card).select().single();
  if (error) throw error;
  return data as GiftCard;
}

export async function updateGiftCard(id: string, updates: GiftCardUpdate): Promise<GiftCard> {
  const { data, error } = await supabase.from('gift_cards').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as GiftCard;
}

export async function deleteGiftCard(id: string): Promise<void> {
  const { error } = await supabase.from('gift_cards').delete().eq('id', id);
  if (error) throw error;
}

export async function validateGiftCard(code: string): Promise<GiftCard | null> {
  const { data, error } = await supabase
    .from('gift_cards').select('*').eq('code', code.toUpperCase()).eq('is_active', true).single();
  if (error || !data) return null;
  const gc = data as GiftCard;
  if (gc.expires_at && new Date(gc.expires_at) < new Date()) return null;
  if (gc.current_balance <= 0) return null;
  return gc;
}

export async function deductGiftCardBalance(id: string, amount: number): Promise<void> {
  const { data } = await supabase.from('gift_cards').select('current_balance').eq('id', id).single();
  if (data) {
    const newBalance = Math.max(0, (data.current_balance || 0) - amount);
    await supabase.from('gift_cards').update({ current_balance: newBalance }).eq('id', id);
  }
}

// ─── Shipping ───────────────────────────────────────────────

export async function fetchShippingZones(): Promise<ShippingZone[]> {
  const { data, error } = await supabase.from('shipping_zones').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data as ShippingZone[];
}

export async function createShippingZone(zone: ShippingZoneInsert): Promise<ShippingZone> {
  const { data, error } = await supabase.from('shipping_zones').insert(zone).select().single();
  if (error) throw error;
  return data as ShippingZone;
}

export async function updateShippingZone(id: string, updates: ShippingZoneUpdate): Promise<ShippingZone> {
  const { data, error } = await supabase.from('shipping_zones').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as ShippingZone;
}

export async function deleteShippingZone(id: string): Promise<void> {
  const { error } = await supabase.from('shipping_zones').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchShippingRates(zoneId?: string): Promise<ShippingRate[]> {
  let query = supabase.from('shipping_rates').select('*').order('sort_order', { ascending: true });
  if (zoneId) query = query.eq('zone_id', zoneId);
  const { data, error } = await query;
  if (error) throw error;
  return data as ShippingRate[];
}

export async function createShippingRate(rate: ShippingRateInsert): Promise<ShippingRate> {
  const { data, error } = await supabase.from('shipping_rates').insert(rate).select().single();
  if (error) throw error;
  return data as ShippingRate;
}

export async function updateShippingRate(id: string, updates: ShippingRateUpdate): Promise<ShippingRate> {
  const { data, error } = await supabase.from('shipping_rates').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as ShippingRate;
}

export async function deleteShippingRate(id: string): Promise<void> {
  const { error } = await supabase.from('shipping_rates').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchActiveShippingRates(): Promise<ShippingRate[]> {
  const { data, error } = await supabase
    .from('shipping_rates').select('*').eq('is_active', true).order('sort_order', { ascending: true });
  if (error) throw error;
  return data as ShippingRate[];
}

// ─── Page SEO ───────────────────────────────────────────────

export async function fetchPageSeo(pageKey: string): Promise<PageSeo | null> {
  const { data, error } = await supabase.from('page_seo').select('*').eq('page_key', pageKey).single();
  if (error) return null;
  return data as PageSeo;
}

export async function fetchAllPageSeo(): Promise<PageSeo[]> {
  const { data, error } = await supabase.from('page_seo').select('*').order('page_key', { ascending: true });
  if (error) throw error;
  return data as PageSeo[];
}

export async function upsertPageSeo(pageKey: string, updates: PageSeoUpdate): Promise<PageSeo> {
  const existing = await fetchPageSeo(pageKey);
  if (existing) {
    const { data, error } = await supabase
      .from('page_seo').update(updates).eq('id', existing.id).select().single();
    if (error) throw error;
    return data as PageSeo;
  }
  const { data, error } = await supabase
    .from('page_seo').insert({ page_key: pageKey, ...updates }).select().single();
  if (error) throw error;
  return data as PageSeo;
}

// ─── Store Pages (Page Builder) ─────────────────────────────

export async function fetchStorePages(): Promise<StorePage[]> {
  const { data, error } = await supabase.from('store_pages').select('*').order('page_key', { ascending: true });
  if (error) throw error;
  return data as StorePage[];
}

export async function fetchStorePage(pageKey: string): Promise<StorePage> {
  const { data, error } = await supabase.from('store_pages').select('*').eq('page_key', pageKey).single();
  if (error) throw error;
  return data as StorePage;
}

export async function updateStorePage(id: string, updates: StorePageUpdate): Promise<StorePage> {
  const { data, error } = await supabase
    .from('store_pages').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  return data as StorePage;
}

// ─── Contact lookup/creation for orders ─────────────────────
// NOTE: Depends on a `contacts` table existing in the host project with the columns referenced
// below. If your project has a different shape (e.g. a `customers` table, or no separate
// contacts/companies layer), replace findOrCreateContact accordingly. The storefront checkout
// calls it once to attach a contact_id to each new order.

export async function findOrCreateContact(
  email: string,
  name: string,
  phone?: string
): Promise<any> {
  const { data: existing } = await supabase
    .from('contacts').select('*, company:companies(*)').eq('email', email).limit(1);
  if (existing && existing.length > 0) return existing[0];

  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const { data, error } = await supabase
    .from('contacts').insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      contact_type: 'Customer',
      source: 'Online Store',
      unsubscribed: false,
    }).select().single();
  if (error) throw error;
  return data;
}

// ─── Stripe Settings + Inventory Helpers ────────────────────

export async function getStripePublishableKey(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_stripe_publishable_key');
  if (error) {
    console.error('Error fetching publishable key:', error);
    return null;
  }
  return data as string | null;
}

// Same logic as the stripe-webhook helper, exposed for manual inventory deduction
// (e.g. a "mark paid" admin action that bypasses the webhook).
export async function deductInventoryForOrder(orderId: string): Promise<void> {
  const { data: items, error } = await supabase
    .from('order_items').select('product_id, variant_id, quantity').eq('order_id', orderId);
  if (error || !items) return;

  for (const item of items) {
    if (item.variant_id) {
      const { data: variant } = await supabase
        .from('product_variants').select('stock_quantity').eq('id', item.variant_id).single();
      if (variant) {
        await supabase
          .from('product_variants')
          .update({ stock_quantity: Math.max(0, (variant.stock_quantity || 0) - item.quantity) })
          .eq('id', item.variant_id);
      }
    } else if (item.product_id) {
      const { data: product } = await supabase
        .from('products').select('stock_quantity').eq('id', item.product_id).single();
      if (product) {
        await supabase
          .from('products')
          .update({ stock_quantity: Math.max(0, (product.stock_quantity || 0) - item.quantity) })
          .eq('id', item.product_id);
      }
    }
  }
}
