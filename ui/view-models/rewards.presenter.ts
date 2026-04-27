// PAYLOAD K+M — Presenters for the Rewards Dashboard and Diamond Concierge page.
// Pure transformation — no NestJS, no I/O, no DB calls.

import { EARNING_RULES, BURN_COSTS } from '../../services/core-api/src/rr-rewards/rr.service';
import type {
  UserRrPointsEntry,
  BurnRewardGrantRecord,
} from '../../services/core-api/src/rr-rewards/rr.service';
import type {
  ConciergeSessionRecord,
} from '../../services/core-api/src/diamond-concierge/concierge-session.service';
import type {
  ActiveGrantViewModel,
  BurnShopItem,
  ConciergeSessionViewModel,
  DiamondConciergeDashboardView,
  RewardsDashboardView,
  RrrPointsEntryViewModel,
} from '../types/rewards-contracts';

const BURN_LABELS: Record<string, { label: string; description: string }> = {
  EXTRA_IMAGES: {
    label: 'Extra Images',
    description: 'Unlock 10 additional image generations valid for 30 days.',
  },
  TEMP_INFERNO: {
    label: 'Inferno Access (7-day)',
    description: 'Temporary upgrade to the Inferno subscription tier for 7 days.',
  },
  CUSTOM_TWIN: {
    label: 'Custom Twin',
    description: 'Commission a fully personalised AI Twin with custom narrative and voice.',
  },
};

const BURN_EXPIRY_DAYS: Record<string, number | null> = {
  EXTRA_IMAGES: 30,
  TEMP_INFERNO: 7,
  CUSTOM_TWIN:  null,
};

function toEntryViewModel(e: UserRrPointsEntry): RrrPointsEntryViewModel {
  return {
    id: e.id,
    amount: e.amount,
    action: e.action,
    description: e.description,
    created_at_utc: e.created_at.toISOString(),
  };
}

function toGrantViewModel(g: BurnRewardGrantRecord): ActiveGrantViewModel {
  return {
    grant_id: g.id,
    reward_type: g.reward_type as ActiveGrantViewModel['reward_type'],
    points_burned: g.points_burned,
    expires_at_utc: g.expires_at ? g.expires_at.toISOString() : null,
  };
}

function buildBurnShop(): BurnShopItem[] {
  return (Object.keys(BURN_COSTS) as Array<keyof typeof BURN_COSTS>).map((reward) => ({
    reward,
    label: BURN_LABELS[reward]?.label ?? reward,
    description: BURN_LABELS[reward]?.description ?? '',
    cost_points: BURN_COSTS[reward],
    expires_in_days: BURN_EXPIRY_DAYS[reward] ?? null,
  }));
}

export interface RewardsDashboardPresenterInput {
  user_id: string;
  balance: number;
  history: UserRrPointsEntry[];
  active_grants: BurnRewardGrantRecord[];
  cross_portal_enabled?: boolean;
}

/** Transform service-side reward data into the dashboard view model. */
export function presentRewardsDashboard(
  input: RewardsDashboardPresenterInput,
): RewardsDashboardView {
  return {
    user_id: input.user_id,
    balance: input.balance,
    history: input.history.map(toEntryViewModel),
    burn_shop: buildBurnShop(),
    active_grants: input.active_grants.map(toGrantViewModel),
    cross_portal_enabled: input.cross_portal_enabled ?? false,
    captured_at_utc: new Date().toISOString(),
  };
}

export interface DiamondConciergePresenterInput {
  user_id: string;
  tier_permitted: boolean;
  sessions: ConciergeSessionRecord[];
}

function toSessionViewModel(s: ConciergeSessionRecord): ConciergeSessionViewModel {
  return {
    id: s.id,
    request_summary: s.request.length > 120 ? s.request.slice(0, 117) + '…' : s.request,
    status: s.status,
    priority: s.priority,
    created_at_utc: s.created_at.toISOString(),
  };
}

/** Transform service-side concierge data into the dashboard view model. */
export function presentDiamondConciergeDashboard(
  input: DiamondConciergePresenterInput,
): DiamondConciergeDashboardView {
  const sessions = input.sessions
    .slice()
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .map(toSessionViewModel);

  return {
    user_id: input.user_id,
    tier_permitted: input.tier_permitted,
    sessions,
    captured_at_utc: new Date().toISOString(),
  };
}

/** Earning-rule reference card for display in the rewards UI. */
export interface EarningRuleCard {
  action: string;
  label: string;
  points: number;
}

const EARNING_LABELS: Record<string, string> = {
  DAILY_LOGIN:       'Daily Login',
  MESSAGE_SENT:      'Send a Message',
  IMAGE_GENERATED:   'Generate an Image',
  VOICE_CALL:        'Join a Voice Call',
  REFERRAL:          'Refer a Friend',
  HOUSE_MODEL_CHAT:  'Chat with a House Model',
  PORTAL_SWITCH:     'Switch Portals',
};

export function buildEarningRuleCards(): EarningRuleCard[] {
  return (Object.keys(EARNING_RULES) as Array<keyof typeof EARNING_RULES>).map((action) => ({
    action,
    label: EARNING_LABELS[action] ?? action,
    points: EARNING_RULES[action],
  }));
}
