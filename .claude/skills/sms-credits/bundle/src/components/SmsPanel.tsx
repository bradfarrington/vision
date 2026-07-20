import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, Icon, Overline, Button } from './ui/primitives';

const CREDIT_PACKAGES = [
  { credits: 50,  pricePence: 500,  price: '£5.00'  },
  { credits: 100, pricePence: 1000, price: '£10.00' },
  { credits: 250, pricePence: 2500, price: '£25.00' },
  { credits: 500, pricePence: 5000, price: '£50.00' },
];

type Toast = { kind: 'success' | 'error' | 'info'; text: string } | null;

interface Purchase {
  id: string;
  credits_purchased: number;
  amount_paid_pence: number;
  status: string;
  created_at: string;
}

const PURPLE = '#4B0082';
const PURPLE_DEEP = '#38005F';
const PURPLE_SOFT = '#F5F0FA';
const MUTED  = '#5A6670';
const BORDER = '#E1E5E8';
const ROW_BORDER = '#EEF1F3';

/* ----- inline iOS-style toggle ----- */
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 44, height: 26,
        borderRadius: 999,
        background: checked ? PURPLE : '#D5D9DC',
        position: 'relative',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 180ms ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3, left: checked ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
          transition: 'left 180ms ease',
        }}
      />
    </button>
  );
}

