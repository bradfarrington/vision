import type { BlockType } from '@/types/database';
import {
  Image, Type, Heading, MousePointer, Grid3x3, ShoppingBag,
  Star, Video, HelpCircle, MessageSquare, Minus, MoveVertical,
  LayoutTemplate, Code, Award, Columns2, AlignLeft, LayoutGrid,
} from 'lucide-react';
import React from 'react';

interface Props {
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

interface BlockOption {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

export const BLOCK_OPTIONS: BlockOption[] = [
  { type: 'columns', label: 'Columns', description: 'Multi-column layout for nesting blocks', icon: <Columns2 size={24} />, category: 'Layout' },
  { type: 'container', label: 'Container', description: 'A styled box for nesting blocks with custom background', icon: <LayoutTemplate size={24} />, category: 'Layout' },
  { type: 'half_hero', label: 'Half Hero', description: 'Hero banner styled under the navigation bar', icon: <LayoutTemplate size={24} />, category: 'Layout' },
  { type: 'collection_showcase', label: 'Collection Showcase', description: 'A sleek, gapless row of products for a collection', icon: <Grid3x3 size={24} />, category: 'Store' },
  { type: 'category_links', label: 'Category Links', description: 'Large image tiles spanning full width', icon: <Columns2 size={24} />, category: 'Layout' },
  { type: 'product_carousel', label: 'Product Carousel', description: 'Horizontal scrolling list of products', icon: <ShoppingBag size={24} />, category: 'Store' },
  { type: 'hero', label: 'Hero Banner', description: 'Full-width banner with image, title & CTA button', icon: <LayoutTemplate size={24} />, category: 'Layout' },
  { type: 'banner', label: 'Banner', description: 'Coloured banner strip with text', icon: <Award size={24} />, category: 'Layout' },
  { type: 'spacer', label: 'Spacer', description: 'Vertical empty space', icon: <MoveVertical size={24} />, category: 'Layout' },
  { type: 'divider', label: 'Divider', description: 'Horizontal line separator', icon: <Minus size={24} />, category: 'Layout' },
  { type: 'heading', label: 'Heading', description: 'Large heading text (H1-H4)', icon: <Heading size={24} />, category: 'Text' },
  { type: 'text', label: 'Text', description: 'Paragraph or rich text content', icon: <Type size={24} />, category: 'Text' },
  { type: 'button', label: 'Button', description: 'Call-to-action button with link', icon: <MousePointer size={24} />, category: 'Text' },
  { type: 'image', label: 'Image', description: 'Single image with optional caption', icon: <Image size={24} />, category: 'Media' },
  { type: 'image_gallery', label: 'Image Gallery', description: 'Multiple images in a grid', icon: <Columns2 size={24} />, category: 'Media' },
  { type: 'video', label: 'Video', description: 'Embed a YouTube or Vimeo video', icon: <Video size={24} />, category: 'Media' },
  { type: 'product_grid', label: 'Product Grid', description: 'Display products in a grid', icon: <ShoppingBag size={24} />, category: 'Store' },
  { type: 'collection_grid', label: 'Collection Grid', description: 'Display collections in a grid', icon: <Grid3x3 size={24} />, category: 'Store' },
  { type: 'featured_product', label: 'Featured Product', description: 'Spotlight a single product', icon: <Star size={24} />, category: 'Store' },
  { type: 'testimonials', label: 'Testimonials', description: 'Customer reviews and testimonials', icon: <MessageSquare size={24} />, category: 'Content' },
  { type: 'faq', label: 'FAQ', description: 'Frequently asked questions accordion', icon: <HelpCircle size={24} />, category: 'Content' },
  { type: 'ticker', label: 'Ticker Tape', description: 'Scrolling announcement text', icon: <AlignLeft size={24} />, category: 'Content' },
  { type: 'features', label: 'Features Grid', description: 'Icons and text grid', icon: <LayoutGrid size={24} />, category: 'Content' },
  { type: 'custom_html', label: 'Custom HTML', description: 'Raw HTML block for advanced users', icon: <Code size={24} />, category: 'Advanced' },
];

export const CATEGORIES = ['Layout', 'Text', 'Media', 'Store', 'Content', 'Advanced'];

export function BlockLibrary({ onSelect, onClose }: Props) {
  return (
    <div className="pb-modal-overlay" onClick={onClose}>
      <div className="pb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pb-modal-header">
          <h2>Add a Block</h2>
          <button className="btn btn-ghost btn-icon-sm" onClick={onClose}>✕</button>
        </div>
        <div className="pb-modal-body">
          {CATEGORIES.map((cat) => {
            const options = BLOCK_OPTIONS.filter((o) => o.category === cat);
            if (options.length === 0) return null;
            return (
              <div key={cat} className="pb-library-category">
                <h4>{cat}</h4>
                <div className="pb-library-grid">
                  {options.map((opt) => (
                    <button
                      key={opt.type}
                      className="pb-library-item"
                      onClick={() => onSelect(opt.type)}
                    >
                      <div className="pb-library-icon">{opt.icon}</div>
                      <div className="pb-library-label">{opt.label}</div>
                      <div className="pb-library-desc">{opt.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
