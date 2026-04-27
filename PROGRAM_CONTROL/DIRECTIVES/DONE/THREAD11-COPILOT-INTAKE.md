# THREAD 11 — COPILOT INTAKE & DIRECTIVE EXECUTION SERIES
# Author: Kevin B. Hartley, CEO — OmniQuest Media Inc.
# Date: 2026-04-17
# Agent: COPILOT (Directives 1) | CLAUDE_CODE (Directives 2–8)
# Repo: OmniQuestMediaInc/ChatNowZone--BUILD
#
# INSTRUCTIONS:
# Execute each directive in sequence. Do not begin the next directive
# until the prior PR is merged to main and report-back is filed.
# All PRs target main. Move this file to DONE on final merge.
# ================================================================

# ================================================================
# DIRECTIVE 1 — GOV-CONST-001-PATCH
# Agent: COPILOT | Branch: chore/gov-const-001-patch
# ================================================================

TASK: Add two null placeholder fields to GovernanceConfig.

FILE: services/core-api/src/config/governance.config.ts

Under FAN_CLUB block, add:
  ANNUAL_DISCOUNT_PCT: null,

Under CREATOR_SAAS block, add:
  ANNUAL_DISCOUNT_PCT: null,

Do not assign a value. Do not touch any other field.

Invariant checks:
  - npx tsc --noEmit zero new errors
  - No other files touched

Commit message:
  CHORE: Add ANNUAL_DISCOUNT_PCT null placeholders to GovernanceConfig

  - FAN_CLUB.ANNUAL_DISCOUNT_PCT: null added
  - CREATOR_SAAS.ANNUAL_DISCOUNT_PCT: null added
  - Resolves open deviation from GOV-CONST-001

  Rule: GOV-CONST-001-PATCH

Create PR targeting main. Merge it.
Report back with commit hash and tsc --noEmit confirmation.
When merged, immediately begin DIRECTIVE 2 below.

# ================================================================
# DIRECTIVE 2 — MEMB-001
# Agent: CLAUDE_CODE | Branch: fiz/memb-001
# Begin only after DIRECTIVE 1 PR is merged to main.
# ================================================================

Context: No server-side zone access enforcement exists. Every protected
endpoint is open. Highest-priority product-surface gap blocking launch.

TASK 1 — Create ZoneAccessService
  Path: services/core-api/src/zone-access/zone-access.service.ts
  - On every protected endpoint call, resolve the requesting user's
    current membership tier (DAY_PASS / ANNUAL / OMNIPASS_PLUS /
    DIAMOND) plus any active ShowZonePass records
  - Check resolved access against ZONE_MAP in GovernanceConfig
  - Return: GRANTED or DENIED with reason_code and rule_applied_id
  - Log every decision via Logger (both GRANTED and DENIED)
  - Throw 403 ForbiddenException with structured payload on DENIED
  - No hardcoded tier or zone values — GovernanceConfig only

TASK 2 — Add ZONE_MAP to GovernanceConfig
  File: services/core-api/src/config/governance.config.ts
  Add ZONE_MAP block. Canonical zone keys:
    CHAT_ZONE, SHOW_THEATRE, BIJOU, PRIVATE_CALL, DIAMOND_CONCIERGE
  Canonical tiers: DAY_PASS, ANNUAL, OMNIPASS_PLUS, DIAMOND
  ShowZonePass overrides tier gate for SHOW_THEATRE and BIJOU.

TASK 3 — Create ZoneAccessGuard
  Implement CanActivate. Apply to all zone-gated route controllers.
  Guard calls ZoneAccessService and blocks on DENIED.

TASK 4 — NATS topic
  File: services/nats/topics.registry.ts
  Register: zone.access.denied → ZONE_ACCESS_DENIED
  Publish on every DENIED decision with user_id, zone, reason_code,
  rule_applied_id, timestamp (America/Toronto).

TASK 5 — Prisma
  Confirm or add ShowZonePass model.
  Required fields: id, user_id, zone (enum), valid_from, valid_until,
  organization_id, tenant_id, created_at.
  Run prisma generate (schema only, no migration).

Invariant checks:
  - No hardcoded zone or tier strings — enums and GovernanceConfig only
  - rule_applied_id on every access decision output
  - organization_id + tenant_id on all Prisma writes
  - Logger on ZoneAccessService and ZoneAccessGuard
  - npx tsc --noEmit zero new errors
  - NATS_TOPICS.* constants only — no raw strings

