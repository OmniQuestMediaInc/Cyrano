// services/zonebot-scheduler/src/zonebot-scheduler.controller.ts
// WO-002: HCZ ZoneBot Zoey — REST controller.
import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ZonebotSchedulingService } from './zonebot-scheduler.service';
import type {
  GenerateScheduleDto,
  Schedule,
  SwapDto,
  WellbeingDto,
  HiringModelDto,
  HiringModelResult,
  FatigueReport,
  PayrollExport,
  BreakWindow,
  Violation,
} from './interfaces';

@Controller('api/v1/zonebot')
export class ZonebotSchedulerController {
  constructor(private readonly zoey: ZonebotSchedulingService) {}

  @Post('schedule/generate')
  generate(@Body() dto: GenerateScheduleDto): Promise<Schedule> {
    return this.zoey.generateSchedule(dto.weekStart, dto.forecast);
  }

  @Post('schedule/validate')
  validate(@Body() s: Schedule): Promise<Violation[]> {
    return this.zoey.validateSchedule(s);
  }

  @Get('schedule/:weekStart')
  get(@Param('weekStart') ws: string): Promise<Schedule> {
    return this.zoey.getSchedule(ws);
  }

  @Get('payroll/export')
  export(@Query('weekStart') ws: string): Promise<PayrollExport> {
    return this.zoey.exportPayroll(ws);
  }

  @Get('breaks/suggest')
  suggestBreaks(
    @Query('date') d: string,
    @Query('supervisorId') id?: string,
  ): Promise<BreakWindow> {
    return this.zoey.suggestBreakWindows(d, id);
  }

  @Post('swap/initiate')
  swap(@Body() dto: SwapDto): Promise<{ swapId: string }> {
    return this.zoey.initiateShiftSwap(dto);
  }

  @Post('wellbeing/submit')
  wellbeing(@Body() dto: WellbeingDto): Promise<{ responseId: string }> {
    return this.zoey.submitWellbeing(dto);
  }

  @Get('fatigue')
  fatigue(@Query('staffId') id?: string): Promise<FatigueReport> {
    return this.zoey.getFatigueReport(id);
  }

  @Post('hiring/model')
  model(@Body() dto: HiringModelDto): Promise<HiringModelResult> {
    return this.zoey.runHiringModel(dto);
  }
}
