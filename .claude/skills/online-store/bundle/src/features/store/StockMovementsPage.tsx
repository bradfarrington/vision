import { useState, useEffect, useMemo } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { StoreTabBar } from './StoreTabBar';
import * as api from '@/lib/api';
import type { StockMovement, StockMovementType } from '@/types/database';
import { History, Search, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import './StorePage.css';
import './StockUpdateModal.css';

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  received: 'Received',
  stocktake: 'Stock take',
  damaged: 'Damaged',
  adjustment: 'Adjustment',
  order: 'Order',
  manual: 'Manual',
};

export function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<StockMovementType | 'all'>('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.fetchStockMovements({ limit: 500 });
      setMovements(data);
    } catch (err) {
      console.error('Failed to load stock movements:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== 'all' && m.movement_type !== typeFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (m.product_name || '').toLowerCase().includes(q) ||
        (m.variant_label || '').toLowerCase().includes(q) ||
        (m.barcode || '').toLowerCase().includes(q) ||
        (m.reason || '').toLowerCase().includes(q) ||
        (m.performed_by_name || '').toLowerCase().includes(q)
      );
    });
  }, [movements, search, typeFilter]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
            placeholder="Search product, barcode, reason, or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="inventory-filters">
          <button
            className={`filter-tab ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All
          </button>
          {(Object.keys(MOVEMENT_LABELS) as StockMovementType[]).map((t) => (
            <button
              key={t}
              className={`filter-tab ${typeFilter === t ? 'active' : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {MOVEMENT_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="store-loading">Loading movement history...</div>
      ) : filtered.length === 0 ? (
        <div className="store-empty">
          <History size={48} />
          <h3>No stock movements yet</h3>
          <p>Adjustments made via the Scan to Update flow will appear here.</p>
        </div>
      ) : (
        <div className="products-table-wrap">
          <table className="products-table inventory-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>When</th>
                <th>Variant</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Change</th>
                <th style={{ textAlign: 'right' }}>Before</th>
                <th style={{ textAlign: 'right' }}>After</th>
                <th>By</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const expanded = expandedCards.has(m.id);
                const isPositive = m.quantity_delta >= 0;
                return (
                  <tr
                    key={m.id}
                    className={`stock-movement-row ${expanded ? 'expanded' : 'collapsed'}`}
                    onClick={() => {
                      if (window.innerWidth <= 1279) toggleExpand(m.id);
                    }}
                  >
                    <td className="product-name-cell" data-label="Product">
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="product-name">{m.product_name || '—'}</span>
                        </div>
                        <button
                          className="mobile-expand-toggle"
                          onClick={(e) => toggleExpand(m.id, e)}
                          aria-label={expanded ? 'Collapse' : 'Expand'}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>

                      <div className="mobile-preview-pills">
                        <span className="preview-pill">{formatDate(m.created_at)}</span>
                        <span className={`delta-pill ${isPositive ? 'pos' : 'neg'}`}>
                          {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          {isPositive ? '+' : ''}{m.quantity_delta}
                        </span>
                        <span className="preview-pill">{MOVEMENT_LABELS[m.movement_type]}</span>
                      </div>
                    </td>
                    <td data-label="When" className="mobile-secondary-detail">{formatDate(m.created_at)}</td>
                    <td data-label="Variant" className="mobile-secondary-detail">{m.variant_label || '—'}</td>
                    <td data-label="Type" className="mobile-secondary-detail">{MOVEMENT_LABELS[m.movement_type]}</td>
                    <td data-label="Change" className="mobile-secondary-detail" style={{ textAlign: 'right' }}>
                      <span className={`delta-pill ${isPositive ? 'pos' : 'neg'}`}>
                        {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {isPositive ? '+' : ''}{m.quantity_delta}
                      </span>
                    </td>
                    <td data-label="Before" className="mobile-secondary-detail" style={{ textAlign: 'right' }}>{m.quantity_before}</td>
                    <td data-label="After" className="mobile-secondary-detail" style={{ textAlign: 'right' }}>{m.quantity_after}</td>
                    <td data-label="By" className="mobile-secondary-detail">{m.performed_by_name || '—'}</td>
                    <td data-label="Note" className="mobile-secondary-detail">{m.reason || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
