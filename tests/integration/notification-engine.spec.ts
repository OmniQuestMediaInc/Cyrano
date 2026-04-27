/**
 * notification-engine.spec.ts
 * Integration tests: NotificationEngine consent gating, dedup window,
 * 48h warning convenience helper, personal-touch routing, audit tail.
 */
import {
  NotificationEngine,
  ConsentResolver,
  NotificationChannel,
  DispatchAdapter,
} from '../../services/notification/src/notification.service';

function consentForAll(opted: boolean): ConsentResolver {
  return {
    isOptedIn: async () => opted,
  };
}

function captureAdapter() {
  const calls: Array<{
    channel: NotificationChannel;
    user_id: string;
    template: string;
    payload: Record<string, unknown>;
  }> = [];
  const adapter: DispatchAdapter = {
    deliver: async (channel, user_id, template, payload) => {
      calls.push({ channel, user_id, template, payload });
    },
  };
  return { calls, adapter };
}

describe('NotificationEngine — consent gating', () => {
  it('suppresses dispatch when user is not opted in', async () => {
    const engine = new NotificationEngine(consentForAll(false));
    const result = await engine.send({
      user_id: 'cu_001',
      channel: 'EMAIL',
      template: 'EXPIRY_WARNING_48H',
      payload: { wallet: 'w1' },
    });
    expect(result.dispatched).toBe(false);
    expect(result.suppression_reason).toBe('NOT_OPTED_IN');
  });

  it('dispatches when user is opted in', async () => {
    const { adapter, calls } = captureAdapter();
    const engine = new NotificationEngine(consentForAll(true), adapter);
    const result = await engine.send({
      user_id: 'cu_001',
      channel: 'EMAIL',
      template: 'EXPIRY_WARNING_48H',
      payload: { wallet: 'w1' },
    });
    expect(result.dispatched).toBe(true);
    expect(result.suppression_reason).toBe('NONE');
    expect(calls).toHaveLength(1);
  });
});

describe('NotificationEngine — dedup window', () => {
  it('suppresses duplicate sends within the TTL', async () => {
    const engine = new NotificationEngine(consentForAll(true));
    const a = await engine.send({
      user_id: 'cu_dup',
      channel: 'SMS',
      template: 'EXPIRY_WARNING_48H',
      payload: {},
    });
    const b = await engine.send({
      user_id: 'cu_dup',
      channel: 'SMS',
      template: 'EXPIRY_WARNING_48H',
      payload: {},
    });
    expect(a.dispatched).toBe(true);
    expect(b.dispatched).toBe(false);
    expect(b.suppression_reason).toBe('DUPLICATE_WITHIN_TTL');
  });

  it('treats different templates as distinct dedup keys', async () => {
    const engine = new NotificationEngine(consentForAll(true));
    const a = await engine.send({
      user_id: 'cu_multi',
      channel: 'EMAIL',
      template: 'EXPIRY_WARNING_48H',
      payload: {},
    });
    const b = await engine.send({
      user_id: 'cu_multi',
      channel: 'EMAIL',
      template: 'TOKEN_BRIDGE_OFFER',
      payload: {},
    });
    expect(a.dispatched).toBe(true);
    expect(b.dispatched).toBe(true);
  });

  it('uses metadata.dedup_key to differentiate otherwise-identical sends', async () => {
    const engine = new NotificationEngine(consentForAll(true));
    const a = await engine.send({
      user_id: 'cu_dk',
      channel: 'SMS',
      template: 'EXPIRY_WARNING_48H',
      payload: {},
      metadata: { dedup_key: 'wallet_A' },
    });
    const b = await engine.send({
      user_id: 'cu_dk',
      channel: 'SMS',
      template: 'EXPIRY_WARNING_48H',
      payload: {},
      metadata: { dedup_key: 'wallet_B' },
    });
    expect(a.dispatched).toBe(true);
    expect(b.dispatched).toBe(true);
  });
});

describe('NotificationEngine — 48h expiry warning helper', () => {
  it('issues two messages: EMAIL + SMS, sharing one correlation_id', async () => {
    const engine = new NotificationEngine(consentForAll(true));
    const results = await engine.send48hExpiryWarning({
      user_id: 'cu_warn',
      wallet_id: 'w1',
      remaining_balance_tokens: 5_000n,
      expires_at_utc: new Date().toISOString(),
      correlation_id: 'corr_warn_001',
    });
    expect(results).toHaveLength(2);
    expect(results[0].channel).toBe('EMAIL');
    expect(results[1].channel).toBe('SMS');
    expect(results.every((r) => r.correlation_id === 'corr_warn_001')).toBe(true);
  });

  it('serializes BigInt remaining balance as string in payload', async () => {
    const { adapter, calls } = captureAdapter();
    const engine = new NotificationEngine(consentForAll(true), adapter);
    await engine.send48hExpiryWarning({
      user_id: 'cu_warn_2',
      wallet_id: 'w2',
      remaining_balance_tokens: 9_876n,
      expires_at_utc: new Date().toISOString(),
    });
    expect(calls[0].payload.remaining_balance_tokens).toBe('9876');
  });
});

describe('NotificationEngine — personal-touch HCZ routing', () => {
  it('default consent resolver suppresses HUMAN_CONTACT_ZONE', async () => {
    const engine = new NotificationEngine();
    const result = await engine.triggerPersonalTouch({
      user_id: 'cu_high',
      wallet_id: 'w_high',
      balance_usd_cents: 1_500_000n,
    });
    expect(result.dispatched).toBe(false);
    expect(result.suppression_reason).toBe('NOT_OPTED_IN');
  });

  it('routes to HUMAN_CONTACT_ZONE when consent resolver opts in', async () => {
    const engine = new NotificationEngine(consentForAll(true));
    const result = await engine.triggerPersonalTouch({
      user_id: 'cu_high',
      wallet_id: 'w_high',
      balance_usd_cents: 1_500_000n,
      correlation_id: 'corr_pt_001',
    });
    expect(result.dispatched).toBe(true);
    expect(result.channel).toBe('HUMAN_CONTACT_ZONE');
    expect(result.template).toBe('HIGH_BALANCE_PERSONAL_TOUCH');
    expect(result.correlation_id).toBe('corr_pt_001');
  });
});

describe('NotificationEngine — audit tail', () => {
  it('captures both dispatched and suppressed results', async () => {
    const engine = new NotificationEngine(consentForAll(true));
    await engine.send({
      user_id: 'cu_aud',
      channel: 'EMAIL',
      template: 'EXPIRY_WARNING_48H',
      payload: {},
    });
    await engine.send({
      user_id: 'cu_aud',
      channel: 'EMAIL',
      template: 'EXPIRY_WARNING_48H',
      payload: {},
    });
    const tail = engine.getAuditTail();
    expect(tail).toHaveLength(2);
    expect(tail[0].dispatched).toBe(true);
    expect(tail[1].dispatched).toBe(false);
    expect(tail[1].suppression_reason).toBe('DUPLICATE_WITHIN_TTL');
  });

  it('every audit row carries rule_applied_id NOTIFICATION_ENGINE_v1', async () => {
    const engine = new NotificationEngine(consentForAll(true));
    await engine.send({
      user_id: 'cu_rule',
      channel: 'EMAIL',
      template: 'EXPIRY_WARNING_48H',
      payload: {},
    });
    const tail = engine.getAuditTail();
    expect(tail[0].rule_applied_id).toBe('NOTIFICATION_ENGINE_v1');
  });
});