Commit message (FIZ four-line):
  FIZ: Add ZoneAccessService + Guard — server-side zone enforcement

  - ZoneAccessService: resolves tier + ShowZonePass, checks ZoneMap
  - ZoneAccessGuard: applied to all protected zone endpoints
  - ZONE_MAP in GovernanceConfig; ZONE_ACCESS_DENIED NATS topic
  - Zero new tsc errors

  Rule: MEMB-001

Create PR targeting main. Report back with commit hash, list of
controllers ZoneAccessGuard was applied to, ShowZonePass schema
confirmation, and tsc --noEmit confirmation.
When merged, immediately begin DIRECTIVE 3.

# ================================================================
# DIRECTIVE 3 — MEMB-002
# Agent: CLAUDE_CODE | Branch: fiz/memb-002
# Begin only after DIRECTIVE 2 PR is merged to main.
# ================================================================

Context: ZoneAccessService (MEMB-001) has no durable tier record to
resolve against. This directive builds membership persistence and
the billing foundation.

TASK 1 — MembershipSubscription model (Prisma)
  Add to prisma/schema.prisma:
  Fields: id, user_id, tier (enum: DAY_PASS / ANNUAL /
  OMNIPASS_PLUS / DIAMOND), status (ACTIVE / CANCELLED / EXPIRED /
  GRACE), billing_interval (MONTHLY / QUARTERLY / SEMI_ANNUAL /
  ANNUAL), commitment_months (Int), bonus_months (Int, default 0),
  current_period_start, current_period_end, cancelled_at (nullable),
  organization_id, tenant_id, created_at, updated_at.
  Add unique constraint: one ACTIVE subscription per user.
  Run prisma generate (schema only, no migration).

TASK 2 — MembershipService
  Path: services/core-api/src/membership/membership.service.ts
  Methods:
  - getActiveTier(userId): resolves tier from MembershipSubscription;
    returns DAY_PASS if no active subscription found
  - createSubscription(userId, tier, billingInterval): creates record,
    calculates bonus_months per ADR-003:
      QUARTERLY = 3+1, SEMI_ANNUAL = 6+2, ANNUAL = 12+3
    sets period start/end dates
  - cancelSubscription(userId): sets CANCELLED, retains access
    until current_period_end
  - expireSubscription(subscriptionId): sets EXPIRED, tier resolves
    to DAY_PASS on next getActiveTier call
  Logger on every method. rule_applied_id on every state change.

TASK 3 — Wire ZoneAccessService to MembershipService
  Replace any stub tier resolution in ZoneAccessService with
  MembershipService.getActiveTier(). No other ZoneAccessService changes.

TASK 4 — Duration bonus matrix in GovernanceConfig
  File: services/core-api/src/config/governance.config.ts
  Add MEMBERSHIP.DURATION_BONUS block:
    QUARTERLY:   { commitment_months: 3,  bonus_months: 1 }
    SEMI_ANNUAL: { commitment_months: 6,  bonus_months: 2 }
    ANNUAL:      { commitment_months: 12, bonus_months: 3 }

TASK 5 — NATS topics
  Register in services/nats/topics.registry.ts:
    membership.subscription.created   → MEMBERSHIP_SUBSCRIPTION_CREATED
    membership.subscription.cancelled → MEMBERSHIP_SUBSCRIPTION_CANCELLED
    membership.subscription.expired   → MEMBERSHIP_SUBSCRIPTION_EXPIRED
  Publish on each corresponding MembershipService state change.

Invariant checks:
  - One ACTIVE subscription per user enforced at DB level
  - No hardcoded tier or interval values — GovernanceConfig and enums only
  - organization_id + tenant_id on all Prisma writes
  - Logger + rule_applied_id on all methods
  - npx tsc --noEmit zero new errors

Commit message (FIZ four-line):
  FIZ: Add MembershipSubscription model + MembershipService

  - MembershipSubscription schema: tier, billing, bonus_months
  - MembershipService: getActiveTier / create / cancel / expire
  - Duration bonus matrix in GovernanceConfig (ADR-003)
  - ZoneAccessService wired to MembershipService.getActiveTier

  Rule: MEMB-002

Create PR targeting main. Report back with commit hash, schema diff
summary, tsc confirmation. When merged, immediately begin DIRECTIVE 4.

# ================================================================
# DIRECTIVE 4 — MEMB-003
# Agent: CLAUDE_CODE | Branch: fiz/memb-003
# Begin only after DIRECTIVE 3 PR is merged to main.
# ================================================================

