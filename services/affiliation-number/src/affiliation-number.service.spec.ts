// services/affiliation-number/src/affiliation-number.service.spec.ts
// RBAC-STUDIO-001 — generator unit tests.
import {
  AFFILIATION_NUMBER_ALPHABET,
  AffiliationNumberService,
} from './affiliation-number.service';

describe('AffiliationNumberService', () => {
  let svc: AffiliationNumberService;

  beforeEach(() => {
    svc = new AffiliationNumberService();
  });

  describe('isValidFormat', () => {
    it.each([
      ['K7X9P2', true],
      ['V4M8R3Q', true],
      ['B6H9T2W4', true],
      ['ABCDEF', true], // exactly 6
      ['ABCDEFGHJ', true], // exactly 9
    ])('accepts canonical sample %s', (s, expected) => {
      expect(svc.isValidFormat(s)).toBe(expected);
    });

    it.each([
      ['ABCDE', 'too short'],
      ['ABCDEFGHJK', 'too long'],
      ['ABCDE0', 'contains 0'],
      ['ABCDE1', 'contains 1'],
      ['ABCDEO', 'contains O'],
      ['ABCDEI', 'contains I'],
      ['abcdef', 'lowercase'],
      ['ABC DEF', 'contains space'],
      ['', 'empty'],
    ])('rejects %s (%s)', (s) => {
      expect(svc.isValidFormat(s)).toBe(false);
    });
  });

  describe('generate', () => {
    it('returns a valid number on first attempt when no collision', async () => {
      const result = await svc.generate({
        existsCheck: async () => false,
      });
      expect(result.attempts).toBe(1);
      expect(svc.isValidFormat(result.affiliation_number)).toBe(true);
      expect(result.affiliation_number).toHaveLength(7); // default length
      expect(result.rule_applied_id).toBe('STUDIO_AFFILIATION_v1');
    });

    it('honours custom length within 6-9 range', async () => {
      const result = await svc.generate({
        length: 9,
        existsCheck: async () => false,
      });
      expect(result.affiliation_number).toHaveLength(9);
    });

    it.each([5, 10, 0, -1])('rejects length %d outside 6-9 range', async (length) => {
      await expect(
        svc.generate({ length, existsCheck: async () => false }),
      ).rejects.toThrow(/invalid length/);
    });

    it('retries on collision and succeeds when probe finally returns false', async () => {
      let calls = 0;
      const result = await svc.generate({
        existsCheck: async () => {
          calls += 1;
          return calls < 3; // first two attempts collide
        },
      });
      expect(result.attempts).toBe(3);
      expect(svc.isValidFormat(result.affiliation_number)).toBe(true);
    });

    it('throws AFFILIATION_NUMBER_EXHAUSTED after maxAttempts collisions', async () => {
      await expect(
        svc.generate({
          maxAttempts: 3,
          existsCheck: async () => true,
        }),
      ).rejects.toThrow('AFFILIATION_NUMBER_EXHAUSTED');
    });

    it('only emits characters from the canonical alphabet', async () => {
      // Statistical sample — generate 200 numbers and check every char.
      const allowed = new Set(AFFILIATION_NUMBER_ALPHABET.split(''));
      for (let i = 0; i < 200; i++) {
        const r = await svc.generate({ existsCheck: async () => false });
        for (const ch of r.affiliation_number) {
          expect(allowed.has(ch)).toBe(true);
        }
      }
    });
  });
});
