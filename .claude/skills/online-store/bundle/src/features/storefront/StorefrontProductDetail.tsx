import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sfPath } from './storefrontPaths';
import { useStoreConfig } from './useStoreConfig';
import { useCart } from './useCart';
import { supabase } from '@/lib/supabase';
import * as api from '@/lib/api';
import type { Product, ProductMedia, ProductOptionGroup, ProductVariant, LookupItem, ProductReview } from '@/types/database';
import { trackEcommerceEvent } from '@/hooks/useTracking';
import { Star } from 'lucide-react';

export function StorefrontProductDetail({ previewSlug }: { previewSlug?: string } = {}) {
  const params = useParams<{ slug: string }>();
  const slug = previewSlug || params.slug;
  const { formatPrice, config } = useStoreConfig();
  const { addItem } = useCart();
  const tpl = config?.page_templates?.product_detail || {};

  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductMedia[]>([]);
  const [options, setOptions] = useState<ProductOptionGroup[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [compatibilities, setCompatibilities] = useState<LookupItem[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [relatedThumbs, setRelatedThumbs] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Review form state
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [addedMsg, setAddedMsg] = useState(false);

  // Scroll to top when navigating to a new product (e.g. via related products)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      try {
        let fetchSlug = slug;
        if (slug === 'preview') {
          // Fetch the most recent visible product for the preview
          const { data: prods } = await supabase.from('products').select('id, slug').eq('is_visible', true).order('created_at', { ascending: false }).limit(1);
          if (prods && prods.length > 0) {
            fetchSlug = prods[0].slug || prods[0].id;
          } else {
            // Fallback mock data if the database is literally empty
            setProduct({
              id: 'preview', name: 'Premium Laser Cutting Head', slug: 'preview', product_type: 'physical', sku: 'ISOBEX-HEAD-01',
              description: 'Advanced auto-focus laser cutting head designed for high-precision industrial applications. Features integrated water cooling and debris protection.',
              price: 1299.00, compare_at_price: 1499.00, is_visible: true, created_at: '', updated_at: '',
              min_stock_threshold: 5, stock_quantity: 10, continue_selling_when_out_of_stock: true, pack_quantity: 1, weight_kg: 2.5, barcode: null
            });
            setImages([{ id: 'img1', product_id: 'preview', media_url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=800', media_type: 'image', file_name: null, sort_order: 1, created_at: '' }]);
            setOptions([{ id: 'opt1', product_id: 'preview', name: 'Power Rating', sort_order: 1, values: [{ id: 'val1', option_group_id: 'opt1', value: '3.3KW', sort_order: 1 }, { id: 'val2', option_group_id: 'opt1', value: '6.0KW', sort_order: 2 }] }]);
            setVariants([{ id: 'var1', product_id: 'preview', sku: 'ISOBEX-HEAD-33', price_override: null, compare_at_price: null, stock_quantity: 10, option_values: [{ group_id: 'opt1', group_name: 'Power Rating', value_id: 'val1', value: '3.3KW' }], created_at: '', barcode: null }]);
            setCompatibilities([{ id: 'c1', name: 'BM111 Series', sort_order: 1, created_at: '' }]);
            setSelectedOptions({ opt1: 'val1' });
            setLoading(false);
            return;
          }
        }

        const p = await api.fetchProductBySlug(fetchSlug);
        setProduct(p);

        if (slug !== 'preview') {
          trackEcommerceEvent('view_item', {
            product_id: p.id,
            value: p.price
          });
        }

        const [imgs, opts, vars, compat] = await Promise.all([
          api.fetchProductImages(p.id),
          api.fetchProductOptions(p.id),
          api.fetchProductVariants(p.id),
          api.fetchProductCompatibilities(p.id),
        ]);
        setImages(imgs);
        setOptions(opts);
        setVariants(vars);
        setCompatibilities(compat);

        // Fetch related products
        const allProds = await api.fetchProducts();
        const available = allProds.filter(x => x.is_visible && x.id !== p.id);
        const shuffled = available.sort(() => 0.5 - Math.random());
        const selectedRelated = shuffled.slice(0, 4);
        setRelatedProducts(selectedRelated);
        const rThumbs = await api.fetchProductThumbnails(selectedRelated.map(r => r.id));
        setRelatedThumbs(rThumbs);

        // Fetch reviews
        if (slug !== 'preview') {
          const { data: revs } = await supabase
            .from('product_reviews')
            .select('*')
            .eq('product_id', p.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false });
          if (revs) setReviews(revs as ProductReview[]);
        }

        // Pre-select first option value
        const defaults: Record<string, string> = {};
        opts.forEach((group) => {
          if (group.values && group.values.length > 0) {
            defaults[group.name] = group.values[0].value;
          }
        });
        setSelectedOptions(defaults);
      } catch (err) {
        console.error('Failed to load product:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  // Find matching variant based on selected options
  const matchingVariant = variants.find((v) => {
    return v.option_values.every(
      (ov) => selectedOptions[ov.group_name] === ov.value
    );
  });

  const effectivePrice = matchingVariant?.price_override ?? product?.price ?? 0;
  const effectiveCompare = matchingVariant?.compare_at_price ?? product?.compare_at_price ?? null;

  const handleAddToCart = () => {
    if (!product) return;

    const variantLabel = matchingVariant
      ? matchingVariant.option_values.map((ov) => `${ov.group_name}: ${ov.value}`).join(' / ')
      : null;

    addItem({
      productId: product.id,
      variantId: matchingVariant?.id || null,
      name: product.name,
      variantLabel,
      price: effectivePrice,
      compareAtPrice: effectiveCompare,
      quantity,
      imageUrl: images[0]?.media_url || null,
      weightKg: product.weight_kg || 0,
      sku: matchingVariant?.sku || product.sku || null,
      barcode: matchingVariant?.barcode || product.barcode || null,
      slug: product.slug || product.id,
    });

    trackEcommerceEvent('add_to_cart', {
      product_id: product.id,
      variant_id: matchingVariant?.id || undefined,
      value: effectivePrice * quantity,
    });

    setAddedMsg(true);
    setTimeout(() => setAddedMsg(false), 2000);
  };

  // Template config values with defaults
  const imagePosition = tpl.imagePosition || 'left';
  const showDescription = tpl.showDescription !== false;
  const showSku = tpl.showSku !== false;
  const showCompatibility = tpl.showCompatibility !== false;
  const showRelatedProducts = tpl.showRelatedProducts !== false;
  const relatedProductsTitle = tpl.relatedProductsTitle || 'You may also like';
  const showReviews = tpl.showReviews !== false;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || slug === 'preview' || !reviewName.trim() || !reviewText.trim()) return;
    setSubmittingReview(true);
    try {
      const { error } = await supabase.from('product_reviews').insert({
        product_id: product.id,
        author_name: reviewName,
        rating: reviewRating,
        content: reviewText,
        status: 'pending'
      });
      if (!error) {
        setReviewSuccess(true);
        // Optimistically add to UI
        const newReview: ProductReview = {
          id: Math.random().toString(),
          product_id: product.id,
          author_name: reviewName,
          rating: reviewRating,
          content: reviewText,
          status: 'approved',
          created_at: new Date().toISOString()
        };
        setReviews([newReview, ...reviews]);
        
        // Reset form
        setReviewName('');
        setReviewText('');
        setReviewRating(5);
        setTimeout(() => setReviewSuccess(false), 5000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReview(false);
    }
  };
  
  const titleFontSize = tpl.titleFontSize || 32;
  const titleColor = tpl.titleColor || '';
  const priceColor = tpl.priceColor || '';
  const descriptionFontSize = tpl.descriptionFontSize || 16;
  const descriptionColor = tpl.descriptionColor || '';
  
  const inputLabelColor = tpl.inputLabelColor || '';
  const inputBgColor = tpl.inputBgColor || '';
  const inputTextColor = tpl.inputTextColor || '';
  const inputBorderColor = tpl.inputBorderColor || '';
  const inputRadius = tpl.inputRadius ?? 8;

  const buttonBgColor = tpl.buttonBgColor || '';
  const buttonTextColor = tpl.buttonTextColor || '#ffffff';
  const buttonRadius = tpl.buttonRadius ?? 12;
  const buttonText = tpl.buttonText || 'Add to Cart';

  if (loading) return <div className="sf-loading">Loading product...</div>;
  if (!product) return <div className="sf-loading">Product not found.</div>;

  return (
    <div
      className="sf-product-detail"
      style={imagePosition === 'right' ? { direction: 'rtl' } : undefined}
    >
      {/* Gallery */}
      <div className="sf-gallery" style={imagePosition === 'right' ? { direction: 'ltr' } : undefined}>
        {images.length > 0 ? (
          <>
            <img
              src={images[selectedImage]?.media_url}
              alt={product.name}
              className="sf-gallery-main"
            />
            {images.length > 1 && (
              <div className="sf-gallery-thumbs">
                {images.map((img, i) => (
                  <img
                    key={img.id}
                    src={img.media_url}
                    alt={`${product.name} ${i + 1}`}
                    className={`sf-gallery-thumb ${i === selectedImage ? 'active' : ''}`}
                    onClick={() => setSelectedImage(i)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="sf-gallery-main-placeholder">No images uploaded</div>
        )}
      </div>

      {/* Product Info */}
      <div className="sf-product-info" style={{
        ...((imagePosition === 'right' ? { direction: 'ltr' as const } : {})),
        '--local-input-bg': inputBgColor || 'var(--sf-surface)',
        '--local-input-text': inputTextColor || 'var(--sf-text)',
        '--local-input-border': inputBorderColor || 'rgba(0,0,0,0.1)',
        '--local-input-radius': `${inputRadius}px`,
        '--local-label-color': inputLabelColor || 'var(--sf-text)',
      } as React.CSSProperties}>
        <h1 style={{ fontSize: `${titleFontSize}px`, color: titleColor || undefined }}>{product.name}</h1>

        <div
          className="sf-product-price"
          style={priceColor ? { color: priceColor } : undefined}
        >
          {formatPrice(effectivePrice)}
          {effectiveCompare && effectiveCompare > effectivePrice && (
            <span className="compare">{formatPrice(effectiveCompare)}</span>
          )}
        </div>

        {showDescription && product.description && (
          <div className="sf-product-description" style={{ fontSize: `${descriptionFontSize}px`, color: descriptionColor || undefined }}>
            {product.description}
          </div>
        )}

        {showCompatibility && compatibilities.length > 0 && (
          <div className="sf-compat-tags">
            <span className="sf-compat-label">Compatible with:</span>
            {compatibilities.map((c) => (
              <span key={c.id} className="sf-compat-badge">{c.name}</span>
            ))}
          </div>
        )}

        {/* Variant selectors */}
        {options.length > 0 && (
          <div className="sf-variant-selector">
            {options.map((group) => (
              <div className="sf-variant-group" key={group.id}>
                <label>{group.name}</label>
                <select
                  value={selectedOptions[group.name] || ''}
                  onChange={(e) =>
                    setSelectedOptions((prev) => ({ ...prev, [group.name]: e.target.value }))
                  }
                >
                  {(group.values || []).map((val) => (
                    <option key={val.id} value={val.value}>{val.value}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* Quantity */}
        <div className="sf-qty-row">
          <label>Quantity</label>
          <input
            type="number"
            className="sf-qty-input"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            min="1"
          />
        </div>

        {/* Add to cart */}
        <button
          className="sf-add-to-cart-btn"
          onClick={handleAddToCart}
          style={{
            ...(buttonBgColor ? { background: buttonBgColor } : {}),
            color: buttonTextColor,
            borderRadius: `${buttonRadius}px`,
          }}
        >
          {addedMsg ? '✓ Added to Cart!' : buttonText}
        </button>

        {/* SKU */}
        {showSku && (matchingVariant?.sku || product.sku) && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--sf-text-secondary)' }}>
            SKU: {matchingVariant?.sku || product.sku}
          </p>
        )}
      </div>

      {/* Customer Reviews Section */}
      {showReviews && (
        <div className="sf-reviews-section" style={{ gridColumn: '1 / -1', marginTop: '4rem', paddingTop: '4rem', borderTop: '1px solid var(--sf-border, rgba(0,0,0,0.1))' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '2rem', color: titleColor || undefined }}>Customer Reviews</h2>
          
          <div className="sf-reviews-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem' }}>
            {/* Reviews List */}
            <div>
              {reviews.length === 0 ? (
                <p style={{ color: 'var(--sf-text-secondary)' }}>No reviews yet. Be the first to review this product!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {reviews.map(review => (
                    <div key={review.id} style={{ background: 'var(--sf-surface)', padding: '1.5rem', borderRadius: 'var(--sf-radius-lg)', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong style={{ color: 'var(--sf-text)' }}>{review.author_name}</strong>
                        <span style={{ fontSize: '0.875rem', color: 'var(--sf-text-secondary)' }}>{new Date(review.created_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', color: '#fbbf24' }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={16} fill={i < review.rating ? 'currentColor' : 'transparent'} stroke="currentColor" />
                        ))}
                      </div>
                      <p style={{ color: 'var(--sf-text-secondary)', lineHeight: 1.6, margin: 0 }}>{review.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Write Review Form */}
            <div>
              <div style={{ background: 'var(--sf-surface)', padding: '2rem', borderRadius: 'var(--sf-radius-lg)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--sf-text)' }}>Write a Review</h3>
                
                {reviewSuccess ? (
                  <div style={{ padding: '1rem', background: '#dcfce7', color: '#166534', borderRadius: 'var(--sf-radius-md)', fontWeight: 600 }}>
                    Thank you! Your review has been submitted.
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Rating</label>
                      <div style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', color: '#fbbf24' }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            size={24} 
                            fill={i < reviewRating ? 'currentColor' : 'transparent'} 
                            stroke="currentColor"
                            onClick={() => setReviewRating(i + 1)}
                            style={{ transition: 'transform 0.1s' }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--local-label-color, var(--sf-text))' }}>Your Name</label>
                      <input 
                        type="text" 
                        required 
                        value={reviewName} 
                        onChange={(e) => setReviewName(e.target.value)}
                        className="sf-qty-input"
                        style={{ width: '100%', maxWidth: '100%', textAlign: 'left', fontWeight: 500, background: '#ffffff', color: '#000000' }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--local-label-color, var(--sf-text))' }}>Your Review</label>
                      <textarea 
                        required 
                        rows={4} 
                        value={reviewText} 
                        onChange={(e) => setReviewText(e.target.value)}
                        className="sf-qty-input"
                        style={{ width: '100%', maxWidth: '100%', resize: 'vertical', minHeight: '120px', fontWeight: 500, fontFamily: 'inherit', background: '#ffffff', color: '#000000' }} 
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={submittingReview}
                      style={{ 
                        padding: '1rem', 
                        background: buttonBgColor || 'var(--sf-primary)', 
                        color: buttonTextColor || '#fff', 
                        borderRadius: `${buttonRadius}px` || 'var(--sf-radius-md)', 
                        border: 'none', 
                        fontWeight: 700, 
                        cursor: submittingReview ? 'not-allowed' : 'pointer',
                        opacity: submittingReview ? 0.7 : 1
                      }}
                    >
                      {submittingReview ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Related Products Section */}
      {showRelatedProducts && relatedProducts.length > 0 && (
        <div className="sf-related-products" style={{ gridColumn: '1 / -1', marginTop: '6rem', paddingTop: '4rem', borderTop: '1px solid var(--sf-border, rgba(0,0,0,0.1))' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '3rem', color: titleColor || undefined, textAlign: 'center', letterSpacing: '-0.02em' }}>{relatedProductsTitle}</h2>
          <div className="sf-related-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
            {relatedProducts.map(p => (
              <Link to={sfPath(`/products/${p.slug || p.id}`)} key={p.id} className="sf-related-product-card">
                <div className="sf-related-product-image">
                  {relatedThumbs[p.id] ? (
                    <img src={relatedThumbs[p.id]} alt={p.name} />
                  ) : (
                    <div className="sf-product-no-image">No Image</div>
                  )}
                  <div className="sf-related-product-overlay">
                    <span className="sf-related-product-btn">View Product</span>
                  </div>
                </div>
                <div className="sf-related-product-info">
                  <h3>{p.name}</h3>
                  <div className="sf-related-product-price">
                    {formatPrice(p.variant_price_min || p.price)}
                    {p.compare_at_price && p.compare_at_price > (p.variant_price_min || p.price) && (
                      <span className="compare">{formatPrice(p.compare_at_price)}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
