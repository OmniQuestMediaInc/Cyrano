// PHASE-G1 — Cooldown service tests. Verifies (1) eligibility check throws
// CooldownViolationError when next_play_at_utc is in the future, (2) record()
// inserts a row with the correct duration, (3) override beats default.

import {
  CooldownService,
  CooldownViolationError,
  PLATFORM_DEFAULT_COOLDOWN_SECONDS,
  type CooldownLogRow,
  type CooldownRepository,
} from '../../services/gamification/src/services/cooldown.service';

class InMemoryCooldownRepo implements CooldownRepository {
  public rows: CooldownLogRow[] = [];
  async insert(row: CooldownLogRow): Promise<void> {
    this.rows.push(row);
  }
  async latestFor(user_id: string, creator_id: string, game_type: string) {
    const matches = this.rows
      .filter((r) => r.user_id === user_id && r.creator_id === creator_id && r.game_type === game_type)
      .sort((a, b) => b.played_at_utc.localeCompare(a.played_at_utc));
    return matches[0] ?? null;
  }
}

describe('CooldownService', () => {
  let repo: InMemoryCooldownRepo;
  let svc: CooldownService;

  beforeEach(() => {
    repo = new InMemoryCooldownRepo();
    svc = new CooldownService(repo);
  });

  it('does not throw when no prior play is recorded', async () => {
    await expect(
      svc.assertEligible('u1', 'c1', 'SPIN_WHEEL', () => new Date('2026-04-27T00:00:00.000Z')),
    ).resolves.toBeUndefined();
  });

  it('uses the platform default when no override is given', async () => {
    const now = new Date('2026-04-27T00:00:00.000Z');
    const next = await svc.record({
      user_id: 'u1',
      creator_id: 'c1',
      game_type: 'SPIN_WHEEL',
      cooldown_seconds_override: null,
      clock: () => now,
    });
    const expected = new Date(now.getTime() + PLATFORM_DEFAULT_COOLDOWN_SECONDS * 1000);
    expect(next).toBe(expected.toISOString());
  });

  it('respects the creator override', async () => {
    const now = new Date('2026-04-27T00:00:00.000Z');
    const next = await svc.record({
      user_id: 'u1',
      creator_id: 'c1',
      game_type: 'DICE',
      cooldown_seconds_override: 10,
      clock: () => now,
    });
    expect(next).toBe(new Date(now.getTime() + 10_000).toISOString());
  });

  it('throws CooldownViolationError when within the cooldown window', async () => {
    const now = new Date('2026-04-27T00:00:00.000Z');
    await svc.record({
      user_id: 'u1',
      creator_id: 'c1',
      game_type: 'DICE',
      cooldown_seconds_override: 30,
      clock: () => now,
    });
    const slightlyLater = new Date(now.getTime() + 5_000);
    await expect(
      svc.assertEligible('u1', 'c1', 'DICE', () => slightlyLater),
    ).rejects.toBeInstanceOf(CooldownViolationError);
  });

  it('clears the cooldown after the window elapses', async () => {
    const now = new Date('2026-04-27T00:00:00.000Z');
    await svc.record({
      user_id: 'u1',
      creator_id: 'c1',
      game_type: 'DICE',
      cooldown_seconds_override: 30,
      clock: () => now,
    });
    const after = new Date(now.getTime() + 31_000);
    await expect(
      svc.assertEligible('u1', 'c1', 'DICE', () => after),
    ).resolves.toBeUndefined();
  });
});
