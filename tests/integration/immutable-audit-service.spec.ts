/**
 * immutable-audit-service.spec.ts
 * PAYLOAD 6 — ImmutableAuditService hash-chain + idempotency + WORM export.
 *
 * Uses an in-memory Prisma delegate and a stubbed NatsService. Deterministic,
 * hermetic tests — no real DB or broker required.
 */
import { createHash } from 'crypto';
import {
  ImmutableAuditService,
  GENESIS_HASH,
} from '../../services/core-api/src/audit/immutable-audit.service';
import { NATS_TOPICS } from '../../services/nats/topics.registry';

type Row = Record<string, unknown>;

function buildMemoryPrisma() {
  const store: Row[] = [];
  const wormStore: Row[] = [];
  let sequenceCounter = 0n;

  return {
    immutableAuditEvent: {
      findUnique: jest.fn(async ({ where }: { where: Row }) => {
        return store.find(
          (r) => r.correlation_id === where.correlation_id,
        ) ?? null;
      }),
      findFirst: jest.fn(async (args?: { orderBy?: Row }) => {
        void args;
        if (store.length === 0) return null;
        return store
          .slice()
          .sort(
            (a, b) =>
              Number(b.sequence_number as bigint) -
              Number(a.sequence_number as bigint),
          )[0];
      }),
      findMany: jest.fn(async (args?: { orderBy?: Row; take?: number; where?: Row; select?: Row }) => {
        let out = store.slice();
        if (args?.where) {
          const whereAny = args.where as Record<string, unknown>;
          const createdAtFilter = whereAny.created_at as
            | { gte?: Date; lte?: Date }
            | undefined;
          if (createdAtFilter) {
            out = out.filter((r) => {
              const createdAt = r.created_at as Date;
              if (createdAtFilter.gte && createdAt < createdAtFilter.gte) return false;
              if (createdAtFilter.lte && createdAt > createdAtFilter.lte) return false;
              return true;
            });
          }
        }
        out.sort(
          (a, b) =>
            Number(a.sequence_number as bigint) -
            Number(b.sequence_number as bigint),
        );
        if (args?.take) out = out.slice(0, args.take);
        return out;
      }),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row: Row = { ...data, created_at: new Date() };
        if (!row.event_id) row.event_id = `evt_${store.length + 1}`;
        store.push(row);
        return row;
      }),
    },
    wormExportRecord: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { ...data, exported_at: new Date() };
        wormStore.push(row);
        return row;
      }),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      // Emulate advisory lock + sequence assignment inside the tx.
      const tx = {
        $executeRawUnsafe: jest.fn(async () => 1),
        immutableAuditEvent: {
          findFirst: jest.fn(async (args?: { orderBy?: Row }) => {
            void args;
            if (store.length === 0) return null;
            return store
              .slice()
              .sort(
                (a, b) =>
                  Number(b.sequence_number as bigint) -
                  Number(a.sequence_number as bigint),
              )[0];
          }),
          create: jest.fn(async ({ data }: { data: Row }) => {
            sequenceCounter += 1n;
            const withSequence = { ...data };
            if (!('sequence_number' in withSequence) || withSequence.sequence_number === undefined) {
              withSequence.sequence_number = sequenceCounter;
            } else {
              sequenceCounter =
                (withSequence.sequence_number as bigint) > sequenceCounter
                  ? (withSequence.sequence_number as bigint)
                  : sequenceCounter;
            }
            const row: Row = { ...withSequence, created_at: new Date() };
            if (!row.event_id) row.event_id = `evt_${store.length + 1}`;
            store.push(row);
            return row;
          }),
        },
      };
      return cb(tx);
    }),
    __internal: { store, wormStore },
  };
}

function buildStubNats() {
  const published: Array<{ topic: string; payload: Record<string, unknown> }> = [];
  return {
    publish: jest.fn((topic: string, payload: Record<string, unknown>) => {
      published.push({ topic, payload });
    }),
    subscribe: jest.fn(),
    __published: published,
  };
}

