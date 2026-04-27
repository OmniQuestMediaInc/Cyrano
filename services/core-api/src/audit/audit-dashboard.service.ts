// WO: WO-019
import { logger } from '../logger';
import { db } from '../db';

export interface AuditScenario {
  scenarioId: string;
  label: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  evaluatedAt: Date;
}

export interface AuditDashboardSummary {
  totalScenarios: number;
  passed: number;
  failed: number;
  pending: number;
  scenarios: AuditScenario[];
}

export class AuditDashboardService {
  async getComplianceSummary(studioId: string): Promise<AuditDashboardSummary> {
    logger.info('getComplianceSummary: evaluating Red Book compliance scenarios', {
      context: 'AuditDashboardService',
      studioId,
    });

    const MAX_AUDIT_SCENARIOS = 100;

    const entries = await db.ledgerEntry.findMany({
      where: { studio_id: studioId },
      select: {
        id: true,
        entry_type: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: MAX_AUDIT_SCENARIOS,
    });

    const scenarios: AuditScenario[] = entries.map((e) => ({
      scenarioId: e.id,
      label: `${e.entry_type}:${e.id}`,
      status: 'PENDING' as const,
      evaluatedAt: e.created_at,
    }));

    const summary: AuditDashboardSummary = {
      totalScenarios: scenarios.length,
      passed: 0,
      failed: 0,
      pending: scenarios.length,
      scenarios,
    };

    logger.info('getComplianceSummary: summary generated', {
      context: 'AuditDashboardService',
      studioId,
      total: summary.totalScenarios,
    });

    return summary;
  }
}
