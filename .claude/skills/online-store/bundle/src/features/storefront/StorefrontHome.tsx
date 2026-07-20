import { useState, useEffect } from 'react';
import * as api from '@/lib/api';
import type { StorePage } from '@/types/database';
import { BlockRenderer } from './BlockRenderer';

export function StorefrontHome() {
  const [page, setPage] = useState<StorePage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await api.fetchStorePage('home');
        setPage(p);
      } catch (err) {
        console.error('Failed to load homepage data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div className="sf-loading">Loading...</div>;
  }

  if (!page || !page.blocks || page.blocks.length === 0) {
    return (
      <div className="sf-loading">
        <p>No homepage content configured yet.</p>
      </div>
    );
  }

  return (
    <div className="sf-page-blocks">
      {page.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}
