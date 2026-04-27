// WO: WO-INIT-001
import { Injectable } from '@nestjs/common';
import { db } from '../db';

@Injectable()
export class StatementsService {
  async getStudioStatement(studioId: string): Promise<unknown[]> {
    return await db.ledgerEntry.findMany({
      where: { studio_id: studioId, studio_amount_cents: { gt: 0 } },
      orderBy: { created_at: 'desc' },
    });
  }

  async getCreatorEarnings(performerId: string): Promise<unknown[]> {
    return await db.ledgerEntry.findMany({
      where: { performer_id: performerId },
      orderBy: { created_at: 'desc' },
    });
  }
}