Context: Membership tiers carry monthly CZT stipends. No stipend
distribution job exists.

TASK 1 — Stipend amounts in GovernanceConfig
  File: services/core-api/src/config/governance.config.ts
  Add MEMBERSHIP.STIPEND_CZT block:
    DAY_PASS:     0
    ANNUAL:       100
    OMNIPASS_PLUS: 250
    DIAMOND:      500
  Values are CZT units. Revisable via GOV: commit only.

TASK 2 — StipendDistributionJob
  Path: services/core-api/src/membership/stipend-distribution.job.ts
  - Scheduled: first day of each billing month per subscription
    current_period_start
  - For each ACTIVE subscription where STIPEND_CZT[tier] > 0:
    * Call LedgerService.recordEntry with:
        amount: STIPEND_CZT[tier]
        token_origin: TokenOrigin.GIFTED
        reason_code: 'MONTHLY_STIPEND'
        rule_applied_id: populated
        idempotency_key: subscription_id + billing_period_start (ISO)
        organization_id, tenant_id: from subscription
    * Publish NATS: membership.stipend.distributed
  - On LedgerService error: log and continue; do not halt batch
  - Logger on job start, each grant, each error, job complete

TASK 3 — Idempotency
  Confirm LedgerService supports idempotency_key on recordEntry.
  If not present, add the field and unique DB constraint in this
  directive. Duplicate key must be rejected — no double-grant.

TASK 4 — NATS topic
  Register: membership.stipend.distributed → MEMBERSHIP_STIPEND_DISTRIBUTED

Invariant checks:
  - Append-only ledger — no UPDATE on ledger rows
  - token_origin: GIFTED on all stipend entries
  - idempotency_key prevents double-grant
  - rule_applied_id on every ledger entry
  - organization_id + tenant_id on all Prisma writes
  - npx tsc --noEmit zero new errors

Commit message (FIZ four-line):
  FIZ: Add StipendDistributionJob — monthly CZT grant per tier

  - StipendDistributionJob: scheduled, idempotent, GIFTED origin
  - MEMBERSHIP.STIPEND_CZT constants in GovernanceConfig
  - MEMBERSHIP_STIPEND_DISTRIBUTED NATS topic registered
  - LedgerService idempotency_key confirmed or added

  Rule: MEMB-003

Create PR targeting main. Report back with commit hash, idempotency
approach confirmed, tsc confirmation.
When merged, immediately begin DIRECTIVE 5.

# ================================================================
# DIRECTIVE 5 — BJ-002
# Agent: CLAUDE_CODE | Branch: bijou/bj-002
# Begin only after DIRECTIVE 4 PR is merged to main.
# ================================================================

Context: Bijou Scheduler is absent. Bijou rooms require 15-minute
rolling schedule slots, velocity rules, and a 24-VIP cap.

TASK 1 — BijouSession model (Prisma)
  Confirm or create in prisma/schema.prisma:
  Fields: id, creator_id, scheduled_start, scheduled_end,
  capacity (max 24), status (SCHEDULED / OPEN / CLOSED / CANCELLED),
  organization_id, tenant_id, created_at, updated_at.
  Add index on (status, scheduled_start).
  Run prisma generate (schema only, no migration).

TASK 2 — BijouSchedulerService
  Path: services/bijou/src/bijou-scheduler.service.ts
  (locate existing bijou package path and use it)
  Methods:
  - createSession(creatorId, scheduledStart):
    * Validate 15-minute boundary alignment (:00/:15/:30/:45)
    * Throw if not aligned
    * Velocity rule: creator may not have more than
      BIJOU.MAX_SESSIONS_PER_HOUR sessions in any rolling 60-min window
    * Throw 429-equivalent domain error on violation
  - cancelSession(sessionId): sets CANCELLED; publishes NATS event
  - openSession(sessionId): sets OPEN; publishes NATS event
  - closeSession(sessionId): sets CLOSED; publishes NATS event
  Logger on all methods. rule_applied_id on all state changes.

TASK 3 — GovernanceConfig BIJOU block
  File: services/core-api/src/governance/governance.config.ts
  Add BIJOU block:
    MAX_CAPACITY: 24
    SESSION_DURATION_MINUTES: 60
    SCHEDULE_SLOT_MINUTES: 15
    MAX_SESSIONS_PER_HOUR: 2

