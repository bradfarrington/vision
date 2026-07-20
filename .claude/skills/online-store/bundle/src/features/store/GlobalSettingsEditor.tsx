import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { StoreConfig } from '@/types/database';
import { Plus, Upload, ChevronDown, Search, Eye, EyeOff } from 'lucide-react';
import { ColorPicker } from '@/components/ui/ColorPicker';

const DEFAULT_LINKS = [
  { key: 'home', label: 'Home', url: '/shop' },
  { key: 'products', label: 'Products', url: '/shop/products' },
  { key: 'collections', label: 'Collections', url: '/shop/collections' },
  { key: 'gift_cards', label: 'Gift Cards', url: '/shop/gift-cards' },
];

export function getResolvedDefaultLinks(headerLayout: any) {
  const saved: any[] | undefined = headerLayout?.default_links;
  if (!saved || saved.length === 0) {
    return DEFAULT_LINKS.map(d => ({ ...d, hidden: false }));
  }
  return DEFAULT_LINKS.map(d => {
    const s = saved.find((x: any) => x.key === d.key);
    return s ? { ...d, ...s } : { ...d, hidden: false };
  });
}

interface Props {
  panel: string;
  draft: Partial<StoreConfig>;
  updateDraft: (updates: Partial<StoreConfig>) => void;
}

const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Outfit', 'Raleway', 'Nunito', 'Playfair Display', 'Oswald',
  'Source Sans 3', 'DM Sans', 'Space Grotesk', 'Manrope', 'Sora',
];

