// Portal configuration type shared by all 6 portals.

export type SubscriptionTier = 'SPARK' | 'FLAME' | 'INFERNO';

export type Portal =
  | 'MAIN'
  | 'INK_AND_STEEL'
  | 'LOTUS_BLOOM'
  | 'DESPERATE_HOUSEWIVES'
  | 'BARELY_LEGAL'
  | 'DARK_DESIRES';

export interface CharacterPack {
  name: string;
  persona: string;
}

export interface PortalConfig {
  id: string;
  name: string;
  tagline: string;
  defaultCharacterPacks: CharacterPack[];
  /** Minimum age gate for this portal (18 for all, enforced at platform level). */
  ageGate: 18;
  theme: {
    primaryColor: string;
    accentColor: string;
  };
}
