// services/bijou/src/bijou-session.service.ts
// BIJOU: BIJOU-002 — Bijou Play.Zone session service
// Handles: camera enforcement, standby queue, dwell ticks, ejection, reconciliation.
import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import { BIJOU_PRICING } from '../../core-api/src/config/governance.config';

export interface BijouParticipant {
  user_id: string;
  seat_number: number;
  is_host: boolean;
  camera_active: boolean;
  entered_at_utc: string;
  camera_grace_expires_at_utc?: string;
  camera_warning_expires_at_utc?: string;
  total_dwell_secs: number;
  last_dwell_tick_utc?: string;
}

export interface StandbyEntry {
  user_id: string;
  queued_at_utc: string;
  notified_at_utc?: string;
  accept_expires_at_utc?: string;
}

export interface BijouSession {
  session_id: string;
  show_id: string;
  creator_id: string;
  max_participants: number;         // Always BIJOU_PRICING.MAX_PARTICIPANTS (24)
  participants: BijouParticipant[];
  standby_queue: StandbyEntry[];
  started_at_utc: string;
  ended_at_utc?: string;
  rule_applied_id: string;
}

@Injectable()
export class BijouSessionService {
  private readonly logger = new Logger(BijouSessionService.name);
  private readonly RULE_ID = 'BIJOU_SESSION_v1';

  constructor(private readonly nats: NatsService) {}

  /**
   * Admits a VIP to a Bijou theatre room.
   * Enforces hard cap of MAX_PARTICIPANTS (24 VIPs + host).
   * Starts the camera grace period timer on entry.
   */
  admitParticipant(
    session: BijouSession,
    user_id: string,
    is_host: boolean,
  ): BijouSession {
    const vipCount = session.participants.filter(p => !p.is_host).length;
    if (!is_host && vipCount >= BIJOU_PRICING.MAX_PARTICIPANTS) {
      throw new Error(
        `SEAT_CAPACITY_FULL: Bijou session ${session.session_id} is at capacity ` +
        `(${BIJOU_PRICING.MAX_PARTICIPANTS} VIPs).`
      );
    }

    const now = new Date();
    const graceExpiry = new Date(
      now.getTime() + BIJOU_PRICING.CAMERA_GRACE_PERIOD_SEC * 1000
    );

    const participant: BijouParticipant = {
      user_id,
      seat_number: session.participants.length + 1,
      is_host,
      camera_active: false,
      entered_at_utc: now.toISOString(),
      camera_grace_expires_at_utc: graceExpiry.toISOString(),
      total_dwell_secs: 0,
    };

    this.logger.log('BijouSessionService: participant admitted', {
      session_id: session.session_id,
      user_id,
      is_host,
      seat_number: participant.seat_number,
      rule_applied_id: this.RULE_ID,
    });

    return {
      ...session,
      participants: [...session.participants, participant],
    };
  }

  /**
   * Evaluates camera compliance for a participant.
   * Returns action: NONE | WARN | EJECT
   * Caller is responsible for executing the ejection if returned.
   */
  evaluateCameraCompliance(
    session: BijouSession,
    user_id: string,
  ): { action: 'NONE' | 'WARN' | 'EJECT'; participant: BijouParticipant } {
    const participant = session.participants.find(p => p.user_id === user_id);
    if (!participant) throw new Error(`PARTICIPANT_NOT_FOUND: ${user_id}`);
    if (participant.camera_active) return { action: 'NONE', participant };

    const now = new Date();
    const graceExpiry = participant.camera_grace_expires_at_utc
      ? new Date(participant.camera_grace_expires_at_utc) : null;
    const warningExpiry = participant.camera_warning_expires_at_utc
      ? new Date(participant.camera_warning_expires_at_utc) : null;

    // Still within grace period
    if (graceExpiry && now < graceExpiry) return { action: 'NONE', participant };

    // Grace expired — issue warning if not already warned
    if (!participant.camera_warning_expires_at_utc) {
      const warnExpiry = new Date(
        now.getTime() + BIJOU_PRICING.CAMERA_WARNING_PERIOD_SEC * 1000
      );
      this.nats.publish(NATS_TOPICS.BIJOU_CAMERA_VIOLATION, {
        session_id: session.session_id,
        user_id,
        action: 'WARN',
        warn_expires_at_utc: warnExpiry.toISOString(),
        rule_applied_id: this.RULE_ID,
      });
      return {
        action: 'WARN',
        participant: {
          ...participant,
          camera_warning_expires_at_utc: warnExpiry.toISOString(),
        },
      };
    }

    // Warning period also expired — eject
    if (warningExpiry && now >= warningExpiry) {
      this.nats.publish(NATS_TOPICS.BIJOU_EJECTION, {
        session_id: session.session_id,
        user_id,
        reason: 'CAMERA_COMPLIANCE_EJECTION',
        rule_applied_id: this.RULE_ID,
      });
      this.logger.warn('BijouSessionService: participant ejected — camera non-compliance', {
        session_id: session.session_id,
        user_id,
        rule_applied_id: this.RULE_ID,
      });
      return { action: 'EJECT', participant };
    }

    return { action: 'WARN', participant };
  }

