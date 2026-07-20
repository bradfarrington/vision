import {
  Type, AlignLeft, Image, MousePointerClick, Minus, Square,
  Columns2, Tag, Code, Share2, Play, Timer,
} from 'lucide-react';
import { Quill } from 'react-quill-new';

// Allow merge tags inside link URLs (Quill's default sanitizer would strip {{…}}).
const Link = Quill.import('formats/link') as any;
class CustomLink extends Link {
  static sanitize(url: string) {
    if (url && url.includes('{{') && url.includes('}}')) return url;
    return super.sanitize(url);
  }
}
Quill.register(CustomLink, true);

export const BRAND = '#4B0082';   // GamLEARN purple

export const QUILL_FULL = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    [{ color: [] }, { background: [] }],
    ['link'],
    ['clean'],
  ],
};

export const QUILL_HEADING = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ align: [] }],
    [{ color: [] }],
    ['clean'],
  ],
};

export const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'align', 'color', 'background', 'link',
];

export const GOOGLE_FONTS = [
  'Inter','Roboto','Open Sans','Lato','Montserrat','Poppins','Outfit',
  'Nunito','Raleway','Work Sans','DM Sans','Quicksand','Manrope',
  'Playfair Display','Merriweather','Lora','Cormorant Garamond',
  'Urbanist','Bebas Neue','Oswald','Dancing Script','Caveat',
].map(n => ({ name: n, value: `'${n}', sans-serif` }));

/* ────────────────────────────────────────────────────────────────────────
   Merge tags — keys are stored verbatim ({{…}}), but the picker shows
   only the human-readable label/group. Resolved by replaceMergeTags()
   below, or server-side by send-campaign edge function from real DB rows.
   ──────────────────────────────────────────────────────────────────────── */
export const MERGE_TAGS = [
  { group: 'Person', tags: [
    { key: '{{person_name}}',         label: 'Full Name' },
    { key: '{{person_first_name}}',   label: 'First Name' },
    { key: '{{person_last_name}}',    label: 'Last Name' },
    { key: '{{person_preferred_name}}', label: 'Preferred Name' },
    { key: '{{person_email}}',        label: 'Email' },
    { key: '{{person_phone}}',        label: 'Phone' },
    { key: '{{person_ref}}',          label: 'Reference Code' },
    { key: '{{person_address}}',      label: 'Address' },
    { key: '{{person_region}}',       label: 'Region' },
  ]},
  { group: 'Case', tags: [
    { key: '{{case_ref}}',            label: 'Case Reference' },
    { key: '{{case_type}}',           label: 'Case Type' },
    { key: '{{case_stage}}',          label: 'Case Stage' },
    { key: '{{case_overall_label}}',  label: 'RAG Status' },
    { key: '{{case_next_key_date}}',  label: 'Next Key Date' },
    { key: '{{case_next_key_label}}', label: 'Next Key Date Label' },
    { key: '{{case_opened_date}}',    label: 'Date Case Opened' },
  ]},
  { group: 'Worker', tags: [
    { key: '{{worker_name}}',         label: 'Key Worker Name' },
    { key: '{{worker_first_name}}',   label: 'Key Worker First Name' },
    { key: '{{worker_email}}',        label: 'Key Worker Email' },
    { key: '{{worker_role}}',         label: 'Key Worker Role' },
  ]},
  { group: 'Sender', tags: [
    { key: '{{sender_name}}',         label: 'Sender Name' },
    { key: '{{sender_first_name}}',   label: 'Sender First Name' },
    { key: '{{sender_email}}',        label: 'Sender Email' },
    { key: '{{sender_role}}',         label: 'Sender Role' },
  ]},
  { group: 'Organisation', tags: [
    { key: '{{org_name}}',            label: 'Organisation Name' },
    { key: '{{org_email}}',           label: 'Organisation Email' },
    { key: '{{org_phone}}',           label: 'Organisation Phone' },
    { key: '{{org_website}}',         label: 'Organisation Website' },
    { key: '{{org_address}}',         label: 'Organisation Address' },
  ]},
  { group: 'Support', tags: [
    { key: '{{support_plan_title}}',  label: 'Current Support Plan Title' },
    { key: '{{next_action_due}}',     label: 'Next Support Action Due' },
    { key: '{{next_check_in_due}}',   label: 'Next Check-in Due' },
    { key: '{{last_contact_date}}',   label: 'Last Contact Date' },
  ]},
  { group: 'Utility', tags: [
    { key: '{{current_date}}',        label: 'Current Date' },
    { key: '{{current_year}}',        label: 'Current Year' },
    { key: '{{unsubscribe_link}}',    label: 'Unsubscribe Link' },
    { key: '{{view_in_browser_link}}', label: 'View in Browser Link' },
  ]},
];

