import mjml2html from 'mjml-browser';
import { BRAND, SOCIAL_PLATFORMS, replaceMergeTags, loadGoogleFont } from './constants';
import type { BlockData } from './constants';

/** Ensure a URL has a protocol — adds https:// if missing */
function normalizeUrl(url: string): string {
  if (!url || url === '#' || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('/') || url.startsWith('{{')) return url;
  return `https://${url}`;
}

function inlineQuillStyles(html: string, linkColor: string): string {
  if (!html) return html;
  const lc = linkColor || BRAND;
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/class="ql-align-center"/g, 'style="text-align:center"')
    .replace(/class="ql-align-right"/g, 'style="text-align:right"')
    .replace(/class="ql-align-justify"/g, 'style="text-align:justify"')
    .replace(/<a /g, `<a style="color:${lc};text-decoration:underline" `);
}

function extractYoutubeId(url: string): string {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  return m ? m[1] : '';
}

const SOCIAL_ICON_URLS: Record<string, string> = {
  facebook:  'https://cdn.simpleicons.org/facebook/1877F2',
  instagram: 'https://cdn.simpleicons.org/instagram/E4405F',
  x:         'https://cdn.simpleicons.org/x/000000',
  youtube:   'https://cdn.simpleicons.org/youtube/FF0000',
  linkedin:  'https://cdn.simpleicons.org/linkedin/0A66C2',
  tiktok:    'https://cdn.simpleicons.org/tiktok/000000',
};