TASK 4 — NATS topics
  Register in services/nats/topics.registry.ts:
    bijou.session.scheduled → BIJOU_SESSION_SCHEDULED
    bijou.session.opened    → BIJOU_SESSION_OPENED
    bijou.session.closed    → BIJOU_SESSION_CLOSED
    bijou.session.cancelled → BIJOU_SESSION_CANCELLED

Invariant checks:
  - No hardcoded Bijou constants — GovernanceConfig BIJOU block only
  - rule_applied_id on every session state change
  - organization_id + tenant_id on all Prisma writes
  - Logger on BijouSchedulerService
  - npx tsc --noEmit zero new errors
  - NATS_TOPICS.* constants only

Commit message:
  BIJOU: Add BijouSchedulerService + BijouSession model

  - BijouSession schema: capacity 24, 15-min slot alignment enforced
  - BijouSchedulerService: create/open/close/cancel + velocity rule
  - BIJOU GovernanceConfig block; four NATS session topics registered
  - Zero new tsc errors

  Rule: BJ-002

Create PR targeting main. Report back with commit hash, velocity rule
logic described, tsc confirmation.
When merged, immediately begin DIRECTIVE 6.

# ================================================================
# DIRECTIVE 6 — BJ-003
# Agent: CLAUDE_CODE | Branch: bijou/bj-003
# Begin only after DIRECTIVE 5 PR is merged to main.
# ================================================================

Context: Bijou Admission queue. Guests request entry; the queue manages
the 10-second accept window, standby, 30-second camera grace, and
ejection. Depends on BijouSession from BJ-002.

TASK 1 — BijouAdmission model (Prisma)
  Fields: id, session_id, user_id, status (PENDING / ADMITTED /
  STANDBY / EJECTED / ABANDONED), admitted_at (nullable),
  camera_grace_deadline (nullable), organization_id, tenant_id,
  created_at, updated_at.
  Unique constraint: one non-EJECTED/ABANDONED record per
  (session_id, user_id).
  Run prisma generate (schema only, no migration).

TASK 2 — BijouAdmissionService
  Path: services/bijou/src/bijou-admission.service.ts
  Methods:
  - requestAdmission(sessionId, userId):
    * If session at capacity: place on STANDBY; publish
      bijou.admission.standby
    * If seat available: set PENDING with 10s server-side accept
      window; publish bijou.admission.offered
  - acceptAdmission(admissionId, userId):
    * Must be called within BIJOU.ADMIT_ACCEPT_WINDOW_SECONDS of
      PENDING; else auto-ABANDONED
    * On accept: set ADMITTED, set camera_grace_deadline =
      now + BIJOU.CAMERA_GRACE_SECONDS
    * Publish bijou.admission.admitted
  - confirmCamera(admissionId): clears ejection risk
  - enforceCamera(admissionId):
    * Called at camera_grace_deadline
    * If camera not confirmed: set EJECTED; publish
      bijou.admission.ejected
    * Promote next STANDBY to PENDING (FIFO)
  Logger + rule_applied_id on all state transitions.

TASK 3 — Server-side timers
  10s accept window and 30s camera grace must be enforced server-side
  (scheduled job or delayed NATS message) — not client-side timers.
  On ABANDONED: promote next STANDBY to PENDING (FIFO).

TASK 4 — GovernanceConfig additions (BIJOU block from BJ-002)
  Add:
    ADMIT_ACCEPT_WINDOW_SECONDS: 10
    CAMERA_GRACE_SECONDS: 30

TASK 5 — NATS topics
  Register:
    bijou.admission.offered   → BIJOU_ADMISSION_OFFERED
    bijou.admission.admitted  → BIJOU_ADMISSION_ADMITTED
    bijou.admission.standby   → BIJOU_ADMISSION_STANDBY
    bijou.admission.ejected   → BIJOU_ADMISSION_EJECTED
    bijou.admission.abandoned → BIJOU_ADMISSION_ABANDONED

Invariant checks:
  - MAX_CAPACITY from GovernanceConfig BIJOU block — no hardcoded 24
  - CAMERA_GRACE_SECONDS and ADMIT_ACCEPT_WINDOW_SECONDS from
    GovernanceConfig — no hardcoded values
  - rule_applied_id on all state transitions
  - organization_id + tenant_id on all Prisma writes
  - Logger on BijouAdmissionService
  - npx tsc --noEmit zero new errors

Commit message:
  BIJOU: Add BijouAdmissionService + admission queue

  - BijouAdmission schema: standby, grace, ejection states
  - 10s accept window + 30s camera grace enforced server-side
  - Standby FIFO promotion on abandon or ejection
  - Five admission NATS topics registered

  Rule: BJ-003

