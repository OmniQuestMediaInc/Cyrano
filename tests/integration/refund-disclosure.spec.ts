/**
 * refund-disclosure.spec.ts
 * Integration tests: RefundDisclosureService + ExtensionService.
 *
 * Validates:
 *  - Disclosure text and policy version are returned correctly
 *  - Acknowledgment event is constructed and published to NATS
 *  - Extension requests are validated, recorded, and published
 *  - CEO-review flag is set for above-threshold actions
 *  - ServiceToSaleTrigger is published on every extension
 *  - Friendly-fraud scoring and recommendation band mapping
 *  - Guest risk profile tier derivation
 */

import { RefundDisclosureService } from '../../services/core-api/src/refund/refund-disclosure.service';
import {
  ExtensionService,
  EXTENSION_LIMITS,
  FRAUD_THRESHOLDS,
} from '../../services/core-api/src/refund/extension.service';
import { ExtensionAuthority } from '../../services/core-api/src/refund/refund-disclosure.types';
import { NATS_TOPICS } from '../../services/nats/topics.registry';

function buildNatsStub() {
  const published: Array<{ topic: string; payload: unknown }> = [];
  return {
    publish: jest.fn((topic: string, payload: unknown) => {
      published.push({ topic, payload });
    }),
    __published: published,
  };
}

function buildServices() {
  const nats = buildNatsStub();
  // Direct instantiation with NATS stub — same pattern as gateguard tests.
  // NestJS DI is bypassed; services accept the stub via constructor injection.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const disclosure = new RefundDisclosureService(nats as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extension = new ExtensionService(nats as any);
  return { disclosure, extension, nats };
}

// ── RefundDisclosureService ────────────────────────────────────────────────

describe('RefundDisclosureService.getDisclosure', () => {
  it('returns the current policy version and non-refundable disclosure text', () => {
    const { disclosure } = buildServices();
    const result = disclosure.getDisclosure('guest-001', 'txn-001');
    expect(result.policyVersion).toBe('v1.0');
    expect(result.disclosureText).toContain('non-refundable');
    expect(result.guestId).toBe('guest-001');
    expect(result.transactionRef).toBe('txn-001');
  });
});

