import { Outlet, Link, useLocation } from 'react-router-dom';
import { sfPath } from './storefrontPaths';
import { StoreConfigProvider, useStoreConfig } from './useStoreConfig';
import { getResolvedDefaultLinks } from '../store/GlobalSettingsEditor';
import { CartProvider, useCart } from './useCart';
import { CartSidebar } from './CartSidebar';
import { ShoppingCart, ShoppingBag, ShoppingBasket, Menu, X } from 'lucide-react';
import { SocialIcon } from './SocialIcons';
import { useState, useEffect } from 'react';
import { useTracking } from '@/hooks/useTracking';
import './StorefrontLayout.css';

function StorefrontShell() {
  const { config, loading } = useStoreConfig();
  const { cartCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useTracking();

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Dynamically load Google Fonts for heading, body, and footer fonts
  useEffect(() => {
    const fonts = new Set<string>();
    if (config?.font_heading && config.font_heading !== 'Inter') fonts.add(config.font_heading);
    if (config?.font_body && config.font_body !== 'Inter') fonts.add(config.font_body);
    const footerFont = (config?.footer_config as any)?.font;
    if (footerFont && footerFont !== 'Inter') fonts.add(footerFont);
    const links: HTMLLinkElement[] = [];
    fonts.forEach(f => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f)}:wght@400;600;700&display=swap`;
      document.head.appendChild(link);
      links.push(link);
    });
    return () => { links.forEach(l => l.parentNode?.removeChild(l)); };
  }, [config?.font_heading, config?.font_body, (config?.footer_config as any)?.font]);

  // Dynamically inject favicon into document head
  useEffect(() => {
    const faviconHref = config?.favicon_url || '/FAVICON.png';
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconHref;
    return () => {
      if (link && link.parentNode) link.parentNode.removeChild(link);
    };
  }, [config?.favicon_url]);

  if (loading) {
    return <div className="sf-loading">Loading store...</div>;
  }

  const navLinks = config?.header_layout?.nav_links || [];
  // Ensure we show the bar if there are ticker messages, even if main text is empty
  const showAnnouncement = config?.announcement_bar_active && 
    (config?.announcement_bar_text || (config?.header_layout as any)?.ticker_messages?.length > 0);

  // Header Layout Overrides
  const headerLayout: any = config?.header_layout || { logo_position: 'left', nav_links: [] };
  const hBg = headerLayout.bg_color || 'var(--sf-bg)';
  const hColor = headerLayout.nav_color || '#000000';
  const hFont = headerLayout.nav_font || 'inherit';
  const logoWidthDesktop = headerLayout.logo_width_desktop || 150;
  const logoWidthMobile = headerLayout.logo_width_mobile || 120;
  const CartIconCmp = headerLayout.cart_icon_type === 'ShoppingBag' ? ShoppingBag : (headerLayout.cart_icon_type === 'ShoppingBasket' ? ShoppingBasket : ShoppingCart);
  const cartIconColor = headerLayout.cart_icon_color || hColor;
  const hWeight = headerLayout.nav_weight || '500';
  
  // Apply theme CSS vars
  const mobileCfg = (config as any)?.mobile_settings || {};
  const themeVars: Record<string, string> = {
    '--sf-primary': config?.color_primary || '#2563eb',
    '--sf-secondary': config?.color_secondary || '#1e40af',
    '--sf-accent': config?.color_accent || '#f59e0b',
    '--sf-bg': config?.color_background || '#ffffff',
    '--sf-surface': config?.color_surface || '#f8fafc',
    '--sf-text': config?.color_text || '#0f172a',
    '--sf-text-secondary': config?.color_text_secondary || '#64748b',
    '--sf-font-heading': config?.font_heading || 'Inter',
    '--sf-font-body': config?.font_body || 'Inter',
    // Dynamic Header sizes injected as vars
    '--sf-logo-desktop': `${logoWidthDesktop}px`,
    '--sf-logo-mobile': `${logoWidthMobile}px`,
    // Mobile config vars
    '--sf-mobile-product-cols': String(mobileCfg.mobileProductColumns || 2),
    '--sf-phone-product-cols': String(mobileCfg.phoneProductColumns || 1),
    '--sf-mobile-collection-cols': String(mobileCfg.mobileCollectionColumns || 2),
    '--sf-mobile-padding': mobileCfg.mobilePadding === 'compact' ? '0.75rem' : mobileCfg.mobilePadding === 'spacious' ? '1.5rem' : '1rem',
  };

  const annBg = headerLayout.announcement_bg_color || '#000000';
  const annColor = headerLayout.announcement_text_color || '#ffffff';
  const annFont = headerLayout.announcement_font || 'inherit';

  const isTicker = headerLayout.announcement_type === 'ticker';
  const tickerSpacing = headerLayout.ticker_spacing || 50;
  const tickerSpeed = headerLayout.ticker_speed || 20;
  const tickerRepeat = headerLayout.ticker_repeat || 5;
  const tickerMessages = headerLayout.ticker_messages?.length > 0 
      ? headerLayout.ticker_messages 
      : [config?.announcement_bar_text].filter(Boolean);
  
  const repeatedContent: string[] = [];
  for (let i = 0; i < tickerRepeat; i++) {
    repeatedContent.push(...tickerMessages);
  }

  return (
    <div className="storefront" style={themeVars as React.CSSProperties}>
      {/* Test mode banner */}
      {config?.test_mode && (
        <div style={{
          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
          color: '#fff',
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '0.8125rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
          zIndex: 9999,
        }}>
          ⚠ Test Mode — Orders will not be charged
        </div>
      )}

      {/* Announcement bar */}
      {showAnnouncement && (
        <div 
          className="sf-announcement" 
          style={{ backgroundColor: annBg, color: annColor, fontFamily: annFont }}
        >
          {isTicker ? (
            <div className="sf-announcement-ticker-wrap">
              <div className="sf-marquee" style={{ gap: `${tickerSpacing}px`, paddingRight: `${tickerSpacing}px`, animationDuration: `${tickerSpeed}s` }}>
                {repeatedContent.map((msg, i) => <span key={i}>{msg}</span>)}
              </div>
              <div className="sf-marquee" style={{ gap: `${tickerSpacing}px`, paddingRight: `${tickerSpacing}px`, animationDuration: `${tickerSpeed}s` }}>
                {repeatedContent.map((msg, i) => <span key={`dup-${i}`}>{msg}</span>)}
              </div>
            </div>
          ) : (
            config?.announcement_bar_text
          )}
        </div>
      )}

      {/* Header */}
      <header className={`sf-header logo-${headerLayout.logo_position || 'left'}`} style={{ backgroundColor: hBg, color: hColor, fontFamily: hFont }}>
        <div className="sf-header-inner">
          <button className="sf-mobile-menu-btn" style={{ color: hColor }} onClick={() => setMenuOpen(!menuOpen)}>
            <Menu size={24} />
          </button>

          <Link to={sfPath('/')} className="sf-logo">
            {config?.logo_url ? (
              <img src={config.logo_url} alt={config.store_name} className="sf-logo-img" />
            ) : (
              <span className="sf-logo-text" style={{ color: hColor }}>{config?.store_name || 'Store'}</span>
            )}
          </Link>

          <nav className="sf-nav desktop-only">
            {getResolvedDefaultLinks(headerLayout).filter(dl => !dl.hidden).map(dl => (
              <Link key={dl.key} to={sfPath(dl.url.replace('/shop', '') || '/')} className="sf-nav-link" style={{ color: hColor, fontWeight: hWeight }}>{dl.label}</Link>
            ))}
            {navLinks.map((link, i) => (
              <Link key={i} to={link.url} className="sf-nav-link" style={{ color: hColor, fontWeight: hWeight }}>{link.label}</Link>
            ))}
          </nav>

          <button className="sf-cart-btn" onClick={openCart} style={{ color: cartIconColor }}>
            <CartIconCmp size={22} />
            {cartCount > 0 && <span className="sf-cart-badge">{cartCount}</span>}
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      <div className={`sf-mobile-menu-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />

      {/* Mobile nav drawer */}
        <nav className={`sf-nav-mobile ${menuOpen ? 'open' : ''}`} style={{ backgroundColor: hBg }}>
          <div className="sf-nav-close-header" style={{ backgroundColor: hBg }}>
            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: hColor }}>Menu</span>
            <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: hColor, padding: 4 }}>
              <X size={22} />
            </button>
          </div>
          {getResolvedDefaultLinks(headerLayout).filter(dl => !dl.hidden).map(dl => (
            <Link key={dl.key} to={sfPath(dl.url.replace('/shop', '') || '/')} className="sf-nav-link" style={{ color: hColor, fontWeight: hWeight }} onClick={() => setMenuOpen(false)}>{dl.label}</Link>
          ))}
          {navLinks.map((link, i) => (
            <Link key={i} to={link.url} className="sf-nav-link" style={{ color: hColor, fontWeight: hWeight }} onClick={() => setMenuOpen(false)}>{link.label}</Link>
          ))}
        </nav>

      {/* Main content */}
      <main className="sf-main">
        <Outlet />
      </main>

      {/* Footer */}
      {(() => {
        const fc: any = config?.footer_config || {};
        const fStyle: Record<string, string> = {};
        if (fc.bg_color) fStyle.backgroundColor = fc.bg_color;
        if (fc.text_color) fStyle.color = fc.text_color;
        if (fc.font) fStyle.fontFamily = `'${fc.font}', sans-serif`;
        const headingColor = fc.heading_color || undefined;
        const linkColor = fc.link_color || undefined;
        return (
          <footer className="sf-footer" style={fStyle}>
            <div className="sf-footer-inner">
              <div className="sf-footer-columns">
                {(config?.footer_config?.columns || []).map((col, ci) => (
                  <div className="sf-footer-column" key={ci}>
                    <h4 style={headingColor ? { color: headingColor } : undefined}>{col.title}</h4>
                    {col.links.map((link, li) => (
                      <Link key={li} to={link.url} className="sf-footer-link" style={linkColor ? { color: linkColor } : undefined}>{link.label}</Link>
                    ))}
                  </div>
                ))}
              </div>
              <div className="sf-footer-bottom">
                <div className="sf-footer-social">
                  {(config?.footer_config?.social_links || []).map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="sf-social-link" title={link.platform}>
                      <SocialIcon platform={link.platform} size={18} />
                    </a>
                  ))}
                </div>
                <p className="sf-copyright">
                  {config?.footer_config?.copyright || `© ${new Date().getFullYear()} ${config?.store_name}`}
                </p>
              </div>
            </div>
          </footer>
        );
      })()}

      {/* Cart sidebar */}
      <CartSidebar />
    </div>
  );
}

export function StorefrontLayout() {
  return (
    <StoreConfigProvider>
      <CartProvider>
        <StorefrontShell />
      </CartProvider>
    </StoreConfigProvider>
  );
}