Create PR targeting main. Report back with commit hash, standby
promotion mechanism described, tsc confirmation.
When merged, immediately begin DIRECTIVE 7.

# ================================================================
# DIRECTIVE 7 — BJ-004
# Agent: CLAUDE_CODE | Branch: bijou/bj-004
# Begin only after DIRECTIVE 6 PR is merged to main.
# ================================================================

Context: Bijou dwell-credit algorithm. Admitted guests earn CZT based
on dwell time using a 65/35 creator/platform split.
Depends on BijouSession (BJ-002) and BijouAdmission (BJ-003).

TASK 1 — DwellLog model (Prisma)
  Fields: id, admission_id, session_id, user_id, dwell_seconds (Int),
  czt_credited (Int), payout_czt (Int), platform_czt (Int),
  organization_id, tenant_id, created_at.
  Append-only — no UPDATE or DELETE permitted.
  Run prisma generate (schema only, no migration).

TASK 2 — CreatorDwellAccrual model (Prisma)
  Fields: id, creator_id, session_id, payout_czt (Int),
  settled (Boolean, default false), organization_id, tenant_id,
  created_at.
  Append-only.

TASK 3 — BijouDwellService
  Path: services/bijou/src/bijou-dwell.service.ts
  Subscribe to NATS: BIJOU_SESSION_CLOSED
  On each closed session, for every ADMITTED record:
    dwell_seconds = admitted_at → session close
    czt_credited  = floor(dwell_seconds / DWELL_CREDIT_INTERVAL_SECONDS)
                    * DWELL_CREDIT_PER_INTERVAL
    payout_czt    = floor(czt_credited * BIJOU_CREATOR_SPLIT)
    platform_czt  = czt_credited - payout_czt
    Write DwellLog (append-only)
    Call LedgerService.recordEntry:
      amount: czt_credited
      token_origin: TokenOrigin.GIFTED
      reason_code: 'BIJOU_DWELL_CREDIT'
      rule_applied_id: populated
      idempotency_key: admission_id + session_id
    Write CreatorDwellAccrual with payout_czt (settled: false)
    Publish NATS: bijou.dwell.credited
  On error per record: log and continue; do not halt batch.
  Creator payout settlement is out of scope for this directive.

TASK 4 — GovernanceConfig additions (BIJOU block)
  Add:
    DWELL_CREDIT_INTERVAL_SECONDS: 60
    DWELL_CREDIT_PER_INTERVAL: 5
    BIJOU_CREATOR_SPLIT: 0.65

TASK 5 — NATS topic
  Register: bijou.dwell.credited → BIJOU_DWELL_CREDITED

Invariant checks:
  - Append-only: no UPDATE/DELETE on DwellLog or LedgerEntry
  - idempotency_key: admission_id + session_id prevents double-credit
  - token_origin: GIFTED on all guest dwell credits
  - All split constants from GovernanceConfig BIJOU block
  - rule_applied_id on every ledger entry
  - organization_id + tenant_id on all Prisma writes
  - npx tsc --noEmit zero new errors

Commit message:
  BIJOU: Add BijouDwellService + dwell-credit algorithm

  - DwellLog + CreatorDwellAccrual schemas (append-only)
  - 65/35 dwell-credit split; guest credited GIFTED CZT on close
  - Creator payout staged to CreatorDwellAccrual (not settled here)
  - BIJOU_DWELL_CREDITED NATS topic; idempotent on admission+session

  Rule: BJ-004

Create PR targeting main. Report back with commit hash, dwell formula
confirmed, creator accrual staging confirmed, tsc confirmation.
When merged, immediately begin DIRECTIVE 8.

# ================================================================
# DIRECTIVE 8 — OBS-001
# Agent: CLAUDE_CODE | Branch: obs/obs-001
# XL effort. Begin only after DIRECTIVE 7 PR is merged to main.
# ================================================================

Context: OBS Bridge, Chat Aggregator, and Persona Engine are entirely
absent. This directive builds the foundational layer only.
OBS-002 through OBS-008 follow in the next series.

--- COMPONENT A: OBS BRIDGE ---

TASK 1 — OBS Bridge Service
  Path: services/obs-bridge/src/obs-bridge.service.ts
  (create obs-bridge package if it does not exist)
  - Accepts RTMP ingest from OBS client or native browser stream
  - Validates stream key against creator record
  - Stream key stored as SHA-256 hash — never plaintext
  - Publishes NATS: obs.stream.started on connect
  - Publishes NATS: obs.stream.ended on disconnect
  - Logger on connect, disconnect, validation failures

