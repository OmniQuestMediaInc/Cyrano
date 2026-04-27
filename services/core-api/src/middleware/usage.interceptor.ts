// CYR: BENEFITS-001 — UsageInterceptor
// Increments benefit usage counters (images_used, voice_minutes) after a
// successful request. Runs post-handler via tap() on the observable.
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma.service';
import { NatsService } from '../nats/nats.service';
import { NATS_TOPICS } from '../../../nats/topics.registry';
import { v4 as uuidv4 } from 'uuid';

type BenefitAction = 'IMAGE' | 'VOICE' | 'OTHER';

/** Returns YYYY-MM for the current UTC month. */
function getCurrentMonth(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

@Injectable()
export class UsageInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UsageInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsService: NatsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        const req = context.switchToHttp().getRequest<{
          user?: { id?: string };
          path: string;
        }>();

        const userId = req.user?.id;
        if (!userId) return;

        const action = this.getActionFromPath(req.path);
        if (action === 'OTHER') return;

        const month = getCurrentMonth();

        this.incrementUsage(userId, month, action).catch((err) => {
          this.logger.error('UsageInterceptor: failed to increment usage', {
            user_id: userId,
            action,
            month,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }),
    );
  }

  private async incrementUsage(
    userId: string,
    month: string,
    action: BenefitAction,
  ): Promise<void> {
    const correlationId = uuidv4();

    if (action === 'IMAGE') {
      await this.prisma.benefitUsage.upsert({
        where: { userId_month: { user_id: userId, month } },
        update: { images_used: { increment: 1 } },
        create: {
          user_id: userId,
          month,
          images_used: 1,
          voice_minutes: 0,
          correlation_id: correlationId,
          reason_code: 'BENEFIT_IMAGE_INCREMENT',
        },
      });
    } else if (action === 'VOICE') {
      await this.prisma.benefitUsage.upsert({
        where: { userId_month: { user_id: userId, month } },
        update: { voice_minutes: { increment: 1 } },
        create: {
          user_id: userId,
          month,
          images_used: 0,
          voice_minutes: 1,
          correlation_id: correlationId,
          reason_code: 'BENEFIT_VOICE_INCREMENT',
        },
      });
    }

    this.natsService.publish(NATS_TOPICS.BENEFIT_USAGE_INCREMENTED, {
      correlation_id: correlationId,
      user_id: userId,
      action,
      month,
      timestamp: new Date().toISOString(),
    });
  }

  private getActionFromPath(path: string): BenefitAction {
    if (path.includes('/image')) return 'IMAGE';
    if (path.includes('/voice')) return 'VOICE';
    return 'OTHER';
  }
}
