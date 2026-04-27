// services/core-api/src/scheduling/scheduling.controller.ts
// GZ-SCHEDULE: REST controllers for the GuestZone scheduling module.
// Covers schedule periods, shift assignments, ZoneBot bids, coverage reports,
// seed operations, and compliance summaries.
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { ZoneBotService } from './zonebot.service';
import { ShiftCoverageService } from './shift-coverage.service';
import { ComplianceGuardService } from './compliance-guard.service';
import { SchedulingSeedService } from './scheduling-seed.service';
import type {
  CreatePeriodRequest,
  AssignShiftRequest,
  PostGapRequest,
  SubmitBidRequest,
  Department,
  ShiftCode,
} from './scheduling.interfaces';

// ─── Schedule Period Controller ──────────────────────────────────────────────

@Controller('scheduling/periods')
export class SchedulePeriodController {
  private readonly logger = new Logger(SchedulePeriodController.name);

  constructor(private readonly schedulingService: SchedulingService) {}

  /**
   * POST /scheduling/periods
   * Creates a new rolling 2-week schedule period.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPeriod(@Body() body: CreatePeriodRequest): Promise<unknown> {
    return this.schedulingService.createPeriod(body);
  }

  /**
   * GET /scheduling/periods/:id
   * Retrieves a schedule period with all associated assignments.
   */
  @Get(':id')
  async getPeriod(@Param('id') id: string): Promise<unknown> {
    return this.schedulingService.getPeriod(id);
  }

  /**
   * POST /scheduling/periods/:id/b-lock
   * Transitions a DRAFT period to B_LOCKED status.
   */
  @Post(':id/b-lock')
  @HttpCode(HttpStatus.OK)
  async bLockPeriod(
    @Param('id') id: string,
    @Body() body: { actor_id: string; correlation_id: string },
  ): Promise<{ status: string; period_id: string; rule_applied_id: string }> {
    await this.schedulingService.lockPeriodBLock(id, body.actor_id, body.correlation_id);
    return { status: 'B_LOCKED', period_id: id, rule_applied_id: 'GZ_SCHEDULING_v1' };
  }

  /**
   * POST /scheduling/periods/:id/final-lock
   * Transitions a B_LOCKED period to FINAL_LOCKED (published) status.
   * Runs a coverage scan and reports any gaps.
   */
  @Post(':id/final-lock')
  @HttpCode(HttpStatus.OK)
  async finalLockPeriod(
    @Param('id') id: string,
    @Body() body: { actor_id: string; correlation_id: string },
  ): Promise<{ status: string; period_id: string; rule_applied_id: string }> {
    await this.schedulingService.lockPeriodFinal(id, body.actor_id, body.correlation_id);
    return { status: 'FINAL_LOCKED', period_id: id, rule_applied_id: 'GZ_SCHEDULING_v1' };
  }

  /**
   * POST /scheduling/periods/check-deadlines
   * Manually triggers deadline checks (auto B-Lock/Final Lock transitions).
   */
  @Post('check-deadlines')
  @HttpCode(HttpStatus.OK)
  async checkDeadlines(
    @Body() body: { correlation_id: string },
  ): Promise<{ status: string; rule_applied_id: string }> {
    await this.schedulingService.checkPeriodDeadlines(body.correlation_id);
    return { status: 'OK', rule_applied_id: 'GZ_SCHEDULING_v1' };
  }
}

// ─── Shift Assignment Controller ─────────────────────────────────────────────

@Controller('scheduling/shifts')
export class ShiftAssignmentController {
  private readonly logger = new Logger(ShiftAssignmentController.name);

  constructor(private readonly schedulingService: SchedulingService) {}

  /**
   * POST /scheduling/shifts
   * Assigns a staff member to a shift. Runs compliance checks before persisting.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async assignShift(@Body() body: AssignShiftRequest): Promise<unknown> {
    return this.schedulingService.assignShift(body);
  }

  /**
   * POST /scheduling/shifts/swap
   * Swaps shift assignments between two staff members.
   * Validates compliance for both before executing.
   */
  @Post('swap')
  @HttpCode(HttpStatus.OK)
  async swapShift(
    @Body()
    body: {
      assignment_id_a: string;
      assignment_id_b: string;
      actor_id: string;
      correlation_id: string;
      reason_code: string;
    },
  ): Promise<unknown> {
    return this.schedulingService.swapShift(body);
  }
}

// ─── ZoneBot Controller ──────────────────────────────────────────────────────

@Controller('scheduling/zonebot')
export class ZoneBotController {
  private readonly logger = new Logger(ZoneBotController.name);

  constructor(private readonly zoneBotService: ZoneBotService) {}

