import { useState, useEffect } from 'react';
import { useAlert } from '@/components/ui/AlertDialog';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useNavigate } from 'react-router-dom';
import { useStoreConfig } from './useStoreConfig';
import { useCart } from './useCart';
import * as api from '@/lib/api';
import type { ShippingRate, DiscountCode, GiftCard } from '@/types/database';
import { sfPath } from './storefrontPaths';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';
import { trackEcommerceEvent } from '@/hooks/useTracking';

let globalStripePromise: Promise<any> | null = null;
let hasRequestedStripe = false;

export function StorefrontCheckout() {
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

  // If no stripe configured, we still wrap in Elements with stripe={null} so useStripe() doesn't crash!
  return (
    <Elements stripe={stripePromise || null}>
      <StorefrontCheckoutInner />
    </Elements>
  );
}

function StorefrontCheckoutInner() {
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const { formatPrice, config } = useStoreConfig();
  const { items, cartTotal, clearCart } = useCart();
  const tpl = config?.page_templates?.checkout || {};

  const stripe = useStripe();
  const elements = useElements();

  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingRate | null>(null);
  const [placing, setPlacing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Customer info
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Shipping address
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('GB');

  // Discount
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
  const [discountError, setDiscountError] = useState('');

  // Gift card
  const [giftCardInput, setGiftCardInput] = useState('');
  const [appliedGiftCard, setAppliedGiftCard] = useState<GiftCard | null>(null);
  const [giftCardError, setGiftCardError] = useState('');

  // Track checkout start
  useEffect(() => {
    if (items.length > 0) {
      trackEcommerceEvent('begin_checkout', { value: cartTotal });
    }
  }, []); // Run once on mount

  useEffect(() => {
    api.fetchActiveShippingRates()
      .then((rates) => {
        setShippingRates(rates);
        if (rates.length > 0) setSelectedShipping(rates[0]);
      })
      .catch(console.error);
  }, []);

  // Calculate totals
  let discountAmount = 0;
  if (appliedDiscount) {
    if (appliedDiscount.discount_type === 'percentage') {
      discountAmount = (cartTotal * appliedDiscount.value) / 100;
    } else {
      discountAmount = appliedDiscount.value;
    }
    discountAmount = Math.min(discountAmount, cartTotal);
  }

  const afterDiscount = cartTotal - discountAmount;
  const shippingCost = selectedShipping?.price || 0;
  const vatableAmount = afterDiscount + shippingCost;
  const vatAmount = Math.round(vatableAmount * 0.2 * 100) / 100;
  const giftCardAmount = appliedGiftCard
    ? Math.min(appliedGiftCard.current_balance, vatableAmount + vatAmount)
    : 0;
  const total = Math.max(0, vatableAmount + vatAmount - giftCardAmount);

  const applyDiscount = async () => {
    setDiscountError('');
    if (!discountInput.trim()) return;
    const dc = await api.validateDiscountCode(discountInput, cartTotal);
    if (dc) {
      setAppliedDiscount(dc);
    } else {
      setDiscountError('Invalid or expired discount code');
    }
  };

  const applyGiftCard = async () => {
    setGiftCardError('');
    if (!giftCardInput.trim()) return;
    const gc = await api.validateGiftCard(giftCardInput);
    if (gc) {
      setAppliedGiftCard(gc);
    } else {
      setGiftCardError('Invalid or expired gift card');
    }
  };

  const isTestMode = config?.test_mode === true;
  const stripeEnabled = !isTestMode && !!stripe && !!elements;

  const handlePlaceOrder = async () => {
    if (!email || !name || !line1 || !city || !postcode) return;
    if (items.length === 0) return;

    setPlacing(true);
    setPaymentError('');
    try {
      // Find or create contact
      const contact = await api.findOrCreateContact(email, name, phone || undefined);

      // Create order
      const order = await api.createOrder({
        contact_id: contact.id,
        company_id: null,
        customer_email: email,
        customer_name: name,
        customer_phone: phone || null,
        shipping_address: { line1, line2: line2 || undefined, city, county: county || undefined, postcode, country },
        shipping_method: selectedShipping?.name || null,
        shipping_cost: shippingCost,
        subtotal: cartTotal,
        discount_amount: discountAmount,
        discount_code: appliedDiscount?.code || null,
        gift_card_amount: giftCardAmount,
        gift_card_code: appliedGiftCard?.code || null,
        tax_amount: vatAmount,
        total,
        status: isTestMode ? 'paid' : 'pending',
        payment_intent_id: null,
        payment_status: isTestMode ? 'paid' : 'unpaid',
        tracking_number: null,
        tracking_url: null,
        shipping_carrier: null,
        notes: isTestMode ? '[TEST ORDER]' : null,
      });

      // Create order items
      await api.createOrderItems(
        items.map((item) => ({
          order_id: order.id,
          product_id: item.productId,
          variant_id: item.variantId,
          product_name: item.name,
          variant_label: item.variantLabel,
          product_image_url: item.imageUrl,
          sku: item.sku,
          barcode: item.barcode,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          unit_weight_kg: item.weightKg,
        }))
      );

      // Post-order: increment discount usage, deduct gift card (skip in test mode)
      if (!isTestMode) {
        if (appliedDiscount) {
          await api.incrementDiscountCodeUsage(appliedDiscount.id);
        }
        if (appliedGiftCard && giftCardAmount > 0) {
          await api.deductGiftCardBalance(appliedGiftCard.id, giftCardAmount);
        }
      }

      // --- Stripe Payment ---
      if (stripeEnabled && total > 0) {
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
              name,
              email,
              phone: phone || undefined,
              address: {
                line1,
                line2: line2 || undefined,
                city,
                postal_code: postcode,
                country,
              },
            },
          },
        });

        if (confirmError) {
          setPaymentError(confirmError.message || 'Payment failed. Please try again.');
          setPlacing(false);
          return;
        }
      } else if (!stripeEnabled && total > 0) {
        // Stripe not configured — order stays pending (legacy behaviour)
      }

      // In test mode, trigger confirmation email + SMS directly (normally Stripe webhook does this)
      if (isTestMode) {
        // Run all notifications concurrently but wait for them to dispatch before navigating
        await Promise.allSettled([
          supabase.functions.invoke('send-email', {
            body: { action: 'send_order_confirmation', orderId: order.id },
          }).catch(err => console.error('Test order confirmation email failed:', err)),
          
          supabase.functions.invoke('send-email', {
            body: { action: 'send_admin_order_notification', orderId: order.id },
          }).catch(err => console.error('Test admin notification email failed:', err)),
          
          supabase.functions.invoke('send-sms', {
            body: { action: 'order_confirmation', orderId: order.id },
          }).catch(err => console.error('Test order confirmation SMS failed:', err))
        ]);
      }

      clearCart();
      navigate(sfPath(`/thank-you/${order.id}`));
    } catch (err: any) {
      console.error('Order failed:', err);
      setPaymentError('');
      showAlert({ title: 'Order Failed', message: err?.message || 'Something went wrong placing your order. Please try again.', variant: 'danger' });
    } finally {
      setPlacing(false);
    }
  };

  // Template config values with defaults
  const sectionRadius = tpl.sectionRadius ?? 16;
  const buttonRadius = tpl.buttonRadius ?? 12;
  const buttonText = tpl.buttonText || 'Place Order';
  const inputRadius = tpl.inputRadius ?? 8;
  const inputBorderColor = tpl.inputBorderColor || '';

  const sectionStyle: React.CSSProperties = {
    borderRadius: `${sectionRadius}px`,
  };

  const inputStyle: React.CSSProperties = {
    borderRadius: `${inputRadius}px`,
    ...(inputBorderColor ? { borderColor: inputBorderColor } : {}),
  };

  if (items.length === 0) {
    return (
      <div className="sf-thank-you">
        <h1>Your cart is empty</h1>
        <p>Add some products before checking out.</p>
      </div>
    );
  }

  return (
    <div className="sf-checkout">
      <div className="sf-checkout-form">
        {/* Contact */}
        <div className="sf-checkout-section" style={sectionStyle}>
          <h3>Contact Information</h3>
          <div className="sf-checkout-field">
            <label>Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          </div>
          <div className="form-row">
            <div className="sf-checkout-field">
              <label>Full Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
            </div>
            <div className="sf-checkout-field">
              <label>Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="sf-checkout-section" style={sectionStyle}>
          <h3>Shipping Address</h3>
          <div className="sf-checkout-field">
            <label>Address Line 1 *</label>
            <input type="text" value={line1} onChange={(e) => setLine1(e.target.value)} required style={inputStyle} />
          </div>
          <div className="sf-checkout-field">
            <label>Address Line 2</label>
            <input type="text" value={line2} onChange={(e) => setLine2(e.target.value)} style={inputStyle} />
          </div>
          <div className="form-row">
            <div className="sf-checkout-field">
              <label>City *</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required style={inputStyle} />
            </div>
            <div className="sf-checkout-field">
              <label>County</label>
              <input type="text" value={county} onChange={(e) => setCounty(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div className="form-row">
            <div className="sf-checkout-field">
              <label>Postcode *</label>
              <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} required style={inputStyle} />
            </div>
            <div className="sf-checkout-field">
              <label>Country</label>
              <SearchableSelect
                value={country}
                onChange={(val) => setCountry(val)}
                style={inputStyle}
                searchable={true}
                options={[
                  { label: 'United Kingdom', value: 'GB' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Shipping method */}
        {shippingRates.length > 0 && (
          <div className="sf-checkout-section" style={sectionStyle}>
            <h3>Shipping Method</h3>
            <div className="sf-shipping-options">
              {shippingRates.map((rate) => (
                <div
                  key={rate.id}
                  className={`sf-shipping-option ${selectedShipping?.id === rate.id ? 'selected' : ''}`}
                  onClick={() => setSelectedShipping(rate)}
                >
                  <input
                    type="radio"
                    checked={selectedShipping?.id === rate.id}
                    onChange={() => setSelectedShipping(rate)}
                  />
                  <div className="sf-shipping-option-info">
                    <div className="sf-shipping-option-name">{rate.name}</div>
                    <div className="sf-shipping-option-est">
                      {rate.estimated_days_min}–{rate.estimated_days_max} business days
                    </div>
                  </div>
                  <div className="sf-shipping-option-price">
                    {rate.price > 0 ? formatPrice(rate.price) : 'Free'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment */}
        <div className="sf-checkout-section" style={sectionStyle}>
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
            }}>
              <span style={{ fontSize: '1.5rem' }}>🧪</span>
              <div>
                <div style={{ fontWeight: 700, color: '#d97706', fontSize: '0.875rem', marginBottom: 2 }}>Test Mode Active</div>
                <div style={{ fontSize: '0.8125rem', color: '#92400e' }}>No payment required. This order will be processed as a test.</div>
              </div>
            </div>
          ) : stripeEnabled ? (
            <div className="sf-stripe-card-wrapper">
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
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Payment processing is not configured yet. Orders placed now will be marked as pending.
            </p>
          )}
          {paymentError && (
            <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>{paymentError}</p>
          )}
        </div>

        {/* Place order */}
        <button
          className="sf-place-order-btn"
          onClick={handlePlaceOrder}
          disabled={placing || !email || !name || !line1 || !city || !postcode}
          style={{
            borderRadius: `${buttonRadius}px`,
          }}
        >
          {placing ? 'Processing...' : isTestMode ? `${buttonText} (Test) — ${formatPrice(total)}` : `${buttonText} — ${formatPrice(total)}`}
        </button>
      </div>

      {/* Order summary */}
      <div className="sf-order-summary">
        <h3>Order Summary</h3>
        {items.map((item) => (
          <div className="sf-summary-item" key={`${item.productId}-${item.variantId}`}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="sf-summary-item-image" />
            ) : (
              <div className="sf-summary-item-image" style={{ background: 'var(--sf-surface)' }} />
            )}
            <div className="sf-summary-item-info">
              <div className="sf-summary-item-name">{item.name}</div>
              <div className="sf-summary-item-qty">
                {item.variantLabel && `${item.variantLabel} · `}Qty: {item.quantity}
              </div>
            </div>
            <div className="sf-summary-item-total">{formatPrice(item.price * item.quantity)}</div>
          </div>
        ))}

        <div className="sf-summary-totals">
          <div className="sf-summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(cartTotal)}</span>
          </div>

          {/* Discount code input */}
          {!appliedDiscount ? (
            <div>
              <div className="sf-discount-row">
                <input
                  type="text"
                  placeholder="Discount code"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                />
                <button onClick={applyDiscount}>Apply</button>
              </div>
              {discountError && (
                <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{discountError}</p>
              )}
            </div>
          ) : (
            <div className="sf-discount-applied">
              <span>Discount: {appliedDiscount.code}</span>
              <span>−{formatPrice(discountAmount)}</span>
            </div>
          )}

          {/* Gift card input */}
          {!appliedGiftCard ? (
            <div>
              <div className="sf-discount-row">
                <input
                  type="text"
                  placeholder="Gift card code"
                  value={giftCardInput}
                  onChange={(e) => setGiftCardInput(e.target.value)}
                />
                <button onClick={applyGiftCard}>Apply</button>
              </div>
              {giftCardError && (
                <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{giftCardError}</p>
              )}
            </div>
          ) : (
            <div className="sf-discount-applied">
              <span>Gift Card: {appliedGiftCard.code}</span>
              <span>−{formatPrice(giftCardAmount)}</span>
            </div>
          )}

          <div className="sf-summary-row">
            <span>Shipping</span>
            <span>{shippingCost > 0 ? formatPrice(shippingCost) : 'Free'}</span>
          </div>

          <div className="sf-summary-row">
            <span>VAT (20%)</span>
            <span>{formatPrice(vatAmount)}</span>
          </div>

          <div className="sf-summary-row total">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
