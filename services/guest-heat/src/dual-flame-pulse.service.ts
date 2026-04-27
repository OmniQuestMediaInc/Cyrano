// HZ: Guest-Heat — Dual Flame Pulse service
// Business Plan §B.4 — fires when two VIP+ guests are simultaneously active
// in the same room with elevated heat tier (HOT or INFERNO).
//
// Contract:
//   • Register guest presence in a room.
//   • Evaluate after each presence update — if ≥2 VIP+ guests are present
//     and room heat is HOT/INFERNO, trigger a Dual Flame Pulse event.
//   • Emits GUEST_HEAT_DUAL_FLAME_TRIGGERED on NATS.
//   • De-duplicates: only one pulse per 60-second window per session.

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NatsService } from '../../core-api/src/nats/nats.service';
import { NATS_TOPICS } from '../../nats/topics.registry';
import {
  GUEST_HEAT_RULE_ID,
  type DualFlamePulseEvent,
  type MembershipTier,
} from './guest-heat.types';
import type { FfsTier } from '../../creator-control/src/ffs.engine';

/** Tiers eligible for Dual Flame Pulse (VIP and above). */
const ELIGIBLE_TIERS: Set<MembershipTier> = new Set([
  'VIP',
  'VIP_SILVER',
  'VIP_SILVER_BULLET',
  'VIP_GOLD',
  'VIP_PLATINUM',
  'VIP_DIAMOND',
]);

/** Heat tiers that qualify for Dual Flame Pulse. */
const QUALIFYING_HEAT: Set<FfsTier> = new Set(['HOT', 'INFERNO']);

/** Minimum interval between pulse events per session (milliseconds). */
const PULSE_COOLDOWN_MS = 60_000;

interface RoomPresenceEntry {
  guest_id: string;
  tier: MembershipTier;
  entered_at_utc: string;
}

@Injectable()
export class DualFlamePulseService {
  private readonly logger = new Logger(DualFlamePulseService.name);

  /** Room presence map — keyed by session_id, value is list of present guests. */
  private readonly presence = new Map<string, Map<string, RoomPresenceEntry>>();

  /** Last pulse timestamp per session (ms epoch). */
  private readonly lastPulseAt = new Map<string, number>();

  constructor(private readonly nats: NatsService) {}

  /**
   * Register or update a guest's presence in a room.
   * Evaluates pulse eligibility after registration.
   * Returns the pulse event if triggered, null otherwise.
   */
  registerPresence(
    session_id: string,
    creator_id: string,
    guest_id: string,
    tier: MembershipTier,
    current_heat: FfsTier,
  ): DualFlamePulseEvent | null {
    if (!this.presence.has(session_id)) {
      this.presence.set(session_id, new Map());
    }

    const room = this.presence.get(session_id)!;
    room.set(guest_id, {
      guest_id,
      tier,
      entered_at_utc: new Date().toISOString(),
    });

    return this.evaluatePulse(session_id, creator_id, current_heat, room);
  }

  /**
   * Remove a guest from presence tracking (on exit / disconnect).
   */
  removePresence(session_id: string, guest_id: string): void {
    const room = this.presence.get(session_id);
    if (room) room.delete(guest_id);
  }

  /**
   * Clear all presence data for a session on close.
   */
  clearSession(session_id: string): void {
    this.presence.delete(session_id);
    this.lastPulseAt.delete(session_id);
  }

  /**
   * Update the heat tier for an active session and re-evaluate.
   */
  onFfsTierChanged(
    session_id: string,
    creator_id: string,
    new_heat: FfsTier,
  ): DualFlamePulseEvent | null {
    const room = this.presence.get(session_id);
    if (!room) return null;
    return this.evaluatePulse(session_id, creator_id, new_heat, room);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private evaluatePulse(
    session_id: string,
    creator_id: string,
    heat: FfsTier,
    room: Map<string, RoomPresenceEntry>,
  ): DualFlamePulseEvent | null {
    if (!QUALIFYING_HEAT.has(heat)) return null;

    const eligibleGuests = Array.from(room.values()).filter(
      e => ELIGIBLE_TIERS.has(e.tier),
    );

    if (eligibleGuests.length < 2) return null;

    // Cooldown check.
    const last = this.lastPulseAt.get(session_id) ?? 0;
    if (Date.now() - last < PULSE_COOLDOWN_MS) return null;

    // Pick the first two eligible guests.
    const [a, b] = eligibleGuests;

    const event: DualFlamePulseEvent = {
      event_id: randomUUID(),
      session_id,
      creator_id,
      guest_a_id: a.guest_id,
      guest_b_id: b.guest_id,
      ffs_tier: heat as 'HOT' | 'INFERNO',
      triggered_at_utc: new Date().toISOString(),
      rule_applied_id: GUEST_HEAT_RULE_ID,
    };

    this.lastPulseAt.set(session_id, Date.now());

    this.nats.publish(NATS_TOPICS.GUEST_HEAT_DUAL_FLAME_TRIGGERED, {
      ...event,
    } as unknown as Record<string, unknown>);

    this.logger.log('DualFlamePulseService: pulse triggered', {
      session_id,
      heat,
      guest_a: a.guest_id,
      guest_b: b.guest_id,
    });

    return event;
  }
}