describe('RefundDisclosureService.createAcknowledgment', () => {
  it('stamps type and acknowledgedAt automatically', () => {
    const { disclosure } = buildServices();
    const before = new Date();
    const event = disclosure.createAcknowledgment({
      guestId: 'guest-002',
      transactionRef: 'txn-002',
      policyVersion: 'v1.0',
      sessionId: 'sess-001',
      ipAddress: 'a'.repeat(64), // simulate SHA-256 hash
    });
    const after = new Date();

    expect(event.type).toBe('REFUND_POLICY_ACKNOWLEDGED');
    expect(event.guestId).toBe('guest-002');
    expect(event.acknowledgedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(event.acknowledgedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('publishes REFUND_POLICY_ACKNOWLEDGED to NATS', () => {
    const { disclosure, nats } = buildServices();
    disclosure.createAcknowledgment({
      guestId: 'guest-003',
      transactionRef: 'txn-003',
      policyVersion: 'v1.0',
      sessionId: 'sess-002',
      ipAddress: 'b'.repeat(64),
    });
    const topics = nats.__published.map((p) => p.topic);
    expect(topics).toContain(NATS_TOPICS.REFUND_POLICY_ACKNOWLEDGED);
  });

  it('carries the caller-supplied fields through to the emitted event', () => {
    const { disclosure } = buildServices();
    const event = disclosure.createAcknowledgment({
      guestId: 'guest-004',
      transactionRef: 'txn-004',
      policyVersion: 'v1.0',
      sessionId: 'sess-003',
      ipAddress: 'c'.repeat(64),
    });
    expect(event.sessionId).toBe('sess-003');
    expect(event.ipAddress).toBe('c'.repeat(64));
    expect(event.policyVersion).toBe('v1.0');
  });
});

// ── ExtensionService.processExtension ─────────────────────────────────────

describe('ExtensionService.processExtension — EXPIRY_EXTENSION', () => {
  it('creates an action record with a unique actionId', () => {
    const { extension } = buildServices();
    const record = extension.processExtension({
      guestId: 'guest-005',
      agentId: 'agent-t2',
      agentTier: ExtensionAuthority.TIER_2,
      action: 'EXPIRY_EXTENSION',
      expiryExtensionDays: 7,
      interactionRef: 'int-001',
      reason: 'Courtesy extension',
    });
    expect(record.actionId).toBeTruthy();
    expect(record.action).toBe('EXPIRY_EXTENSION');
    expect(record.expiryExtensionDays).toBe(7);
    expect(record.goodwillCreditCZT).toBeNull();
  });

  it('TIER_2 may grant up to TIER_2_MAX_EXTENSION_DAYS without CEO flag', () => {
    const { extension } = buildServices();
    const record = extension.processExtension({
      guestId: 'guest-006',
      agentId: 'agent-t2',
      agentTier: ExtensionAuthority.TIER_2,
      action: 'EXPIRY_EXTENSION',
      expiryExtensionDays: EXTENSION_LIMITS.TIER_2_MAX_EXTENSION_DAYS,
      interactionRef: 'int-002',
      reason: 'Standard TIER_2 extension',
    });
    expect(record.ceoReviewFlagged).toBe(false);
  });

  it('TIER_3 may grant TIER_3_MAX_EXTENSION_DAYS; flags CEO review at threshold', () => {
    const { extension } = buildServices();
    const record = extension.processExtension({
      guestId: 'guest-007',
      agentId: 'agent-t3',
      agentTier: ExtensionAuthority.TIER_3,
      action: 'EXPIRY_EXTENSION',
      expiryExtensionDays: EXTENSION_LIMITS.TIER_3_MAX_EXTENSION_DAYS,
      interactionRef: 'int-003',
      reason: 'Full TIER_3 extension',
    });
    // At exactly the CEO_REVIEW threshold the flag is set
    expect(record.ceoReviewFlagged).toBe(true);
  });

  it('rejects EXPIRY_EXTENSION with missing expiryExtensionDays', () => {
    const { extension } = buildServices();
    expect(() =>
      extension.processExtension({
        guestId: 'guest-008',
        agentId: 'agent-t2',
        agentTier: ExtensionAuthority.TIER_2,
        action: 'EXPIRY_EXTENSION',
        interactionRef: 'int-004',
        reason: 'Should fail',
      }),
    ).toThrow('EXTENSION_INVALID');
  });

  it('rejects zero or negative extension days', () => {
    const { extension } = buildServices();
    expect(() =>
      extension.processExtension({
        guestId: 'guest-009',
        agentId: 'agent-t2',
        agentTier: ExtensionAuthority.TIER_2,
        action: 'EXPIRY_EXTENSION',
        expiryExtensionDays: 0,
        interactionRef: 'int-005',
        reason: 'Should fail',
      }),
    ).toThrow('EXTENSION_INVALID');
  });
});

describe('ExtensionService.processExtension — GOODWILL_CREDIT', () => {
  it('creates a GOODWILL_CREDIT record with the supplied CZT amount', () => {
    const { extension } = buildServices();
    const record = extension.processExtension({
      guestId: 'guest-010',
      agentId: 'agent-t3',
      agentTier: ExtensionAuthority.TIER_3,
      action: 'GOODWILL_CREDIT',
      goodwillCreditCZT: 50,
      interactionRef: 'int-006',
      reason: 'Goodwill gesture',
    });
    expect(record.goodwillCreditCZT).toBe(50);
    expect(record.expiryExtensionDays).toBeNull();
  });

  it('TIER_2 may grant up to TIER_2_MAX_GOODWILL_CZT without CEO flag', () => {
    const { extension } = buildServices();
    const record = extension.processExtension({
      guestId: 'guest-011',
      agentId: 'agent-t2',
      agentTier: ExtensionAuthority.TIER_2,
      action: 'GOODWILL_CREDIT',
      goodwillCreditCZT: EXTENSION_LIMITS.TIER_2_MAX_GOODWILL_CZT,
      interactionRef: 'int-007',
      reason: 'TIER_2 max goodwill',
    });
    expect(record.ceoReviewFlagged).toBe(false);
  });

  it('flags CEO review when goodwillCreditCZT exceeds CEO_REVIEW threshold', () => {
    const { extension } = buildServices();
    const record = extension.processExtension({
      guestId: 'guest-012',
      agentId: 'agent-t3',
      agentTier: ExtensionAuthority.TIER_3,
      action: 'GOODWILL_CREDIT',
      goodwillCreditCZT: EXTENSION_LIMITS.CEO_REVIEW_GOODWILL_CZT_THRESHOLD + 1,
      interactionRef: 'int-008',
      reason: 'Above CEO review threshold',
    });
    expect(record.ceoReviewFlagged).toBe(true);
  });

  it('rejects TIER_2 granting more than TIER_2_MAX_GOODWILL_CZT', () => {
    const { extension } = buildServices();
    expect(() =>
      extension.processExtension({
        guestId: 'guest-013',
        agentId: 'agent-t2',
        agentTier: ExtensionAuthority.TIER_2,
        action: 'GOODWILL_CREDIT',
        goodwillCreditCZT: EXTENSION_LIMITS.TIER_2_MAX_GOODWILL_CZT + 1,
        interactionRef: 'int-009',
        reason: 'Should fail — exceeds TIER_2 ceiling',
      }),
    ).toThrow('EXTENSION_AUTHORITY_EXCEEDED');
  });
});

describe('ExtensionService.processExtension — NATS events', () => {
  it('publishes REFUND_EXTENSION_EXECUTED and SERVICE_TO_SALE_TRIGGERED', () => {
    const { extension, nats } = buildServices();
    extension.processExtension({
      guestId: 'guest-014',
      agentId: 'agent-t3',
      agentTier: ExtensionAuthority.TIER_3,
      action: 'GOODWILL_CREDIT',
      goodwillCreditCZT: 25,
      interactionRef: 'int-010',
      reason: 'NATS test',
    });
    const topics = nats.__published.map((p) => p.topic);
    expect(topics).toContain(NATS_TOPICS.REFUND_EXTENSION_EXECUTED);
    expect(topics).toContain(NATS_TOPICS.SERVICE_TO_SALE_TRIGGERED);
  });

  it('ServiceToSaleTrigger carries correct triggerReason', () => {
    const { extension, nats } = buildServices();
    extension.processExtension({
      guestId: 'guest-015',
      agentId: 'agent-t2',
      agentTier: ExtensionAuthority.TIER_2,
      action: 'EXPIRY_EXTENSION',
      expiryExtensionDays: 3,
      interactionRef: 'int-011',
      reason: 'Trigger reason test',
    });
    const trigger = nats.__published.find(
      (p) => p.topic === NATS_TOPICS.SERVICE_TO_SALE_TRIGGERED,
    )?.payload as Record<string, unknown>;
    expect(trigger?.triggerReason).toBe('EXPIRY_EXTENSION');
    expect(trigger?.guestId).toBe('guest-015');
  });
});

// ── ExtensionService.evaluateFriendlyFraudSignal ──────────────────────────

describe('ExtensionService.evaluateFriendlyFraudSignal', () => {
  it('returns MONITOR recommendation and score 0 for no triggers', () => {
    const { extension } = buildServices();
    const signal = extension.evaluateFriendlyFraudSignal('guest-016', []);
    expect(signal.score).toBe(0);
    expect(signal.recommendation).toBe('MONITOR');
    expect(signal.type).toBe('FRIENDLY_FRAUD_SIGNAL');
  });

  it('deduplicates repeated triggers before scoring', () => {
    const { extension } = buildServices();
    const signal = extension.evaluateFriendlyFraudSignal('guest-017', [
      'CHARGEBACK_HISTORY',
      'CHARGEBACK_HISTORY',
      'RAPID_PURCHASE',
    ]);
    // 2 unique triggers → score = round((2/10)*100) = 20
    expect(signal.triggers).toHaveLength(2);
    expect(signal.score).toBe(20);
  });

  it('returns BLOCK_HIGH_VALUE_PURCHASES recommendation at mid-band score', () => {
    const { extension } = buildServices();
    // 5 unique triggers → score = 50 → BLOCK_HIGH_VALUE_PURCHASES
    const triggers = ['A', 'B', 'C', 'D', 'E'];
    const signal = extension.evaluateFriendlyFraudSignal('guest-018', triggers);
    expect(signal.score).toBe(50);
    expect(signal.recommendation).toBe('BLOCK_HIGH_VALUE_PURCHASES');
  });

  it('returns CRITICAL recommendation at score >= FRAUD_THRESHOLDS.CRITICAL', () => {
    const { extension } = buildServices();
    // 9 triggers → score = 90 → CRITICAL
    const triggers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const signal = extension.evaluateFriendlyFraudSignal('guest-019', triggers);
    expect(signal.score).toBe(90);
    expect(signal.recommendation).toBe('CRITICAL');
  });

  it('publishes FRIENDLY_FRAUD_SIGNAL_RAISED only when score >= MONITOR threshold', () => {
    const { extension, nats } = buildServices();

    // Score 0 — should NOT publish
    extension.evaluateFriendlyFraudSignal('guest-020', []);
    const beforeTopics = nats.__published.map((p) => p.topic);
    expect(beforeTopics).not.toContain(NATS_TOPICS.FRIENDLY_FRAUD_SIGNAL_RAISED);

    // 3 triggers → score 30 >= MONITOR(25) — should publish
    extension.evaluateFriendlyFraudSignal('guest-020', ['X', 'Y', 'Z']);
    const afterTopics = nats.__published.map((p) => p.topic);
    expect(afterTopics).toContain(NATS_TOPICS.FRIENDLY_FRAUD_SIGNAL_RAISED);
  });
});

// ── ExtensionService.buildGuestRiskProfile ────────────────────────────────

describe('ExtensionService.buildGuestRiskProfile', () => {
  it('returns GREEN / ALLOW for score below MONITOR threshold', () => {
    const { extension } = buildServices();
    const profile = extension.buildGuestRiskProfile('guest-021', 10, []);
    expect(profile.tier).toBe('GREEN');
    expect(profile.recommendedAction).toBe('ALLOW');
    expect(profile.riskScore).toBe(10);
  });

  it('returns YELLOW / LIMITED for score in [MONITOR, BLOCK_HIGH_VALUE)', () => {
    const { extension } = buildServices();
    const profile = extension.buildGuestRiskProfile(
      'guest-022',
      FRAUD_THRESHOLDS.MONITOR,
      ['RAPID_PURCHASE'],
    );
    expect(profile.tier).toBe('YELLOW');
    expect(profile.recommendedAction).toBe('LIMITED');
    expect(profile.activeSignals).toEqual(['RAPID_PURCHASE']);
  });

  it('returns ORANGE / REVIEW for score in [BLOCK_HIGH_VALUE, FLAG_HCZ)', () => {
    const { extension } = buildServices();
    const profile = extension.buildGuestRiskProfile('guest-023', FRAUD_THRESHOLDS.BLOCK_HIGH_VALUE, []);
    expect(profile.tier).toBe('ORANGE');
    expect(profile.recommendedAction).toBe('REVIEW');
  });

  it('returns RED / BLOCK for score >= FLAG_HCZ threshold', () => {
    const { extension } = buildServices();
    const profile = extension.buildGuestRiskProfile('guest-024', FRAUD_THRESHOLDS.FLAG_HCZ, []);
    expect(profile.tier).toBe('RED');
    expect(profile.recommendedAction).toBe('BLOCK');
  });

  it('clamps out-of-range scores to [0, 100]', () => {
    const { extension } = buildServices();
    const below = extension.buildGuestRiskProfile('guest-025', -5, []);
    expect(below.riskScore).toBe(0);
    const above = extension.buildGuestRiskProfile('guest-026', 150, []);
    expect(above.riskScore).toBe(100);
  });

  it('stamps lastUpdated as a recent Date', () => {
    const { extension } = buildServices();
    const before = new Date();
    const profile = extension.buildGuestRiskProfile('guest-027', 0, []);
    const after = new Date();
    expect(profile.lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(profile.lastUpdated.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
