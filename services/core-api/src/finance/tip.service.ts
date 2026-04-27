// WO: WO-INIT-001
import { Injectable } from '@nestjs/common';
import { logger } from '../logger';
import { LedgerService } from './ledger.service';
import { TipTransaction } from './ledger.types';

@Injectable()
export class TipService {
  constructor(private readonly ledger: LedgerService) {}

  async processTip(tx: TipTransaction): Promise<void> {
    const missing: string[] = [];
    if (!tx.userId) missing.push('userId');
    if (!tx.creatorId) missing.push('creatorId');
    if (!tx.correlationId) missing.push('correlationId');
    if (!Number.isFinite(tx.tokenAmount) || tx.tokenAmount <= 0) {
      missing.push('tokenAmount (must be a positive number)');
    }

    if (missing.length > 0) {
      const message = `processTip: invalid input — missing or invalid fields: ${missing.join(', ')}`;
      logger.error(message, undefined, { context: 'TipService', correlationId: tx.correlationId });
      throw new Error(message);
    }

    logger.info('processTip: processing tip transaction', {
      context: 'TipService',
      correlationId: tx.correlationId,
      userId: tx.userId,
      creatorId: tx.creatorId,
      tokenAmount: tx.tokenAmount,
      isVIP: tx.isVIP,
    });

    await this.ledger.recordSplitTip(tx);

    logger.info('processTip: tip processed successfully', {
      context: 'TipService',
      correlationId: tx.correlationId,
    });
  }
}
