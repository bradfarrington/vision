import { useState, useRef, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import { Image as ImageIcon, Tag, Monitor, Smartphone, EyeOff, Settings, Code, Play } from 'lucide-react';
import DOMPurify from 'dompurify';
import { BRAND, MERGE_TAGS, SOCIAL_PLATFORMS, cleanHtml, replaceMergeTags, loadGoogleFont, tagLabel } from './constants';
import type { BlockData } from './constants';
import { ColorField, FontPicker, ImageUploadButton, MergeTagInsert } from './components';

/* ── Social SVG Icons ── */
const SOCIAL_SVGS: Record<string, (size: number, color: string) => React.ReactNode> = {
  facebook: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  instagram: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
  x: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  youtube: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  linkedin: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  tiktok: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>,
};

/* ── Countdown Preview ── */
function CountdownPreview({ data }: { data: Record<string, any>; isPreview?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  const target = data.endDate ? new Date(data.endDate).getTime() : 0;
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const p = data.padding || {};
  const pad = `${p.top||0}px ${p.right||0}px ${p.bottom||0}px ${p.left||0}px`;
  const bg = data.bgColor || BRAND;
  const tc = data.textColor || '#ffffff';
  const fs = data.fontSize || 18;

  if (!data.endDate) {
    return <div className="eb-placeholder" style={{ padding: pad }}>Set an end date</div>;
  }

  const digitBox = (val: number, label: string) => (
    <div style={{ textAlign: 'center' }}>
      <div className="eb-countdown-digit" style={{ fontSize: `${fs}px`, fontWeight: 800, color: tc, background: 'rgba(0,0,0,0.15)', borderRadius: 6, padding: '8px 12px', minWidth: 50 }}>{String(val).padStart(2, '0')}</div>
      <div style={{ fontSize: 10, color: tc, opacity: .7, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ background: bg, padding: '16px 20px', borderRadius: 8, textAlign: 'center' }}>
      {data.label && <div style={{ color: tc, fontSize: 13, fontWeight: 600, marginBottom: 10, opacity: .85 }}>{data.label}</div>}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: pad }}>
        {digitBox(days, 'Days')}
        <div style={{ fontSize: `${fs}px`, fontWeight: 800, color: tc, lineHeight: '42px' }}>:</div>
        {digitBox(hours, 'Hours')}
        <div style={{ fontSize: `${fs}px`, fontWeight: 800, color: tc, lineHeight: '42px' }}>:</div>
        {digitBox(minutes, 'Mins')}
        <div style={{ fontSize: `${fs}px`, fontWeight: 800, color: tc, lineHeight: '42px' }}>:</div>
        {digitBox(seconds, 'Secs')}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   BLOCK PREVIEW (Canvas rendering)
   ═══════════════════════════════════════ */
export function BlockPreview({ block, isPreview = false, isMobile = false, onColumnDrop, onSubBlockSelect, selectedSubBlockId, globalSettings = {}, customData }: {
  block: BlockData; isPreview?: boolean; isMobile?: boolean;
  onColumnDrop?: (parentId: string, colIdx: number, type: string) => void;
  onSubBlockSelect?: (parentId: string, colIdx: number, blockId: string) => void;
  selectedSubBlockId?: string; globalSettings?: Record<string, any>; customData?: Record<string, string>;
}) {
  const { type, data } = block;
  const resolve = (t: string) => replaceMergeTags(t || '', false, customData);
  const p = data.padding || {};
  const pad = `${p.top||0}px ${p.right||0}px ${p.bottom||0}px ${p.left||0}px`;
  const tc = globalSettings.textColor || '#1f2937';
  const font = data.fontFamily || globalSettings.fontFamily || "'Inter', sans-serif";

  if (data.fontFamily) { const n = data.fontFamily.replace(/'/g,'').split(',')[0]; if (n) loadGoogleFont(n); }

  const sanitizeOpts = { ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'br', 'span', 'strong', 'div'], ADD_ATTR: ['style', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan'] };

  switch (type) {
    case 'heading': {
      const sz = data.level === 'h1' ? '28px' : data.level === 'h3' ? '18px' : '22px';
      return <div style={{ color: data.color||tc, padding: pad, fontSize: sz, fontWeight: 700, lineHeight: 1.3, fontFamily: font, background: data.bgColor || 'transparent' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cleanHtml(resolve(data.content)) || '<p>Heading</p>', sanitizeOpts) }} />;
    }
    case 'text':
      return <div style={{ color: data.color||tc, fontSize: '15px', lineHeight: 1.7, padding: pad, fontFamily: font, background: data.bgColor || 'transparent' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cleanHtml(resolve(data.content)) || '<p>Text block</p>', sanitizeOpts) }} />;
    case 'image': {
      if (!data.src) return !isPreview ? <div className="eb-placeholder"><ImageIcon size={24} /><br/>Click to add an image</div> : null;
      const imgMargin = data.align === 'left' ? '0 auto 0 0' : data.align === 'right' ? '0 0 0 auto' : '0 auto';
      return (
        <div style={{ textAlign: (data.align||'center') as any, padding: pad }}>
          <img src={data.src} alt={data.alt||''} style={{ maxWidth: `${data.width||100}%`, borderRadius: `${data.borderRadius||0}px`, display: 'block', margin: imgMargin }} />
        </div>
      );
    }
    case 'button':
      return (
        <div style={{ textAlign: (data.align||'center') as any, padding: pad }}>
          <a href="#" onClick={e => e.preventDefault()} style={{ display: data.fullWidth?'block':'inline-block', padding: `${data.paddingV||12}px ${data.paddingH||32}px`, backgroundColor: data.bgColor||BRAND, color: data.textColor||'#fff', borderRadius: `${data.borderRadius||8}px`, textDecoration: 'none', fontWeight: data.fontWeight||600, fontSize: `${data.fontSize||15}px`, fontFamily: font, textAlign: 'center', border: 'none', cursor: 'default' }}>{data.text||'Button'}</a>
        </div>
      );
    case 'divider':
      return <div style={{ padding: `${data.marginTop||8}px 0 ${data.marginBottom||8}px` }}><hr style={{ width: `${data.width||100}%`, border: 'none', borderTop: `${data.thickness||1}px ${data.style||'solid'} ${data.color||'#e5e7eb'}`, margin: '0 auto' }} /></div>;
    case 'spacer':
      return <div style={{ height: `${data.height||32}px`, background: data.bgColor||'transparent' }} />;
    case 'merge_tag': {
      const resolvedTag = replaceMergeTags(data.tag||'', false, customData);
      const isHtml = resolvedTag.includes('<');
      if (!isPreview && !isHtml) return <div style={{ padding: '4px 0' }}><span className="eb-merge-badge"><Tag size={12} /> {tagLabel(data.tag)}</span></div>;
      if (isHtml) return <div style={{ padding: pad, fontFamily: font }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(resolvedTag, sanitizeOpts) }} />;
      return <div style={{ padding: pad, fontSize: `${data.fontSize||15}px`, fontWeight: data.fontWeight||400, color: data.color||tc, fontFamily: font }}>{resolvedTag}</div>;
    }

    case 'social': {
      const platforms = data.platforms || {};
      const iconSz = Number(data.iconSize || 32);
      const spacing = Number(data.spacing || 12);
      const active = SOCIAL_PLATFORMS.filter(p => platforms[p.key]);
      if (active.length === 0 && !isPreview) return <div className="eb-placeholder">Add social media URLs in settings</div>;
      return (
        <div style={{ textAlign: (data.align||'center') as any, padding: pad }}>
          <div style={{ display: 'inline-flex', gap: `${spacing}px`, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            {(active.length > 0 ? active : SOCIAL_PLATFORMS.slice(0, 3)).map(plat => (
              <a key={plat.key} href={platforms[plat.key] || '#'} onClick={e => e.preventDefault()}
                 style={{ display: 'inline-flex', width: iconSz, height: iconSz, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', textDecoration: 'none', opacity: platforms[plat.key] ? 1 : 0.3 }}>
                {SOCIAL_SVGS[plat.key]?.(iconSz * 0.8, plat.color)}
              </a>
            ))}
          </div>
        </div>
      );
    }

    case 'html': {
      if (!data.content) return <div className="eb-placeholder"><Code size={20} /><br/>Add custom HTML</div>;
      return <div style={{ padding: pad }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content) }} />;
    }

    case 'video': {
      if (!data.thumbnailUrl && !data.videoUrl) return !isPreview ? <div className="eb-placeholder"><Play size={24} /><br/>Add a video URL & thumbnail</div> : null;
      const thumb = data.thumbnailUrl || (data.videoUrl?.includes('youtube') ? `https://img.youtube.com/vi/${extractYoutubeId(data.videoUrl)}/maxresdefault.jpg` : '');
      return (
        <div style={{ textAlign: (data.align||'center') as any, padding: pad }}>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: `${data.width||100}%`, borderRadius: `${data.borderRadius||0}px`, overflow: 'hidden' }}>
            {thumb ? <img src={thumb} alt={data.alt||''} style={{ width: '100%', display: 'block' }} /> : <div style={{ width: 400, height: 225, background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={48} color="#fff" /></div>}
            <div className="eb-video-play-overlay">
              <div className="eb-video-play-btn"><Play size={28} color="#fff" style={{ marginLeft: 3 }} /></div>
            </div>
          </div>
        </div>
      );
    }

    case 'countdown':
      return <CountdownPreview data={data} isPreview={isPreview} />;

    case 'columns': {
      const cols = data.columns || [];
      const gap = data.gap !== undefined ? Number(data.gap) : 16;
      const parts = (data.layout||'50-50').split('-').map(Number);
      const stack = isMobile;

      if (!isPreview) {
        return (
          <div style={{ display: 'flex', flexDirection: stack?'column':'row', padding: pad, gap: `${gap}px` }}>
            {cols.map((col: any, i: number) => (
              <div key={i} style={{ flex: parts[i]||1, border: '1px dashed var(--color-border)', borderRadius: 4, padding: 12, minHeight: 60, background: col.bgColor||'transparent' }}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = BRAND; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = ''; }}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = ''; const t = e.dataTransfer.getData('text/plain'); if (t && t !== '__reorder__' && t !== 'columns' && onColumnDrop) onColumnDrop(block.id, i, t); }}
              >
                {col.blocks?.length > 0 ? col.blocks.map((b: BlockData) => (
                  <div key={b.id} onClick={onSubBlockSelect ? (e: React.MouseEvent) => { e.stopPropagation(); onSubBlockSelect(block.id, i, b.id); } : undefined}
                    style={{ cursor: 'pointer', outline: selectedSubBlockId === b.id ? `2px solid ${BRAND}` : 'none', borderRadius: 4, position: 'relative' }}>
                    <BlockPreview block={b} isPreview={false} globalSettings={globalSettings} customData={customData} />
                  </div>
                )) : <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12, padding: 16 }}>Drop blocks here</div>}
              </div>
            ))}
          </div>
        );
      }
      return (
        <div style={{ display: 'flex', flexDirection: stack?'column':'row', gap: `${gap}px`, padding: pad }}>
          {cols.map((col: any, i: number) => (
            <div key={i} style={{ flex: parts[i]||1, padding: 12, background: col.bgColor||'transparent' }}>
              {(col.blocks||[]).map((b: BlockData) => <BlockPreview key={b.id} block={b} isPreview isMobile={isMobile} globalSettings={globalSettings} customData={customData} />)}
            </div>
          ))}
        </div>
      );
    }
    default: return <div style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Unknown block</div>;
  }
}

