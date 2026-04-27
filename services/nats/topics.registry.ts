// services/nats/topics.registry.ts
// NATS: Canonical topic registry — all NATS subjects in one place.
// No service may publish or subscribe to a topic not listed here.
// Any new topic requires a NATS: commit adding it to this registry first.

export const NATS_TOPICS = {
  // ── Geo-pricing & chat stream ──────────────────────────────────────────
  GEO_TIP_TRANSLATED:       'geo.tip.translated',
  GEO_BLOCK_ENFORCED:       'geo.block.enforced',

  // ── Gamification ──────────────────────────────────────────────────────
  GAME_OUTCOME:             'game.outcome',        // game.outcome.<session_id>

  // ── Bijou Play.Zone ────────────────────────────────────────────────────
  BIJOU_DWELL_TICK:         'bijou.dwell.tick',
  BIJOU_SEAT_OPENED:        'bijou.seat.opened',
  BIJOU_STANDBY_ALERT:      'bijou.standby.alert',
  BIJOU_CAMERA_VIOLATION:   'bijou.camera.violation',
  BIJOU_EJECTION:           'bijou.ejection',

  // ── ShowZone Theatre — RETIRED (2026-04-26) — ShowToken removed ───────
  // Topics kept as tombstones so existing consumers fail loudly.
  // Do not publish new messages to these subjects.
  // SHOWZONE_DWELL_TICK, SHOWZONE_SEAT_OPENED, SHOWZONE_PHASE2_TRIGGER, SHOWZONE_SHOW_ENDED
  /** @deprecated RETIRED 2026-04-26. ShowToken removed. Do not use in new code. */
  SHOWZONE_DWELL_TICK:      'showzone.dwell.tick',
  /** @deprecated RETIRED 2026-04-26. ShowToken removed. Do not use in new code. */
  SHOWZONE_SEAT_OPENED:     'showzone.seat.opened',
  /** @deprecated RETIRED 2026-04-26. ShowToken removed. Do not use in new code. */
  SHOWZONE_PHASE2_TRIGGER:  'showzone.phase2.trigger',
  /** @deprecated RETIRED 2026-04-26. ShowToken removed. Do not use in new code. */
  SHOWZONE_SHOW_ENDED:      'showzone.show.ended',

  // ── Chat aggregation (OBS multi-platform) ─────────────────────────────
  CHAT_INGEST_RAW:          'chat.ingest.raw',
  CHAT_RESPONSE_OUTBOUND:   'chat.response.outbound',
  CHAT_BROADCAST_STAGGERED: 'chat.broadcast.staggered',

  // ── HeartZone biometrics — legacy Hz IoT layer ────────────────────────
  HZ_BPM_UPDATE:            'hz.bpm.update',
  HZ_HAPTIC_TRIGGER:        'hz.haptic.trigger',
  HZ_WISH_FULFILLED:        'hz.wish.fulfilled',

  // ── SenSync™ biometric relay (replaces HeartSync) ─────────────────────
  SENSYNC_BIOMETRIC_DATA:         'sensync.biometric.data',     // encrypted subject
  SENSYNC_BPM_UPDATE:             'sensync.bpm.update',         // normalized BPM for FFS
  SENSYNC_RELAY_EMITTED:          'sensync.relay.emitted',
  SENSYNC_COMBINED_BPM:           'sensync.combined.bpm',
  SENSYNC_CONSENT_GRANTED:        'sensync.consent.granted',
  SENSYNC_CONSENT_REVOKED:        'sensync.consent.revoked',
  SENSYNC_HAPTIC_DISPATCHED:      'sensync.haptic.dispatched',
  SENSYNC_PLAUSIBILITY_REJECTED:  'sensync.plausibility.rejected',
  SENSYNC_TIER_DISABLED:          'sensync.tier.disabled',
  // ── SenSync™ device/hardware lifecycle ────────────────────────────────
  SENSYNC_DEVICE_CONNECTED:       'sensync.device.connected',
  SENSYNC_DEVICE_DISCONNECTED:    'sensync.device.disconnected',
  SENSYNC_PURGE_REQUESTED:        'sensync.purge.requested',
  SENSYNC_PURGE_COMPLETED:        'sensync.purge.completed',
  SENSYNC_HARDWARE_CONNECTED:     'sensync.hardware.connected',
  SENSYNC_HARDWARE_DISCONNECTED:  'sensync.hardware.disconnected',

  // ── HeartSync topics — RETIRED (2026-04-26; superseded by SenSync™) ──
  // Kept as deprecated constants to allow legacy heartsync/ service to compile.
  // Do not use in new code.
  /** @deprecated RETIRED 2026-04-26. Use SENSYNC_* equivalents. */
  HEARTSYNC_SAMPLE_RECEIVED:        'heartsync.sample.received',
  /** @deprecated RETIRED 2026-04-26. Use SENSYNC_RELAY_EMITTED. */
  HEARTSYNC_RELAY_EMITTED:          'heartsync.relay.emitted',
  /** @deprecated RETIRED 2026-04-26. Use SENSYNC_COMBINED_BPM. */
  HEARTSYNC_COMBINED_BPM:           'heartsync.combined.bpm',
  /** @deprecated RETIRED 2026-04-26. Use SENSYNC_CONSENT_GRANTED. */
  HEARTSYNC_CONSENT_GRANTED:        'heartsync.consent.granted',
  /** @deprecated RETIRED 2026-04-26. Use SENSYNC_CONSENT_REVOKED. */
  HEARTSYNC_CONSENT_REVOKED:        'heartsync.consent.revoked',
  /** @deprecated RETIRED 2026-04-26. Use SENSYNC_HAPTIC_DISPATCHED. */
  HEARTSYNC_HAPTIC_DISPATCHED:      'heartsync.haptic.dispatched',
  /** @deprecated RETIRED 2026-04-26. Use SENSYNC_PLAUSIBILITY_REJECTED. */
  HEARTSYNC_PLAUSIBILITY_REJECTED:  'heartsync.plausibility.rejected',
  /** @deprecated RETIRED 2026-04-26. Use SENSYNC_TIER_DISABLED. */
  HEARTSYNC_TIER_DISABLED:          'heartsync.tier.disabled',

  // ── Guest-Heat intelligence layer ─────────────────────────────────────
  GUEST_HEAT_WHALE_SCORED:          'guest_heat.whale.scored',
  GUEST_HEAT_OFFER_TRIGGERED:       'guest_heat.offer.triggered',
  GUEST_HEAT_OFFER_ACCEPTED:        'guest_heat.offer.accepted',
  GUEST_HEAT_GEMSTONE_QUEUED:       'guest_heat.gemstone.queued',
  GUEST_HEAT_GEMSTONE_SENT:         'guest_heat.gemstone.sent',
  GUEST_HEAT_DUAL_FLAME_TRIGGERED:  'guest_heat.dual_flame.triggered',
  GUEST_HEAT_FORECAST_UPDATED:      'guest_heat.forecast.updated',
  GUEST_HEAT_PERF_TIMER_STATE:      'guest_heat.perf_timer.state',
  GUEST_HEAT_TELEPROMPTER_ADVANCED: 'guest_heat.teleprompter.advanced',

  // ── Risk & fraud ───────────────────────────────────────────────────────
  RISK_FLAG_RAISED:         'risk.flag.raised',
  RISK_CONTAINMENT_APPLIED: 'risk.containment.applied',
  FRIENDLY_FRAUD_SIGNAL_RAISED: 'risk.friendly_fraud.signal_raised',

  // ── Refund policy & CS extensions ─────────────────────────────────────────
  REFUND_POLICY_ACKNOWLEDGED:   'refund.policy.acknowledged',
  REFUND_EXTENSION_EXECUTED:    'refund.extension.executed',
  SERVICE_TO_SALE_TRIGGERED:    'refund.service_to_sale.triggered',

  // ── GWP / VoucherVault ─────────────────────────────────────────────────
  GWP_OFFER_TRIGGERED:      'gwp.offer.triggered',
  GWP_OFFER_ACCEPTED:       'gwp.offer.accepted',

  // ── Step-up authentication ─────────────────────────────────────────────
  STEP_UP_CHALLENGE_ISSUED:   'auth.step_up.challenge.issued',
  STEP_UP_CHALLENGE_VERIFIED: 'auth.step_up.challenge.verified',
  STEP_UP_CHALLENGE_FAILED:   'auth.step_up.challenge.failed',

  // ── KYC / Publish gate ─────────────────────────────────────────────────
  PUBLISH_GATE_APPROVED:    'kyc.publish_gate.approved',
  PUBLISH_GATE_BLOCKED:     'kyc.publish_gate.blocked',

  // ── Moderation / Incident lifecycle ─────────────────────────────────────
  INCIDENT_TRANSITION:      'moderation.incident.transition',

  // ── Audit & compliance ─────────────────────────────────────────────────
  AUDIT_EVENT_WRITTEN:              'audit.event.written',
  AUDIT_CHAIN_INTEGRITY_FAILURE:    'audit.chain.integrity_failure',
  AUDIT_CHAIN_VERIFIED:             'audit.chain.verified',
  WORM_EXPORT_TRIGGERED:            'worm.export.triggered',
  WORM_EXPORT_COMPLETED:            'worm.export.completed',
  WORM_EXPORT_INTEGRITY_FAILURE:    'worm.export.integrity_failure',

  // ── PAYLOAD 6: Immutable audit emission ────────────────────────────────
  AUDIT_IMMUTABLE_PURCHASE:         'audit.immutable.purchase',
  AUDIT_IMMUTABLE_SPEND:            'audit.immutable.spend',
  AUDIT_IMMUTABLE_RECOVERY:         'audit.immutable.recovery',
  AUDIT_IMMUTABLE_GATEGUARD:        'audit.immutable.gateguard',
  AUDIT_IMMUTABLE_CYRANO:           'audit.immutable.cyrano',
  AUDIT_IMMUTABLE_STEP_UP:          'audit.immutable.step_up',
  AUDIT_IMMUTABLE_RBAC:             'audit.immutable.rbac',
  AUDIT_IMMUTABLE_DIAMOND:          'audit.immutable.diamond',

  // ── Legal hold ─────────────────────────────────────────────────────────
  LEGAL_HOLD_APPLIED:       'compliance.legal_hold.applied',
  LEGAL_HOLD_LIFTED:        'compliance.legal_hold.lifted',

  // ── Reconciliation (INFRA-004 — L0 ship-gate) ─────────────────────────
  RECONCILIATION_DRIFT_DETECTED: 'compliance.reconciliation.drift_detected',

  // ── PROC-001: Webhook hardening (FIZ) ─────────────────────────────────
  WEBHOOK_VALIDATION_FAILURE: 'fiz.webhook.validation.failure',
  WEBHOOK_DLQ:                'fiz.webhook.dlq',
  WEBHOOK_RECEIVED:           'payments.webhook.received',
  WEBHOOK_VERIFIED:           'payments.webhook.verified',
  WEBHOOK_REJECTED:           'payments.webhook.rejected',
  WEBHOOK_DUPLICATE:          'payments.webhook.duplicate',
  WEBHOOK_DEAD_LETTER:        'payments.webhook.dead_letter',

  // ── DFSP Module 3 — Platform OTP ──────────────────────────────────────
  DFSP_OTP_ISSUED:              'dfsp.otp.issued',
  DFSP_OTP_VERIFIED:            'dfsp.otp.verified',
  DFSP_OTP_FAILED:              'dfsp.otp.failed',
  DFSP_OTP_EXPIRED:             'dfsp.otp.expired',

  // ── DFSP Module 4 — Account Recovery Hold ─────────────────────────────
  DFSP_ACCOUNT_HOLD_APPLIED:    'dfsp.account.hold.applied',
  DFSP_ACCOUNT_HOLD_RELEASED:   'dfsp.account.hold.released',

  // ── DFSP — Diamond Financial Security Platform (PV-001) ───────────────
  PURCHASE_WINDOW_BLOCKED:             'dfsp.purchase_window.blocked',
  RISK_ASSESSMENT_COMPLETED:           'dfsp.risk.assessment_completed',
  RISK_AUTO_BAR_TRIGGERED:             'dfsp.risk.auto_bar_triggered',
  INTEGRITY_HOLD_AUTHORIZED:           'dfsp.integrity_hold.authorized',
  INTEGRITY_HOLD_RELEASED:             'dfsp.integrity_hold.released',
  INTEGRITY_HOLD_CAPTURED:             'dfsp.integrity_hold.captured',
  CHECKOUT_CONFIRMED:                  'dfsp.checkout.confirmed',
  CHECKOUT_EMAIL_RECEIPT_REQUESTED:    'dfsp.checkout.email_receipt_requested',
  CHECKOUT_SMS_NOTIFICATION_REQUESTED: 'dfsp.checkout.sms_notification_requested',

  // ── DFSP Module 5 — Voice Sample ──────────────────────────────────────────
  DFSP_VOICE_SAMPLE_CONSENT_RECORDED: 'dfsp.voice_sample.consent_recorded',
  DFSP_VOICE_SAMPLE_COLLECTED:        'dfsp.voice_sample.collected',
  DFSP_VOICE_SAMPLE_DISPOSED:         'dfsp.voice_sample.disposed',
  DFSP_VOICE_SAMPLE_LIMIT_REACHED:    'dfsp.voice_sample.limit_reached',

  // ── DFSP Concierge (CONCIERGE-CONFIG-001) ─────────────────────────────────
  DFSP_CONCIERGE_APPOINTMENT_BOOKED:  'dfsp.concierge.appointment.booked',

  // ── GZ Scheduling Module ──────────────────────────────────────────────────
  SCHEDULE_PERIOD_CREATED:         'gz.schedule.period.created',
  SCHEDULE_PERIOD_B_LOCKED:        'gz.schedule.period.b_locked',
  SCHEDULE_PERIOD_FINAL_LOCKED:    'gz.schedule.period.final_locked',
  SCHEDULE_SHIFT_ASSIGNED:         'gz.schedule.shift.assigned',
  SCHEDULE_SHIFT_SWAPPED:          'gz.schedule.shift.swapped',
  SCHEDULE_GAP_POSTED:             'gz.schedule.gap.posted',
  SCHEDULE_GAP_FILLED:             'gz.schedule.gap.filled',
  SCHEDULE_ZONEBOT_LOTTERY_RUN:    'gz.schedule.zonebot.lottery_run',
  SCHEDULE_ZONEBOT_BID_OFFERED:    'gz.schedule.zonebot.bid_offered',
  SCHEDULE_ZONEBOT_BID_AWARDED:    'gz.schedule.zonebot.bid_awarded',
  SCHEDULE_ZONEBOT_BID_EXPIRED:    'gz.schedule.zonebot.bid_expired',
  SCHEDULE_COMPLIANCE_VIOLATION:   'gz.schedule.compliance.violation',
  SCHEDULE_COVERAGE_GAP_DETECTED:  'gz.schedule.coverage.gap_detected',
  SCHEDULE_STAT_HOLIDAY_ALERT:     'gz.schedule.stat_holiday.alert',
  SCHEDULE_REMINDER_BLOCK_CUTOFF:  'gz.schedule.reminder.block_cutoff',

  // ── Zone Access (MEMB-001) ─────────────────────────────────────────────────
  ZONE_ACCESS_DENIED:              'zone.access.denied',

  // ── Membership Subscriptions (MEMB-002) ───────────────────────────────────
  MEMBERSHIP_SUBSCRIPTION_CREATED:   'membership.subscription.created',
  MEMBERSHIP_SUBSCRIPTION_CANCELLED: 'membership.subscription.cancelled',
  MEMBERSHIP_SUBSCRIPTION_EXPIRED:   'membership.subscription.expired',

  // ── Membership Stipend (MEMB-003) ─────────────────────────────────────────
  MEMBERSHIP_STIPEND_DISTRIBUTED:    'membership.stipend.distributed',

  // ── Bijou Scheduler (BJ-002) ──────────────────────────────────────────────
  BIJOU_SESSION_SCHEDULED:           'bijou.session.scheduled',
  BIJOU_SESSION_OPENED:              'bijou.session.opened',
  BIJOU_SESSION_CLOSED:              'bijou.session.closed',
  BIJOU_SESSION_CANCELLED:           'bijou.session.cancelled',

  // ── Bijou Admission (BJ-003) ──────────────────────────────────────────────
  BIJOU_ADMISSION_OFFERED:           'bijou.admission.offered',
  BIJOU_ADMISSION_ADMITTED:          'bijou.admission.admitted',
  BIJOU_ADMISSION_STANDBY:           'bijou.admission.standby',
  BIJOU_ADMISSION_EJECTED:           'bijou.admission.ejected',
  BIJOU_ADMISSION_ABANDONED:         'bijou.admission.abandoned',

  // ── Bijou Dwell Credit (BJ-004) ───────────────────────────────────────────
  BIJOU_DWELL_CREDITED:              'bijou.dwell.credited',

  // ── OBS Bridge + Chat Aggregator + Persona Engine (OBS-001) ──────────────
  OBS_STREAM_STARTED:                'obs.stream.started',
  OBS_STREAM_ENDED:                  'obs.stream.ended',
  OBS_STREAM_KEY_ROTATED:            'obs.stream.key.rotated',
  CHAT_MESSAGE_INGESTED:             'chat.message.ingested',
  PERSONA_RESPONSE_QUEUED:           'persona.response.queued',

  // ── GateGuard Sentinel Pre-Processor (Business Plan B.5) ─────────────────
  GATEGUARD_EVALUATION_COMPLETED:    'gateguard.evaluation.completed',
  GATEGUARD_DECISION_APPROVED:       'gateguard.decision.approved',
  GATEGUARD_DECISION_COOLDOWN:       'gateguard.decision.cooldown',
  GATEGUARD_DECISION_HARD_DECLINE:   'gateguard.decision.hard_decline',
  GATEGUARD_DECISION_HUMAN_ESCALATE: 'gateguard.decision.human_escalate',
  GATEGUARD_WELFARE_SIGNAL:          'gateguard.welfare.signal',
  GATEGUARD_AV_CHECK_REQUESTED:      'gateguard.av.check_requested',
  GATEGUARD_AV_CHECK_RETURNED:       'gateguard.av.check_returned',
  GATEGUARD_FEDERATED_LOOKUP:        'gateguard.federated.lookup',
  GATEGUARD_HUMAN_CONTACT_ZONE:      'gateguard.human_contact_zone.escalated',

  // ── GateGuard Sentinel — Chat Message Moderation ──────────────────────────
  /** Emitted when a chat message is blocked by content moderation. */
  GATEGUARD_MESSAGE_BLOCKED:           'gateguard.message.blocked',
  /** Emitted when WelfareGuardian detects a distress signal in conversation. */
  GATEGUARD_WELFARE_DISTRESS_DETECTED: 'gateguard.welfare.distress_detected',

  // ── Flicker n'Flame Scoring — FFS (replaces Room-Heat Engine) ────────
  FFS_SCORE_UPDATE:               'ffs.score.update',
  FFS_TIER_CHANGED:               'ffs.score.tier.changed',
  FFS_PEAK:                       'ffs.score.peak',
  FFS_LEADERBOARD_UPDATED:        'ffs.score.leaderboard.updated',
  FFS_HOT_AND_READY:              'ffs.score.hot_and_ready',
  FFS_DUAL_FLAME_PEAK:            'ffs.score.dual_flame.peak',
  FFS_SESSION_STARTED:            'ffs.score.session.started',
  FFS_SESSION_ENDED:              'ffs.score.session.ended',
  FFS_ADAPTIVE_UPDATED:           'ffs.score.adaptive.updated',
  FFS_GUEST_SCORED:               'ffs.score.guest.scored',

  // ── Room-Heat Engine topics — RETIRED (2026-04-26; superseded by FFS) ─
  // Kept as deprecated constants to allow legacy room-heat/ service to compile.
  // Do not use in new code.
  /** @deprecated RETIRED 2026-04-26. Use FFS_SCORE_UPDATE. */
  ROOM_HEAT_SAMPLE:                  'room.heat.sample',
  /** @deprecated RETIRED 2026-04-26. Use FFS_TIER_CHANGED. */
  ROOM_HEAT_TIER_CHANGED:            'room.heat.tier.changed',
  /** @deprecated RETIRED 2026-04-26. Use FFS_PEAK. */
  ROOM_HEAT_PEAK:                    'room.heat.peak',
  /** @deprecated RETIRED 2026-04-26. Use FFS_LEADERBOARD_UPDATED. */
  ROOM_HEAT_LEADERBOARD_UPDATED:     'room.heat.leaderboard.updated',
  /** @deprecated RETIRED 2026-04-26. Use FFS_HOT_AND_READY. */
  ROOM_HEAT_HOT_AND_READY:           'room.heat.hot_and_ready',
  /** @deprecated RETIRED 2026-04-26. Use FFS_DUAL_FLAME_PEAK. */
  ROOM_HEAT_DUAL_FLAME_PEAK:         'room.heat.dual_flame.peak',
  /** @deprecated RETIRED 2026-04-26. Use FFS_SESSION_STARTED. */
  ROOM_HEAT_SESSION_STARTED:         'room.heat.session.started',
  /** @deprecated RETIRED 2026-04-26. Use FFS_SESSION_ENDED. */
  ROOM_HEAT_SESSION_ENDED:           'room.heat.session.ended',
  /** @deprecated RETIRED 2026-04-26. Use FFS_ADAPTIVE_UPDATED. */
  ROOM_HEAT_ADAPTIVE_UPDATED:        'room.heat.adaptive.updated',

  // ── VelocityZone — payout rate events ─────────────────────────────────
  VELOCITYZONE_EVENT_ACTIVE:      'velocityzone.event.active',
  VELOCITYZONE_RATE_APPLIED:      'velocityzone.rate.applied',
  VELOCITYZONE_EVENT_ENDED:       'velocityzone.event.ended',
  VELOCITYZONE_RATE_LOCKED:       'velocityzone.rate.locked',

  // ── CreatorControl.Zone (Business Plan B.3 — creator workstation) ────────
  CREATOR_CONTROL_BROADCAST_SUGGESTION: 'creator_control.broadcast.suggestion',
  CREATOR_CONTROL_SESSION_SUGGESTION:   'creator_control.session.suggestion',
  CREATOR_CONTROL_PRICE_NUDGE:          'creator_control.price.nudge',

  // ── Cyrano Layer 1 (Business Plan B.3.5 — whisper copilot) ───────────────
  CYRANO_SUGGESTION_EMITTED:         'cyrano.suggestion.emitted',
  CYRANO_SUGGESTION_DROPPED:         'cyrano.suggestion.dropped',
  CYRANO_MEMORY_UPDATED:             'cyrano.memory.updated',
  CYRANO_FFS_FRAME_CONSUMED:         'cyrano.ffs_frame.consumed',

  // ── Cyrano Layer 2 (standalone role-play platform — VIP gate events) ─────
  CYRANO_LAYER2_SESSION_GRANTED:     'cyrano.layer2.session.granted',
  CYRANO_LAYER2_SESSION_DENIED:      'cyrano.layer2.session.denied',

  // ── Cyrano Layer 4 (enterprise multi-tenant Whisper API) ─────────────────
  CYRANO_LAYER4_TENANT_REGISTERED:   'cyrano.layer4.tenant.registered',
  CYRANO_LAYER4_API_KEY_ISSUED:      'cyrano.layer4.api_key.issued',
  CYRANO_LAYER4_API_KEY_REVOKED:     'cyrano.layer4.api_key.revoked',
  CYRANO_LAYER4_PROMPT_GRANTED:      'cyrano.layer4.prompt.granted',
  CYRANO_LAYER4_PROMPT_DENIED:       'cyrano.layer4.prompt.denied',
  CYRANO_LAYER4_RATE_LIMITED:        'cyrano.layer4.rate_limited',
  CYRANO_LAYER4_AUDIT_RECORDED:      'cyrano.layer4.audit.recorded',
  CYRANO_LAYER4_VOICE_SYNTHESIZED:   'cyrano.layer4.voice.synthesized',
  CYRANO_LAYER4_VOICE_SKIPPED:       'cyrano.layer4.voice.skipped',

  // ── Cyrano Translation Layer (Issue #15 — Phase 4) ───────────────────────
  CYRANO_TRANSLATION_REQUESTED:      'cyrano.translation.requested',
  CYRANO_TRANSLATION_COMPLETED:      'cyrano.translation.completed',
  CYRANO_TRANSLATION_SKIPPED:        'cyrano.translation.skipped',
  CYRANO_TRANSLATION_UNSUPPORTED:    'cyrano.translation.unsupported',

  // ── Cyrano Beta Analytics (Issue #16 — Phase 4) ──────────────────────────
  CYRANO_BETA_CREATOR_ENROLLED:      'cyrano.beta.creator.enrolled',
  CYRANO_BETA_CREATOR_REMOVED:       'cyrano.beta.creator.removed',
  CYRANO_BETA_PROMPT_TRACKED:        'cyrano.beta.prompt.tracked',
  CYRANO_BETA_TRANSLATION_TRACKED:   'cyrano.beta.translation.tracked',
  CYRANO_BETA_SUMMARY_EMITTED:       'cyrano.beta.summary.emitted',

  // ── Integration Hub (Business Plan B.3 + B.4 — cross-service wiring) ─────
  HUB_HIGH_HEAT_MONETIZATION:        'hub.high_heat.monetization',
  HUB_PAYOUT_SCALING_APPLIED:        'hub.payout.scaling_applied',
  HUB_DIAMOND_CONCIERGE_HANDOFF:     'hub.diamond_concierge.handoff',

  // ── Creator/Studio Onboarding + Affiliation (RBAC-STUDIO-001) ────────────
  STUDIO_CREATED:                    'studio.created',
  STUDIO_ACTIVATED:                  'studio.activated',
  STUDIO_SUSPENDED:                  'studio.suspended',
  STUDIO_AFFILIATION_GRANTED:        'studio.affiliation.granted',
  STUDIO_AFFILIATION_REVOKED:        'studio.affiliation.revoked',
  STUDIO_CONTRACT_UPLOADED:          'studio.contract.uploaded',
  STUDIO_CONTRACT_SIGNED:            'studio.contract.signed',
  STUDIO_COMMISSION_UPDATED:         'studio.commission.updated',

  AFFILIATION_NUMBER_GENERATED:      'affiliation.number.generated',
  AFFILIATION_NUMBER_DELIVERED:      'affiliation.number.delivered',

  CREATOR_ONBOARDING_STARTED:        'creator.onboarding.started',
  CREATOR_ONBOARDING_AFFILIATED:     'creator.onboarding.affiliated',
  CREATOR_ONBOARDING_COMPLETED:      'creator.onboarding.completed',

  // ── Promotion Engine (PROMO-001) ──────────────────────────────────────────
  PROMO_APPLIED:                     'promo.applied',
  PROMO_EXPIRED:                     'promo.expired',

  // ── Benefit Usage (BENEFITS-001) ─────────────────────────────────────────
  BENEFIT_LIMIT_REACHED:             'benefit.limit.reached',
  BENEFIT_USAGE_INCREMENTED:         'benefit.usage.incremented',
} as const;

export type NatsTopic = typeof NATS_TOPICS[keyof typeof NATS_TOPICS];