  /**
   * POST /scheduling/zonebot/bids
   * Submits a bid for a posted shift gap.
   */
  @Post('bids')
  @HttpCode(HttpStatus.CREATED)
  async submitBid(
    @Body() body: SubmitBidRequest,
  ): Promise<{ bid_id: string; status: string; rule_applied_id: string }> {
    const bid_id = await this.zoneBotService.submitBid(body);
    return { bid_id, status: 'PENDING', rule_applied_id: 'GZ_ZONEBOT_v1' };
  }

  /**
   * POST /scheduling/zonebot/lottery/:gapId
   * Runs the 1-2-3 lottery for a shift gap. Assigns random positions
   * and offers to position #1 with a 16-hour confirmation window.
   */
  @Post('lottery/:gapId')
  @HttpCode(HttpStatus.OK)
  async runLottery(
    @Param('gapId') gapId: string,
    @Body() body: { correlation_id: string },
  ): Promise<unknown> {
    return this.zoneBotService.runLottery(gapId, body.correlation_id);
  }

  /**
   * POST /scheduling/zonebot/bids/:bidId/accept
   * Accepts a bid offer. Awards the shift to this staff member.
   */
  @Post('bids/:bidId/accept')
  @HttpCode(HttpStatus.OK)
  async acceptBid(
    @Param('bidId') bidId: string,
    @Body() body: { correlation_id: string },
  ): Promise<{ bid_id: string; status: string; rule_applied_id: string }> {
    await this.zoneBotService.acceptBid(bidId, body.correlation_id);
    return { bid_id: bidId, status: 'ACCEPTED', rule_applied_id: 'GZ_ZONEBOT_v1' };
  }

  /**
   * POST /scheduling/zonebot/bids/:bidId/decline
   * Declines a bid offer. Cascades to the next lottery position.
   */
  @Post('bids/:bidId/decline')
  @HttpCode(HttpStatus.OK)
  async declineBid(
    @Param('bidId') bidId: string,
    @Body() body: { correlation_id: string },
  ): Promise<{ bid_id: string; status: string; rule_applied_id: string }> {
    await this.zoneBotService.declineBid(bidId, body.correlation_id);
    return { bid_id: bidId, status: 'DECLINED', rule_applied_id: 'GZ_ZONEBOT_v1' };
  }

  /**
   * POST /scheduling/zonebot/process-expired
   * Manually triggers processing of expired bid offers.
   */
  @Post('process-expired')
  @HttpCode(HttpStatus.OK)
  async processExpired(
    @Body() body: { correlation_id: string },
  ): Promise<{ expired_count: number; rule_applied_id: string }> {
    const count = await this.zoneBotService.processExpiredOffers(body.correlation_id);
    return { expired_count: count, rule_applied_id: 'GZ_ZONEBOT_v1' };
  }
}

// ─── Coverage Controller ─────────────────────────────────────────────────────

@Controller('scheduling/coverage')
export class CoverageController {
  private readonly logger = new Logger(CoverageController.name);

  constructor(private readonly shiftCoverage: ShiftCoverageService) {}

  /**
   * GET /scheduling/coverage/evaluate?department=GUESTZONE&date=2026-04-15&shift=A
   * Evaluates coverage for a specific department/date/shift combination.
   */
  @Get('evaluate')
  async evaluateCoverage(
    @Query('department') department: string,
    @Query('date') date: string,
    @Query('shift') shift: string,
  ): Promise<unknown> {
    return this.shiftCoverage.evaluateCoverage(department as Department, date, shift as ShiftCode);
  }

  /**
   * GET /scheduling/coverage/scan/:periodId
   * Scans an entire schedule period for coverage gaps.
   */
  @Get('scan/:periodId')
  async scanPeriodCoverage(
    @Param('periodId') periodId: string,
  ): Promise<{ period_id: string; total_gaps: number; gaps: unknown[]; rule_applied_id: string }> {
    const gaps = await this.shiftCoverage.scanPeriodCoverage(periodId);
    return {
      period_id: periodId,
      total_gaps: gaps.length,
      gaps,
      rule_applied_id: 'GZ_SHIFT_COVERAGE_v1',
    };
  }

  /**
   * POST /scheduling/coverage/gaps
   * Posts a shift gap for ZoneBot lottery.
   */
  @Post('gaps')
  @HttpCode(HttpStatus.CREATED)
  async postGap(
    @Body() body: PostGapRequest,
  ): Promise<{ gap_id: string; status: string; rule_applied_id: string }> {
    const gap_id = await this.shiftCoverage.postGap(body);
    return { gap_id, status: 'OPEN', rule_applied_id: 'GZ_SHIFT_GAP_v1' };
  }