export function blockToMjml(block: BlockData, gs: Record<string, any> = {}, preserveTags = false, customData?: Record<string, string>): string {
  const { type, data } = block;
  const font = data.fontFamily || gs.fontFamily || "'Inter', sans-serif";
  const tc = gs.textColor || '#1f2937';
  const lc = gs.linkColor || BRAND;
  const w = gs.width || 600;
  const p = data.padding || {};
  const ps = `${p.top||0}px ${p.right||0}px ${p.bottom||0}px ${p.left||0}px`;

  switch (type) {
    case 'heading': {
      const sz = data.level === 'h1' ? '28px' : data.level === 'h3' ? '18px' : '22px';
      const cbg = data.bgColor ? ` container-background-color="${data.bgColor}"` : '';
      return `<mj-text color="${data.color||tc}" padding="${ps}" font-size="${sz}" font-weight="700" line-height="1.3" font-family="${font}"${cbg}>${inlineQuillStyles(replaceMergeTags(data.content, preserveTags, customData), lc)}</mj-text>`;
    }
    case 'text': {
      const cbg = data.bgColor ? ` container-background-color="${data.bgColor}"` : '';
      return `<mj-text color="${data.color||tc}" font-size="15px" line-height="1.7" padding="${ps}" font-family="${font}"${cbg}>${inlineQuillStyles(replaceMergeTags(data.content, preserveTags, customData), lc)}</mj-text>`;
    }
    case 'image': {
      if (!data.src) return '';
      const iw = data.width ? Math.round((Number(data.width)/100)*w) : w;
      const r = data.borderRadius ? `border-radius="${data.borderRadius}px"` : '';
      return `<mj-image src="${data.src}" alt="${data.alt||''}" width="${iw}px" align="${data.align||'center'}" padding="${ps}" ${r} />`;
    }
    case 'button': {
      const btnLink = normalizeUrl(replaceMergeTags(data.link||'#', preserveTags, customData));
      return `<mj-button href="${btnLink}" align="${data.align||'center'}" padding="${ps}" inner-padding="${data.paddingV||12}px ${data.paddingH||32}px" background-color="${data.bgColor||BRAND}" color="${data.textColor||'#fff'}" border-radius="${data.borderRadius||8}px" font-weight="${data.fontWeight||600}" font-size="${data.fontSize||15}px" font-family="${font}" ${data.fullWidth?'width="100%"':''}>${data.text||'Button'}</mj-button>`;
    }
    case 'divider':
      return `<mj-divider border-width="${data.thickness||1}px" border-style="${data.style||'solid'}" border-color="${data.color||'#e5e7eb'}" width="${data.width||100}%" padding="${data.marginTop||8}px 0 ${data.marginBottom||8}px" />`;
    case 'spacer':
      return `<mj-spacer height="${data.height||32}px" />`;
    case 'merge_tag':
      return `<mj-text padding="${ps}" font-size="${data.fontSize||15}px" font-weight="${data.fontWeight||400}" color="${data.color||tc}" font-family="${font}">${replaceMergeTags(data.tag||'', preserveTags, customData)}</mj-text>`;

    case 'social': {
      const platforms = data.platforms || {};
      const iconSz = Number(data.iconSize || 32) + 'px';
      const active = SOCIAL_PLATFORMS.filter(plat => platforms[plat.key]);
      if (active.length === 0) return '';
      const els = active.map(plat =>
        `<mj-social-element name="${plat.key === 'x' ? 'x-noshare' : plat.key}" href="${normalizeUrl(platforms[plat.key])}" icon-size="${iconSz}" background-color="transparent" src="${SOCIAL_ICON_URLS[plat.key] || ''}" alt="${plat.label}"></mj-social-element>`
      ).join('');
      return `<mj-social font-size="0" icon-size="${iconSz}" mode="horizontal" padding="${ps}" align="${data.align||'center'}" inner-padding="${Math.round(Number(data.spacing||12)/2)}px">${els}</mj-social>`;
    }

    case 'html':
      if (!data.content) return '';
      return `<mj-raw>${data.content}</mj-raw>`;

    case 'video': {
      const thumb = data.thumbnailUrl || (data.videoUrl?.includes('youtube') ? `https://img.youtube.com/vi/${extractYoutubeId(data.videoUrl)}/maxresdefault.jpg` : '');
      if (!thumb) return '';
      const vw = data.width ? Math.round((Number(data.width)/100)*w) : w;
      const r = data.borderRadius ? `border-radius="${data.borderRadius}px"` : '';
      return `<mj-image src="${thumb}" alt="${data.alt||'Play video'}" width="${vw}px" align="${data.align||'center'}" padding="${ps}" ${r} href="${data.videoUrl||'#'}" />`;
    }

    case 'countdown': {
      if (!data.endDate) return '';
      const bg = data.bgColor || BRAND;
      const ctc = data.textColor || '#ffffff';
      const fs = data.fontSize || 18;
      const target = new Date(data.endDate);
      const formatted = target.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      const diff = Math.max(0, target.getTime() - Date.now());
      const dd = String(Math.floor(diff / 86400000)).padStart(2, '0');
      const hh = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
      const mm = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const ss = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');

      const digitStyle = `font-size:${fs}px;font-weight:800;color:${ctc};background:rgba(0,0,0,0.15);border-radius:6px;padding:8px 14px;display:inline-block;min-width:40px;text-align:center;`;
      const labelStyle = `font-size:10px;color:${ctc};opacity:0.7;margin-top:4px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;`;
      const sepStyle  = `font-size:${fs}px;font-weight:800;color:${ctc};padding:0 4px;vertical-align:top;line-height:42px;`;
      const cellStyle = `display:inline-block;text-align:center;`;

      return `<mj-section padding="${ps}" background-color="${bg}" border-radius="8px">
        <mj-column width="100%">
          ${data.label ? `<mj-text align="center" color="${ctc}" font-size="13px" font-weight="600" padding="0 0 8px" css-class="countdown-label">${data.label}</mj-text>` : ''}
          <mj-text align="center" padding="0" font-family="${font}">
            <div style="text-align:center;">
              <div style="${cellStyle}"><div style="${digitStyle}">${dd}</div><div style="${labelStyle}">DAYS</div></div>
              <span style="${sepStyle}">:</span>
              <div style="${cellStyle}"><div style="${digitStyle}">${hh}</div><div style="${labelStyle}">HOURS</div></div>
              <span style="${sepStyle}">:</span>
              <div style="${cellStyle}"><div style="${digitStyle}">${mm}</div><div style="${labelStyle}">MINS</div></div>
              <span style="${sepStyle}">:</span>
              <div style="${cellStyle}"><div style="${digitStyle}">${ss}</div><div style="${labelStyle}">SECS</div></div>
            </div>
            <div style="text-align:center;margin-top:8px;font-size:12px;color:${ctc};opacity:0.8;">${formatted}</div>
          </mj-text>
        </mj-column>
      </mj-section>`;
    }

    case 'columns': {
      const parts = (data.layout||'50-50').split('-').map(Number);
      const cols = data.columns || [];
      const html = cols.map((col: any, i: number) => {
        const pct = parts[i] || 50;
        const inner = (col.blocks||[]).map((sb: BlockData) => blockToMjml(sb, gs, preserveTags, customData)).join('');
        const colBg = col.bgColor ? ` background-color="${col.bgColor}"` : '';
        return `<mj-column width="${pct}%" padding="12px" vertical-align="${data.verticalAlign||'top'}"${colBg}>${inner||'<mj-text> </mj-text>'}</mj-column>`;
      }).join('');
      return `<mj-section padding="${ps}">${html}</mj-section>`;
    }

    default: return '';
  }
}

