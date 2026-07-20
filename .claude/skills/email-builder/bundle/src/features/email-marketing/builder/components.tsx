import { useState, useEffect, useRef } from 'react';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import { Upload, X, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { GOOGLE_FONTS, MERGE_TAGS, BRAND, loadGoogleFont } from './constants';

/* ── Curated colour palette for email design ── */
const COLOUR_SWATCHES = [
  /* Neutrals */
  '#ffffff', '#f3f4f6', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827', '#000000',
  /* Reds */
  '#fee2e2', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c',
  /* Oranges */
  '#ffedd5', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c',
  /* Yellows */
  '#fef9c3', '#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207',
  /* Greens */
  '#dcfce7', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d',
  /* Blues */
  '#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8',
  /* Purples */
  '#f3e8ff', '#d8b4fe', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9',
  /* Pinks */
  '#fce7f3', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d',
];

export function ColorField({ label, value, onChange, defaultValue = '' }: {
  label: string; value: string; onChange: (v: string) => void; defaultValue?: string;
}) {
  const display = value || defaultValue || '#000000';
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value || '');
  const ref = useRef<HTMLDivElement>(null);

  // Sync hex input when value changes externally
  useEffect(() => { setHexInput(value || ''); }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleHexChange = (hex: string) => {
    setHexInput(hex);
    // Only emit valid hex colours
    if (/^#[0-9a-fA-F]{6}$/.test(hex) || /^#[0-9a-fA-F]{3}$/.test(hex)) {
      onChange(hex);
    }
  };

  const handleHexBlur = () => {
    if (hexInput && !/^#/.test(hexInput)) {
      const withHash = '#' + hexInput;
      if (/^#[0-9a-fA-F]{3,6}$/.test(withHash)) {
        onChange(withHash);
        setHexInput(withHash);
      }
    }
  };

  return (
    <div className="form-group" style={{ position: 'relative' }} ref={ref}>
      <label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => setOpen(!open)}
          className="eb-color-swatch-btn"
          style={{ background: display }} />
        <input className="form-input" value={hexInput} onChange={e => handleHexChange(e.target.value)}
          onBlur={handleHexBlur}
          placeholder="Default" style={{ fontSize: 13, fontFamily: 'monospace', flex: 1 }} />
        {value && <button type="button" className="row-action-btn" onClick={() => { onChange(''); setHexInput(''); }} title="Reset"><X size={12} /></button>}
      </div>

      {open && (
        <div className="eb-color-dropdown">
          <div className="eb-color-grid">
            {COLOUR_SWATCHES.map(c => (
              <button key={c} type="button"
                className={`eb-color-cell${display.toLowerCase() === c.toLowerCase() ? ' active' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => { onChange(c); setHexInput(c); setOpen(false); }} />
            ))}
          </div>
          <div className="eb-color-hex-row">
            <div className="eb-color-preview" style={{ background: display }} />
            <input className="form-input" value={hexInput} onChange={e => handleHexChange(e.target.value)} onBlur={handleHexBlur}
              placeholder="#000000" style={{ fontSize: 12, fontFamily: 'monospace', flex: 1 }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Alignment toggle ── */
export function AlignField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="form-group">
      <label>Alignment</label>
      <div className="eb-align-toggle">
        {['left', 'center', 'right'].map(a => (
          <button key={a} type="button" className={`eb-align-btn${(value || 'center') === a ? ' active' : ''}`}
            onClick={() => onChange(a)}>{a}</button>
        ))}
      </div>
    </div>
  );
}

/* ── Font picker with search + preview ── */
export function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  useEffect(() => {
    if (value) { const n = value.replace(/'/g, '').split(',')[0]; if (n) loadGoogleFont(n); }
  }, [value]);

  const display = value ? value.replace(/'/g, '').split(',')[0] : 'Default';
  const filtered = GOOGLE_FONTS.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="form-group" style={{ position: 'relative' }} ref={ref}>
      <label>Font Family</label>
      <button type="button" className="form-input" onClick={() => setOpen(!open)}
        style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontFamily: value || 'inherit' }}>
        <span>{display}</span><ChevronDown size={14} style={{ opacity: .5 }} />
      </button>
      {open && (
        <div className="eb-font-dropdown">
          <input className="form-input" placeholder="Search fonts…" value={search}
            onChange={e => setSearch(e.target.value)} autoFocus style={{ marginBottom: 8 }} />
          <div className="eb-font-list">
            <button type="button" className={`eb-font-item${!value ? ' active' : ''}`}
              onClick={() => { onChange(''); setOpen(false); }}>System Default</button>
            {filtered.map(f => (
              <button type="button" key={f.name} className={`eb-font-item${value === f.value ? ' active' : ''}`}
                onClick={() => { loadGoogleFont(f.name); onChange(f.value); setOpen(false); }}
                onMouseEnter={() => loadGoogleFont(f.name)}
                style={{ fontFamily: f.value }}>{f.name}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Image upload to Supabase Storage ── */
export function ImageUploadButton({ onUploaded }: { onUploaded: (url: string) => void }) {
  const { alert } = useConfirm();
  const [uploading, setUploading] = useState(false);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // ── DIAGNOSTIC: dump auth state so we can confirm the JWT reaches Storage ──
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      console.group('[email-images upload diagnostic]');
      console.log('has session:',     !!session);
      console.log('user id:',         session?.user?.id);
      console.log('user email:',      session?.user?.email);
      console.log('access token len:',session?.access_token?.length);
      console.log('access token role (decoded):', session?.access_token ? JSON.parse(atob(session.access_token.split('.')[1])).role : null);
      console.log('expires at:',      session?.expires_at && new Date(session.expires_at * 1000).toISOString());
      console.groupEnd();
      // ── END DIAGNOSTIC ──

      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('email-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('email-images').getPublicUrl(path);
      onUploaded(data.publicUrl);
    } catch (err: any) {
      console.error('Image upload error:', err);
      const friendly = /row-level security/.test(err?.message || '')
        ? 'Upload blocked by Storage RLS. Check the browser console for the auth diagnostic — if "user id" is null, the session isn\'t being recognized.'
        : `Image upload failed: ${err.message || err}`;
      alert(friendly, { description: 'Upload Failed' });
    } finally { setUploading(false); e.target.value = ''; }
  }

  return (
    <label className="btn-secondary" style={{ flex: 1, cursor: 'pointer', textAlign: 'center', opacity: uploading ? .6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload Image'}
      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={handle} />
    </label>
  );
}

/* ── Merge Tag insert button (dropdown) ── */
export function MergeTagInsert({ onInsert }: { onInsert: (tag: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <button type="button" className="btn-secondary" onClick={() => setOpen(!open)}
        style={{ width: '100%', justifyContent: 'center', gap: 6 }}>
        <Tag size={14} /> Insert Merge Tag
      </button>
      {open && (
        <div className="eb-merge-dropdown">
          {MERGE_TAGS.map(g => (
            <div key={g.group}>
              <div className="eb-merge-group">{g.group}</div>
              {g.tags.map(t => (
                <button type="button" key={t.key} className="eb-merge-option"
                  onClick={() => { onInsert(t.key); setOpen(false); }}>
                  <Tag size={12} style={{ color: BRAND, flexShrink: 0 }} /> {t.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Block padding/spacing (collapsible TRBL) ── */
export function BlockSpacing({ padding, onChange }: {
  padding: Record<string, number>; onChange: (side: string, val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const p = padding || { top: 0, right: 0, bottom: 0, left: 0 };
  return (
    <>
      <div className="eb-divider" />
      <button type="button" className="eb-section-toggle" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} <span>Block Spacing</span>
      </button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          {(['top', 'right', 'bottom', 'left'] as const).map(s => (
            <div className="form-group" key={s} style={{ marginBottom: 0 }}>
              <label style={{ textTransform: 'capitalize' }}>{s} (px)</label>
              <input className="form-input" type="number" value={p[s] || 0}
                onChange={e => onChange(s, e.target.value)} min={0} max={80} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
