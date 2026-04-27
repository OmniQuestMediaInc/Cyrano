/**
 * rr-rewards.spec.ts
 * Integration tests: RedRoomRewardsService — Wave L + M
 *
 * Uses in-memory repositories (no database). Validates:
 * - Earning rules: all action types award correct points
 * - awardPoints: balance increments correctly
 * - awardDailyLogin: idempotency (one-per-day guard)
 * - awardDailyLoginBatch: awards to all active users, skips duplicates
 * - burnPoints: balance deduction + grant creation + reward expiry
 * - burnPoints: InsufficientRrrPointsError on low balance
 * - getBalance: sum of ledger entries
 * - getActiveGrants: filters fulfilled and expired grants
 * Presenter tests for Wave M: RewardsDashboard + DiamondConciergeDashboard
 */
import {
  RedRoomRewardsService,
  InMemoryRrPointsLedgerRepository,
  InMemoryBurnRewardGrantRepository,
  InsufficientRrrPointsError,
  AlreadyAwardedTodayError,
  EARNING_RULES,
  BURN_COSTS,
} from '../../services/core-api/src/rr-rewards/rr.service';
import {
  presentRewardsDashboard,
  presentDiamondConciergeDashboard,
  buildEarningRuleCards,
} from '../../ui/view-models/rewards.presenter';

// ─── Service unit tests ───────────────────────────────────────────────────────

function makeService(userIds?: string[]) {
  const ledger = new InMemoryRrPointsLedgerRepository();
  const grants = new InMemoryBurnRewardGrantRepository();
  const activeUsers = userIds
    ? { listActiveUserIds: async () => userIds }
    : undefined;
  const svc = new RedRoomRewardsService(ledger, grants, activeUsers);
  return { svc, ledger, grants };
}

describe('RedRoomRewardsService — earning rules', () => {
  it('defines the correct point values for all actions', () => {
    expect(EARNING_RULES.DAILY_LOGIN).toBe(50);
    expect(EARNING_RULES.MESSAGE_SENT).toBe(10);
    expect(EARNING_RULES.IMAGE_GENERATED).toBe(25);
    expect(EARNING_RULES.VOICE_CALL).toBe(40);
    expect(EARNING_RULES.REFERRAL).toBe(500);
    expect(EARNING_RULES.HOUSE_MODEL_CHAT).toBe(15);
    expect(EARNING_RULES.PORTAL_SWITCH).toBe(20);
  });

  it('defines the correct burn costs', () => {
    expect(BURN_COSTS.EXTRA_IMAGES).toBe(200);
    expect(BURN_COSTS.TEMP_INFERNO).toBe(500);
    expect(BURN_COSTS.CUSTOM_TWIN).toBe(1_000);
  });

  it('service earningRules property matches EARNING_RULES constant', () => {
    const { svc } = makeService();
    expect(svc.earningRules).toStrictEqual(EARNING_RULES);
  });
});

describe('RedRoomRewardsService — awardPoints', () => {
  it('awards DAILY_LOGIN points and returns the entry + new balance', async () => {
    const { svc } = makeService();
    const result = await svc.awardPoints('u1', 'DAILY_LOGIN');
    expect(result.entry.amount).toBe(50);
    expect(result.new_balance).toBe(50);
    expect(result.entry.user_id).toBe('u1');
    expect(result.entry.action).toBe('DAILY_LOGIN');
    expect(result.entry.reason_code).toBe('RRR_AWARD');
  });

  it('accumulates balance across multiple awards', async () => {
    const { svc } = makeService();
    await svc.awardPoints('u2', 'MESSAGE_SENT');
    await svc.awardPoints('u2', 'MESSAGE_SENT');
    const result = await svc.awardPoints('u2', 'VOICE_CALL');
    expect(result.new_balance).toBe(10 + 10 + 40);
  });

  it('awards REFERRAL 500 points', async () => {
    const { svc } = makeService();
    const result = await svc.awardPoints('u3', 'REFERRAL');
    expect(result.entry.amount).toBe(500);
    expect(result.new_balance).toBe(500);
  });

  it('assigns a unique correlation_id per award', async () => {
    const { svc } = makeService();
    const a = await svc.awardPoints('u4', 'MESSAGE_SENT');
    const b = await svc.awardPoints('u4', 'MESSAGE_SENT');
    expect(a.entry.correlation_id).not.toBe(b.entry.correlation_id);
  });

  it('isolates balances between users', async () => {
    const { svc } = makeService();
    await svc.awardPoints('alice', 'DAILY_LOGIN');
    await svc.awardPoints('bob', 'MESSAGE_SENT');
    expect(await svc.getBalance('alice')).toBe(50);
    expect(await svc.getBalance('bob')).toBe(10);
  });
});

