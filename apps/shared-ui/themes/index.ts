export interface PortalTheme {
  primary: string;
  accent: string;
  background: string;
  name: string;
  tagline: string;
}

export const themes: Record<string, PortalTheme> = {
  MAIN: {
    primary: '#7C3AED',
    accent: '#EC4899',
    background: '#0F172A',
    name: 'Cyrano AI',
    tagline: 'Your Perfect AI Companion',
  },
  INK_AND_STEEL: {
    primary: '#B91C1C',
    accent: '#F59E0B',
    background: '#111111',
    name: 'Ink & Steel',
    tagline: 'Tattooed • Dominant • Unforgettable',
  },
  LOTUS_BLOOM: {
    primary: '#DB2777',
    accent: '#22D3EE',
    background: '#0F172A',
    name: 'Lotus Bloom',
    tagline: 'Elegant • Mysterious • Irresistible',
  },
  DESPERATE_HOUSEWIVES: {
    primary: '#D97706',
    accent: '#E11D48',
    background: '#1C1917',
    name: 'Desperate Housewives',
    tagline: 'Suburban • Seductive • Scandalous',
  },
  BARELY_LEGAL: {
    primary: '#F472B6',
    accent: '#A78BFA',
    background: '#0F172A',
    name: 'Barely Legal',
    tagline: 'Fresh • Flirty • Fearless',
  },
  DARK_DESIRES: {
    primary: '#6D28D9',
    accent: '#DC2626',
    background: '#030712',
    name: 'Dark Desires',
    tagline: 'Forbidden • Intense • Unforgettable',
  },
};

export function getTheme(portal: string): PortalTheme {
  return themes[portal] ?? themes['MAIN'];
}
