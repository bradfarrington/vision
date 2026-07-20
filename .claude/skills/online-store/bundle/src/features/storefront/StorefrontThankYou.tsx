import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as api from '@/lib/api';
import type { Order } from '@/types/database';
import { trackEcommerceEvent } from '@/hooks/useTracking';

export function StorefrontThankYou() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    api.fetchOrder(orderId)
      .then(fetchedOrder => {
        setOrder(fetchedOrder);
        if (fetchedOrder) {
          trackEcommerceEvent('purchase', {
            order_id: fetchedOrder.id,
            value: fetchedOrder.total,
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <div className="sf-loading">Loading...</div>;

  return (
    <div className="sf-thank-you">
      <h1>Thank You! 🎉</h1>
      <p>Your order has been placed successfully.</p>
      {order && (
        <div className="sf-order-number">Order #{order.order_number}</div>
      )}
      <p>We've sent a confirmation to <strong>{order?.customer_email}</strong></p>
      <p style={{ color: 'var(--sf-text-secondary)', fontSize: '0.875rem' }}>
        We'll be in touch once your order is on its way.
      </p>
      <Link to="/shop" className="sf-continue-btn">Continue Shopping</Link>
    </div>
  );
}
