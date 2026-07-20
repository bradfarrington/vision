import { useState, useEffect } from 'react';
import { useStoreConfig } from './useStoreConfig';
import { GiftCardDesign, DESIGN_OPTIONS, getDesignLabel } from '../store/GiftCardDesign';
import * as api from '@/lib/api';
import type { GiftCardDesignTemplate, GiftCardInsert } from '@/types/database';
import { Gift, CheckCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { sfPath } from './storefrontPaths';
import { supabase } from '@/lib/supabase';
import '../store/GiftCardDesign.css';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

let globalStripePromise: Promise<any> | null = null;
let hasRequestedStripe = false;

const DEFAULT_AMOUNTS = [25, 50, 75, 100, 150, 200];

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

function expiryMonthsToDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export function StorefrontGiftCards() {
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(() => globalStripePromise);
  const [loading, setLoading] = useState(!globalStripePromise);

  useEffect(() => {
    if (!globalStripePromise && !hasRequestedStripe) {
      hasRequestedStripe = true;
      api.getStripePublishableKey().then(key => {
        if (key) {
          globalStripePromise = loadStripe(key);
          setStripePromise(globalStripePromise);
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    } else if (globalStripePromise && !stripePromise) {
      setStripePromise(globalStripePromise);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [stripePromise]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '10vh' }}><div className="loading-spinner" /></div>;
  }

  return (
    <Elements stripe={stripePromise || null}>
      <StorefrontGiftCardsInner />
    </Elements>
  );
}

function StorefrontGiftCardsInner() {
  const { formatPrice, config } = useStoreConfig();
  const currencySymbol = config?.currency_symbol || '£';

  // Read template settings from builder
  const tpl = (config as any)?.page_templates?.gift_cards || {};
  const heroTitle = tpl.pageTitle || 'Gift Cards';
  const heroSubtitle = tpl.pageSubtitle || 'Give the perfect gift — let them choose what they love.';
  const presetAmounts: number[] = tpl.presetAmounts
    ? String(tpl.presetAmounts).split(',').map((s: string) => Number(s.trim())).filter((n: number) => n > 0)
    : DEFAULT_AMOUNTS;
  const minimumAmount = tpl.minimumAmount || 5;
  const buttonColor = tpl.buttonColor || undefined; // falls back to CSS var(--sf-primary)
  const buttonTextColor = tpl.buttonTextColor || '#ffffff';
  const buttonRadius = tpl.buttonRadius ?? undefined; // falls back to CSS
  const showDesignPicker = tpl.showDesignPicker !== false;
  const showPreview = tpl.showPreview !== false;
  const showCustomAmount = tpl.showCustomAmount !== false;
  const validityMonths = tpl.validityMonths || 12;

  const isTestMode = config?.test_mode === true;
  const stripe = useStripe();
  const elements = useElements();
  const stripeEnabled = !isTestMode && !!stripe && !!elements;

  // Form state
  const [selectedDesign, setSelectedDesign] = useState<GiftCardDesignTemplate>('classic');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [message, setMessage] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [purchasedCode, setPurchasedCode] = useState('');
  const [error, setError] = useState('');

  const effectiveAmount = selectedAmount ?? (customAmount ? Number(customAmount) : 0);

  // Step numbering adjusts when design picker is hidden
  let stepNum = 0;
  const nextStep = () => ++stepNum;

  const handleSelectAmount = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (val: string) => {
    setCustomAmount(val);
    setSelectedAmount(null);
  };

  const handlePurchase = async () => {
    setError('');

    if (effectiveAmount < minimumAmount) {
      setError('Minimum gift card amount is ' + formatPrice(minimumAmount));
      return;
    }
    if (!recipientName.trim()) {
      setError('Please enter the recipient\'s name.');
      return;
    }
    if (!buyerEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setPurchasing(true);
    try {
      const code = generateCode();
      const card: GiftCardInsert = {
        code,
        initial_balance: effectiveAmount,
        current_balance: effectiveAmount,
        purchaser_email: buyerEmail.trim(),
        recipient_email: recipientEmail.trim() || null,
        recipient_name: recipientName.trim(),
        message: message.trim() || null,
        expires_at: expiryMonthsToDate(validityMonths),
        design_template: selectedDesign,
        is_active: true,
      };

      const giftCard = await api.createGiftCard(card);

      // Create a contact + order so the buyer gets an order confirmation
      const buyerName = senderName.trim() || buyerEmail.trim();
      const contact = await api.findOrCreateContact(buyerEmail.trim(), buyerName);

      const order = await api.createOrder({
        contact_id: contact.id,
        company_id: null,
        customer_email: buyerEmail.trim(),
        customer_name: buyerName,
        customer_phone: null,
        shipping_address: null,
        shipping_method: null,
        shipping_cost: 0,
        subtotal: effectiveAmount,
        discount_amount: 0,
        discount_code: null,
        gift_card_amount: 0,
        gift_card_code: null,
        tax_amount: 0,
        total: effectiveAmount,
        status: isTestMode ? 'paid' : 'pending',
        payment_intent_id: null,
        payment_status: isTestMode ? 'paid' : 'unpaid',
        tracking_number: null,
        tracking_url: null,
        shipping_carrier: null,
        notes: isTestMode ? `[TEST ORDER] Gift Card Purchase — ${code}` : `Gift Card Purchase — ${code}`,
      });

      await api.createOrderItems([{
        order_id: order.id,
        product_id: null,
        variant_id: null,
        product_name: `Gift Card — ${formatPrice(effectiveAmount)}`,
        variant_label: `For ${recipientName.trim()}`,
        product_image_url: null,
        sku: code,
        quantity: 1,
        unit_price: effectiveAmount,
        total_price: effectiveAmount,
        unit_weight_kg: 0,
        barcode: null,
      }]);

      // --- Stripe Payment ---
      if (stripeEnabled && effectiveAmount > 0) {
        // Call stripe-checkout edge function to create PaymentIntent
        const { data: piData, error: piError } = await supabase.functions.invoke('stripe-checkout', {
          body: { orderId: order.id },
        });

        if (piError || piData?.error) {
          throw new Error(piData?.error || piError?.message || 'Failed to create payment');
        }

        const { clientSecret } = piData;

        // Confirm the card payment
        const cardElement = elements!.getElement(CardElement);
        if (!cardElement) throw new Error('Card element not found');

        const { error: confirmError } = await stripe!.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: buyerName,
              email: buyerEmail.trim(),
            },
          },
        });

        if (confirmError) {
          setError(confirmError.message || 'Payment failed. Please try again.');
          setPurchasing(false);
          return;
        }
      }

      // In test mode, trigger logic directly (webhook logic usually handles real payments)
      if (isTestMode) {
        // Send order confirmation to buyer
        supabase.functions.invoke('send-email', {
          body: { action: 'send_order_confirmation', orderId: order.id },
        }).catch(err => console.error('Gift card buyer confirmation email failed:', err));

        // Send gift card notification to recipient (if email provided)
        if (recipientEmail.trim()) {
          supabase.functions.invoke('send-email', {
            body: { action: 'send_gift_card_notification', giftCardId: giftCard.id, senderName: buyerName },
          }).catch(err => console.error('Gift card recipient notification email failed:', err));
        }
      }

      setPurchasedCode(code);
      setPurchased(true);
    } catch (err) {
      console.error('Gift card purchase failed:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const btnStyle: React.CSSProperties = {
    ...(buttonColor ? { background: buttonColor } : {}),
    color: buttonTextColor,
    ...(buttonRadius != null ? { borderRadius: `${buttonRadius}px` } : {}),
  };

  // --- Confirmation Screen ---
  if (purchased) {
    return (
      <div className="sf-gc-page">
        <div className="sf-gc-confirmation">
          <div className="sf-gc-confirmation-icon">
            <CheckCircle size={56} />
          </div>
          <h1>Gift Card Purchased!</h1>
          <p className="sf-gc-confirmation-subtitle">
            Your gift card is ready to use.
          </p>

          <div className="sf-gc-confirmation-preview">
            <GiftCardDesign
              design={selectedDesign}
              balance={effectiveAmount}
              code={purchasedCode}
              recipientName={recipientName}
              message={message}
            />
          </div>

          <div className="sf-gc-confirmation-code-box">
            <span className="sf-gc-confirmation-code-label">Gift Card Code</span>
            <span className="sf-gc-confirmation-code">{purchasedCode}</span>
          </div>

          <p className="sf-gc-confirmation-hint">
            Use this code at checkout to redeem the gift card balance.
          </p>

          <Link to={sfPath('/products')} className="sf-gc-continue-btn" style={buttonColor ? { background: buttonColor, color: buttonTextColor } : {}}>
            Continue Shopping <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  // --- Purchase Form ---
  return (
    <div className="sf-gc-page">
      <div className="sf-gc-hero">
        <div className="sf-gc-hero-icon">
          <Gift size={40} />
        </div>
        <h1>{heroTitle}</h1>
        <p>{heroSubtitle}</p>
      </div>

      <div className={`sf-gc-layout${!showPreview ? ' sf-gc-layout-full' : ''}`}>
        {/* Left: Form */}
        <div className="sf-gc-form">
          {/* Step: Design */}
          {showDesignPicker && (
            <div className="sf-gc-section">
              <div className="sf-gc-section-number">{nextStep()}</div>
              <h3>Choose a Design</h3>
              <div className="sf-gc-design-grid">
                {DESIGN_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`sf-gc-design-option ${selectedDesign === d ? 'active' : ''}`}
                    onClick={() => setSelectedDesign(d)}
                  >
                    <GiftCardDesign
                      design={d}
                      balance={effectiveAmount || 50}
                      code="••••-••••-••••-••••"
                      compact
                    />
                    <span className="sf-gc-design-label">{getDesignLabel(d)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Amount */}
          <div className="sf-gc-section">
            <div className="sf-gc-section-number">{nextStep()}</div>
            <h3>Select an Amount</h3>
            <div className="sf-gc-amount-grid">
              {presetAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`sf-gc-amount-btn ${selectedAmount === amt ? 'active' : ''}`}
                  onClick={() => handleSelectAmount(amt)}
                >
                  {formatPrice(amt)}
                </button>
              ))}
            </div>
            {showCustomAmount && (
              <div className="sf-gc-custom-amount">
                <label>Or enter a custom amount</label>
                <div className="sf-gc-custom-amount-input">
                  <span className="sf-gc-currency-prefix">{currencySymbol}</span>
                  <input
                    type="number"
                    min={minimumAmount}
                    step="1"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step: Personalise */}
          <div className="sf-gc-section">
            <div className="sf-gc-section-number">{nextStep()}</div>
            <h3>Personalise It</h3>
            <div className="sf-gc-fields">
              <div className="sf-gc-field">
                <label>Recipient's Name *</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Who is this for?"
                />
              </div>
              <div className="sf-gc-field">
                <label>Recipient's Email</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Optional — send them the gift card"
                />
              </div>
              <div className="sf-gc-field">
                <label>Your Email *</label>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="For your order confirmation"
                />
              </div>
              <div className="sf-gc-field">
                <label>Your Name</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="From..."
                />
              </div>
              <div className="sf-gc-field sf-gc-field-full">
                <label>Personal Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a special message..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="sf-gc-section">
            <div className="sf-gc-section-number">{nextStep()}</div>
            <h3>Payment</h3>
            {isTestMode ? (
              <div style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(217,119,6,0.08))',
                border: '1px dashed #f59e0b',
                borderRadius: 12,
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>🧪</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#d97706', fontSize: '0.875rem', marginBottom: 2 }}>Test Mode Active</div>
                  <div style={{ fontSize: '0.8125rem', color: '#92400e' }}>No payment required. This form will create a test card.</div>
                </div>
              </div>
            ) : stripeEnabled ? (
              <div className="sf-stripe-card-wrapper" style={{ marginBottom: '1rem' }}>
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#1a1a1a',
                        fontFamily: 'inherit',
                        '::placeholder': { color: '#9ca3af' },
                      },
                      invalid: { color: '#ef4444' },
                    },
                    hidePostalCode: true,
                  }}
                />
              </div>
            ) : (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                Payment processing is not configured yet. Purchases will be pending.
              </p>
            )}
          </div>

          {/* Error */}
          {error && <div className="sf-gc-error">{error}</div>}

          {/* Purchase Button */}
          <button
            className="sf-gc-purchase-btn"
            onClick={handlePurchase}
            disabled={purchasing || effectiveAmount < minimumAmount || !recipientName.trim() || !buyerEmail.trim()}
            style={btnStyle}
          >
            {purchasing
              ? 'Processing...'
              : isTestMode 
                ? `Purchase (Test) — ${effectiveAmount >= minimumAmount ? formatPrice(effectiveAmount) : formatPrice(0)}`
                : `Purchase Gift Card — ${effectiveAmount >= minimumAmount ? formatPrice(effectiveAmount) : formatPrice(0)}`}
          </button>
        </div>

        {/* Right: Live Preview */}
        {showPreview && (
          <div className="sf-gc-preview">
            <div className="sf-gc-preview-sticky">
              <span className="sf-gc-preview-label">Live Preview</span>
              <GiftCardDesign
                design={selectedDesign}
                balance={effectiveAmount || 0}
                code="••••-••••-••••-••••"
                recipientName={recipientName || undefined}
                message={message || undefined}
              />
              <div className="sf-gc-preview-summary">
                <div className="sf-gc-preview-row">
                  <span>Amount</span>
                  <span>{effectiveAmount >= minimumAmount ? formatPrice(effectiveAmount) : '—'}</span>
                </div>
                <div className="sf-gc-preview-row">
                  <span>Design</span>
                  <span>{getDesignLabel(selectedDesign)}</span>
                </div>
                <div className="sf-gc-preview-row">
                  <span>Recipient</span>
                  <span>{recipientName || '—'}</span>
                </div>
                <div className="sf-gc-preview-row">
                  <span>Valid for</span>
                  <span>{validityMonths} months</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
