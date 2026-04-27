// BIJOU: BJ-003 — BijouAdmissionService
// Admission queue for Bijou sessions.
// - 10s accept window (ADMIT_ACCEPT_WINDOW_SECONDS) enforced server-side
// - 30s camera grace (CAMERA_GRACE_SECONDS) enforced server-side
// - FIFO standby promotion on ABANDONED or EJECTED
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core-api/src/prisma.service';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { GovernanceConfig } from '../../core-api/src/governance/governance.config';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { BijouAdmissionStatus } from '@prisma/client';

export interface RequestAdmissionInput {
  sessionId: string;
  userId: string;
  organizationId: string;
  tenantId: string;
}

@Injectable()
export class BijouAdmissionService {
  private readonly logger = new Logger(BijouAdmissionService.name);
  // Active server-side timers for the 10s accept window.
  private readonly acceptTimers = new Map<string, NodeJS.Timeout>();
  // Active server-side timers for the 30s camera grace.
  private readonly cameraTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsService: NatsService,
  ) {}

  /**
   * Request admission to a Bijou session.
   * - If the session is at `GovernanceConfig.BIJOU.MAX_CAPACITY` ADMITTED
   *   users, the requester is placed on STANDBY.
   * - Otherwise, the requester is set PENDING with a server-side
   *   ADMIT_ACCEPT_WINDOW_SECONDS timer; if not accepted in time, the
   *   record is transitioned to ABANDONED and the next STANDBY (FIFO)
   *   is promoted.
   */
  async requestAdmission(input: RequestAdmissionInput): Promise<{
    admission_id: string;
    status: BijouAdmissionStatus;
  }> {
    const ruleAppliedId = 'BJ-003_REQUEST_ADMISSION_v1';
    const { sessionId, userId, organizationId, tenantId } = input;

    this.logger.log('BijouAdmissionService.requestAdmission', {
      session_id: sessionId,
      user_id: userId,
      rule_applied_id: ruleAppliedId,
    });

    // Enforce uniqueness: one non-EJECTED/ABANDONED per (session, user).
    const active = await this.prisma.bijouAdmission.findFirst({
      where: {
        session_id: sessionId,
        user_id: userId,
        status: { notIn: [BijouAdmissionStatus.EJECTED, BijouAdmissionStatus.ABANDONED] },
      },
    });
    if (active) {
      this.logger.warn('BijouAdmissionService.requestAdmission: user already has active admission', {
        session_id: sessionId,
        user_id: userId,
        existing_admission_id: active.id,
        existing_status: active.status,
        rule_applied_id: ruleAppliedId,
      });
      throw new ConflictException({
        message: 'User already has an active admission for this session.',
        admission_id: active.id,
        status: active.status,
        rule_applied_id: ruleAppliedId,
      });
    }

    const admittedCount = await this.prisma.bijouAdmission.count({
      where: { session_id: sessionId, status: BijouAdmissionStatus.ADMITTED },
    });

    const atCapacity = admittedCount >= GovernanceConfig.BIJOU.MAX_CAPACITY;
    const status = atCapacity
      ? BijouAdmissionStatus.STANDBY
      : BijouAdmissionStatus.PENDING;

    const admission = await this.prisma.bijouAdmission.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        status,
        organization_id: organizationId,
        tenant_id: tenantId,
      },
    });

    if (atCapacity) {
      this.logger.log('BijouAdmissionService.requestAdmission: session full — STANDBY', {
        admission_id: admission.id,
        session_id: sessionId,
        user_id: userId,
        admitted_count: admittedCount,
        max_capacity: GovernanceConfig.BIJOU.MAX_CAPACITY,
        rule_applied_id: ruleAppliedId,
      });
      this.natsService.publish(NATS_TOPICS.BIJOU_ADMISSION_STANDBY, {
        admission_id: admission.id,
        session_id: sessionId,
        user_id: userId,
        organization_id: organizationId,
        tenant_id: tenantId,
        rule_applied_id: ruleAppliedId,
        timestamp: new Date().toISOString(),
      });
    } else {
      this.logger.log('BijouAdmissionService.requestAdmission: offered — PENDING', {
        admission_id: admission.id,
        session_id: sessionId,
        user_id: userId,
        accept_window_seconds: GovernanceConfig.BIJOU.ADMIT_ACCEPT_WINDOW_SECONDS,
        rule_applied_id: ruleAppliedId,
      });
      this.natsService.publish(NATS_TOPICS.BIJOU_ADMISSION_OFFERED, {
        admission_id: admission.id,
        session_id: sessionId,
        user_id: userId,
        accept_window_seconds: GovernanceConfig.BIJOU.ADMIT_ACCEPT_WINDOW_SECONDS,
        organization_id: organizationId,
        tenant_id: tenantId,
        rule_applied_id: ruleAppliedId,
        timestamp: new Date().toISOString(),
      });
      this.armAcceptTimer(admission.id);
    }

    return { admission_id: admission.id, status };
  }

  /**
   * Accept a PENDING admission. Must be called within
   * ADMIT_ACCEPT_WINDOW_SECONDS of the PENDING creation; otherwise the
   * timer expires and the record moves to ABANDONED.
   * On accept, sets ADMITTED, computes camera_grace_deadline, and arms
   * the server-side camera grace timer.
   */
  async acceptAdmission(admissionId: string, userId: string): Promise<void> {
    const ruleAppliedId = 'BJ-003_ACCEPT_ADMISSION_v1';

    const admission = await this.prisma.bijouAdmission.findUnique({
      where: { id: admissionId },
    });
    if (!admission) {
      throw new NotFoundException({
        message: 'Admission not found',
        admission_id: admissionId,
        rule_applied_id: ruleAppliedId,
      });
    }
    if (admission.user_id !== userId) {
      this.logger.warn('BijouAdmissionService.acceptAdmission: user mismatch', {
        admission_id: admissionId,
        expected_user_id: admission.user_id,
        actual_user_id: userId,
        rule_applied_id: ruleAppliedId,
      });
      throw new ConflictException({
        message: 'Admission user mismatch',
        rule_applied_id: ruleAppliedId,
      });
    }
    if (admission.status !== BijouAdmissionStatus.PENDING) {
      this.logger.warn('BijouAdmissionService.acceptAdmission: not PENDING — cannot accept', {
        admission_id: admissionId,
        status: admission.status,
        rule_applied_id: ruleAppliedId,
      });
      throw new ConflictException({
        message: `Admission status is ${admission.status}, cannot accept`,
        rule_applied_id: ruleAppliedId,
      });
    }

    this.clearAcceptTimer(admissionId);

    const now = new Date();
    const graceMs = GovernanceConfig.BIJOU.CAMERA_GRACE_SECONDS * 1000;
    const cameraDeadline = new Date(now.getTime() + graceMs);

    await this.prisma.bijouAdmission.update({
      where: { id: admissionId },
      data: {
        status: BijouAdmissionStatus.ADMITTED,
        admitted_at: now,
        camera_grace_deadline: cameraDeadline,
      },
    });

    this.logger.log('BijouAdmissionService.acceptAdmission: ADMITTED', {
      admission_id: admissionId,
      session_id: admission.session_id,
      user_id: userId,
      camera_grace_deadline: cameraDeadline.toISOString(),
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.BIJOU_ADMISSION_ADMITTED, {
      admission_id: admissionId,
      session_id: admission.session_id,
      user_id: userId,
      admitted_at: now.toISOString(),
      camera_grace_deadline: cameraDeadline.toISOString(),
      camera_grace_seconds: GovernanceConfig.BIJOU.CAMERA_GRACE_SECONDS,
      organization_id: admission.organization_id,
      tenant_id: admission.tenant_id,
      rule_applied_id: ruleAppliedId,
      timestamp: now.toISOString(),
    });

    this.armCameraTimer(admissionId);
  }

  /**
   * Record that the user has confirmed their camera.
   * Clears the server-side ejection risk by disarming the camera timer.
   */
  async confirmCamera(admissionId: string): Promise<void> {
    const ruleAppliedId = 'BJ-003_CONFIRM_CAMERA_v1';
    const admission = await this.prisma.bijouAdmission.findUnique({
      where: { id: admissionId },
    });
    if (!admission) {
      throw new NotFoundException({
        message: 'Admission not found',
        admission_id: admissionId,
        rule_applied_id: ruleAppliedId,
      });
    }

    this.clearCameraTimer(admissionId);

    this.logger.log('BijouAdmissionService.confirmCamera: camera confirmed — ejection risk cleared', {
      admission_id: admissionId,
      session_id: admission.session_id,
      user_id: admission.user_id,
      rule_applied_id: ruleAppliedId,
    });
  }

  /**
   * Enforce camera compliance at the server-side grace deadline.
   * Ejects the admission if the deadline has passed and camera is not
   * confirmed; promotes the next STANDBY admission to PENDING (FIFO).
   * Invoked by the server-side timer armed in acceptAdmission.
   */
  async enforceCamera(admissionId: string): Promise<void> {
    const ruleAppliedId = 'BJ-003_ENFORCE_CAMERA_v1';
    const admission = await this.prisma.bijouAdmission.findUnique({
      where: { id: admissionId },
    });
    if (!admission) {
      this.logger.warn('BijouAdmissionService.enforceCamera: admission missing', {
        admission_id: admissionId,
        rule_applied_id: ruleAppliedId,
      });
      return;
    }
    if (admission.status !== BijouAdmissionStatus.ADMITTED) {
      // Already transitioned (confirmCamera cleared it, or cancelled/ejected)
      this.logger.log('BijouAdmissionService.enforceCamera: not ADMITTED — noop', {
        admission_id: admissionId,
        status: admission.status,
        rule_applied_id: ruleAppliedId,
      });
      return;
    }

    this.clearCameraTimer(admissionId);
    const now = new Date();

    await this.prisma.bijouAdmission.update({
      where: { id: admissionId },
      data: { status: BijouAdmissionStatus.EJECTED },
    });

    this.logger.warn('BijouAdmissionService.enforceCamera: EJECTED — camera grace expired', {
      admission_id: admissionId,
      session_id: admission.session_id,
      user_id: admission.user_id,
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.BIJOU_ADMISSION_EJECTED, {
      admission_id: admissionId,
      session_id: admission.session_id,
      user_id: admission.user_id,
      reason_code: 'CAMERA_GRACE_EXPIRED',
      ejected_at: now.toISOString(),
      organization_id: admission.organization_id,
      tenant_id: admission.tenant_id,
      rule_applied_id: ruleAppliedId,
      timestamp: now.toISOString(),
    });

    await this.promoteNextStandby(admission.session_id, ruleAppliedId);
  }

  /**
   * Server-side timer — arms ADMIT_ACCEPT_WINDOW_SECONDS countdown.
   * When it fires, if the admission is still PENDING, transition to
   * ABANDONED and promote the next STANDBY (FIFO).
   */
  private armAcceptTimer(admissionId: string): void {
    this.clearAcceptTimer(admissionId);
    const windowMs = GovernanceConfig.BIJOU.ADMIT_ACCEPT_WINDOW_SECONDS * 1000;
    const timer = setTimeout(() => {
      void this.expireAccept(admissionId);
    }, windowMs);
    this.acceptTimers.set(admissionId, timer);
  }

  private clearAcceptTimer(admissionId: string): void {
    const t = this.acceptTimers.get(admissionId);
    if (t) {
      clearTimeout(t);
      this.acceptTimers.delete(admissionId);
    }
  }

  /**
   * Server-side timer — arms CAMERA_GRACE_SECONDS countdown.
   */
  private armCameraTimer(admissionId: string): void {
    this.clearCameraTimer(admissionId);
    const graceMs = GovernanceConfig.BIJOU.CAMERA_GRACE_SECONDS * 1000;
    const timer = setTimeout(() => {
      void this.enforceCamera(admissionId);
    }, graceMs);
    this.cameraTimers.set(admissionId, timer);
  }

  private clearCameraTimer(admissionId: string): void {
    const t = this.cameraTimers.get(admissionId);
    if (t) {
      clearTimeout(t);
      this.cameraTimers.delete(admissionId);
    }
  }

  /**
   * Server-side expire of a PENDING admission — transitions to ABANDONED
   * and promotes the next STANDBY (FIFO).
   */
  private async expireAccept(admissionId: string): Promise<void> {
    const ruleAppliedId = 'BJ-003_EXPIRE_ACCEPT_v1';
    this.acceptTimers.delete(admissionId);

    const admission = await this.prisma.bijouAdmission.findUnique({
      where: { id: admissionId },
    });
    if (!admission || admission.status !== BijouAdmissionStatus.PENDING) {
      return;
    }

    await this.prisma.bijouAdmission.update({
      where: { id: admissionId },
      data: { status: BijouAdmissionStatus.ABANDONED },
    });

    this.logger.log('BijouAdmissionService.expireAccept: ABANDONED — accept window expired', {
      admission_id: admissionId,
      session_id: admission.session_id,
      user_id: admission.user_id,
      rule_applied_id: ruleAppliedId,
    });

    this.natsService.publish(NATS_TOPICS.BIJOU_ADMISSION_ABANDONED, {
      admission_id: admissionId,
      session_id: admission.session_id,
      user_id: admission.user_id,
      reason_code: 'ACCEPT_WINDOW_EXPIRED',
      abandoned_at: new Date().toISOString(),
      organization_id: admission.organization_id,
      tenant_id: admission.tenant_id,
      rule_applied_id: ruleAppliedId,
      timestamp: new Date().toISOString(),
    });

    await this.promoteNextStandby(admission.session_id, ruleAppliedId);
  }

  /**
   * Promote the oldest STANDBY admission for the session to PENDING (FIFO)
   * and arm the accept timer. Called on ABANDONED and EJECTED transitions.
   */
  private async promoteNextStandby(sessionId: string, parentRuleId: string): Promise<void> {
    const next = await this.prisma.bijouAdmission.findFirst({
      where: { session_id: sessionId, status: BijouAdmissionStatus.STANDBY },
      orderBy: { created_at: 'asc' },
    });
    if (!next) return;

    await this.prisma.bijouAdmission.update({
      where: { id: next.id },
      data: { status: BijouAdmissionStatus.PENDING },
    });

    this.logger.log('BijouAdmissionService.promoteNextStandby: STANDBY → PENDING (FIFO)', {
      admission_id: next.id,
      session_id: sessionId,
      user_id: next.user_id,
      parent_rule_applied_id: parentRuleId,
      rule_applied_id: 'BJ-003_PROMOTE_STANDBY_v1',
    });

    this.natsService.publish(NATS_TOPICS.BIJOU_ADMISSION_OFFERED, {
      admission_id: next.id,
      session_id: sessionId,
      user_id: next.user_id,
      accept_window_seconds: GovernanceConfig.BIJOU.ADMIT_ACCEPT_WINDOW_SECONDS,
      organization_id: next.organization_id,
      tenant_id: next.tenant_id,
      rule_applied_id: 'BJ-003_PROMOTE_STANDBY_v1',
      timestamp: new Date().toISOString(),
    });

    this.armAcceptTimer(next.id);
  }
}
