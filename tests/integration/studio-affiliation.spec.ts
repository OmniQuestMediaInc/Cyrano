/**
 * studio-affiliation.spec.ts
 * STUDIO-AFF-001 — Unit + integration tests for AffiliationNumberGenerator and StudioService.
 *
 * Covers:
 *  - Generator: 1k iterations, no forbidden chars, length in [6,9]
 *  - Generator: retries on collision
 *  - Generator: throws after MAX_RETRIES
 *  - Generator: isValid() static method
 *  - StudioService.affiliate() — join existing ACTIVE studio
 *  - StudioService.affiliate() — reject non-ACTIVE studio
 *  - StudioService.affiliate() — create new studio + founder affiliation (both-or-nothing)
 *  - StudioService.affiliate() — rejects when both or neither path is given
 */

import { AffiliationNumberGenerator } from '../../services/studio-affiliation/src/affiliation-number.generator';

const ALLOWED_CHARS = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
const FORBIDDEN_CHARS = ['0', '1', 'O', 'I'];

describe('AffiliationNumberGenerator', () => {
  let generator: AffiliationNumberGenerator;

  beforeEach(() => {
    generator = new AffiliationNumberGenerator();
  });

  describe('character set', () => {
    it('generates 1,000 unique numbers with no forbidden chars and valid lengths', async () => {
      const seen = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const n = await generator.generateUnique(i, async (c) => !seen.has(c));
        seen.add(n);

        // Length must be in [6, 9]
        expect(n.length).toBeGreaterThanOrEqual(6);
        expect(n.length).toBeLessThanOrEqual(9);

        // No forbidden characters
        for (const ch of FORBIDDEN_CHARS) {
          expect(n).not.toContain(ch);
        }

        // All chars must be in the allowed set
        for (const ch of n) {
          expect(ALLOWED_CHARS.has(ch)).toBe(true);
        }
      }

      // All 1,000 should be unique
      expect(seen.size).toBe(1000);
    });
  });

  describe('collision retry', () => {
    it('retries on collision and returns next unique candidate', async () => {
      const returned: string[] = [];
      let callCount = 0;

      const isUnique = jest.fn().mockImplementation(async (_candidate: string) => {
        callCount++;
        // First two candidates collide; third is unique
        return callCount > 2;
      });

      const result = await generator.generateUnique(0, isUnique);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThanOrEqual(6);
      expect(callCount).toBe(3);
      returned.push(result);
    });

    it('throws after MAX_RETRIES (5) consecutive collisions', async () => {
      const alwaysCollides = jest.fn().mockResolvedValue(false);
      await expect(generator.generateUnique(0, alwaysCollides)).rejects.toThrow(
        /could not generate a unique number/,
      );
      expect(alwaysCollides).toHaveBeenCalledTimes(5);
    });
  });

  describe('isValid', () => {
    it('returns true for valid 6-char numbers', () => {
      expect(AffiliationNumberGenerator.isValid('ABCDEF')).toBe(true);
    });

    it('returns true for valid 9-char numbers', () => {
      expect(AffiliationNumberGenerator.isValid('ABCDEFGHJK'.slice(0, 9))).toBe(true);
    });

    it('returns false for strings with forbidden characters', () => {
      expect(AffiliationNumberGenerator.isValid('ABC0EF')).toBe(false); // contains 0
      expect(AffiliationNumberGenerator.isValid('ABCOEF')).toBe(false); // contains O
      expect(AffiliationNumberGenerator.isValid('ABCIDF')).toBe(false); // contains I
      expect(AffiliationNumberGenerator.isValid('AB1DEF')).toBe(false); // contains 1
    });

    it('returns false for strings outside length range', () => {
      expect(AffiliationNumberGenerator.isValid('ABCDE')).toBe(false); // 5 chars
      expect(AffiliationNumberGenerator.isValid('ABCDEFGHJKL')).toBe(false); // 11 chars
    });

    it('returns false for lowercase', () => {
      expect(AffiliationNumberGenerator.isValid('abcdef')).toBe(false);
    });
  });
});

// ─── StudioService integration tests (mocked Prisma + NATS) ──────────────────

import { StudioService } from '../../services/studio-affiliation/src/studio.service';

function makeMockPrisma(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    studio: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
    studioAffiliation: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    ...overrides,
  };
}

function makeMockNats() {
  return { publish: jest.fn().mockResolvedValue(undefined) };
}

function makeGenerator() {
  const gen = new AffiliationNumberGenerator();
  return gen;
}

const BASE_REQUEST = {
  creator_id: 'creator-uuid-001',
  organization_id: 'org-001',
  tenant_id: 'tenant-001',
  correlation_id: 'corr-001',
};

