"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BijouSessionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BijouSessionService = void 0;
const common_1 = require("@nestjs/common");
const nats_service_1 = require("../../core-api/src/nats/nats.service");
const topics_registry_1 = require("../../nats/topics.registry");
const governance_config_1 = require("../../core-api/src/config/governance.config");
let BijouSessionService = BijouSessionService_1 = class BijouSessionService {
    constructor(nats) {
        this.nats = nats;
        this.logger = new common_1.Logger(BijouSessionService_1.name);
        this.RULE_ID = 'BIJOU_SESSION_v1';
    }
    admitParticipant(session, user_id, is_host) {
        const vipCount = session.participants.filter(p => !p.is_host).length;
        if (!is_host && vipCount >= governance_config_1.BIJOU_PRICING.MAX_PARTICIPANTS) {
            throw new Error(`SEAT_CAPACITY_FULL: Bijou session ${session.session_id} is at capacity ` +
                `(${governance_config_1.BIJOU_PRICING.MAX_PARTICIPANTS} VIPs).`);
        }
        const now = new Date();
        const graceExpiry = new Date(now.getTime() + governance_config_1.BIJOU_PRICING.CAMERA_GRACE_PERIOD_SEC * 1000);
        const participant = {
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
    evaluateCameraCompliance(session, user_id) {
        const participant = session.participants.find(p => p.user_id === user_id);
        if (!participant)
            throw new Error(`PARTICIPANT_NOT_FOUND: ${user_id}`);
        if (participant.camera_active)
            return { action: 'NONE', participant };
        const now = new Date();
        const graceExpiry = participant.camera_grace_expires_at_utc
            ? new Date(participant.camera_grace_expires_at_utc) : null;
        const warningExpiry = participant.camera_warning_expires_at_utc
            ? new Date(participant.camera_warning_expires_at_utc) : null;
        if (graceExpiry && now < graceExpiry)
            return { action: 'NONE', participant };
        if (!participant.camera_warning_expires_at_utc) {
            const warnExpiry = new Date(now.getTime() + governance_config_1.BIJOU_PRICING.CAMERA_WARNING_PERIOD_SEC * 1000);
            this.nats.publish(topics_registry_1.NATS_TOPICS.BIJOU_CAMERA_VIOLATION, {
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
        if (warningExpiry && now >= warningExpiry) {
            this.nats.publish(topics_registry_1.NATS_TOPICS.BIJOU_EJECTION, {
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
    recordDwellTick(session, user_id) {
        const participant = session.participants.find(p => p.user_id === user_id);
        if (!participant)
            return;
        this.nats.publish(topics_registry_1.NATS_TOPICS.BIJOU_DWELL_TICK, {
            session_id: session.session_id,
            show_id: session.show_id,
            creator_id: session.creator_id,
            user_id,
            tick_secs: 5,
            timestamp_utc: new Date().toISOString(),
            rule_applied_id: this.RULE_ID,
        });
    }
    joinStandby(session, user_id) {
        const alreadyQueued = session.standby_queue.some(e => e.user_id === user_id);
        if (alreadyQueued)
            return session;
        const entry = {
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
    notifyNextStandby(session) {
        const next = session.standby_queue[0];
        if (!next)
            return { session, notified_user_id: null };
        const acceptExpiry = new Date(Date.now() + governance_config_1.BIJOU_PRICING.STANDBY_ACCEPT_WINDOW_SEC * 1000);
        const updatedEntry = {
            ...next,
            notified_at_utc: new Date().toISOString(),
            accept_expires_at_utc: acceptExpiry.toISOString(),
        };
        const updatedQueue = [
            updatedEntry,
            ...session.standby_queue.slice(1),
        ];
        this.nats.publish(topics_registry_1.NATS_TOPICS.BIJOU_STANDBY_ALERT, {
            session_id: session.session_id,
            user_id: next.user_id,
            accept_expires_at_utc: acceptExpiry.toISOString(),
            accept_window_secs: governance_config_1.BIJOU_PRICING.STANDBY_ACCEPT_WINDOW_SEC,
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
};
exports.BijouSessionService = BijouSessionService;
exports.BijouSessionService = BijouSessionService = BijouSessionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nats_service_1.NatsService])
], BijouSessionService);
//# sourceMappingURL=bijou-session.service.js.map