TASK 2 — Stream key management
  Add stream_key_hash (String, unique) to Creator model in Prisma
  (confirm or add). Add regenerateStreamKey(creatorId) method.
  Regeneration publishes NATS: obs.stream.key.rotated.
  Run prisma generate if schema changed.

--- COMPONENT B: CHAT AGGREGATOR ---

TASK 3 — ChatAggregatorService
  Path: services/obs-bridge/src/chat-aggregator.service.ts
  - Implement internal CNZ chat source only (external connectors
    are OBS-003)
  - Normalise each message to ChatMessage type:
    { id, source, creator_id, user_id, content, timestamp,
      platform_user_id, organization_id, tenant_id }
  - Publish NATS: chat.message.ingested per message
  - Apply variable jitter delay before each publish:
    random delay between OBS.CHAT_JITTER_MIN_MS and
    OBS.CHAT_JITTER_MAX_MS (read from GovernanceConfig)
  - Logger on each ingested message (info level)

--- COMPONENT C: PERSONA ENGINE FOUNDATION ---

TASK 4 — PersonaEngineService
  Path: services/obs-bridge/src/persona-engine.service.ts
  - Subscribe to NATS: CHAT_MESSAGE_INGESTED
  - Check CREATOR_AUTO flag on creator record:
    * CREATOR_AUTO = false: no auto-response generated
    * CREATOR_AUTO = true: apply Bill 149 (ON) disclosure prefix
      from GovernanceConfig OBS.BILL_149_DISCLOSURE_PREFIX to any
      generated response before publishing
  - Rule-based pass only in this directive — no AI call (OBS-004)
  - Publish NATS: persona.response.queued when response generated
  - rule_applied_id required on every persona.response.queued event
  - Logger on all decisions

TASK 5 — GovernanceConfig OBS block
  File: services/core-api/src/config/governance.config.ts
  Add OBS block:
    CHAT_JITTER_MIN_MS: 150
    CHAT_JITTER_MAX_MS: 450
    BILL_149_DISCLOSURE_PREFIX: 'This message was generated with AI assistance. '

TASK 6 — CREATOR_AUTO flag
  Confirm or add creator_auto (Boolean, default false) to Creator
  model in Prisma. Run prisma generate if added.

TASK 7 — NATS topics
  Register in services/nats/topics.registry.ts:
    obs.stream.started      → OBS_STREAM_STARTED
    obs.stream.ended        → OBS_STREAM_ENDED
    obs.stream.key.rotated  → OBS_STREAM_KEY_ROTATED
    chat.message.ingested   → CHAT_MESSAGE_INGESTED
    persona.response.queued → PERSONA_RESPONSE_QUEUED

Invariant checks:
  - Stream key stored as SHA-256 hash — never plaintext
  - Bill 149 prefix on all CREATOR_AUTO=true outputs — from
    GovernanceConfig only, never hardcoded
  - Jitter bounds from GovernanceConfig OBS block
  - rule_applied_id on all persona.response.queued events
  - Logger on all three services
  - organization_id + tenant_id on all Prisma writes
  - npx tsc --noEmit zero new errors
  - NATS_TOPICS.* constants only

Commit message:
  OBS: Add OBS Bridge + Chat Aggregator + Persona Engine foundation

  - OBSBridgeService: RTMP ingest, stream key SHA-256, NATS events
  - ChatAggregatorService: CNZ source, ChatMessage, jitter delivery
  - PersonaEngineService: CREATOR_AUTO gate, Bill 149 prefix
  - OBS GovernanceConfig block; 5 NATS topics registered
  - Zero new tsc errors

  Rule: OBS-001

Create PR targeting main. Report back with:
  - Commit hash
  - Stream key confirmed stored as hash (not plaintext)
  - CREATOR_AUTO flag location in schema confirmed
  - tsc --noEmit confirmation
Move this file (THREAD11-COPILOT-INTAKE.md) to
PROGRAM_CONTROL/DIRECTIVES/DONE/ on this final merge.

# ================================================================
# END OF SERIES — Thread 11 | Directives 1–8
# Next series (OBS-002–OBS-008, HZ-001, MEMB-004+) authored after
# this series clears.
# Authority: Kevin B. Hartley, CEO — OmniQuest Media Inc.
# ================================================================