function extractYoutubeId(url: string): string {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  return m ? m[1] : '';
}

/* ═══════════════════════════════════════
   PREVIEW MODE
   ═══════════════════════════════════════ */
export function PreviewMode({ blocks, settings, onExit, sampleDataOverride }: {
  blocks: BlockData[]; settings: Record<string, any>; onExit: () => void; sampleDataOverride?: Record<string, string>;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const emailWidth = settings.width || 600;
  const font = settings.fontFamily || "'Inter', sans-serif";
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div className="eb-preview-bar">
        <div className="eb-preview-dot" />
        <span className="eb-preview-label">Preview</span>
        <div className="eb-device-toggle">
          <button className={`eb-device-btn${!isMobile ? ' active' : ''}`} onClick={() => setIsMobile(false)}><Monitor size={14} /> Desktop</button>
          <button className={`eb-device-btn${isMobile ? ' active' : ''}`} onClick={() => setIsMobile(true)}><Smartphone size={14} /> Mobile</button>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" onClick={onExit}><EyeOff size={14} /> Back to editing</button>
      </div>
      <div style={{ padding: 32, background: settings.bodyBg || '#f5f5f5', minHeight: 'calc(100vh - 100px)' }}>
        <div style={{ maxWidth: isMobile ? 375 : emailWidth, margin: '0 auto', background: settings.contentBg || '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', fontFamily: font, color: settings.textColor || '#1f2937' }}>
          {settings.logoUrl && <div style={{ padding: 24, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}><img src={settings.logoUrl} alt="Logo" style={{ maxHeight: 48, maxWidth: '60%' }} /></div>}
          <div className="eb-email-content" style={{ padding: '24px 20px' }}>
            {blocks.map(b => <div key={b.id} style={{ marginBottom: 16 }}><BlockPreview block={b} isPreview isMobile={isMobile} globalSettings={settings} customData={sampleDataOverride} /></div>)}
            {blocks.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '48px 0' }}>No content blocks yet</p>}
          </div>
          {settings.footerText && <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', textAlign: 'center', fontSize: 12, color: '#9ca3af' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cleanHtml(replaceMergeTags(settings.footerText, false, sampleDataOverride))) }} />}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   GLOBAL SETTINGS PANEL
   ═══════════════════════════════════════ */
const QUILL_FOOTER = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ align: [] }],
    ['link'],
    ['clean'],
  ],
};

