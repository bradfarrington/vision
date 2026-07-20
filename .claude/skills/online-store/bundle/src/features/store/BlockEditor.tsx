import { useState, useEffect, useRef } from 'react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { PageBlock } from '@/types/database';
import { Plus, Trash2, Upload, ChevronDown, Search, Loader2 } from 'lucide-react';
import * as Icons from 'lucide-react';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { supabase } from '@/lib/supabase';
import * as api from '@/lib/api';
import type { Collection } from '@/types/database';
import { LinkPicker } from './LinkPicker';
import { MultiSelect } from '@/components/ui/MultiSelect';

interface Props {
  block: PageBlock;
  onChange: (config: Record<string, any>) => void;
  editingColumnIndex?: number;
  onColumnStyleChange?: (styles: Record<string, any>) => void;
  onRemoveSubBlock?: (subBlockId: string) => void;
}

const COMMON_ICONS = [
  'star', 'check', 'heart', 'shield', 'shield-check', 'zap', 'truck', 
  'credit-card', 'box', 'package', 'thumbs-up', 'map-pin', 'phone', 
  'mail', 'clock', 'shopping-cart', 'shopping-bag', 'user', 'users', 
  'globe', 'award', 'settings', 'tool', 'plus', 'minus', 
  'arrow-right', 'arrow-left', 'chevron-right', 'store', 'tag', 
  'key', 'lock', 'unlock', 'smile', 'info', 'help-circle'
];

export function BlockEditor({ block, onChange, editingColumnIndex, onColumnStyleChange, onRemoveSubBlock }: Props) {
  const c = block.config;

  const set = (key: string, value: any) => {
    onChange({ ...c, [key]: value });
  };

  const editorContent = renderBlockEditor(block, c, set, editingColumnIndex, onColumnStyleChange, onRemoveSubBlock);

  if (!editorContent) return null;

  return (
    <>
      {editorContent}
      <div className="builder-panel-content">
        <SpacingCard c={c} set={set} />
      </div>
    </>
  );
}

