// services/core-api/src/admin/admin-house-model.controller.ts
// CYR: Admin House Model REST controller — ADMIN-gated read access.
//
// Endpoint:
//   GET /admin/house-models
//     Headers (required):
//       x-actor-id    — UUID of the requesting admin user
//       x-actor-role  — must be "ADMIN"
//     200 → AiTwin[] where is_house_model = true

import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.module';
import { RbacGuard, RbacRole } from '../auth/rbac.guard';

@Controller('admin')
export class AdminHouseModelController {
  private readonly logger = new Logger(AdminHouseModelController.name);
  private readonly RULE_ID = 'ADMIN_HOUSE_MODEL_v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacGuard,
  ) {}

  /**
   * List all platform-owned house models.
   * Requires ADMIN role — enforced via RbacGuard.check() against the
   * 'house-model:manage' permission.
   */
  @Get('house-models')
  async getHouseModels(
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') actorRole: string | undefined,
  ) {
    if (!actorId || !actorRole) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'x-actor-id and x-actor-role headers are required.',
        reason_code: 'NO_ACTOR_CONTEXT',
        rule_applied_id: this.RULE_ID,
      });
    }

    const decision = this.rbac.check({
      actor_id: actorId,
      actor_role: actorRole as RbacRole,
      permission: 'house-model:manage',
    });

    if (!decision.permitted) {
      this.logger.warn('AdminHouseModelController.getHouseModels: denied', {
        actor_id: actorId,
        actor_role: actorRole,
        reason: decision.failure_reason,
        rule_applied_id: this.RULE_ID,
      });
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'house-model:manage requires ADMIN role.',
        reason_code: decision.failure_reason ?? 'INSUFFICIENT_ROLE',
        rule_applied_id: this.RULE_ID,
      });
    }

    this.logger.log('AdminHouseModelController.getHouseModels: allowed', {
      actor_id: actorId,
      rule_applied_id: this.RULE_ID,
    });

    return this.prisma.aiTwin.findMany({
      where: { is_house_model: true },
      orderBy: { created_at: 'asc' },
      select: {
        twin_id: true,
        display_name: true,
        persona_prompt: true,
        trigger_word: true,
        portal: true,
        visibility: true,
        training_status: true,
        is_house_model: true,
        correlation_id: true,
        created_at: true,
      },
    });
  }
}
