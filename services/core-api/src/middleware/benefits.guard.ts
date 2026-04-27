// CYR: BENEFITS-001 — BenefitsGuard
// Enforces per-tier monthly benefit limits for IMAGE generation and VOICE minutes.
// Action type is derived from the request path prefix.
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MembershipService } from '../membership/membership.service';
import { NatsService } from '../nats/nats.service';
import { BENEFIT_LIMITS } from '../config/governance.config';
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
export class BenefitsGuard implements CanActivate {
  private readonly logger = new Logger(BenefitsGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipService: MembershipService,
    private readonly natsService: NatsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: { id?: string };
      path: string;
    }>();

    const userId = req.user?.id;
    if (!userId) return false;

    const action = this.getActionFromPath(req.path);
    if (action === 'OTHER') return true; // No limit enforced for unrecognised paths

    const tier = await this.membershipService.getActiveTier(userId);
    const limits = BENEFIT_LIMITS[tier] ?? BENEFIT_LIMITS['GUEST'];
    const month = getCurrentMonth();

    const usage = await this.prisma.benefitUsage.upsert({
      where: { userId_month: { user_id: userId, month } },
      update: {},
      create: {
        user_id: userId,
        month,
        images_used: 0,
        voice_minutes: 0,
        correlation_id: uuidv4(),
        reason_code: 'BENEFIT_USAGE_INIT',
      },
    });

    if (action === 'IMAGE' && limits.images !== -1) {
      if (usage.images_used >= limits.images) {
        this.logger.warn('BenefitsGuard: monthly image limit reached', {
          user_id: userId,
          tier,
          images_used: usage.images_used,
          limit: limits.images,
        });
        this.natsService.publish(NATS_TOPICS.BENEFIT_LIMIT_REACHED, {
          correlation_id: uuidv4(),
          user_id: userId,
          tier,
          action,
          month,
          used: usage.images_used,
          limit: limits.images,
          timestamp: new Date().toISOString(),
        });
        throw new HttpException(
          'Monthly image limit reached. Upgrade your membership for more.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    if (action === 'VOICE' && limits.voiceMin !== -1) {
      if (usage.voice_minutes >= limits.voiceMin) {
        this.logger.warn('BenefitsGuard: monthly voice limit reached', {
          user_id: userId,
          tier,
          voice_minutes: usage.voice_minutes,
          limit: limits.voiceMin,
        });
        this.natsService.publish(NATS_TOPICS.BENEFIT_LIMIT_REACHED, {
          correlation_id: uuidv4(),
          user_id: userId,
          tier,
          action,
          month,
          used: usage.voice_minutes,
          limit: limits.voiceMin,
          timestamp: new Date().toISOString(),
        });
        throw new HttpException(
          'Monthly voice minute limit reached. Upgrade your membership for more.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }

  private getActionFromPath(path: string): BenefitAction {
    if (path.includes('/image')) return 'IMAGE';
    if (path.includes('/voice')) return 'VOICE';
    return 'OTHER';
  }
}
