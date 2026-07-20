import { Link } from 'react-router-dom';
import { sfPath } from './storefrontPaths';
import { useCart } from './useCart';
import { useStoreConfig } from './useStoreConfig';
import { X, Trash2 } from 'lucide-react';

export function CartSidebar() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, cartTotal } = useCart();
  const { formatPrice, config } = useStoreConfig();
  const tpl = config?.page_templates?.cart_sidebar || {};

  // Template config values with defaults
  const headerBgColor = tpl.headerBgColor || '';
  const headerTextColor = tpl.headerTextColor || '';
  const bodyBgColor = tpl.bodyBgColor || '';
  const emptyText = tpl.emptyText || 'Your cart is empty';
  const emptyButtonText = tpl.emptyButtonText || 'Start Shopping';
  const checkoutBtnBg = tpl.checkoutButtonBgColor || '';
  const checkoutBtnText = tpl.checkoutButtonTextColor || '';
  const checkoutBtnRadius = tpl.checkoutButtonRadius ?? 8;
  const checkoutBtnLabel = tpl.checkoutButtonText || 'Proceed to Checkout';

  if (!isOpen) return null;

  return (
    <div className="cart-overlay">
      <div className="cart-backdrop" onClick={closeCart} />
      <div className="cart-panel" style={bodyBgColor ? { backgroundColor: bodyBgColor } : undefined}>
        <div className="cart-header" style={{ ...(headerBgColor ? { backgroundColor: headerBgColor } : {}), ...(headerTextColor ? { color: headerTextColor } : {}) }}>
          <h3 style={headerTextColor ? { color: headerTextColor } : undefined}>Your Cart ({items.length})</h3>
          <button className="cart-close-btn" onClick={closeCart} style={headerTextColor ? { color: headerTextColor } : undefined}>
            <X size={20} />
          </button>
        </div>

        <div className="cart-items">
          {items.length === 0 ? (
            <div className="cart-empty">
              <p>{emptyText}</p>
              <Link to={sfPath('/products')} onClick={closeCart} className="sf-hero-cta" style={{ marginTop: '1rem', display: 'inline-block', background: '#dc2626', color: '#ffffff', borderRadius: '6px', padding: '0.75rem 2rem', textDecoration: 'none' }}>
                {emptyButtonText}
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div className="cart-item" key={`${item.productId}-${item.variantId}`}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="cart-item-image" />
                ) : (
                  <div className="cart-item-image-placeholder" />
                )}
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  {item.variantLabel && <div className="cart-item-variant">{item.variantLabel}</div>}
                  <div className="cart-item-bottom">
                    <div className="cart-qty-controls">
                      <button
                        className="cart-qty-btn"
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="cart-qty-val">{item.quantity}</span>
                      <button
                        className="cart-qty-btn"
                        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <span className="cart-item-price">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                </div>
                <button
                  className="cart-item-remove"
                  onClick={() => removeItem(item.productId, item.variantId)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-footer">
            <div className="cart-subtotal">
              <span>Subtotal</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>
            <Link
              to={sfPath('/checkout')}
              className="cart-checkout-btn"
              onClick={closeCart}
              style={{
                ...(checkoutBtnBg ? { backgroundColor: checkoutBtnBg } : {}),
                ...(checkoutBtnText ? { color: checkoutBtnText } : {}),
                borderRadius: `${checkoutBtnRadius}px`,
              }}
            >
              {checkoutBtnLabel}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
