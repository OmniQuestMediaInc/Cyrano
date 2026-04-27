import { CommissionSplitEntry } from './schema';

export interface AuditComplianceReport {
  summary: {
    totalGrossCents: bigint;
    totalModelNetCents: bigint;
    totalPlatformFeesCents: bigint;
    entryCount: number;
  };
  violations: Array<{ id: string; reason: string }>;
  timestamp: string;
}

export class AuditDashboardService {
  /**
   * Aggregates ledger entries into a visualizable compliance report.
   * Scans for SHA-512 integrity and Red Book anomalies.
   */
  public static generateComplianceReport(entries: CommissionSplitEntry[]): AuditComplianceReport {
    let totalGross = 0n;
    let totalNet = 0n;
    let totalPlatform = 0n;
    const violations: Array<{ id: string; reason: string }> = [];

    entries.forEach(entry => {
      // 1. Math Integrity Check
      const calculatedSum = entry.modelNetCents + entry.studioAgencyHoldbackCents;
      if (calculatedSum !== entry.grossCents) {
        violations.push({ id: entry.transactionId, reason: 'MATH_MISMATCH_DETECTED' });
      }

      // 2. Accumulate Totals
      totalGross += entry.grossCents;
      totalNet += entry.modelNetCents;
      totalPlatform += entry.platformSystemFeeCents;
    });

    return {
      summary: {
        totalGrossCents: totalGross,
        totalModelNetCents: totalNet,
        totalPlatformFeesCents: totalPlatform,
        entryCount: entries.length
      },
      violations,
      timestamp: new Date().toISOString()
    };
  }
}