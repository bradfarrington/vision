import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sfPath } from './storefrontPaths';
import { ArrowRight } from 'lucide-react';
import { useStoreConfig } from './useStoreConfig';
import * as api from '@/lib/api';
import type { Collection } from '@/types/database';

export function StorefrontCollections() {
  const { config } = useStoreConfig();
  const tpl = config?.page_templates?.collections || {};

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.fetchCollections()
      .then(setCollections)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Template config values with defaults
  const columns = tpl.columns || 3;
  const cardRadius = tpl.cardRadius ?? 16;
  const showProductCount = tpl.showProductCount !== false;
  
  const pageTitle = tpl.pageTitle || 'Collections';
  const pageSubtitle = tpl.pageSubtitle || 'Browse our curated collections';
  const titleAlign = tpl.titleAlign || 'left';
  const titleColor = tpl.titleColor || '#111827';
  const subtitleColor = tpl.subtitleColor || '#4b5563';
  const titleSize = tpl.titleSize || 'large';

  if (loading) {
    return <div className="sf-loading">Loading collections...</div>;
  }

  return (
    <div className="sf-collections-page">
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

      <div
        className="sf-collection-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {collections.map((col) => (
          <Link
            key={col.id}
            to={sfPath(`/collections/${col.slug || col.id}`)}
            className="sf-collection-card-modern"
            style={{ borderRadius: `${cardRadius}px` }}
          >
            <div className="sf-collection-card-modern-img-wrap">
              {col.cover_image_url ? (
                <img src={col.cover_image_url} alt={col.name} className="sf-collection-card-modern-cover" />
              ) : (
                <div className="sf-collection-card-placeholder">No Image</div>
              )}
            </div>
            <div className="sf-collection-card-modern-info">
              <h3 className="sf-collection-card-modern-name">{col.name}</h3>
              {showProductCount && col.product_count != null && (
                <div className="sf-collection-card-modern-count">
                  {col.product_count} products
                </div>
              )}
              <div className="sf-collection-card-modern-action">
                <span>Explore</span>
                <ArrowRight size={16} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {collections.length === 0 && (
        <div className="sf-loading">No collections yet.</div>
      )}
    </div>
  );
}
