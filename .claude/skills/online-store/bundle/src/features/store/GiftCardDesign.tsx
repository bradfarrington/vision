import type { GiftCardDesignTemplate } from '@/types/database';
import { Gift } from 'lucide-react';

interface GiftCardDesignProps {
  design: GiftCardDesignTemplate;
  balance: number;
  code: string;
  recipientName?: string;
  message?: string;
  compact?: boolean;
}

const DESIGN_META: Record<GiftCardDesignTemplate, { label: string; className: string; logo: string }> = {
  classic:    { label: 'Classic',    className: 'gc-design-classic',    logo: '/white logo - no bg.png' },
  industrial: { label: 'Industrial', className: 'gc-design-industrial', logo: '/white logo - no bg.png' },
  festive:    { label: 'Festive',    className: 'gc-design-festive',    logo: '/white logo - no bg.png' },
  minimal:    { label: 'Minimal',    className: 'gc-design-minimal',    logo: '/LOGO - NO HIGH RES.png' },
};

export const DESIGN_OPTIONS: GiftCardDesignTemplate[] = ['classic', 'industrial', 'festive', 'minimal'];

export function getDesignLabel(d: GiftCardDesignTemplate) {
  return DESIGN_META[d]?.label ?? 'Classic';
}

function maskCode(code: string) {
  if (!code) return '••••-••••-••••-••••';
  const parts = code.split('-');
  if (parts.length <= 1) return code;
  return parts.map((p, i) => (i < parts.length - 1 ? '••••' : p)).join('-');
}

export function GiftCardDesign({ design, balance, code, recipientName, message, compact }: GiftCardDesignProps) {
  const meta = DESIGN_META[design] || DESIGN_META.classic;

  return (
    <div className={`gc-card ${meta.className} ${compact ? 'gc-card-compact' : ''}`}>
      {/* Background decorations */}
      <div className="gc-card-bg-decoration" />

      {/* Header row */}
      <div className="gc-card-header">
        <img
          src={meta.logo}
          alt="Isobex Industrial Lasers"
          className="gc-card-logo"
        />
        <div className="gc-card-gift-icon">
          <Gift size={compact ? 14 : 20} />
        </div>
      </div>

      {/* Balance */}
      <div className="gc-card-balance">
        <span className="gc-card-currency">£</span>
        <span className="gc-card-amount">{balance > 0 ? balance.toFixed(2) : '0.00'}</span>
      </div>

      {/* Code */}
      <div className="gc-card-code">{compact ? maskCode(code) : (code || '••••-••••-••••-••••')}</div>

      {/* Footer */}
      <div className="gc-card-footer">
        {recipientName ? (
          <div className="gc-card-recipient">{recipientName}</div>
        ) : (
          <div className="gc-card-recipient gc-card-recipient-placeholder">Recipient Name</div>
        )}
        {!compact && message && <div className="gc-card-message">"{message}"</div>}
      </div>

      {/* Label */}
      <div className="gc-card-label">GIFT CARD</div>
    </div>
  );
}
