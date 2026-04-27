// services/fraud-prevention/src/repositories/ChargebackRepository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core-api/src/prisma.service';
import { ExtensionActionRecord } from '../interfaces/shared';

@Injectable()
export class ChargebackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createExtensionAction(record: Omit<ExtensionActionRecord, 'actionId'>): Promise<ExtensionActionRecord & { createdAt: Date }> {
    const saved = await this.prisma.extensionActionRecord.create({
      data: {
        guestId: record.guestId,
        agentId: record.agentId,
        agentTier: record.agentTier,
        action: record.action,
        expiryExtensionDays: record.expiryExtensionDays,
        goodwillCreditCZT: record.goodwillCreditCZT,
        interactionRef: record.interactionRef,
        reason: record.reason,
        executedAt: record.executedAt,
        ceoReviewFlagged: record.ceoReviewFlagged,
      },
    });
    return saved;
  }

  async getExtensionActionCount30d(guestId: string): Promise<number> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const count = await this.prisma.extensionActionRecord.count({
      where: { guestId, executedAt: { gte: since } },
    });
    return count;
  }
}
