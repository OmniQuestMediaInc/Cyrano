// PAYLOAD 7 — Accessibility helpers for the UI layer.
// Pure functions used by view-models and component shells to produce
// consistent ARIA labels, keyboard hints, and contrast-safe color choices.

import { paletteFor, ThemeMode } from './theme';

export interface AccessibilityHint {
  aria_label: string;
  keyboard_shortcut?: string;
  role?: string;
}

/** Builds an ARIA label for a Heat-tier badge. */
export function heatTierAriaLabel(
  tier: 'COLD' | 'WARM' | 'HOT' | 'INFERNO',
  score: number,
): string {
  return `Room heat ${tier.toLowerCase()}, score ${score} of 100`;
}

/** Builds an ARIA label for a Diamond KPI card. */
export function kpiAriaLabel(label: string, value: string, trend: 'UP' | 'DOWN' | 'FLAT'): string {
  const trendCopy = trend === 'UP' ? 'trending up' : trend === 'DOWN' ? 'trending down' : 'stable';
  return `${label}: ${value}, ${trendCopy}`;
}

/** Returns a high-contrast text color for a given surface color. */
export function contrastTextFor(surfaceHex: string, mode: ThemeMode): string {
  const palette = paletteFor(mode);
  const lum = relativeLuminance(surfaceHex);
  return lum > 0.5 ? palette.text_inverse : palette.text_primary;
}

/** WCAG relative luminance (sRGB). */
function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return { r, g, b };
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

/**
 * Mobile breakpoint matrix used by the responsive container. Sourced from
 * the OQMI device matrix (375 mobile / 768 tablet / 1280 desktop / 1680 wide).
 */
export const BREAKPOINTS_PX = {
  mobile: 375,
  tablet: 768,
  desktop: 1280,
  wide: 1680,
} as const;

export function resolveBreakpoint(viewport_px: number): keyof typeof BREAKPOINTS_PX {
  if (viewport_px >= BREAKPOINTS_PX.wide) return 'wide';
  if (viewport_px >= BREAKPOINTS_PX.desktop) return 'desktop';
  if (viewport_px >= BREAKPOINTS_PX.tablet) return 'tablet';
  return 'mobile';
}