export function GlobalSettingsPanel({ settings, onUpdate }: {
  settings: Record<string, any>; onUpdate: (s: Record<string, any>) => void;
}) {
  const patch = (k: string, v: any) => onUpdate({ ...settings, [k]: v });
  const [showSubjectTags, setShowSubjectTags] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);

  const insertSubjectTag = (tag: string) => {
    const input = subjectRef.current;
    if (!input) { patch('subject', (settings.subject || '') + tag); setShowSubjectTags(false); return; }
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const val = settings.subject || '';
    const newVal = val.slice(0, start) + tag + val.slice(end);
    patch('subject', newVal);
    setShowSubjectTags(false);
    setTimeout(() => { input.focus(); input.setSelectionRange(start + tag.length, start + tag.length); }, 0);
  };

  const quillWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleQuillMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.ql-action') || target.closest('.ql-remove') || target.closest('.ql-preview')) {
        e.preventDefault();
      }
    };
    const wrap = quillWrapRef.current;
    if (wrap) wrap.addEventListener('mousedown', handleQuillMouseDown, { capture: true });
    return () => {
      if (wrap) wrap.removeEventListener('mousedown', handleQuillMouseDown, { capture: true });
    };
  }, []);

  return (
    <>
      <div className="eb-right-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Settings size={13} /><span style={{ fontWeight: 700 }}>Email Settings</span></div>
      </div>
      <div className="eb-right-scroll">
        <div className="eb-section-label">Email Metadata</div>
        <div className="form-group">
          <label>Subject Line</label>
          <input ref={subjectRef} className="form-input" value={settings.subject || ''} onChange={e => patch('subject', e.target.value)} placeholder="Enter subject…" />
          <div style={{ position: 'relative', marginTop: 4 }}>
            <button type="button" className="btn-secondary" onClick={() => setShowSubjectTags(p => !p)} style={{ fontSize: 12, gap: 4, width: '100%', justifyContent: 'center' }}>
              <Tag size={12} /> Insert Merge Field
            </button>
            {showSubjectTags && (
              <div className="eb-merge-dropdown" style={{ top: '100%', left: 0, right: 0 }}>
                {MERGE_TAGS.map(g => (
                  <div key={g.group}>
                    <div className="eb-merge-group">{g.group}</div>
                    {g.tags.map(t => (
                      <button key={t.key} type="button" className="eb-merge-option" onClick={() => insertSubjectTag(t.key)}>
                        <Tag size={11} style={{ opacity: .4 }} /> {t.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="form-group"><label>Preview Text <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(inbox snippet)</span></label><input className="form-input" value={settings.previewText || ''} onChange={e => patch('previewText', e.target.value)} placeholder="Brief text…" /></div>
        <div className="eb-divider" />
        <div className="eb-section-label">Design</div>
        <div className="form-group"><label>Email Width (px)</label><input className="form-input" type="number" value={settings.width || 600} onChange={e => patch('width', Number(e.target.value))} min={400} max={800} /></div>
        <ColorField label="Body Background" value={settings.bodyBg || ''} onChange={v => patch('bodyBg', v)} defaultValue="#f5f5f5" />
        <ColorField label="Content Background" value={settings.contentBg || ''} onChange={v => patch('contentBg', v)} defaultValue="#ffffff" />
        <FontPicker value={settings.fontFamily || ''} onChange={v => patch('fontFamily', v)} />
        <ColorField label="Default Text Colour" value={settings.textColor || ''} onChange={v => patch('textColor', v)} defaultValue="#1f2937" />
        <ColorField label="Link Colour" value={settings.linkColor || ''} onChange={v => patch('linkColor', v)} defaultValue={BRAND} />
        <div className="eb-divider" />

        {/* Logo */}
        <div className="form-group">
          <label>Header Logo</label>
          {settings.logoUrl && (
            <div style={{ marginBottom: 8, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', padding: 12, textAlign: 'center', background: 'var(--color-bg-surface)' }}>
              <img src={settings.logoUrl} alt="Logo" style={{ maxHeight: 40, maxWidth: '80%' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ImageUploadButton onUploaded={url => patch('logoUrl', url)} />
            {settings.logoUrl && <button type="button" className="row-action-btn" onClick={() => patch('logoUrl', '')} title="Remove"><span style={{ fontSize: 12 }}>✕</span></button>}
          </div>
          <input className="form-input" value={settings.logoUrl || ''} onChange={e => patch('logoUrl', e.target.value)} placeholder="Or paste URL…" style={{ marginTop: 6, fontSize: 12 }} />
        </div>

        {/* Rich Footer */}
        <div className="form-group">
          <label>Footer Content</label>
          <div className="eb-quill-wrap" ref={quillWrapRef}>
            <ReactQuill theme="snow" value={settings.footerText || ''} onChange={v => patch('footerText', v)} modules={QUILL_FOOTER} formats={['bold', 'italic', 'underline', 'align', 'link']} placeholder="© Your organisation" />
          </div>
          <div style={{ marginTop: 4 }}>
            <MergeTagInsert onInsert={tag => patch('footerText', (settings.footerText || '') + tag)} />
          </div>
        </div>
      </div>
    </>
  );
}
