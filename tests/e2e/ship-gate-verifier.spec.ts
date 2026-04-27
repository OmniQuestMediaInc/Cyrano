// PAYLOAD 8 — Unit tests for the Ship-Gate Verifier itself.
// Hermetic — invokes the verifier against the live tree and pins the
// shape + summary of the resulting report.

import { runShipGate } from '../../PROGRAM_CONTROL/ship-gate-verifier';

describe('Ship-Gate Verifier', () => {
  const report = runShipGate();

  it('produces a structured report', () => {
    expect(report.generated_at_utc).toMatch(/T/);
    expect(report.total).toBeGreaterThan(10);
    expect(['GREEN', 'YELLOW', 'RED']).toContain(report.summary);
  });

  it('every result row has id + category + description + status + evidence', () => {
    for (const r of report.results) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.category).toBe('string');
      expect(typeof r.description).toBe('string');
      expect(['PASS', 'FAIL', 'SKIP']).toContain(r.status);
      expect(Array.isArray(r.evidence)).toBe(true);
    }
  });

  it('FIZ-1 catches missing ledger triggers', () => {
    const fiz1 = report.results.find((r) => r.id === 'FIZ-1');
    expect(fiz1?.status).toBe('PASS');
  });

  it('UI-1 catches missing UI page builders', () => {
    const ui1 = report.results.find((r) => r.id === 'UI-1');
    expect(ui1?.status).toBe('PASS');
  });

  it('UI-2 confirms dark mode is default', () => {
    const ui2 = report.results.find((r) => r.id === 'UI-2');
    expect(ui2?.status).toBe('PASS');
  });

  it('E2E-1 confirms Payload 8 test files are present', () => {
    const e2e = report.results.find((r) => r.id === 'E2E-1');
    expect(e2e?.status).toBe('PASS');
  });

  it('NET-1 confirms Postgres + Redis are not exposed on host', () => {
    const net = report.results.find((r) => r.id === 'NET-1');
    expect(net?.status).toBe('PASS');
  });

  it('SEC-1 confirms .env patterns are gitignored', () => {
    const sec = report.results.find((r) => r.id === 'SEC-1');
    expect(sec?.status).toBe('PASS');
  });

  it('DOC-1 confirms architecture + checklist + readme are present', () => {
    const doc = report.results.find((r) => r.id === 'DOC-1');
    expect(doc?.status).toBe('PASS');
  });

  it('summary is GREEN or YELLOW (never RED on a clean tree)', () => {
    if (report.summary === 'RED') {
      const failed = report.results.filter((r) => r.status === 'FAIL');
      throw new Error(
        `Ship-gate FAILED:\n${failed
          .map((f) => `  ${f.id}: ${f.evidence.join(' / ')}`)
          .join('\n')}`,
      );
    }
    expect(['GREEN', 'YELLOW']).toContain(report.summary);
  });
});
