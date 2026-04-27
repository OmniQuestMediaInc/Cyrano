import { NatsService } from '../../core-api/src/nats/nats.service';
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
    max_participants: number;
    participants: BijouParticipant[];
    standby_queue: StandbyEntry[];
    started_at_utc: string;
    ended_at_utc?: string;
    rule_applied_id: string;
}
export declare class BijouSessionService {
    private readonly nats;
    private readonly logger;
    private readonly RULE_ID;
    constructor(nats: NatsService);
    admitParticipant(session: BijouSession, user_id: string, is_host: boolean): BijouSession;
    evaluateCameraCompliance(session: BijouSession, user_id: string): {
        action: 'NONE' | 'WARN' | 'EJECT';
        participant: BijouParticipant;
    };
    recordDwellTick(session: BijouSession, user_id: string): void;
    joinStandby(session: BijouSession, user_id: string): BijouSession;
    notifyNextStandby(session: BijouSession): {
        session: BijouSession;
        notified_user_id: string | null;
    };
}
