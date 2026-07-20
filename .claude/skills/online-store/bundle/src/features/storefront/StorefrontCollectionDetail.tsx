import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sfPath } from './storefrontPaths';
import { useStoreConfig } from './useStoreConfig';
import { supabase } from '@/lib/supabase';
import * as api from '@/lib/api';
import type { Product, Collection } from '@/types/database';

const ASPECT_MAP = { square: '1/1', portrait: '3/4', landscape: '4/3' } as const;

export function StorefrontCollectionDetail({ previewSlug }: { previewSlug?: string } = {}) {
  const params = useParams<{ slug: string }>();
  const slug = previewSlug || params.slug;
  const { formatPrice, config } = useStoreConfig();
  const tpl = config?.page_templates?.collection_detail || {};

  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      try {
        let fetchSlug = slug;
        if (slug === 'preview') {
          // Fetch the first collection for preview
          const { data: cols } = await supabase.from('collections').select('id, slug').order('created_at', { ascending: false }).limit(1);
          if (cols && cols.length > 0) {
            fetchSlug = cols[0].slug || cols[0].id;
          } else {
            // Mock data for builder template editing
            setCollection({
              id: 'preview', name: 'Sample Collection', slug: 'preview', description: 'Curated products for industrial applications.',
              cover_image_url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=800',
              sort_order: 1, created_at: '', updated_at: '', product_count: 5
            });
            setProducts([
              {
                id: 'prod1', name: 'Laser Focusing Lens', slug: 'lens', product_type: 'physical', sku: 'LNS-01',
                description: '', price: 150.00, compare_at_price: null, is_visible: true, created_at: '', updated_at: '',
                min_stock_threshold: 5, stock_quantity: 50, continue_selling_when_out_of_stock: true, pack_quantity: 1, weight_kg: 0.2, barcode: null
              }
            ]);
            setThumbnails({ prod1: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=800' });
            setLoading(false);
            return;
          }
        }

        const col = await api.fetchCollectionBySlug(fetchSlug);
        setCollection(col);
        const prods = await api.fetchProductsByCollectionId(col.id);
        setProducts(prods);
        const thumbs = await api.fetchProductThumbnails(prods.map((p) => p.id));
        setThumbnails(thumbs);
      } catch (err) {
        console.error('Failed to load collection:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const getProductPrice = (product: Product) => {
    if (product.variant_price_min != null && product.variant_price_min > 0) {
      if (product.variant_price_max != null && product.variant_price_max !== product.variant_price_min) {
        return `${formatPrice(product.variant_price_min)} – ${formatPrice(product.variant_price_max)}`;
      }
      return formatPrice(product.variant_price_min);
    }
    return formatPrice(product.price);
  };

  // Template config values with defaults
  const columns = tpl.columns || 3;
  const cardBgColor = tpl.cardBgColor || '#000000';
  const cardTextColor = tpl.cardTextColor || '#ffffff';
  const cardRadius = tpl.cardRadius ?? 16;
  const imageAspect = tpl.imageAspect || 'square';
  const showPrice = tpl.showPrice !== false;
  const priceColor = tpl.priceColor || '';

  if (loading) return <div className="sf-loading">Loading...</div>;
  if (!collection) return <div className="sf-loading">Collection not found.</div>;

  return (
    <div>
      <div className="sf-page-header">
        <h1>{collection.name}</h1>
        {collection.description && <p>{collection.description}</p>}
      </div>

      <div className="sf-toolbar">
        <span className="sf-result-count">{products.length} products</span>
      </div>

      <div
        className="sf-product-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {products.map((product) => (
          <Link
            key={product.id}
            to={sfPath(`/products/${product.slug || product.id}`)}
            className="sf-product-card"
            style={{
              borderRadius: `${cardRadius}px`,
              overflow: 'hidden',
            }}
          >
            {thumbnails[product.id] ? (
              <img
                src={thumbnails[product.id]}
                alt={product.name}
                className="sf-product-card-image"
                style={{ aspectRatio: ASPECT_MAP[imageAspect] }}
              />
            ) : (
              <div
                className="sf-product-card-placeholder"
                style={{ aspectRatio: ASPECT_MAP[imageAspect] }}
              >
                No Image
              </div>
            )}
            <div
              className="sf-product-card-info"
              style={{
                backgroundColor: cardBgColor,
                color: cardTextColor,
              }}
            >
              <div className="sf-product-card-name" style={{ color: cardTextColor }}>
                {product.name}
              </div>
              {showPrice && (
                <div
                  className="sf-product-card-price"
                  style={priceColor ? { color: priceColor } : undefined}
                >
                  {getProductPrice(product)}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {products.length === 0 && (
        <div className="sf-loading">No products in this collection yet.</div>
      )}
    </div>
  );
}
