// WO: WO-021 / WO-030
import { createHash } from 'crypto';
import { CommissionSplitEntry } from './schema';
import { NotificationGateway } from './notification-gateway.service';

export class BatchPayoutService {
  public static async generateStudioBatch(studioId: string, entries: CommissionSplitEntry[]): Promise<any> {
    const validEntries = entries.filter(e => e.studioId === studioId && (e.modelNetCents + e.studioAgencyHoldbackCents === e.grossCents));
    let totalCents = 0n;
    const ids: string[] = [];

    validEntries.forEach(entry => {
      totalCents += (entry.studioAgencyHoldbackCents + entry.studioServiceFeesCents) - entry.platformSystemFeeCents;
      ids.push(entry.transactionId);
    });

    const payload = `${studioId}:${totalCents.toString()}:${ids.sort().join(',')}`;
    const batch = {
      batchId: `OQMI-BATCH-${studioId}-${Date.now()}`,
      totalPayoutCents: totalCents,
      batchChecksum: createHash('sha512').update(payload).digest('hex'),
      processedAt: new Date().toISOString()
    };

    await NotificationGateway.dispatchPayoutAlert({
      studioId,
      batchId: batch.batchId,
      amountCents: batch.totalPayoutCents.toString(),
      currency: 'USD',
      checksum: batch.batchChecksum,
      eventTimestamp: batch.processedAt,
    });

    return batch;
  }
}