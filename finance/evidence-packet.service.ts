// WO: WO-035-FINANCIAL-DISPUTE-ENGINE
import { createHash } from 'crypto';

/**
 * EvidencePacketGenerator
 *
 * Generates a complete evidence packet for a financial dispute.
 * Extended per WO-035 to include:
 *   1. Full transaction ledger trail for the dispute.
 *   2. The acknowledged "All Sales Final" user-agreement version that was
 *      in effect at the time of the original transaction.
 *
 * Note: `generatedAt` and `packetId` are stamped at call time and are
 * intentionally time-dependent. The integrity checksum is deterministic
 * given the same ledger trail and agreement inputs at the same timestamp.
 */

export interface LedgerTrailEntry {
  entryId: string;
  entryType: string;
  amountCents: bigint;
  status: string;
  createdAt: string;
  referenceId?: string;
  parentEntryId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgreementAcknowledgement {
  agreementVersion: string;
  acknowledgedAt: string;
  userId: string;
  policyText: string;
}

export interface EvidencePacket {
  packetId: string;
  disputeId: string;
  userId: string;
  generatedAt: string;
  ledgerTrail: LedgerTrailEntry[];
  salesFinalAgreement: AgreementAcknowledgement;
  integrityChecksum: string;
}

export class EvidencePacketGenerator {
  /**
   * Generates a complete evidence packet for the given dispute.
   *
   * @param disputeId         - UUID of the dispute case.
   * @param userId            - UUID of the user involved in the dispute.
   * @param ledgerTrail       - Ordered list of ledger entries for the dispute.
   * @param agreementRecord   - Acknowledged "All Sales Final" agreement at
   *                            the time of the original transaction.
   * @returns                 Sealed EvidencePacket with integrity checksum.
   */
  public static generate(
    disputeId: string,
    userId: string,
    ledgerTrail: LedgerTrailEntry[],
    agreementRecord: AgreementAcknowledgement,
  ): EvidencePacket {
    if (!disputeId || !userId) {
      throw new Error(
        'EvidencePacketGenerator: disputeId and userId are required.',
      );
    }

    if (!ledgerTrail || ledgerTrail.length === 0) {
      throw new Error(
        'EvidencePacketGenerator: ledgerTrail must contain at least one entry.',
      );
    }

    if (!agreementRecord || !agreementRecord.agreementVersion) {
      throw new Error(
        'EvidencePacketGenerator: a valid salesFinalAgreement acknowledgement is required.',
      );
    }

    const generatedAt = new Date().toISOString();
    const packetId = `EVIDENCE-${disputeId}-${Date.now()}`;

    // Deterministic integrity checksum over the full packet contents
    const checksumPayload = JSON.stringify({
      packetId,
      disputeId,
      userId,
      generatedAt,
      ledgerTrail: ledgerTrail.map((e) => ({
        ...e,
        amountCents: e.amountCents.toString(),
      })),
      salesFinalAgreement: agreementRecord,
    });
    const integrityChecksum = createHash('sha512')
      .update(checksumPayload)
      .digest('hex');

    return {
      packetId,
      disputeId,
      userId,
      generatedAt,
      ledgerTrail,
      salesFinalAgreement: agreementRecord,
      integrityChecksum,
    };
  }
}
