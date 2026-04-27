// shared-ui/lib/portal-seo.ts
// I — Portal SEO: per-portal descriptions and keyword sets for metadata generation.

export interface PortalSeoConfig {
  description: string;
  keywords: string[];
}

export const PORTAL_SEO: Record<string, PortalSeoConfig> = {
  'ink-and-steel': {
    description:
      'Hot tattooed, muscular, dominant AI companions that remember every desire.',
    keywords: [
      'tattooed AI boyfriend',
      'dominant alt AI',
      'punk AI companion',
      'tattooed AI girlfriend',
      'alt AI companion',
      'inked AI',
    ],
  },
  'lotus-bloom': {
    description:
      'Elegant Asian beauties from kawaii to seductive — your perfect AI match.',
    keywords: [
      'Asian AI girlfriend',
      'kawaii AI',
      'elegant Japanese AI',
      'Asian AI companion',
      'anime AI girlfriend',
      'Japanese AI',
    ],
  },
  'desperate-housewives': {
    description:
      'Polished, seductive suburban AI companions with an irresistible taste for excitement.',
    keywords: [
      'suburban AI girlfriend',
      'mature AI companion',
      'MILF AI',
      'seductive AI',
      'housewife AI',
      'married AI companion',
    ],
  },
  'barely-legal': {
    description:
      'Fresh, flirty, and fearless AI companions — bright-eyed and bold.',
    keywords: [
      'young AI companion',
      'flirty AI girlfriend',
      'fresh AI',
      'playful AI companion',
      'college AI girlfriend',
      'fun AI companion',
    ],
  },
  'dark-desires': {
    description:
      'Dark, magnetic AI companions that draw you in with forbidden intensity.',
    keywords: [
      'dark AI companion',
      'gothic AI girlfriend',
      'intense AI',
      'forbidden AI companion',
      'mysterious AI girlfriend',
      'dark romance AI',
    ],
  },
};

export function getPortalDescription(portal: string): string {
  return (
    PORTAL_SEO[portal]?.description ?? 'Your perfect AI companion awaits.'
  );
}

export function getPortalKeywords(portal: string): string[] {
  return PORTAL_SEO[portal]?.keywords ?? ['AI companion', 'AI girlfriend'];
}
