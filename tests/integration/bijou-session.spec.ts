/**
 * bijou-session.spec.ts
 * Integration tests: BijouSessionService admission gates.
 *
 * Validates: admitParticipant (capacity enforcement), camera compliance
 * lifecycle (NONE → WARN → EJECT), standby queue (FIFO), and Ghost Alpha
 * scenario participant flows derived from seed CSVs.
 */
import {
  BijouSessionService,
  BijouSession,
  BijouParticipant,
} from '../../services/bijou/src/bijou-session.service';
import { BIJOU_PRICING } from '../../services/core-api/src/config/governance.config';
import { loadDemoScenarios, loadCustomers, loadCreators } from './seed-loader';

// ── NatsService mock ──────────────────────────────────────────────────────────
function buildMockNats() {
  return { publish: jest.fn() };
}

// ── Session factory ───────────────────────────────────────────────────────────
function makeSession(overrides: Partial<BijouSession> = {}): BijouSession {
  return {
    session_id: 'ses_test_001',
    show_id: 'show_test_001',
    creator_id: 'cr_001',
    max_participants: BIJOU_PRICING.MAX_PARTICIPANTS,
    participants: [],
    standby_queue: [],
    started_at_utc: new Date().toISOString(),
    rule_applied_id: 'BIJOU_SESSION_v1',
    ...overrides,
  };
}

