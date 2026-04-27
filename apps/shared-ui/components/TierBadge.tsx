// TierBadge — displays a guest's Cyrano subscription tier with a colour-coded badge.
import React from 'react';
import type { SubscriptionTier } from '../../portals/portal.types';

// Re-export for consumers that import from shared-ui
export type { SubscriptionTier };

const TIER_COLORS: Record<SubscriptionTier | 'FREE', string> = {
  FREE:    '#9e9e9e',
  SPARK:   '#2196f3',
  FLAME:   '#9c27b0',
  INFERNO: '#f44336',
};

interface TierBadgeProps {
  tier: SubscriptionTier | 'FREE';
}

export function TierBadge({ tier }: TierBadgeProps): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2em 0.7em',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        backgroundColor: TIER_COLORS[tier] ?? '#9e9e9e',
        color: '#fff',
      }}
    >
      {tier}
    </span>
  );
}
