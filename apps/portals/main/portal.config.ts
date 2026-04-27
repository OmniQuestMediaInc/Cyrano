// Portal: MAIN — Cyrano flagship portal
import type { PortalConfig } from '../portal.types';

export const portalConfig: PortalConfig = {
  id: 'MAIN',
  name: 'Cyrano',
  tagline: 'Your Perfect AI Companion – Any Fantasy, One Engine',
  defaultCharacterPacks: [
    { name: 'Alex Rivers', persona: 'versatile' },
    { name: 'Sophia Vale', persona: 'elegant' },
  ],
  ageGate: 18,
  theme: {
    primaryColor: '#1a1a2e',
    accentColor: '#e94560',
  },
};
