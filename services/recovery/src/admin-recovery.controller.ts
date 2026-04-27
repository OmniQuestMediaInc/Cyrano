// PAYLOAD 2 — Admin CS Recovery Dashboard Controller
// Surface: /admin/recovery
// Purpose: one-click command center for CS to view open cases, execute
// Token Bridge / Three-Fifths Exit, inspect Diamond liquidity, and audit
// every action. No ledger writes — delegates to RecoveryEngine.

import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { RecoveryEngine } from './recovery.service';
import {
  DashboardCaseRow,
  ExpirationDistribution,
  RecoveryAuditEntry,
  ThreeFifthsExitOutcome,
  TokenBridgeOffer,
} from './recovery.types';
import { DiamondConciergeService } from '../../diamond-concierge/src/diamond.service';

interface TokenBridgeExecuteBody {
  agent_id: string;
  waiver_signature_hash?: string;
  auto_accept?: boolean;
}

interface ThreeFifthsExitBody {
  agent_id: string;
  ceo_override?: {
    override_id: string;
    authorized_by: string;
    authorized_at_utc: string;
    reason_code: string;
  };
}

interface ExpirationBody {
  agent_id: string;
}

/**
 * AdminRecoveryController
 * Mount point: /admin/recovery
 */
@Controller('admin/recovery')
export class AdminRecoveryController {
  constructor(
    private readonly engine: RecoveryEngine,
    private readonly diamond: DiamondConciergeService,
  ) {}

  @Get('cases')
  listOpenCases(@Query('limit') limit?: string): DashboardCaseRow[] {
    const max = Math.max(1, Math.min(500, Number(limit ?? 100)));
    return this.engine
      .listOpenCases()
      .slice(0, max)
      .map((c) => ({
        case_id: c.case_id,
        user_id: c.user_id,
        tier: 'UNKNOWN',
        stage: c.stage,
        balance_usd_cents: null,
        opened_at_utc: c.opened_at_utc,
        flags: c.flags,
      }));
  }

  @Get('cases/:caseId')
  getCase(@Param('caseId') caseId: string): unknown {
    const record = this.engine.getCase(caseId);
    if (!record) {
      throw new HttpException('RECOVERY_CASE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return {
      ...record,
      remaining_balance_tokens: record.remaining_balance_tokens.toString(),
      original_purchase_price_usd_cents:
        record.original_purchase_price_usd_cents.toString(),
    };
  }

  @Get('cases/:caseId/audit-log')
  auditLog(@Param('caseId') caseId: string): RecoveryAuditEntry[] {
    const record = this.engine.getCase(caseId);
    if (!record) {
      throw new HttpException('RECOVERY_CASE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return record.audit_trail;
  }

  @Post('cases/:caseId/token-bridge')
  executeTokenBridge(
    @Param('caseId') caseId: string,
    @Body() body: TokenBridgeExecuteBody,
  ): TokenBridgeOffer | { offer: TokenBridgeOffer; accepted: RecoveryAuditEntry } {
    this.requireAgent(body.agent_id);
    const offer = this.engine.tokenBridgeOffer(caseId, body.agent_id);
    if (body.auto_accept) {
      if (!body.waiver_signature_hash) {
        throw new HttpException(
          'WAIVER_SIGNATURE_REQUIRED',
          HttpStatus.BAD_REQUEST,
        );
      }
      const accepted = this.engine.acceptTokenBridge(
        caseId,
        body.agent_id,
        body.waiver_signature_hash,
      );
      return { offer, accepted };
    }
    return offer;
  }

  @Post('cases/:caseId/three-fifths-exit')
  executeThreeFifths(
    @Param('caseId') caseId: string,
    @Body() body: ThreeFifthsExitBody,
  ): ThreeFifthsExitOutcome {
    this.requireAgent(body.agent_id);
    return this.engine.threeFifthsExit(caseId, body.agent_id, body.ceo_override);
  }

  @Post('cases/:caseId/expiration')
  executeExpiration(
    @Param('caseId') caseId: string,
    @Body() body: ExpirationBody,
  ): ExpirationDistribution {
    this.requireAgent(body.agent_id);
    const dist = this.engine.handleExpiration(caseId, body.agent_id);
    return {
      ...dist,
      expired_tokens: dist.expired_tokens,
      creator_bonus_pool_tokens: dist.creator_bonus_pool_tokens,
      platform_mgmt_fee_tokens: dist.platform_mgmt_fee_tokens,
    };
  }

  @Get('diamond-liquidity')
  diamondLiquidity(): unknown {
    return this.diamond.liquiditySnapshot();
  }

  private requireAgent(agent_id: string): void {
    if (!agent_id || typeof agent_id !== 'string' || agent_id.length === 0) {
      throw new HttpException('AGENT_ID_REQUIRED', HttpStatus.BAD_REQUEST);
    }
  }
}
