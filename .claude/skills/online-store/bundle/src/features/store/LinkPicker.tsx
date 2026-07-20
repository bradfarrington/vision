import { useState, useEffect, useMemo, useRef } from 'react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import * as api from '@/lib/api';
import type { Collection, Product } from '@/types/database';

interface LinkPickerProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

type PageOption =
  | 'home'
  | 'products'
  | 'collections'
  | 'gift-cards'
  | 'collection'    // specific collection
  | 'product'       // specific product
  | 'custom';

const PAGE_OPTIONS: { label: string; value: PageOption }[] = [
  { label: 'Home', value: 'home' },
  { label: 'All Products', value: 'products' },
  { label: 'All Collections', value: 'collections' },
  { label: 'Gift Cards', value: 'gift-cards' },
  { label: 'Specific Collection', value: 'collection' },
  { label: 'Specific Product', value: 'product' },
  { label: 'Custom URL', value: 'custom' },
];

const PAGE_URL_MAP: Record<string, string> = {
  home: '/shop',
  products: '/shop/products',
  collections: '/shop/collections',
  'gift-cards': '/shop/gift-cards',
};

/**
 * Parse an existing URL value to determine which page option is selected
 * and extract any sub-item slug/id.
 */
function parseLink(url: string): { page: PageOption; subId: string } {
  if (!url) return { page: 'home', subId: '' };

  const trimmed = url.trim();

  // Specific collection: /shop/collections/{slug} — check BEFORE exact match
  const colMatch = trimmed.match(/^\/shop\/collections\/(.+?)(?:\/)?$/);
  if (colMatch) return { page: 'collection', subId: colMatch[1] };

  // Specific product: /shop/products/{slug} — check BEFORE exact match
  const prodMatch = trimmed.match(/^\/shop\/products\/(.+?)(?:\/)?$/);
  if (prodMatch) return { page: 'product', subId: prodMatch[1] };

  // Exact matches
  if (trimmed === '/shop' || trimmed === '/shop/') return { page: 'home', subId: '' };
  if (trimmed === '/shop/products' || trimmed === '/shop/products/') return { page: 'products', subId: '' };
  if (trimmed === '/shop/collections' || trimmed === '/shop/collections/') return { page: 'collections', subId: '' };
  if (trimmed === '/shop/gift-cards' || trimmed === '/shop/gift-cards/') return { page: 'gift-cards', subId: '' };

  return { page: 'custom', subId: '' };
}

export function LinkPicker({ value, onChange }: LinkPickerProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadedCollections, setLoadedCollections] = useState(false);
  const [loadedProducts, setLoadedProducts] = useState(false);

  // Use internal state for the selected page mode so we don't lose it on re-render
  const parsed = useMemo(() => parseLink(value || ''), [value]);
  const [pageMode, setPageMode] = useState<PageOption>(parsed.page);
  const isInternalChange = useRef(false);

  // Sync pageMode from external value changes (not from our own onChange)
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    setPageMode(parsed.page);
  }, [parsed.page]);

  // Lazy-load collections & products when needed
  useEffect(() => {
    if (pageMode === 'collection' && !loadedCollections) {
      api.fetchCollections().then((data) => { setCollections(data); setLoadedCollections(true); }).catch(console.error);
    }
    if (pageMode === 'product' && !loadedProducts) {
      api.fetchProducts().then((data) => { setProducts(data); setLoadedProducts(true); }).catch(console.error);
    }
  }, [pageMode, loadedCollections, loadedProducts]);

  const handlePageChange = (newPage: string) => {
    const page = newPage as PageOption;
    setPageMode(page);

    // For direct page options, set the URL immediately
    if (PAGE_URL_MAP[page]) {
      isInternalChange.current = true;
      onChange(PAGE_URL_MAP[page]);
      return;
    }

    // For sub-selector pages, trigger data loading but don't change URL yet
    if (page === 'collection') {
      if (!loadedCollections) {
        api.fetchCollections().then((data) => { setCollections(data); setLoadedCollections(true); }).catch(console.error);
      }
    } else if (page === 'product') {
      if (!loadedProducts) {
        api.fetchProducts().then((data) => { setProducts(data); setLoadedProducts(true); }).catch(console.error);
      }
    } else if (page === 'custom') {
      isInternalChange.current = true;
      onChange('');
    }
  };

  const handleCollectionChange = (slugOrId: string) => {
    if (!slugOrId) return;
    isInternalChange.current = true;
    onChange(`/shop/collections/${slugOrId}`);
  };

  const handleProductChange = (slugOrId: string) => {
    if (!slugOrId) return;
    isInternalChange.current = true;
    onChange(`/shop/products/${slugOrId}`);
  };

  // Build searchable option lists for sub-selectors
  const collectionOptions = collections.map((c) => ({
    label: c.name,
    value: c.slug || c.id,
  }));

  const productOptions = products.map((p) => ({
    label: p.name,
    value: p.slug || p.id,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <SearchableSelect
        value={pageMode}
        onChange={handlePageChange}
        searchable={false}
        sort={false}
        options={PAGE_OPTIONS}
      />

      {pageMode === 'collection' && (
        <SearchableSelect
          value={parsed.subId}
          onChange={handleCollectionChange}
          searchable={true}
          sort={false}
          options={[
            { label: '— Select a Collection —', value: '' },
            ...collectionOptions,
          ]}
          placeholder="Search collections..."
        />
      )}

      {pageMode === 'product' && (
        <SearchableSelect
          value={parsed.subId}
          onChange={handleProductChange}
          searchable={true}
          sort={false}
          options={[
            { label: '— Select a Product —', value: '' },
            ...productOptions,
          ]}
          placeholder="Search products..."
        />
      )}

      {pageMode === 'custom' && (
        <input
          className="form-input"
          value={value || ''}
          onChange={(e) => {
            isInternalChange.current = true;
            onChange(e.target.value);
          }}
          placeholder="https://... or /path"
        />
      )}
    </div>
  );
}
