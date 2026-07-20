import { useState, useEffect, useRef, useCallback } from 'react';
import { useAlert } from '@/components/ui/AlertDialog';
import { useNavigate } from 'react-router-dom';
import { BlockEditor } from './BlockEditor';
import { BlockLibrary } from './BlockLibrary';
import * as api from '@/lib/api';
import type { StorePage, PageBlock, BlockType } from '@/types/database';
import {
  ArrowLeft, Plus, Save, Eye, ArrowUp, ArrowDown, Trash2,
  GripVertical, X, Loader2, Monitor,
  Home, ShoppingBag, Package, Grid3x3, CreditCard, PartyPopper,
} from 'lucide-react';
import './PageBuilder.css';

const PAGE_ICONS: Record<string, any> = {
  home: Home, products: ShoppingBag, product_detail: Package,
  collections: Grid3x3, checkout: CreditCard, thank_you: PartyPopper,
};

const PAGE_PREVIEW_PATHS: Record<string, string> = {
  home: '/shop',
  products: '/shop/products',
  product_detail: '/shop/products',
  collections: '/shop/collections',
  checkout: '/shop/checkout',
  thank_you: '/shop/thank-you/preview',
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function PageBuilderPage() {
  const navigate = useNavigate();
  const { showConfirm } = useAlert();

  // Pages state
  const [pages, setPages] = useState<StorePage[]>([]);
  const [selectedPage, setSelectedPage] = useState<StorePage | null>(null);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Editor state
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  // Preview
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    api.fetchStorePages()
      .then((p) => {
        setPages(p);
        if (p.length > 0) {
          setSelectedPage(p[0]);
          setBlocks(p[0].blocks || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectPage = useCallback(async (page: StorePage) => {
    if (hasChanges) {
      const ok = await showConfirm({ title: 'Unsaved Changes', message: 'You have unsaved changes. Switch page anyway?', variant: 'warning', confirmLabel: 'Switch Page' });
      if (!ok) return;
    }
    setSelectedPage(page);
    setBlocks(page.blocks || []);
    setEditingBlockId(null);
    setHasChanges(false);
  }, [hasChanges, showConfirm]);

  const handleSave = async () => {
    if (!selectedPage) return;
    setSaving(true);
    try {
      const updated = await api.updateStorePage(selectedPage.id, { blocks });
      setSelectedPage(updated);
      setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setHasChanges(false);
      // Refresh preview
      if (iframeRef.current) {
        iframeRef.current.src = iframeRef.current.src;
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // ─── Block operations ─────────────────────────

  const addBlock = (type: BlockType) => {
    const newBlock: PageBlock = { id: generateId(), type, config: getDefaultConfig(type) };
    setBlocks((prev) => [...prev, newBlock]);
    setShowLibrary(false);
    setEditingBlockId(newBlock.id);
    setHasChanges(true);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (editingBlockId === id) setEditingBlockId(null);
    setHasChanges(true);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setBlocks(newBlocks);
    setHasChanges(true);
  };

  const updateBlockConfig = (id: string, config: Record<string, any>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, config } : b)));
    setHasChanges(true);
  };

  // ─── Render ───────────────────────────────────

  const editingBlock = blocks.find((b) => b.id === editingBlockId) || null;
  const previewPath = selectedPage ? (PAGE_PREVIEW_PATHS[selectedPage.page_key] || '/shop') : '/shop';

  if (loading) {
    return (
      <div className="pb2-loading">
        <Loader2 className="spin" size={32} />
        <p>Loading page builder...</p>
      </div>
    );
  }

  return (
    <>
      <div className="desktop-only-builder-msg">
        <Monitor size={48} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>Desktop Required</h2>
        <p style={{ maxWidth: '400px', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          The builder interface is optimized for larger screens. Please use a laptop or desktop computer to access this feature.
        </p>
        <button className="btn-primary" onClick={() => navigate('/store')}>
          Go Back
        </button>
      </div>
      <div className="pb2-root builder-desktop-wrapper">
      {/* Top bar */}
      <div className="pb2-topbar">
        <div className="pb2-topbar-left">
          <button className="pb2-back-btn" onClick={() => navigate('/store')}>
            <ArrowLeft size={18} />
            <span>Back to Store</span>
          </button>
          <div className="pb2-page-selector">
            {pages.map((page) => {
              const Icon = PAGE_ICONS[page.page_key] || ShoppingBag;
              return (
                <button
                  key={page.id}
                  className={`pb2-page-tab ${selectedPage?.id === page.id ? 'active' : ''}`}
                  onClick={() => selectPage(page)}
                >
                  <Icon size={14} />
                  <span>{page.title}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="pb2-topbar-right">
          {hasChanges && <span className="pb2-unsaved-badge">Unsaved changes</span>}
          <a
            href={previewPath}
            target="_blank"
            rel="noreferrer"
            className="pb2-topbar-btn secondary"
          >
            <Eye size={16} /> Preview
          </a>
          <button
            className="pb2-topbar-btn primary"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main editor area */}
      <div className="pb2-main">
        {/* Left: Block list */}
        <div className="pb2-left">
          {/* Block list */}
          <div className="pb2-blocks">
            <div className="pb2-blocks-header">
              <span>{blocks.length} Blocks</span>
              <button className="pb2-add-btn" onClick={() => setShowLibrary(true)}>
                <Plus size={14} /> Add
              </button>
            </div>
            <div className="pb2-block-list">
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`pb2-block-item ${editingBlockId === block.id ? 'editing' : ''}`}
                  onClick={() => setEditingBlockId(editingBlockId === block.id ? null : block.id)}
                >
                  <GripVertical size={14} className="pb2-drag" />
                  <div className="pb2-block-meta">
                    <span className="pb2-block-type">{getBlockLabel(block.type)}</span>
                    <span className="pb2-block-desc">{getBlockSummary(block)}</span>
                  </div>
                  <div className="pb2-block-btns">
                    <button onClick={(e) => { e.stopPropagation(); moveBlock(index, 'up'); }} disabled={index === 0}><ArrowUp size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); moveBlock(index, 'down'); }} disabled={index === blocks.length - 1}><ArrowDown size={12} /></button>
                    <button className="danger" onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Inline block editor */}
            {editingBlock && (
              <div className="pb2-inline-editor">
                <div className="pb2-inline-editor-header">
                  <h4>{getBlockLabel(editingBlock.type)}</h4>
                  <button onClick={() => setEditingBlockId(null)}><X size={14} /></button>
                </div>
                <BlockEditor
                  block={editingBlock}
                  onChange={(config) => updateBlockConfig(editingBlock.id, config)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="pb2-preview">
          <div className="pb2-preview-bar">
            <span className="pb2-preview-url">{previewPath}</span>
          </div>
          <iframe
            ref={iframeRef}
            src={previewPath}
            className="pb2-preview-iframe"
            title="Page Preview"
          />
        </div>
      </div>

      {/* Block library modal */}
      {showLibrary && (
        <BlockLibrary onSelect={addBlock} onClose={() => setShowLibrary(false)} />
      )}
    </div>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function getBlockLabel(type: BlockType): string {
  const labels: Record<BlockType, string> = {
    hero: 'Hero Banner', half_hero: 'Half Hero', heading: 'Heading', text: 'Text', image: 'Image',
    image_gallery: 'Image Gallery', button: 'Button', product_grid: 'Product Grid',
    collection_grid: 'Collection Grid', collection_showcase: 'Collection Showcase',
    category_links: 'Category Links', product_carousel: 'Product Carousel',
    featured_product: 'Featured Product', spacer: 'Spacer', divider: 'Divider', video: 'Video',
    testimonials: 'Testimonials', faq: 'FAQ', banner: 'Banner', ticker: 'Ticker Tape', features: 'Features Grid', custom_html: 'Custom HTML',
    columns: 'Columns Layout', container: 'Container Block',
  };
  return labels[type] || type;
}

function getBlockSummary(block: PageBlock): string {
  const c = block.config;
  switch (block.type) {
    case 'hero': return c.title || 'Untitled hero';
    case 'half_hero': return c.title || 'Untitled half hero';
    case 'heading': return c.text || 'Untitled heading';
    case 'text': return c.text ? c.text.substring(0, 40) + '...' : 'Empty text';
    case 'image': return c.alt || 'Image';
    case 'button': return c.text || 'Button';
    case 'product_grid': return `${c.columns || 4} col, ${c.limit || 8} max`;
    case 'collection_grid': return `${c.columns || 3} col`;
    case 'collection_showcase': return c.title || 'Collection Showcase';
    case 'category_links': return `${(c.collectionIds || []).length} categories`;
    case 'product_carousel': return c.title || 'Product Carousel';
    case 'banner': return c.text || 'Banner';
    case 'spacer': return `${c.height || 40}px`;
    case 'faq': return `${(c.items || []).length} items`;
    case 'testimonials': return `${(c.items || []).length} reviews`;
    case 'columns': return `${c.columns?.length || 0} columns`;
    case 'container': return `${(c.blocks || []).length} inner blocks`;
    default: return '';
  }
}

function getDefaultConfig(type: BlockType): Record<string, any> {
  switch (type) {
    case 'hero': return { title: 'Welcome', subtitle: '', imageUrl: '', ctaText: 'Shop Now', ctaLink: '/shop/products', overlayOpacity: 0.4 };
    case 'half_hero': return { title: '', subtitle: '', imageUrl: '', ctaText: '', ctaLink: '', objectPosition: 'center', height: '600px' };
    case 'heading': return { text: 'Heading', level: 'h2', align: 'center' };
    case 'text': return { text: 'Enter your text here...', align: 'left' };
    case 'image': return { url: '', alt: '', width: '100%', align: 'center' };
    case 'image_gallery': return { images: [], columns: 3, gap: 16 };
    case 'button': return { text: 'Click Me', link: '', style: 'primary', align: 'center', size: 'md' };
    case 'product_grid': return { mode: 'auto', productIds: [], columns: 4, limit: 8 };
    case 'collection_showcase': return { title: 'INTRODUCING THE COLLECTION', subtitle: 'Built for a life in constant motion.', collectionId: '', limit: 5, ctaText: 'SHOP NOW', ctaLink: '/shop/products', titleFont: '', titleColor: '#000000', titleFontSize: 32, titleFontWeight: '800', subtitleColor: '#666666', subtitleFontSize: 16, cardBgColor: '#ffffff', cardTextColor: '#000000', cardRadius: 0 };
    case 'product_carousel': return { title: 'BEST SELLERS', ctaText: 'SHOP NOW', ctaLink: '/shop/products', collectionId: '', limit: 10 };
    case 'featured_product': return { productId: '' };
    case 'spacer': return { height: 40 };
    case 'divider': return { style: 'solid', color: '#e5e7eb', thickness: 1 };
    case 'video': return { url: '', autoplay: false };
    case 'testimonials': return { items: [{ name: '', text: '', rating: 5 }] };
    case 'faq': return { items: [{ question: '', answer: '' }] };
    case 'banner': return { text: 'Banner text', bgColor: '#1a1a2e', textColor: '#ffffff', align: 'center' };
    case 'custom_html': return { html: '' };
    case 'columns': return { columns: [{ blocks: [] }, { blocks: [] }], gap: 16, stackOnMobile: true };
    case 'container': return { blocks: [], padding: '40px', bgColor: 'transparent', maxWidth: '1200px' };
    default: return {};
  }
}
