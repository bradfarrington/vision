import { useState, useEffect, useRef } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { StoreTabBar } from './StoreTabBar';
import { DatePicker } from '@/components/ui/DatePicker';
import { useAlert } from '@/components/ui/AlertDialog';
import * as api from '@/lib/api';
import type { DiscountCode, DiscountCodeInsert, DiscountAppliesTo, Product } from '@/types/database';
import { Plus, Trash2, X, Percent, Search, Check, ChevronDown } from 'lucide-react';
import './Discounts.css';

export function DiscountsPage() {
  const { showAlert } = useAlert();
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Product list for the picker
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<'percentage' | 'fixed'>('percentage');
  const [formValue, setFormValue] = useState('');
  const [formMinOrder, setFormMinOrder] = useState('');
  const [formMaxUses, setFormMaxUses] = useState('');
  const [formStartsAt, setFormStartsAt] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [formAppliesTo, setFormAppliesTo] = useState<DiscountAppliesTo>('all');
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Product picker dropdown
  const [productSearch, setProductSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.fetchDiscountCodes()
      .then(setCodes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch products when form is opened
  useEffect(() => {
    if (showForm && !productsLoaded) {
      api.fetchProducts()
        .then((p) => {
          setProducts(p);
          setProductsLoaded(true);
        })
        .catch(console.error);
    }
  }, [showForm, productsLoaded]);

  // Close product picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const resetForm = () => {
    setFormCode('');
    setFormType('percentage');
    setFormValue('');
    setFormMinOrder('');
    setFormMaxUses('');
    setFormStartsAt('');
    setFormExpiresAt('');
    setFormAppliesTo('all');
    setFormProductIds([]);
    setEditingId(null);
    setShowForm(false);
    setProductSearch('');
    setPickerOpen(false);
  };

  const populateForm = (dc: DiscountCode) => {
    setFormCode(dc.code);
    setFormType(dc.discount_type);
    setFormValue(String(dc.value));
    setFormMinOrder(String(dc.min_order_amount || ''));
    setFormMaxUses(dc.max_uses !== null ? String(dc.max_uses) : '');
    setFormStartsAt(dc.starts_at ? dc.starts_at.substring(0, 10) : '');
    setFormExpiresAt(dc.expires_at ? dc.expires_at.substring(0, 10) : '');
    setFormAppliesTo(dc.applies_to || 'all');
    setFormProductIds(dc.product_ids || []);
    setEditingId(dc.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formCode || !formValue) return;

    const payload: any = {
      code: formCode.toUpperCase(),
      discount_type: formType,
      value: Number(formValue),
      min_order_amount: formMinOrder ? Number(formMinOrder) : 0,
      max_uses: formMaxUses ? Number(formMaxUses) : null,
      starts_at: formStartsAt || null,
      expires_at: formExpiresAt || null,
      applies_to: formAppliesTo,
      product_ids: formAppliesTo === 'all' ? [] : formProductIds,
      is_active: true,
    };

    try {
      if (editingId) {
        const updated = await api.updateDiscountCode(editingId, payload);
        setCodes((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        showAlert({ title: 'Updated', message: 'Discount code updated.', variant: 'success' });
      } else {
        const created = await api.createDiscountCode(payload as DiscountCodeInsert);
        setCodes((prev) => [created, ...prev]);
        showAlert({ title: 'Created', message: 'Discount code created.', variant: 'success' });
      }
      resetForm();
    } catch (err) {
      console.error(err);
      showAlert({ title: 'Error', message: 'Failed to save discount code.', variant: 'danger' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDiscountCode(id);
      setCodes((prev) => prev.filter((c) => c.id !== id));
      showAlert({ title: 'Deleted', message: 'Discount code deleted.', variant: 'success' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (dc: DiscountCode) => {
    try {
      const updated = await api.updateDiscountCode(dc.id, { is_active: !dc.is_active });
      setCodes((prev) => prev.map((c) => (c.id === dc.id ? updated : c)));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleProduct = (id: string) => {
    setFormProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const selectedProductNames = formProductIds
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean) as Product[];

  // Format price for product picker (show variant range when applicable)
  const formatProductPrice = (p: Product) => {
    if (p.variant_price_min != null && p.variant_price_max != null) {
      if (p.variant_price_min === p.variant_price_max) {
        return `£${p.variant_price_min.toFixed(2)}`;
      }
      return `£${p.variant_price_min.toFixed(2)} – £${p.variant_price_max.toFixed(2)}`;
    }
    return `£${Number(p.price).toFixed(2)}`;
  };

  // Build scope label for table
  const getScopeLabel = (dc: DiscountCode) => {
    if (!dc.applies_to || dc.applies_to === 'all') return 'All products';
    const count = (dc.product_ids || []).length;
    return `${count} product${count !== 1 ? 's' : ''}`;
  };

  return (
    <PageShell title="Online Store" subtitle="Manage discount codes for your store.">
      <StoreTabBar />

      <div className="discounts-header">
        <h2>Discount Codes</h2>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus size={16} /> New Discount
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="discount-form-card">
          <div className="discount-form-card-header">
            <h3>{editingId ? 'Edit Discount Code' : 'New Discount Code'}</h3>
            <button className="btn btn-ghost btn-icon-sm" onClick={resetForm}><X size={16} /></button>
          </div>
          <div className="discount-form-grid">
            <div className="form-group">
              <label className="form-label">Code</label>
              <input className="form-input" value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="SUMMER20" />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input" value={formType} onChange={(e) => setFormType(e.target.value as any)}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (£)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Value</label>
              <input className="form-input" type="number" value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder="10" min="0" step="0.01" />
            </div>
            <div className="form-group">
              <label className="form-label">Min Order Amount (£)</label>
              <input className="form-input" type="number" value={formMinOrder} onChange={(e) => setFormMinOrder(e.target.value)} placeholder="0" min="0" step="0.01" />
            </div>
            <div className="form-group">
              <label className="form-label">Max Uses</label>
              <input className="form-input" type="number" value={formMaxUses} onChange={(e) => setFormMaxUses(e.target.value)} placeholder="Unlimited" min="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Starts At</label>
              <DatePicker value={formStartsAt} onChange={setFormStartsAt} placeholder="Select start date…" />
            </div>
            <div className="form-group">
              <label className="form-label">Expires At</label>
              <DatePicker value={formExpiresAt} onChange={setFormExpiresAt} placeholder="Select expiry date…" />
            </div>
          </div>

          {/* Applies To section */}
          <div className="discount-applies-section">
            <label className="form-label">Applies To</label>
            <div className="discount-applies-radios">
              <label className={`discount-radio-label ${formAppliesTo === 'all' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="appliesTo"
                  value="all"
                  checked={formAppliesTo === 'all'}
                  onChange={() => setFormAppliesTo('all')}
                />
                <span className="discount-radio-dot" />
                All Products
              </label>
              <label className={`discount-radio-label ${formAppliesTo === 'specific' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="appliesTo"
                  value="specific"
                  checked={formAppliesTo === 'specific'}
                  onChange={() => setFormAppliesTo('specific')}
                />
                <span className="discount-radio-dot" />
                Specific Products
              </label>
            </div>

            {formAppliesTo === 'specific' && (
              <div className="discount-product-picker" ref={pickerRef}>
                {/* Selected chips */}
                {selectedProductNames.length > 0 && (
                  <div className="discount-product-chips">
                    {selectedProductNames.map((p) => (
                      <span key={p.id} className="discount-product-chip">
                        {p.name}
                        <button
                          type="button"
                          className="discount-product-chip-remove"
                          onClick={() => toggleProduct(p.id)}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="discount-product-search-wrap">
                  <Search size={14} className="discount-product-search-icon" />
                  <input
                    className="discount-product-search"
                    placeholder="Search products…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onFocus={() => setPickerOpen(true)}
                  />
                </div>

                {/* Dropdown list */}
                {pickerOpen && (
                  <div className="discount-product-dropdown">
                    {filteredProducts.length === 0 ? (
                      <div className="discount-product-dropdown-empty">No products found</div>
                    ) : (
                      filteredProducts.map((p) => {
                        const isSelected = formProductIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`discount-product-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleProduct(p.id)}
                          >
                            <span className={`discount-product-checkbox ${isSelected ? 'checked' : ''}`}>
                              {isSelected && <Check size={12} />}
                            </span>
                            <span className="discount-product-option-name">{p.name}</span>
                            <span className="discount-product-option-price">
                              {formatProductPrice(p)}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave}>
              {editingId ? 'Update' : 'Create'} Discount
            </button>
            <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="store-loading">Loading discount codes...</div>
      ) : codes.length === 0 ? (
        <div className="module-placeholder">
          <div className="module-placeholder-icon"><Percent size={48} /></div>
          <h3>No Discount Codes</h3>
          <p>Create your first discount code to offer promotions.</p>
        </div>
      ) : (
        <div className="products-table-wrap">
          <table className="products-table discounts-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Value</th>
                <th>Applies To</th>
                <th>Min Order</th>
                <th>Uses</th>
                <th>Status</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((dc) => (
                <tr 
                  key={dc.id}
                  className={`products-table-row ${expandedCards.has(dc.id) ? 'expanded' : 'collapsed'}`}
                  onClick={() => {
                    if (window.innerWidth <= 768) {
                      setExpandedCards((prev) => {
                        const next = new Set(prev);
                        if (next.has(dc.id)) next.delete(dc.id);
                        else next.add(dc.id);
                        return next;
                      });
                    }
                  }}
                >
                  <td className="product-name-cell" data-label="Discount">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="product-name">{dc.code}</span>
                      </div>
                      <button
                        className="mobile-expand-toggle"
                        onClick={(e) => toggleExpand(dc.id, e)}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>

                    <div className="mobile-preview-pills">
                      <span className="preview-pill">
                        {dc.discount_type === 'percentage' ? `${dc.value}% OFF` : `£${Number(dc.value).toFixed(2)} OFF`}
                      </span>
                      <span className={`stock-badge ${dc.is_active ? 'good' : 'out'}`}>
                        {dc.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="mobile-only-detail">
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          populateForm(dc);
                        }}
                      >
                        Edit Code
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(dc.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                  <td data-label="Type" className="mobile-secondary-detail" style={{ textTransform: 'capitalize' }}>{dc.discount_type}</td>
                  <td data-label="Value" className="mobile-secondary-detail">{dc.discount_type === 'percentage' ? `${dc.value}%` : `£${Number(dc.value).toFixed(2)}`}</td>
                  <td data-label="Applies To" className="mobile-secondary-detail">{getScopeLabel(dc)}</td>
                  <td data-label="Min Order" className="mobile-secondary-detail">{dc.min_order_amount > 0 ? `£${Number(dc.min_order_amount).toFixed(2)}` : '—'}</td>
                  <td data-label="Uses" className="mobile-secondary-detail">{dc.current_uses}{dc.max_uses !== null ? `/${dc.max_uses}` : ''}</td>
                  <td data-label="Status" className="mobile-secondary-detail">
                    <button
                      className={`btn btn-ghost btn-sm ${dc.is_active ? 'text-success' : 'text-muted'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(dc);
                      }}
                    >
                      {dc.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td data-label="Expires" className="mobile-secondary-detail">{dc.expires_at ? new Date(dc.expires_at).toLocaleDateString('en-GB') : '—'}</td>
                  <td data-label="Actions" className="mobile-secondary-detail desktop-only">
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-icon-sm" onClick={(e) => { e.stopPropagation(); populateForm(dc); }} title="Edit">✎</button>
                      <button className="btn btn-ghost btn-icon-sm text-danger" onClick={(e) => { e.stopPropagation(); handleDelete(dc.id); }} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
