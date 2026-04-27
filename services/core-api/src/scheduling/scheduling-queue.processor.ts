// services/core-api/src/scheduling/scheduling-queue.processor.ts
// GZ-SCHEDULE: Bull queue processor for automated scheduling tasks.
// Runs at 7 AM and 7 PM daily (America/Toronto) to:
// 1. Check period deadlines (auto B-Lock and Final Lock transitions)
// 2. Process expired ZoneBot bid offers (16-hour confirmation clock)
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { randomUUID } from 'crypto';
import { SchedulingService } from './scheduling.service';
import { ZoneBotService } from './zonebot.service';

export const SCHEDULING_QUEUE_NAME = 'gz-scheduling';

export const JOB_NAMES = {
  CHECK_DEADLINES: 'check-deadlines',
  PROCESS_EXPIRED_BIDS: 'process-expired-bids',
} as const;

@Processor(SCHEDULING_QUEUE_NAME)
@Injectable()
export class SchedulingQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(SchedulingQueueProcessor.name);
  private readonly RULE_ID = 'GZ_SCHEDULE_QUEUE_v1';

  constructor(
    @InjectQueue(SCHEDULING_QUEUE_NAME) private readonly schedulingQueue: Queue,
    private readonly schedulingService: SchedulingService,
    private readonly zoneBotService: ZoneBotService,
  ) {}

  /**
   * On module init, registers the repeatable jobs at 7 AM and 7 PM
   * America/Toronto. Bull handles cron deduplication — safe to call on restart.
   */
  async onModuleInit(): Promise<void> {
    // 7:00 AM America/Toronto — deadline checks + expired bids
    await this.schedulingQueue.add(
      JOB_NAMES.CHECK_DEADLINES,
      {},
      {
        repeat: {
          cron: '0 7 * * *',
          tz: 'America/Toronto',
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    // 7:00 PM America/Toronto — deadline checks + expired bids
    await this.schedulingQueue.add(
      JOB_NAMES.CHECK_DEADLINES,
      {},
      {
        repeat: {
          cron: '0 19 * * *',
          tz: 'America/Toronto',
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    // Expired bid processing — also at 7 AM and 7 PM
    await this.schedulingQueue.add(
      JOB_NAMES.PROCESS_EXPIRED_BIDS,
      {},
      {
        repeat: {
          cron: '0 7 * * *',
          tz: 'America/Toronto',
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    await this.schedulingQueue.add(
      JOB_NAMES.PROCESS_EXPIRED_BIDS,
      {},
      {
        repeat: {
          cron: '0 19 * * *',
          tz: 'America/Toronto',
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    this.logger.log('SchedulingQueueProcessor: repeatable jobs registered (7 AM + 7 PM ET)', {
      rule_applied_id: this.RULE_ID,
    });
  }

  @Process(JOB_NAMES.CHECK_DEADLINES)
  async handleCheckDeadlines(job: Job): Promise<void> {
    const correlation_id = `QUEUE-DEADLINE-${randomUUID()}`;

    this.logger.log('SchedulingQueueProcessor: running deadline check', {
      job_id: job.id,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    try {
      await this.schedulingService.checkPeriodDeadlines(correlation_id);
      this.logger.log('SchedulingQueueProcessor: deadline check completed', {
        job_id: job.id,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      });
    } catch (err) {
      this.logger.error('SchedulingQueueProcessor: deadline check failed', err, {
        job_id: job.id,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      });
      throw err;
    }
  }

  @Process(JOB_NAMES.PROCESS_EXPIRED_BIDS)
  async handleProcessExpiredBids(job: Job): Promise<void> {
    const correlation_id = `QUEUE-EXPIRED-${randomUUID()}`;

    this.logger.log('SchedulingQueueProcessor: processing expired bids', {
      job_id: job.id,
      correlation_id,
      rule_applied_id: this.RULE_ID,
    });

    try {
      const count = await this.zoneBotService.processExpiredOffers(correlation_id);
      this.logger.log('SchedulingQueueProcessor: expired bids processed', {
        job_id: job.id,
        expired_count: count,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      });
    } catch (err) {
      this.logger.error('SchedulingQueueProcessor: expired bid processing failed', err, {
        job_id: job.id,
        correlation_id,
        rule_applied_id: this.RULE_ID,
      });
      throw err;
    }
  }
}