export function generateEmailHtml(blocks: BlockData[], settings: Record<string, any>, preserveTags = false, customData?: Record<string, string>): string {
  const font = settings.fontFamily || "'Inter', sans-serif";
  const fontName = font.replace(/'/g,'').split(',')[0].trim();
  const tc = settings.textColor || '#1f2937';
  const lc = settings.linkColor || BRAND;
  const bodyBg = settings.bodyBg || '#f5f5f5';
  const contentBg = settings.contentBg || '#ffffff';
  const w = settings.width || 600;

  if (fontName && fontName !== 'System Default') loadGoogleFont(fontName);

  const fontTag = fontName && fontName !== 'System Default'
    ? `<mj-font name="${fontName}" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;600;700&display=swap" />`
    : '';

  const blocksMjml = blocks.map(b => {
    const piece = blockToMjml(b, settings, preserveTags, customData);
    if (!piece) return '';
    if (b.type === 'columns' || b.type === 'countdown') return piece;
    return `<mj-section padding="8px 0"><mj-column width="100%">${piece}</mj-column></mj-section>`;
  }).join('');

  const logoMjml = settings.logoUrl ? `<mj-section padding="24px 0"><mj-column width="100%"><mj-image src="${settings.logoUrl}" alt="Logo" width="160px" align="center" padding="0" /></mj-column></mj-section>` : '';
  const footerMjml = settings.footerText ? `<mj-section padding="0"><mj-column width="100%"><mj-divider border-width="1px" border-color="#e5e7eb" width="100%" padding="0" /></mj-column></mj-section><mj-section padding="16px 24px"><mj-column width="100%"><mj-text align="center" font-size="12px" line-height="1.6" color="#9ca3af" font-family="${font}">${inlineQuillStyles(replaceMergeTags(settings.footerText, preserveTags, customData), lc)}</mj-text></mj-column></mj-section>` : '';
  const previewMjml = settings.previewText ? `<mj-preview>${settings.previewText}</mj-preview>` : '';

  const mjml = `<mjml><mj-head><mj-title>${settings.subject||''}</mj-title>${previewMjml}${fontTag}<mj-attributes><mj-all font-family="${font}" /><mj-text font-size="15px" color="${tc}" line-height="1.7" /></mj-attributes><mj-style>a{color:${lc};text-decoration:underline}p{margin:0}p:empty,p br:only-child{min-height:1em;display:block}h1,h2,h3{margin:0 0 4px;font-weight:700}</mj-style></mj-head><mj-body background-color="${bodyBg}" width="${w}px"><mj-wrapper background-color="${contentBg}" padding="24px 20px" border-radius="8px">${logoMjml}${blocksMjml||'<mj-section padding="24px 0"><mj-column width="100%"><mj-text align="center" color="#9ca3af" padding="48px 0">No content blocks</mj-text></mj-column></mj-section>'}${footerMjml}</mj-wrapper></mj-body></mjml>`;

  try {
    const { html } = mjml2html(mjml, { validationLevel: 'soft' });
    return html;
  } catch (e: any) {
    return `<p>Error: ${e.message}</p>`;
  }
}
