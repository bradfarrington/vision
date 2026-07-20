import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import 'react-quill-new/dist/quill.snow.css';
import {
  ArrowLeft, Save, Eye, Check, GripVertical, Trash2, Plus,
  Copy, Send, X, Settings, Undo2, Redo2, Clipboard, FileText,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { supabase } from '../../lib/supabase';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/primitives';
import { BLOCK_GROUPS, BRAND, makeBlock, SAMPLE_DATA, replaceMergeTags } from './builder/constants';
import type { BlockData } from './builder/constants';
import { generateEmailHtml } from './builder/mjml';
import { BlockEditPanel } from './builder/BlockEditPanel';
import { BlockPreview, PreviewMode, GlobalSettingsPanel } from './builder/panels';
import CampaignSendDrawer from './CampaignSendDrawer';
import { getSystemTemplateDefault, SYSTEM_SAMPLE_DATA } from './builder/systemTemplates';
import './EmailBuilder.css';

type Mode = 'campaign' | 'template' | 'system';

export default function EmailBuilderPage() {
  const { alert } = useConfirm();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaignId');
  const templateId = searchParams.get('templateId');
  const systemTemplateId = searchParams.get('systemTemplateId');
  const mode: Mode = campaignId ? 'campaign' : systemTemplateId ? 'system' : 'template';
  const recordId = campaignId || systemTemplateId || templateId;

  // System templates use a richer sample data set (includes invite_link,
  // notification_*, recipient_*) so the preview + test send look realistic.
  const sampleData = mode === 'system' ? { ...SAMPLE_DATA, ...SYSTEM_SAMPLE_DATA } : SAMPLE_DATA;

  const [name, setName] = useState(
    mode === 'campaign' ? 'Campaign'
    : mode === 'system' ? 'System email'
    : 'Untitled Template',
  );

  /* ── Undo/Redo ── */
  const [blocks, setBlocksRaw] = useState<BlockData[]>([]);
  const historyRef = useRef<{ past: BlockData[][]; future: BlockData[][] }>({ past: [], future: [] });
  const skipHistoryRef = useRef(false);

  const setBlocks = useCallback((updater: BlockData[] | ((prev: BlockData[]) => BlockData[])) => {
    setBlocksRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!skipHistoryRef.current) {
        historyRef.current.past = [...historyRef.current.past.slice(-49), prev];
        historyRef.current.future = [];
      }
      skipHistoryRef.current = false;
      return next;
    });
  }, []);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    setBlocksRaw(prev => {
      h.future = [prev, ...h.future];
      const restored = h.past[h.past.length - 1];
      h.past = h.past.slice(0, -1);
      return restored;
    });
  }, []);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    setBlocksRaw(prev => {
      h.past = [...h.past, prev];
      const restored = h.future[0];
      h.future = h.future.slice(1);
      return restored;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      const isInput = tgt?.tagName === 'INPUT' || tgt?.tagName === 'TEXTAREA' || tgt?.getAttribute?.('contenteditable');
      if (isInput) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  /* ── Block clipboard ── */
  const copyBlock = useCallback((id: string) => {
    const block = blocks.find(b => b.id === id);
    if (block) localStorage.setItem('eb-clipboard', JSON.stringify(block));
  }, [blocks]);

  const pasteBlock = useCallback(() => {
    try {
      const raw = localStorage.getItem('eb-clipboard');
      if (!raw) return;
      const block = JSON.parse(raw);
      block.id = crypto.randomUUID();
      setBlocks(prev => [...prev, block]);
      setSelectedId(block.id);
    } catch { /* ignore */ }
  }, [setBlocks]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSubBlock, setSelectedSubBlock] = useState<{ parentId: string; colIdx: number; blockId: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendDrawerCampaignId, setSendDrawerCampaignId] = useState<string | null>(null);
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [settings, setSettings] = useState<Record<string, any>>({
    width: 600, bodyBg: '#f5f5f5', contentBg: '#ffffff',
    fontFamily: '', textColor: '#1f2937', linkColor: BRAND,
    logoUrl: '', footerText: '&copy; {{org_name}}<br><br><a href="{{unsubscribe_link}}" style="color: inherit; text-decoration: underline;">Unsubscribe</a>',
    subject: '', previewText: '',
  });

  /* DnD */
  const dragSrcRef = useRef<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below'>('below');
  const [isCanvasDragOver, setIsCanvasDragOver] = useState(false);

  const selectedBlock = blocks.find(b => b.id === selectedId) || null;
  const selectedSubBlockObj = (() => {
    if (!selectedSubBlock) return null;
    const parent = blocks.find(b => b.id === selectedSubBlock.parentId);
    if (!parent || parent.type !== 'columns') return null;
    const col = parent.data.columns?.[selectedSubBlock.colIdx];
    return col?.blocks?.find((b: BlockData) => b.id === selectedSubBlock.blockId) || null;
  })();

  /* ── Load existing record ──
     For system templates: if the row was seeded with empty body_blocks
     (i.e. it's never been customised), fall back to the default content
     defined in `systemTemplates.ts`. The default is persisted on first
     save so subsequent edits work as normal. */
  useEffect(() => {
    if (!recordId) return;
    (async () => {
      const table = mode === 'campaign' ? 'comms_campaigns'
                  : mode === 'system'   ? 'system_email_templates'
                                        : 'comms_email_templates';
      const { data, error } = await supabase.from(table).select('*').eq('id', recordId).maybeSingle();
      if (error || !data) { console.error('Failed to load:', error); return; }
      setName(data.name || 'Untitled');

      let loadedBlocks: BlockData[] = data.body_blocks
        ? (typeof data.body_blocks === 'string' ? JSON.parse(data.body_blocks) : data.body_blocks)
        : [];
      let loadedSettings = data.body_settings
        ? (typeof data.body_settings === 'string' ? JSON.parse(data.body_settings) : data.body_settings)
        : {};

      if (mode === 'system' && (!loadedBlocks || loadedBlocks.length === 0)) {
        const fallback = getSystemTemplateDefault(data.key);
        if (fallback) {
          loadedBlocks = fallback.blocks;
          loadedSettings = { ...fallback.settings, ...loadedSettings };

          // Persist the defaults to the DB on first open so the
          // server-side send path (invite-staff / send-system-email)
          // sees the same body_html the builder is showing. Without
          // this, the first invite/sample uses the minimal fallback
          // HTML in supabase/functions/_shared/system-email.ts which
          // wouldn't match what the user sees in the builder.
          try {
            const html = generateEmailHtml(loadedBlocks, loadedSettings, true);
            await supabase.from('system_email_templates').update({
              body_blocks: loadedBlocks,
              body_settings: loadedSettings,
              body_html: html,
              subject: data.subject || loadedSettings.subject || null,
              preview_text: data.preview_text || loadedSettings.previewText || null,
            }).eq('id', recordId);
          } catch (e) {
            console.warn('[EmailBuilder] failed to persist system template defaults', e);
          }
        }
      }

      skipHistoryRef.current = true;
      setBlocks(loadedBlocks as BlockData[]);
      setSettings(prev => ({ ...prev, ...loadedSettings, subject: data.subject || loadedSettings.subject || '', previewText: data.preview_text || loadedSettings.previewText || '' }));
    })();
  }, [recordId, mode, setBlocks]);

  /* ── Block mutations ── */
  function addBlock(type: string, atIdx: number | null = null) {
    const b = makeBlock(type);
    setBlocks(prev => { const next = [...prev]; if (atIdx !== null) next.splice(atIdx, 0, b); else next.push(b); return next; });
    setSelectedId(b.id); setShowSettings(false);
  }
  function addBlockToColumn(parentId: string, colIdx: number, type: string) {
    const nb = makeBlock(type);
    setBlocks(prev => prev.map(b => {
      if (b.id !== parentId) return b;
      const cols = [...(b.data.columns || [{ blocks: [] }, { blocks: [] }])];
      cols[colIdx] = { ...cols[colIdx], blocks: [...(cols[colIdx].blocks || []), nb] };
      return { ...b, data: { ...b.data, columns: cols } };
    }));
  }
  function updateBlock(id: string, patch: Record<string, any>) { setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b)); }
  function updateSubBlock(parentId: string, colIdx: number, blockId: string, patch: Record<string, any>) {
    setBlocks(prev => prev.map(b => {
      if (b.id !== parentId) return b;
      const cols = (b.data.columns || []).map((col: any, ci: number) => {
        if (ci !== colIdx) return col;
        return { ...col, blocks: (col.blocks || []).map((sb: BlockData) => sb.id === blockId ? { ...sb, ...patch } : sb) };
      });
      return { ...b, data: { ...b.data, columns: cols } };
    }));
  }
  function deleteSubBlock(parentId: string, colIdx: number, blockId: string) {
    setBlocks(prev => prev.map(b => {
      if (b.id !== parentId) return b;
      const cols = (b.data.columns || []).map((col: any, ci: number) => {
        if (ci !== colIdx) return col;
        return { ...col, blocks: (col.blocks || []).filter((sb: BlockData) => sb.id !== blockId) };
      });
      return { ...b, data: { ...b.data, columns: cols } };
    }));
    setSelectedSubBlock(null);
  }
  function deleteBlock(id: string) { setBlocks(prev => prev.filter(b => b.id !== id)); if (selectedId === id) setSelectedId(null); }
  function duplicateBlock(id: string) {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    const clone = { ...JSON.parse(JSON.stringify(blocks[idx])), id: crypto.randomUUID() };
    setBlocks(prev => { const next = [...prev]; next.splice(idx + 1, 0, clone); return next; });
    setSelectedId(clone.id);
  }
  function reorderBlocks(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    setBlocks(prev => { const next = [...prev]; const [m] = next.splice(fromIdx, 1); next.splice(toIdx, 0, m); return next; });
  }

  /* ── DnD handlers ── */
  function handlePaletteDragStart(e: React.DragEvent, type: string) { e.dataTransfer.setData('text/plain', type); e.dataTransfer.effectAllowed = 'copy'; }
  function handleBlockDragStart(e: React.DragEvent, idx: number) { dragSrcRef.current = idx; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', '__reorder__'); }
  function handleBlockDragEnd() { dragSrcRef.current = null; setDropTargetIdx(null); }
  function handleBlockDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setDropTargetIdx(idx); setDropPosition(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below'); }
  function handleBlockDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault(); e.stopPropagation();
    const data = e.dataTransfer.getData('text/plain');
    if (data === '__reorder__' && dragSrcRef.current != null) {
      const fromIdx = dragSrcRef.current;
      const insertAt = dropPosition === 'above' ? targetIdx : targetIdx + 1;
      reorderBlocks(fromIdx, fromIdx < insertAt ? insertAt - 1 : insertAt);
    } else if (data && data !== '__reorder__') {
      addBlock(data, dropPosition === 'above' ? targetIdx : targetIdx + 1);
    }
    setDropTargetIdx(null);
  }
  function handleCanvasDrop(e: React.DragEvent) {
    setIsCanvasDragOver(false);
    const data = e.dataTransfer.getData('text/plain');
    if (data && data !== '__reorder__') addBlock(data);
  }

  /* ── Save ──
     `continueToSend` is set by the "Save & Continue" button on a campaign:
     instead of just returning to the list, we route to the campaigns list
     with ?send=<id> so the send drawer auto-opens for the just-saved
     campaign. For templates and the regular Save button, we stay put. */
  async function handleSave(continueToSend = false) {
    setSaving(true);
    try {
      const html = generateEmailHtml(blocks, settings, true);
      const subject = settings.subject || name;
      const previewText = settings.previewText || '';
      const baseRow: any = {
        name,
        subject,
        preview_text: previewText,
        body_blocks: blocks,
        body_settings: settings,
        body_html: html,
      };
      const table = mode === 'campaign' ? 'comms_campaigns'
                  : mode === 'system'   ? 'system_email_templates'
                                        : 'comms_email_templates';
      let resolvedId: string | null = recordId;
      if (recordId) {
        if (mode === 'system') baseRow.updated_by = user?.id;
        const { error } = await supabase.from(table).update(baseRow).eq('id', recordId);
        if (error) throw error;
      } else {
        // System templates are seeded by the migration — they're never
        // created from the builder, so we don't need an insert path here.
        if (mode === 'template') {
          baseRow.created_by = user?.id;
        } else {
          baseRow.created_by = user?.id;
          baseRow.send_from_user_id = user?.id;
          baseRow.status = 'draft';
          baseRow.type = 'email';
        }
        const { data: created, error } = await supabase.from(table).insert(baseRow).select('id').single();
        if (error) throw error;
        if (created?.id) {
          resolvedId = created.id;
          const newParam = mode === 'campaign' ? 'campaignId' : 'templateId';
          // Only swap the URL in-place when staying on the builder. If we're
          // about to navigate away to the send step, skip the replace.
          if (!continueToSend) {
            navigate(`/communications/builder?${newParam}=${created.id}`, { replace: true });
          }
        }
      }
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      if (continueToSend && mode === 'campaign' && resolvedId) {
        // Open the send drawer in-place over the builder rather than
        // navigating away to the campaigns list.
        setSendDrawerCampaignId(resolvedId);
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      alert(err.message || 'Failed to save. Please try again.', { description: 'Save Failed' });
    } finally { setSaving(false); }
  }

  /* ── Save the current campaign design as a reusable template.
        Snapshots the current blocks/settings/subject into comms_email_templates
        — independent from this point on, so future edits don't affect either side. */
  function openSaveAsTemplate() {
    setTemplateName(name ? `${name} (template)` : '');
    setTemplateDescription('');
    setShowSaveAsTemplateModal(true);
  }
  async function handleSaveAsTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const { error } = await supabase.from('comms_email_templates').insert({
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        subject: settings.subject || null,
        preview_text: settings.previewText || null,
        body_blocks: blocks,
        body_settings: settings,
        body_html: generateEmailHtml(blocks, settings, true),
        created_by: user?.id,
      });
      if (error) throw error;
      setShowSaveAsTemplateModal(false);
      alert(`Template "${templateName.trim()}" saved.`, { description: 'Template saved' });
    } catch (err: any) {
      alert(err.message || 'Failed to save template.', { description: 'Save failed' });
    } finally { setSavingTemplate(false); }
  }

  /* ── Send Test (uses outlook-send) ── */
  async function handleSendTest() {
    if (!testEmail.trim()) return;
    setSaving(true);
    try {
      let html = generateEmailHtml(blocks, settings, true);
      // Resolve sample merge tags for the test
      for (const [tag, val] of Object.entries(sampleData)) {
        html = html.replace(new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g'), val);
      }
      const subject = (settings.subject || name).replace(/\{\{[^}]+\}\}/g, (m: string) => sampleData[m] || m);
      const { error } = await supabase.functions.invoke('outlook-send', {
        body: { to: testEmail.trim(), subject: `[TEST] ${subject}`, html, person_id: null, case_id: null },
      });
      if (error) {
        const ctx = (error as any).context;
        let msg = error.message;
        try { const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null; if (body?.error) msg = body.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      alert(`Test email sent to ${testEmail.trim()}.`, { description: 'Test sent' });
      setShowTestModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to send test email. Make sure your Outlook account is connected in Settings.', { description: 'Send failed' });
    } finally { setSaving(false); }
  }

  return (
    <div className={`eb-root${isPreview ? ' eb-preview-active' : ''}`}>
      {/* Topbar */}
      <div className="eb-topbar">
        <button
          className="row-action-btn"
          onClick={() => {
            if (isPreview) { setIsPreview(false); return; }
            navigate(mode === 'system' ? '/settings?tab=email_templates' : '/communications');
          }}
          title={isPreview ? 'Back to editing' : 'Back'}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="eb-topbar-sep" />
        <input
          className="eb-topbar-title"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={mode === 'campaign' ? 'Campaign name…' : mode === 'system' ? 'System email name…' : 'Template name…'}
          disabled={mode === 'system'}
          title={mode === 'system' ? 'System email names are fixed' : undefined}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 2, marginRight: 4 }}>
            <button className="row-action-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ opacity: canUndo ? 1 : 0.3 }}><Undo2 size={15} /></button>
            <button className="row-action-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" style={{ opacity: canRedo ? 1 : 0.3 }}><Redo2 size={15} /></button>
          </div>
          {localStorage.getItem('eb-clipboard') && (
            <Button variant="ghost" size="sm" onClick={pasteBlock}><Clipboard size={14} /> Paste</Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setShowTestModal(true)}>
            <Send size={14} /> Send Test
          </Button>
          <Button
            variant={justSaved ? 'primary' : 'primary'}
            size="sm"
            onClick={() => handleSave(false)}
            disabled={saving}
            style={justSaved ? { background: '#2E7D5B', border: '1px solid #2E7D5B' } : undefined}
          >
            {saving ? 'Saving…' : justSaved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save</>}
          </Button>
          {mode === 'campaign' && (
            <Button variant="ghost" size="sm" onClick={openSaveAsTemplate} disabled={saving}>
              <FileText size={14} /> Save as template
            </Button>
          )}
          {mode === 'campaign' && (
            <Button variant="primary" size="sm" onClick={() => handleSave(true)} disabled={saving}>
              <Send size={14} /> Save & Continue
            </Button>
          )}
          <Button
            variant={isPreview ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setIsPreview(p => !p)}
          >
            <Eye size={14} /> {isPreview ? 'Editing' : 'Preview'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="eb-body">
        {!isPreview && <div className="eb-left">
          <div className="eb-left-header">Content Blocks</div>
          <div className="eb-left-scroll">
            {BLOCK_GROUPS.map(group => (
              <div key={group.label} className="eb-palette-group">
                <div className="eb-palette-group-label">{group.label}</div>
                {group.blocks.map(({ type, label, icon: BIcon }) => (
                  <button key={type} className="eb-palette-item" draggable onDragStart={e => handlePaletteDragStart(e, type)} onClick={() => addBlock(type)}>
                    <span className="eb-palette-icon"><BIcon size={14} /></span> {label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>}

        {/* Canvas */}
        <div className="eb-canvas">
          {isPreview ? (
            <PreviewMode blocks={blocks} settings={settings} onExit={() => setIsPreview(false)} sampleDataOverride={sampleData} />
          ) : (
            <div className="eb-canvas-scroll">
              <div className="eb-canvas-body">
                <div className="eb-email-frame" style={{ maxWidth: settings.width || 600, margin: '0 auto', background: settings.contentBg || '#fff', fontFamily: settings.fontFamily || 'inherit', color: settings.textColor || 'inherit' }}>
                  {settings.logoUrl && <div className="eb-email-header" onClick={() => { setShowSettings(true); setSelectedId(null); }}><img src={settings.logoUrl} alt="Logo" style={{ maxHeight: 40, maxWidth: '50%' }} /></div>}
                  <div className="eb-email-content"
                    onDragOver={e => { e.preventDefault(); if (blocks.length === 0) setIsCanvasDragOver(true); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsCanvasDragOver(false); }}
                  >
                    {blocks.length === 0 ? (
                      <div className={`eb-canvas-empty${isCanvasDragOver ? ' drag-over' : ''}`}
                        onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); e.stopPropagation(); handleCanvasDrop(e); }}>
                        <Plus size={32} style={{ opacity: .4 }} />
                        <h3 style={{ fontSize: 15, fontWeight: 600, margin: '8px 0 4px' }}>Add content to your email</h3>
                        <p style={{ fontSize: 13, maxWidth: 300, lineHeight: 1.5, color: 'var(--color-text-tertiary)' }}>Drag blocks from the left panel or click to add them.</p>
                      </div>
                    ) : (
                      <>
                        {blocks.map((block, idx) => (
                          <div key={block.id}>
                            {dropTargetIdx === idx && dropPosition === 'above' && <div className="eb-drop-indicator" />}
                            <div className={`eb-block${selectedId === block.id ? ' selected' : ''}${dragSrcRef.current === idx ? ' eb-block--dragging' : ''}`}
                              onClick={() => { setSelectedId(block.id); setShowSettings(false); setSelectedSubBlock(null); }}
                              draggable onDragStart={e => handleBlockDragStart(e, idx)} onDragEnd={handleBlockDragEnd}
                              onDragOver={e => handleBlockDragOver(e, idx)} onDrop={e => handleBlockDrop(e, idx)}>
                              <div className="eb-block-handle"><GripVertical size={14} /></div>
                              <div className="eb-block-actions">
                                <button className="row-action-btn" onClick={e => { e.stopPropagation(); copyBlock(block.id); }} title="Copy"><Clipboard size={12} /></button>
                                <button className="row-action-btn" onClick={e => { e.stopPropagation(); duplicateBlock(block.id); }} title="Duplicate"><Copy size={12} /></button>
                                <button className="row-action-btn danger" onClick={e => { e.stopPropagation(); deleteBlock(block.id); }} title="Delete"><Trash2 size={12} /></button>
                              </div>
                              <BlockPreview block={block} isPreview={false} onColumnDrop={addBlockToColumn} globalSettings={settings} customData={sampleData}
                                onSubBlockSelect={(pid, ci, bid) => { setSelectedId(pid); setSelectedSubBlock({ parentId: pid, colIdx: ci, blockId: bid }); setShowSettings(false); }}
                                selectedSubBlockId={selectedSubBlock?.blockId} />
                            </div>
                            {dropTargetIdx === idx && dropPosition === 'below' && <div className="eb-drop-indicator" />}
                          </div>
                        ))}
                        <div style={{ minHeight: 40 }} onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={e => { e.preventDefault(); e.stopPropagation(); const d = e.dataTransfer.getData('text/plain'); if (d && d !== '__reorder__') addBlock(d); }} />
                      </>
                    )}
                  </div>
                  {settings.footerText && <div className="eb-email-footer" onClick={() => { setShowSettings(true); setSelectedId(null); }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(replaceMergeTags(settings.footerText, false, sampleData)) }} />}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        {!isPreview && <div className="eb-right">
          {showSettings || !selectedBlock ? (
            showSettings ? <GlobalSettingsPanel settings={settings} onUpdate={setSettings} /> : (
              <div className="eb-right-empty">
                <Settings size={32} style={{ opacity: .3 }} />
                <div><div style={{ fontWeight: 600, marginBottom: 4 }}>Select a block</div><div style={{ fontSize: 13, lineHeight: 1.5 }}>Click any block to edit, or</div></div>
                <button className="btn-secondary" onClick={() => setShowSettings(true)}><Settings size={14} /> Email Settings</button>
              </div>
            )
          ) : selectedSubBlockObj ? (
            // `key` forces a fresh mount when switching sub-blocks so Quill's
            // internal state (and any other stateful editors) can't bleed
            // into the next block's `content`.
            <BlockEditPanel
              key={selectedSubBlockObj.id}
              block={selectedSubBlockObj}
              onUpdate={patch => updateSubBlock(selectedSubBlock!.parentId, selectedSubBlock!.colIdx, selectedSubBlock!.blockId, patch)}
              onDelete={() => deleteSubBlock(selectedSubBlock!.parentId, selectedSubBlock!.colIdx, selectedSubBlock!.blockId)}
              onBack={() => setSelectedSubBlock(null)} />
          ) : (
            <BlockEditPanel key={selectedBlock.id} block={selectedBlock} onUpdate={patch => updateBlock(selectedBlock.id, patch)} onDelete={() => deleteBlock(selectedBlock.id)} />
          )}
        </div>}
      </div>

      {/* Send-test modal — inline-styled to bypass the chunky .eb-root
          form/button styles and match the design system (ConfirmModal). */}
      {showTestModal && (
        <>
          <div
            onClick={() => setShowTestModal(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(26,26,26,0.45)',
              zIndex: 9998, backdropFilter: 'blur(3px)',
            }}
          />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 420, maxWidth: 'calc(100vw - 32px)',
              background: '#fff', borderRadius: 16, zIndex: 9999,
              boxShadow: '0 20px 60px rgba(75,0,130,0.18), 0 4px 16px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 22px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{
                fontFamily: 'Urbanist, Inter, sans-serif',
                fontSize: 16, fontWeight: 700, color: '#1A1A1A',
              }}>
                Send test email
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                aria-label="Close"
                style={{
                  background: 'transparent', border: 0, cursor: 'pointer',
                  padding: 4, color: '#5A6670', display: 'inline-flex', borderRadius: 6,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '6px 22px 4px' }}>
              <label
                htmlFor="eb-test-recipient"
                style={{
                  display: 'block', fontSize: 11, fontWeight: 600, color: '#5A6670',
                  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
                }}
              >
                Recipient email
              </label>
              <input
                id="eb-test-recipient"
                type="email"
                autoFocus
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 12px', fontSize: 14, fontFamily: 'inherit',
                  border: '1px solid #E1E5E8', borderRadius: 8,
                  outline: 'none', background: '#fff',
                }}
              />
              <div style={{ fontSize: 12, color: '#8A929B', marginTop: 8, lineHeight: 1.45 }}>
                Sends a one-off preview from your connected Outlook mailbox. Merge fields use sample values.
              </div>
            </div>

            <div style={{
              padding: '14px 22px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              <Button variant="ghost" size="sm" onClick={() => setShowTestModal(false)} disabled={saving}>Cancel</Button>
              <Button variant="primary" size="sm" icon="send" onClick={handleSendTest} disabled={!testEmail.trim() || saving}>
                {saving ? 'Sending…' : 'Send test'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Save as template modal */}
      {showSaveAsTemplateModal && (
        <div className="eb-test-modal-overlay" onClick={() => setShowSaveAsTemplateModal(false)}>
          <div className="eb-test-modal" onClick={e => e.stopPropagation()}>
            <div className="eb-test-modal-header">
              <h3>Save as template</h3>
              <button className="row-action-btn" onClick={() => setShowSaveAsTemplateModal(false)}><X size={16} /></button>
            </div>
            <div className="eb-test-modal-body">
              <div className="form-group">
                <label>Template name</label>
                <input className="form-input" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Monthly newsletter" autoFocus />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <input className="form-input" value={templateDescription} onChange={e => setTemplateDescription(e.target.value)} placeholder="When should someone use this template?" />
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Snapshots the current design. Future edits to this campaign won't change the template (and vice versa).</p>
            </div>
            <div className="eb-test-modal-footer">
              <button className="btn-secondary" onClick={() => setShowSaveAsTemplateModal(false)}>Cancel</button>
              <button className="btn-secondary" style={{ background: BRAND, color: '#fff', borderColor: BRAND }}
                disabled={!templateName.trim() || savingTemplate} onClick={handleSaveAsTemplate}>
                {savingTemplate ? 'Saving…' : <><FileText size={14} /> Save template</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send drawer — opens in-place over the builder when "Save & Continue"
          is clicked. After a successful send we leave the builder for the
          campaigns list (the campaign is "sent" status and shouldn't be
          edited further). Cancel just closes the drawer and stays here. */}
      {sendDrawerCampaignId && (
        <CampaignSendDrawer
          campaignId={sendDrawerCampaignId}
          onClose={() => setSendDrawerCampaignId(null)}
          onSent={() => {
            setSendDrawerCampaignId(null);
            navigate('/communications');
          }}
        />
      )}
    </div>
  );
}