  /**
   * Records a 5-second dwell tick for a participant.
   * Published to NATS for DwellService to aggregate for bonus pool calculation.
   */
  recordDwellTick(session: BijouSession, user_id: string): void {
    const participant = session.participants.find(p => p.user_id === user_id);
    if (!participant) return;

    this.nats.publish(NATS_TOPICS.BIJOU_DWELL_TICK, {
      session_id: session.session_id,
      show_id: session.show_id,
      creator_id: session.creator_id,
      user_id,
      tick_secs: 5,
      timestamp_utc: new Date().toISOString(),
      rule_applied_id: this.RULE_ID,
    });
  }

  /**
   * Adds a VIP to the standby queue.
   * Queue is FIFO. Returns updated session.
   */
  joinStandby(session: BijouSession, user_id: string): BijouSession {
    const alreadyQueued = session.standby_queue.some(e => e.user_id === user_id);
    if (alreadyQueued) return session;

    const entry: StandbyEntry = {
      user_id,
      queued_at_utc: new Date().toISOString(),
    };

    this.logger.log('BijouSessionService: VIP joined standby', {
      session_id: session.session_id,
      user_id,
      queue_position: session.standby_queue.length + 1,
    });

    return { ...session, standby_queue: [...session.standby_queue, entry] };
  }

  /**
   * Notifies the next standby VIP of an available seat.
   * The notified VIP has STANDBY_ACCEPT_WINDOW_SEC to accept.
   * Returns the updated session and the notified user_id.
   */
  notifyNextStandby(session: BijouSession): {
    session: BijouSession;
    notified_user_id: string | null;
  } {
    const next = session.standby_queue[0];
    if (!next) return { session, notified_user_id: null };

    const acceptExpiry = new Date(
      Date.now() + BIJOU_PRICING.STANDBY_ACCEPT_WINDOW_SEC * 1000
    );

    const updatedEntry: StandbyEntry = {
      ...next,
      notified_at_utc: new Date().toISOString(),
      accept_expires_at_utc: acceptExpiry.toISOString(),
    };

    const updatedQueue = [
      updatedEntry,
      ...session.standby_queue.slice(1),
    ];

    this.nats.publish(NATS_TOPICS.BIJOU_STANDBY_ALERT, {
      session_id: session.session_id,
      user_id: next.user_id,
      accept_expires_at_utc: acceptExpiry.toISOString(),
      accept_window_secs: BIJOU_PRICING.STANDBY_ACCEPT_WINDOW_SEC,
      rule_applied_id: this.RULE_ID,
    });

    this.logger.log('BijouSessionService: standby alert sent', {
      session_id: session.session_id,
      user_id: next.user_id,
      accept_expires_at_utc: acceptExpiry.toISOString(),
    });

    return {
      session: { ...session, standby_queue: updatedQueue },
      notified_user_id: next.user_id,
    };
  }
}