describe('StudioService', () => {
  describe('affiliate() — validation', () => {
    it('throws when neither existing_studio_id nor studio_name is given', async () => {
      const prisma = makeMockPrisma();
      const nats = makeMockNats();
      const service = new StudioService(prisma as never, nats as never, makeGenerator());

      await expect(service.affiliate({ ...BASE_REQUEST })).rejects.toThrow(
        /existing_studio_id or studio_name/,
      );
    });

    it('throws when both existing_studio_id and studio_name are given', async () => {
      const prisma = makeMockPrisma();
      const nats = makeMockNats();
      const service = new StudioService(prisma as never, nats as never, makeGenerator());

      await expect(
        service.affiliate({
          ...BASE_REQUEST,
          existing_studio_id: 'studio-001',
          studio_name: 'My Studio',
        }),
      ).rejects.toThrow(/not both/);
    });
  });

  describe('affiliate() — join existing studio (Path A)', () => {
    it('inserts StudioAffiliation and emits NATS event for ACTIVE studio', async () => {
      const studioRow = {
        id: 'studio-001',
        name: 'Test Studio',
        affiliation_number: 'ABCDEF',
        status: 'ACTIVE',
      };
      const affiliationRow = {
        id: 'aff-001',
        studio_id: 'studio-001',
        creator_id: BASE_REQUEST.creator_id,
      };

      const txCallback = jest.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          studio: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(studioRow),
          },
          studioAffiliation: {
            create: jest.fn().mockResolvedValue(affiliationRow),
          },
        };
        return fn(tx);
      });

      const prisma = { ...makeMockPrisma(), $transaction: txCallback };
      const nats = makeMockNats();
      const service = new StudioService(prisma as never, nats as never, makeGenerator());

      const result = await service.affiliate({
        ...BASE_REQUEST,
        existing_studio_id: 'studio-001',
      });

      expect(result.studio.id).toBe('studio-001');
      expect(result.affiliation_number).toBe('ABCDEF');
      expect(nats.publish).toHaveBeenCalledWith(
        'nats.studios.affiliated',
        expect.objectContaining({
          studio_id: 'studio-001',
          correlation_id: BASE_REQUEST.correlation_id,
        }),
      );
    });

    it('rejects when existing studio is not ACTIVE', async () => {
      const studioRow = {
        id: 'studio-002',
        name: 'Suspended Studio',
        affiliation_number: 'GHIJKL',
        status: 'SUSPENDED',
      };

      const txCallback = jest.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          studio: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(studioRow),
          },
          studioAffiliation: {
            create: jest.fn(),
          },
        };
        return fn(tx);
      });

      const prisma = { ...makeMockPrisma(), $transaction: txCallback };
      const nats = makeMockNats();
      const service = new StudioService(prisma as never, nats as never, makeGenerator());

      await expect(
        service.affiliate({ ...BASE_REQUEST, existing_studio_id: 'studio-002' }),
      ).rejects.toThrow(/not ACTIVE/);
    });
  });

  describe('affiliate() — create new studio (Path B)', () => {
    it('creates Studio + founder StudioAffiliation and emits NATS', async () => {
      const studioRow = {
        id: 'studio-new-001',
        name: 'New Studio',
        affiliation_number: 'NEWSTD',
        status: 'PENDING',
      };
      const affiliationRow = {
        id: 'aff-new-001',
        studio_id: 'studio-new-001',
        creator_id: BASE_REQUEST.creator_id,
      };

      const txCallback = jest.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          studio: {
            findUnique: jest.fn().mockResolvedValue(null), // no collision
            create: jest.fn().mockResolvedValue(studioRow),
          },
          studioAffiliation: {
            create: jest.fn().mockResolvedValue(affiliationRow),
          },
        };
        return fn(tx);
      });

      const prisma = {
        ...makeMockPrisma(),
        $transaction: txCallback,
      };
      // studio.count for length calculation, studio.findUnique for uniqueness pre-check
      (prisma.studio.count as jest.Mock).mockResolvedValue(0);
      (prisma.studio.findUnique as jest.Mock).mockResolvedValue(null);

      const nats = makeMockNats();
      const service = new StudioService(prisma as never, nats as never, makeGenerator());

      const result = await service.affiliate({
        ...BASE_REQUEST,
        studio_name: 'New Studio',
      });

      expect(result.studio.id).toBe('studio-new-001');
      expect(result.studio.status).toBe('PENDING');
      expect(result.affiliation_number).toBe('NEWSTD');
      expect(nats.publish).toHaveBeenCalledWith(
        'nats.studios.affiliated',
        expect.objectContaining({ studio_id: 'studio-new-001' }),
      );
    });
  });
});
