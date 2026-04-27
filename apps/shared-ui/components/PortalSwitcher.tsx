// PortalSwitcher — dropdown to navigate between the 6 Cyrano portals.
import React from 'react';

export type PortalId =
  | 'MAIN'
  | 'INK_AND_STEEL'
  | 'LOTUS_BLOOM'
  | 'DESPERATE_HOUSEWIVES'
  | 'BARELY_LEGAL'
  | 'DARK_DESIRES';

const PORTAL_LABELS: Record<PortalId, string> = {
  MAIN:                  'Cyrano',
  INK_AND_STEEL:         'Ink & Steel',
  LOTUS_BLOOM:           'Lotus Bloom',
  DESPERATE_HOUSEWIVES:  'Desperate Housewives',
  BARELY_LEGAL:          'Barely Legal',
  DARK_DESIRES:          'Dark Desires',
};

interface PortalSwitcherProps {
  current: PortalId;
  onChange: (portal: PortalId) => void;
}

export function PortalSwitcher({ current, onChange }: PortalSwitcherProps): React.ReactElement {
  const portals = Object.keys(PORTAL_LABELS) as PortalId[];

  return (
    <div style={{ display: 'inline-block' }}>
      <label htmlFor="portal-switcher" style={{ marginRight: '0.5rem', fontWeight: 600 }}>
        Portal:
      </label>
      <select
        id="portal-switcher"
        value={current}
        onChange={(e) => onChange(e.target.value as PortalId)}
        style={{
          padding: '0.4rem 0.75rem',
          borderRadius: '6px',
          border: '1px solid #ccc',
          fontSize: '0.9rem',
          cursor: 'pointer',
        }}
      >
        {portals.map((portalId) => (
          <option key={portalId} value={portalId}>
            {PORTAL_LABELS[portalId]}
          </option>
        ))}
      </select>
    </div>
  );
}