describe('RedRoomRewardsService — awardDailyLogin', () => {
  it('awards DAILY_LOGIN points on first call', async () => {
    const { svc } = makeService();
    const result = await svc.awardDailyLogin('u5');
    expect(result.entry.amount).toBe(50);
    expect(result.new_balance).toBe(50);
  });

  it('throws AlreadyAwardedTodayError if called twice on the same day', async () => {
    const { svc } = makeService();
    await svc.awardDailyLogin('u6');
    await expect(svc.awardDailyLogin('u6')).rejects.toBeInstanceOf(AlreadyAwardedTodayError);
  });

  it('error statusCode is 409', async () => {
    const { svc } = makeService();
    await svc.awardDailyLogin('u7');
    try {
      await svc.awardDailyLogin('u7');
    } catch (e) {
      expect((e as AlreadyAwardedTodayError).statusCode).toBe(409);
    }
  });
});

describe('RedRoomRewardsService — awardDailyLoginBatch', () => {
  it('awards login points to all active users', async () => {
    const { svc } = makeService(['userA', 'userB', 'userC']);
    const result = await svc.awardDailyLoginBatch();
    expect(result.awarded).toBe(3);
    expect(result.skipped).toBe(0);
  });

  it('skips users who already received login points today', async () => {
    const { svc } = makeService(['userA', 'userB']);
    await svc.awardDailyLogin('userA'); // pre-award userA
    const result = await svc.awardDailyLoginBatch();
    expect(result.awarded).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('throws if no ActiveUserProvider is wired', async () => {
    const { svc } = makeService(); // no userIds → no provider
    await expect(svc.awardDailyLoginBatch()).rejects.toThrow('ActiveUserProvider is required');
  });
});

describe('RedRoomRewardsService — burnPoints', () => {
  it('burns EXTRA_IMAGES at cost 200 and creates a grant', async () => {
    const { svc } = makeService();
    // Fund the account first
    await svc.awardPoints('u8', 'REFERRAL'); // +500
    const result = await svc.burnPoints('u8', 'EXTRA_IMAGES');
    expect(result.debit_entry.amount).toBe(-200);
    expect(result.new_balance).toBe(500 - 200);
    expect(result.grant.reward_type).toBe('EXTRA_IMAGES');
    expect(result.grant.points_burned).toBe(200);
    expect(result.grant.expires_at).not.toBeNull();
  });

  it('burns TEMP_INFERNO at cost 500 with 7-day expiry', async () => {
    const { svc } = makeService();
    await svc.awardPoints('u9', 'REFERRAL'); // +500
    const before = Date.now();
    const result = await svc.burnPoints('u9', 'TEMP_INFERNO');
    expect(result.grant.points_burned).toBe(500);
    const expiryMs = result.grant.expires_at!.getTime();
    const expectedMs = before + 7 * 24 * 60 * 60 * 1000;
    expect(expiryMs).toBeGreaterThanOrEqual(expectedMs - 5_000);
    expect(expiryMs).toBeLessThanOrEqual(expectedMs + 5_000);
  });

  it('burns CUSTOM_TWIN at cost 1000 with no expiry', async () => {
    const { svc } = makeService();
    await svc.awardPoints('u10', 'REFERRAL'); // +500
    await svc.awardPoints('u10', 'REFERRAL'); // +500 = 1000 total
    const result = await svc.burnPoints('u10', 'CUSTOM_TWIN');
    expect(result.grant.points_burned).toBe(1_000);
    expect(result.grant.expires_at).toBeNull();
    expect(result.new_balance).toBe(0);
  });

  it('throws InsufficientRrrPointsError when balance is too low', async () => {
    const { svc } = makeService();
    await svc.awardPoints('u11', 'MESSAGE_SENT'); // +10, need 200
    await expect(svc.burnPoints('u11', 'EXTRA_IMAGES'))
      .rejects.toBeInstanceOf(InsufficientRrrPointsError);
  });

  it('InsufficientRrrPointsError statusCode is 402', async () => {
    const { svc } = makeService();
    try {
      await svc.burnPoints('u12', 'EXTRA_IMAGES');
    } catch (e) {
      expect((e as InsufficientRrrPointsError).statusCode).toBe(402);
    }
  });

  it('debit entry has negative amount and RRR_BURN reason_code', async () => {
    const { svc } = makeService();
    await svc.awardPoints('u13', 'REFERRAL');
    const result = await svc.burnPoints('u13', 'EXTRA_IMAGES');
    expect(result.debit_entry.amount).toBe(-200);
    expect(result.debit_entry.reason_code).toBe('RRR_BURN');
  });
});

describe('RedRoomRewardsService — getBalance and getHistory', () => {
  it('getBalance returns 0 for a user with no entries', async () => {
    const { svc } = makeService();
    expect(await svc.getBalance('ghost')).toBe(0);
  });

  it('getHistory returns entries newest-first', async () => {
    const { svc } = makeService();
    await svc.awardPoints('u14', 'MESSAGE_SENT');
    await svc.awardPoints('u14', 'DAILY_LOGIN');
    const history = await svc.getHistory('u14');
    // newest-first: DAILY_LOGIN was awarded second
    expect(history[0].action).toBe('DAILY_LOGIN');
    expect(history[1].action).toBe('MESSAGE_SENT');
  });
});

describe('RedRoomRewardsService — getActiveGrants', () => {
  it('returns empty list when user has no grants', async () => {
    const { svc } = makeService();
    expect(await svc.getActiveGrants('u15')).toHaveLength(0);
  });

  it('includes unfulfilled, non-expired grants', async () => {
    const { svc } = makeService();
    await svc.awardPoints('u16', 'REFERRAL');
    await svc.burnPoints('u16', 'EXTRA_IMAGES');
    const grants = await svc.getActiveGrants('u16');
    expect(grants).toHaveLength(1);
    expect(grants[0].reward_type).toBe('EXTRA_IMAGES');
  });
});

// ─── Presenter tests (Wave M) ─────────────────────────────────────────────────

describe('presentRewardsDashboard — Wave M', () => {
  it('builds a burn shop with all three reward items', () => {
    const view = presentRewardsDashboard({
      user_id: 'alice',
      balance: 300,
      history: [],
      active_grants: [],
    });
    const rewardTypes = view.burn_shop.map((i) => i.reward);
    expect(rewardTypes).toContain('EXTRA_IMAGES');
    expect(rewardTypes).toContain('TEMP_INFERNO');
    expect(rewardTypes).toContain('CUSTOM_TWIN');
  });

  it('echoes user_id and balance', () => {
    const view = presentRewardsDashboard({
      user_id: 'bob',
      balance: 999,
      history: [],
      active_grants: [],
    });
    expect(view.user_id).toBe('bob');
    expect(view.balance).toBe(999);
  });

  it('maps history entries to view model', () => {
    const entry = {
      id: 'rrr_1',
      user_id: 'carol',
      amount: 50,
      action: 'DAILY_LOGIN',
      description: 'Earned 50 points for DAILY_LOGIN',
      correlation_id: 'corr_1',
      reason_code: 'RRR_AWARD',
      created_at: new Date('2026-04-27T12:00:00Z'),
    };
    const view = presentRewardsDashboard({
      user_id: 'carol',
      balance: 50,
      history: [entry],
      active_grants: [],
    });
    expect(view.history).toHaveLength(1);
    expect(view.history[0].action).toBe('DAILY_LOGIN');
    expect(view.history[0].amount).toBe(50);
    expect(view.history[0].created_at_utc).toBe('2026-04-27T12:00:00.000Z');
  });

  it('includes a non-empty captured_at_utc', () => {
    const view = presentRewardsDashboard({
      user_id: 'dave',
      balance: 0,
      history: [],
      active_grants: [],
    });
    expect(view.captured_at_utc).toBeTruthy();
    expect(() => new Date(view.captured_at_utc)).not.toThrow();
  });
});

describe('presentDiamondConciergeDashboard — Wave M', () => {
  it('marks tier_permitted true when provided', () => {
    const view = presentDiamondConciergeDashboard({
      user_id: 'eve',
      tier_permitted: true,
      sessions: [],
    });
    expect(view.tier_permitted).toBe(true);
  });

  it('truncates long requests to 120 chars with ellipsis', () => {
    const longRequest = 'X'.repeat(200);
    const now = new Date();
    const session = {
      id: 's1',
      user_id: 'eve',
      request: longRequest,
      status: 'pending' as const,
      priority: 'high' as const,
      correlation_id: 'c1',
      reason_code: 'CONCIERGE_REQUEST',
      created_at: now,
      updated_at: now,
    };
    const view = presentDiamondConciergeDashboard({
      user_id: 'eve',
      tier_permitted: true,
      sessions: [session],
    });
    expect(view.sessions[0].request_summary.length).toBeLessThanOrEqual(120);
    expect(view.sessions[0].request_summary.endsWith('…')).toBe(true);
  });

  it('returns sessions newest-first', () => {
    const now = new Date();
    const older = {
      id: 's_old',
      user_id: 'frank',
      request: 'Old request',
      status: 'pending' as const,
      priority: 'high' as const,
      correlation_id: 'c_old',
      reason_code: 'CONCIERGE_REQUEST',
      created_at: new Date(now.getTime() - 10_000),
      updated_at: new Date(now.getTime() - 10_000),
    };
    const newer = {
      id: 's_new',
      user_id: 'frank',
      request: 'New request',
      status: 'pending' as const,
      priority: 'high' as const,
      correlation_id: 'c_new',
      reason_code: 'CONCIERGE_REQUEST',
      created_at: now,
      updated_at: now,
    };
    const view = presentDiamondConciergeDashboard({
      user_id: 'frank',
      tier_permitted: true,
      sessions: [older, newer],
    });
    expect(view.sessions[0].id).toBe('s_new');
    expect(view.sessions[1].id).toBe('s_old');
  });
});

describe('buildEarningRuleCards', () => {
  it('returns a card for every action in EARNING_RULES', () => {
    const cards = buildEarningRuleCards();
    const actions = cards.map((c) => c.action);
    expect(actions).toContain('DAILY_LOGIN');
    expect(actions).toContain('MESSAGE_SENT');
    expect(actions).toContain('IMAGE_GENERATED');
    expect(actions).toContain('VOICE_CALL');
    expect(actions).toContain('REFERRAL');
    expect(actions).toContain('HOUSE_MODEL_CHAT');
    expect(actions).toContain('PORTAL_SWITCH');
  });

  it('card points match EARNING_RULES constants', () => {
    const cards = buildEarningRuleCards();
    const referral = cards.find((c) => c.action === 'REFERRAL');
    expect(referral?.points).toBe(500);
  });
});
