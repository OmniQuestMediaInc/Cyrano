// Portal: INK_AND_STEEL — Alternative / punk aesthetic portal
import type { PortalConfig } from '../portal.types';

export const portalConfig: PortalConfig = {
  id: 'INK_AND_STEEL',
  name: 'Ink & Steel',
  tagline: 'Tattooed. Dominant. Addictive.',
  defaultCharacterPacks: [
    { name: 'Raven Steele', persona: 'punk domme' },
    { name: 'Jax Thorn', persona: 'muscular alt' },
    { name: 'Diesel Kane', persona: 'edgy rebel' },
  ],
  ageGate: 18,
  theme: {
    primaryColor: '#0d0d0d',
    accentColor: '#c0392b',
  },
};
