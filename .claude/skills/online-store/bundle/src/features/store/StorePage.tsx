import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { StoreTabBar } from './StoreTabBar';
import { useData } from '@/context/DataContext';
import * as api from '@/lib/api';
import type { Product } from '@/types/database';
import { Plus, Search, Eye, EyeOff, Package, ChevronUp, ChevronDown } from 'lucide-react';
import './StorePage.css';

type ProductSortColumn = 'name' | 'type' | 'pack_quantity' | 'price' | 'stock';
type SortDir = 'asc' | 'desc';

export function StorePage() {
  const navigate = useNavigate();
  const { state } = useData();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [labelAssignments, setLabelAssignments] = useState<Record<string, string[]>>({});
  const [tooltipProduct, setTooltipProduct] = useState<Product | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [sortColumn, setSortColumn] = useState<ProductSortColumn | null>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await api.fetchProducts();
      setProducts(data);

      // Fetch label assignments for all products
      const assignments: Record<string, string[]> = {};
      await Promise.all(
        data.map(async (p) => {
          assignments[p.id] = await api.fetchProductLabelIds(p.id);
        })
      );
      setLabelAssignments(assignments);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = async (product: Product) => {
    try {
      const updated = await api.updateProduct(product.id, {
        is_visible: !product.is_visible,
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
    }
  };

  const filtered = useMemo(() => {
    let list = products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
    );

    if (sortColumn) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sortColumn) {
          case 'name':
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case 'type':
            aVal = a.product_type;
            bVal = b.product_type;
            break;
          case 'pack_quantity':
            aVal = a.pack_quantity ?? 1;
            bVal = b.pack_quantity ?? 1;
            break;
          case 'price':
            aVal = a.variant_price_min ?? a.price;
            bVal = b.variant_price_min ?? b.price;
            break;
          case 'stock': {
            const aHas = a.variant_count && a.variant_count > 0;
            const bHas = b.variant_count && b.variant_count > 0;
            aVal = aHas ? (a.total_variant_stock ?? 0) : a.stock_quantity;
            bVal = bHas ? (b.total_variant_stock ?? 0) : b.stock_quantity;
            break;
          }
        }
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }

    return list;
  }, [products, search, sortColumn, sortDir]);

  const handleSort = useCallback((col: ProductSortColumn, dir: SortDir) => {
    if (sortColumn === col && sortDir === dir) {
      setSortColumn(null);
      setSortDir('asc');
    } else {
      setSortColumn(col);
      setSortDir(dir);
    }
  }, [sortColumn, sortDir]);

  const SortHeader = ({ col, label }: { col: ProductSortColumn; label: string }) => (
    <th className="sortable-th">
      {label}
      <span className="sort-arrows">
        <button
          className={`sort-arrow-btn ${sortColumn === col && sortDir === 'asc' ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); handleSort(col, 'asc'); }}
          title={`Sort ${label} ascending`}
        >
          <ChevronUp size={12} />
        </button>
        <button
          className={`sort-arrow-btn ${sortColumn === col && sortDir === 'desc' ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); handleSort(col, 'desc'); }}
          title={`Sort ${label} descending`}
        >
          <ChevronDown size={12} />
        </button>
      </span>
    </th>
  );

  const getLabelsForProduct = (productId: string) => {
    const ids = labelAssignments[productId] || [];
    return state.productLabels.filter((l) => ids.includes(l.id));
  };

  const formatPrice = (price: number) =>
    `£${Number(price).toFixed(2)}`;

  const showTooltip = (e: React.MouseEvent, product: Product) => {
    // Immediately cancel any pending hide so we never flash null between rows
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = undefined;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    // Update position first, then product, to avoid showing the old tooltip at the new position
    setTooltipPos({ top: rect.top, left: rect.left });
    setTooltipProduct(product);
  };

  // Tooltip now removed via click on backdrop/row

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const effectiveStockFor = (product: Product) => {
    const hasVariants = product.variant_count && product.variant_count > 0;
    return hasVariants ? (product.total_variant_stock ?? 0) : product.stock_quantity;
  };

  return (
    <PageShell
      title="Online Store"
      subtitle="Manage your ecommerce products, categories, and storefront."
    >
      <StoreTabBar />

      <div className="store-toolbar">
        <div className="store-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/store/new')}>
          <Plus size={16} />
          <span>Add Product</span>
        </button>
      </div>

      {loading ? (
        <div className="store-loading">Loading products...</div>
      ) : filtered.length === 0 ? (
        <div className="store-empty">
          <Package size={48} />
          <h3>{search ? 'No products match your search' : 'No products yet'}</h3>
          <p>
            {search
              ? 'Try a different search term.'
              : 'Click "Add Product" to create your first product.'}
          </p>
        </div>
      ) : (
        <div className="products-table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <SortHeader col="name" label="Product" />
                <SortHeader col="type" label="Type" />
                <SortHeader col="pack_quantity" label="Pack Qty" />
                <SortHeader col="price" label="Price" />
                <SortHeader col="stock" label="Stock" />
                <th>Labels</th>
                <th>Visible</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const labels = getLabelsForProduct(product.id);
                const hasVariants = product.variant_count && product.variant_count > 0;
                const effectiveStock = effectiveStockFor(product);
                const status =
                  effectiveStock <= 0
                    ? 'out'
                    : product.min_stock_threshold > 0 && effectiveStock <= product.min_stock_threshold
                    ? 'low'
                    : 'good';
                return (
                  <tr
                    key={product.id}
                    className={`products-table-row ${expandedCards.has(product.id) ? 'expanded' : 'collapsed'}`}
                    onClick={() => {
                      if (window.innerWidth <= 768) {
                        setExpandedCards((prev) => {
                          const next = new Set(prev);
                          if (next.has(product.id)) next.delete(product.id);
                          else next.add(product.id);
                          return next;
                        });
                      } else {
                        navigate(`/store/${product.id}`);
                      }
                    }}
                  >
                    <td className="product-name-cell" data-label="Product">
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="product-name">{product.name}</span>
                          {product.sku && (
                            <span className="product-sku">SKU: {product.sku}</span>
                          )}
                        </div>
                        <button
                          className="mobile-expand-toggle"
                          onClick={(e) => toggleExpand(product.id, e)}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>

                      <div className="mobile-preview-pills">
                        <span className="preview-pill">
                          {hasVariants && product.variant_price_min != null ? (
                            product.variant_price_min === product.variant_price_max
                              ? `£${product.variant_price_min.toFixed(2)}`
                              : `from £${product.variant_price_min.toFixed(2)}`
                          ) : product.price != null ? (
                            `£${product.price.toFixed(2)}`
                          ) : '—'}
                        </span>
                        <span className={`stock-badge ${status}`}>
                          {effectiveStock} in stock
                        </span>
                        <span className="preview-pill">
                          {product.product_type === 'physical' ? 'Physical' : 'Digital'}
                        </span>
                      </div>
                      
                      <div className="mobile-only-detail">
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/store/${product.id}`);
                          }}
                        >
                          Edit Product
                        </button>
                      </div>
                    </td>
                    <td data-label="Type" className="mobile-secondary-detail">
                      <span className={`product-type-badge ${product.product_type}`}>
                        {product.product_type === 'physical' ? 'Physical' : 'Digital'}
                      </span>
                    </td>
                    <td data-label="Pack Qty" className="mobile-secondary-detail">
                      {product.pack_quantity > 1 ? (
                        <span className="pack-qty-badge multi">Pack of {product.pack_quantity}</span>
                      ) : (
                        <span className="pack-qty-badge single">Single</span>
                      )}
                    </td>
                    <td className="product-price-cell mobile-secondary-detail" data-label="Price">
                      {hasVariants && product.variant_price_min != null ? (
                        <span className="product-price">
                          {product.variant_price_min === product.variant_price_max
                            ? formatPrice(product.variant_price_min)
                            : `${formatPrice(product.variant_price_min)} – ${formatPrice(product.variant_price_max!)}`}
                        </span>
                      ) : (
                        <>
                          <span className="product-price">{formatPrice(product.price)}</span>
                          {product.compare_at_price && product.compare_at_price > product.price && (
                            <span className="product-compare-price">
                              {formatPrice(product.compare_at_price)}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td data-label="Stock" className="mobile-secondary-detail">
                      <div
                        className="stock-cell-wrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasVariants) showTooltip(e, product);
                        }}
                        style={{ cursor: hasVariants ? 'pointer' : 'default' }}
                      >
                        <span className={`stock-badge ${status}`}>
                          {effectiveStock}
                        </span>
                        {hasVariants && (
                          <span className="variant-stock-hint">
                            ({product.variant_count} variants)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="product-labels-cell mobile-secondary-detail" data-label="Labels">
                      {labels.map((l) => (
                        <span
                          key={l.id}
                          className="product-label-badge"
                          style={{ backgroundColor: l.color || '#6b7280' }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </td>
                    <td data-label="Visible" className="mobile-secondary-detail">
                      <button
                        className={`visibility-btn ${product.is_visible ? 'visible' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVisibility(product);
                        }}
                        title={product.is_visible ? 'Visible on store' : 'Hidden from store'}
                      >
                        {product.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Portal tooltip — renders outside table to avoid overflow clipping */}
      {tooltipProduct && tooltipProduct.variant_stock_details && createPortal(
        <>
          <div className="variant-stock-backdrop" onClick={(e) => { e.stopPropagation(); setTooltipProduct(null); }} />
          <div
            className="variant-stock-tooltip"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
          >
            <div className="variant-stock-tooltip-title">Stock by Variant</div>
            <div className="variant-stock-scrollarea">
              {tooltipProduct.variant_stock_details.map((d, i) => (
                <div key={i} className="variant-stock-row">
                  <span className="variant-stock-label">{d.label}</span>
                  <span className={`variant-stock-qty ${d.stock <= 0 ? 'out' : ''}`}>
                    {d.stock}
                  </span>
                </div>
              ))}
            </div>
            <div className="variant-stock-total">
              <span>Total</span>
              <span>{effectiveStockFor(tooltipProduct)}</span>
            </div>
          </div>
        </>,
        document.body
      )}
    </PageShell>
  );
}
