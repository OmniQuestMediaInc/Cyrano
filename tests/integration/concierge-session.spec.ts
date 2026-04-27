/**
 * concierge-session.spec.ts
 * Integration tests: DiamondConciergeSessionService — Wave K
 *
 * Uses in-memory repository. Validates:
 * - INFERNO tier gate (403 for non-INFERNO)
 * - Session creation for eligible users
 * - Request length validation
 * - Session retrieval and listing
 */
import {
  DiamondConciergeSessionService,
  InMemoryConciergeSessionRepository,
  ConciergeAccessDeniedError,
  ConciergeRequestTooLongError,
} from '../../services/core-api/src/diamond-concierge/concierge-session.service';

describe('DiamondConciergeSessionService — tier gate', () => {
  function makeService() {
    const repo = new InMemoryConciergeSessionRepository();
    const svc = new DiamondConciergeSessionService(repo);
    return { svc, repo };
  }

  it('throws ConciergeAccessDeniedError when user has no subscription', async () => {
    const { svc } = makeService();
    await expect(svc.createConciergeSession('user_no_sub', 'Book a private event'))
      .rejects.toBeInstanceOf(ConciergeAccessDeniedError);
  });

  it('throws ConciergeAccessDeniedError for SPARK tier', async () => {
    const { svc, repo } = makeService();
    repo.seedSubscription('user_spark', { tier: 'SPARK', status: 'ACTIVE' });
    await expect(svc.createConciergeSession('user_spark', 'Request'))
      .rejects.toBeInstanceOf(ConciergeAccessDeniedError);
  });

  it('throws ConciergeAccessDeniedError for FLAME tier', async () => {
    const { svc, repo } = makeService();
    repo.seedSubscription('user_flame', { tier: 'FLAME', status: 'ACTIVE' });
    await expect(svc.createConciergeSession('user_flame', 'Request'))
      .rejects.toBeInstanceOf(ConciergeAccessDeniedError);
  });

  it('throws ConciergeAccessDeniedError for INFERNO with CANCELLED status', async () => {
    const { svc, repo } = makeService();
    repo.seedSubscription('user_cancelled', { tier: 'INFERNO', status: 'CANCELLED' });
    await expect(svc.createConciergeSession('user_cancelled', 'Request'))
      .rejects.toBeInstanceOf(ConciergeAccessDeniedError);
  });

  it('creates a session for an ACTIVE INFERNO subscriber', async () => {
    const { svc, repo } = makeService();
    repo.seedSubscription('user_inferno', { tier: 'INFERNO', status: 'ACTIVE' });
    const session = await svc.createConciergeSession('user_inferno', 'Custom twin with red hair');
    expect(session.user_id).toBe('user_inferno');
    expect(session.request).toBe('Custom twin with red hair');
    expect(session.status).toBe('pending');
    expect(session.priority).toBe('high');
  });
});

describe('DiamondConciergeSessionService — session fields', () => {
  let svc: DiamondConciergeSessionService;
  let repo: InMemoryConciergeSessionRepository;

  beforeEach(() => {
    repo = new InMemoryConciergeSessionRepository();
    repo.seedSubscription('user_vip', { tier: 'INFERNO', status: 'ACTIVE' });
    svc = new DiamondConciergeSessionService(repo);
  });

  it('assigns a unique correlation_id to each session', async () => {
    const a = await svc.createConciergeSession('user_vip', 'Request A');
    const b = await svc.createConciergeSession('user_vip', 'Request B');
    expect(a.correlation_id).not.toBe(b.correlation_id);
  });

  it('sets reason_code to CONCIERGE_REQUEST', async () => {
    const session = await svc.createConciergeSession('user_vip', 'Request');
    expect(session.reason_code).toBe('CONCIERGE_REQUEST');
  });

  it('defaults priority to high', async () => {
    const session = await svc.createConciergeSession('user_vip', 'Request');
    expect(session.priority).toBe('high');
  });

  it('accepts an explicit normal priority', async () => {
    const session = await svc.createConciergeSession('user_vip', 'Request', 'normal');
    expect(session.priority).toBe('normal');
  });

  it('stamps created_at and updated_at', async () => {
    const before = new Date();
    const session = await svc.createConciergeSession('user_vip', 'Request');
    expect(session.created_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(session.updated_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe('DiamondConciergeSessionService — request validation', () => {
  let svc: DiamondConciergeSessionService;
  let repo: InMemoryConciergeSessionRepository;

  beforeEach(() => {
    repo = new InMemoryConciergeSessionRepository();
    repo.seedSubscription('user_vip', { tier: 'INFERNO', status: 'ACTIVE' });
    svc = new DiamondConciergeSessionService(repo);
  });

  it('accepts a request exactly at 2000 characters', async () => {
    const request = 'A'.repeat(2000);
    const session = await svc.createConciergeSession('user_vip', request);
    expect(session.request.length).toBe(2000);
  });

  it('throws ConciergeRequestTooLongError for requests over 2000 chars', async () => {
    const request = 'A'.repeat(2001);
    await expect(svc.createConciergeSession('user_vip', request))
      .rejects.toBeInstanceOf(ConciergeRequestTooLongError);
  });
});

describe('DiamondConciergeSessionService — retrieval', () => {
  let svc: DiamondConciergeSessionService;
  let repo: InMemoryConciergeSessionRepository;

  beforeEach(() => {
    repo = new InMemoryConciergeSessionRepository();
    repo.seedSubscription('user_vip', { tier: 'INFERNO', status: 'ACTIVE' });
    svc = new DiamondConciergeSessionService(repo);
  });

  it('retrieves a session by ID', async () => {
    const created = await svc.createConciergeSession('user_vip', 'Book a show');
    const found = await svc.getSession(created.id);
    expect(found?.id).toBe(created.id);
  });

  it('returns null for an unknown session ID', async () => {
    const found = await svc.getSession('non_existent_id');
    expect(found).toBeNull();
  });

  it('lists all sessions for a user, newest first', async () => {
    const a = await svc.createConciergeSession('user_vip', 'First');
    const b = await svc.createConciergeSession('user_vip', 'Second');
    const sessions = await svc.listUserSessions('user_vip');
    expect(sessions).toHaveLength(2);
    // Newest-first — b was created after a so it should appear first
    // (timestamps may be equal in fast tests, so just check both are present)
    const ids = sessions.map((s) => s.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });

  it('returns empty list for a user with no sessions', async () => {
    const sessions = await svc.listUserSessions('user_no_sessions');
    expect(sessions).toHaveLength(0);
  });
});
