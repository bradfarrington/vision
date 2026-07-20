import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { StoreTabBar } from './StoreTabBar';
import { BarcodeLabelPrinter } from './BarcodeLabelPrinter';
import type { LabelData } from './BarcodeLabelPrinter';
import { StockUpdateModal } from './StockUpdateModal';
import * as api from '@/lib/api';
import type { InventoryItem } from '@/types/database';
import { Search, Download, BarChart3, AlertTriangle, XCircle, Package, ChevronUp, ChevronDown, Printer, ScanLine } from 'lucide-react';
import './StorePage.css';

type FilterTab = 'all' | 'low' | 'out';
type InventorySortColumn = 'product' | 'variant' | 'sku' | 'stock' | 'threshold' | 'price' | 'status';
type SortDir = 'asc' | 'desc';

export function InventoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortColumn, setSortColumn] = useState<InventorySortColumn | null>('product');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [labelPrinterOpen, setLabelPrinterOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await api.fetchInventorySummary();
      setItems(data);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (item: InventoryItem): 'good' | 'low' | 'out' => {
    if (item.stock_quantity <= 0) return 'out';
    if (item.min_stock_threshold > 0 && item.stock_quantity <= item.min_stock_threshold) return 'low';
    return 'good';
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const statusOrder = { out: 0, low: 1, good: 2 };

  const filtered = useMemo(() => {
    let list = items
      .filter((item) => {
        if (filter === 'low') return getStatus(item) === 'low';
        if (filter === 'out') return getStatus(item) === 'out';
        return true;
      })
      .filter((item) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          item.product_name.toLowerCase().includes(q) ||
          (item.product_sku && item.product_sku.toLowerCase().includes(q)) ||
          (item.variant_sku && item.variant_sku.toLowerCase().includes(q)) ||
          (item.variant_label && item.variant_label.toLowerCase().includes(q))
        );
      });

    if (sortColumn) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sortColumn) {
          case 'product':
            aVal = a.product_name.toLowerCase();
            bVal = b.product_name.toLowerCase();
            break;
          case 'variant':
            aVal = (a.variant_label || '').toLowerCase();
            bVal = (b.variant_label || '').toLowerCase();
            break;
          case 'sku':
            aVal = (a.variant_sku || a.product_sku || '').toLowerCase();
            bVal = (b.variant_sku || b.product_sku || '').toLowerCase();
            break;
          case 'stock':
            aVal = a.stock_quantity;
            bVal = b.stock_quantity;
            break;
          case 'threshold':
            aVal = a.min_stock_threshold;
            bVal = b.min_stock_threshold;
            break;
          case 'price':
            aVal = a.price;
            bVal = b.price;
            break;
          case 'status':
            aVal = statusOrder[getStatus(a)];
            bVal = statusOrder[getStatus(b)];
            break;
        }
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }

    return list;
  }, [items, search, filter, sortColumn, sortDir]);

  const handleSort = useCallback((col: InventorySortColumn, dir: SortDir) => {
    if (sortColumn === col && sortDir === dir) {
      setSortColumn(null);
      setSortDir('asc');
    } else {
      setSortColumn(col);
      setSortDir(dir);
    }
  }, [sortColumn, sortDir]);

  const SortHeader = ({ col, label }: { col: InventorySortColumn; label: string }) => (
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

  const lowCount = items.filter((i) => getStatus(i) === 'low').length;
  const outCount = items.filter((i) => getStatus(i) === 'out').length;

  const formatPrice = (price: number) => `£${Number(price).toFixed(2)}`;

  const handleExportPDF = () => {
    // Build a simple printable HTML table and trigger print dialog
    const now = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const rows = filtered
      .map(
        (item) => `
        <tr>
          <td>${item.product_name}</td>
          <td>${item.variant_label || '—'}</td>
          <td>${item.variant_sku || item.product_sku || '—'}</td>
          <td style="text-align:right">${item.stock_quantity}</td>
          <td style="text-align:right">${item.min_stock_threshold}</td>
          <td style="text-align:right">${formatPrice(item.price)}</td>
          <td>${item.continue_selling_when_out_of_stock ? 'Yes' : 'No'}</td>
          <td>${getStatus(item) === 'out' ? 'OUT OF STOCK' : getStatus(item) === 'low' ? 'LOW STOCK' : 'In Stock'}</td>
        </tr>`
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Inventory Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .date { color: #666; margin-bottom: 20px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #333; font-weight: 600; }
          td { padding: 6px 12px; border-bottom: 1px solid #e5e5e5; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .footer { margin-top: 24px; font-size: 11px; color: #999; }
        </style>
      </head>
      <body>
        <h1>Inventory Report — Isobex Industrial Lasers</h1>
        <div class="date">Generated: ${now}</div>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>SKU</th>
              <th style="text-align:right">Stock</th>
              <th style="text-align:right">Min. Threshold</th>
              <th style="text-align:right">Price</th>
              <th>Continue Selling</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">Total items: ${filtered.length}</div>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  const barcodeLabels = useMemo((): LabelData[] => {
    return filtered
      .filter((item) => item.barcode)
      .map((item) => ({
        barcode: item.barcode!,
        productName: item.product_name,
        variantLabel: item.variant_label || undefined,
      }));
  }, [filtered]);

  return (
    <>
    <PageShell
      title="Online Store"
      subtitle="Manage your ecommerce products, categories, and storefront."
    >
      <StoreTabBar />

      {/* Summary stats */}
      {!loading && items.length > 0 && (
        <div className="inventory-summary-bar">
          <div className="inventory-stat">
            <Package size={16} />
            <span><strong>{items.length}</strong> total items</span>
          </div>
          {lowCount > 0 && (
            <div className="inventory-stat warning">
              <AlertTriangle size={16} />
              <span><strong>{lowCount}</strong> low stock</span>
            </div>
          )}
          {outCount > 0 && (
            <div className="inventory-stat danger">
              <XCircle size={16} />
              <span><strong>{outCount}</strong> out of stock</span>
            </div>
          )}
        </div>
      )}

      <div className="store-toolbar">
        <div className="store-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by product, SKU, or variant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="inventory-filters">
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-tab ${filter === 'low' ? 'active' : ''}`}
            onClick={() => setFilter('low')}
          >
            <AlertTriangle size={14} />
            Low Stock
          </button>
          <button
            className={`filter-tab ${filter === 'out' ? 'active' : ''}`}
            onClick={() => setFilter('out')}
          >
            <XCircle size={14} />
            Out of Stock
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => setScanModalOpen(true)}>
          <ScanLine size={16} />
          <span>Scan to Update Stock</span>
        </button>
        <button className="btn btn-secondary" onClick={handleExportPDF}>
          <Download size={16} />
          <span>Export PDF</span>
        </button>
        {barcodeLabels.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setLabelPrinterOpen(true)}>
            <Printer size={16} />
            <span>Print All Barcodes</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="store-loading">Loading inventory...</div>
      ) : filtered.length === 0 ? (
        <div className="store-empty">
          <BarChart3 size={48} />
          <h3>No inventory items found</h3>
          <p>{search ? 'Try a different search term.' : 'Add products to see inventory here.'}</p>
        </div>
      ) : (
        <div className="products-table-wrap">
          <table className="products-table inventory-table">
            <thead>
              <tr>
                <SortHeader col="product" label="Product" />
                <SortHeader col="variant" label="Variant" />
                <SortHeader col="sku" label="SKU" />
                <SortHeader col="stock" label="Stock" />
                <SortHeader col="threshold" label="Min. Threshold" />
                <SortHeader col="price" label="Price" />
                <th>Continue Selling</th>
                <SortHeader col="status" label="Status" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => {
                const status = getStatus(item);
                const rowKey = `${item.product_id}-${item.variant_id || idx}`;
                return (
                  <tr 
                    key={rowKey} 
                    className={`inventory-row ${status} ${expandedCards.has(rowKey) ? 'expanded' : 'collapsed'}`}
                    onClick={() => {
                      if (window.innerWidth <= 768) {
                        setExpandedCards((prev) => {
                          const next = new Set(prev);
                          if (next.has(rowKey)) next.delete(rowKey);
                          else next.add(rowKey);
                          return next;
                        });
                      }
                    }}
                  >
                    <td className="product-name-cell" data-label="Product">
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="product-name">{item.product_name}</span>
                        </div>
                        <button
                          className="mobile-expand-toggle"
                          onClick={(e) => toggleExpand(rowKey, e)}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>

                      <div className="mobile-preview-pills">
                        <span className="preview-pill">
                          {formatPrice(item.price)}
                        </span>
                        <span className={`stock-badge ${status}`}>
                          {item.stock_quantity} in stock
                        </span>
                        {item.variant_label && (
                          <span className="preview-pill">
                            {item.variant_label}
                          </span>
                        )}
                      </div>
                      
                      <div className="mobile-only-detail">
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/store/${item.product_id}`);
                          }}
                        >
                          Edit Product
                        </button>
                      </div>
                    </td>
                    <td data-label="Variant" className="mobile-secondary-detail">{item.variant_label || '—'}</td>
                    <td data-label="SKU" className="mobile-secondary-detail">{item.variant_sku || item.product_sku || '—'}</td>
                    <td data-label="Stock" className="mobile-secondary-detail">
                      <span className={`stock-badge ${status}`}>
                        {item.stock_quantity}
                      </span>
                    </td>
                    <td data-label="Min. Threshold" className="mobile-secondary-detail">{item.min_stock_threshold}</td>
                    <td data-label="Price" className="mobile-secondary-detail">{formatPrice(item.price)}</td>
                    <td data-label="Continue Selling" className="mobile-secondary-detail">
                      <span className={`continue-selling-badge ${item.continue_selling_when_out_of_stock ? 'on' : 'off'}`}>
                        {item.continue_selling_when_out_of_stock ? 'On' : 'Off'}
                      </span>
                    </td>
                    <td data-label="Status" className="mobile-secondary-detail">
                      <span className={`status-indicator ${status}`}>
                        {status === 'out' && <><XCircle size={14} /> Out of Stock</>}
                        {status === 'low' && <><AlertTriangle size={14} /> Low Stock</>}
                        {status === 'good' && 'In Stock'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>

    {/* Label Printer Modal */}
    <BarcodeLabelPrinter
      open={labelPrinterOpen}
      onClose={() => setLabelPrinterOpen(false)}
      mode="bulk"
      bulkLabels={barcodeLabels}
    />

    {/* Stock Update via Barcode Modal */}
    <StockUpdateModal
      open={scanModalOpen}
      onClose={() => {
        setScanModalOpen(false);
        loadInventory();
      }}
      onAdjusted={loadInventory}
    />
    </>
  );
}