/* ── Font loader (deduplicates link tags) ── */
const _loadedFonts = new Set<string>();
function loadGoogleFont(name: string) {
  if (!name || _loadedFonts.has(name)) return;
  _loadedFonts.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

/* ── Font picker with live preview ── */
function StoreFontPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load the currently-selected font
  useEffect(() => { if (value) loadGoogleFont(value); }, [value]);

  // Focus search on open
  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 0); }, [open]);

  // Close on outside click
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
      <button
        type="button"
        className="form-input ub-font-picker-trigger"
        onClick={() => setOpen(!open)}
      >
        <span style={{ fontFamily: `'${value || 'Inter'}', sans-serif` }}>{value || 'Inter'}</span>
        <ChevronDown size={14} style={{ opacity: 0.45, flexShrink: 0 }} />
      </button>

      {open && (
        <div className="ub-font-dropdown">
          <div className="ub-font-search-wrap">
            <Search size={14} className="ub-font-search-icon" />
            <input
              ref={searchRef}
              className="form-input ub-font-search"
              placeholder="Search fonts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="ub-font-list">
            {filtered.map(f => (
              <button
                type="button"
                key={f}
                className={`ub-font-item${value === f ? ' active' : ''}`}
                onClick={() => { loadGoogleFont(f); onChange(f); setOpen(false); setSearch(''); }}
                onMouseEnter={() => loadGoogleFont(f)}
                style={{ fontFamily: `'${f}', sans-serif` }}
              >
                {f}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="ub-font-empty">No fonts match "{search}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function GlobalSettingsEditor({ panel, draft, updateDraft }: Props) {
  // ─── Header nav link helpers ───────────
  const headerLayout = (draft as any)?.header_layout || { logo_position: 'left', nav_links: [] };
  const navLinks: { label: string; url: string }[] = headerLayout.nav_links || [];

  const addNavLink = () => {
    const updated = [...navLinks, { label: '', url: '' }];
    updateDraft({ header_layout: { ...headerLayout, nav_links: updated } } as any);
  };
  const updateNavLink = (index: number, field: 'label' | 'url', value: string) => {
    const updated = navLinks.map((l, i) => (i === index ? { ...l, [field]: value } : l));
    updateDraft({ header_layout: { ...headerLayout, nav_links: updated } } as any);
  };
  const removeNavLink = (index: number) => {
    const updated = navLinks.filter((_, i) => i !== index);
    updateDraft({ header_layout: { ...headerLayout, nav_links: updated } } as any);
  };
  const moveNavLink = (index: number, dir: -1 | 1) => {
    if (index + dir < 0 || index + dir >= navLinks.length) return;
    const updated = [...navLinks];
    const temp = updated[index];
    updated[index] = updated[index + dir];
    updated[index + dir] = temp;
    updateDraft({ header_layout: { ...headerLayout, nav_links: updated } } as any);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split('.').pop();
      const fileName = `logos/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('store-assets').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(fileName);
      updateDraft({ logo_url: publicUrl });
    } catch (err) {
      console.error('Logo upload failed:', err);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split('.').pop();
      const fileName = `favicons/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('store-assets').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(fileName);
      updateDraft({ favicon_url: publicUrl });
    } catch (err) {
      console.error('Favicon upload failed:', err);
    }
  };

  // ─── Footer helpers ───────────────────
  const footerConfig = (draft as any)?.footer_config || { columns: [], social_links: [], copyright: '' };
  
  const addFooterColumn = () => {
    const updated = { ...footerConfig, columns: [...(footerConfig.columns || []), { title: '', links: [] }] };
    updateDraft({ footer_config: updated } as any);
  };
  const updateFooterColumn = (index: number, title: string) => {
    const updated = {
      ...footerConfig,
      columns: footerConfig.columns.map((c: any, i: number) => i === index ? { ...c, title } : c),
    };
    updateDraft({ footer_config: updated } as any);
  };
  const removeFooterColumn = (index: number) => {
    const updated = { ...footerConfig, columns: footerConfig.columns.filter((_: any, i: number) => i !== index) };
    updateDraft({ footer_config: updated } as any);
  };

  const addFooterLink = (colIndex: number) => {
    const cols = [...footerConfig.columns];
    cols[colIndex].links = [...(cols[colIndex].links || []), { label: '', url: '' }];
    updateDraft({ footer_config: { ...footerConfig, columns: cols } } as any);
  };
  const updateFooterLink = (colIndex: number, linkIndex: number, field: 'label' | 'url', value: string) => {
    const cols = [...footerConfig.columns];
    cols[colIndex].links = cols[colIndex].links.map((l: any, i: number) => i === linkIndex ? { ...l, [field]: value } : l);
    updateDraft({ footer_config: { ...footerConfig, columns: cols } } as any);
  };
  const removeFooterLink = (colIndex: number, linkIndex: number) => {
    const cols = [...footerConfig.columns];
    cols[colIndex].links = cols[colIndex].links.filter((_: any, i: number) => i !== linkIndex);
    updateDraft({ footer_config: { ...footerConfig, columns: cols } } as any);
  };

  const socialLinks: { platform: string; url: string }[] = footerConfig.social_links || [];
  const addSocialLink = () => {
    const updated = { ...footerConfig, social_links: [...socialLinks, { platform: '', url: '' }] };
    updateDraft({ footer_config: updated } as any);
  };
  const updateSocialLink = (index: number, field: 'platform' | 'url', value: string) => {
    const updated = {
      ...footerConfig,
      social_links: socialLinks.map((l, i) => i === index ? { ...l, [field]: value } : l),
    };
    updateDraft({ footer_config: updated } as any);
  };
  const removeSocialLink = (index: number) => {
    const updated = { ...footerConfig, social_links: socialLinks.filter((_, i) => i !== index) };
    updateDraft({ footer_config: updated } as any);
  };





  if (panel === 'brand') {
    return (
      <div className="builder-panel-content">
        {/* Card 1 — Store Identity */}
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Store Identity</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Store Name</label>
            <input type="text" className="form-input" value={draft.store_name || ''} onChange={(e) => updateDraft({ store_name: e.target.value })} />
          </div>
        </div>

        {/* Card 2 — Logo */}
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Logo</h3>
            <p className="ub-settings-card-desc">Shared with header — changes apply everywhere.</p>
          </div>
          <div className="form-group">
            <label className="ub-logo-upload-zone">
              {draft.logo_url ? (
                <>
                  <img src={draft.logo_url} alt="Logo" className="ub-logo-preview" />
                  <span className="ub-upload-replace">Click to replace logo</span>
                </>
              ) : (
                <>
                  <Upload size={24} color="var(--text-tertiary)" />
                  <span className="ub-upload-title">Drop your logo here, or browse</span>
                  <span className="ub-upload-hint">Supports PNG, JPG, or SVG</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
            </label>
            {draft.logo_url && (
               <button className="btn btn-ghost danger btn-sm" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }} onClick={() => updateDraft({ logo_url: null })}>Remove Logo</button>
            )}
          </div>
        </div>

        {/* Card 3 — Favicon */}
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Favicon</h3>
            <p className="ub-settings-card-desc">Appears in the browser tab on the live site.</p>
          </div>
          <div className="form-group">
            <label className="ub-logo-upload-zone">
              {draft.favicon_url ? (
                <>
                  <img src={draft.favicon_url} alt="Favicon" className="ub-favicon-preview" />
                  <span className="ub-upload-replace">Click to replace favicon</span>
                </>
              ) : (
                <>
                  <Upload size={24} color="var(--text-tertiary)" />
                  <span className="ub-upload-title">Upload a favicon</span>
                  <span className="ub-upload-hint">Recommended: 32×32 or 64×64 PNG / ICO</span>
                </>
              )}
              <input type="file" accept="image/png,image/x-icon,image/svg+xml,image/ico,.ico" onChange={handleFaviconUpload} style={{ display: 'none' }} />
            </label>
            {draft.favicon_url && (
              <>
                <button className="btn btn-ghost danger btn-sm" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }} onClick={() => updateDraft({ favicon_url: null })}>Remove Favicon</button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', wordBreak: 'break-all' }}>{draft.favicon_url}</p>
              </>
            )}
          </div>
        </div>

        {/* Card 4 — Currency */}
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Currency</h3>
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Symbol</label>
              <input type="text" className="form-input" value={draft.currency_symbol || '£'} onChange={(e) => updateDraft({ currency_symbol: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Code</label>
              <input type="text" className="form-input" value={draft.currency_code || 'GBP'} onChange={(e) => updateDraft({ currency_code: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Card 5 — Theme Colours */}
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Theme Colours</h3>
            <p className="ub-settings-card-desc">Set the colours used throughout your storefront.</p>
          </div>
          {[
            { key: 'color_primary', label: 'Primary' },
            { key: 'color_secondary', label: 'Secondary' },
            { key: 'color_accent', label: 'Accent' },
            { key: 'color_background', label: 'Background' },
            { key: 'color_surface', label: 'Surface' },
            { key: 'color_text', label: 'Text' },
            { key: 'color_text_secondary', label: 'Text Secondary' },
          ].map(({ key, label }) => (
            <div className="form-group" key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ margin: 0 }}>{label}</label>
              <ColorPicker value={(draft as any)[key] || '#000000'} onChange={(val) => updateDraft({ [key]: val } as any)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (panel === 'typography') {
    return (
      <div className="builder-panel-content">
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Global Typography</h3>
          </div>
          <StoreFontPicker label="Heading Font" value={draft.font_heading || 'Inter'} onChange={(v) => updateDraft({ font_heading: v })} />
          <StoreFontPicker label="Body Font" value={draft.font_body || 'Inter'} onChange={(v) => updateDraft({ font_body: v })} />
        </div>
      </div>
    );
  }

  if (panel === 'header') {
    return (
      <div className="builder-panel-content">
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Logo Settings</h3>
          </div>
          
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: 8 }}>Store Logo</label>
            <label className="ub-logo-upload-zone">
              {draft.logo_url ? (
                <>
                  <img src={draft.logo_url} alt="Logo" className="ub-logo-preview" />
                  <span className="ub-upload-replace">Click to replace logo</span>
                </>
              ) : (
                <>
                  <Upload size={24} color="var(--text-tertiary)" />
                  <span className="ub-upload-title">Drop your logo here, or browse</span>
                  <span className="ub-upload-hint">Supports PNG, JPG, or SVG</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
            </label>
            {draft.logo_url && (
               <button className="btn btn-ghost danger btn-sm" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }} onClick={() => updateDraft({ logo_url: null })}>Remove Logo</button>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Logo Position</label>
            <select className="form-input" value={headerLayout.logo_position} onChange={(e) => updateDraft({ header_layout: { ...headerLayout, logo_position: e.target.value } } as any)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
            </select>
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Desktop Width (px)</label>
              <input type="number" className="form-input" value={headerLayout.logo_width_desktop || 150} onChange={(e) => updateDraft({ header_layout: { ...headerLayout, logo_width_desktop: Number(e.target.value) } } as any)} />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Width (px)</label>
              <input type="number" className="form-input" value={headerLayout.logo_width_mobile || 120} onChange={(e) => updateDraft({ header_layout: { ...headerLayout, logo_width_mobile: Number(e.target.value) } } as any)} />
            </div>
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Header Styling</h3>
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group color-field">
              <label className="form-label">Background Color</label>
              <div className="color-input-wrap">
                <ColorPicker value={headerLayout.bg_color || '#ffffff'} onChange={(val) => updateDraft({ header_layout: { ...headerLayout, bg_color: val } } as any)} />
              </div>
            </div>
            <div className="form-group color-field">
              <label className="form-label">Navigation Color</label>
              <div className="color-input-wrap">
                <ColorPicker value={headerLayout.nav_color || '#000000'} onChange={(val) => updateDraft({ header_layout: { ...headerLayout, nav_color: val } } as any)} />
              </div>
            </div>
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Navigation Font</label>
              <select className="form-input" value={headerLayout.nav_font || 'inherit'} onChange={(e) => updateDraft({ header_layout: { ...headerLayout, nav_font: e.target.value } } as any)}>
                <option value="inherit">Use Theme Body Font</option>
                {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Font Weight</label>
              <select className="form-input" value={headerLayout.nav_weight || '500'} onChange={(e) => updateDraft({ header_layout: { ...headerLayout, nav_weight: e.target.value } } as any)}>
                <option value="400">Normal (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">Semi-Bold (600)</option>
                <option value="700">Bold (700)</option>
              </select>
            </div>
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Cart Icon Style</label>
              <select className="form-input" value={headerLayout.cart_icon_type || 'ShoppingCart'} onChange={(e) => updateDraft({ header_layout: { ...headerLayout, cart_icon_type: e.target.value } } as any)}>
                <option value="ShoppingCart">Cart</option>
                <option value="ShoppingBag">Bag</option>
                <option value="ShoppingBasket">Basket</option>
              </select>
            </div>
            <div className="form-group color-field">
              <label className="form-label">Cart Icon Color</label>
              <div className="color-input-wrap">
                <ColorPicker value={headerLayout.cart_icon_color || '#000000'} onChange={(val) => updateDraft({ header_layout: { ...headerLayout, cart_icon_color: val } } as any)} />
              </div>
            </div>
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Navigation Links</h3>
          </div>
          
          <div className="form-group">
            {/* Default Store Links (editable label + show/hide) */}
            {(() => {
              const defaultLinks = getResolvedDefaultLinks(headerLayout);
              const updateDefaultLink = (key: string, field: string, value: any) => {
                const updated = defaultLinks.map(d => d.key === key ? { ...d, [field]: value } : d);
                updateDraft({ header_layout: { ...headerLayout, default_links: updated } } as any);
              };
              return defaultLinks.map(dl => (
                <div key={dl.key} className="ub-settings-item-box" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', opacity: dl.hidden ? 0.5 : 1 }}>
                  <div style={{ flex: 1 }}>
                    <input type="text" className="form-input" value={dl.label} onChange={(e) => updateDefaultLink(dl.key, 'label', e.target.value)} style={{ width: '100%', marginBottom: '0.375rem' }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{dl.url}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateDefaultLink(dl.key, 'hidden', !dl.hidden)}
                    title={dl.hidden ? 'Show link' : 'Hide link'}
                    style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: dl.hidden ? '#9ca3af' : 'var(--text-secondary, #6b7280)' }}
                  >
                    {dl.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              ));
            })()}

            {/* Custom Editable Links */}
            {navLinks.map((link, i) => (
              <div key={i} className="ub-settings-item-box" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <input type="text" className="form-input" value={link.label} onChange={(e) => updateNavLink(i, 'label', e.target.value)} placeholder="Label" style={{ width: '100%', marginBottom: '0.5rem' }} />
                  <input type="text" className="form-input" value={link.url} onChange={(e) => updateNavLink(i, 'url', e.target.value)} placeholder="/shop/products" style={{ width: '100%' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn btn-ghost btn-icon-sm" onClick={() => moveNavLink(i, -1)} disabled={i === 0}>↑</button>
                    <button className="btn btn-ghost btn-icon-sm" onClick={() => moveNavLink(i, 1)} disabled={i === navLinks.length - 1}>↓</button>
                  </div>
                  <button className="btn btn-ghost btn-icon-sm danger" onClick={() => removeNavLink(i)} style={{ width: '100%', color: '#ef4444' }}>✕</button>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={addNavLink} style={{ marginTop: '0.5rem', width: '100%' }}><Plus size={14} style={{ marginRight: 6 }}/> Add Custom Link</button>
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Announcement Bar</h3>
          </div>
          
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={draft.announcement_bar_active ?? false} onChange={(e) => updateDraft({ announcement_bar_active: e.target.checked })} />
              <span>Enable Announcement Bar</span>
            </label>
          </div>

          {draft.announcement_bar_active && (
            <>
              <div className="form-group">
                <label className="form-label">Style Effect</label>
                <select className="form-input" value={headerLayout.announcement_type || 'static'} onChange={(e) => updateDraft({ header_layout: { ...headerLayout, announcement_type: e.target.value } } as any)}>
                  <option value="static">Static Centered Text</option>
                  <option value="ticker">Scrolling Ticker Banner</option>
                </select>
              </div>

              {headerLayout.announcement_type === 'ticker' ? (
                 <div className="form-group">
                    <label className="form-label" style={{ marginBottom: 8 }}>Ticker Messages</label>
                    {(headerLayout.ticker_messages || []).map((msg: string, i: number) => (
                      <div key={i} className="ub-settings-item-box" style={{ padding: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input className="form-input" style={{ flex: 1, minWidth: 0 }} value={msg} onChange={(e) => {
                             const msgs = [...(headerLayout.ticker_messages || [])];
                             msgs[i] = e.target.value;
                             updateDraft({ header_layout: { ...headerLayout, ticker_messages: msgs } } as any);
                          }} placeholder="Add message..." />
                          <div style={{ display: 'flex', flexShrink: 0 }}>
                             <button className="btn btn-ghost btn-icon-sm danger" onClick={() => {
                                const msgs = [...(headerLayout.ticker_messages || [])];
                                msgs.splice(i, 1);
                                updateDraft({ header_layout: { ...headerLayout, ticker_messages: msgs } } as any);
                             }} title="Remove message">✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                       const msgs = [...(headerLayout.ticker_messages || []), ''];
                       updateDraft({ header_layout: { ...headerLayout, ticker_messages: msgs } } as any);
                    }} style={{ width: '100%' }}><Plus size={14} style={{ marginRight: 6 }}/> Add Message</button>
                    
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.25rem' }}>
                      <div className="form-group">
                         <label className="form-label" title="Seconds for one full scroll. Higher = Slower">Speed (Seconds)</label>
                         <input type="number" className="form-input" min={5} step={1} value={headerLayout.ticker_speed_seconds || 15} onChange={(e) => updateDraft({ header_layout: { ...headerLayout, ticker_speed_seconds: Math.max(1, Number(e.target.value)) } } as any)} />
                      </div>
                      <div className="form-group">
                         <label className="form-label" title="Space between repeating messages">Spacing (px)</label>
                         <input type="number" className="form-input" min={0} step={10} value={headerLayout.ticker_spacing_px || 40} onChange={(e) => updateDraft({ header_layout: { ...headerLayout, ticker_spacing_px: Math.max(0, Number(e.target.value)) } } as any)} />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                         <label className="form-label" title="How many times the message loop is copied to fill wide screens">Repeats (Density)</label>
                         <input type="number" className="form-input" min={2} max={10} step={1} value={headerLayout.ticker_repeats || 4} onChange={(e) => updateDraft({ header_layout: { ...headerLayout, ticker_repeats: Math.max(2, Math.min(10, Number(e.target.value))) } } as any)} />
                      </div>
                    </div>
                 </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Message Text</label>
                  <input type="text" className="form-input" value={draft.announcement_bar_text || ''} onChange={(e) => updateDraft({ announcement_bar_text: e.target.value })} placeholder="Free shipping on orders over $50" />
                </div>
              )}

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group color-field">
                  <label className="form-label">Background Color</label>
                  <div className="color-input-wrap">
                    <ColorPicker value={headerLayout.announcement_bg_color || '#111827'} onChange={(val) => updateDraft({ header_layout: { ...headerLayout, announcement_bg_color: val } } as any)} />
                  </div>
                </div>
                <div className="form-group color-field">
                  <label className="form-label">Text Color</label>
                  <div className="color-input-wrap">
                    <ColorPicker value={headerLayout.announcement_text_color || '#ffffff'} onChange={(val) => updateDraft({ header_layout: { ...headerLayout, announcement_text_color: val } } as any)} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (panel === 'footer') {
    return (
      <div className="builder-panel-content">
        {/* Card — Footer Styling */}
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Footer Styling</h3>
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group color-field">
              <label className="form-label">Background Colour</label>
              <div className="color-input-wrap">
                <ColorPicker value={footerConfig.bg_color || '#111827'} onChange={(val) => updateDraft({ footer_config: { ...footerConfig, bg_color: val } } as any)} />
              </div>
            </div>
            <div className="form-group color-field">
              <label className="form-label">Text Colour</label>
              <div className="color-input-wrap">
                <ColorPicker value={footerConfig.text_color || '#d1d5db'} onChange={(val) => updateDraft({ footer_config: { ...footerConfig, text_color: val } } as any)} />
              </div>
            </div>
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group color-field">
              <label className="form-label">Heading Colour</label>
              <div className="color-input-wrap">
                <ColorPicker value={footerConfig.heading_color || '#ffffff'} onChange={(val) => updateDraft({ footer_config: { ...footerConfig, heading_color: val } } as any)} />
              </div>
            </div>
            <div className="form-group color-field">
              <label className="form-label">Link Colour</label>
              <div className="color-input-wrap">
                <ColorPicker value={footerConfig.link_color || '#9ca3af'} onChange={(val) => updateDraft({ footer_config: { ...footerConfig, link_color: val } } as any)} />
              </div>
            </div>
          </div>

          <StoreFontPicker label="Footer Font" value={footerConfig.font || ''} onChange={(v) => updateDraft({ footer_config: { ...footerConfig, font: v } } as any)} />
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Footer Configuration</h3>
          </div>
          
          <div className="form-group">
            <label className="form-label">Copyright Text</label>
            <input type="text" className="form-input" value={footerConfig.copyright || ''} onChange={(e) => updateDraft({ footer_config: { ...footerConfig, copyright: e.target.value } } as any)} placeholder="© 2026 Isobex Lasers." />
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label" style={{ marginBottom: 8 }}>Link Columns</label>
            {(footerConfig.columns || []).map((col: any, ci: number) => (
              <div key={ci} className="ub-settings-item-box">
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input type="text" className="form-input" value={col.title} onChange={(e) => updateFooterColumn(ci, e.target.value)} placeholder="Column title" style={{ flex: 1 }} />
                  <button className="btn btn-ghost btn-icon-sm danger" onClick={() => removeFooterColumn(ci)} style={{ color: '#ef4444' }}>✕</button>
                </div>
                {(col.links || []).map((link: any, li: number) => (
                  <div key={li} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <input type="text" className="form-input" value={link.label} onChange={(e) => updateFooterLink(ci, li, 'label', e.target.value)} placeholder="Label" style={{ width: '40%' }} />
                    <input type="text" className="form-input" value={link.url} onChange={(e) => updateFooterLink(ci, li, 'url', e.target.value)} placeholder="URL" style={{ flex: 1 }} />
                    <div style={{ display: 'flex', flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-icon-sm danger" onClick={() => removeFooterLink(ci, li)} style={{ color: '#ef4444' }}>✕</button>
                    </div>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={() => addFooterLink(ci)} style={{ marginTop: '0.5rem' }}><Plus size={14} style={{ marginRight: 6 }}/> Add Link</button>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '0.5rem' }} onClick={addFooterColumn}><Plus size={14} style={{ marginRight: 6 }}/> Add Column</button>
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Social Media Links</h3>
          </div>
          <div className="form-group">
            {socialLinks.map((link, i) => (
              <div key={i} className="ub-settings-item-box" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', padding: '0.75rem' }}>
                <select className="form-input" style={{ width: '35%' }} value={link.platform} onChange={(e) => updateSocialLink(i, 'platform', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="twitter">X / Twitter</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="youtube">YouTube</option>
                  <option value="tiktok">TikTok</option>
                </select>
                <input type="text" className="form-input" style={{ flex: 1, minWidth: 0 }} value={link.url} onChange={(e) => updateSocialLink(i, 'url', e.target.value)} placeholder="https://..." />
                <div style={{ display: 'flex', flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-icon-sm danger" onClick={() => removeSocialLink(i)}>✕</button>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '0.5rem' }} onClick={addSocialLink}><Plus size={14} style={{ marginRight: 6 }}/> Add Social Link</button>
          </div>
        </div>
      </div>
    );
  }
  if (panel === 'products_template') {
    const pt = (draft as any)?.page_templates?.products || {};
    const updatePT = (updates: Record<string, any>) => {
      updateDraft({ page_templates: { ...((draft as any)?.page_templates || {}), products: { ...pt, ...updates } } } as any);
    };
    return (
      <div className="builder-panel-content">
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Page Header</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Page Title</label>
            <input type="text" className="form-input" value={pt.pageTitle ?? ''} placeholder="All Products" onChange={(e) => updatePT({ pageTitle: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Subtitle</label>
            <input type="text" className="form-input" value={pt.pageSubtitle ?? ''} placeholder="Browse our complete range of products" onChange={(e) => updatePT({ pageSubtitle: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Alignment</label>
            <div className="ub-radio-group" style={{ display: 'flex', gap: '1rem' }}>
              <label><input type="radio" name="pt_align" checked={pt.titleAlign === 'left'} onChange={() => updatePT({ titleAlign: 'left' })} /> Left</label>
              <label><input type="radio" name="pt_align" checked={pt.titleAlign === 'center'} onChange={() => updatePT({ titleAlign: 'center' })} /> Centre</label>
              <label><input type="radio" name="pt_align" checked={pt.titleAlign === 'right'} onChange={() => updatePT({ titleAlign: 'right' })} /> Right</label>
            </div>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Title Colour</label>
            <ColorPicker value={pt.titleColor || '#111827'} onChange={(val) => updatePT({ titleColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Title Size</label>
            <select className="form-input" value={pt.titleSize || 'large'} onChange={(e) => updatePT({ titleSize: e.target.value })}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra Large</option>
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Subtitle Colour</label>
            <ColorPicker value={pt.subtitleColor || '#4b5563'} onChange={(val) => updatePT({ subtitleColor: val })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Product Grid</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Columns</label>
            <select className="form-input" value={pt.columns || 3} onChange={(e) => updatePT({ columns: Number(e.target.value) })}>
              <option value={2}>2 Columns</option>
              <option value={3}>3 Columns</option>
              <option value={4}>4 Columns</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Image Aspect Ratio</label>
            <select className="form-input" value={pt.imageAspect || 'square'} onChange={(e) => updatePT({ imageAspect: e.target.value })}>
              <option value="square">Square (1:1)</option>
              <option value="portrait">Portrait (3:4)</option>
              <option value="landscape">Landscape (4:3)</option>
            </select>
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Card Styling</h3>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Card Background</label>
            <ColorPicker value={pt.cardBgColor || '#000000'} onChange={(val) => updatePT({ cardBgColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Card Text Colour</label>
            <ColorPicker value={pt.cardTextColor || '#ffffff'} onChange={(val) => updatePT({ cardTextColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Card Border Radius (px)</label>
            <input type="number" className="form-input" value={pt.cardRadius ?? 16} min={0} max={50} onChange={(e) => updatePT({ cardRadius: Number(e.target.value) })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Display Options</h3>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Price Colour</label>
            <ColorPicker value={pt.priceColor || '#dc2626'} onChange={(val) => updatePT({ priceColor: val })} />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={pt.showPrice !== false} onChange={(e) => updatePT({ showPrice: e.target.checked })} />
              <span>Show Price</span>
            </label>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={pt.showComparePrice !== false} onChange={(e) => updatePT({ showComparePrice: e.target.checked })} />
              <span>Show Compare-at Price</span>
            </label>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={pt.showSortBar !== false} onChange={(e) => updatePT({ showSortBar: e.target.checked })} />
              <span>Show Sort Bar</span>
            </label>
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Sidebar & Filters</h3>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={pt.showSidebar || false} onChange={(e) => updatePT({ showSidebar: e.target.checked })} />
              <span>Show Sidebar</span>
            </label>
          </div>
          {pt.showSidebar && (
            <>
              <div className="form-group">
                <label className="form-label">Sidebar Position</label>
                <select className="form-input" value={pt.sidebarPosition || 'left'} onChange={(e) => updatePT({ sidebarPosition: e.target.value })}>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
                  <input type="checkbox" checked={pt.enableCategoryFilter || false} onChange={(e) => updatePT({ enableCategoryFilter: e.target.checked })} />
                  <span>Enable Category Filter</span>
                </label>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
                  <input type="checkbox" checked={pt.enableCompatibilityFilter || false} onChange={(e) => updatePT({ enableCompatibilityFilter: e.target.checked })} />
                  <span>Enable "Compatible With" Filter</span>
                </label>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (panel === 'collections_template') {
    const ct = (draft as any)?.page_templates?.collections || {};
    const updateCT = (updates: Record<string, any>) => {
      updateDraft({ page_templates: { ...((draft as any)?.page_templates || {}), collections: { ...ct, ...updates } } } as any);
    };
    return (
      <div className="builder-panel-content">
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Page Header</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Page Title</label>
            <input type="text" className="form-input" value={ct.pageTitle ?? ''} placeholder="Collections" onChange={(e) => updateCT({ pageTitle: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Subtitle</label>
            <input type="text" className="form-input" value={ct.pageSubtitle ?? ''} placeholder="Browse our curated collections" onChange={(e) => updateCT({ pageSubtitle: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Alignment</label>
            <div className="ub-radio-group" style={{ display: 'flex', gap: '1rem' }}>
              <label><input type="radio" name="ct_align" checked={ct.titleAlign === 'left'} onChange={() => updateCT({ titleAlign: 'left' })} /> Left</label>
              <label><input type="radio" name="ct_align" checked={ct.titleAlign === 'center'} onChange={() => updateCT({ titleAlign: 'center' })} /> Centre</label>
              <label><input type="radio" name="ct_align" checked={ct.titleAlign === 'right'} onChange={() => updateCT({ titleAlign: 'right' })} /> Right</label>
            </div>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Title Colour</label>
            <ColorPicker value={ct.titleColor || '#111827'} onChange={(val) => updateCT({ titleColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Title Size</label>
            <select className="form-input" value={ct.titleSize || 'large'} onChange={(e) => updateCT({ titleSize: e.target.value })}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra Large</option>
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Subtitle Colour</label>
            <ColorPicker value={ct.subtitleColor || '#4b5563'} onChange={(val) => updateCT({ subtitleColor: val })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Grid Layout</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Columns</label>
            <select className="form-input" value={ct.columns || 3} onChange={(e) => updateCT({ columns: Number(e.target.value) })}>
              <option value={2}>2 Columns</option>
              <option value={3}>3 Columns</option>
              <option value={4}>4 Columns</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Card Border Radius (px)</label>
            <input type="number" className="form-input" value={ct.cardRadius ?? 16} min={0} max={50} onChange={(e) => updateCT({ cardRadius: Number(e.target.value) })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Overlay Styling</h3>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Overlay Background</label>
            <ColorPicker value={ct.overlayBgColor || '#000000'} onChange={(val) => updateCT({ overlayBgColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Overlay Text Colour</label>
            <ColorPicker value={ct.overlayTextColor || '#ffffff'} onChange={(val) => updateCT({ overlayTextColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Overlay Opacity</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="range" min={0} max={1} step={0.05} value={ct.overlayOpacity ?? 0.7} onChange={(e) => updateCT({ overlayOpacity: Number(e.target.value) })} style={{ flex: 1 }} />
              <span className="pb-range-val">{((ct.overlayOpacity ?? 0.7) * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={ct.showProductCount !== false} onChange={(e) => updateCT({ showProductCount: e.target.checked })} />
              <span>Show Product Count</span>
            </label>
          </div>
        </div>
      </div>
    );
  }

  if (panel === 'product_detail_template') {
    const pd = (draft as any)?.page_templates?.product_detail || {};
    const updatePD = (updates: Record<string, any>) => {
      updateDraft({ page_templates: { ...((draft as any)?.page_templates || {}), product_detail: { ...pd, ...updates } } } as any);
    };
    return (
      <div className="builder-panel-content">
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Typography & Layout</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Image Position</label>
            <select className="form-input" value={pd.imagePosition || 'left'} onChange={(e) => updatePD({ imagePosition: e.target.value })}>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Title Font Size (px)</label>
            <input type="number" className="form-input" value={pd.titleFontSize || 32} min={16} max={72} onChange={(e) => updatePD({ titleFontSize: Number(e.target.value) })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Title Colour</label>
            <ColorPicker value={pd.titleColor || '#111827'} onChange={(val) => updatePD({ titleColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Price Colour</label>
            <ColorPicker value={pd.priceColor || '#dc2626'} onChange={(val) => updatePD({ priceColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Description Font Size (px)</label>
            <input type="number" className="form-input" value={pd.descriptionFontSize || 16} min={12} max={32} onChange={(e) => updatePD({ descriptionFontSize: Number(e.target.value) })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Description Colour</label>
            <ColorPicker value={pd.descriptionColor || '#4b5563'} onChange={(val) => updatePD({ descriptionColor: val })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Inputs & Selectors</h3>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Label Text Colour</label>
            <ColorPicker value={pd.inputLabelColor || '#111827'} onChange={(val) => updatePD({ inputLabelColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Input Background</label>
            <ColorPicker value={pd.inputBgColor || '#ffffff'} onChange={(val) => updatePD({ inputBgColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Input Text Colour</label>
            <ColorPicker value={pd.inputTextColor || '#111827'} onChange={(val) => updatePD({ inputTextColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Input Border Colour</label>
            <ColorPicker value={pd.inputBorderColor || '#e5e7eb'} onChange={(val) => updatePD({ inputBorderColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Input Border Radius (px)</label>
            <input type="number" className="form-input" value={pd.inputRadius ?? 8} min={0} max={24} onChange={(e) => updatePD({ inputRadius: Number(e.target.value) })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Add to Cart Button</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Button Text</label>
            <input type="text" className="form-input" value={pd.buttonText || 'Add to Cart'} onChange={(e) => updatePD({ buttonText: e.target.value })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Button Background</label>
            <ColorPicker value={pd.buttonBgColor || '#dc2626'} onChange={(val) => updatePD({ buttonBgColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Button Text Colour</label>
            <ColorPicker value={pd.buttonTextColor || '#ffffff'} onChange={(val) => updatePD({ buttonTextColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Button Border Radius (px)</label>
            <input type="number" className="form-input" value={pd.buttonRadius ?? 12} min={0} max={50} onChange={(e) => updatePD({ buttonRadius: Number(e.target.value) })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Visibility</h3>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={pd.showDescription !== false} onChange={(e) => updatePD({ showDescription: e.target.checked })} />
              <span>Show Description</span>
            </label>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={pd.showSku !== false} onChange={(e) => updatePD({ showSku: e.target.checked })} />
              <span>Show SKU</span>
            </label>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={pd.showCompatibility !== false} onChange={(e) => updatePD({ showCompatibility: e.target.checked })} />
              <span>Show Compatibility Tags</span>
            </label>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={pd.showRelatedProducts !== false} onChange={(e) => updatePD({ showRelatedProducts: e.target.checked })} />
              <span>Show Related Products</span>
            </label>
          </div>
          {pd.showRelatedProducts !== false && (
            <div className="form-group">
              <label className="form-label">Related Products Title</label>
              <input type="text" className="form-input" value={pd.relatedProductsTitle || 'You may also like'} onChange={(e) => updatePD({ relatedProductsTitle: e.target.value })} />
            </div>
          )}
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={pd.showReviews !== false} onChange={(e) => updatePD({ showReviews: e.target.checked })} />
              <span>Show Customer Reviews</span>
            </label>
          </div>
        </div>
      </div>
    );
  }

  if (panel === 'collection_detail_template') {
    const cd = (draft as any)?.page_templates?.collection_detail || {};
    const updateCD = (updates: Record<string, any>) => {
      updateDraft({ page_templates: { ...((draft as any)?.page_templates || {}), collection_detail: { ...cd, ...updates } } } as any);
    };
    return (
      <div className="builder-panel-content">
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Product Grid</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Columns</label>
            <select className="form-input" value={cd.columns || 3} onChange={(e) => updateCD({ columns: Number(e.target.value) })}>
              <option value={2}>2 Columns</option>
              <option value={3}>3 Columns</option>
              <option value={4}>4 Columns</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Image Aspect Ratio</label>
            <select className="form-input" value={cd.imageAspect || 'square'} onChange={(e) => updateCD({ imageAspect: e.target.value })}>
              <option value="square">Square (1:1)</option>
              <option value="portrait">Portrait (3:4)</option>
              <option value="landscape">Landscape (4:3)</option>
            </select>
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Card Styling</h3>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Card Background</label>
            <ColorPicker value={cd.cardBgColor || '#000000'} onChange={(val) => updateCD({ cardBgColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Card Text Colour</label>
            <ColorPicker value={cd.cardTextColor || '#ffffff'} onChange={(val) => updateCD({ cardTextColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Card Border Radius (px)</label>
            <input type="number" className="form-input" value={cd.cardRadius ?? 16} min={0} max={50} onChange={(e) => updateCD({ cardRadius: Number(e.target.value) })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Price Colour</label>
            <ColorPicker value={cd.priceColor || '#dc2626'} onChange={(val) => updateCD({ priceColor: val })} />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={cd.showPrice !== false} onChange={(e) => updateCD({ showPrice: e.target.checked })} />
              <span>Show Price</span>
            </label>
          </div>
        </div>
      </div>
    );
  }
  if (panel === 'checkout_template') {
    const co = (draft as any)?.page_templates?.checkout || {};
    const updateCO = (updates: Record<string, any>) => {
      updateDraft({ page_templates: { ...((draft as any)?.page_templates || {}), checkout: { ...co, ...updates } } } as any);
    };
    return (
      <div className="builder-panel-content">
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Section Styling</h3>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Section Background</label>
            <ColorPicker value={co.sectionBgColor || '#1a1a2e'} onChange={(val) => updateCO({ sectionBgColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Section Text Colour</label>
            <ColorPicker value={co.sectionTextColor || '#ffffff'} onChange={(val) => updateCO({ sectionTextColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Heading Colour</label>
            <ColorPicker value={co.headingColor || '#e0a060'} onChange={(val) => updateCO({ headingColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Section Border Radius (px)</label>
            <input type="number" className="form-input" value={co.sectionRadius ?? 16} min={0} max={50} onChange={(e) => updateCO({ sectionRadius: Number(e.target.value) })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Form Inputs</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Input Border Radius (px)</label>
            <input type="number" className="form-input" value={co.inputRadius ?? 8} min={0} max={30} onChange={(e) => updateCO({ inputRadius: Number(e.target.value) })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Input Border Colour</label>
            <ColorPicker value={co.inputBorderColor || '#333333'} onChange={(val) => updateCO({ inputBorderColor: val })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Place Order Button</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Button Text</label>
            <input type="text" className="form-input" value={co.buttonText || 'Place Order'} onChange={(e) => updateCO({ buttonText: e.target.value })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Button Background</label>
            <ColorPicker value={co.buttonBgColor || '#dc2626'} onChange={(val) => updateCO({ buttonBgColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Button Text Colour</label>
            <ColorPicker value={co.buttonTextColor || '#ffffff'} onChange={(val) => updateCO({ buttonTextColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Button Border Radius (px)</label>
            <input type="number" className="form-input" value={co.buttonRadius ?? 12} min={0} max={50} onChange={(e) => updateCO({ buttonRadius: Number(e.target.value) })} />
          </div>
        </div>
      </div>
    );
  }

  if (panel === 'cart_sidebar_template') {
    const cs = (draft as any)?.page_templates?.cart_sidebar || {};
    const updateCS = (updates: Record<string, any>) => {
      updateDraft({ page_templates: { ...((draft as any)?.page_templates || {}), cart_sidebar: { ...cs, ...updates } } } as any);
    };
    return (
      <div className="builder-panel-content">
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Header</h3>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Header Background</label>
            <ColorPicker value={cs.headerBgColor || '#ffffff'} onChange={(val) => updateCS({ headerBgColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Header Text Colour</label>
            <ColorPicker value={cs.headerTextColor || '#111827'} onChange={(val) => updateCS({ headerTextColor: val })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Body</h3>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Body Background</label>
            <ColorPicker value={cs.bodyBgColor || '#ffffff'} onChange={(val) => updateCS({ bodyBgColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Empty Cart Text</label>
            <input type="text" className="form-input" value={cs.emptyText || 'Your cart is empty'} onChange={(e) => updateCS({ emptyText: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Empty Cart Button Text</label>
            <input type="text" className="form-input" value={cs.emptyButtonText || 'Start Shopping'} onChange={(e) => updateCS({ emptyButtonText: e.target.value })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Checkout Button</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Button Text</label>
            <input type="text" className="form-input" value={cs.checkoutButtonText || 'Proceed to Checkout'} onChange={(e) => updateCS({ checkoutButtonText: e.target.value })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Button Background</label>
            <ColorPicker value={cs.checkoutButtonBgColor || '#111827'} onChange={(val) => updateCS({ checkoutButtonBgColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Button Text Colour</label>
            <ColorPicker value={cs.checkoutButtonTextColor || '#ffffff'} onChange={(val) => updateCS({ checkoutButtonTextColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Button Border Radius (px)</label>
            <input type="number" className="form-input" value={cs.checkoutButtonRadius ?? 8} min={0} max={50} onChange={(e) => updateCS({ checkoutButtonRadius: Number(e.target.value) })} />
          </div>
        </div>
      </div>
    );
  }
  if (panel === 'mobile') {
    const ms = (draft as any)?.mobile_settings || {};
    const updateMS = (updates: Record<string, any>) => {
      updateDraft({ mobile_settings: { ...ms, ...updates } } as any);
    };
    return (
      <div className="builder-panel-content">
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Mobile Product Grid</h3>
            <p className="ub-settings-card-desc">How product grids display on mobile devices.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Columns on Mobile (≤768px)</label>
            <select className="form-input" value={ms.mobileProductColumns || 2} onChange={(e) => updateMS({ mobileProductColumns: Number(e.target.value) })}>
              <option value={1}>1 Column</option>
              <option value={2}>2 Columns</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Columns on Phone (≤520px)</label>
            <select className="form-input" value={ms.phoneProductColumns || 1} onChange={(e) => updateMS({ phoneProductColumns: Number(e.target.value) })}>
              <option value={1}>1 Column</option>
              <option value={2}>2 Columns</option>
            </select>
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Mobile Collection Grid</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Columns on Mobile (≤768px)</label>
            <select className="form-input" value={ms.mobileCollectionColumns || 2} onChange={(e) => updateMS({ mobileCollectionColumns: Number(e.target.value) })}>
              <option value={1}>1 Column</option>
              <option value={2}>2 Columns</option>
            </select>
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Mobile Typography</h3>
            <p className="ub-settings-card-desc">Scale down text sizes on smaller screens.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Hero Title Size (Mobile)</label>
            <select className="form-input" value={ms.heroTitleSize || 'auto'} onChange={(e) => updateMS({ heroTitleSize: e.target.value })}>
              <option value="auto">Auto Scale</option>
              <option value="xl">Extra Large (2.5rem)</option>
              <option value="lg">Large (2rem)</option>
              <option value="md">Medium (1.75rem)</option>
              <option value="sm">Small (1.5rem)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Page Title Size (Mobile)</label>
            <select className="form-input" value={ms.pageTitleSize || 'auto'} onChange={(e) => updateMS({ pageTitleSize: e.target.value })}>
              <option value="auto">Auto Scale</option>
              <option value="xl">Extra Large (2.5rem)</option>
              <option value="lg">Large (2rem)</option>
              <option value="md">Medium (1.75rem)</option>
              <option value="sm">Small (1.5rem)</option>
            </select>
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Mobile Spacing</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Content Side Padding</label>
            <select className="form-input" value={ms.mobilePadding || 'normal'} onChange={(e) => updateMS({ mobilePadding: e.target.value })}>
              <option value="compact">Compact (0.75rem)</option>
              <option value="normal">Normal (1rem)</option>
              <option value="spacious">Spacious (1.5rem)</option>
            </select>
          </div>
        </div>
      </div>
    );
  }


  if (panel === 'gift_cards_template') {
    const gc = (draft as any)?.page_templates?.gift_cards || {};
    const updateGC = (updates: Record<string, any>) => {
      updateDraft({ page_templates: { ...((draft as any)?.page_templates || {}), gift_cards: { ...gc, ...updates } } } as any);
    };
    return (
      <div className="builder-panel-content">
        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Page Header</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Page Title</label>
            <input type="text" className="form-input" value={gc.pageTitle ?? ''} placeholder="Gift Cards" onChange={(e) => updateGC({ pageTitle: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Subtitle</label>
            <input type="text" className="form-input" value={gc.pageSubtitle ?? ''} placeholder="Give the perfect gift — let them choose what they love." onChange={(e) => updateGC({ pageSubtitle: e.target.value })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Preset Amounts</h3>
            <p className="ub-settings-card-desc">Comma-separated list of amounts shown as quick-select buttons.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Amounts</label>
            <input type="text" className="form-input" value={gc.presetAmounts ?? '25,50,75,100,150,200'} placeholder="25,50,75,100,150,200" onChange={(e) => updateGC({ presetAmounts: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Minimum Amount</label>
            <input type="number" className="form-input" value={gc.minimumAmount ?? 5} min={1} onChange={(e) => updateGC({ minimumAmount: Number(e.target.value) })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Purchase Button</h3>
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Button Colour</label>
            <ColorPicker value={gc.buttonColor || draft.color_primary || '#dc2626'} onChange={(val) => updateGC({ buttonColor: val })} />
          </div>
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Button Text Colour</label>
            <ColorPicker value={gc.buttonTextColor || '#ffffff'} onChange={(val) => updateGC({ buttonTextColor: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Button Border Radius (px)</label>
            <input type="number" className="form-input" value={gc.buttonRadius ?? 8} min={0} max={50} onChange={(e) => updateGC({ buttonRadius: Number(e.target.value) })} />
          </div>
        </div>

        <div className="ub-settings-card">
          <div className="ub-settings-card-header">
            <h3 className="ub-settings-card-title">Display Options</h3>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={gc.showDesignPicker !== false} onChange={(e) => updateGC({ showDesignPicker: e.target.checked })} />
              <span>Show Design Picker</span>
            </label>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={gc.showPreview !== false} onChange={(e) => updateGC({ showPreview: e.target.checked })} />
              <span>Show Live Preview</span>
            </label>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={gc.showCustomAmount !== false} onChange={(e) => updateGC({ showCustomAmount: e.target.checked })} />
              <span>Show Custom Amount Input</span>
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">Gift Card Validity</label>
            <select className="form-input" value={gc.validityMonths || 12} onChange={(e) => updateGC({ validityMonths: Number(e.target.value) })}>
              <option value={6}>6 Months</option>
              <option value={12}>12 Months</option>
              <option value={24}>24 Months</option>
              <option value={36}>36 Months</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  // Not implemented or unknown panel falls back to this message
  return <p className="form-hint" style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Settings form for {panel} goes here.</p>;
}
