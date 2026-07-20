import { useState, useEffect, useRef, useCallback, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useAlert } from '@/components/ui/AlertDialog';
import { useNavigate } from 'react-router-dom';
import { BlockEditor } from './BlockEditor';
import * as api from '@/lib/api';
import type { StorePage, PageBlock, BlockType, StoreConfig } from '@/types/database';
import {
  ArrowLeft, Save, Trash2, Plus,
  GripVertical, X, Monitor, Smartphone, Layout, Paintbrush,
  Type, ShoppingCart, ShoppingBag, ShoppingBasket, Menu,
  Layers, ChevronRight, Eye, EyeOff, Undo2, Redo2, Info
} from 'lucide-react';
import './UnifiedBuilder.css';
import '../storefront/StorefrontLayout.css';
import { GlobalSettingsEditor, getResolvedDefaultLinks } from './GlobalSettingsEditor';
import { BLOCK_OPTIONS, CATEGORIES } from './BlockLibrary';
import { StoreConfigContext } from '../storefront/useStoreConfig';
import { BlockContent } from '../storefront/BlockRenderer';
import { SocialIcon } from '../storefront/SocialIcons';
import { StorefrontProducts } from '../storefront/StorefrontProducts';
import { StorefrontCollections } from '../storefront/StorefrontCollections';
import { StorefrontProductDetail } from '../storefront/StorefrontProductDetail';
import { StorefrontCollectionDetail } from '../storefront/StorefrontCollectionDetail';
import { StorefrontGiftCards } from '../storefront/StorefrontGiftCards';

type LeftTab = 'library' | 'layers' | 'settings';
type BuilderPanel = 'brand' | 'typography' | 'header' | 'footer' | 'mobile' | 'products_template' | 'collections_template' | 'product_detail_template' | 'collection_detail_template' | 'checkout_template' | 'cart_sidebar_template' | 'gift_cards_template';

const SETTINGS_PANELS: { key: BuilderPanel; label: string; icon: any }[] = [
  { key: 'brand', label: 'Brand & Colours', icon: Paintbrush },
  { key: 'typography', label: 'Typography', icon: Type },
  { key: 'header', label: 'Header', icon: Layout },
  { key: 'footer', label: 'Footer', icon: Layout },
  { key: 'mobile', label: 'Mobile', icon: Smartphone },
];

// Virtual "system" pages that render live storefront components instead of block editors

export class PreviewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error('Preview error:', error, errorInfo); }
  render() {
    if (this.state.hasError) return <div style={{ padding: 20, color: 'red', zIndex: 9999, position: 'relative' }}><h2>Preview Crashed</h2><pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.message}</pre></div>;
    return this.props.children;
  }
}

const SYSTEM_PAGES: { id: string; page_key: string; title: string; templatePanel: BuilderPanel }[] = [
  { id: '__sys_products', page_key: 'products', title: 'Products', templatePanel: 'products_template' },
  { id: '__sys_collections', page_key: 'collections', title: 'Collections', templatePanel: 'collections_template' },
  { id: '__sys_product_detail', page_key: 'product_detail', title: 'Product Detail', templatePanel: 'product_detail_template' },
  { id: '__sys_collection_detail', page_key: 'collection_detail', title: 'Collection Detail', templatePanel: 'collection_detail_template' },
  { id: '__sys_checkout', page_key: 'checkout', title: 'Checkout', templatePanel: 'checkout_template' },
  { id: '__sys_cart_sidebar', page_key: 'cart_sidebar', title: 'Cart Sidebar', templatePanel: 'cart_sidebar_template' },
  { id: '__sys_gift_cards', page_key: 'gift_cards', title: 'Gift Cards', templatePanel: 'gift_cards_template' },
];

function isSystemPage(pageId: string | undefined): boolean {
  return !!pageId && pageId.startsWith('__sys_');
}