  /**
   * GET /scheduling/coverage/stat-holiday?date=2026-12-25
   * Checks if a date is a stat holiday and validates on-call manager coverage.
   */
  @Get('stat-holiday')
  async checkStatHoliday(
    @Query('date') date: string,
  ): Promise<{
    date: string;
    is_stat_holiday: boolean;
    pay_multiplier: number;
    has_on_call_manager: boolean;
    rule_applied_id: string;
  }> {
    const multiplier = await this.shiftCoverage.getStatHolidayMultiplier(date);
    const hasOnCallManager = await this.shiftCoverage.validateStatHolidayOnCall(date);
    return {
      date,
      is_stat_holiday: multiplier > 1.0,
      pay_multiplier: multiplier,
      has_on_call_manager: hasOnCallManager,
      rule_applied_id: 'GZ_SHIFT_COVERAGE_v1',
    };
  }
}

// ─── Compliance Controller ───────────────────────────────────────────────────

@Controller('scheduling/compliance')
export class ComplianceController {
  private readonly logger = new Logger(ComplianceController.name);

  constructor(private readonly complianceGuard: ComplianceGuardService) {}

  /**
   * POST /scheduling/compliance/validate
   * Validates a proposed shift assignment against Ontario ESA rules.
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateAssignment(
    @Body()
    body: {
      staff_member_id: string;
      proposed_date: string;
      proposed_shift_code: ShiftCode;
      schedule_period_id: string;
    },
  ): Promise<unknown> {
    return this.complianceGuard.validateAssignment(body);
  }

  /**
   * GET /scheduling/compliance/weekly-summary?staff_id=xxx&week_start=2026-04-13
   * Returns the weekly summary for a staff member (hours, consecutive days, stat holidays).
   */
  @Get('weekly-summary')
  async getWeeklySummary(
    @Query('staff_id') staff_id: string,
    @Query('week_start') week_start: string,
  ): Promise<unknown> {
    return this.complianceGuard.getWeeklySummary(staff_id, week_start);
  }
}

// ─── Seed Controller ─────────────────────────────────────────────────────────

@Controller('scheduling/seed')
export class ScheduleSeedController {
  private readonly logger = new Logger(ScheduleSeedController.name);

  constructor(private readonly seedService: SchedulingSeedService) {}

  /**
   * POST /scheduling/seed/all
   * Runs the full seed (shift templates, stat holidays, department coverage).
   * Idempotent — safe to call multiple times.
   */
  @Post('all')
  @HttpCode(HttpStatus.OK)
  async seedAll(): Promise<unknown> {
    return this.seedService.seedAll();
  }

  /**
   * POST /scheduling/seed/holidays
   * Seeds stat holidays for a rolling 3-year window from the current year.
   * Optionally accepts a base_year to override.
   */
  @Post('holidays')
  @HttpCode(HttpStatus.OK)
  async seedHolidays(
    @Body() body: { base_year?: number; correlation_id?: string },
  ): Promise<unknown> {
    const correlation_id = body.correlation_id ?? `SEED-HOLIDAYS-${Date.now()}`;
    return this.seedService.seedRollingStatHolidays(correlation_id, body.base_year);
  }

  /**
   * POST /scheduling/seed/holidays/years
   * Seeds stat holidays for specific years.
   */
  @Post('holidays/years')
  @HttpCode(HttpStatus.OK)
  async seedHolidaysForYears(
    @Body() body: { years: number[]; correlation_id?: string },
  ): Promise<unknown> {
    const correlation_id = body.correlation_id ?? `SEED-HOLIDAYS-${Date.now()}`;
    return this.seedService.seedStatHolidaysForYears(body.years, correlation_id);
  }

  /**
   * POST /scheduling/seed/shift-templates
   * Seeds GuestZone A/B/C shift templates. Idempotent.
   */
  @Post('shift-templates')
  @HttpCode(HttpStatus.OK)
  async seedShiftTemplates(@Body() body: { correlation_id?: string }): Promise<unknown> {
    const correlation_id = body.correlation_id ?? `SEED-TEMPLATES-${Date.now()}`;
    return this.seedService.seedShiftTemplates(correlation_id);
  }

  /**
   * POST /scheduling/seed/department-coverage
   * Seeds department coverage baselines. Idempotent.
   */
  @Post('department-coverage')
  @HttpCode(HttpStatus.OK)
  async seedDepartmentCoverage(@Body() body: { correlation_id?: string }): Promise<unknown> {
    const correlation_id = body.correlation_id ?? `SEED-COVERAGE-${Date.now()}`;
    return this.seedService.seedDepartmentCoverage(correlation_id);
  }

  /**
   * POST /scheduling/seed/master-roster
   * Seeds the GZ Master Roster positions. Idempotent.
   */
  @Post('master-roster')
  @HttpCode(HttpStatus.OK)
  async seedMasterRoster(@Body() body: { correlation_id?: string }): Promise<unknown> {
    const correlation_id = body.correlation_id ?? `SEED-ROSTER-${Date.now()}`;
    return this.seedService.seedMasterRoster(correlation_id);
  }
}