export default function SmsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);
  const [toast, setToast]     = useState<Toast>(null);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [form, setForm] = useState({
    sms_enabled: false,
    sms_sender_name: '',
    org_name: 'GamLEARN',
  });

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [buyingCredits, setBuyingCredits] = useState(false);

  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const showToast = (kind: 'success' | 'error' | 'info', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('org_settings')
      .select('id, org_name, sms_enabled, sms_sender_name, sms_credits_balance')
      .limit(1)
      .maybeSingle();

    if (data) {
      setOrgId(data.id);
      setBalance(data.sms_credits_balance || 0);
      setForm({
        sms_enabled: !!data.sms_enabled,
        sms_sender_name: data.sms_sender_name || '',
        org_name: data.org_name || 'GamLEARN',
      });
    }
  };

  const fetchPurchases = async () => {
    const { data } = await supabase
      .from('sms_credit_purchases')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);
    setPurchases(data || []);
  };

  useEffect(() => {
    (async () => {
      await Promise.all([fetchSettings(), fetchPurchases()]);
      setLoading(false);
    })();

    const params = new URLSearchParams(window.location.search);
    if (params.get('purchase') === 'success') {
      showToast('success', 'SMS credits purchased successfully!');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const updateField = (field: keyof typeof form, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    const name = form.sms_sender_name.trim();
    if (name && (name.length > 11 || !/^[a-zA-Z0-9 ]+$/.test(name))) {
      showToast('error', 'Sender name must be 1–11 alphanumeric characters.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        sms_enabled: form.sms_enabled,
        sms_sender_name: name,
        org_name: form.org_name.trim() || 'GamLEARN',
        updated_at: new Date().toISOString(),
      };

      if (orgId) {
        const { error } = await supabase.from('org_settings').update(payload).eq('id', orgId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('org_settings').insert(payload).select().single();
        if (error) throw error;
        if (data) setOrgId(data.id);
      }

      showToast('success', 'SMS settings saved.');
      setDirty(false);
      await fetchSettings();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  // When functions.invoke gets a non-2xx, `error.message` is just
  // "Edge Function returned a non-2xx status code". The actual server
  // error lives in error.context (a Response). Extract it.
  async function extractFunctionError(error: any): Promise<string> {
    try {
      const ctx = error?.context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        return body?.error || body?.message || JSON.stringify(body);
      }
      if (ctx && typeof ctx.text === 'function') {
        return await ctx.text();
      }
    } catch { /* fall through */ }
    return error?.message || 'Unknown error';
  }

  const handleBuyCredits = async (credits: number) => {
    setBuyingCredits(true);
    try {
      const { data, error } = await supabase.functions.invoke('sms-credits', {
        body: {
          action: 'createCheckout',
          credits,
          successUrl: `${window.location.origin}/settings?purchase=success`,
          cancelUrl: `${window.location.origin}/settings?purchase=cancelled`,
        },
      });
      if (error) throw new Error(await extractFunctionError(error));
      if (data?.error) throw new Error(data.error);
      if (!data?.checkoutUrl) throw new Error('No checkout URL returned');
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      showToast('error', err.message || 'Buy credits flow unavailable.');
      setBuyingCredits(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      showToast('error', 'Enter a phone number to send a test SMS.');
      return;
    }
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { action: 'test', phone: testPhone.trim() },
      });
      if (error) throw new Error(await extractFunctionError(error));
      if (data?.error) throw new Error(data.error);
      showToast('success', `Test SMS sent. Credits remaining: ${data.creditsRemaining}`);
      await fetchSettings();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to send test SMS.');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div style={{ padding: 16, color: MUTED, fontSize: 13 }}>Loading SMS settings…</div>
      </Card>
    );
  }

  const lowCredits = balance > 0 && balance <= 10;
  const noCredits = balance === 0;

  // Standard input style
  const inputStyle: React.CSSProperties = {
    width: '100%', height: 38, padding: '0 12px',
    border: '1px solid ' + BORDER, borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', color: '#1A1A1A',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && (
        <div
          style={{
            padding: '10px 14px', borderRadius: 10,
            fontSize: 13, fontWeight: 500,
            background:
              toast.kind === 'success' ? '#E6F1EC' :
              toast.kind === 'error'   ? '#F8E3E0' : '#E3EDF5',
            color:
              toast.kind === 'success' ? '#2E7D5B' :
              toast.kind === 'error'   ? '#C0392B' : '#1F4A6E',
            border: '1px solid ' + (
              toast.kind === 'success' ? '#C6E0D2' :
              toast.kind === 'error'   ? '#EAC3BD' : '#C3D5E5'
            ),
          }}
        >
          {toast.text}
        </div>
      )}

      {(lowCredits || noCredits) && (
        <div
          style={{
            padding: '12px 16px', borderRadius: 10, fontSize: 13,
            background: noCredits ? '#F8E3E0' : '#FBF1DE',
            color:      noCredits ? '#C0392B' : '#C9851A',
            border: '1px solid ' + (noCredits ? '#EAC3BD' : '#EFD9A8'),
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <Icon name="alert" size={16} color={noCredits ? '#C0392B' : '#C9851A'} />
          <span>
            {noCredits
              ? 'No credits remaining. SMS notifications will not send until you top up.'
              : `Low credits — only ${balance} remaining. Top up to avoid missed notifications.`}
          </span>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          MAIN GRID
            LEFT  → Configuration, then Top up credits
            RIGHT → Balance hero, then Send test
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>

        {/* ─── LEFT COLUMN ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Configuration */}
          <Card>
            <div style={{ marginBottom: 18 }}>
              <Overline>Configuration</Overline>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginTop: 4 }}>SMS settings</div>
            </div>

            {/* Toggle row */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 10,
                background: PURPLE_SOFT, border: '1px solid #E8DFF1',
                marginBottom: 18,
              }}
            >
              <Toggle checked={form.sms_enabled} onChange={v => updateField('sms_enabled', v)} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                  Enable SMS notifications
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                  Allow the system to send SMS messages.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>Sender name / ID</div>
                <input
                  value={form.sms_sender_name}
                  onChange={e => updateField('sms_sender_name', e.target.value)}
                  placeholder="GamLEARN"
                  maxLength={11}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                  {(form.sms_sender_name || '').length}/11 — letters and numbers only.
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>Organisation name</div>
                <input
                  value={form.org_name}
                  onChange={e => updateField('org_name', e.target.value)}
                  placeholder="GamLEARN"
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                  Used as <code style={{ background: '#F4F4F6', padding: '1px 5px', borderRadius: 4 }}>{'{{org_name}}'}</code> in templates.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" size="sm" icon="check" onClick={handleSave} disabled={saving || !dirty}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </Card>

          {/* Top up credits */}
          <Card>
            <div style={{ marginBottom: 14 }}>
              <Overline>Top up</Overline>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginTop: 4 }}>Buy SMS credits</div>
            </div>

            <div id="sms-buy-credits" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {CREDIT_PACKAGES.map(pkg => {
                const popular = pkg.credits === 250;
                return (
                  <div
                    key={pkg.credits}
                    style={{
                      position: 'relative',
                      border: '1px solid ' + (popular ? PURPLE : BORDER),
                      borderRadius: 12,
                      padding: '18px 12px 12px',
                      textAlign: 'center',
                      background: popular ? `linear-gradient(180deg, ${PURPLE_SOFT} 0%, #fff 100%)` : '#fff',
                      boxShadow: popular ? '0 4px 12px rgba(75,0,130,0.10)' : 'none',
                    }}
                  >
                    {popular && (
                      <span
                        style={{
                          position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
                          background: PURPLE, color: '#fff',
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                          padding: '3px 9px', borderRadius: 999,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Best value
                      </span>
                    )}
                    <div style={{ fontFamily: 'Urbanist, Inter, sans-serif', fontSize: 26, fontWeight: 700, color: '#1A1A1A', lineHeight: 1, letterSpacing: '-0.02em' }}>
                      {pkg.credits}
                    </div>
                    <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>
                      credits
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: PURPLE, margin: '8px 0 10px' }}>{pkg.price}</div>
                    <Button
                      variant={popular ? 'primary' : 'secondary'}
                      size="sm"
                      fullWidth
                      onClick={() => handleBuyCredits(pkg.credits)}
                      disabled={buyingCredits}
                    >
                      {buyingCredits ? '…' : 'Buy'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Balance hero (vertical layout for narrow column) */}
          <div
            style={{
              background: `linear-gradient(160deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
              borderRadius: 16,
              padding: '22px 22px 20px',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(75,0,130,0.18)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.85, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <Icon name="message" size={13} color="#fff" />
              Credit balance
            </div>
            <div>
              <div style={{ fontFamily: 'Urbanist, Inter, sans-serif', fontSize: 56, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}>
                {balance}
              </div>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
                credits remaining
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span
                style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  background: form.sms_enabled ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: form.sms_enabled ? '#7CE0A1' : '#E5A0A0' }} />
                {form.sms_enabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={() => document.getElementById('sms-buy-credits')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                style={{
                  background: '#fff', color: PURPLE, border: 'none',
                  borderRadius: 8, padding: '7px 12px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'inherit',
                }}
              >
                <Icon name="plus" size={13} color={PURPLE} />
                Top up
              </button>
            </div>
          </div>

          {/* Send test */}
          <Card>
            <Overline>Test message</Overline>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginTop: 4, marginBottom: 14 }}>
              Send a test SMS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="+44 7700 900123"
                style={inputStyle}
              />
              <Button
                variant="primary"
                size="sm"
                icon="send"
                fullWidth
                onClick={handleSendTest}
                disabled={sendingTest || !testPhone.trim() || balance < 1 || !form.sms_enabled}
              >
                {sendingTest ? 'Sending…' : 'Send test'}
              </Button>
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
                {!form.sms_enabled
                  ? 'Enable SMS first to send a test.'
                  : balance < 1
                    ? 'You need at least 1 credit.'
                    : 'Sends a test message. Costs 1 credit.'}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PURCHASE HISTORY
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div>
        <Overline style={{ marginBottom: 10 }}>Purchase history</Overline>
        <Card padded={false}>
          {purchases.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: MUTED, fontSize: 13 }}>
              No purchases yet. Buy credits above to get started.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid ' + ROW_BORDER, fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid ' + ROW_BORDER, fontWeight: 600 }}>Credits</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid ' + ROW_BORDER, fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid ' + ROW_BORDER, fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p, i) => (
                  <tr key={p.id}>
                    <td style={{ padding: '10px 16px', borderBottom: i < purchases.length - 1 ? '1px solid ' + ROW_BORDER : 'none', color: '#1A1A1A' }}>
                      {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '10px 16px', borderBottom: i < purchases.length - 1 ? '1px solid ' + ROW_BORDER : 'none', color: '#1A1A1A', fontWeight: 600 }}>
                      {p.credits_purchased}
                    </td>
                    <td style={{ padding: '10px 16px', borderBottom: i < purchases.length - 1 ? '1px solid ' + ROW_BORDER : 'none', color: '#1A1A1A' }}>
                      £{(p.amount_paid_pence / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 16px', borderBottom: i < purchases.length - 1 ? '1px solid ' + ROW_BORDER : 'none' }}>
                      <span
                        style={{
                          padding: '3px 10px', borderRadius: 999,
                          background: '#E6F1EC', color: '#2E7D5B',
                          fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
