// DFSP Module 11 — Pre-Authorization Integrity Hold
// Spec: DFSP Engineering Spec v1.1 (supersedes v1.0 Module 11)
// Formula LOCKED (v1.1a): MAX(floor, MIN(ceiling, total_price_cad * rate))
// floor: $100 CAD | rate: 4% | ceiling: $500 CAD — all from GovernanceConfig.
// This service calculates and records holds only.
// Actual processor pre-authorization calls are v6 (PROC-001).
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { GovernanceConfig } from '../governance/governance.config';
import Decimal from 'decimal.js';

export interface IntegrityHoldRecord {
  id: string;
  contract_id: string;
  account_id: string;
  hold_amount: Decimal;
  status: 'authorized' | 'released' | 'captured';
  authorized_at: string | null;
  released_at: string | null;
  captured_at: string | null;
  capture_reason: string | null;
  chargeback_reference: string | null;
  rule_applied_id: string;
}

@Injectable()
export class IntegrityHoldService {
  private readonly logger = new Logger(IntegrityHoldService.name);
  private readonly RULE_ID = 'INTEGRITY_HOLD_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nats: NatsService,
  ) {}

  /**
   * Calculates integrity hold amount (LOCKED formula — DFSP v1.1a).
   * MAX(floor_amount, MIN(ceiling_amount, total_price_cad * rate))
   * All constants from GovernanceConfig. Never hardcoded.
   */
  calculateHoldAmount(total_price_cad: Decimal): Decimal {
    const floor = GovernanceConfig.DFSP_INTEGRITY_HOLD_FLOOR_CAD;
    const rate = GovernanceConfig.DFSP_INTEGRITY_HOLD_RATE;
    const ceiling = GovernanceConfig.DFSP_INTEGRITY_HOLD_CEILING_CAD;
    const calculated = total_price_cad.mul(rate);
    return Decimal.max(floor, Decimal.min(ceiling, calculated));
  }

  /**
   * Records a hold authorization. Processor pre-auth call is v6 (PROC-001).
   */
  async recordHoldAuthorization(params: {
    contract_id: string;
    account_id: string;
    hold_amount: Decimal;
    processor_auth_reference?: string;
    organization_id: string;
    tenant_id: string;
  }): Promise<IntegrityHoldRecord> {
    const authorized_at = new Date();
    const record = await this.prisma.integrityHold.create({
      data: {
        contract_id: params.contract_id,
        account_id: params.account_id,
        hold_amount: params.hold_amount,
        processor_auth_reference: params.processor_auth_reference ?? null,
        authorized_at,
        status: 'authorized',
        organization_id: params.organization_id,
        tenant_id: params.tenant_id,
      },
    });
    this.logger.log('IntegrityHoldService: hold authorized', {
      hold_id: record.id,
      hold_amount: params.hold_amount.toFixed(2),
      rule_applied_id: this.RULE_ID,
    });
    this.nats.publish(NATS_TOPICS.INTEGRITY_HOLD_AUTHORIZED, {
      hold_id: record.id,
      contract_id: params.contract_id,
      account_id: params.account_id,
      hold_amount: params.hold_amount.toFixed(2),
      rule_applied_id: this.RULE_ID,
    });
    return this.toRecord(
      record as typeof record & { status: 'authorized' | 'released' | 'captured' },
    );
  }

  /**
   * Records a hold release (payment cleared). Processor release call is v6.
   */
  async releaseHold(hold_id: string): Promise<IntegrityHoldRecord> {
    const released_at = new Date();
    const record = await this.prisma.integrityHold.update({
      where: { id: hold_id },
      data: { status: 'released', released_at },
    });
    this.nats.publish(NATS_TOPICS.INTEGRITY_HOLD_RELEASED, {
      hold_id,
      contract_id: record.contract_id,
      rule_applied_id: this.RULE_ID,
    });
    return this.toRecord(
      record as typeof record & { status: 'authorized' | 'released' | 'captured' },
    );
  }

  /**
   * Records a hold capture (chargeback). Processor capture call is v6.
   */
  async captureHold(params: {
    hold_id: string;
    capture_reason: string;
    chargeback_reference?: string;
  }): Promise<IntegrityHoldRecord> {
    const captured_at = new Date();
    const record = await this.prisma.integrityHold.update({
      where: { id: params.hold_id },
      data: {
        status: 'captured',
        captured_at,
        capture_reason: params.capture_reason,
        chargeback_reference: params.chargeback_reference ?? null,
      },
    });
    this.nats.publish(NATS_TOPICS.INTEGRITY_HOLD_CAPTURED, {
      hold_id: params.hold_id,
      contract_id: record.contract_id,
      capture_reason: params.capture_reason,
      rule_applied_id: this.RULE_ID,
    });
    return this.toRecord(
      record as typeof record & { status: 'authorized' | 'released' | 'captured' },
    );
  }

  private toRecord(r: {
    id: string;
    contract_id: string;
    account_id: string;
    hold_amount: { toString: () => string };
    status: 'authorized' | 'released' | 'captured';
    authorized_at: Date | null;
    released_at: Date | null;
    captured_at: Date | null;
    capture_reason: string | null;
    chargeback_reference: string | null;
  }): IntegrityHoldRecord {
    return {
      id: r.id,
      contract_id: r.contract_id,
      account_id: r.account_id,
      hold_amount: new Decimal(r.hold_amount.toString()),
      status: r.status,
      authorized_at: r.authorized_at?.toISOString() ?? null,
      released_at: r.released_at?.toISOString() ?? null,
      captured_at: r.captured_at?.toISOString() ?? null,
      capture_reason: r.capture_reason ?? null,
      chargeback_reference: r.chargeback_reference ?? null,
      rule_applied_id: this.RULE_ID,
    };
  }
}
