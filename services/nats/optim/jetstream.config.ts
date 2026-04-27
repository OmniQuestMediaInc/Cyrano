// NATS: JetStream stream configuration
// Phase 2.9 — declarative stream definitions for the durable subjects that
// must survive broker restarts (audit, ledger, payouts, FFS adaptive
// updates). The infra runner consumes this constant to provision streams
// idempotently at boot.

export interface JetStreamStreamConfig {
  name: string;
  subjects: string[];
  /** Retention window in seconds; 0 = retain by limits only (size/messages). */
  max_age_seconds: number;
  /** Maximum bytes the stream may consume on disk. 0 = no cap. */
  max_bytes: number;
  /** Maximum messages held by the stream. 0 = no cap. */
  max_msgs: number;
  /** Replication factor across the cluster. */
  num_replicas: 1 | 3 | 5;
  /** File-backed storage; in-memory streams are not allowed for durable subjects. */
  storage: 'file';
  /** Discard policy: `old` evicts the oldest messages; `new` rejects new writes. */
  discard: 'old' | 'new';
  /** Per-message retry hint for at-least-once consumers. */
  ack_wait_seconds: number;
}

const DAY_S = 86_400;
const GIB = 1_073_741_824;

/**
 * Canonical JetStream streams. Adding a new stream requires a NATS: commit
 * with REASON / IMPACT / CORRELATION_ID and a follow-up infra run.
 */
export const JETSTREAM_STREAMS: ReadonlyArray<JetStreamStreamConfig> = [
  {
    name: 'AUDIT',
    subjects: ['audit.>', 'compliance.>', 'worm.>'],
    max_age_seconds: 30 * DAY_S,
    max_bytes: 50 * GIB,
    max_msgs: 0,
    num_replicas: 3,
    storage: 'file',
    discard: 'old',
    ack_wait_seconds: 30,
  },
  {
    name: 'LEDGER',
    subjects: ['ledger.>', 'payments.webhook.>', 'fiz.>'],
    max_age_seconds: 30 * DAY_S,
    max_bytes: 25 * GIB,
    max_msgs: 0,
    num_replicas: 3,
    storage: 'file',
    discard: 'old',
    ack_wait_seconds: 30,
  },
  {
    name: 'SENSYNC_PURGE',
    subjects: ['sensync.purge.>', 'sensync.consent.>'],
    max_age_seconds: 365 * DAY_S,
    max_bytes: 5 * GIB,
    max_msgs: 0,
    num_replicas: 3,
    storage: 'file',
    discard: 'old',
    ack_wait_seconds: 60,
  },
  {
    name: 'FFS_ADAPTIVE',
    subjects: ['ffs.score.adaptive.>', 'ffs.score.session.>'],
    max_age_seconds: 7 * DAY_S,
    max_bytes: 5 * GIB,
    max_msgs: 0,
    num_replicas: 3,
    storage: 'file',
    discard: 'old',
    ack_wait_seconds: 10,
  },
  {
    name: 'VELOCITYZONE',
    subjects: ['velocityzone.>'],
    max_age_seconds: 30 * DAY_S,
    max_bytes: 2 * GIB,
    max_msgs: 0,
    num_replicas: 3,
    storage: 'file',
    discard: 'old',
    ack_wait_seconds: 15,
  },
];

/**
 * Subjects that intentionally remain core-NATS (best-effort) because their
 * sustained volume would dominate disk: high-frequency telemetry tick
 * subjects. They are sharded (see `sharding.util.ts`) and consumed by the
 * presence/UI tier — not by financial settlement. Keep this list explicit so
 * code review can flag accidental promotions to JetStream.
 */
export const CORE_NATS_BEST_EFFORT_SUBJECTS: ReadonlyArray<string> = [
  'ffs.score.update',
  'ffs.score.tier.changed',
  'ffs.score.leaderboard.updated',
  'sensync.bpm.update',
  'sensync.biometric.data',
  'chat.broadcast.staggered',
];
