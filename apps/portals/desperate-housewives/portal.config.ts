// Portal: DESPERATE_HOUSEWIVES — Suburban fantasy portal
import type { PortalConfig } from '../portal.types';

export const portalConfig: PortalConfig = {
  id: 'DESPERATE_HOUSEWIVES',
  name: 'Desperate Housewives',
  tagline: "The Naughty Neighbor You've Always Wanted",
  defaultCharacterPacks: [
    { name: 'Vanessa Hart', persona: 'suburban seductress' },
    { name: 'Sophia Monroe', persona: 'flirtatious neighbor' },
    { name: 'Marcus Reed', persona: 'mature companion' },
  ],
  ageGate: 18,
  theme: {
    primaryColor: '#1e1010',
    accentColor: '#e67e22',
  },
};
