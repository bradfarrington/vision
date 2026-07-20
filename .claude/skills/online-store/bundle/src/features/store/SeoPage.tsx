import { useState, useEffect } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { StoreTabBar } from './StoreTabBar';
import { useAlert } from '@/components/ui/AlertDialog';
import * as api from '@/lib/api';
import type { StoreConfig, StorePage, PageSeo } from '@/types/database';
import { Save, ChevronDown, Globe, FileText } from 'lucide-react';

export function SeoPage() {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [globalDraft, setGlobalDraft] = useState<Partial<StoreConfig>>({});
  const [storePages, setStorePages] = useState<StorePage[]>([]);
  const [pageDrafts, setPageDrafts] = useState<Record<string, Partial<PageSeo>>>({});

  // UI
  const [expandedSection, setExpandedSection] = useState<string>('global');

  useEffect(() => {
    Promise.all([
      api.fetchStoreConfig(),
      api.fetchStorePages(),
      api.fetchAllPageSeo()
    ])
      .then(([cfg, pages, seoRecords]) => {
        setGlobalDraft(cfg);
        setStorePages(pages);
        
        const initialPageDrafts: Record<string, Partial<PageSeo>> = {};
        pages.forEach((page) => {
          const existing = seoRecords.find(s => s.page_key === page.page_key);
          initialPageDrafts[page.page_key] = existing || { page_key: page.page_key };
        });
        setPageDrafts(initialPageDrafts);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateGlobalDraft = (updates: Partial<StoreConfig>) => {
    setGlobalDraft((prev) => ({ ...prev, ...updates }));
  };

  const updatePageDraft = (pageKey: string, updates: Partial<PageSeo>) => {
    setPageDrafts((prev) => ({
      ...prev,
      [pageKey]: { ...prev[pageKey], ...updates }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save global store config
      await api.updateStoreConfig(globalDraft as any);

      // 2. Upsert each page's SEO overrides
      const updatePromises = storePages.map((page) => {
        const draft = pageDrafts[page.page_key];
        // Only attempt to upsert if there actually is changes or we have something to save. 
        // We'll safely upsert all to be thorough and ensure existing records without data simply get nulls.
        return api.upsertPageSeo(page.page_key, {
          meta_title: draft.meta_title || null,
          meta_description: draft.meta_description || null,
          og_image_url: draft.og_image_url || null,
        });
      });

      await Promise.all(updatePromises);

      showAlert({ title: 'Saved', message: 'SEO settings saved successfully.', variant: 'success' });
    } catch (err) {
      console.error(err);
      showAlert({ title: 'Error', message: 'Failed to save SEO settings.', variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? '' : section));
  };

  if (loading) {
    return (
      <PageShell title="Online Store" subtitle="Manage your store's search engine optimization.">
        <StoreTabBar />
        <div className="store-loading">Loading SEO settings...</div>
      </PageShell>
    );
  }

  // Pre-compute rendering data
  const sections = [
    { key: 'global', title: 'Global SEO Defaults', icon: Globe, isGlobal: true },
    ...storePages.map((p) => ({ key: p.page_key, title: `${p.title} Page`, icon: FileText, isGlobal: false }))
  ];

  return (
    <PageShell title="Online Store" subtitle="Manage your store's search engine optimization.">
      <StoreTabBar />

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Search Engine Optimization
          </h2>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Configure how your store appears in Google search results and on social media.
          </p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleSave} 
          disabled={saving}
          style={{ padding: '0.625rem 1.25rem', gap: '0.5rem', fontWeight: 600 }}
        >
          <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '3rem' }}>
        {sections.map(({ key, title, icon: Icon, isGlobal }) => {
          const isExpanded = expandedSection === key;
          const draft = isGlobal ? globalDraft : pageDrafts[key];
          
          const metaTitle = isGlobal ? (draft as Partial<StoreConfig>).seo_title : (draft as Partial<PageSeo>).meta_title;
          const metaDesc = isGlobal ? (draft as Partial<StoreConfig>).seo_description : (draft as Partial<PageSeo>).meta_description;
          const metaImage = isGlobal ? (draft as Partial<StoreConfig>).seo_image_url : (draft as Partial<PageSeo>).og_image_url;

          const updateSectionDraft = (updates: any) => {
            if (isGlobal) {
              updateGlobalDraft(updates);
            } else {
              updatePageDraft(key, updates);
            }
          };

          const isDynamicPage = key === 'product_detail' || key === 'collection_detail';
          const dynamicSubtitle = key === 'product_detail' 
            ? 'Use merge tags like {{title}}, {{description}}, and {{price}} to dynamically insert product details.'
            : 'Use merge tags like {{title}} and {{description}} to dynamically insert collection details.';

          const subtitle = isGlobal 
            ? 'Default fallback meta tags for pages without specific SEO overrides.' 
            : `Set SEO metadata exclusively for the ${title}. ${isDynamicPage ? dynamicSubtitle : ''}`;

          // Replace merge tags for preview purposes
          const previewTitle = (metaTitle || (isGlobal ? 'Isobex Lasers' : 'Page Title'))
            .replace(/\{\{title\}\}/gi, isDynamicPage ? 'Sample Name' : '{{title}}')
            .replace(/\{\{price\}\}/gi, isDynamicPage ? '$99.00' : '{{price}}');
            
          const previewDesc = (metaDesc || 'No description set.')
            .replace(/\{\{title\}\}/gi, isDynamicPage ? 'Sample Name' : '{{title}}')
            .replace(/\{\{description\}\}/gi, isDynamicPage ? 'Sample item description goes here...' : '{{description}}')
            .replace(/\{\{price\}\}/gi, isDynamicPage ? '$99.00' : '{{price}}');

          const hasCustomSeo = !isGlobal && (metaTitle || metaDesc || metaImage);

          return (
            <div 
              key={key} 
              style={{
                background: 'var(--color-bg-raised)',
                borderRadius: 'var(--radius-lg)',
                border: isExpanded ? '1px solid var(--color-primary-subtle)' : '1px solid var(--color-border)',
                overflow: 'hidden',
                boxShadow: isExpanded ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                transition: 'all var(--transition-base)',
                transform: isExpanded ? 'translateY(-2px)' : 'translateY(0)'
              }}
            >
              <button
                onClick={() => toggleSection(key)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1.25rem 1.5rem',
                  background: isExpanded ? 'var(--color-primary-subtle)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background var(--transition-base)'
                }}
                onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '44px', 
                  height: '44px', 
                  borderRadius: 'var(--radius-md)', 
                  background: isExpanded ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                  color: isExpanded ? 'white' : 'var(--color-text-secondary)',
                  transition: 'all var(--transition-fast)'
                }}>
                  <Icon size={22} />
                </div>
                
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{title}</h3>
                  {hasCustomSeo && (
                    <span style={{ 
                      fontSize: '0.7rem', 
                      padding: '0.2rem 0.6rem', 
                      background: 'rgba(22, 163, 74, 0.1)', 
                      color: 'var(--color-success)', 
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 600,
                      border: '1px solid rgba(22, 163, 74, 0.2)'
                    }}>
                      Custom config
                    </span>
                  )}
                  {isGlobal && (
                    <span style={{ 
                      fontSize: '0.7rem', 
                      padding: '0.2rem 0.6rem', 
                      background: 'var(--color-primary-subtle)', 
                      color: 'var(--color-primary)', 
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 600,
                    }}>
                      Global Default
                    </span>
                  )}
                </div>
                
                <div style={{
                  color: isExpanded ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                  transition: 'transform var(--transition-base)',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                }}>
                  <ChevronDown size={24} />
                </div>
              </button>

              {isExpanded && (
                <div style={{ 
                  padding: '2rem 1.5rem', 
                  background: 'var(--color-bg-raised)',
                  borderTop: '1px solid var(--color-border)'
                }}>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', margin: '0 0 2rem 0', lineHeight: 1.5 }}>
                    {subtitle}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Meta Title</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}
                        value={metaTitle || ''}
                        onChange={(e) => updateSectionDraft(isGlobal ? { seo_title: e.target.value } : { meta_title: e.target.value })}
                        placeholder={isGlobal ? "Isobex Lasers — Premium Laser Equipment" : "Page Title"}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Meta Description</label>
                      <textarea
                        className="form-input form-textarea"
                        style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', resize: 'vertical' }}
                        rows={3}
                        value={metaDesc || ''}
                        onChange={(e) => updateSectionDraft(isGlobal ? { seo_description: e.target.value } : { meta_description: e.target.value })}
                        placeholder={isGlobal ? "Browse our range of precision laser equipment..." : "Description for this page..."}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Social Share Image URL</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}
                        value={metaImage || ''}
                        onChange={(e) => updateSectionDraft(isGlobal ? { seo_image_url: e.target.value } : { og_image_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  {/* Preview card */}
                  {(metaTitle || metaDesc) && (
                    <div style={{ 
                      marginTop: '2.5rem', 
                      background: '#ffffff',
                      borderRadius: '12px', 
                      border: '1px solid #dfe1e5',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      overflow: 'hidden',
                      maxWidth: '600px'
                    }}>
                      <div style={{ 
                        padding: '0.75rem 1.25rem', 
                        background: '#f8f9fa', 
                        borderBottom: '1px solid #dfe1e5',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <Globe size={14} color="#5f6368" />
                        <span style={{ fontSize: '0.75rem', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Google Search Preview</span>
                      </div>
                      <div style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%', background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <Globe size={16} color="#4d5156" />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.875rem', color: '#202124', lineHeight: 1.2, paddingBottom: '0.125rem' }}>{globalDraft.custom_domain || 'yourstore.com'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#4d5156', marginTop: '0.125rem', lineHeight: 1 }}>https://{globalDraft.custom_domain || 'yourstore.com'}{!isGlobal ? `/${key}` : ''}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '1.25rem', color: '#1a0dab', marginBottom: '0.25rem', fontWeight: 400, textDecoration: 'none', paddingTop: '0.5rem', lineHeight: 1.3 }}>
                          {previewTitle}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#4d5156', lineHeight: 1.58, wordWrap: 'break-word', marginTop: '0.25rem' }}>
                          {previewDesc}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
