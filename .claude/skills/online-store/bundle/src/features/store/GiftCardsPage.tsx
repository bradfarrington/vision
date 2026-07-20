import { useState, useEffect } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { StoreTabBar } from './StoreTabBar';
import { useAlert } from '@/components/ui/AlertDialog';
import * as api from '@/lib/api';
import type { GiftCard, GiftCardInsert, GiftCardDesignTemplate } from '@/types/database';
import { Plus, Trash2, X, Gift, ChevronDown } from 'lucide-react';
import { GiftCardDesign, DESIGN_OPTIONS, getDesignLabel } from './GiftCardDesign';
import './Discounts.css';
import './GiftCardDesign.css';

type ExpiryOption = '6' | '12' | '24';
const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '6', label: '6 Months' },
  { value: '12', label: '12 Months' },
  { value: '24', label: '24 Months' },
];

function expiryMonthsToDate(months: ExpiryOption): string {
  const d = new Date();
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString();
}

function dateToExpiryMonths(dateStr: string | null): ExpiryOption {
  if (!dateStr) return '12';
  const diff = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
  if (diff <= 8) return '6';
  if (diff <= 18) return '12';
  return '24';
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  for (let s = 0; s < 4; s++) {
    let seg = '';
    for (let c = 0; c < 4; c++) {
      seg += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(seg);
  }
  return segments.join('-');
}

export function GiftCardsPage() {
  const { showAlert } = useAlert();
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formBalance, setFormBalance] = useState('');
  const [formPurchaserEmail, setFormPurchaserEmail] = useState('');
  const [formRecipientEmail, setFormRecipientEmail] = useState('');
  const [formRecipientName, setFormRecipientName] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formExpiryMonths, setFormExpiryMonths] = useState<ExpiryOption>('12');
  const [formDesign, setFormDesign] = useState<GiftCardDesignTemplate>('classic');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    api.fetchGiftCards()
      .then(setCards)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setFormCode(generateCode());
    setFormBalance('');
    setFormPurchaserEmail('');
    setFormRecipientEmail('');
    setFormRecipientName('');
    setFormMessage('');
    setFormExpiryMonths('12');
    setFormDesign('classic');
    setEditingId(null);
    setShowForm(false);
  };

  const openNewForm = () => {
    resetForm();
    setFormCode(generateCode());
    setShowForm(true);
  };

  const populateForm = (gc: GiftCard) => {
    setFormCode(gc.code);
    setFormBalance(String(gc.current_balance));
    setFormPurchaserEmail(gc.purchaser_email || '');
    setFormRecipientEmail(gc.recipient_email || '');
    setFormRecipientName(gc.recipient_name || '');
    setFormMessage(gc.message || '');
    setFormExpiryMonths(dateToExpiryMonths(gc.expires_at));
    setFormDesign((gc.design_template as GiftCardDesignTemplate) || 'classic');
    setEditingId(gc.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formCode || !formBalance) return;

    const balance = Number(formBalance);

    try {
      if (editingId) {
        const updated = await api.updateGiftCard(editingId, {
          code: formCode.toUpperCase(),
          current_balance: balance,
          purchaser_email: formPurchaserEmail || null,
          recipient_email: formRecipientEmail || null,
          recipient_name: formRecipientName || null,
          message: formMessage || null,
          expires_at: expiryMonthsToDate(formExpiryMonths),
          design_template: formDesign,
        });
        setCards((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        showAlert({ title: 'Updated', message: 'Gift card updated.', variant: 'success' });
      } else {
        const created = await api.createGiftCard({
          code: formCode.toUpperCase(),
          initial_balance: balance,
          current_balance: balance,
          purchaser_email: formPurchaserEmail || null,
          recipient_email: formRecipientEmail || null,
          recipient_name: formRecipientName || null,
          message: formMessage || null,
          expires_at: expiryMonthsToDate(formExpiryMonths),
          design_template: formDesign,
          is_active: true,
        } as GiftCardInsert);
        setCards((prev) => [created, ...prev]);
        showAlert({ title: 'Created', message: 'Gift card created.', variant: 'success' });
      }
      resetForm();
    } catch (err) {
      console.error(err);
      showAlert({ title: 'Error', message: 'Failed to save gift card.', variant: 'danger' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteGiftCard(id);
      setCards((prev) => prev.filter((c) => c.id !== id));
      showAlert({ title: 'Deleted', message: 'Gift card deleted.', variant: 'success' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (gc: GiftCard) => {
    try {
      const updated = await api.updateGiftCard(gc.id, { is_active: !gc.is_active });
      setCards((prev) => prev.map((c) => (c.id === gc.id ? updated : c)));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <PageShell title="Online Store" subtitle="Manage gift cards for your store.">
      <StoreTabBar />

      <div className="discounts-header">
        <h2>Gift Cards</h2>
        <button className="btn btn-primary" onClick={openNewForm}>
          <Plus size={16} /> New Gift Card
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="discount-form-card">
          <div className="discount-form-card-header">
            <h3>{editingId ? 'Edit Gift Card' : 'New Gift Card'}</h3>
            <button className="btn btn-ghost btn-icon-sm" onClick={resetForm}><X size={16} /></button>
          </div>

          <div className="gc-form-layout">
            {/* Left: Form fields */}
            <div>
              {/* Design picker */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Card Design</label>
                <div className="gc-design-picker">
                  {DESIGN_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`gc-design-picker-option ${formDesign === d ? 'active' : ''}`}
                      onClick={() => setFormDesign(d)}
                    >
                      <GiftCardDesign
                        design={d}
                        balance={Number(formBalance) || 50}
                        code={formCode}
                        recipientName={formRecipientName}
                        compact
                      />
                      <span className="gc-design-picker-label">{getDesignLabel(d)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="discount-form-grid">
                <div className="form-group">
                  <label className="form-label">Code</label>
                  <input className="form-input" value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">Balance (£)</label>
                  <input className="form-input" type="number" value={formBalance} onChange={(e) => setFormBalance(e.target.value)} placeholder="50.00" min="0" step="0.01" />
                </div>
                <div className="form-group">
                  <label className="form-label">Purchaser Email</label>
                  <input className="form-input" type="email" value={formPurchaserEmail} onChange={(e) => setFormPurchaserEmail(e.target.value)} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Recipient Email</label>
                  <input className="form-input" type="email" value={formRecipientEmail} onChange={(e) => setFormRecipientEmail(e.target.value)} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Recipient Name</label>
                  <input className="form-input" value={formRecipientName} onChange={(e) => setFormRecipientName(e.target.value)} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Expires In</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {EXPIRY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`btn ${formExpiryMonths === opt.value ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFormExpiryMonths(opt.value)}
                        style={{ flex: 1 }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Personal Message</label>
                  <textarea className="form-input form-textarea" value={formMessage} onChange={(e) => setFormMessage(e.target.value)} placeholder="Optional gift message..." rows={2} />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={handleSave}>
                  {editingId ? 'Update' : 'Create'} Gift Card
                </button>
                <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              </div>
            </div>

            {/* Right: Live preview */}
            <div className="gc-form-preview">
              <span className="gc-form-preview-label">Live Preview</span>
              <GiftCardDesign
                design={formDesign}
                balance={Number(formBalance) || 0}
                code={formCode}
                recipientName={formRecipientName}
                message={formMessage}
              />
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="store-loading">Loading gift cards...</div>
      ) : cards.length === 0 ? (
        <div className="module-placeholder">
          <div className="module-placeholder-icon"><Gift size={48} /></div>
          <h3>No Gift Cards</h3>
          <p>Create gift cards to offer as presents or store credit.</p>
        </div>
      ) : (
        <div className="products-table-wrap">
          <table className="products-table giftcards-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Design</th>
                <th>Initial</th>
                <th>Balance</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cards.map((gc) => (
                <tr 
                  key={gc.id}
                  className={`products-table-row ${expandedCards.has(gc.id) ? 'expanded' : 'collapsed'}`}
                  onClick={() => {
                    if (window.innerWidth <= 768) {
                      setExpandedCards((prev) => {
                        const next = new Set(prev);
                        if (next.has(gc.id)) next.delete(gc.id);
                        else next.add(gc.id);
                        return next;
                      });
                    }
                  }}
                >
                  <td className="product-name-cell" data-label="Gift Card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="product-name">{gc.code}</span>
                      </div>
                      <button
                        className="mobile-expand-toggle"
                        onClick={(e) => toggleExpand(gc.id, e)}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>

                    <div className="mobile-preview-pills">
                      <span className="preview-pill">
                        £{Number(gc.current_balance).toFixed(2)}
                      </span>
                      <span className={`stock-badge ${gc.is_active ? 'good' : 'out'}`}>
                        {gc.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="mobile-only-detail">
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          populateForm(gc);
                        }}
                      >
                        Edit Card
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(gc.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                  <td data-label="Design" className="mobile-secondary-detail">
                    <div className="gc-table-preview">
                      <GiftCardDesign
                        design={(gc.design_template as GiftCardDesignTemplate) || 'classic'}
                        balance={Number(gc.current_balance)}
                        code={gc.code}
                        recipientName={gc.recipient_name || undefined}
                        compact
                      />
                    </div>
                  </td>
                  <td data-label="Initial" className="mobile-secondary-detail">£{Number(gc.initial_balance).toFixed(2)}</td>
                  <td data-label="Balance" className="mobile-secondary-detail">
                    <strong style={{ color: gc.current_balance > 0 ? '#22c55e' : '#ef4444' }}>
                      £{Number(gc.current_balance).toFixed(2)}
                    </strong>
                  </td>
                  <td data-label="Recipient" className="mobile-secondary-detail">{gc.recipient_name || gc.recipient_email || '—'}</td>
                  <td data-label="Status" className="mobile-secondary-detail">
                    <button
                      className={`btn btn-ghost btn-sm ${gc.is_active ? 'text-success' : 'text-muted'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(gc);
                      }}
                    >
                      {gc.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td data-label="Expires" className="mobile-secondary-detail">{gc.expires_at ? new Date(gc.expires_at).toLocaleDateString('en-GB') : '—'}</td>
                  <td data-label="Actions" className="mobile-secondary-detail desktop-only">
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-icon-sm" onClick={(e) => { e.stopPropagation(); populateForm(gc); }} title="Edit">✎</button>
                      <button className="btn btn-ghost btn-icon-sm text-danger" onClick={(e) => { e.stopPropagation(); handleDelete(gc.id); }} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
