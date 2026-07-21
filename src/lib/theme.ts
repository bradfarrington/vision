import type { CSSProperties } from "react";

// Vision platform accent (blue) — the default when a tenant has no brand colour.
// Mirrors the values in globals.css / the _ds colour tokens.
export const VISION_ACCENT = "#2f7de1";

type Company = {
  name: string | null;
  brand_color_1: string | null;
  brand_color_2: string | null;
  logo_url: string | null;
};

// Accept #rgb / #rrggbb (with or without leading #). Anything else falls back
// to the Vision accent, so a bad DB value can never produce an invalid theme.
function normaliseHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = input.trim();
  const hex = v.startsWith("#") ? v : `#${v}`;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex) ? hex : null;
}

/**
 * Build the per-tenant CSS custom properties for the app shell.
 *
 * The tenant's `brand_color_1` fills the accent slot; hover / active / tint
 * shades are derived from it at render time with `color-mix` (no colour maths
 * in JS, and it re-shades correctly whatever the tenant picks). Semantic
 * colours (success/warning/danger) are deliberately NOT themed — they stay
 * platform-fixed per the design system.
 *
 * Applied as an inline style on the shell root so it overrides the blue
 * defaults declared in globals.css for everything inside the app.
 */
export function tenantThemeVars(company: Company | null): CSSProperties {
  const accent = normaliseHex(company?.brand_color_1) ?? VISION_ACCENT;

  return {
    // shadcn primary + focus ring track the tenant accent…
    "--primary": accent,
    "--primary-foreground": "#ffffff",
    "--ring": accent,
    // …as do the Vision-specific accent tokens used directly in components.
    "--accent-blue": accent,
    "--accent-hover": `color-mix(in srgb, ${accent} 85%, black)`,
    "--accent-active": `color-mix(in srgb, ${accent} 72%, black)`,
    "--accent-tint": `color-mix(in srgb, ${accent} 12%, white)`,
  } as CSSProperties;
}
