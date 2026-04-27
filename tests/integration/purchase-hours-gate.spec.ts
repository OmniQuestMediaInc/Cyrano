/**
 * purchase-hours-gate.spec.ts
 * Integration tests: PurchaseHoursGateService.
 *
 * Validates ALLOWED / BLOCKED_OUTSIDE_WINDOW logic against the DFSP purchase
 * window (11:00–23:00 in account billing TZ). Uses seed customer data from
 * Ghost Alpha CSVs to parameterise account IDs and synthetic timezone inputs.
 */
import { PurchaseHoursGateService } from '../../services/core-api/src/dfsp/purchase-hours-gate.service';
import { GovernanceConfig } from '../../services/core-api/src/governance/governance.config';
import { loadCustomers, loadDemoScenarios } from './seed-loader';

// ── Mocks ─────────────────────────────────────────────────────────────────────
function buildMockPrisma(configOverride?: { window_open_hour?: number; window_close_hour?: number } | null) {
  return {
    purchaseWindowConfig: {
      findFirst: jest.fn(async () => configOverride ?? null),
    },
  };
}

function buildMockNats() {
  return { publish: jest.fn() };
}

function makeService(
  configOverride?: { window_open_hour?: number; window_close_hour?: number } | null,
) {
  const prisma = buildMockPrisma(configOverride);
  const nats = buildMockNats();
  const svc = new PurchaseHoursGateService(prisma as any, nats as any);
  return { svc, nats };
}

// ── Window boundary helpers ───────────────────────────────────────────────────
const OPEN_HOUR  = GovernanceConfig.DFSP_PURCHASE_WINDOW_OPEN_HOUR;   // 11
const CLOSE_HOUR = GovernanceConfig.DFSP_PURCHASE_WINDOW_CLOSE_HOUR;  // 23

/**
 * Builds a timezone-aware ISO datetime string that places the clock
 * at a specific hour in the given IANA timezone, using Date arithmetic.
 * We do this by mocking Date.now / new Date() via jest fake timers.
 *
 * Simpler approach: override getCurrentHourInTz via a spy on the private method
 * exposed through the service's Intl.DateTimeFormat call. Since we can't easily
 * inject the clock, we use real timezones whose current offset places the test
 * time within or outside the window.
 *
 * For deterministic tests we parametrise over timezones and mocked hours using
 * jest's fake timer + Date override approach.
 */