function getSystemPageTemplatePanel(pageId: string | undefined): BuilderPanel | null {
  if (!pageId) return null;
  const sp = SYSTEM_PAGES.find(s => s.id === pageId);
  return sp?.templatePanel || null;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function UnifiedBuilder() {
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useAlert();

  // Active Context
  const [leftTab, setLeftTab] = useState<LeftTab>('layers');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  // Data State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Pages State
  const [pages, setPages] = useState<StorePage[]>([]);
  const [selectedPage, setSelectedPage] = useState<StorePage | null>(null);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);

  // ─── Undo / Redo History ───
  const historyRef = useRef<PageBlock[][]>([]);
  const futureRef = useRef<PageBlock[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((currentBlocks: PageBlock[]) => {
    historyRef.current.push(JSON.parse(JSON.stringify(currentBlocks)));
    if (historyRef.current.length > 50) historyRef.current.shift(); // cap at 50
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const updateBlocks = useCallback((updater: (prev: PageBlock[]) => PageBlock[]) => {
    setBlocks(prev => {
      pushHistory(prev);
      const next = updater(prev);
      return next;
    });
    setHasChanges(true);
  }, [pushHistory]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    setBlocks(prev => {
      futureRef.current.push(JSON.parse(JSON.stringify(prev)));
      const restored = historyRef.current.pop()!;
      setCanUndo(historyRef.current.length > 0);
      setCanRedo(true);
      return restored;
    });
    setHasChanges(true);
  }, []);

  const handleRedo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    setBlocks(prev => {
      historyRef.current.push(JSON.parse(JSON.stringify(prev)));
      const restored = futureRef.current.pop()!;
      setCanUndo(true);
      setCanRedo(futureRef.current.length > 0);
      return restored;
    });
    setHasChanges(true);
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);
  
  // UI Selection State
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<BuilderPanel | null>(null);
  const [editingColumnTarget, setEditingColumnTarget] = useState<{ blockId: string; colIdx: number } | null>(null);
  const [columnLibraryTarget, setColumnLibraryTarget] = useState<{ blockId: string; colIdx: number } | null>(null);
  const [containerLibraryTarget, setContainerLibraryTarget] = useState<string | null>(null);
  const [editingSubBlockId, setEditingSubBlockId] = useState<string | null>(null);

  // Layers tree expand state
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());

  // Drag State
  const dragSrcRef = useRef<number | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<'above' | 'below'>('below');
  const [isCanvasDragOver, setIsCanvasDragOver] = useState(false);
  const [paletteDragType, setPaletteDragType] = useState<string | null>(null);
  const blocksWrapperRef = useRef<HTMLDivElement>(null);

  // Settings State
  const [, setConfig] = useState<StoreConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<Partial<StoreConfig>>({});

  useEffect(() => {
    Promise.all([api.fetchStorePages(), api.fetchStoreConfig()])
      .then(([p, cfg]) => {
        // Filter out database pages whose page_key or title duplicates a system page
        const systemKeys = new Set(SYSTEM_PAGES.map(sp => sp.page_key));
        const systemTitles = new Set(SYSTEM_PAGES.map(sp => sp.title.toLowerCase()));
        // Also filter common title variants
        const extraTitles = new Set(['products list', 'thank you']);
        const filteredDbPages = p.filter(pg => {
          if (systemKeys.has(pg.page_key)) return false;
          const lowerTitle = pg.title.toLowerCase();
          if (systemTitles.has(lowerTitle)) return false;
          if (extraTitles.has(lowerTitle)) return false;
          return true;
        });
        // Merge system pages into the pages list
        const allPages = [...filteredDbPages, ...SYSTEM_PAGES.map(sp => ({
          ...sp,
          blocks: [],
          is_published: true,
          created_at: '',
          updated_at: '',
        } as StorePage))];
        setPages(allPages);
        if (allPages.length > 0) {
          setSelectedPage(allPages[0]);
          setBlocks(allPages[0].blocks || []);
        }
        setConfig(cfg);
        setDraftConfig(cfg);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

  }, []);

  const selectPage = useCallback(async (pageId: string) => {
    if (hasChanges) {
      const ok = await showConfirm({ title: 'Unsaved Changes', message: 'You have unsaved changes. Switch page anyway?', variant: 'warning', confirmLabel: 'Switch Page' });
      if (!ok) return;
    }
    const page = pages.find(p => p.id === pageId);
    if (!page) return;
    setSelectedPage(page);
    setBlocks(page.blocks || []);
    setEditingBlockId(null);
    setHasChanges(false);
    // If it's a system page, auto-open the template editor panel
    const tplPanel = getSystemPageTemplatePanel(pageId);
    setActivePanel(tplPanel);
  }, [hasChanges, pages, showConfirm]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedPage && !isSystemPage(selectedPage.id)) {
        const updatedPage = await api.updateStorePage(selectedPage.id, { blocks });
        setPages(prev => prev.map(p => p.id === updatedPage.id ? updatedPage : p));
        setSelectedPage(updatedPage);
      }
      if (draftConfig) {
        const savedConfig = await api.updateStoreConfig(draftConfig as any);
        setConfig(savedConfig);
        setDraftConfig(savedConfig);
      }
      setHasChanges(false);
      showAlert({ title: 'Saved', message: 'Changes saved successfully.', variant: 'success' });
    } catch (err) {
      console.error('Save failed:', err);
      showAlert({ title: 'Error', message: 'Failed to save changes.', variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Block Operations ───
  const addBlock = (type: BlockType, index?: number) => {
    const newBlock: PageBlock = { id: generateId(), type, config: getDefaultConfig(type) };
    updateBlocks(prev => {
      const copy = [...prev];
      if (index !== undefined) copy.splice(index, 0, newBlock);
      else copy.push(newBlock);
      return copy;
    });
    setEditingBlockId(newBlock.id);
    setActivePanel(null);
  };

  const removeBlock = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    updateBlocks(prev => prev.filter(b => b.id !== id));
    if (editingBlockId === id) setEditingBlockId(null);
  };

  // ─── Native Canvas Drag & Drop ───
  const handlePaletteDragStart = (e: React.DragEvent, type: BlockType) => {
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
    setPaletteDragType(type);
  };

  const handlePaletteDragEnd = () => {
    setPaletteDragType(null);
    setDragTargetIndex(null);
    setIsCanvasDragOver(false);
  };

  const handleBlockDragStart = (e: React.DragEvent, index: number) => {
    dragSrcRef.current = index;
    e.dataTransfer.setData('text/plain', '__reorder__');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleBlockDragEnd = () => {
    dragSrcRef.current = null;
    setDragTargetIndex(null);
  };

  const handleBlockDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragTargetIndex(index);
    setDragPosition(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below');
  };

  const handleBlockDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData('text/plain');
    const insertAt = dragPosition === 'above' ? targetIndex : targetIndex + 1;

    if (data === '__reorder__' && dragSrcRef.current != null) {
      const fromIdx = dragSrcRef.current;
      if (fromIdx === targetIndex) {
        setDragTargetIndex(null);
        return;
      }
      setBlocks(prev => {
        const copy = [...prev];
        const [moved] = copy.splice(fromIdx, 1);
        const adjustedInsertAt = fromIdx < insertAt ? insertAt - 1 : insertAt;
        copy.splice(adjustedInsertAt, 0, moved);
        return copy;
      });
      setHasChanges(true);
    } else if (data && data !== '__reorder__') {
      addBlock(data as BlockType, insertAt);
    }
    setDragTargetIndex(null);
    setPaletteDragType(null);
  };

  // Wrapper-level drag handler: finds nearest gap between blocks
  const handleWrapperDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const wrapper = blocksWrapperRef.current;
    if (!wrapper) return;
    const blockEls = wrapper.querySelectorAll(':scope > div > .ub-preview-block');
    if (blockEls.length === 0) return;

    const y = e.clientY;
    let closest = -1;
    let closestPos: 'above' | 'below' = 'below';
    let minDist = Infinity;

    blockEls.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const dist = Math.abs(y - midY);
      if (dist < minDist) {
        minDist = dist;
        closest = idx;
        closestPos = y < midY ? 'above' : 'below';
      }
    });

    if (closest >= 0) {
      setDragTargetIndex(closest);
      setDragPosition(closestPos);
    }
  };

  const handleWrapperDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) {
      setDragTargetIndex(null);
      setPaletteDragType(null);
      return;
    }

    let insertAt: number;
    if (dragTargetIndex != null) {
      insertAt = dragPosition === 'above' ? dragTargetIndex : dragTargetIndex + 1;
    } else {
      insertAt = blocks.length;
    }

    if (data === '__reorder__' && dragSrcRef.current != null) {
      const fromIdx = dragSrcRef.current;
      setBlocks(prev => {
        const copy = [...prev];
        const [moved] = copy.splice(fromIdx, 1);
        const adjustedInsertAt = fromIdx < insertAt ? insertAt - 1 : insertAt;
        copy.splice(adjustedInsertAt, 0, moved);
        return copy;
      });
      setHasChanges(true);
    } else {
      addBlock(data as BlockType, insertAt);
    }
    setDragTargetIndex(null);
    setPaletteDragType(null);
    dragSrcRef.current = null;
  };

  // Ghost preview helper
  const isPaletteDrag = paletteDragType !== null;
  const ghostOption = paletteDragType ? BLOCK_OPTIONS.find(o => o.type === paletteDragType) : null;
  const DropGhost = () => ghostOption ? (
    <div className="ub-drop-ghost">
      <div className="ub-drop-ghost-icon">{ghostOption.icon}</div>
      <div className="ub-drop-ghost-text">
        <span className="ub-drop-ghost-label">{ghostOption.label}</span>
        <span className="ub-drop-ghost-desc">{ghostOption.description}</span>
      </div>
    </div>
  ) : null;

  const updateBlockConfig = (id: string, c: Record<string, any>) => {
    updateBlocks(prev => prev.map(b => (b.id === id ? { ...b, config: c } : b)));
  };

  // ─── Column Operations ───
  const normalizeCol = (col: any) => Array.isArray(col) ? { blocks: col } : col;

  const addBlockToColumn = (parentBlockId: string, colIdx: number, type: BlockType) => {
    const newBlock: PageBlock = { id: generateId(), type, config: getDefaultConfig(type) };
    setBlocks(prev => prev.map(b => {
      if (b.id !== parentBlockId || b.type !== 'columns') return b;
      const cols = [...(b.config.columns || [])].map(normalizeCol);
      cols[colIdx] = { ...cols[colIdx], blocks: [...(cols[colIdx].blocks || []), newBlock] };
      return { ...b, config: { ...b.config, columns: cols } };
    }));
    setColumnLibraryTarget(null);
    setHasChanges(true);
  };

  const removeBlockFromColumn = (parentBlockId: string, colIdx: number, blockId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== parentBlockId || b.type !== 'columns') return b;
      const cols = [...(b.config.columns || [])].map(normalizeCol);
      cols[colIdx] = { ...cols[colIdx], blocks: (cols[colIdx].blocks || []).filter((sb: PageBlock) => sb.id !== blockId) };
      return { ...b, config: { ...b.config, columns: cols } };
    }));
    setHasChanges(true);
  };

  const updateColumnStyle = (parentBlockId: string, colIdx: number, styles: Record<string, any>) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== parentBlockId || b.type !== 'columns') return b;
      const cols = [...(b.config.columns || [])].map(normalizeCol);
      cols[colIdx] = { ...cols[colIdx], ...styles };
      return { ...b, config: { ...b.config, columns: cols } };
    }));
    setHasChanges(true);
  };

  const updateSubBlockConfig = (parentBlockId: string, colIdx: number, subBlockId: string, config: Record<string, any>) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== parentBlockId || b.type !== 'columns') return b;
      const cols = [...(b.config.columns || [])].map(normalizeCol);
      cols[colIdx] = {
        ...cols[colIdx],
        blocks: (cols[colIdx].blocks || []).map((sb: PageBlock) => sb.id === subBlockId ? { ...sb, config } : sb)
      };
      return { ...b, config: { ...b.config, columns: cols } };
    }));
    setHasChanges(true);
  };

  // ─── Container Operations ───
  const addBlockToContainer = (parentBlockId: string, type: BlockType) => {
    const newBlock: PageBlock = { id: generateId(), type, config: getDefaultConfig(type) };
    setBlocks(prev => prev.map(b => {
      if (b.id !== parentBlockId || b.type !== 'container') return b;
      return { ...b, config: { ...b.config, blocks: [...(b.config.blocks || []), newBlock] } };
    }));
    setContainerLibraryTarget(null);
    setHasChanges(true);
  };

  const removeBlockFromContainer = (parentBlockId: string, blockId: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== parentBlockId || b.type !== 'container') return b;
      return { ...b, config: { ...b.config, blocks: (b.config.blocks || []).filter((sb: PageBlock) => sb.id !== blockId) } };
    }));
    if (editingSubBlockId === blockId) setEditingSubBlockId(null);
    setHasChanges(true);
  };

  const updateContainerSubBlockConfig = (parentBlockId: string, subBlockId: string, config: Record<string, any>) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== parentBlockId || b.type !== 'container') return b;
      return {
        ...b,
        config: {
          ...b.config,
          blocks: (b.config.blocks || []).map((sb: PageBlock) => sb.id === subBlockId ? { ...sb, config } : sb)
        }
      };
    }));
    setHasChanges(true);
  };

  const updateDraft = (updates: Partial<StoreConfig>) => {
    setDraftConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  if (loading) return <div className="ub-loading">Loading builder...</div>;

  const editingBlock = blocks.find(b => b.id === editingBlockId) || null;

  // ─── Storefront Global Render Props ───
  const headerLayout: any = draftConfig?.header_layout || {};
  const navLinks = headerLayout.nav_links || [];
  const showAnnouncement = draftConfig?.announcement_bar_active && 
    (draftConfig?.announcement_bar_text || headerLayout.ticker_messages?.length > 0);

  const hBg = headerLayout.bg_color || '#ffffff';
  const hColor = headerLayout.nav_color || '#000000';
  const hFont = headerLayout.nav_font && headerLayout.nav_font !== 'inherit' ? `"${headerLayout.nav_font}", sans-serif` : 'inherit';
  const cartIconColor = headerLayout.cart_icon_color || hColor;
  const hWeight = headerLayout.nav_weight || '500';
  
  const annBg = headerLayout.announcement_bg_color || '#000000';
  const annColor = headerLayout.announcement_text_color || '#ffffff';
  const annFont = headerLayout.announcement_font || 'inherit';

  const isTicker = headerLayout.announcement_type === 'ticker';
  const tickerSpacing = headerLayout.ticker_spacing || 50;
  const tickerSpeed = headerLayout.ticker_speed || 20;
  const tickerRepeat = headerLayout.ticker_repeat || 5;
  const tickerMessages = headerLayout.ticker_messages?.length > 0 
      ? headerLayout.ticker_messages 
      : [draftConfig?.announcement_bar_text].filter(Boolean);
  
  const repeatedContent: string[] = [];
  for (let i = 0; i < tickerRepeat; i++) {
    repeatedContent.push(...tickerMessages);
  }

  const CartIconCmp = headerLayout.cart_icon_type === 'ShoppingBag' ? ShoppingBag :
                      headerLayout.cart_icon_type === 'ShoppingBasket' ? ShoppingBasket : ShoppingCart;

  const builderMobileCfg = (draftConfig as any)?.mobile_settings || {};
  const themeVars: Record<string, string> = {
    '--sf-primary': draftConfig?.color_primary || '#2563eb',
    '--sf-secondary': draftConfig?.color_secondary || '#1e40af',
    '--sf-accent': draftConfig?.color_accent || '#f59e0b',
    '--sf-bg': draftConfig?.color_background || '#ffffff',
    '--sf-surface': draftConfig?.color_surface || '#f8fafc',
    '--sf-text': draftConfig?.color_text || '#0f172a',
    '--sf-text-secondary': draftConfig?.color_text_secondary || '#64748b',
    '--sf-font-heading': draftConfig?.font_heading || 'Inter',
    '--sf-font-body': draftConfig?.font_body || 'Inter',
    // Mobile config vars
    '--sf-mobile-product-cols': String(builderMobileCfg.mobileProductColumns || 2),
    '--sf-phone-product-cols': String(builderMobileCfg.phoneProductColumns || 1),
    '--sf-mobile-collection-cols': String(builderMobileCfg.mobileCollectionColumns || 2),
    '--sf-mobile-padding': builderMobileCfg.mobilePadding === 'compact' ? '0.75rem' : builderMobileCfg.mobilePadding === 'spacious' ? '1.5rem' : '1rem',
  };

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
      <div className={`unified-builder-root builder-desktop-wrapper${isPreviewMode ? ' preview-mode' : ''}`} style={themeVars as React.CSSProperties}>
      {/* ─── LEFT SIDEBAR ─── */}
      <div className="ub-left-sidebar">
        <div className="ub-left-header">
          <button className="ub-back-btn" onClick={() => navigate('/store')}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ fontWeight: 600 }}>Store Builder</div>
        </div>
        
        <div className="ub-tabs">
          <button className={`ub-tab ${leftTab === 'library' ? 'active' : ''}`} onClick={() => { setLeftTab('library'); setActivePanel(null); }}>Library</button>
          <button className={`ub-tab ${leftTab === 'layers' ? 'active' : ''}`} onClick={() => { setLeftTab('layers'); setActivePanel(null); }}>Layers</button>
          <button className={`ub-tab ${leftTab === 'settings' ? 'active' : ''}`} onClick={() => { setLeftTab('settings'); setEditingBlockId(null); }}>Settings</button>
        </div>

        <div className="ub-sidebar-content">
          {leftTab === 'library' && (
            <div className="ub-library-tab">
              <div className="ub-blocks-header"><span>Drag blocks into canvas</span></div>
              {CATEGORIES.map((cat) => {
                const options = BLOCK_OPTIONS.filter((o) => o.category === cat);
                if (options.length === 0) return null;
                return (
                  <div key={cat} className="ub-library-category" style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>{cat}</h4>
                    <div className="ub-library-grid">
                      {options.map((opt) => (
                        <div
                          key={opt.type}
                          className="ub-library-item"
                          draggable
                          onDragStart={(e) => handlePaletteDragStart(e, opt.type as BlockType)}
                          onDragEnd={handlePaletteDragEnd}
                          onClick={() => addBlock(opt.type as BlockType)} 
                        >
                          <div className="ub-library-icon">{opt.icon}</div>
                          <div className="ub-library-label">{opt.label}</div>
                          <div className="ub-library-desc">{opt.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {leftTab === 'layers' && (
            <div>
              <div className="ub-blocks-header"><span><Layers size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{blocks.length} Layers</span></div>
              <div className="ub-layers-tree">
                {/* Global Header pinned to top */}
                <div className={`ub-layer-node global ${activePanel === 'header' ? 'editing' : ''}`} onClick={() => { setActivePanel('header'); setEditingBlockId(null); setLeftTab('settings'); }}>
                  <div className="ub-layer-row">
                    <span className="ub-layer-indent" />
                    <span className="ub-layer-title global">Global Header</span>
                    <span className="ub-layer-badge">Global</span>
                  </div>
                </div>

                {blocks.map((block, i) => {
                  const isExpanded = expandedLayers.has(block.id);
                  const isColumns = block.type === 'columns';
                  const isContainer = block.type === 'container';
                  const cols = isColumns ? (block.config.columns || []).map((col: any) => Array.isArray(col) ? { blocks: col } : col) : [];
                  const containerBlocks: PageBlock[] = isContainer ? (block.config.blocks || []) : [];
                  const hasChildren = (isColumns && cols.length > 0) || (isContainer && containerBlocks.length > 0);

                  return (
                    <div key={block.id} className="ub-layer-group">
                      {dragTargetIndex === i && dragPosition === 'above' && <div className="ub-drop-indicator" />}
                      <div
                        className={`ub-layer-node ${editingBlockId === block.id && !editingColumnTarget ? 'editing' : ''}`}
                        draggable
                        onDragStart={(e) => handleBlockDragStart(e, i)}
                        onDragEnd={handleBlockDragEnd}
                        onDragOver={(e) => handleBlockDragOver(e, i)}
                        onDrop={(e) => handleBlockDrop(e, i)}
                      >
                        <div className="ub-layer-row" onClick={() => { setEditingBlockId(block.id); setActivePanel(null); setEditingColumnTarget(null); setEditingSubBlockId(null); }}>
                          {hasChildren ? (
                            <button className={`ub-layer-toggle ${isExpanded ? 'expanded' : ''}`} onClick={(e) => {
                              e.stopPropagation();
                              setExpandedLayers(prev => {
                                const next = new Set(prev);
                                if (next.has(block.id)) next.delete(block.id); else next.add(block.id);
                                return next;
                              });
                            }}>
                              <ChevronRight size={12} />
                            </button>
                          ) : (
                            <span className="ub-layer-indent" />
                          )}
                          <div className="ub-layer-drag"><GripVertical size={12} /></div>
                          <span className="ub-layer-title">{getBlockLabel(block.type)}</span>
                          <div className="ub-layer-actions">
                            <button className="ub-layer-action-btn danger" onClick={(e) => removeBlock(block.id, e)}><Trash2 size={11} /></button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded column children */}
                      {hasChildren && isExpanded && cols.map((col: any, colIdx: number) => {
                        const colBlocks: PageBlock[] = col.blocks || [];
                        const colKey = `${block.id}-col-${colIdx}`;
                        const isColExpanded = expandedLayers.has(colKey);
                        const isColSelected = editingColumnTarget?.blockId === block.id && editingColumnTarget?.colIdx === colIdx;

                        return (
                          <div key={colIdx} className="ub-layer-group">
                            <div className={`ub-layer-node depth-1 ${isColSelected ? 'editing' : ''}`}>
                              <div className="ub-layer-row" onClick={() => {
                                setEditingColumnTarget({ blockId: block.id, colIdx });
                                setEditingBlockId(block.id);
                                setActivePanel(null);
                                setEditingSubBlockId(null);
                              }}>
                                {colBlocks.length > 0 ? (
                                  <button className={`ub-layer-toggle ${isColExpanded ? 'expanded' : ''}`} onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedLayers(prev => {
                                      const next = new Set(prev);
                                      if (next.has(colKey)) next.delete(colKey); else next.add(colKey);
                                      return next;
                                    });
                                  }}>
                                    <ChevronRight size={12} />
                                  </button>
                                ) : (
                                  <span className="ub-layer-indent" />
                                )}
                                <span className="ub-layer-title">Column {colIdx + 1}</span>
                                <span className="ub-layer-badge">{colBlocks.length}</span>
                              </div>
                            </div>

                            {/* Sub-blocks inside column */}
                            {isColExpanded && colBlocks.map((sb: PageBlock) => (
                              <div
                                key={sb.id}
                                className={`ub-layer-node depth-2 ${editingSubBlockId === sb.id ? 'editing' : ''}`}
                              >
                                <div className="ub-layer-row" onClick={() => {
                                  setEditingColumnTarget({ blockId: block.id, colIdx });
                                  setEditingBlockId(block.id);
                                  setEditingSubBlockId(sb.id);
                                  setActivePanel(null);
                                }}>
                                  <span className="ub-layer-indent" />
                                  <span className="ub-layer-title">{getBlockLabel(sb.type)}</span>
                                  <div className="ub-layer-actions">
                                    <button className="ub-layer-action-btn danger" onClick={(e) => { e.stopPropagation(); removeBlockFromColumn(block.id, colIdx, sb.id); }}><Trash2 size={11} /></button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {/* Container children */}
                      {isContainer && isExpanded && containerBlocks.map((sb: PageBlock) => (
                        <div
                          key={sb.id}
                          className={`ub-layer-node depth-1 ${editingSubBlockId === sb.id ? 'editing' : ''}`}
                        >
                          <div className="ub-layer-row" onClick={() => {
                            setEditingBlockId(block.id);
                            setEditingSubBlockId(sb.id);
                            setEditingColumnTarget(null);
                            setActivePanel(null);
                          }}>
                            <span className="ub-layer-indent" />
                            <span className="ub-layer-title">{getBlockLabel(sb.type)}</span>
                            <div className="ub-layer-actions">
                              <button className="ub-layer-action-btn danger" onClick={(e) => { e.stopPropagation(); removeBlockFromContainer(block.id, sb.id); }}><Trash2 size={11} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {dragTargetIndex === i && dragPosition === 'below' && <div className="ub-drop-indicator" />}
                    </div>
                  );
                })}

                {/* Global Footer pinned to bottom */}
                <div className={`ub-layer-node global ${activePanel === 'footer' ? 'editing' : ''}`} onClick={() => { setActivePanel('footer'); setEditingBlockId(null); setLeftTab('settings'); }}>
                  <div className="ub-layer-row">
                    <span className="ub-layer-indent" />
                    <span className="ub-layer-title global">Global Footer</span>
                    <span className="ub-layer-badge">Global</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {leftTab === 'settings' && (
            <div className="ub-settings-list">
              {SETTINGS_PANELS.map(panel => {
                const Icon = panel.icon;
                return (
                  <div 
                    key={panel.key}
                    className={`ub-setting-item ${activePanel === panel.key ? 'active' : ''}`}
                    onClick={() => { setActivePanel(panel.key); setEditingBlockId(null); }}
                  >
                    <Icon size={16} />
                    <span>{panel.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── CENTER NATIVE CANVAS ─── */}
      <div className="ub-center-canvas">
        <div className="ub-canvas-topbar" style={{ flexShrink: 0 }}>
          <div className="ub-canvas-controls">
            <div className="ub-page-selector" style={{ margin: 0, width: '200px' }}>
              <select value={selectedPage?.id || ''} onChange={(e) => selectPage(e.target.value)} style={{ padding: '6px 10px' }}>
                {pages.filter(p => !isSystemPage(p.id)).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                <optgroup label="System Pages">
                  {pages.filter(p => isSystemPage(p.id)).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="ub-device-toggles">
              <button className={`ub-device-btn ${previewMode === 'desktop' ? 'active' : ''}`} onClick={() => setPreviewMode('desktop')}><Monitor size={16} /></button>
              <button className={`ub-device-btn ${previewMode === 'mobile' ? 'active' : ''}`} onClick={() => setPreviewMode('mobile')}><Smartphone size={16} /></button>
            </div>
          </div>
          <div className="ub-canvas-actions">
            {hasChanges && <span className="ub-unsaved-badge">Unsaved changes</span>}
            <button className="ub-preview-btn" onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ opacity: canUndo ? 1 : 0.4 }}>
              <Undo2 size={14} />
            </button>
            <button className="ub-preview-btn" onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={{ opacity: canRedo ? 1 : 0.4 }}>
              <Redo2 size={14} />
            </button>
            <button className="ub-preview-btn" onClick={() => setIsPreviewMode(p => !p)}>
              {isPreviewMode ? <EyeOff size={14} /> : <Eye size={14} />}
              {isPreviewMode ? 'Exit Preview' : 'Preview'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !hasChanges}>
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        
        <div className="ub-canvas-scroll">
          <div className={`ub-canvas-body ${previewMode}`}>
            <StoreConfigContext.Provider value={{ config: draftConfig as StoreConfig, loading: false, formatPrice: (p) => `${draftConfig.currency_symbol || '£'}${Number(p).toFixed(2)}` }}>
              <div 
                className="sf-builder-mock-container"
                onDragOver={e => { e.preventDefault(); setIsCanvasDragOver(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setIsCanvasDragOver(false); setDragTargetIndex(null); } }}
              >
                
                {/* Global Announcement bar */}
                {showAnnouncement && (
                  <div 
                    className={`sf-announcement sf-builder-global ${activePanel === 'header' ? 'editing' : ''}`} 
                    style={{ backgroundColor: annBg, color: annColor, fontFamily: annFont }}
                    onClick={() => { setActivePanel('header'); setEditingBlockId(null); setLeftTab('settings'); }}
                  >
                    {isTicker ? (
                      <div className="sf-announcement-ticker-wrap">
                        <div className="sf-marquee" style={{ gap: `${tickerSpacing}px`, paddingRight: `${tickerSpacing}px`, animationDuration: `${tickerSpeed}s` }}>
                          {repeatedContent.map((msg, i) => <span key={i}>{msg}</span>)}
                        </div>
                        <div className="sf-marquee" style={{ gap: `${tickerSpacing}px`, paddingRight: `${tickerSpacing}px`, animationDuration: `${tickerSpeed}s` }}>
                          {repeatedContent.map((msg, i) => <span key={`dup-${i}`}>{msg}</span>)}
                        </div>
                      </div>
                    ) : (
                      draftConfig.announcement_bar_text
                    )}
                  </div>
                )}

                {/* Global Header */}
                <header 
                   className={`sf-header logo-${headerLayout.logo_position || 'left'} sf-builder-global ${activePanel === 'header' ? 'editing' : ''}`} 
                   style={{ backgroundColor: hBg, color: hColor, fontFamily: hFont }}
                   onClick={() => { setActivePanel('header'); setEditingBlockId(null); setLeftTab('settings'); }}
                >
                  <div className="sf-header-inner">
                    <button className="sf-mobile-menu-btn" style={{ color: hColor }}><Menu size={24} /></button>
                    <div className="sf-logo" style={{ pointerEvents: 'none' }}>
                      {draftConfig?.logo_url ? (
                        <img src={draftConfig.logo_url} alt={draftConfig.store_name} className="sf-logo-img" />
                      ) : (
                        <span className="sf-logo-text" style={{ color: hColor }}>{draftConfig?.store_name || 'Store'}</span>
                      )}
                    </div>
                    <nav className="sf-nav" style={{ pointerEvents: 'none' }}>
                      {getResolvedDefaultLinks(headerLayout).filter(dl => !dl.hidden).map(dl => (
                        <span key={dl.key} className="sf-nav-link" style={{ color: hColor, fontWeight: hWeight }}>{dl.label}</span>
                      ))}
                      {navLinks.map((link: any, i: number) => (
                         <span key={i} className="sf-nav-link" style={{ color: hColor, fontWeight: hWeight }}>{link.label}</span>
                      ))}
                    </nav>
                    <button className="sf-cart-btn" style={{ color: cartIconColor }}><CartIconCmp size={22} /></button>
                  </div>
                </header>

                {/* Page Blocks Area */}
                <main
                  className="sf-main"
                  style={{ minHeight: '400px', backgroundColor: 'var(--sf-bg)' }}
                  onDragOver={!isSystemPage(selectedPage?.id) ? (e => { e.preventDefault(); setIsCanvasDragOver(true); }) : undefined}
                  onDragLeave={!isSystemPage(selectedPage?.id) ? (e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setIsCanvasDragOver(false); setDragTargetIndex(null); } }) : undefined}
                  onDrop={!isSystemPage(selectedPage?.id) ? (e => { e.preventDefault(); e.stopPropagation(); handleWrapperDrop(e); setIsCanvasDragOver(false); }) : undefined}
                >
                  {isSystemPage(selectedPage?.id) ? (
                    /* ─── System Page Preview ─── */
                    <div className="ub-system-page-preview">
                      <div className="ub-system-page-banner">
                        <Info size={16} />
                        <span>This is a system-generated page. Use the settings panel on the right to customise its template.</span>
                      </div>
                      <PreviewErrorBoundary>
                        <div style={{ pointerEvents: 'none' }}>
                          {selectedPage?.page_key === 'products' && <StorefrontProducts />}
                          {selectedPage?.page_key === 'collections' && <StorefrontCollections />}
                          {selectedPage?.page_key === 'product_detail' && <StorefrontProductDetail previewSlug="preview" />}
                          {selectedPage?.page_key === 'collection_detail' && <StorefrontCollectionDetail previewSlug="preview" />}
                          {selectedPage?.page_key === 'checkout' && (
                          <div className="ub-checkout-preview">
                            <div className="sf-checkout" style={{ pointerEvents: 'auto' }}>
                              <div className="sf-checkout-form">
                                <div className="sf-checkout-section">
                                  <h3>Contact Information</h3>
                                  <div className="sf-checkout-field"><label>Email *</label><input type="email" placeholder="email@example.com" readOnly /></div>
                                  <div className="form-row">
                                    <div className="sf-checkout-field"><label>Full Name *</label><input type="text" placeholder="John Doe" readOnly /></div>
                                    <div className="sf-checkout-field"><label>Phone</label><input type="tel" placeholder="+44 7700 900000" readOnly /></div>
                                  </div>
                                </div>
                                <div className="sf-checkout-section">
                                  <h3>Shipping Address</h3>
                                  <div className="sf-checkout-field"><label>Address Line 1 *</label><input type="text" placeholder="123 Main Street" readOnly /></div>
                                  <div className="sf-checkout-field"><label>Address Line 2</label><input type="text" placeholder="" readOnly /></div>
                                  <div className="form-row">
                                    <div className="sf-checkout-field"><label>City *</label><input type="text" placeholder="London" readOnly /></div>
                                    <div className="sf-checkout-field"><label>Postcode *</label><input type="text" placeholder="SW1A 1AA" readOnly /></div>
                                  </div>
                                </div>
                                <div className="sf-checkout-section">
                                  <h3>Shipping Method</h3>
                                  <div className="sf-shipping-options">
                                    <div className="sf-shipping-option selected">
                                      <input type="radio" checked readOnly />
                                      <div className="sf-shipping-option-info">
                                        <div className="sf-shipping-option-name">Standard Shipping</div>
                                        <div className="sf-shipping-option-est">3–5 business days</div>
                                      </div>
                                      <div className="sf-shipping-option-price">{draftConfig?.currency_symbol || '£'}4.99</div>
                                    </div>
                                  </div>
                                </div>
                                <div className="sf-checkout-section">
                                  <h3>Payment</h3>
                                  <div className="sf-stripe-card-wrapper" style={{ minHeight: 44, display: 'flex', alignItems: 'center', color: '#9ca3af', fontSize: '0.9375rem' }}>
                                    •••• •••• •••• •••• &nbsp;&nbsp; MM/YY &nbsp;&nbsp; CVC
                                  </div>
                                </div>
                                <button className="sf-place-order-btn">Place Order — {draftConfig?.currency_symbol || '£'}24.98</button>
                              </div>
                              <div className="sf-order-summary">
                                <h3>Order Summary</h3>
                                <div className="sf-summary-item">
                                  <div className="sf-summary-item-image" style={{ background: 'var(--sf-surface, #1a1a2e)' }} />
                                  <div className="sf-summary-item-info">
                                    <div className="sf-summary-item-name">Sample Product</div>
                                    <div className="sf-summary-item-qty">Qty: 1</div>
                                  </div>
                                  <div className="sf-summary-item-total">{draftConfig?.currency_symbol || '£'}19.99</div>
                                </div>
                                <div className="sf-summary-totals">
                                  <div className="sf-summary-row"><span>Subtotal</span><span>{draftConfig?.currency_symbol || '£'}19.99</span></div>
                                  <div className="sf-summary-row"><span>Shipping</span><span>{draftConfig?.currency_symbol || '£'}4.99</span></div>
                                  <div className="sf-summary-row total"><span>Total</span><span>{draftConfig?.currency_symbol || '£'}24.98</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                          {selectedPage?.page_key === 'gift_cards' && <StorefrontGiftCards />}
                        {selectedPage?.page_key === 'cart_sidebar' && (
                          <div className="ub-cart-sidebar-preview">
                            <div className="cart-panel" style={{ position: 'relative', transform: 'none', width: '100%', maxWidth: 420, margin: '16px auto', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', borderRadius: 12 }}>
                              <div className="cart-header">
                                <h3>Your Cart (2)</h3>
                                <button className="cart-close-btn"><X size={20} /></button>
                              </div>
                              <div className="cart-items">
                                <div className="cart-item">
                                  <div className="cart-item-image-placeholder" />
                                  <div className="cart-item-info">
                                    <div className="cart-item-name">Sample Product</div>
                                    <div className="cart-item-variant">Variant A</div>
                                    <div className="cart-item-bottom">
                                      <div className="cart-qty-controls">
                                        <button className="cart-qty-btn">−</button>
                                        <span className="cart-qty-val">1</span>
                                        <button className="cart-qty-btn">+</button>
                                      </div>
                                      <span className="cart-item-price">{draftConfig?.currency_symbol || '£'}19.99</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="cart-footer">
                                <div className="cart-subtotal">
                                  <span>Subtotal</span>
                                  <span>{draftConfig?.currency_symbol || '£'}19.99</span>
                                </div>
                                <button className="cart-checkout-btn">Proceed to Checkout</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      </PreviewErrorBoundary>
                    </div>
                  ) : blocks.length === 0 ? (
                    <div className={`ub-canvas-empty${isCanvasDragOver ? ' drag-over' : ''}`}>
                      {isPaletteDrag ? <DropGhost /> : <div className="ub-canvas-empty-text">Drag blocks here from the Library to build your page.</div>}
                    </div>
                  ) : (
                    <div
                      className={`ub-native-blocks-wrapper${isCanvasDragOver ? ' drag-over' : ''}`}
                      ref={blocksWrapperRef}
                      onDragOver={handleWrapperDragOver}
                    >
                      {blocks.map((block, idx) => (
                        <div key={block.id}>
                          {dragTargetIndex === idx && dragPosition === 'above' && (isPaletteDrag ? <DropGhost /> : <div className="ub-preview-drop-indicator" />)}
                          <div
                            className={`ub-preview-block ${editingBlockId === block.id ? 'editing' : ''} ${dragSrcRef.current === idx ? 'dragging' : ''}`}
                            data-block-label={getBlockLabel(block.type).toUpperCase()}
                            onClick={(e) => { e.stopPropagation(); setEditingBlockId(block.id); setActivePanel(null); setEditingColumnTarget(null); setEditingSubBlockId(null); }}
                            draggable
                            onDragStart={(e) => handleBlockDragStart(e, idx)}
                            onDragEnd={handleBlockDragEnd}
                            onDragOver={(e) => handleBlockDragOver(e, idx)}
                            onDrop={(e) => handleBlockDrop(e, idx)}
                          >
                            <div className="ub-preview-block-overlay">
                              <div className="ub-preview-block-handle" style={{ cursor: 'grab' }}><GripVertical size={16} /></div>
                              <div className="ub-preview-block-actions">
                                <button className="ub-preview-block-btn danger" onClick={(e) => removeBlock(block.id, e)}><Trash2 size={14} /></button>
                              </div>
                            </div>
                            {block.type === 'columns' ? (
                              <ColumnsCanvasBlock
                                block={block}
                                editingColumnTarget={editingColumnTarget}
                                columnLibraryTarget={columnLibraryTarget}
                                isMobile={previewMode === 'mobile'}
                                onColumnClick={(colIdx) => {
                                  setEditingColumnTarget({ blockId: block.id, colIdx });
                                  setEditingBlockId(block.id);
                                  setActivePanel(null);
                                }}
                                onColumnDrop={(colIdx, type) => addBlockToColumn(block.id, colIdx, type as BlockType)}
                                onAddClick={(colIdx) => {
                                  setColumnLibraryTarget({ blockId: block.id, colIdx });
                                  setEditingBlockId(block.id);
                                  setActivePanel(null);
                                }}
                                onLibrarySelect={(colIdx, type) => addBlockToColumn(block.id, colIdx, type as BlockType)}
                                onLibraryClose={() => setColumnLibraryTarget(null)}
                                onSubBlockClick={(colIdx, subBlockId) => {
                                  setEditingColumnTarget({ blockId: block.id, colIdx });
                                  setEditingBlockId(block.id);
                                  setEditingSubBlockId(subBlockId);
                                  setActivePanel(null);
                                }}
                                onSubBlockRemove={(colIdx, subBlockId) => removeBlockFromColumn(block.id, colIdx, subBlockId)}
                              />
                            ) : block.type === 'container' ? (
                              <ContainerCanvasBlock
                                block={block}
                                containerLibraryTarget={containerLibraryTarget}
                                onSubBlockClick={(subBlockId) => {
                                  setEditingBlockId(block.id);
                                  setEditingSubBlockId(subBlockId);
                                  setEditingColumnTarget(null);
                                  setActivePanel(null);
                                }}
                                onSubBlockRemove={(subBlockId) => removeBlockFromContainer(block.id, subBlockId)}
                                onBlockDrop={(type) => addBlockToContainer(block.id, type as BlockType)}
                                onAddClick={() => {
                                  setContainerLibraryTarget(block.id);
                                  setEditingBlockId(block.id);
                                  setActivePanel(null);
                                }}
                                onLibrarySelect={(type) => addBlockToContainer(block.id, type as BlockType)}
                                onLibraryClose={() => setContainerLibraryTarget(null)}
                              />
                            ) : (
                              <div style={{ pointerEvents: 'none' }}>
                                <BlockContent block={block} />
                              </div>
                            )}
                          </div>
                          {dragTargetIndex === idx && dragPosition === 'below' && (isPaletteDrag ? <DropGhost /> : <div className="ub-preview-drop-indicator" />)}
                        </div>
                      ))}
                      {/* Bottom drop zone: always visible and generous */}
                      <div
                        className="ub-canvas-bottom-drop"
                        onDragOver={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragTargetIndex(blocks.length - 1);
                          setDragPosition('below');
                        }}
                      />
                    </div>
                  )}
                </main>

                {/* Global Footer */}
                {(() => {
                  const fc: any = draftConfig?.footer_config || {};
                  const fBg = fc.bg_color || undefined;
                  const fColor = fc.text_color || undefined;
                  const fFont = fc.font ? `'${fc.font}', sans-serif` : undefined;
                  const fHeading = fc.heading_color || undefined;
                  const fLink = fc.link_color || undefined;
                  return (
                    <footer
                      className={`sf-footer sf-builder-global ${activePanel === 'footer' ? 'editing' : ''}`}
                      style={{ ...(fBg ? { backgroundColor: fBg } : {}), ...(fColor ? { color: fColor } : {}), ...(fFont ? { fontFamily: fFont } : {}) }}
                      onClick={() => { setActivePanel('footer'); setEditingBlockId(null); setLeftTab('settings'); }}
                    >
                      <div className="sf-footer-inner" style={{ pointerEvents: 'none' }}>
                        <div className="sf-footer-columns">
                          {(draftConfig?.footer_config?.columns || []).map((col, ci) => (
                            <div className="sf-footer-column" key={ci}>
                              <h4 style={fHeading ? { color: fHeading } : undefined}>{col.title}</h4>
                              {col.links.map((link, li) => (
                                <span key={li} className="sf-footer-link" style={fLink ? { color: fLink } : undefined}>{link.label}</span>
                              ))}
                            </div>
                          ))}
                        </div>
                        <div className="sf-footer-bottom">
                          <div className="sf-footer-social">
                            {(draftConfig?.footer_config?.social_links || []).map((link, i) => (
                              <span key={i} className="sf-social-link" title={link.platform}><SocialIcon platform={link.platform} size={18} /></span>
                            ))}
                          </div>
                          <p className="sf-copyright">
                            {draftConfig?.footer_config?.copyright || `© ${new Date().getFullYear()} ${draftConfig?.store_name}`}
                          </p>
                        </div>
                      </div>
                    </footer>
                  );
                })()}
              </div>
            </StoreConfigContext.Provider>
          </div>
        </div>
      </div>

      {/* ─── RIGHT SIDEBAR (If editing block or setting) ─── */}
      {(editingBlock || activePanel) && (
        <div className="ub-right-sidebar">
          {editingBlock && (() => {
            // Check if we're editing a sub-block inside a column or container
            const isEditingColumnSubBlock = editingSubBlockId && editingColumnTarget && editingColumnTarget.blockId === editingBlock.id;
            const isEditingContainerSubBlock = editingSubBlockId && editingBlock.type === 'container' && !editingColumnTarget;
            let subBlock: PageBlock | null = null;
            if (isEditingColumnSubBlock) {
              const colData = editingBlock.config.columns?.[editingColumnTarget!.colIdx];
              const colBlocks: PageBlock[] = Array.isArray(colData) ? colData : (colData?.blocks || []);
              subBlock = colBlocks.find((sb: PageBlock) => sb.id === editingSubBlockId) || null;
            } else if (isEditingContainerSubBlock) {
              subBlock = (editingBlock.config.blocks || []).find((sb: PageBlock) => sb.id === editingSubBlockId) || null;
            }

            if (subBlock) {
              // Render sub-block editor
              return (
                <>
                  <div className="ub-right-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button className="ub-close-btn" onClick={() => setEditingSubBlockId(null)} title={isEditingContainerSubBlock ? 'Back to container' : 'Back to column'}>
                        <ArrowLeft size={16} />
                      </button>
                      <h3 style={{ margin: 0 }}>{getBlockLabel(subBlock.type)}</h3>
                    </div>
                    <button className="ub-close-btn" onClick={() => { setEditingBlockId(null); setEditingColumnTarget(null); setEditingSubBlockId(null); }}><X size={16} /></button>
                  </div>
                  <div className="ub-right-content">
                    <BlockEditor
                      block={subBlock}
                      onChange={(config) => isEditingContainerSubBlock
                        ? updateContainerSubBlockConfig(editingBlock.id, subBlock!.id, config)
                        : updateSubBlockConfig(editingBlock.id, editingColumnTarget!.colIdx, subBlock!.id, config)
                      }
                    />
                  </div>
                </>
              );
            }

            // Render main block editor (or column style editor)
            return (
              <>
                <div className="ub-right-header">
                  <h3>{getBlockLabel(editingBlock.type)}{editingColumnTarget && editingColumnTarget.blockId === editingBlock.id ? ` — Column ${editingColumnTarget.colIdx + 1}` : ''}</h3>
                  <button className="ub-close-btn" onClick={() => { setEditingBlockId(null); setEditingColumnTarget(null); setEditingSubBlockId(null); }}><X size={16} /></button>
                </div>
                <div className="ub-right-content">
                  <BlockEditor 
                    block={editingBlock} 
                    onChange={(c) => updateBlockConfig(editingBlock.id, c)}
                    editingColumnIndex={editingColumnTarget?.blockId === editingBlock.id ? editingColumnTarget.colIdx : undefined}
                    onColumnStyleChange={editingColumnTarget?.blockId === editingBlock.id ? (styles) => updateColumnStyle(editingBlock.id, editingColumnTarget!.colIdx, styles) : undefined}
                    onRemoveSubBlock={editingColumnTarget?.blockId === editingBlock.id ? (subBlockId) => removeBlockFromColumn(editingBlock.id, editingColumnTarget!.colIdx, subBlockId) : undefined}
                  />
                </div>
              </>
            );
          })(
          )}

          {activePanel && (
            <>
              <div className="ub-right-header">
                <h3>{SETTINGS_PANELS.find(p => p.key === activePanel)?.label || SYSTEM_PAGES.find(sp => sp.templatePanel === activePanel)?.title || 'Template'} Settings</h3>
                <button className="ub-close-btn" onClick={() => setActivePanel(null)}><X size={16} /></button>
              </div>
              <div className="ub-right-content">
                <GlobalSettingsEditor panel={activePanel} draft={draftConfig} updateDraft={updateDraft} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
    </>
  );
}

// ─── Helpers ───
function getBlockLabel(type: BlockType): string {
  const labels: Record<string, string> = {
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

// getBlockSummary removed because it is not used in UnifiedBuilder

function getDefaultConfig(type: BlockType): Record<string, any> {
  switch (type) {
    case 'hero': return { bgMode: 'image', title: 'Welcome', titleFontSize: 56, titleFontWeight: '900', subtitle: '', subtitleFontSize: 18, imageUrl: '', buttonSpacing: 16, buttons: [{ text: 'Shop Now', link: '/shop/products', bgColor: '', textColor: '#ffffff', radius: 99, size: 'md', fontSize: 16 }], overlayOpacity: 0.4, overlayColor: '#000000', height: '600px', titleFont: '', titleColor: '#ffffff', subtitleColor: '#ffffff' };
    case 'half_hero': return { bgMode: 'image', title: '', titleFontSize: 56, titleFontWeight: '900', subtitle: '', subtitleFontSize: 18, imageUrl: '', ctaText: '', ctaLink: '', ctaFontSize: 16, objectPosition: 'center', height: '600px', imageOpacity: 0.85, overlayColor: '#000000', overlayOpacity: 0, titleFont: '', titleColor: '#ffffff', subtitleColor: '#ffffff', cardBgColor: '#000000', cardBgOpacity: 0.4, cardRadius: 12, cardBlur: true, cardBlurAmount: 10, ctaBgColor: '', ctaTextColor: '#ffffff', ctaRadius: 8, ctaSize: 'md' };
    case 'heading': return { text: 'Heading', level: 'h2', align: 'center', fontFamily: '', fontSize: '', color: '', fontWeight: '' };
    case 'text': return { text: 'Enter your text here...', align: 'left' };
    case 'image': return { url: '', alt: '', width: '100%', align: 'center', borderRadius: 0, shadow: 'none', opacity: 100, link: '' };
    case 'image_gallery': return { images: [], layout: 'grid', columns: 3, gap: 16, borderRadius: 0, shadow: 'none', aspectRatio: 'square' };
    case 'button': return { text: 'Click Me', link: '', style: 'primary', align: 'center', size: 'md', fontFamily: '', fontSize: '', fontWeight: '', textColor: '', bgColor: '', borderRadius: '' };
    case 'product_grid': return { mode: 'auto', productIds: [], columns: 4, limit: 8 };
    case 'collection_grid': return { mode: 'auto', collectionIds: [], columns: 3 };
    case 'collection_showcase': return { title: 'INTRODUCING THE COLLECTION', subtitle: 'Built for a life in constant motion.', collectionId: '', limit: 5, ctaText: 'SHOP NOW', ctaLink: '/shop/products', titleFont: '', titleColor: '#000000', titleFontSize: 32, titleFontWeight: '800', subtitleColor: '#666666', subtitleFontSize: 16, cardBgColor: '#ffffff', cardTextColor: '#000000', cardRadius: 0 };
    case 'category_links': return { collectionIds: [], limit: 3, columns: 3, stackOnMobile: true, aspectRatio: 'auto', textPosition: 'below' };
    case 'product_carousel': return {
      title: 'Product Carousel',
      subtitle: 'Featured selection of top products.',
      collectionId: '',
      limit: 10,
      ctaText: 'View All',
      ctaLink: '/shop',
      titleFont: '',
      titleFontSize: 40,
      titleFontWeight: '900',
      titleColor: '#000000',
      subtitleFontSize: 18,
      subtitleColor: '#666666',
      cardBgColor: '#ffffff',
      cardTextColor: '#000000',
      cardRadius: 16
    };
    case 'featured_product': return { productId: '' };
    case 'spacer': return { height: 40 };
    case 'divider': return { style: 'solid', color: '#e5e7eb', thickness: 1 };
    case 'video': return { source: 'url', url: '', autoplay: false, muted: false, controls: true };
    case 'testimonials': return { items: [{ name: '', text: '', rating: 5 }] };
    case 'faq': return { items: [{ question: '', answer: '' }] };
    case 'banner': return { text: 'Banner text', bgColor: '#1a1a2e', textColor: '#ffffff', align: 'center' };
    case 'ticker': return { text: '📢 FREE SHIPPING ON ALL ORDERS', speed: 30, bgColor: '#000000', textColor: '#ffffff' };
    case 'features': return { items: [{ icon: 'check', title: 'Feature 1', description: 'Description here' }, { icon: 'check', title: 'Feature 2', description: 'Description here' }, { icon: 'check', title: 'Feature 3', description: 'Description here' }] };
    case 'custom_html': return { html: '' };
    case 'columns': return { columns: [{ blocks: [] }, { blocks: [] }], gap: 16, stackOnMobile: true };
    case 'container': return { blocks: [], padding: '40px', bgColor: 'transparent', maxWidth: '1200px', borderWidth: 0, borderRadius: 0, borderStyle: 'solid', borderColor: '#e5e7eb', marginTop: '0px', marginBottom: '0px', gap: 0, shadow: false, shadowValue: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'visible' };
    default: return {};
  }
}

// ─── Columns Canvas Component ───────────────────────────────────────
interface ColumnsCanvasProps {
  block: PageBlock;
  editingColumnTarget: { blockId: string; colIdx: number } | null;
  columnLibraryTarget: { blockId: string; colIdx: number } | null;
  isMobile?: boolean;
  onColumnClick: (colIdx: number) => void;
  onColumnDrop: (colIdx: number, type: string) => void;
  onAddClick: (colIdx: number) => void;
  onLibrarySelect: (colIdx: number, type: string) => void;
  onLibraryClose: () => void;
  onSubBlockClick: (colIdx: number, subBlockId: string) => void;
  onSubBlockRemove: (colIdx: number, subBlockId: string) => void;
}

function ColumnsCanvasBlock({
  block, editingColumnTarget, columnLibraryTarget, isMobile,
  onColumnClick, onColumnDrop, onAddClick, onLibrarySelect, onLibraryClose,
  onSubBlockClick, onSubBlockRemove
}: ColumnsCanvasProps) {
  const c = block.config;
  const cols = c.columns || [{ blocks: [] }, { blocks: [] }];
  const gap = c.gap || 16;
  const shouldStack = isMobile && (c.stackOnMobile ?? true);

  return (
    <div
      className="ub-columns-canvas"
      style={{ display: 'grid', gridTemplateColumns: shouldStack ? '1fr' : `repeat(${cols.length}, 1fr)`, gap: `${gap}px`, padding: '8px', minHeight: 80 }}
      onClick={(e) => e.stopPropagation()}
    >
      {cols.map((col: any, idx: number) => {
        const normalized = Array.isArray(col) ? { blocks: col } : col;
        const colBlocks: PageBlock[] = normalized.blocks || [];
        const isSelected = editingColumnTarget?.blockId === block.id && editingColumnTarget?.colIdx === idx;
        const showLib = columnLibraryTarget?.blockId === block.id && columnLibraryTarget?.colIdx === idx;

        const colStyle: React.CSSProperties = {
          backgroundColor: normalized.bgColor || undefined,
          borderWidth: normalized.borderWidth ? `${normalized.borderWidth}px` : undefined,
          borderStyle: normalized.borderWidth ? 'solid' : undefined,
          borderColor: normalized.borderColor || undefined,
          borderRadius: normalized.borderRadius ? `${normalized.borderRadius}px` : undefined,
          padding: normalized.padding || undefined,
        };

        return (
          <div
            key={idx}
            className={`ub-column-cell ${isSelected ? 'selected' : ''}`}
            style={colStyle}
            onClick={(e) => { e.stopPropagation(); onColumnClick(idx); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('drag-over'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              const type = e.dataTransfer.getData('text/plain');
              if (type && type !== '__reorder__' && type !== 'columns' && type !== 'container') {
                e.stopPropagation();
                onColumnDrop(idx, type);
              }
              // For 'container', 'columns', or '__reorder__' drops, let event bubble up to parent
            }}
          >
            <div className="ub-column-label">Column {idx + 1}</div>

            {colBlocks.length > 0 ? (
              <div className="ub-column-blocks">
                {colBlocks.map((sb: PageBlock) => (
                  <div key={sb.id} className="ub-column-sub-block" onClick={(e) => { e.stopPropagation(); onSubBlockClick(idx, sb.id); }}>
                    <span className="ub-column-sub-type">{sb.type.replace('_', ' ')}</span>
                    <button className="ub-column-sub-delete" onClick={(e) => { e.stopPropagation(); onSubBlockRemove(idx, sb.id); }}>
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ub-column-empty">Drop blocks here</div>
            )}

            <button
              className="ub-column-add-btn"
              onClick={(e) => { e.stopPropagation(); onAddClick(idx); }}
            >
              <Plus size={12} /> Add
            </button>

            {showLib && (
              <div className="ub-column-lib-popup">
                <div className="ub-column-lib-header">
                  <span>Add Block to Column {idx + 1}</span>
                  <button onClick={(e) => { e.stopPropagation(); onLibraryClose(); }}><X size={12} /></button>
                </div>
                <div className="ub-column-lib-grid">
                  {BLOCK_OPTIONS.filter(o => o.type !== 'columns' && o.type !== 'container').map(opt => (
                    <button key={opt.type} className="ub-column-lib-item" onClick={(e) => { e.stopPropagation(); onLibrarySelect(idx, opt.type); }}>
                      <span className="ub-column-lib-icon">{opt.icon}</span>
                      <span className="ub-column-lib-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Container Canvas Component ───────────────────────────────────────
interface ContainerCanvasProps {
  block: PageBlock;
  containerLibraryTarget: string | null;
  onSubBlockClick: (subBlockId: string) => void;
  onSubBlockRemove: (subBlockId: string) => void;
  onBlockDrop: (type: string) => void;
  onAddClick: () => void;
  onLibrarySelect: (type: string) => void;
  onLibraryClose: () => void;
}

function ContainerCanvasBlock({
  block, containerLibraryTarget,
  onSubBlockClick, onSubBlockRemove, onBlockDrop,
  onAddClick, onLibrarySelect, onLibraryClose
}: ContainerCanvasProps) {
  const c = block.config;
  const innerBlocks: PageBlock[] = c.blocks || [];
  const showLib = containerLibraryTarget === block.id;

  const containerStyle: React.CSSProperties = {
    backgroundColor: c.bgColor || undefined,
    padding: c.padding || '40px',
    borderWidth: c.borderWidth ? `${c.borderWidth}px` : undefined,
    borderStyle: c.borderWidth ? (c.borderStyle || 'solid') : undefined,
    borderColor: c.borderWidth ? (c.borderColor || '#e5e7eb') : undefined,
    borderRadius: c.borderRadius ? `${c.borderRadius}px` : undefined,
    boxShadow: c.shadow ? (c.shadowValue || '0 4px 24px rgba(0,0,0,0.08)') : undefined,
    overflow: c.overflow || undefined,
    minHeight: 80,
  };

  return (
    <div
      className="ub-container-canvas"
      style={containerStyle}
      onClick={(e) => e.stopPropagation()}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('drag-over'); }}
      onDragLeave={(e) => { e.currentTarget.classList.remove('drag-over'); }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const type = e.dataTransfer.getData('text/plain');
        if (type && type !== '__reorder__' && type !== 'columns' && type !== 'container') {
          e.stopPropagation();
          onBlockDrop(type);
        }
      }}
    >
      <div className="ub-container-label">Container</div>

      {innerBlocks.length > 0 ? (
        <div className="ub-container-blocks" style={{ display: 'flex', flexDirection: 'column', gap: c.gap ? `${c.gap}px` : '0px' }}>
          {innerBlocks.map((sb: PageBlock) => (
            <div key={sb.id} className="ub-column-sub-block" onClick={(e) => { e.stopPropagation(); onSubBlockClick(sb.id); }}>
              <span className="ub-column-sub-type">{sb.type.replace('_', ' ')}</span>
              <button className="ub-column-sub-delete" onClick={(e) => { e.stopPropagation(); onSubBlockRemove(sb.id); }}>
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="ub-column-empty">Drop blocks here</div>
      )}

      <button
        className="ub-column-add-btn"
        onClick={(e) => { e.stopPropagation(); onAddClick(); }}
      >
        <Plus size={12} /> Add
      </button>

      {showLib && (
        <div className="ub-column-lib-popup">
          <div className="ub-column-lib-header">
            <span>Add Block to Container</span>
            <button onClick={(e) => { e.stopPropagation(); onLibraryClose(); }}><X size={12} /></button>
          </div>
          <div className="ub-column-lib-grid">
            {BLOCK_OPTIONS.filter(o => o.type !== 'columns' && o.type !== 'container').map(opt => (
              <button key={opt.type} className="ub-column-lib-item" onClick={(e) => { e.stopPropagation(); onLibrarySelect(opt.type); }}>
                <span className="ub-column-lib-icon">{opt.icon}</span>
                <span className="ub-column-lib-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
