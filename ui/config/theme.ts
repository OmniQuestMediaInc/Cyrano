// PAYLOAD 7 — Canonical brand + theme tokens for ChatNow.Zone.
// Adult-platform standard: dark mode is the default + only canonical theme.
// "Black-Glass Interface" doctrine: matte black surfaces, glass overlays,
// muted accents with a single hot accent for revenue cues. The full Black-Glass
// build is tracked under G101+ in REQUIREMENTS_MASTER and remains
// NEEDS_DIRECTIVE; this token set is the pre-launch baseline that downstream
// renderers (Next.js, server-rendered email, OBS overlays) consume.

export type ThemeMode = 'dark' | 'light';

export interface ColorPalette {
  // Surfaces
  background: string;
  surface: string;
  surface_raised: string;
  surface_overlay: string;
  border: string;
  divider: string;
  // Foreground
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  text_inverse: string;
  // Brand + accents
  brand_primary: string;
  brand_primary_hover: string;
  accent_revenue: string;
  accent_warning: string;
  accent_danger: string;
  accent_success: string;
  // Tier accents — one per Heat tier for the Room-Heat meter.
  heat_cold: string;
  heat_warm: string;
  heat_hot: string;
  heat_inferno: string;
}

const DARK_PALETTE: ColorPalette = {
  background: '#000000',
  surface: '#0b0b0d',
  surface_raised: '#141417',
  surface_overlay: 'rgba(255, 255, 255, 0.04)',
  border: '#1f1f23',
  divider: '#2a2a2f',
  text_primary: '#f5f5f7',
  text_secondary: '#c7c7d1',
  text_muted: '#8a8a93',
  text_inverse: '#0a0a0a',
  brand_primary: '#d4af37', // OQMI gold
  brand_primary_hover: '#e6c050',
  accent_revenue: '#ff6b35', // hot revenue cue
  accent_warning: '#f5a623',
  accent_danger: '#ff3b3b',
  accent_success: '#34c759',
  heat_cold: '#3a86ff',
  heat_warm: '#fcbf49',
  heat_hot: '#f77f00',
  heat_inferno: '#d62828',
};

const LIGHT_PALETTE: ColorPalette = {
  background: '#fafaf7',
  surface: '#ffffff',
  surface_raised: '#f1f1ee',
  surface_overlay: 'rgba(0, 0, 0, 0.04)',
  border: '#e0e0db',
  divider: '#cfcfca',
  text_primary: '#0a0a0a',
  text_secondary: '#3a3a3f',
  text_muted: '#6a6a72',
  text_inverse: '#ffffff',
  brand_primary: '#a8862a',
  brand_primary_hover: '#c1a13a',
  accent_revenue: '#cc4d1e',
  accent_warning: '#b87f1c',
  accent_danger: '#c2342f',
  accent_success: '#1e8a3a',
  heat_cold: '#1f5fcc',
  heat_warm: '#cc8e1f',
  heat_hot: '#bb5e0d',
  heat_inferno: '#a01a1a',
};

export const THEME = {
  default_mode: 'dark' as ThemeMode,
  palettes: {
    dark: DARK_PALETTE,
    light: LIGHT_PALETTE,
  },
  typography: {
    family_sans: '"Inter", "Helvetica Neue", system-ui, sans-serif',
    family_mono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
    family_display: '"Canela", "Playfair Display", Georgia, serif',
    base_size_px: 14,
    line_height: 1.5,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 20,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 40,
  },
  motion: {
    duration_fast_ms: 120,
    duration_base_ms: 220,
    duration_slow_ms: 420,
    easing_standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  },
} as const;

export function paletteFor(mode: ThemeMode): ColorPalette {
  return THEME.palettes[mode];
}

/**
 * Resolves the heat-tier accent color from the palette. Used by the
 * Room-Heat meter component on /creator/control.
 */
export function heatColorFor(
  tier: 'COLD' | 'WARM' | 'HOT' | 'INFERNO',
  mode: ThemeMode = THEME.default_mode,
): string {
  const p = paletteFor(mode);
  switch (tier) {
    case 'COLD':
      return p.heat_cold;
    case 'WARM':
      return p.heat_warm;
    case 'HOT':
      return p.heat_hot;
    case 'INFERNO':
      return p.heat_inferno;
  }
}