function withMockedHour(targetHour: number, callback: () => Promise<void>): () => Promise<void> {
  return async () => {
    // Find a UTC offset that, when the test runs, maps to targetHour local time.
    // Approach: set Date to a time whose UTC hour, when interpreted in UTC+0,
    // gives exactly targetHour. We use 'UTC' as the billing_tz so the UTC hour
    // IS the local hour. This keeps tests hermetic and fast.
    const now = new Date();
    const fakeDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      targetHour, 0, 0, 0,
    ));
    jest.useFakeTimers({ now: fakeDate.getTime() });
    try {
      await callback();
    } finally {
      jest.useRealTimers();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('PurchaseHoursGateService — governance constants', () => {
  it('open hour is 11', () => {
    expect(OPEN_HOUR).toBe(11);
  });

  it('close hour is 23', () => {
    expect(CLOSE_HOUR).toBe(23);
  });

  it('result shape contains all required fields', async () => {
    const { svc } = makeService();
    const result = await svc.evaluatePurchaseWindow({
      account_id: 'cu_001',
      billing_tz: 'UTC',
    });
    expect(result).toHaveProperty('account_id');
    expect(result).toHaveProperty('outcome');
    expect(result).toHaveProperty('account_timezone');
    expect(result).toHaveProperty('window_open_hour');
    expect(result).toHaveProperty('window_close_hour');
    expect(result).toHaveProperty('evaluated_at_utc');
    expect(result).toHaveProperty('rule_applied_id');
    expect(result.rule_applied_id).toBe('PURCHASE_HOURS_GATE_v1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PurchaseHoursGateService — ALLOWED within purchase window', () => {
  const insideHours = [11, 12, 15, 18, 20, 22];

  for (const hour of insideHours) {
    it(
      `returns ALLOWED at UTC hour ${hour} (billing_tz=UTC)`,
      withMockedHour(hour, async () => {
        const { svc } = makeService();
        const result = await svc.evaluatePurchaseWindow({
          account_id: 'cu_inside',
          billing_tz: 'UTC',
        });
        expect(result.outcome).toBe('ALLOWED');
        expect(result.window_opens_at).toBeNull();
      }),
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PurchaseHoursGateService — BLOCKED outside purchase window', () => {
  const outsideHours = [0, 1, 5, 9, 10, 23];

  for (const hour of outsideHours) {
    it(
      `returns BLOCKED_OUTSIDE_WINDOW at UTC hour ${hour} (billing_tz=UTC)`,
      withMockedHour(hour, async () => {
        const { svc, nats } = makeService();
        const result = await svc.evaluatePurchaseWindow({
          account_id: 'cu_outside',
          billing_tz: 'UTC',
        });
        expect(result.outcome).toBe('BLOCKED_OUTSIDE_WINDOW');
        expect(result.window_opens_at).not.toBeNull();
        expect(nats.publish).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            account_id: 'cu_outside',
            rule_applied_id: 'PURCHASE_HOURS_GATE_v1',
          }),
        );
      }),
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PurchaseHoursGateService — window boundary conditions', () => {
  it(
    'open boundary (hour=11) is ALLOWED (inclusive)',
    withMockedHour(OPEN_HOUR, async () => {
      const { svc } = makeService();
      const result = await svc.evaluatePurchaseWindow({
        account_id: 'cu_boundary_open',
        billing_tz: 'UTC',
      });
      expect(result.outcome).toBe('ALLOWED');
    }),
  );

  it(
    'close boundary (hour=23) is BLOCKED (exclusive)',
    withMockedHour(CLOSE_HOUR, async () => {
      const { svc } = makeService();
      const result = await svc.evaluatePurchaseWindow({
        account_id: 'cu_boundary_close',
        billing_tz: 'UTC',
      });
      expect(result.outcome).toBe('BLOCKED_OUTSIDE_WINDOW');
    }),
  );

  it(
    'one hour before close (hour=22) is ALLOWED',
    withMockedHour(CLOSE_HOUR - 1, async () => {
      const { svc } = makeService();
      const result = await svc.evaluatePurchaseWindow({
        account_id: 'cu_before_close',
        billing_tz: 'UTC',
      });
      expect(result.outcome).toBe('ALLOWED');
    }),
  );

  it(
    'one hour before open (hour=10) is BLOCKED',
    withMockedHour(OPEN_HOUR - 1, async () => {
      const { svc } = makeService();
      const result = await svc.evaluatePurchaseWindow({
        account_id: 'cu_before_open',
        billing_tz: 'UTC',
      });
      expect(result.outcome).toBe('BLOCKED_OUTSIDE_WINDOW');
    }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PurchaseHoursGateService — DB config override', () => {
  it('uses DB config window hours when a matching row is returned', async () => {
    // DB row overrides: window 9–21
    const { svc } = makeService({ window_open_hour: 9, window_close_hour: 21 });
    jest.useFakeTimers({ now: Date.UTC(2026, 3, 11, 10, 0, 0) }); // 10:00 UTC

    const result = await svc.evaluatePurchaseWindow({
      account_id: 'cu_db_override',
      billing_tz: 'UTC',
      country_code: 'CA',
      tier: 'diamond',
    });
    // Hour 10 is within DB override window [9, 21)
    expect(result.outcome).toBe('ALLOWED');
    expect(result.window_open_hour).toBe(9);
    expect(result.window_close_hour).toBe(21);

    jest.useRealTimers();
  });

  it('falls back to governance constants when DB returns null', async () => {
    const { svc } = makeService(null);
    jest.useFakeTimers({ now: Date.UTC(2026, 3, 11, 15, 0, 0) }); // 15:00 UTC

    const result = await svc.evaluatePurchaseWindow({
      account_id: 'cu_fallback',
      billing_tz: 'UTC',
    });
    expect(result.window_open_hour).toBe(OPEN_HOUR);
    expect(result.window_close_hour).toBe(CLOSE_HOUR);

    jest.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PurchaseHoursGateService — window_opens_at is a future ISO timestamp when blocked', () => {
  it(
    'window_opens_at is after evaluated_at_utc when blocked',
    withMockedHour(2, async () => {
      const { svc } = makeService();
      const result = await svc.evaluatePurchaseWindow({
        account_id: 'cu_opens_at',
        billing_tz: 'UTC',
      });
      expect(result.outcome).toBe('BLOCKED_OUTSIDE_WINDOW');
      const opensAt = new Date(result.window_opens_at!).getTime();
      const evaluatedAt = new Date(result.evaluated_at_utc).getTime();
      expect(opensAt).toBeGreaterThan(evaluatedAt);
    }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PurchaseHoursGateService — Ghost Alpha customer scenarios', () => {
  /**
   * Replay first 10 Ghost Alpha demo scenarios:
   * Each scenario's customer attempts a purchase at two points in time —
   * once during the window (ALLOWED) and once outside it (BLOCKED).
   * Validates that account_id and rule_applied_id are echoed correctly.
   */
  const scenarios = loadDemoScenarios().slice(0, 10);
  const customers = loadCustomers();

  it('ALLOWED: all Ghost Alpha scenario customers are permitted inside window', async () => {
    jest.useFakeTimers({ now: Date.UTC(2026, 3, 11, 15, 0, 0) }); // 15:00 UTC — inside

    for (const sc of scenarios) {
      const customer = customers.find(c => c.customer_id === sc.primary_customer_id);
      expect(customer).toBeDefined();

      const { svc } = makeService();
      const result = await svc.evaluatePurchaseWindow({
        account_id: sc.primary_customer_id,
        billing_tz: 'UTC',
      });
      expect(result.outcome).toBe('ALLOWED');
      expect(result.account_id).toBe(sc.primary_customer_id);
      expect(result.rule_applied_id).toBe('PURCHASE_HOURS_GATE_v1');
    }

    jest.useRealTimers();
  });

  it('BLOCKED: all Ghost Alpha scenario customers are blocked outside window', async () => {
    jest.useFakeTimers({ now: Date.UTC(2026, 3, 11, 3, 0, 0) }); // 03:00 UTC — outside

    for (const sc of scenarios) {
      const { svc } = makeService();
      const result = await svc.evaluatePurchaseWindow({
        account_id: sc.primary_customer_id,
        billing_tz: 'UTC',
      });
      expect(result.outcome).toBe('BLOCKED_OUTSIDE_WINDOW');
      expect(result.window_opens_at).not.toBeNull();
    }

    jest.useRealTimers();
  });

  it('account_id is always echoed back in the result', async () => {
    jest.useFakeTimers({ now: Date.UTC(2026, 3, 11, 14, 0, 0) }); // 14:00 inside

    for (const sc of scenarios) {
      const { svc } = makeService();
      const result = await svc.evaluatePurchaseWindow({
        account_id: sc.primary_customer_id,
        billing_tz: 'UTC',
      });
      expect(result.account_id).toBe(sc.primary_customer_id);
    }

    jest.useRealTimers();
  });
});
