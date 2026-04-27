// Portal: LOTUS_BLOOM — Asian-inspired elegance portal
import type { PortalConfig } from '../portal.types';

export const portalConfig: PortalConfig = {
  id: 'LOTUS_BLOOM',
  name: 'Lotus Bloom',
  tagline: 'Delicate. Elegant. Irresistible.',
  defaultCharacterPacks: [
    { name: 'Luna Mei', persona: 'graceful' },
    { name: 'Sakura Vale', persona: 'serene' },
    { name: 'Kai Lennox', persona: 'male companion' },
    { name: 'Aiko Rose', persona: 'playful' },
  ],
  ageGate: 18,
  theme: {
    primaryColor: '#1a0a1e',
    accentColor: '#f8a5c2',
  },
};
