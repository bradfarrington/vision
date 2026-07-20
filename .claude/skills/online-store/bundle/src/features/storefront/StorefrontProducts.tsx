import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sfPath } from './storefrontPaths';
import { useStoreConfig } from './useStoreConfig';
import * as api from '@/lib/api';
import type { Product, Collection, LookupItem } from '@/types/database';
import { X, SlidersHorizontal } from 'lucide-react';

const ASPECT_MAP = { square: '1/1', portrait: '3/4', landscape: '4/3' } as const;

export function StorefrontProducts() {
  const { formatPrice, config } = useStoreConfig();
  const tpl = config?.page_templates?.products || {};

  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [compatibilities, setCompatibilities] = useState<LookupItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  const [sortBy] = useState<string>('newest');
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [selectedComps, setSelectedComps] = useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [prods, cols, comps] = await Promise.all([
          api.fetchVisibleProducts(),
          api.fetchCollections(),
          api.fetchLookup('compatibility_types')
        ]);
        setProducts(prods);
        setCollections(cols);
        setCompatibilities(comps);
        const thumbs = await api.fetchProductThumbnails(prods.map((p) => p.id));
        setThumbnails(thumbs);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredProducts = products.filter(p => {
    let colMatch = true;
    let compMatch = true;
    if (selectedCols.length > 0) {
      colMatch = p.collections?.some(c => selectedCols.includes(c.id)) ?? false;
    }
    if (selectedComps.length > 0) {
      compMatch = p.compatibilities?.some(c => selectedComps.includes(c.id)) ?? false;
    }
    return colMatch && compMatch;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return (a.price || 0) - (b.price || 0);
      case 'price-high':
        return (b.price || 0) - (a.price || 0);
      case 'name-az':
        return a.name.localeCompare(b.name);
      case 'name-za':
        return b.name.localeCompare(a.name);
      case 'newest':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const getProductPrice = (product: Product) => {
    if (product.variant_price_min != null && product.variant_price_min > 0) {
      if (product.variant_price_max != null && product.variant_price_max !== product.variant_price_min) {
        return `${formatPrice(product.variant_price_min)} – ${formatPrice(product.variant_price_max)}`;
      }
      return formatPrice(product.variant_price_min);
    }
    return formatPrice(product.price);
  };

  const toggleCol = (id: string) => {
    setSelectedCols(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleComp = (id: string) => {
    setSelectedComps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Template config values with defaults
  const columns = tpl.columns || 3;
  const cardBgColor = tpl.cardBgColor || '#000000';
  const cardTextColor = tpl.cardTextColor || '#ffffff';
  const cardRadius = tpl.cardRadius ?? 16;
  const imageAspect = tpl.imageAspect || 'square';
  const showPrice = tpl.showPrice !== false;
  const showComparePrice = tpl.showComparePrice !== false;
  const priceColor = tpl.priceColor || '';

  const pageTitle = tpl.pageTitle || 'All Products';
  const pageSubtitle = tpl.pageSubtitle || 'Browse our complete range of products';
  const titleAlign = tpl.titleAlign || 'left';
  const titleColor = tpl.titleColor || '#111827';
  const subtitleColor = tpl.subtitleColor || '#4b5563';
  const titleSize = tpl.titleSize || 'large';
  
  const showSidebar = tpl.showSidebar === true;
  const sidebarPosition = tpl.sidebarPosition || 'left';
  const enableCategoryFilter = tpl.enableCategoryFilter === true;
  const enableCompatibilityFilter = tpl.enableCompatibilityFilter === true;
  const hasFilters = (enableCategoryFilter && collections.length > 0) || (enableCompatibilityFilter && compatibilities.length > 0);
  const activeFilterCount = selectedCols.length + selectedComps.length;

  if (loading) {
    return <div className="sf-loading">Loading products...</div>;
  }

  const renderSidebar = () => (
    <aside className={`sf-products-sidebar ${mobileFiltersOpen ? 'open' : ''}`}>
      <div className="sf-sidebar-header-mobile">
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Filters</h3>
        <button className="sf-sidebar-close" onClick={() => setMobileFiltersOpen(false)}>
          <X size={20} />
        </button>
      </div>
      
      {enableCategoryFilter && collections.length > 0 && (
        <div className="sf-filter-group">
          <h4 className="sf-filter-title">Categories</h4>
          <div className="sf-filter-options">
            {collections.map(c => (
              <label key={c.id} className="sf-filter-label">
                <input 
                  type="checkbox" 
                  checked={selectedCols.includes(c.id)}
                  onChange={() => toggleCol(c.id)}
                  className="sf-filter-checkbox"
                />
                <span className="sf-filter-custom"></span>
                <span className="sf-filter-text">{c.name}</span>
                <span className="sf-filter-count">({c.product_count || 0})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {enableCompatibilityFilter && compatibilities.length > 0 && (
        <div className="sf-filter-group">
          <h4 className="sf-filter-title">Compatible With</h4>
          <div className="sf-filter-options">
            {compatibilities.map(c => (
              <label key={c.id} className="sf-filter-label">
                <input 
                  type="checkbox" 
                  checked={selectedComps.includes(c.id)}
                  onChange={() => toggleComp(c.id)}
                  className="sf-filter-checkbox"
                />
                <span className="sf-filter-custom"></span>
                {c.color && <span className="sf-filter-color-dot" style={{ backgroundColor: c.color }} />}
                <span className="sf-filter-text">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <div className={`sf-products-page ${showSidebar ? `has-sidebar sidebar-${sidebarPosition}` : ''}`}>
      <div className="sf-page-header" style={{ textAlign: titleAlign as any, marginBottom: '2.5rem' }}>
        <h1 style={{ 
          color: titleColor, 
          fontSize: titleSize === 'xlarge' ? '3rem' : titleSize === 'large' ? '2.25rem' : titleSize === 'medium' ? '1.75rem' : '1.25rem',
          fontFamily: 'var(--sf-font-heading)',
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: '0.75rem'
        }}>{pageTitle}</h1>
        {pageSubtitle && (
          <p style={{ 
            color: subtitleColor,
            fontSize: titleSize === 'xlarge' ? '1.25rem' : titleSize === 'large' ? '1.125rem' : '1rem',
            margin: 0
          }}>{pageSubtitle}</p>
        )}
      </div>

      <div className="sf-products-layout">
        {showSidebar && sidebarPosition === 'left' && renderSidebar()}
        
        <div className="sf-products-main">
          {/* Mobile filter button — shows only on mobile when filters are available */}
          {hasFilters && (
            <button className="sf-mobile-filter-btn" onClick={() => setMobileFiltersOpen(true)}>
              <SlidersHorizontal size={16} />
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
          )}
          <div
            className="sf-product-grid"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {sortedProducts.map((product) => (
              <Link
                key={product.id}
                to={sfPath(`/products/${product.slug || product.id}`)}
                className="sf-product-card modern"
                style={{
                  borderRadius: `${cardRadius}px`,
                  overflow: 'hidden',
                }}
              >
                <div className="sf-product-card-image-wrap" style={{ aspectRatio: ASPECT_MAP[imageAspect] }}>
                  {thumbnails[product.id] ? (
                    <img
                      src={thumbnails[product.id]}
                      alt={product.name}
                      className="sf-product-card-image"
                    />
                  ) : (
                    <div className="sf-product-card-placeholder">
                      No Image
                    </div>
                  )}
                </div>
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
                      {showComparePrice && product.compare_at_price && product.compare_at_price > product.price && (
                        <span className="sf-product-card-compare">
                          {formatPrice(product.compare_at_price)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {!loading && filteredProducts.length === 0 && (
            <div className="sf-loading">No products match your filters.</div>
          )}
        </div>

        {showSidebar && sidebarPosition === 'right' && renderSidebar()}
      </div>

      {/* Mobile-only: render sidebar + overlay even if showSidebar is off, when filters exist */}
      {!showSidebar && hasFilters && renderSidebar()}
      
      {mobileFiltersOpen && (
        <div className="sf-sidebar-overlay" onClick={() => setMobileFiltersOpen(false)} />
      )}
    </div>
  );
}