// Sample values used when previewing inside the builder. Real values come
// from the DB at send time (see send-campaign edge function).
export const SAMPLE_DATA: Record<string, string> = {
  '{{person_name}}': 'Jamie Carter',
  '{{person_first_name}}': 'Jamie',
  '{{person_last_name}}': 'Carter',
  '{{person_preferred_name}}': 'Jamie',
  '{{person_email}}': 'jamie@example.com',
  '{{person_phone}}': '07700 900000',
  '{{person_ref}}': 'P-0421',
  '{{person_address}}': '12 High Street, Sheffield',
  '{{person_region}}': 'South Yorkshire',
  '{{case_ref}}': 'C-0118',
  '{{case_type}}': 'Criminal Justice Support',
  '{{case_stage}}': 'Active Support',
  '{{case_overall_label}}': 'On Track',
  '{{case_next_key_date}}': new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  '{{case_next_key_label}}': 'Sentencing hearing',
  '{{case_opened_date}}': new Date(Date.now() - 60 * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  '{{worker_name}}': 'Sam Patel',
  '{{worker_first_name}}': 'Sam',
  '{{worker_email}}': 'sam.patel@gamlearn.org.uk',
  '{{worker_role}}': 'Peer Support Worker',
  '{{sender_name}}': 'Sam Patel',
  '{{sender_first_name}}': 'Sam',
  '{{sender_email}}': 'sam.patel@gamlearn.org.uk',
  '{{sender_role}}': 'Peer Support Worker',
  '{{org_name}}': 'GamLEARN',
  '{{org_email}}': 'info@gamlearn.org.uk',
  '{{org_phone}}': '0114 000 0000',
  '{{org_website}}': 'https://gamlearn.org.uk',
  '{{org_address}}': 'GamLEARN, Sheffield',
  '{{support_plan_title}}': 'Recovery Plan — Spring 2026',
  '{{next_action_due}}': new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  '{{next_check_in_due}}': new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  '{{last_contact_date}}': new Date(Date.now() - 5 * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  '{{current_date}}': new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  '{{current_year}}': String(new Date().getFullYear()),
  // Test sends substitute these placeholders. Real campaign sends generate
  // signed per-recipient unsubscribe URLs in the send-campaign edge function
  // — the values here are only ever seen in builder previews and test sends.
  '{{unsubscribe_link}}': 'https://gamlearn.org.uk/?preview=unsubscribe',
  '{{view_in_browser_link}}': 'https://gamlearn.org.uk/?preview=view-in-browser',
};

export interface BlockData {
  id: string;
  type: string;
  data: Record<string, any>;
}

export interface BlockDef {
  type: string;
  label: string;
  icon: any;
}

export const SOCIAL_PLATFORMS = [
  { key: 'facebook',  label: 'Facebook',     color: '#1877F2' },
  { key: 'instagram', label: 'Instagram',    color: '#E4405F' },
  { key: 'x',         label: 'X (Twitter)',  color: '#000000' },
  { key: 'youtube',   label: 'YouTube',      color: '#FF0000' },
  { key: 'linkedin',  label: 'LinkedIn',     color: '#0A66C2' },
  { key: 'tiktok',    label: 'TikTok',       color: '#000000' },
];

export const BLOCK_GROUPS: { label: string; blocks: BlockDef[] }[] = [
  { label: 'Content', blocks: [
    { type: 'heading',  label: 'Heading',      icon: Type },
    { type: 'text',     label: 'Text',         icon: AlignLeft },
    { type: 'image',    label: 'Image',        icon: Image },
    { type: 'button',   label: 'Button',       icon: MousePointerClick },
    { type: 'video',    label: 'Video',        icon: Play },
    { type: 'social',   label: 'Social Links', icon: Share2 },
  ]},
  { label: 'Layout', blocks: [
    { type: 'divider',  label: 'Divider',  icon: Minus },
    { type: 'spacer',   label: 'Spacer',   icon: Square },
    { type: 'columns',  label: 'Columns',  icon: Columns2 },
  ]},
  { label: 'Dynamic', blocks: [
    { type: 'merge_tag', label: 'Merge Field', icon: Tag },
    { type: 'countdown', label: 'Countdown',   icon: Timer },
  ]},
  { label: 'Advanced', blocks: [
    { type: 'html', label: 'Custom HTML', icon: Code },
  ]},
];

export const BLOCK_TYPE_MAP = Object.fromEntries(
  BLOCK_GROUPS.flatMap(g => g.blocks).map(b => [b.type, b])
);

export function makeBlock(type: string): BlockData {
  const defaults: Record<string, any> = {
    heading: { content: '<p>Your Heading Here</p>', level: 'h2', color: '', bgColor: '', fontFamily: '', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    text: { content: '<p>Write your email content here.</p>', color: '', bgColor: '', fontFamily: '', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    image: { src: '', alt: '', width: '100', align: 'center', link: '', borderRadius: '0', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    button: { text: 'Learn More', link: '#', align: 'center', bgColor: BRAND, textColor: '#ffffff', borderRadius: '8', fullWidth: false, fontSize: '15', fontWeight: '600', paddingV: '12', paddingH: '32', fontFamily: '', padding: { top: 8, right: 0, bottom: 8, left: 0 } },
    divider: { style: 'solid', color: '#e5e7eb', thickness: '1', width: '100', marginTop: '8', marginBottom: '8', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    spacer: { height: '32', bgColor: '', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    columns: { layout: '50-50', columns: [{ blocks: [] }, { blocks: [] }], gap: '16', verticalAlign: 'top', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    merge_tag: { tag: '{{person_name}}', fallback: '', fontSize: '15', fontWeight: '400', color: '', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    social: { platforms: { facebook: '', instagram: '', x: '', youtube: '', linkedin: '', tiktok: '' }, iconSize: '32', align: 'center', spacing: '12', iconStyle: 'filled', padding: { top: 8, right: 0, bottom: 8, left: 0 } },
    html: { content: '', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    video: { videoUrl: '', thumbnailUrl: '', alt: 'Video thumbnail', width: '100', align: 'center', borderRadius: '0', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    countdown: { endDate: '', label: 'Offer ends', bgColor: BRAND, textColor: '#ffffff', fontSize: '18', padding: { top: 12, right: 0, bottom: 12, left: 0 } },
  };
  return { id: crypto.randomUUID(), type, data: JSON.parse(JSON.stringify(defaults[type] || {})) };
}

const _loadedFonts = new Set<string>();
export function loadGoogleFont(name: string) {
  if (!name || _loadedFonts.has(name)) return;
  _loadedFonts.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

export function tagLabel(key: string): string {
  for (const g of MERGE_TAGS) {
    const t = g.tags.find(t => t.key === key);
    if (t) return `${g.group}: ${t.label}`;
  }
  return key;
}

export function cleanHtml(html: string): string {
  if (!html) return html;
  return html.replace(/&nbsp;/g, ' ').replace(/ /g, ' ');
}

export function replaceMergeTags(text: string, preserveTags = false, customData?: Record<string, string>): string {
  if (!text) return text;
  if (preserveTags) return text;
  const source = customData || SAMPLE_DATA;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
    // Strip any HTML tags Quill might have injected inside the braces
    const cleanInner = inner.replace(/<[^>]*>?/gm, '').trim().toLowerCase();
    const key = `{{${cleanInner}}}`;
    return source[key] !== undefined ? source[key] : match;
  });
}