describe('ImmutableAuditService', () => {
  it('emits a genesis event with hash_prior=null and a SHA-256 hash_current', async () => {
    const prisma = buildMemoryPrisma();
    const nats = buildStubNats();
    const svc = new ImmutableAuditService(prisma as never, nats as never);

    const result = await svc.emit({
      eventType: 'PURCHASE',
      correlationId: 'corr_1',
      actorId: 'user_1',
      actorRole: 'guest',
      reasonCode: 'TOKEN_PURCHASE',
      redactedPayload: { amount_tokens: 100, currency: 'CZT' },
    });

    expect(result.duplicate).toBe(false);
    expect(result.hash_prior).toBeNull();
    expect(result.hash_current).toHaveLength(64);
    expect(result.sequence_number).toBe('1');

    const expectedPayloadHash = createHash('sha256')
      .update(
        JSON.stringify({ amount_tokens: 100, currency: 'CZT' }),
      )
      .digest('hex');
    expect(result.payload_hash).toBe(expectedPayloadHash);

    const expectedHashCurrent = createHash('sha256')
      .update(GENESIS_HASH + expectedPayloadHash)
      .digest('hex');
    expect(result.hash_current).toBe(expectedHashCurrent);
  });

  it('is idempotent on correlation_id — second emit returns the original row', async () => {
    const prisma = buildMemoryPrisma();
    const nats = buildStubNats();
    const svc = new ImmutableAuditService(prisma as never, nats as never);

    const first = await svc.emit({
      eventType: 'GATEGUARD_DECISION',
      correlationId: 'gg_1',
      actorId: 'user_1',
      actorRole: 'guest',
      reasonCode: 'GG_APPROVE',
      redactedPayload: { decision: 'APPROVE' },
    });
    const second = await svc.emit({
      eventType: 'GATEGUARD_DECISION',
      correlationId: 'gg_1',
      actorId: 'user_1',
      actorRole: 'guest',
      reasonCode: 'GG_APPROVE',
      redactedPayload: { decision: 'APPROVE' },
    });

    expect(second.duplicate).toBe(true);
    expect(second.event_id).toBe(first.event_id);
    expect(prisma.__internal.store).toHaveLength(1);
  });

  it('chains events — hash_prior on event N equals hash_current of event N-1', async () => {
    const prisma = buildMemoryPrisma();
    const nats = buildStubNats();
    const svc = new ImmutableAuditService(prisma as never, nats as never);

    const a = await svc.emit({
      eventType: 'PURCHASE',
      correlationId: 'c_a',
      actorId: 'user_1',
      actorRole: 'guest',
      reasonCode: 'P',
      redactedPayload: { n: 1 },
    });
    const b = await svc.emit({
      eventType: 'SPEND',
      correlationId: 'c_b',
      actorId: 'user_1',
      actorRole: 'guest',
      reasonCode: 'S',
      redactedPayload: { n: 2 },
    });
    const c = await svc.emit({
      eventType: 'RECOVERY',
      correlationId: 'c_c',
      actorId: 'user_1',
      actorRole: 'hcz_agent',
      reasonCode: 'R',
      redactedPayload: { n: 3 },
    });

    expect(a.hash_prior).toBeNull();
    expect(b.hash_prior).toBe(a.hash_current);
    expect(c.hash_prior).toBe(b.hash_current);
  });

  it('verifyChain confirms integrity across a clean chain', async () => {
    const prisma = buildMemoryPrisma();
    const nats = buildStubNats();
    const svc = new ImmutableAuditService(prisma as never, nats as never);

    await svc.emit({
      eventType: 'PURCHASE',
      correlationId: 'vc_1',
      actorId: 'user_1',
      actorRole: 'guest',
      reasonCode: 'P',
      redactedPayload: { n: 1 },
    });
    await svc.emit({
      eventType: 'SPEND',
      correlationId: 'vc_2',
      actorId: 'user_1',
      actorRole: 'guest',
      reasonCode: 'S',
      redactedPayload: { n: 2 },
    });

    const verification = await svc.verifyChain();
    expect(verification.valid).toBe(true);
    expect(verification.events_verified).toBe(2);
    expect(verification.first_failure_event_id).toBeNull();
  });

  it('verifyChain detects tampering when hash_current is altered', async () => {
    const prisma = buildMemoryPrisma();
    const nats = buildStubNats();
    const svc = new ImmutableAuditService(prisma as never, nats as never);

    await svc.emit({
      eventType: 'PURCHASE',
      correlationId: 'vt_1',
      actorId: 'user_1',
      actorRole: 'guest',
      reasonCode: 'P',
      redactedPayload: { n: 1 },
    });
    await svc.emit({
      eventType: 'SPEND',
      correlationId: 'vt_2',
      actorId: 'user_1',
      actorRole: 'guest',
      reasonCode: 'S',
      redactedPayload: { n: 2 },
    });

    // Tamper: flip a byte on the first row's hash_current
    prisma.__internal.store[0].hash_current =
      'f'.repeat(64);

    const verification = await svc.verifyChain();
    expect(verification.valid).toBe(false);
    expect(verification.failure_reason).toMatch(/mismatch/);

    const published = nats.__published.map((e) => e.topic);
    expect(published).toContain(NATS_TOPICS.AUDIT_CHAIN_INTEGRITY_FAILURE);
  });

  it('seals a WORM export covering all events in range', async () => {
    const prisma = buildMemoryPrisma();
    const nats = buildStubNats();
    const svc = new ImmutableAuditService(prisma as never, nats as never);

    await svc.emit({
      eventType: 'PURCHASE',
      correlationId: 'w_1',
      actorId: 'user_1',
      actorRole: 'guest',
      reasonCode: 'P',
      redactedPayload: { n: 1 },
    });
    await svc.emit({
      eventType: 'SPEND',
      correlationId: 'w_2',
      actorId: 'user_1',
      actorRole: 'guest',
      reasonCode: 'S',
      redactedPayload: { n: 2 },
    });

    const now = new Date();
    const from = new Date(now.getTime() - 60_000);
    const to = new Date(now.getTime() + 60_000);

    const sealed = await svc.sealWormExport({
      fromUtc: from,
      toUtc: to,
      storageUri: 's3://worm-bucket/2026-04-24',
    });

    expect(sealed.event_count).toBe(2);
    expect(sealed.hash_seal).toHaveLength(64);
    expect(sealed.integrity_verified).toBe(true);
    expect(prisma.__internal.wormStore).toHaveLength(1);

    const topics = nats.__published.map((e) => e.topic);
    expect(topics).toContain(NATS_TOPICS.WORM_EXPORT_COMPLETED);
  });

  it('canonical serialiser produces stable hashes regardless of key order', async () => {
    const prisma = buildMemoryPrisma();
    const nats = buildStubNats();
    const svc = new ImmutableAuditService(prisma as never, nats as never);

    const h1 = svc.hashPayload({ a: 1, b: 2, c: { x: 9, y: 8 } });
    const h2 = svc.hashPayload({ c: { y: 8, x: 9 }, b: 2, a: 1 });
    expect(h1).toBe(h2);
  });
});