function renderBlockEditor(block: PageBlock, c: Record<string, any>, set: (key: string, value: any) => void, editingColumnIndex?: number, onColumnStyleChange?: (styles: Record<string, any>) => void, onRemoveSubBlock?: (subBlockId: string) => void) {

  switch (block.type) {
    case 'hero':
      return <HeroBannerEditor config={c} set={set} />;

    case 'half_hero':
      return <HalfHeroEditor config={c} set={set} />;

    case 'heading':
      return (
        <div className="builder-panel-content">
          <Card title="Content">
            <Field label="Text">
              <input className="form-input" value={c.text || ''} onChange={(e) => set('text', e.target.value)} />
            </Field>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Level">
                <SearchableSelect className="form-input" value={c.level || 'h2'} onChange={(val) => set('level', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'H1 — Large', value: 'h1' },
    { label: 'H2 — Medium', value: 'h2' },
    { label: 'H3 — Small', value: 'h3' },
    { label: 'H4 — Extra Small', value: 'h4' }
  ]}
/>
              </Field>
              <Field label="Alignment">
                <SearchableSelect className="form-input" value={c.align || 'center'} onChange={(val) => set('align', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Left', value: 'left' },
    { label: 'Centre', value: 'center' },
    { label: 'Right', value: 'right' }
  ]}
/>
              </Field>
            </div>
          </Card>
          <Card title="Typography">
            <BlockFontPicker label="Font Family" value={c.fontFamily || ''} onChange={(val) => set('fontFamily', val)} />
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
              <Field label="Size (px)">
                <input className="form-input" type="number" value={c.fontSize || ''} min="8" max="150"
                  onChange={(e) => set('fontSize', e.target.value ? Number(e.target.value) : '')} placeholder="Auto" />
              </Field>
              <Field label="Weight">
                <SearchableSelect className="form-input" value={c.fontWeight || ''} onChange={(val) => set('fontWeight', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Default', value: '' },
    { label: 'Light (300)', value: '300' },
    { label: 'Regular (400)', value: '400' },
    { label: 'Medium (500)', value: '500' },
    { label: 'Semi Bold (600)', value: '600' },
    { label: 'Bold (700)', value: '700' },
    { label: 'Extra Bold (800)', value: '800' },
    { label: 'Black (900)', value: '900' }
  ]}
/>
              </Field>
            </div>
            <InlineColor label="Colour" value={c.color || ''} onChange={(val) => set('color', val)} />
          </Card>
        </div>
      );

    case 'text':
      return (
        <div className="builder-panel-content">
          <Card title="Content">
            <Field label="Text">
              <textarea className="form-input form-textarea" rows={5} value={c.text || ''} onChange={(e) => set('text', e.target.value)} />
            </Field>
            <Field label="Alignment">
              <SearchableSelect className="form-input" value={c.align || 'left'} onChange={(val) => set('align', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Left', value: 'left' },
    { label: 'Centre', value: 'center' },
    { label: 'Right', value: 'right' }
  ]}
/>
            </Field>
          </Card>
        </div>
      );

    case 'image':
      return <ImageBlockEditor config={c} set={set} />;

    case 'image_gallery':
      return <ImageGalleryEditor config={c} set={set} />;

    case 'button':
      return (
        <div className="builder-panel-content">
          <Card title="Button">
            <Field label="Text">
              <input className="form-input" value={c.text || ''} onChange={(e) => set('text', e.target.value)} />
            </Field>
            <Field label="Link">
              <LinkPicker value={c.link || ''} onChange={(val) => set('link', val)} />
            </Field>
          </Card>
          <Card title="Style">
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Size">
                <SearchableSelect className="form-input" value={c.size || 'md'} onChange={(val) => set('size', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' }
  ]}
/>
              </Field>
              <Field label="Alignment">
                <SearchableSelect className="form-input" value={c.align || 'center'} onChange={(val) => set('align', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Left', value: 'left' },
    { label: 'Centre', value: 'center' },
    { label: 'Right', value: 'right' }
  ]}
/>
              </Field>
            </div>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Radius (px)">
                <input className="form-input" type="number" value={c.borderRadius || ''} min="0" max="100"
                  onChange={(e) => set('borderRadius', e.target.value ? Number(e.target.value) : '')} placeholder="Default" />
              </Field>
            </div>
          </Card>
          <Card title="Typography & Colours" desc="Overrides preset styles.">
            <BlockFontPicker label="Font Family" value={c.fontFamily || ''} onChange={(val) => set('fontFamily', val)} />
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
              <Field label="Size (px)">
                <input className="form-input" type="number" value={c.fontSize || ''} min="8" max="150"
                  onChange={(e) => set('fontSize', e.target.value ? Number(e.target.value) : '')} placeholder="Auto" />
              </Field>
              <Field label="Weight">
                <SearchableSelect className="form-input" value={c.fontWeight || ''} onChange={(val) => set('fontWeight', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Default', value: '' },
    { label: 'Light (300)', value: '300' },
    { label: 'Regular (400)', value: '400' },
    { label: 'Medium (500)', value: '500' },
    { label: 'Semi Bold (600)', value: '600' },
    { label: 'Bold (700)', value: '700' },
    { label: 'Extra Bold (800)', value: '800' },
    { label: 'Black (900)', value: '900' }
  ]}
/>
              </Field>
            </div>
            <InlineColor label="Text Colour" value={c.textColor || ''} onChange={(val) => set('textColor', val)} />
            <div style={{ paddingBottom: '0.75rem' }} />
            <InlineColor label="Background Colour" value={c.bgColor || ''} onChange={(val) => set('bgColor', val)} />
          </Card>
        </div>
      );

    case 'product_grid':
      return <ProductGridEditor config={c} set={set} />;

    case 'collection_grid':
      return <CollectionGridEditor config={c} set={set} />;

    case 'collection_showcase':
      return <CollectionShowcaseEditor config={c} set={set} />;

    case 'category_links':
      return <CategoryLinksEditor config={c} set={set} />;

    case 'product_carousel':
      return <ProductCarouselEditor config={c} set={set} />;

    case 'featured_product':
      return <FeaturedProductEditor config={c} set={set} />;

    case 'spacer':
      return (
        <div className="builder-panel-content">
          <Card title="Spacing">
            <Field label="Height (px)">
              <input className="form-input" type="number" value={c.height || 40} min="8" max="200"
                onChange={(e) => set('height', Number(e.target.value))} />
            </Field>
          </Card>
        </div>
      );

    case 'divider':
      return (
        <div className="builder-panel-content">
          <Card title="Divider Style">
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Width">
                <SearchableSelect className="form-input" value={c.width || 'standard'} onChange={(val) => set('width', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Standard', value: 'standard' },
    { label: 'Full Viewport', value: 'full' }
  ]}
/>
              </Field>
              <Field label="Style">
                <SearchableSelect className="form-input" value={c.style || 'solid'} onChange={(val) => set('style', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Solid', value: 'solid' },
    { label: 'Dashed', value: 'dashed' },
    { label: 'Dotted', value: 'dotted' }
  ]}
/>
              </Field>
            </div>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Thickness (px)">
                <input className="form-input" type="number" value={c.thickness || 1} min="1" max="10"
                  onChange={(e) => set('thickness', Number(e.target.value))} />
              </Field>
              <Field label="">
                <div style={{ height: '1.25rem' }} />
                <InlineColor label="Colour" value={c.color || '#e5e7eb'} onChange={(val) => set('color', val)} />
              </Field>
            </div>
          </Card>
        </div>
      );

    case 'video':
      return <VideoBlockEditor config={c} set={set} />;

    case 'banner':
      return <BannerEditor config={c} set={set} />;

    case 'ticker':
      return (
        <div className="builder-panel-content">
          <Card title="Content">
            <Field label="Ticker Text">
              <input className="form-input" value={c.text || ''} onChange={(e) => set('text', e.target.value)} placeholder="📢 FREE SHIPPING ON ALL ORDERS" />
            </Field>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <Field label="Width">
                <SearchableSelect className="form-input" value={c.width || 'full'} onChange={(val) => set('width', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Full Viewport', value: 'full' },
    { label: 'Container', value: 'container' }
  ]}
/>
              </Field>
              <Field label="Scroll Speed">
                <input type="number" className="form-input" value={c.speed || 30} onChange={(e) => set('speed', Number(e.target.value))} />
              </Field>
            </div>
          </Card>
          <Card title="Colours">
            <InlineColor label="Background" value={c.bgColor || '#000000'} onChange={(val) => set('bgColor', val)} />
            <InlineColor label="Text" value={c.textColor || '#ffffff'} onChange={(val) => set('textColor', val)} />
          </Card>
        </div>
      );

    case 'features':
      return (
        <div className="builder-panel-content">
          <Card title="Features Layout">
            <div className="form-row">
              <Field label="Grid Columns (Desktop)">
                <SearchableSelect className="form-input" value={c.columns || 3} onChange={(val) => set('columns', Number(val))}
  searchable={false}
  sort={false}
  options={[
    { label: '1 Column', value: '1' },
    { label: '2 Columns', value: '2' },
    { label: '3 Columns', value: '3' },
    { label: '4 Columns', value: '4' }
  ]}
/>
              </Field>
            </div>
          </Card>
          <Card title="Features">
            {(c.items || []).map((item: any, i: number) => (
              <div className="ub-settings-item-box" key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Feature {i + 1}</span>
                  <button className="btn btn-ghost btn-icon-sm danger" onClick={() => {
                    const items = [...(c.items || [])];
                    items.splice(i, 1);
                    set('items', items);
                  }} style={{ color: '#ef4444' }}>✕</button>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Icon</label>
                    <SearchableSelect
                      className="form-input"
                      value={item.icon || 'star'}
                      onChange={(val) => {
                        const items = [...(c.items || [])];
                        items[i] = { ...item, icon: val };
                        set('items', items);
                      }}
                      searchable={true}
                      options={COMMON_ICONS.map(icon => ({
                        label: icon.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        value: icon
                      }))}
                    />
                  </div>
                  <div style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', flexShrink: 0 }}>
                    {(() => {
                      const iconName = item.icon || 'star';
                      const camelName = iconName.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
                      const IconComponent = (Icons as any)[camelName] || (Icons as any)[iconName.charAt(0).toUpperCase() + iconName.slice(1)] || Icons.Star;
                      return IconComponent ? <IconComponent size={20} color={c.iconColor || "#374151"} /> : null;
                    })()}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input className="form-input" value={item.title || ''} onChange={(e) => {
                    const items = [...(c.items || [])];
                    items[i] = { ...item, title: e.target.value };
                    set('items', items);
                  }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input form-textarea" rows={3} value={item.description || ''} onChange={(e) => {
                    const items = [...(c.items || [])];
                    items[i] = { ...item, description: e.target.value };
                    set('items', items);
                  }} />
                </div>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => {
              set('items', [...(c.items || []), { icon: 'star', title: '', description: '' }]);
            }}>
              <Plus size={14} style={{ marginRight: 6 }}/> Add Feature
            </button>
          </Card>
          
          <Card title="Features Styling">
            <div className="ub-settings-item-box">
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.5rem' }}>Card Details</span>
              <InlineColor label="Card Background" value={c.cardBgColor || 'transparent'} onChange={(val) => set('cardBgColor', val)} />
              <div style={{ margin: '0.5rem 0' }} />
              <Field label="Border Radius">
                <input className="form-input" type="number" min="0" value={c.cardRadius ?? 0} onChange={(e) => set('cardRadius', Number(e.target.value))} />
              </Field>
              <div style={{ margin: '0.5rem 0' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={c.cardShadow !== false} onChange={(e) => set('cardShadow', e.target.checked)} />
                <span className="text-sm">Card Drop Shadow</span>
              </label>
            </div>
            
            <div className="ub-settings-item-box" style={{ marginTop: '1rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.5rem' }}>Icon & Typography</span>
              <InlineColor label="Icon Colour" value={c.iconColor || 'var(--sf-primary)'} onChange={(val) => set('iconColor', val)} />
              <div style={{ margin: '0.5rem 0' }} />
              <InlineColor label="Icon Background" value={c.iconBgColor || 'rgba(22,163,74,0.1)'} onChange={(val) => set('iconBgColor', val)} />
              <div style={{ margin: '0.5rem 0' }} />
              <InlineColor label="Title Colour" value={c.titleColor || 'var(--sf-text)'} onChange={(val) => set('titleColor', val)} />
              <div style={{ margin: '0.5rem 0' }} />
              <InlineColor label="Description Colour" value={c.descColor || 'var(--sf-text-secondary)'} onChange={(val) => set('descColor', val)} />
              
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <Field label="Title Size (px)">
                  <input className="form-input" type="number" value={c.titleFontSize || 20} onChange={(e) => set('titleFontSize', Number(e.target.value))} />
                </Field>
                <Field label="Title Weight">
                  <SearchableSelect className="form-input" value={c.titleFontWeight || '700'} onChange={(val) => set('titleFontWeight', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Regular (400)', value: '400' },
    { label: 'Medium (500)', value: '500' },
    { label: 'Semibold (600)', value: '600' },
    { label: 'Bold (700)', value: '700' },
    { label: 'Black (800)', value: '800' }
  ]}
/>
                </Field>
              </div>
              <div className="form-row" style={{ marginTop: '0.5rem' }}>
                <Field label="Desc Size (px)">
                  <input className="form-input" type="number" value={c.descFontSize || 16} onChange={(e) => set('descFontSize', Number(e.target.value))} />
                </Field>
              </div>
            </div>
          </Card>
        </div>
      );

    case 'testimonials':
      return (
        <div className="builder-panel-content">
          <Card title="Layout Settings">
            <div className="form-row">
              <Field label="Display Type">
                <SearchableSelect className="form-input" value={c.layout || 'grid'} onChange={(val) => set('layout', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Grid', value: 'grid' },
    { label: 'Carousel', value: 'carousel' },
    { label: 'List (Stacked)', value: 'list' }
  ]}
/>
              </Field>
            </div>
            {c.layout === 'carousel' && (
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <Field label="Auto Scroll">
                  <SearchableSelect className="form-input" value={c.autoScroll === false ? 'no' : 'yes'} onChange={(val) => set('autoScroll', val === 'yes')}
  searchable={false}
  sort={false}
  options={[
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' }
  ]}
/>
                </Field>
                <Field label="Interval (ms)">
                  <input className="form-input" type="number" step="500" min="1000" disabled={c.autoScroll === false} value={c.scrollInterval || 3000} onChange={(e) => set('scrollInterval', Number(e.target.value))} />
                </Field>
              </div>
            )}
          </Card>

          <Card title="Review Sources">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={c.showManual !== false} onChange={(e) => set('showManual', e.target.checked)} />
                <span className="text-sm">Show Manual Testimonials</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'not-allowed', opacity: 0.6 }} title="Coming soon">
                <input type="checkbox" disabled checked={c.showGoogle === true} onChange={(e) => set('showGoogle', e.target.checked)} />
                <span className="text-sm">Show Google Business Reviews</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'not-allowed', opacity: 0.6 }} title="Coming soon">
                <input type="checkbox" disabled checked={c.showProduct === true} onChange={(e) => set('showProduct', e.target.checked)} />
                <span className="text-sm">Show Product Reviews</span>
              </label>
            </div>
          </Card>

          {c.showManual !== false && (
            <Card title="Manual Testimonials">
              {(c.items || []).map((item: any, i: number) => (
              <div className="ub-settings-item-box" key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Testimonial {i + 1}</span>
                  <button className="btn btn-ghost btn-icon-sm danger" onClick={() => {
                    const items = [...(c.items || [])];
                    items.splice(i, 1);
                    set('items', items);
                  }} style={{ color: '#ef4444' }}>✕</button>
                </div>
                <input className="form-input" placeholder="Customer name" value={item.name || ''}
                  style={{ marginBottom: '0.5rem' }}
                  onChange={(e) => { const items = [...(c.items || [])]; items[i] = { ...items[i], name: e.target.value }; set('items', items); }} />
                <textarea className="form-input form-textarea" rows={2} placeholder="Their quote..."
                  style={{ marginBottom: '0.5rem' }}
                  value={item.text || ''}
                  onChange={(e) => { const items = [...(c.items || [])]; items[i] = { ...items[i], text: e.target.value }; set('items', items); }} />
                <SearchableSelect
                  className="form-input"
                  value={item.rating?.toString() || '5'}
                  onChange={(val) => { const items = [...(c.items || [])]; items[i] = { ...items[i], rating: Number(val) }; set('items', items); }}
                  searchable={false}
                  sort={false}
                  options={[5,4,3,2,1].map(r => ({ label: `${r} ★`, value: r.toString() }))}
                />
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => set('items', [...(c.items || []), { name: '', text: '', rating: 5 }])}>
              <Plus size={14} style={{ marginRight: 6 }}/> Add Testimonial
            </button>
          </Card>
          )}

          <Card title="Testimonial Styling">
            <InlineColor label="Card Background" value={c.cardBgColor || '#f9fafb'} onChange={(val) => set('cardBgColor', val)} />
            <div style={{ margin: '0.5rem 0' }} />
            <InlineColor label="Text Colour" value={c.textColor || '#111827'} onChange={(val) => set('textColor', val)} />
            <div style={{ margin: '0.5rem 0' }} />
            <InlineColor label="Star Colour" value={c.starColor || '#fbbf24'} onChange={(val) => set('starColor', val)} />
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <Field label="Border Radius">
                <input className="form-input" type="number" value={c.cardRadius ?? 16} min="0" max="50" onChange={(e) => set('cardRadius', Number(e.target.value))} />
              </Field>
            </div>
          </Card>
        </div>
      );

    case 'faq':
      return (
        <div className="builder-panel-content">
          <Card title="Header Text">
            <Field label="Title">
              <input className="form-input" value={c.title || ''} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Subtitle">
              <textarea className="form-input form-textarea" rows={2} value={c.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} />
            </Field>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <InlineColor label="Title Colour" value={c.titleColor || '#000000'} onChange={(val) => set('titleColor', val)} />
              <InlineColor label="Subtitle Colour" value={c.subtitleColor || '#666666'} onChange={(val) => set('subtitleColor', val)} />
            </div>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <Field label="Alignment">
                <SearchableSelect className="form-input" value={c.align || 'center'} onChange={(val) => set('align', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
    { label: 'Right', value: 'right' }
  ]}
/>
              </Field>
            </div>
          </Card>

          <Card title="Questions">
            {(c.items || []).map((item: any, i: number) => (
              <div className="ub-settings-item-box" key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Question {i + 1}</span>
                  <button className="btn btn-ghost btn-icon-sm danger" onClick={() => {
                    const items = [...(c.items || [])];
                    items.splice(i, 1);
                    set('items', items);
                  }} style={{ color: '#ef4444' }}>✕</button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={item.defaultOpen === true} onChange={(e) => { const items = [...(c.items || [])]; items[i] = { ...items[i], defaultOpen: e.target.checked }; set('items', items); }} />
                  <span className="text-sm">Loaded Open</span>
                </label>
                <input className="form-input" placeholder="Question" value={item.question || ''}
                  style={{ marginBottom: '0.5rem' }}
                  onChange={(e) => { const items = [...(c.items || [])]; items[i] = { ...items[i], question: e.target.value }; set('items', items); }} />
                <textarea className="form-input form-textarea" rows={2} placeholder="Answer"
                  value={item.answer || ''}
                  onChange={(e) => { const items = [...(c.items || [])]; items[i] = { ...items[i], answer: e.target.value }; set('items', items); }} />
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => set('items', [...(c.items || []), { question: '', answer: '' }])}>
              <Plus size={14} style={{ marginRight: 6 }}/> Add Question
            </button>
          </Card>

          <Card title="FAQ Styling">
            <div className="ub-settings-item-box">
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.5rem' }}>Question Styling</span>
              <InlineColor label="Text Colour" value={c.qColor || '#111827'} onChange={(val) => set('qColor', val)} />
              <div style={{ margin: '0.5rem 0' }} />
              <InlineColor label="Background Colour" value={c.qBgColor || 'transparent'} onChange={(val) => set('qBgColor', val)} />
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                <Field label="Font Size (px)">
                  <input className="form-input" type="number" value={c.qFontSize || 18} onChange={(e) => set('qFontSize', Number(e.target.value))} />
                </Field>
                <Field label="Font Weight">
                  <SearchableSelect className="form-input" value={c.qFontWeight || '700'} onChange={(val) => set('qFontWeight', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Regular (400)', value: '400' },
    { label: 'Medium (500)', value: '500' },
    { label: 'Semibold (600)', value: '600' },
    { label: 'Bold (700)', value: '700' },
    { label: 'Black (800)', value: '800' }
  ]}
/>
                </Field>
              </div>
            </div>

            <div className="ub-settings-item-box" style={{ marginTop: '1rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.5rem' }}>Answer Styling</span>
              <InlineColor label="Text Colour" value={c.aColor || '#4b5563'} onChange={(val) => set('aColor', val)} />
              <div style={{ margin: '0.5rem 0' }} />
              <InlineColor label="Background Colour" value={c.aBgColor || 'transparent'} onChange={(val) => set('aBgColor', val)} />
              <div className="form-row" style={{ marginTop: '0.5rem' }}>
                <Field label="Font Size (px)">
                  <input className="form-input" type="number" value={c.aFontSize || 16} onChange={(e) => set('aFontSize', Number(e.target.value))} />
                </Field>
              </div>
            </div>

            <div className="ub-settings-item-box" style={{ marginTop: '1rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.5rem' }}>Accordion Border</span>
              <InlineColor label="Border Colour" value={c.borderColor || '#e5e7eb'} onChange={(val) => set('borderColor', val)} />
              <div className="form-row" style={{ marginTop: '0.5rem' }}>
                <Field label="Border Radius">
                  <input className="form-input" type="number" min="0" value={c.borderRadius ?? 0} onChange={(e) => set('borderRadius', Number(e.target.value))} />
                </Field>
              </div>
            </div>
          </Card>
        </div>
      );

    case 'custom_html':
      return (
        <div className="builder-panel-content">
          <Card title="Custom HTML" desc="Paste your own HTML code.">
            <Field label="HTML">
              <textarea className="form-input form-textarea" rows={8} value={c.html || ''}
                onChange={(e) => set('html', e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }} />
            </Field>
          </Card>
        </div>
      );

    case 'container':
      return (
        <div className="builder-panel-content">
          <Card title="Container Style">
            <InlineColor label="Background Colour" value={c.bgColor || 'transparent'} onChange={(val) => set('bgColor', val)} />
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Padding">
                <input className="form-input" value={c.padding || '40px'} onChange={(e) => set('padding', e.target.value)} placeholder="40px" />
              </Field>
              <Field label="Max Width">
                <input className="form-input" value={c.maxWidth || '1200px'} onChange={(e) => set('maxWidth', e.target.value)} placeholder="1200px" />
              </Field>
            </div>
          </Card>
          <Card title="Border">
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Border Width">
                <input className="form-input" type="number" value={c.borderWidth || 0} min="0" max="20" onChange={(e) => set('borderWidth', Number(e.target.value))} />
              </Field>
              <Field label="Border Radius">
                <input className="form-input" type="number" value={c.borderRadius || 0} min="0" max="50" onChange={(e) => set('borderRadius', Number(e.target.value))} />
              </Field>
            </div>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Border Style">
                <SearchableSelect className="form-input" value={c.borderStyle || 'solid'} onChange={(val) => set('borderStyle', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Solid', value: 'solid' },
    { label: 'Dashed', value: 'dashed' },
    { label: 'Dotted', value: 'dotted' }
  ]}
/>
              </Field>
              <Field label="">
                <div style={{ height: '1.25rem' }} />
                <InlineColor label="Border Colour" value={c.borderColor || '#e5e7eb'} onChange={(val) => set('borderColor', val)} />
              </Field>
            </div>
          </Card>
          <Card title="Spacing">
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Margin Top">
                <input className="form-input" value={c.marginTop || '0px'} onChange={(e) => set('marginTop', e.target.value)} placeholder="0px" />
              </Field>
              <Field label="Margin Bottom">
                <input className="form-input" value={c.marginBottom || '0px'} onChange={(e) => set('marginBottom', e.target.value)} placeholder="0px" />
              </Field>
            </div>
            <Field label="Gap Between Blocks">
              <input className="form-input" type="number" value={c.gap || 0} min="0" max="100" onChange={(e) => set('gap', Number(e.target.value))} />
            </Field>
          </Card>
          <Card title="Effects">
            <Field label="">
              <label className="pb-checkbox">
                <input type="checkbox" checked={c.shadow ?? false} onChange={(e) => set('shadow', e.target.checked)} />
                Enable box shadow
              </label>
            </Field>
            {c.shadow && (
              <Field label="Shadow">
                <input className="form-input" value={c.shadowValue || '0 4px 24px rgba(0,0,0,0.08)'} onChange={(e) => set('shadowValue', e.target.value)} placeholder="0 4px 24px rgba(0,0,0,0.08)" />
              </Field>
            )}
            <Field label="Overflow">
              <SearchableSelect className="form-input" value={c.overflow || 'visible'} onChange={(val) => set('overflow', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Visible', value: 'visible' },
    { label: 'Hidden', value: 'hidden' }
  ]}
/>
            </Field>
          </Card>
        </div>
      );

    case 'columns':
      const cols = (c.columns || []).map((col: any) => Array.isArray(col) ? { blocks: col } : col);
      const selectedCol = editingColumnIndex != null ? cols[editingColumnIndex] : null;
      const selectedColBlocks: PageBlock[] = selectedCol?.blocks || [];
      return (
        <div className="builder-panel-content">
          <Card title="Layout">
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Columns">
                <SearchableSelect className="form-input" value={cols.length.toString()} onChange={(val) => {
                  const len = Number(val);
                  const newCols = [...cols];
                  if (len > newCols.length) {
                    while (newCols.length < len) newCols.push({ blocks: [] });
                  } else if (len < newCols.length) {
                    newCols.splice(len);
                  }
                  set('columns', newCols);
                }}
  searchable={false}
  sort={false}
  options={[
    { label: '1 Column', value: '1' },
    { label: '2 Columns', value: '2' },
    { label: '3 Columns', value: '3' },
    { label: '4 Columns', value: '4' }
  ]}
/>
              </Field>
              <Field label="Gap (px)">
                <input className="form-input" type="number" value={c.gap || 16} min="0" max="100" onChange={(e) => set('gap', Number(e.target.value))} />
              </Field>
            </div>
            <Field label="">
              <label className="pb-checkbox">
                <input type="checkbox" checked={c.stackOnMobile ?? true} onChange={(e) => set('stackOnMobile', e.target.checked)} />
                Stack columns on mobile
              </label>
            </Field>
          </Card>

          {editingColumnIndex != null && selectedCol ? (
            <>
              <Card title={`Column ${editingColumnIndex + 1} Style`} desc="Click a column on the canvas to select it.">
                <InlineColor label="Background" value={selectedCol.bgColor || 'transparent'} onChange={(val) => onColumnStyleChange?.({ bgColor: val })} />
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="Border Width">
                    <input className="form-input" type="number" value={selectedCol.borderWidth || 0} min="0" max="20" onChange={(e) => onColumnStyleChange?.({ borderWidth: Number(e.target.value) })} />
                  </Field>
                  <Field label="Border Radius">
                    <input className="form-input" type="number" value={selectedCol.borderRadius || 0} min="0" max="50" onChange={(e) => onColumnStyleChange?.({ borderRadius: Number(e.target.value) })} />
                  </Field>
                </div>
                <InlineColor label="Border Colour" value={selectedCol.borderColor || '#e5e7eb'} onChange={(val) => onColumnStyleChange?.({ borderColor: val })} />
                <Field label="Padding">
                  <input className="form-input" value={selectedCol.padding || ''} onChange={(e) => onColumnStyleChange?.({ padding: e.target.value })} placeholder="e.g. 16px or 12px 20px" />
                </Field>
              </Card>

              {selectedColBlocks.length > 0 && (
                <Card title={`Blocks in Column ${editingColumnIndex + 1}`}>
                  {selectedColBlocks.map((sb: PageBlock) => (
                    <div key={sb.id} className="ub-settings-item-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.75rem' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500, textTransform: 'capitalize' }}>{sb.type.replace('_', ' ')}</span>
                      <button className="btn btn-ghost btn-icon-sm danger" onClick={() => onRemoveSubBlock?.(sb.id)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </Card>
              )}
            </>
          ) : (
            <div className="ub-settings-card" style={{ background: 'var(--surface-50)', border: '1px dashed var(--border-color)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0, padding: '1rem' }}>
                Click a column on the canvas to customise its style and manage its blocks.
              </p>
            </div>
          )}
        </div>
      );

    default:
      return <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>No settings available for this block type.</p>;
  }
}

/* ─── Card wrapper ─────────────────────────────── */
function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="ub-settings-card">
      <div className="ub-settings-card-header">
        <h3 className="ub-settings-card-title">{title}</h3>
        {desc && <p className="ub-settings-card-desc">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

/* ─── Inline colour row (label + picker side-by-side) ─── */
function InlineColor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="form-group color-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label className="form-label" style={{ margin: 0 }}>{label}</label>
      <div className="color-input-wrap">
        <ColorPicker value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      {children}
    </div>
  );
}

function SpacingCard({ c, set }: { c: Record<string, any>; set: (k: string, v: any) => void }) {
  return (
    <Card title="Spacing">
      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Field label="Margin Top (px)">
          <input className="form-input" type="number" value={c.marginTop || 0} min="0" onChange={(e) => set('marginTop', Number(e.target.value))} />
        </Field>
        <Field label="Margin Bottom (px)">
          <input className="form-input" type="number" value={c.marginBottom || 0} min="0" onChange={(e) => set('marginBottom', Number(e.target.value))} />
        </Field>
      </div>
      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
        <Field label="Padding Top (px)">
          <input className="form-input" type="number" value={c.paddingTop || 0} min="0" onChange={(e) => set('paddingTop', Number(e.target.value))} />
        </Field>
        <Field label="Padding Bottom (px)">
          <input className="form-input" type="number" value={c.paddingBottom || 0} min="0" onChange={(e) => set('paddingBottom', Number(e.target.value))} />
        </Field>
      </div>
    </Card>
  );
}

/* ─── Block-level Font Picker (reusable) ─── */
const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Outfit', 'Raleway', 'Nunito', 'Playfair Display', 'Oswald',
  'Source Sans 3', 'DM Sans', 'Space Grotesk', 'Manrope', 'Sora',
];

const _loadedFonts = new Set<string>();
function loadGoogleFont(name: string) {
  if (!name || _loadedFonts.has(name)) return;
  _loadedFonts.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;600;700;900&display=swap`;
  document.head.appendChild(link);
}

function BlockFontPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (value) loadGoogleFont(value); }, [value]);
  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 0); }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = GOOGLE_FONTS.filter(f => !search || f.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="form-group" style={{ position: 'relative' }} ref={ref}>
      <label className="form-label">{label}</label>
      <button type="button" className="form-input ub-font-picker-trigger" onClick={() => setOpen(!open)}>
        <span style={{ fontFamily: `'${value || 'inherit'}', sans-serif` }}>{value || 'Theme Default'}</span>
        <ChevronDown size={14} style={{ opacity: 0.45, flexShrink: 0 }} />
      </button>
      {open && (
        <div className="ub-font-dropdown">
          <div className="ub-font-search-wrap">
            <Search size={14} className="ub-font-search-icon" />
            <input ref={searchRef} className="form-input ub-font-search" placeholder="Search fonts…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="ub-font-list">
            <button type="button" className={`ub-font-item${!value ? ' active' : ''}`} onClick={() => { onChange(''); setOpen(false); setSearch(''); }}>
              Theme Default
            </button>
            {filtered.map(f => (
              <button type="button" key={f} className={`ub-font-item${value === f ? ' active' : ''}`}
                onClick={() => { loadGoogleFont(f); onChange(f); setOpen(false); setSearch(''); }}
                onMouseEnter={() => loadGoogleFont(f)}
                style={{ fontFamily: `'${f}', sans-serif` }}
              >
                {f}
              </button>
            ))}
            {filtered.length === 0 && <div className="ub-font-empty">No fonts match "{search}"</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Half Hero Editor ─────────────────────────── */
function HalfHeroEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const bgMode = c.bgMode || 'image';

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `hero-images/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('store-assets').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(fileName);
      set('imageUrl', publicUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="builder-panel-content">
      {/* Background Card */}
      <Card title="Background">
        <Field label="Background Mode">
          <SearchableSelect className="form-input" value={bgMode} onChange={(val) => set('bgMode', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Image', value: 'image' },
    { label: 'Solid Colour', value: 'colour' }
  ]}
/>
        </Field>

        {bgMode === 'image' ? (
          <>
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>Hero Image</label>
              <label className="ub-logo-upload-zone">
                {c.imageUrl ? (
                  <>
                    <img src={c.imageUrl} alt="Hero" style={{ display: 'block', height: 80, width: 'auto', maxWidth: '100%', objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
                    <span className="ub-upload-replace">{uploading ? 'Uploading...' : 'Click to replace image'}</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} color="var(--text-tertiary)" />
                    <span className="ub-upload-title">{uploading ? 'Uploading...' : 'Upload hero image'}</span>
                    <span className="ub-upload-hint">Supports PNG, JPG, or WebP</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploading} />
              </label>
              {c.imageUrl && (
                <button className="btn btn-ghost danger btn-sm" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }} onClick={() => set('imageUrl', '')}>Remove Image</button>
              )}
            </div>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Image Position">
                <SearchableSelect className="form-input" value={c.objectPosition || 'center'} onChange={(val) => set('objectPosition', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Top', value: 'top' },
    { label: 'Center', value: 'center' },
    { label: 'Bottom', value: 'bottom' },
    { label: 'Left', value: 'left' },
    { label: 'Right', value: 'right' }
  ]}
/>
              </Field>
              <Field label="Image Opacity">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input type="range" min="0" max="1" step="0.05" value={c.imageOpacity ?? 0.85} style={{ flex: 1 }}
                    onChange={(e) => set('imageOpacity', Number(e.target.value))} />
                  <span className="pb-range-val">{Math.round((c.imageOpacity ?? 0.85) * 100)}%</span>
                </div>
              </Field>
            </div>

            <InlineColor label="Overlay Colour" value={c.overlayColor || '#000000'} onChange={(val) => set('overlayColor', val)} />
            <Field label="Overlay Opacity">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input type="range" min="0" max="1" step="0.05" value={c.overlayOpacity ?? 0} style={{ flex: 1 }}
                  onChange={(e) => set('overlayOpacity', Number(e.target.value))} />
                <span className="pb-range-val">{Math.round((c.overlayOpacity ?? 0) * 100)}%</span>
              </div>
            </Field>
          </>
        ) : (
          <InlineColor label="Background Colour" value={c.bgColor || '#1e293b'} onChange={(val) => set('bgColor', val)} />
        )}

        <Field label="Height">
          <input className="form-input" value={c.height || '600px'} onChange={(e) => set('height', e.target.value)} placeholder="600px" />
        </Field>
      </Card>

      {/* Content Card */}
      <Card title="Content" desc="Text overlay on the hero.">
        <Field label="Title">
          <input className="form-input" value={c.title || ''} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <BlockFontPicker label="Title Font" value={c.titleFont || ''} onChange={(v) => set('titleFont', v)} />
          <Field label="Size (px)">
            <input className="form-input" type="number" value={c.titleFontSize ?? 56} min="10" max="150" onChange={(e) => set('titleFontSize', Number(e.target.value))} />
          </Field>
        </div>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Font Weight">
            <SearchableSelect className="form-input" value={c.titleFontWeight || '900'} onChange={(val) => set('titleFontWeight', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Regular (400)', value: '400' },
    { label: 'Medium (500)', value: '500' },
    { label: 'Semi-Bold (600)', value: '600' },
    { label: 'Bold (700)', value: '700' },
    { label: 'Extra-Bold (800)', value: '800' },
    { label: 'Black (900)', value: '900' }
  ]}
/>
          </Field>
          <Field label="">
            <div style={{ height: '1.25rem' }} />
            <InlineColor label="Title Colour" value={c.titleColor || '#ffffff'} onChange={(val) => set('titleColor', val)} />
          </Field>
        </div>

        <Field label="Subtitle">
          <input className="form-input" value={c.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} placeholder="Optional descriptive text" />
        </Field>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Size (px)">
            <input className="form-input" type="number" value={c.subtitleFontSize ?? 18} min="10" max="100" onChange={(e) => set('subtitleFontSize', Number(e.target.value))} />
          </Field>
          <Field label="">
            <div style={{ height: '1.25rem' }} />
            <InlineColor label="Subtitle Colour" value={c.subtitleColor || '#ffffff'} onChange={(val) => set('subtitleColor', val)} />
          </Field>
        </div>
      </Card>

      {/* Card Styling */}
      <Card title="Card Style" desc="The content card that holds your text.">
        <InlineColor label="Card Background" value={c.cardBgColor || '#000000'} onChange={(val) => set('cardBgColor', val)} />
        <Field label="Card Opacity">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input type="range" min="0" max="1" step="0.05" value={c.cardBgOpacity ?? 0.4} style={{ flex: 1 }}
              onChange={(e) => set('cardBgOpacity', Number(e.target.value))} />
            <span className="pb-range-val">{Math.round((c.cardBgOpacity ?? 0.4) * 100)}%</span>
          </div>
        </Field>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Border Radius">
            <input className="form-input" type="number" value={c.cardRadius ?? 12} min="0" max="50"
              onChange={(e) => set('cardRadius', Number(e.target.value))} />
          </Field>
          <Field label="Blur Amount">
            <input className="form-input" type="number" value={c.cardBlurAmount ?? 10} min="0" max="30"
              onChange={(e) => set('cardBlurAmount', Number(e.target.value))} />
          </Field>
        </div>
        <Field label="">
          <label className="pb-checkbox">
            <input type="checkbox" checked={c.cardBlur !== false} onChange={(e) => set('cardBlur', e.target.checked)} />
            Enable backdrop blur
          </label>
        </Field>
      </Card>

      {/* CTA Button */}
      <Card title="CTA Button">
        <Field label="Button Text">
          <input className="form-input" value={c.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} />
        </Field>
        <Field label="Button Link">
          <LinkPicker value={c.ctaLink || ''} onChange={(val) => set('ctaLink', val)} />
        </Field>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <InlineColor label="Button BG" value={c.ctaBgColor || ''} onChange={(val) => set('ctaBgColor', val)} />
          <InlineColor label="Button Text" value={c.ctaTextColor || '#ffffff'} onChange={(val) => set('ctaTextColor', val)} />
        </div>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Font Size (px)">
            <input className="form-input" type="number" value={c.ctaFontSize ?? 16} min="10" max="60" onChange={(e) => set('ctaFontSize', Number(e.target.value))} />
          </Field>
          <Field label="Border Radius">
            <input className="form-input" type="number" value={c.ctaRadius ?? 8} min="0" max="50"
              onChange={(e) => set('ctaRadius', Number(e.target.value))} />
          </Field>
        </div>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Padding Size">
            <SearchableSelect className="form-input" value={c.ctaSize || 'md'} onChange={(val) => set('ctaSize', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Small (Compact)', value: 'sm' },
    { label: 'Medium (Standard)', value: 'md' },
    { label: 'Large (Spaced)', value: 'lg' }
  ]}
/>
          </Field>
          <div />
        </div>
      </Card>
    </div>
  );
}

/* ─── Hero Banner Editor ─────────────────────────── */
function HeroBannerEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const bgMode = c.bgMode || 'image';

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `hero-images/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('store-assets').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(fileName);
      set('imageUrl', publicUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="builder-panel-content">
      {/* Background Card */}
      <Card title="Background">
        <Field label="Background Mode">
          <SearchableSelect className="form-input" value={bgMode} onChange={(val) => set('bgMode', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Image', value: 'image' },
    { label: 'Solid Colour', value: 'colour' }
  ]}
/>
        </Field>

        {bgMode === 'image' ? (
          <>
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>Hero Image</label>
              <label className="ub-logo-upload-zone">
                {c.imageUrl ? (
                  <>
                    <img src={c.imageUrl} alt="Hero" style={{ display: 'block', height: 80, width: 'auto', maxWidth: '100%', objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
                    <span className="ub-upload-replace">{uploading ? 'Uploading...' : 'Click to replace image'}</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} color="var(--text-tertiary)" />
                    <span className="ub-upload-title">{uploading ? 'Uploading...' : 'Upload hero image'}</span>
                    <span className="ub-upload-hint">Supports PNG, JPG, or WebP</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploading} />
              </label>
              {c.imageUrl && (
                <button className="btn btn-ghost danger btn-sm" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }} onClick={() => set('imageUrl', '')}>Remove Image</button>
              )}
            </div>
          </>
        ) : (
          <InlineColor label="Background Colour" value={c.bgColor || '#1e293b'} onChange={(val) => set('bgColor', val)} />
        )}

        <InlineColor label="Overlay Colour" value={c.overlayColor || '#000000'} onChange={(val) => set('overlayColor', val)} />
        <Field label="Overlay Opacity">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input type="range" min="0" max="1" step="0.05" value={c.overlayOpacity ?? 0.4} style={{ flex: 1 }}
              onChange={(e) => set('overlayOpacity', Number(e.target.value))} />
            <span className="pb-range-val">{Math.round((c.overlayOpacity ?? 0.4) * 100)}%</span>
          </div>
        </Field>

        <Field label="Min Height">
          <input className="form-input" value={c.height || '600px'} onChange={(e) => set('height', e.target.value)} placeholder="600px" />
        </Field>
      </Card>

      {/* Content Card */}
      <Card title="Content">
        <Field label="Title">
          <input className="form-input" value={c.title || ''} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <BlockFontPicker label="Title Font" value={c.titleFont || ''} onChange={(v) => set('titleFont', v)} />
          <Field label="Size (px)">
            <input className="form-input" type="number" value={c.titleFontSize ?? 56} min="10" max="150" onChange={(e) => set('titleFontSize', Number(e.target.value))} />
          </Field>
        </div>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Font Weight">
            <SearchableSelect className="form-input" value={c.titleFontWeight || '900'} onChange={(val) => set('titleFontWeight', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Regular (400)', value: '400' },
    { label: 'Medium (500)', value: '500' },
    { label: 'Semi-Bold (600)', value: '600' },
    { label: 'Bold (700)', value: '700' },
    { label: 'Extra-Bold (800)', value: '800' },
    { label: 'Black (900)', value: '900' }
  ]}
/>
          </Field>
          <Field label="">
            <div style={{ height: '1.25rem' }} />
            <InlineColor label="Title Colour" value={c.titleColor || '#ffffff'} onChange={(val) => set('titleColor', val)} />
          </Field>
        </div>

        <Field label="Subtitle">
          <input className="form-input" value={c.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} />
        </Field>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Size (px)">
            <input className="form-input" type="number" value={c.subtitleFontSize ?? 18} min="10" max="100" onChange={(e) => set('subtitleFontSize', Number(e.target.value))} />
          </Field>
          <Field label="">
            <div style={{ height: '1.25rem' }} />
            <InlineColor label="Subtitle Colour" value={c.subtitleColor || '#ffffff'} onChange={(val) => set('subtitleColor', val)} />
          </Field>
        </div>
      </Card>

      {/* Buttons Card */}
      <Card title="Buttons">
        <Field label="Button Spacing (px)">
          <input className="form-input" type="number" value={c.buttonSpacing ?? 16} min="0" max="60" onChange={(e) => set('buttonSpacing', Number(e.target.value))} />
        </Field>
        
        {(() => {
          // Fallback logic for old single CTA config structure
          const buttons = Array.isArray(c.buttons) ? c.buttons : (c.ctaText ? [{ text: c.ctaText, link: c.ctaLink, bgColor: c.ctaBgColor, textColor: c.ctaTextColor, radius: c.ctaRadius, size: c.ctaSize, fontSize: c.ctaFontSize }] : []);
          const updateBtn = (i: number, k: string, v: any) => {
            const nb = [...buttons];
            nb[i] = { ...nb[i], [k]: v };
            set('buttons', nb);
          };
          const addBtn = () => set('buttons', [...buttons, { text: 'New Button', link: '', bgColor: '', textColor: '#ffffff', radius: 99, size: 'md', fontSize: 16 }]);
          const rmBtn = (i: number) => set('buttons', buttons.filter((_, idx) => idx !== i));
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
              {buttons.map((btn: any, i: number) => (
                <div key={i} style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px', position: 'relative' }}>
                  <button onClick={() => rmBtn(i)} className="btn btn-ghost danger btn-sm" style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', padding: '0.25rem' }}>
                    <Trash2 size={14} />
                  </button>
                  <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.875rem' }}>Button {i + 1}</div>
                  
                  <Field label="Text">
                    <input className="form-input" value={btn.text || ''} onChange={(e) => updateBtn(i, 'text', e.target.value)} />
                  </Field>
                  <Field label="Link">
                    <LinkPicker value={btn.link || ''} onChange={(val) => updateBtn(i, 'link', val)} />
                  </Field>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <InlineColor label="Background" value={btn.bgColor || ''} onChange={(val) => updateBtn(i, 'bgColor', val)} />
                    <InlineColor label="Text Colour" value={btn.textColor || '#ffffff'} onChange={(val) => updateBtn(i, 'textColor', val)} />
                  </div>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <Field label="Font Size (px)">
                      <input className="form-input" type="number" value={btn.fontSize ?? 16} min="10" max="60" onChange={(e) => updateBtn(i, 'fontSize', Number(e.target.value))} />
                    </Field>
                    <Field label="Border Radius">
                      <input className="form-input" type="number" value={btn.radius ?? 99} min="0" max="99" onChange={(e) => updateBtn(i, 'radius', Number(e.target.value))} />
                    </Field>
                  </div>
                  <Field label="Padding Size">
                    <SearchableSelect value={btn.size || 'md'} onChange={(val) => updateBtn(i, 'size', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' }
  ]}
/>
                  </Field>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addBtn}>+ Add Button</button>
            </div>
          );
        })()}
      </Card>
    </div>
  );
}

/* ─── Category Links Editor ────────────────────── */
function CategoryLinksEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const selectedIds = c.collectionIds || [];
  const mode = c.mode || (selectedIds.length > 0 ? 'manual' : 'auto');

  useEffect(() => {
    api.fetchCollections().then(setCollections).catch(console.error);
  }, []);

  return (
    <div className="builder-panel-content">
      <Card title="Collections" desc="Select the collections to feature on the storefront.">
        <div className="ub-settings-item-box" style={{ padding: '1rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <Field label="Selection Mode">
              <SearchableSelect 
                className="form-input" 
                value={mode} 
                onChange={(val) => set('mode', val)}
                searchable={false}
                sort={false}
                clearable={false}
                options={[
                  { label: 'Automatic (Latest collections)', value: 'auto' },
                  { label: 'Manual (Select specific collections)', value: 'manual' }
                ]}
              />
            </Field>
          </div>
          
          {mode === 'manual' && (
            <div style={{ marginBottom: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              {collections.length > 0 ? (
                <Field label="Specific Collections">
                  <MultiSelect
                    options={collections.map(c => ({ label: c.name, value: c.id }))}
                    value={selectedIds}
                    onChange={(val) => set('collectionIds', val)}
                    placeholder="Select collections..."
                    clearable={true}
                    searchable={true}
                  />
                </Field>
              ) : (
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem', fontStyle: 'italic' }}>No collections found</span>
              )}
            </div>
          )}
          
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <Field label="Limit (if none selected)">
              <input 
                className="form-input" 
                type="number" 
                value={c.limit || 3} 
                min="1" 
                max="20" 
                onChange={(e) => set('limit', Number(e.target.value))} 
                style={{ maxWidth: '120px' }}
              />
            </Field>
          </div>
        </div>
      </Card>
      <Card title="Layout">
        <div className="ub-settings-item-box" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label="Columns (Desktop)">
            <SearchableSelect 
              className="form-input" 
              value={c.columns?.toString() || '3'} 
              onChange={(val) => set('columns', Number(val))}
              searchable={false}
              sort={false}
              clearable={false}
              options={[
                { label: '2 Columns', value: '2' },
                { label: '3 Columns', value: '3' },
                { label: '4 Columns', value: '4' },
                { label: '5 Columns', value: '5' },
                { label: '6 Columns', value: '6' }
              ]}
            />
          </Field>
          
          <Field label="Image Aspect Ratio">
            <SearchableSelect 
              className="form-input" 
              value={c.aspectRatio || 'auto'} 
              onChange={(val) => set('aspectRatio', val)}
              searchable={false}
              sort={false}
              clearable={false}
              options={[
                { label: 'Auto (Original)', value: 'auto' },
                { label: 'Square (1:1)', value: 'square' },
                { label: 'Portrait (3:4)', value: 'portrait' },
                { label: 'Landscape (4:3)', value: 'landscape' }
              ]}
            />
          </Field>
          
          <Field label="Text Position">
            <SearchableSelect 
              className="form-input" 
              value={c.textPosition || 'below'} 
              onChange={(val) => set('textPosition', val)}
              searchable={false}
              sort={false}
              clearable={false}
              options={[
                { label: 'Below Image', value: 'below' },
                { label: 'Overlay on Image', value: 'overlay' }
              ]}
            />
          </Field>
          
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.25rem' }}>
            <label className="ub-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={c.stackOnMobile ?? true} onChange={(e) => set('stackOnMobile', e.target.checked)} />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Stack items vertically on mobile view</span>
            </label>
          </div>
        </div>
      </Card>
      <Card title="Card Styling">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Background Color">
            <ColorPicker value={c.bgColor || ''} onChange={(val) => set('bgColor', val)} />
          </Field>
          <Field label="Border Color">
            <ColorPicker value={c.borderColor || ''} onChange={(val) => set('borderColor', val)} />
          </Field>
          <Field label="Border Radius (px)">
            <input className="form-input" type="number" value={c.borderRadius ?? 0} onChange={(e) => set('borderRadius', Number(e.target.value))} />
          </Field>
          <Field label="Hover Effect">
             <label className="ub-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '0.5rem' }}>
              <input type="checkbox" checked={c.hoverEffect ?? true} onChange={(e) => set('hoverEffect', e.target.checked)} />
              <span style={{ fontSize: '0.8125rem' }}>Elevate card on hover</span>
            </label>
          </Field>
        </div>
      </Card>
      <Card title="Text & Button Options">
        <Field label="Title Color">
          <ColorPicker value={c.titleColor || ''} onChange={(val) => set('titleColor', val)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <Field label="Button Text">
            <input className="form-input" value={c.ctaText ?? 'SHOP NOW'} onChange={(e) => set('ctaText', e.target.value)} />
          </Field>
          <Field label="Button Style">
            <SearchableSelect className="form-input" value={c.ctaStyle || 'link'} onChange={(val) => set('ctaStyle', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Text Link', value: 'link' },
    { label: 'Primary Button', value: 'primary' },
    { label: 'Secondary Button', value: 'secondary' }
  ]}
/>
          </Field>
          {c.ctaStyle && c.ctaStyle !== 'link' && (
             <Field label="Button Custom Color">
               <ColorPicker value={c.ctaColor || ''} onChange={(val) => set('ctaColor', val)} />
             </Field>
          )}
        </div>
      </Card>
      <Card title="Block Spacing">
        <div style={{ padding: '0.5rem 0', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Padding (Internal)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Field label="Top"><input type="number" className="form-input" value={c.paddingTop ?? ''} onChange={e => set('paddingTop', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="0" /></Field>
          <Field label="Right"><input type="number" className="form-input" value={c.paddingRight ?? ''} onChange={e => set('paddingRight', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="0" /></Field>
          <Field label="Bottom"><input type="number" className="form-input" value={c.paddingBottom ?? ''} onChange={e => set('paddingBottom', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="0" /></Field>
          <Field label="Left"><input type="number" className="form-input" value={c.paddingLeft ?? ''} onChange={e => set('paddingLeft', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="0" /></Field>
        </div>

        <div style={{ padding: '0.5rem 0', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Margin (External)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
          <Field label="Top"><input type="number" className="form-input" value={c.marginTop ?? ''} onChange={e => set('marginTop', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="0" /></Field>
          <Field label="Right"><input type="number" className="form-input" value={c.marginRight ?? ''} onChange={e => set('marginRight', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="0" /></Field>
          <Field label="Bottom"><input type="number" className="form-input" value={c.marginBottom ?? ''} onChange={e => set('marginBottom', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="4rem" /></Field>
          <Field label="Left"><input type="number" className="form-input" value={c.marginLeft ?? ''} onChange={e => set('marginLeft', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="0" /></Field>
        </div>
      </Card>
    </div>
  );
}

/* ─── Banner Editor ────────────────────────────── */
function BannerEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const mode = c.mode || 'static';
  const bgMode = c.bgMode || 'colour';

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `banner-images/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('store-assets').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(fileName);
      set('imageUrl', publicUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="builder-panel-content">
      <Card title="Content mode">
        <Field label="Display Mode">
          <SearchableSelect className="form-input" value={mode} onChange={(val) => set('mode', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Static Text', value: 'static' },
    { label: 'Scrolling Ticker', value: 'ticker' }
  ]}
/>
        </Field>
      </Card>

      <Card title={mode === 'ticker' ? "Ticker Text" : "Banner Text"}>
        <Field label="Text">
          <input className="form-input" value={c.text || ''} onChange={(e) => set('text', e.target.value)} placeholder="Enter your message..." />
        </Field>
        {mode === 'ticker' && (
          <Field label="Scroll Speed (seconds)">
            <input type="number" className="form-input" value={c.speed || 30} onChange={(e) => set('speed', Number(e.target.value))} />
          </Field>
        )}
        {mode === 'static' && (
          <Field label="Alignment">
            <SearchableSelect className="form-input" value={c.align || 'center'} onChange={(val) => set('align', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Left', value: 'left' },
    { label: 'Centre', value: 'center' },
    { label: 'Right', value: 'right' }
  ]}
/>
          </Field>
        )}
      </Card>

      <Card title="Typography">
        <BlockFontPicker label="Font Family" value={c.fontFamily || ''} onChange={(val) => set('fontFamily', val)} />
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <Field label="Font Size (px)">
            <input type="number" className="form-input" value={c.fontSize || ''} onChange={(e) => set('fontSize', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 16" />
          </Field>
          <Field label="Font Weight">
            <SearchableSelect className="form-input" value={c.fontWeight || 600} onChange={(val) => set('fontWeight', Number(val))}
  searchable={false}
  sort={false}
  options={[
    { label: 'Regular (400)', value: '400' },
    { label: 'Medium (500)', value: '500' },
    { label: 'Semi Bold (600)', value: '600' },
    { label: 'Bold (700)', value: '700' },
    { label: 'Extra Bold (800)', value: '800' },
    { label: 'Black (900)', value: '900' }
  ]}
/>
          </Field>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <InlineColor label="Text Colour" value={c.textColor || '#ffffff'} onChange={(val) => set('textColor', val)} />
        </div>
      </Card>

      <Card title="Background">
        <Field label="Background Mode">
          <SearchableSelect className="form-input" value={bgMode} onChange={(val) => set('bgMode', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Solid Colour', value: 'colour' },
    { label: 'Image with Overlay', value: 'image' }
  ]}
/>
        </Field>

        {bgMode === 'image' && (
          <>
            <Field label="Background Image">
              {c.imageUrl ? (
                <div style={{ marginBottom: '0.5rem', position: 'relative', borderRadius: '4px', overflow: 'hidden', height: '80px' }}>
                  <img src={c.imageUrl} alt="Bg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button className="btn btn-ghost btn-icon-sm danger" onClick={() => set('imageUrl', '')}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: '#fff' }}>✕</button>
                </div>
              ) : (
                <label className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', cursor: uploading ? 'wait' : 'pointer' }}>
                  <Upload size={14} />
                  {uploading ? 'Uploading...' : 'Upload Image'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploading} />
                </label>
              )}
            </Field>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <Field label="Aspect Ratio">
                <SearchableSelect className="form-input" value={c.aspectRatio || 'auto'} onChange={(val) => set('aspectRatio', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Auto', value: 'auto' },
    { label: 'Narrow (Padding)', value: 'narrow' },
    { label: 'Wide (Padding)', value: 'wide' }
  ]}
/>
              </Field>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <InlineColor label="Overlay Colour" value={c.overlayColor || '#000000'} onChange={(val) => set('overlayColor', val)} />
            </div>
            <Field label={`Overlay Opacity: ${c.overlayOpacity ?? 0.5}`}>
              <input type="range" className="form-range" min="0" max="1" step="0.05" value={c.overlayOpacity ?? 0.5}
                onChange={(e) => set('overlayOpacity', Number(e.target.value))} />
            </Field>
          </>
        )}

        {bgMode === 'colour' && (
          <div style={{ marginTop: '1rem' }}>
            <InlineColor label="Background Colour" value={c.bgColor || '#1a1a2e'} onChange={(val) => set('bgColor', val)} />
          </div>
        )}
      </Card>

      <Card title="Border & Layout">
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Border Width (px)">
            <input type="number" className="form-input" value={c.borderWidth || 0} min="0" max="20" onChange={(e) => set('borderWidth', Number(e.target.value))} />
          </Field>
          <Field label="Border Radius (px)">
            <input type="number" className="form-input" value={c.borderRadius || 0} min="0" max="50" onChange={(e) => set('borderRadius', Number(e.target.value))} />
          </Field>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <InlineColor label="Border Colour" value={c.borderColor || '#e5e7eb'} onChange={(val) => set('borderColor', val)} />
        </div>
      </Card>
      
      <Card title="Spacing">
         <Field label="Top Padding (px)">
           <input type="number" className="form-input" value={c.paddingTop ?? 16} min="0" max="100" onChange={(e) => set('paddingTop', Number(e.target.value))} />
         </Field>
         <Field label="Bottom Padding (px)">
           <input type="number" className="form-input" value={c.paddingBottom ?? 16} min="0" max="100" onChange={(e) => set('paddingBottom', Number(e.target.value))} />
         </Field>
      </Card>
    </div>
  );
}

/* ─── Image Block Editor ───────────────────────── */
function ImageBlockEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `store-images/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('store-assets').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(fileName);
      set('url', publicUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="builder-panel-content">
      <Card title="Image Source">
        <div className="form-group">
          <label className="form-label" style={{ marginBottom: 8 }}>Upload Image</label>
          <label className="ub-logo-upload-zone">
            {c.url ? (
              <>
                <img src={c.url} alt="Uploaded" style={{ display: 'block', height: 80, width: 'auto', maxWidth: '100%', objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
                <span className="ub-upload-replace">{uploading ? 'Uploading...' : 'Click to replace image'}</span>
              </>
            ) : (
              <>
                <Upload size={24} color="var(--text-tertiary)" />
                <span className="ub-upload-title">{uploading ? 'Uploading...' : 'Upload image'}</span>
                <span className="ub-upload-hint">Supports PNG, JPG, or WebP</span>
              </>
            )}
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
          {c.url && (
            <button className="btn btn-ghost danger btn-sm" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }} onClick={() => set('url', '')}>Remove Image</button>
          )}
        </div>
        <Field label="Alt Text (SEO & Accessibility)">
          <input className="form-input" value={c.alt || ''} onChange={(e) => set('alt', e.target.value)} placeholder="Description of image..." />
        </Field>
      </Card>
      
      <Card title="Action">
        <Field label="Link (Optional)">
          <LinkPicker value={c.link || ''} onChange={(val) => set('link', val)} />
        </Field>
      </Card>
      
      <Card title="Style">
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Width">
            <SearchableSelect className="form-input" value={c.width || '100%'} onChange={(val) => set('width', val)}
  searchable={false}
  sort={false}
  options={[
    { label: '100% (Full Width)', value: '100%' },
    { label: '75% Width', value: '75%' },
    { label: '50% Width', value: '50%' },
    { label: '25% Width', value: '25%' },
    { label: 'Auto (Natural Size)', value: 'auto' }
  ]}
/>
          </Field>
          <Field label="Alignment">
            <SearchableSelect className="form-input" value={c.align || 'center'} onChange={(val) => set('align', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Left', value: 'left' },
    { label: 'Centre', value: 'center' },
    { label: 'Right', value: 'right' }
  ]}
/>
          </Field>
        </div>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Radius (px)">
            <input className="form-input" type="number" value={c.borderRadius || ''} min="0" max="100"
              onChange={(e) => set('borderRadius', e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 12" />
          </Field>
          <Field label="Shadow">
            <SearchableSelect className="form-input" value={c.shadow || 'none'} onChange={(val) => set('shadow', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'None', value: 'none' },
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' }
  ]}
/>
          </Field>
        </div>
        <Field label="Opacity (%)">
          <input className="form-input" type="number" value={c.opacity ?? 100} min="0" max="100"
            onChange={(e) => set('opacity', e.target.value ? Number(e.target.value) : 100)} />
        </Field>
      </Card>
    </div>
  );
}

/* ─── Image Gallery Editor ───────────────────────── */
function ImageGalleryEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const images: string[] = Array.isArray(c.images) ? c.images : [];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const fileName = `store-images/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('store-assets').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(fileName);
        newUrls.push(publicUrl);
      }
      set('images', [...images, ...newUrls]);
    } catch (err) {
      console.error('Image gallery upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const next = [...images];
    next.splice(index, 1);
    set('images', next);
  };

  return (
    <div className="builder-panel-content">
      <Card title="Gallery Images">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          {images.map((url, i) => (
            <div key={i} style={{ position: 'relative', aspectRatio: '1/1' }}>
              <img src={url} alt={`Gallery ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
              <button
                className="btn btn-icon-sm danger"
                style={{ position: 'absolute', top: 4, right: 4, padding: 4, background: 'rgba(255,0,0,0.8)', color: 'white', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
                onClick={() => removeImage(i)}
                title="Remove image"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        
        <label className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
          <Upload size={16} style={{ marginRight: '0.5rem' }} /> {uploading ? 'Uploading...' : 'Add Images'}
          <input type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </Card>

      <Card title="Layout">
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Layout Mode">
            <SearchableSelect className="form-input" value={c.layout || 'grid'} onChange={(val) => set('layout', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Grid (Uniform)', value: 'grid' },
    { label: 'Masonry (Staggered)', value: 'masonry' },
    { label: 'Bento (Dynamic Spans)', value: 'bento' }
  ]}
/>
          </Field>
          <Field label="Columns">
            <SearchableSelect className="form-input" value={c.columns || 3} onChange={(val) => set('columns', Number(val))}
  searchable={false}
  sort={false}
  options={[
    { label: '2 Columns', value: '2' },
    { label: '3 Columns', value: '3' },
    { label: '4 Columns', value: '4' }
  ]}
/>
          </Field>
        </div>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Aspect Ratio">
            <SearchableSelect className="form-input" value={c.aspectRatio || 'square'} onChange={(val) => set('aspectRatio', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Square (1:1)', value: 'square' },
    { label: 'Landscape (4:3)', value: 'landscape' },
    { label: 'Portrait (3:4)', value: 'portrait' },
    { label: 'Auto (Original)', value: 'auto' }
  ]}
/>
          </Field>
          <Field label="Gap (px)">
            <input className="form-input" type="number" value={c.gap ?? 16} min="0" max="64"
              onChange={(e) => set('gap', Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title="Style">
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Radius (px)">
            <input className="form-input" type="number" value={c.borderRadius || ''} min="0" max="100"
              onChange={(e) => set('borderRadius', e.target.value ? Number(e.target.value) : '')} placeholder="0" />
          </Field>
          <Field label="Shadow">
            <SearchableSelect className="form-input" value={c.shadow || 'none'} onChange={(val) => set('shadow', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'None', value: 'none' },
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' }
  ]}
/>
          </Field>
        </div>
      </Card>
    </div>
  );
}

/* ─── Video Block Editor ───────────────────────── */
function VideoBlockEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const source = c.source || 'url';

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024 * 1024) {
      alert("This video is larger than 500MB. Please compress the file.");
      return;
    }

    setUploading(true);
    console.log('[VideoUploader] Starting upload sequence...', file.name, file.size, file.type);
    
    try {
      const ext = file.name.split('.').pop();
      const fileName = `store-videos/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      
      console.log(`[VideoUploader] Connecting to Supabase storage to upload: ${fileName}`);
      const res = await supabase.storage.from('store-assets').upload(fileName, file, { 
        upsert: true,
        contentType: file.type 
      });
      console.log('[VideoUploader] Supabase responded:', res);
      
      if (res.error) throw res.error;
      
      const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(fileName);
      console.log('[VideoUploader] Generated public URL:', publicUrl);
      
      set('url', publicUrl);
      console.log('[VideoUploader] Builder configuration updated successfully.');
    } catch (err: any) {
      console.error('[VideoUploader] Critical Exception Caught:', err);
      alert('Video Upload failed. Open your browser console (Cmd+Option+J) to see the exact error network reasons.');
    } finally {
      console.log('[VideoUploader] Upload sequence resolving cleanly.');
      setUploading(false);
      // Prevent browser holding the stale file in memory
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="builder-panel-content">
      <Card title="Video Source">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button className={`btn ${source === 'url' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => set('source', 'url')}>URL / YouTube</button>
          <button className={`btn ${source === 'upload' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => set('source', 'upload')}>Direct Upload</button>
        </div>

        {source === 'url' ? (
          <Field label="Video URL">
            <input className="form-input" value={c.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://youtube.com/watch?v=..." />
          </Field>
        ) : (
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: 8 }}>Upload MP4 or WebM Video</label>
            <label className="ub-logo-upload-zone" style={{ cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
              {c.url && source === 'upload' && !uploading ? (
                <>
                  <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, width: 140, marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 500 }}>Video File Loaded</span>
                  </div>
                  <span className="ub-upload-replace">Click to replace video</span>
                </>
              ) : uploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0' }}>
                  <style>
                    {`@keyframes ub-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
                  </style>
                  <Loader2 size={32} color="#ef4444" style={{ animation: 'ub-spin 1s linear infinite' }} />
                  <span className="ub-upload-title" style={{ color: '#ef4444', marginTop: '1rem', fontWeight: 600 }}>Uploading...</span>
                </div>
              ) : (
                <>
                  <Upload size={24} color="var(--text-tertiary)" />
                  <span className="ub-upload-title">Upload Video File</span>
                  <span className="ub-upload-hint">Supports MP4, WebM up to 500MB</span>
                </>
              )}
              <input type="file" accept="video/mp4,video/webm" onChange={handleVideoUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
            {c.url && source === 'upload' && !uploading && (
              <button className="btn btn-ghost danger btn-sm" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }} onClick={() => set('url', '')}>Remove Video</button>
            )}
          </div>
        )}
      </Card>

      <Card title="Playback Controls">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label className="pb-checkbox">
            <input type="checkbox" checked={c.autoplay || false} onChange={(e) => set('autoplay', e.target.checked)} />
            Autoplay Video
          </label>
          <label className="pb-checkbox">
            <input type="checkbox" checked={c.muted ?? false} onChange={(e) => set('muted', e.target.checked)} />
            Start Muted
          </label>
          <label className="pb-checkbox">
            <input type="checkbox" checked={c.controls ?? true} onChange={(e) => set('controls', e.target.checked)} />
            Show Custom Controls
          </label>
        </div>
        <p className="form-hint" style={{ marginTop: '1.2rem', marginBottom: 0, fontSize: 12 }}>
          <strong>Note:</strong> Browsers require videos to be muted for autoplay to natively trigger across devices.
        </p>
      </Card>
    </div>
  );
}

function CollectionShowcaseEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  useEffect(() => {
    api.fetchCollections().then(setCollections).catch(console.error);
  }, []);

  return (
    <div className="builder-panel-content">
      <Card title="Content">
        <Field label="Title">
          <input className="form-input" value={c.title || ''} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
          <BlockFontPicker label="Title Font" value={c.titleFont || ''} onChange={(v) => set('titleFont', v)} />
          <Field label="Size (px)">
            <input className="form-input" type="number" value={c.titleFontSize ?? 32} min="10" max="150" onChange={(e) => set('titleFontSize', Number(e.target.value))} />
          </Field>
        </div>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
          <Field label="Font Weight">
            <SearchableSelect className="form-input" value={c.titleFontWeight || '800'} onChange={(val) => set('titleFontWeight', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Regular (400)', value: '400' },
    { label: 'Medium (500)', value: '500' },
    { label: 'Semi-Bold (600)', value: '600' },
    { label: 'Bold (700)', value: '700' },
    { label: 'Extra-Bold (800)', value: '800' },
    { label: 'Black (900)', value: '900' }
  ]}
/>
          </Field>
          <Field label="">
            <div style={{ height: '1.25rem' }} />
            <InlineColor label="Title Colour" value={c.titleColor || '#000000'} onChange={(val) => set('titleColor', val)} />
          </Field>
        </div>

        <div style={{ marginTop: '1.5rem' }} />
        <Field label="Subtitle">
          <input className="form-input" value={c.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} />
        </Field>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
          <Field label="Size (px)">
            <input className="form-input" type="number" value={c.subtitleFontSize ?? 16} min="10" max="100" onChange={(e) => set('subtitleFontSize', Number(e.target.value))} />
          </Field>
          <Field label="">
            <div style={{ height: '1.25rem' }} />
            <InlineColor label="Subtitle Colour" value={c.subtitleColor || '#666666'} onChange={(val) => set('subtitleColor', val)} />
          </Field>
        </div>
      </Card>

      <Card title="Collection">
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <Field label="Select Collection">
            <SearchableSelect
              className="form-input"
              value={c.collectionId || ''}
              onChange={(val) => set('collectionId', val)}
              searchable={true}
              options={[
                { label: '-- All Products (Fallback) --', value: '' },
                ...collections.map((col: any) => ({ label: col.name, value: col.id }))
              ]}
            />
          </Field>
          <Field label="Limit">
            <input className="form-input" type="number" value={c.limit || 5} onChange={(e) => set('limit', Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title="Product Cards Styling">
        <InlineColor label="Card Background" value={c.cardBgColor || '#ffffff'} onChange={(val) => set('cardBgColor', val)} />
        <div style={{ margin: '0.5rem 0' }} />
        <InlineColor label="Card Text Colour" value={c.cardTextColor || '#000000'} onChange={(val) => set('cardTextColor', val)} />
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <Field label="Border Radius">
            <input className="form-input" type="number" value={c.cardRadius ?? 0} min="0" max="50" onChange={(e) => set('cardRadius', Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title="Call to Action">
        <Field label="CTA Text">
          <input className="form-input" value={c.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} />
        </Field>
        <Field label="CTA Link">
          <LinkPicker value={c.ctaLink || ''} onChange={(val) => set('ctaLink', val)} />
        </Field>
      </Card>
    </div>
  );
}

function ProductCarouselEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  useEffect(() => {
    api.fetchCollections().then(setCollections).catch(console.error);
  }, []);

  return (
    <div className="builder-panel-content">
      <Card title="Content">
        <Field label="Title">
          <input className="form-input" value={c.title || ''} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
          <BlockFontPicker label="Title Font" value={c.titleFont || ''} onChange={(v) => set('titleFont', v)} />
          <Field label="Size (px)">
            <input className="form-input" type="number" value={c.titleFontSize ?? 40} min="10" max="150" onChange={(e) => set('titleFontSize', Number(e.target.value))} />
          </Field>
        </div>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
          <Field label="Font Weight">
            <SearchableSelect className="form-input" value={c.titleFontWeight || '900'} onChange={(val) => set('titleFontWeight', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Regular (400)', value: '400' },
    { label: 'Medium (500)', value: '500' },
    { label: 'Semi-Bold (600)', value: '600' },
    { label: 'Bold (700)', value: '700' },
    { label: 'Extra-Bold (800)', value: '800' },
    { label: 'Black (900)', value: '900' }
  ]}
/>
          </Field>
          <Field label="">
            <div style={{ height: '1.25rem' }} />
            <InlineColor label="Title Colour" value={c.titleColor || '#000000'} onChange={(val) => set('titleColor', val)} />
          </Field>
        </div>

        <div style={{ marginTop: '1.5rem' }} />
        <Field label="Subtitle">
          <input className="form-input" value={c.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} />
        </Field>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
          <Field label="Size (px)">
            <input className="form-input" type="number" value={c.subtitleFontSize ?? 18} min="10" max="100" onChange={(e) => set('subtitleFontSize', Number(e.target.value))} />
          </Field>
          <Field label="">
            <div style={{ height: '1.25rem' }} />
            <InlineColor label="Subtitle Colour" value={c.subtitleColor || '#666666'} onChange={(val) => set('subtitleColor', val)} />
          </Field>
        </div>
      </Card>

      <Card title="Collection">
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <Field label="Select Collection">
            <select className="form-input" value={c.collectionId || ''} onChange={(e) => set('collectionId', e.target.value)}>
              <option value="">-- All Products (Fallback) --</option>
              {collections.map((col: any) => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Limit (Items shown)">
            <input className="form-input" type="number" value={c.limit || 10} onChange={(e) => set('limit', Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title="Product Cards Styling">
        <InlineColor label="Card Background" value={c.cardBgColor || '#ffffff'} onChange={(val) => set('cardBgColor', val)} />
        <div style={{ margin: '0.5rem 0' }} />
        <InlineColor label="Card Text Colour" value={c.cardTextColor || '#000000'} onChange={(val) => set('cardTextColor', val)} />
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <Field label="Border Radius">
            <input className="form-input" type="number" value={c.cardRadius ?? 16} min="0" max="50" onChange={(e) => set('cardRadius', Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title="Call to Action (Left Sidebar)">
        <Field label="CTA Text">
          <input className="form-input" value={c.ctaText || ''} onChange={(e) => set('ctaText', e.target.value)} />
        </Field>
        <Field label="CTA Link">
          <LinkPicker value={c.ctaLink || ''} onChange={(val) => set('ctaLink', val)} />
        </Field>
      </Card>
    </div>
  );
}

function ProductGridEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    api.fetchVisibleProducts().then(setProducts).catch(console.error);
  }, []);

  const toggleProduct = (productId: string) => {
    const current = c.productIds || [];
    if (current.includes(productId)) {
      set('productIds', current.filter((id: string) => id !== productId));
    } else {
      set('productIds', [...current, productId]);
    }
  };

  return (
    <div className="builder-panel-content">
      <Card title="Products">
        <Field label="Mode">
          <SearchableSelect className="form-input" value={c.mode || 'auto'} onChange={(val) => set('mode', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Auto — Show all visible products', value: 'auto' },
    { label: 'Manual — Choose specific products', value: 'manual' }
  ]}
/>
        </Field>
        {c.mode === 'manual' && (
          <div style={{ marginTop: '1rem' }}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Products</label>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.5rem' }}>
              {products.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={(c.productIds || []).includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  <span className="text-sm">{p.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>
      
      <Card title="Layout">
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Columns">
            <SearchableSelect className="form-input" value={c.columns || 4} onChange={(val) => set('columns', Number(val))}
  searchable={false}
  sort={false}
  options={[
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' }
  ]}
/>
          </Field>
          <Field label="Max Products">
            <input className="form-input" type="number" value={c.limit || 8} min="1" max="50"
              onChange={(e) => set('limit', Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title="Product Cards Styling">
        <InlineColor label="Card Background" value={c.cardBgColor || '#ffffff'} onChange={(val) => set('cardBgColor', val)} />
        <div style={{ margin: '0.5rem 0' }} />
        <InlineColor label="Card Text Colour" value={c.cardTextColor || '#000000'} onChange={(val) => set('cardTextColor', val)} />
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <Field label="Border Radius">
            <input className="form-input" type="number" value={c.cardRadius ?? 16} min="0" max="50" onChange={(e) => set('cardRadius', Number(e.target.value))} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

function CollectionGridEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [collections, setCollections] = useState<any[]>([]);
  useEffect(() => {
    api.fetchCollections().then(setCollections).catch(console.error);
  }, []);

  const toggleCollection = (collectionId: string) => {
    const current = c.collectionIds || [];
    if (current.includes(collectionId)) {
      set('collectionIds', current.filter((id: string) => id !== collectionId));
    } else {
      set('collectionIds', [...current, collectionId]);
    }
  };

  return (
    <div className="builder-panel-content">
      <Card title="Collections">
        <Field label="Mode">
          <SearchableSelect className="form-input" value={c.mode || 'auto'} onChange={(val) => set('mode', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Auto — Show all collections', value: 'auto' },
    { label: 'Manual — Choose specific collections', value: 'manual' }
  ]}
/>
        </Field>
        {c.mode === 'manual' && (
          <div style={{ marginTop: '1rem' }}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Collections</label>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.5rem' }}>
              {collections.map(col => (
                <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={(c.collectionIds || []).includes(col.id)}
                    onChange={() => toggleCollection(col.id)}
                  />
                  <span className="text-sm">{col.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>
      
      <Card title="Layout">
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
          <Field label="Columns">
            <SearchableSelect className="form-input" value={c.columns || 3} onChange={(val) => set('columns', Number(val))}
  searchable={false}
  sort={false}
  options={[
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' }
  ]}
/>
          </Field>
        </div>
      </Card>

      <Card title="Collection Cards Styling">
        <InlineColor label="Card Background" value={c.cardBgColor || '#ffffff'} onChange={(val) => set('cardBgColor', val)} />
        <div style={{ margin: '0.5rem 0' }} />
        <InlineColor label="Text Colour" value={c.cardTextColor || '#000000'} onChange={(val) => set('cardTextColor', val)} />
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <Field label="Border Radius">
            <input className="form-input" type="number" value={c.cardRadius ?? 16} min="0" max="50" onChange={(e) => set('cardRadius', Number(e.target.value))} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

function FeaturedProductEditor({ config: c, set }: { config: Record<string, any>; set: (key: string, value: any) => void }) {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    api.fetchVisibleProducts().then(setProducts).catch(console.error);
  }, []);

  return (
    <div className="builder-panel-content">
      <Card title="Product" desc="Select the product to explicitly feature on the page.">
        <Field label="Featured Product">
          <SearchableSelect
            className="form-input"
            value={c.productId || ''}
            onChange={(val) => set('productId', val)}
            searchable={true}
            options={[
              { label: 'Select a product...', value: '' },
              ...products.map((p: any) => ({ label: p.name, value: p.id }))
            ]}
          />
        </Field>
      </Card>
      
      <Card title="Featured Layout">
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Image Alignment">
            <SearchableSelect className="form-input" value={c.align || 'left'} onChange={(val) => set('align', val)}
  searchable={false}
  sort={false}
  options={[
    { label: 'Image on Left', value: 'left' },
    { label: 'Image on Right', value: 'right' }
  ]}
/>
          </Field>
          <Field label="Show Description">
            <SearchableSelect className="form-input" value={c.showDescription === false ? 'no' : 'yes'} onChange={(val) => set('showDescription', val === 'yes')}
  searchable={false}
  sort={false}
  options={[
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' }
  ]}
/>
          </Field>
        </div>
      </Card>

      <Card title="Card Styling">
        <InlineColor label="Card Background" value={c.cardBgColor || '#f9fafb'} onChange={(val) => set('cardBgColor', val)} />
        <div style={{ margin: '0.5rem 0' }} />
        <InlineColor label="Card Text Colour" value={c.cardTextColor || '#111827'} onChange={(val) => set('cardTextColor', val)} />
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <Field label="Border Radius">
            <input className="form-input" type="number" value={c.cardRadius ?? 24} min="0" max="50" onChange={(e) => set('cardRadius', Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title="Button Styling">
        <InlineColor label="Button Background" value={c.btnBgColor || 'var(--sf-primary)'} onChange={(val) => set('btnBgColor', val)} />
        <div style={{ margin: '0.5rem 0' }} />
        <InlineColor label="Button Text Colour" value={c.btnTextColor || '#ffffff'} onChange={(val) => set('btnTextColor', val)} />
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <Field label="Button Radius">
            <input className="form-input" type="number" value={c.btnRadius ?? 8} min="0" max="50" onChange={(e) => set('btnRadius', Number(e.target.value))} />
          </Field>
          <Field label="Button Text">
            <input className="form-input" value={c.btnText || 'View Product'} onChange={(e) => set('btnText', e.target.value)} />
          </Field>
        </div>
      </Card>
    </div>
  );
}
