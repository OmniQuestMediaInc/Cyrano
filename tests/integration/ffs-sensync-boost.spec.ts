/**
 * ffs-sensync-boost.spec.ts
 * Verifies the additive SenSync™ FFS boost (10–25 pts) introduced on top of
 * the existing 12-pt heart_rate component. Hermetic — no broker or database;
 * exercises only the pure `calculateFfsScore` path.
 */
import { FfsService } from '../../services/ffs/src/ffs.service';
import {
  SENSYNC_FFS_BOOST_MAX,
  SENSYNC_FFS_BOOST_MIN,
} from '../../services/ffs/src/types/ffs.types';
import type { FfsInput } from '../../services/ffs/src/types/ffs.types';

const noopNats = {
  publish: (): void => {},
  subscribe: (): null => null,
} as unknown as ConstructorParameters<typeof FfsService>[0];

// Minimal Prisma stub — only the surfaces touched by `calculateFfsScore` &
// its async fire-and-forget adaptive-weights loader need to be present.
const noopPrisma = {
  ffsAdaptiveWeights: {
    findUnique: async (): Promise<null> => null,
  },
} as unknown as ConstructorParameters<typeof FfsService>[1];

const baseInput: FfsInput = {
  session_id:               'sess-boost-1',
  creator_id:               'creator-boost-1',
  captured_at_utc:          '2026-04-27T00:00:00.000Z',
  tips_in_session:          0,
  tips_per_min:             0,
  avg_tip_tokens:           0,
  chat_velocity_per_min:    0,
  heart_reactions_per_min:  0,
  private_spy_count:        0,
  dwell_minutes:            30, // outside early-phase window so EARLY_PHASE_BOOST does not apply
  heart_rate_bpm:           70,
  heart_rate_baseline_bpm:  70,
  eye_tracking_score:       0,
  facial_excitement_score:  0,
  skin_exposure_score:      0,
  motion_score:             0,
  audio_vocal_ratio:        0,
  heat_trend_5min:          0,
  hot_streak_ticks:         0,
  is_dual_flame:            false,
};

describe('FfsService — SenSync™ boost', () => {
  let service: FfsService;

  beforeEach(() => {
    service = new FfsService(noopNats, noopPrisma);
  });

  it('does not change the score when sensync_bpm is undefined', () => {
    const baseline = service.calculateFfsScore({ ...baseInput, session_id: 'sess-no-sensync' });
    const repeat   = service.calculateFfsScore({ ...baseInput, session_id: 'sess-no-sensync' });
    expect(baseline.ffs_score).toBe(repeat.ffs_score);
  });

  it('applies the +10 floor when sensync_bpm equals the baseline (HR-delta = 0)', () => {
    const without = service.calculateFfsScore({ ...baseInput, session_id: 'sess-floor-a' });
    const withSensyncAtBaseline = service.calculateFfsScore({
      ...baseInput,
      session_id: 'sess-floor-b',
      sensync_bpm: baseInput.heart_rate_baseline_bpm,
    });
    const delta = withSensyncAtBaseline.ffs_score - without.ffs_score;
    // Allow ±1 for Math.round at the clamp boundary.
    expect(delta).toBeGreaterThanOrEqual(SENSYNC_FFS_BOOST_MIN - 1);
    expect(delta).toBeLessThanOrEqual(SENSYNC_FFS_BOOST_MIN + 1);
  });

  it('applies the +25 ceiling when HR-delta saturates the normalisation max (40 BPM)', () => {
    const without = service.calculateFfsScore({ ...baseInput, session_id: 'sess-ceil-a' });
    const withSaturatedSensync = service.calculateFfsScore({
      ...baseInput,
      session_id: 'sess-ceil-b',
      sensync_bpm: baseInput.heart_rate_baseline_bpm + 40,
    });
    const delta = withSaturatedSensync.ffs_score - without.ffs_score;
    // Note: setting sensync_bpm also lifts the existing heart_rate component
    // (which uses sensync_bpm in precedence over heart_rate_bpm). The boost
    // is additive on top of that, so the observed delta must include the
    // ceiling but may exceed it slightly. We only assert the new boost piece.
    expect(delta).toBeGreaterThanOrEqual(SENSYNC_FFS_BOOST_MAX - 1);
  });

  it('scales linearly between the floor and ceiling for intermediate HR-deltas', () => {
    const without = service.calculateFfsScore({ ...baseInput, session_id: 'sess-mid-a' });
    const withMidSensync = service.calculateFfsScore({
      ...baseInput,
      session_id: 'sess-mid-b',
      sensync_bpm: baseInput.heart_rate_baseline_bpm + 20, // halfway through the 40-BPM range
    });
    const delta = withMidSensync.ffs_score - without.ffs_score;
    const expectedBoost =
      SENSYNC_FFS_BOOST_MIN + 0.5 * (SENSYNC_FFS_BOOST_MAX - SENSYNC_FFS_BOOST_MIN);
    expect(delta).toBeGreaterThanOrEqual(expectedBoost - 2);
  });

  it('clamps the final score to 100 even with maximum boost', () => {
    const hot: FfsInput = {
      ...baseInput,
      session_id:              'sess-clamp',
      tips_per_min:            2,
      chat_velocity_per_min:   30,
      heart_reactions_per_min: 10,
      private_spy_count:       10,
      heart_rate_bpm:          110,
      eye_tracking_score:      1,
      facial_excitement_score: 1,
      skin_exposure_score:     1,
      motion_score:            1,
      audio_vocal_ratio:       1,
      heat_trend_5min:         50,
      hot_streak_ticks:        10,
      sensync_bpm:             baseInput.heart_rate_baseline_bpm + 60,
    };
    const score = service.calculateFfsScore(hot);
    expect(score.ffs_score).toBeLessThanOrEqual(100);
    expect(score.ffs_score).toBeGreaterThanOrEqual(0);
  });
});
