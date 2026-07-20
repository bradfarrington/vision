import { useEffect, useState } from 'react';
import { Icon, Button } from '../../components/ui/primitives';
import { Dropdown } from '../../components/ui/Dropdown';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Props {
  campaignId: string;
  onClose: () => void;
  /** Called after a successful send instead of onClose, so the caller can
      navigate / refresh / etc. If omitted, onClose is used after send too. */
  onSent?: () => void;
}

interface Campaign {
  id: string;
  name: string;
  subject: string | null;
  status: string;
  list_id: string | null;
}

interface ListOption { id: string; name: string; count: number; }

export default function CampaignSendDrawer({ campaignId, onClose, onSent }: Props) {
  const { alert, confirm } = useConfirm();
  const { profile } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [listId, setListId] = useState('');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [fromAddress, setFromAddress] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Pre-fill test email with the current user's address once the profile loads.
  useEffect(() => {
    if (profile?.email && !testEmail) setTestEmail(profile.email);
  }, [profile?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: l }, { data: org }] = await Promise.all([
        supabase.from('comms_campaigns').select('id, name, subject, status, list_id').eq('id', campaignId).single(),
        supabase.from('comms_lists').select('id, name, count').order('name'),
        supabase.from('org_settings').select('campaign_from_email').limit(1).maybeSingle(),
      ]);
      if (c) {
        setCampaign(c as Campaign);
        setListId(c.list_id || '');
      }
      if (l) setLists(l as ListOption[]);
      setFromAddress(org?.campaign_from_email || null);
      setLoading(false);
    })();
  }, [campaignId]);

  // Recompute recipient count when list changes
  useEffect(() => {
    if (!listId) { setRecipientCount(null); return; }
    (async () => {
      const { count } = await supabase
        .from('comms_list_members')
        .select('person_id', { count: 'exact', head: true })
        .eq('list_id', listId);
      setRecipientCount(count ?? 0);
    })();
  }, [listId]);

  async function handleSendTest() {
    if (!campaign) return;
    const to = testEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      await alert('Enter a valid email address.', { description: 'Test email' });
      return;
    }
    if (!fromAddress) {
      await alert(
        'Set the campaign From address in Settings → Organisation → Email marketing before sending a test.',
        { description: 'From address missing' },
      );
      return;
    }
    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('send-campaign', {
        body: { campaign_id: campaign.id, test_email: to },
      });
      if (error) {
        let msg = error.message;
        try { const ctx = (error as any).context; if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; } } catch { /* ignore */ }
        throw new Error(msg);
      }
      await alert(`Test email sent to ${to}.`, { description: 'Test sent' });
    } catch (err: any) {
      await alert(err.message || 'Failed to send test email.', { description: 'Test failed' });
    } finally { setSendingTest(false); }
  }

  async function handleSend() {
    if (!campaign || !listId) return;
    if (!fromAddress) {
      await alert(
        'Set the campaign From address in Settings → Organisation → Email marketing before sending.',
        { description: 'From address missing' },
      );
      return;
    }
    const ok = await confirm(`Send "${campaign.name}" to ${recipientCount || 0} recipient${recipientCount === 1 ? '' : 's'}?`, {
      description: `From: ${fromAddress}. Sending runs in the background — you'll get a bell notification when it finishes.`,
      confirmLabel: 'Send now',
    });
    if (!ok) return;
    setSending(true);
    try {
      // Persist list selection on the campaign first.
      const { error: listErr } = await supabase.from('comms_campaigns').update({
        list_id: listId,
      }).eq('id', campaign.id);
      if (listErr) throw listErr;

      // Fire the send and DON'T wait for the loop to finish — the edge
      // function flips status to 'sending' synchronously, kicks the actual
      // sends into a background task, and writes a bell notification when
      // it's done. So we just confirm the queue accepted the job and close.
      const { error } = await supabase.functions.invoke('send-campaign', {
        body: { campaign_id: campaign.id },
      });
      if (error) {
        let msg = error.message;
        try { const ctx = (error as any).context; if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; } } catch { /* ignore */ }
        throw new Error(msg);
      }
      // Close immediately — no need to block the UI on the send loop.
      (onSent ?? onClose)();
    } catch (err: any) {
      // Edge function rejected the job before queueing — roll status back.
      await supabase.from('comms_campaigns').update({ status: 'draft' }).eq('id', campaign.id);
      await alert(err.message || 'Failed to start campaign send.', { description: 'Send failed' });
    } finally { setSending(false); }
  }

  if (loading || !campaign) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={drawerStyle} onClick={e => e.stopPropagation()}>
          <div style={{ padding: 32, textAlign: 'center', color: '#5A6670' }}>Loading…</div>
        </div>
      </div>
    );
  }

  const listOptions = lists.map(l => ({ value: l.id, label: `${l.name} — ${l.count} ${l.count === 1 ? 'person' : 'people'}` }));

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={drawerStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Send campaign</h3>
            <div style={{ fontSize: 12, color: '#8A929B', marginTop: 4 }}>{campaign.name}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', color: '#5A6670' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Subject</label>
            <div style={{ fontSize: 14, color: '#1A1A1A', padding: '8px 0' }}>{campaign.subject || <span style={{ color: '#8A929B' }}>No subject set</span>}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>From</label>
            {fromAddress ? (
              <div style={{ fontSize: 14, color: '#1A1A1A', padding: '8px 0' }}>{fromAddress}</div>
            ) : (
              <div style={{ padding: 12, background: '#FFF8E1', border: '1px solid #F2C94C', borderRadius: 8, fontSize: 13, color: '#8A6600' }}>
                No campaign From address set. Configure it in Settings → Organisation → Email marketing.
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Mailing list</label>
            <Dropdown value={listId} onChange={setListId} options={listOptions} placeholder="Choose a list…" />
            {recipientCount !== null && (
              <div style={{ fontSize: 12, color: '#5A6670', marginTop: 6 }}>
                {recipientCount} {recipientCount === 1 ? 'person' : 'people'} on this list will receive the email.
                {recipientCount > 0 && ' People who have opted out of marketing will be skipped automatically.'}
              </div>
            )}
          </div>

          <div style={{ background: '#F5F0FA', border: '1px solid #E1D4F0', borderRadius: 8, padding: 12, fontSize: 12, color: '#4B0082' }}>
            <Icon name="info" size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Merge fields like the person's name will be filled in for each recipient.
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #EEF1F3' }}>
            <label style={labelStyle}>Send a test first</label>
            <div style={{ fontSize: 12, color: '#5A6670', marginBottom: 8 }}>
              Sends one email to the address below using sample data, prefixed with [TEST]. Nothing on the campaign changes.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #E1E5E8', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendTest}
                disabled={!testEmail.trim() || !fromAddress || sendingTest}>
                {sendingTest ? 'Sending…' : 'Send test'}
              </Button>
            </div>
          </div>
        </div>

        <div style={footerStyle}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="send"
            onClick={handleSend}
            disabled={!listId || !fromAddress || (recipientCount ?? 0) === 0 || sending}>
            {sending ? 'Sending…' : `Send to ${recipientCount ?? 0}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
  display: 'flex', justifyContent: 'flex-end',
};
const drawerStyle: React.CSSProperties = {
  width: 480, maxWidth: '90vw', background: '#fff',
  display: 'flex', flexDirection: 'column',
  boxShadow: '-12px 0 48px rgba(0,0,0,0.18)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px', borderBottom: '1px solid #EEF1F3',
};
const footerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 8,
  padding: '12px 20px', borderTop: '1px solid #EEF1F3',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6670',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
};