function makeService() {
  const nats = buildMockNats();
  const svc = new BijouSessionService(nats as any);
  return { svc, nats };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fillSession(svc: BijouSessionService, session: BijouSession, count: number): BijouSession {
  let s = session;
  for (let i = 0; i < count; i++) {
    s = svc.admitParticipant(s, `vip_${i}`, false);
  }
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('BijouSessionService — admitParticipant (admission gate)', () => {
  it('admits a host without counting against VIP capacity', () => {
    const { svc } = makeService();
    const session = makeSession();
    const updated = svc.admitParticipant(session, 'cr_001', true);
    expect(updated.participants).toHaveLength(1);
    expect(updated.participants[0].is_host).toBe(true);
  });

  it('admits VIPs up to MAX_PARTICIPANTS (24)', () => {
    const { svc } = makeService();
    let session = makeSession();
    session = fillSession(svc, session, BIJOU_PRICING.MAX_PARTICIPANTS);
    expect(session.participants).toHaveLength(BIJOU_PRICING.MAX_PARTICIPANTS);
  });

  it('throws SEAT_CAPACITY_FULL when VIP count reaches MAX_PARTICIPANTS', () => {
    const { svc } = makeService();
    let session = makeSession();
    session = fillSession(svc, session, BIJOU_PRICING.MAX_PARTICIPANTS);
    expect(() => svc.admitParticipant(session, 'late_vip', false)).toThrow(
      'SEAT_CAPACITY_FULL',
    );
  });

  it('host can still be admitted when VIP cap is reached', () => {
    const { svc } = makeService();
    let session = makeSession();
    session = fillSession(svc, session, BIJOU_PRICING.MAX_PARTICIPANTS);
    // Host admission must not throw even at capacity
    expect(() => svc.admitParticipant(session, 'creator_host', true)).not.toThrow();
  });

  it('assigns sequential seat numbers', () => {
    const { svc } = makeService();
    let session = makeSession();
    session = svc.admitParticipant(session, 'vip_a', false);
    session = svc.admitParticipant(session, 'vip_b', false);
    session = svc.admitParticipant(session, 'vip_c', false);
    expect(session.participants[0].seat_number).toBe(1);
    expect(session.participants[1].seat_number).toBe(2);
    expect(session.participants[2].seat_number).toBe(3);
  });

  it('sets camera_grace_expires_at_utc on entry', () => {
    const { svc } = makeService();
    let session = makeSession();
    session = svc.admitParticipant(session, 'vip_grace', false);
    const p = session.participants[0];
    expect(p.camera_grace_expires_at_utc).toBeDefined();
    const graceDelta =
      new Date(p.camera_grace_expires_at_utc!).getTime() -
      new Date(p.entered_at_utc).getTime();
    expect(graceDelta).toBe(BIJOU_PRICING.CAMERA_GRACE_PERIOD_SEC * 1000);
  });

  it('Ghost Alpha: admits first 5 scenario customers into a session', () => {
    const { svc } = makeService();
    let session = makeSession();
    const scenarios = loadDemoScenarios().slice(0, 5);

    for (const sc of scenarios) {
      session = svc.admitParticipant(session, sc.primary_customer_id, false);
    }
    expect(session.participants).toHaveLength(5);
    const ids = session.participants.map(p => p.user_id);
    scenarios.forEach(sc => expect(ids).toContain(sc.primary_customer_id));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BijouSessionService — evaluateCameraCompliance', () => {
  it('throws PARTICIPANT_NOT_FOUND for unknown user', () => {
    const { svc } = makeService();
    const session = makeSession();
    expect(() => svc.evaluateCameraCompliance(session, 'ghost_user')).toThrow(
      'PARTICIPANT_NOT_FOUND',
    );
  });

  it('returns NONE when camera is active', () => {
    const { svc } = makeService();
    let session = makeSession();
    session = svc.admitParticipant(session, 'vip_cam_on', false);
    // Simulate camera active
    session = {
      ...session,
      participants: session.participants.map(p =>
        p.user_id === 'vip_cam_on' ? { ...p, camera_active: true } : p,
      ),
    };
    const { action } = svc.evaluateCameraCompliance(session, 'vip_cam_on');
    expect(action).toBe('NONE');
  });

  it('returns NONE while still within camera grace period', () => {
    const { svc } = makeService();
    let session = makeSession();
    session = svc.admitParticipant(session, 'vip_in_grace', false);
    // camera_grace_expires_at_utc is in the future (just set by admitParticipant)
    const { action } = svc.evaluateCameraCompliance(session, 'vip_in_grace');
    expect(action).toBe('NONE');
  });

  it('returns WARN when grace period has expired and no warning yet', () => {
    const { svc, nats } = makeService();
    let session = makeSession();
    session = svc.admitParticipant(session, 'vip_grace_expired', false);
    // Override: push grace expiry to the past
    const past = new Date(Date.now() - 1000).toISOString();
    session = {
      ...session,
      participants: session.participants.map(p =>
        p.user_id === 'vip_grace_expired'
          ? { ...p, camera_grace_expires_at_utc: past }
          : p,
      ),
    };
    const { action } = svc.evaluateCameraCompliance(session, 'vip_grace_expired');
    expect(action).toBe('WARN');
    expect(nats.publish).toHaveBeenCalledWith(
      'bijou.camera.violation',
      expect.objectContaining({ action: 'WARN', user_id: 'vip_grace_expired' }),
    );
  });

  it('returns EJECT when both grace and warning periods have expired', () => {
    const { svc, nats } = makeService();
    let session = makeSession();
    session = svc.admitParticipant(session, 'vip_eject', false);
    const past = new Date(Date.now() - 10_000).toISOString();
    session = {
      ...session,
      participants: session.participants.map(p =>
        p.user_id === 'vip_eject'
          ? {
              ...p,
              camera_grace_expires_at_utc: past,
              camera_warning_expires_at_utc: past,
            }
          : p,
      ),
    };
    const { action } = svc.evaluateCameraCompliance(session, 'vip_eject');
    expect(action).toBe('EJECT');
    expect(nats.publish).toHaveBeenCalledWith(
      'bijou.ejection',
      expect.objectContaining({ reason: 'CAMERA_COMPLIANCE_EJECTION' }),
    );
  });

  it('Ghost Alpha: evaluates camera compliance for all scenario participants', () => {
    const { svc } = makeService();
    let session = makeSession();
    const scenarios = loadDemoScenarios().slice(0, 10);

    for (const sc of scenarios) {
      session = svc.admitParticipant(session, sc.primary_customer_id, false);
    }

    // Within grace period — all should be NONE
    for (const sc of scenarios) {
      const { action } = svc.evaluateCameraCompliance(
        session,
        sc.primary_customer_id,
      );
      expect(action).toBe('NONE');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BijouSessionService — standby queue', () => {
  it('joinStandby adds a user to the queue', () => {
    const { svc } = makeService();
    let session = makeSession();
    session = svc.joinStandby(session, 'cu_standby_001');
    expect(session.standby_queue).toHaveLength(1);
    expect(session.standby_queue[0].user_id).toBe('cu_standby_001');
  });

  it('joinStandby is idempotent — duplicate enqueue is ignored', () => {
    const { svc } = makeService();
    let session = makeSession();
    session = svc.joinStandby(session, 'cu_standby_dup');
    session = svc.joinStandby(session, 'cu_standby_dup');
    expect(session.standby_queue).toHaveLength(1);
  });

  it('queue is FIFO', () => {
    const { svc } = makeService();
    let session = makeSession();
    session = svc.joinStandby(session, 'cu_q1');
    session = svc.joinStandby(session, 'cu_q2');
    session = svc.joinStandby(session, 'cu_q3');
    expect(session.standby_queue[0].user_id).toBe('cu_q1');
    expect(session.standby_queue[1].user_id).toBe('cu_q2');
    expect(session.standby_queue[2].user_id).toBe('cu_q3');
  });

  it('notifyNextStandby notifies first queued user', () => {
    const { svc, nats } = makeService();
    let session = makeSession();
    session = svc.joinStandby(session, 'cu_notify_first');
    session = svc.joinStandby(session, 'cu_notify_second');

    const { notified_user_id } = svc.notifyNextStandby(session);
    expect(notified_user_id).toBe('cu_notify_first');
    expect(nats.publish).toHaveBeenCalledWith(
      'bijou.standby.alert',
      expect.objectContaining({
        user_id: 'cu_notify_first',
        accept_window_secs: BIJOU_PRICING.STANDBY_ACCEPT_WINDOW_SEC,
      }),
    );
  });

  it('notifyNextStandby returns null when queue is empty', () => {
    const { svc } = makeService();
    const session = makeSession();
    const { notified_user_id } = svc.notifyNextStandby(session);
    expect(notified_user_id).toBeNull();
  });

  it('notified entry has accept_expires_at_utc set', () => {
    const { svc } = makeService();
    let session = makeSession();
    session = svc.joinStandby(session, 'cu_accept_window');
    const { session: updated } = svc.notifyNextStandby(session);
    const entry = updated.standby_queue[0];
    expect(entry.accept_expires_at_utc).toBeDefined();
    const windowMs =
      new Date(entry.accept_expires_at_utc!).getTime() -
      new Date(entry.notified_at_utc!).getTime();
    expect(windowMs).toBe(BIJOU_PRICING.STANDBY_ACCEPT_WINDOW_SEC * 1000);
  });

  it('Ghost Alpha: queues overflow scenario customers when session is at capacity', () => {
    const { svc } = makeService();
    // Fill the session to capacity
    let session = fillSession(svc, makeSession(), BIJOU_PRICING.MAX_PARTICIPANTS);

    const lateArrivals = loadDemoScenarios().slice(0, 5);
    for (const sc of lateArrivals) {
      session = svc.joinStandby(session, sc.primary_customer_id);
    }
    expect(session.standby_queue).toHaveLength(5);
    expect(session.standby_queue[0].user_id).toBe(
      lateArrivals[0].primary_customer_id,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BijouSessionService — MAX_PARTICIPANTS constant', () => {
  it('BIJOU_PRICING.MAX_PARTICIPANTS is 24', () => {
    expect(BIJOU_PRICING.MAX_PARTICIPANTS).toBe(24);
  });

  it('BIJOU_PRICING.STANDBY_ACCEPT_WINDOW_SEC is 10', () => {
    expect(BIJOU_PRICING.STANDBY_ACCEPT_WINDOW_SEC).toBe(10);
  });

  it('BIJOU_PRICING.CAMERA_GRACE_PERIOD_SEC is 30', () => {
    expect(BIJOU_PRICING.CAMERA_GRACE_PERIOD_SEC).toBe(30);
  });

  it('BIJOU_PRICING.CAMERA_WARNING_PERIOD_SEC is 30', () => {
    expect(BIJOU_PRICING.CAMERA_WARNING_PERIOD_SEC).toBe(30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BijouSessionService — seed-backed creator/customer cross-reference', () => {
  it('all Ghost Alpha scenario creator IDs are valid creator references', () => {
    const creators = loadCreators();
    const creatorIds = new Set(creators.map(c => c.creator_id));
    const scenarios = loadDemoScenarios();
    for (const sc of scenarios) {
      expect(creatorIds.has(sc.primary_creator_id)).toBe(true);
    }
  });

  it('all Ghost Alpha scenario customer IDs are valid customer references', () => {
    const customers = loadCustomers();
    const customerIds = new Set(customers.map(c => c.customer_id));
    const scenarios = loadDemoScenarios();
    for (const sc of scenarios) {
      expect(customerIds.has(sc.primary_customer_id)).toBe(true);
    }
  });
});
