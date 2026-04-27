// CRM: Guest-Heat — Performance Timer Service
// Business Plan §B.4 — session performance timer with Green/Yellow/Red states
// and immutable audit emission.
//
// Contract:
//   • Timer state: GREEN (0–20 min), YELLOW (20–40 min), RED (40+ min).
//   • State transitions are immutable — each transition creates a new audit
//     record; prior records are never mutated.
//   • Emits GUEST_HEAT_PERF_TIMER_STATE on NATS on each transition.
//   • Revenue at transition time is captured for performance analysis.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  GUEST_HEAT_RULE_ID,
  PERF_TIMER,
  type PerfTimerAudit,
  type PerfTimerState,
} from './guest-heat.types';

interface TimerRecord {
  session_id: string;
  creator_id: string;
  state: PerfTimerState;
  started_at_ms: number;
  last_transition_ms: number;
  revenue_czt: number;
  audit_trail: PerfTimerAudit[];
}

@Injectable()
export class PerformanceTimerService {
  private readonly logger = new Logger(PerformanceTimerService.name);

  /** Active timers — keyed by session_id. */
  private readonly timers = new Map<string, TimerRecord>();

  constructor(private readonly nats: NatsService) {}

  /**
   * Start the performance timer for a session.
   * Initialises to GREEN state.
   */
  startTimer(
    session_id: string,
    creator_id: string,
    correlation_id: string = randomUUID(),
  ): PerfTimerAudit {
    const now = Date.now();
    const audit = this.buildAudit(
      session_id,
      creator_id,
      'GREEN',
      0,
      0,
      'TIMER_STARTED',
      correlation_id,
    );

    const record: TimerRecord = {
      session_id,
      creator_id,
      state: 'GREEN',
      started_at_ms: now,
      last_transition_ms: now,
      revenue_czt: 0,
      audit_trail: [audit],
    };

    this.timers.set(session_id, record);
    this.emitState(audit);

    this.logger.log('PerformanceTimerService: timer started', { session_id });
    return audit;
  }

  /**
   * Evaluate timer state based on current elapsed time.
   * Emits a transition event if state changes.
   * Should be called periodically (e.g. every 60 s from a tick handler).
   *
   * @param session_id  Active session ID.
   * @param revenue_czt Current revenue in CZT tokens.
   * @returns New audit record if state changed, null otherwise.
   */
  tick(
    session_id: string,
    revenue_czt: number,
    correlation_id: string = randomUUID(),
  ): PerfTimerAudit | null {
    const timer = this.timers.get(session_id);
    if (!timer) return null;

    timer.revenue_czt = revenue_czt;

    const elapsed_sec = Math.floor((Date.now() - timer.started_at_ms) / 1_000);
    const elapsed_min = elapsed_sec / 60;

    const target_state = this.resolveState(elapsed_min);

    if (target_state === timer.state) return null;

    // State transition — immutable audit.
    const audit = this.buildAudit(
      session_id,
      timer.creator_id,
      target_state,
      elapsed_sec,
      revenue_czt,
      `TRANSITION_${timer.state}_TO_${target_state}`,
      correlation_id,
    );

    timer.state = target_state;
    timer.last_transition_ms = Date.now();
    timer.audit_trail.push(audit);

    this.emitState(audit);

    this.logger.log('PerformanceTimerService: state transition', {
      session_id,
      state: target_state,
      elapsed_min: Math.round(elapsed_min),
      revenue_czt,
    });

    return audit;
  }

  /**
   * Record a manual revenue update without triggering a state evaluation.
   */
  updateRevenue(session_id: string, revenue_czt: number): void {
    const timer = this.timers.get(session_id);
    if (timer) timer.revenue_czt = revenue_czt;
  }

  /**
   * Get the current timer state and audit trail for a session.
   */
  getTimerState(session_id: string): {
    state: PerfTimerState;
    elapsed_sec: number;
    revenue_czt: number;
    audit_trail: PerfTimerAudit[];
  } | null {
    const timer = this.timers.get(session_id);
    if (!timer) return null;

    return {
      state: timer.state,
      elapsed_sec: Math.floor((Date.now() - timer.started_at_ms) / 1_000),
      revenue_czt: timer.revenue_czt,
      audit_trail: timer.audit_trail,
    };
  }

  /**
   * Stop the timer on session close.
   */
  stopTimer(
    session_id: string,
    revenue_czt: number,
    correlation_id: string = randomUUID(),
  ): PerfTimerAudit | null {
    const timer = this.timers.get(session_id);
    if (!timer) return null;

    timer.revenue_czt = revenue_czt;
    const elapsed_sec = Math.floor((Date.now() - timer.started_at_ms) / 1_000);

    const audit = this.buildAudit(
      session_id,
      timer.creator_id,
      timer.state,
      elapsed_sec,
      revenue_czt,
      'TIMER_STOPPED',
      correlation_id,
    );

    timer.audit_trail.push(audit);
    this.emitState(audit);
    this.timers.delete(session_id);

    this.logger.log('PerformanceTimerService: timer stopped', {
      session_id,
      elapsed_sec,
      revenue_czt,
    });

    return audit;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private resolveState(elapsed_min: number): PerfTimerState {
    if (elapsed_min >= PERF_TIMER.RED_THRESHOLD_MIN) return 'RED';
    if (elapsed_min >= PERF_TIMER.YELLOW_THRESHOLD_MIN) return 'YELLOW';
    return 'GREEN';
  }

  private buildAudit(
    session_id: string,
    creator_id: string,
    state: PerfTimerState,
    elapsed_sec: number,
    revenue_at_transition_czt: number,
    transition_reason: string,
    correlation_id: string,
  ): PerfTimerAudit {
    return {
      audit_id: randomUUID(),
      session_id,
      creator_id,
      state,
      elapsed_sec,
      revenue_at_transition_czt,
      transition_reason,
      correlation_id,
      rule_applied_id: GUEST_HEAT_RULE_ID,
      recorded_at_utc: new Date().toISOString(),
    };
  }

  private emitState(audit: PerfTimerAudit): void {
    this.nats.publish(NATS_TOPICS.GUEST_HEAT_PERF_TIMER_STATE, {
      ...audit,
    } as unknown as Record<string, unknown>);
  }
}
