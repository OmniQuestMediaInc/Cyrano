// Portal: BARELY_LEGAL — 18+ verified newcomer fantasy portal.
// All characters are explicitly 18+ adults. Strict legal framing is enforced
// on every prompt, response, and character description system-wide.
import type { PortalConfig } from '../portal.types';

export const portalConfig: PortalConfig = {
  id: 'BARELY_LEGAL',
  name: 'Barely Legal',
  tagline: 'Just Turned 18 – Fresh, Curious & Ready',
  defaultCharacterPacks: [
    // All characters are 18-year-old adults. Legal framing is enforced everywhere.
    { name: 'Riley Quinn', persona: '18-year-old adult — legal framing enforced' },
    { name: 'Tyler Brooks', persona: '18-year-old adult — legal framing enforced' },
  ],
  ageGate: 18,
  theme: {
    primaryColor: '#0a1628',
    accentColor: '#3498db',
  },
};
