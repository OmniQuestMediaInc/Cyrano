// WO: WO-019
import { Controller, Get, Query } from '@nestjs/common';
import { db } from '../db';
import { logger } from '../logger';

export interface AuditDashboardSummary {
  totalLedgerEntries: number;
  flaggedEntries: number;
  redBookScenarioCount: number;
  complianceStatus: 'COMPLIANT' | 'REVIEW_REQUIRED' | 'NON_COMPLIANT';
}

/**
 * WO-019: Audit Dashboard API
 * Compliance visualization for Red Book scenarios.
 * TODO: Implement full Red Book scenario filtering and compliance metrics.
 */
@Controller('audit')
export class AuditDashboardController {
  @Get('summary')
  async getSummary(): Promise<AuditDashboardSummary> {
    logger.info('AuditDashboardController: getSummary called', {
      context: 'AuditDashboardController',
    });

    const totalLedgerEntries = await db.ledgerEntry.count();

    return {
      totalLedgerEntries,
      flaggedEntries: 0,
      redBookScenarioCount: 0,
      complianceStatus: 'COMPLIANT',
    };
  }

  @Get('log')
  async getAuditLog(
    @Query('studioId') studioId?: string,
    @Query('performerId') performerId?: string,
  ): Promise<unknown[]> {
    logger.info('AuditDashboardController: getAuditLog called', {
      context: 'AuditDashboardController',
      studioId,
      performerId,
    });

    const where: Record<string, unknown> = {};
    if (studioId) where['studio_id'] = studioId;
    if (performerId) where['performer_id'] = performerId;

    return await db.ledgerEntry.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }
}
