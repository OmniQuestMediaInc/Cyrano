# Cyrano — ASSUMPTIONS.md

## A001 — In-Process Memory Only (Layer 1)
`SessionMemoryStore` is an in-process Map. A process restart clears all
facts and arcs. Layer 2 will introduce a Prisma-backed persistent store.
Callers must accept the possibility of a cold-memory start after restart.

## A002 — One Active Persona Per Session
`PersonaManager` enforces a single active persona per `session_id`.
Activating a new persona for the same session overwrites the prior
activation. Personas must be registered via `PersonaManager.register()`
before they can be activated.

## A003 — Suggestion Copy Is Template-Based (Layer 1)
`buildCopy()` returns short template strings parameterised by category
and heat tier. Layer 2 will replace this with LLM-generated copy refined
by persona tone and guest history.

## A004 — Latency Measured from Frame Receipt
`latency_ms` in each `CyranoSuggestion` measures time from
`frame.captured_at_utc` to emit. Clock skew between the calling service
and the Cyrano process is not corrected.

## A005 — No Guest Visibility Guarantee
Cyrano enforces invisibility by design: suggestions are published to
`CYRANO_SUGGESTION_EMITTED` only. The creator panel consumes this topic.
Cyrano itself does not control UI rendering — the panel must never expose
suggestions to the guest-facing stream.

## A006 — Heat Tier Is Caller-Provided
Cyrano does not subscribe to Flicker n'Flame Scoring directly. The `CyranoInputFrame`
must include a valid `heat` object. In production, the Integration Hub
composes the frame from Flicker n'Flame Scoring snapshots and session telemetry.

## A007 — Category Weight Matrix Is Static
`CATEGORY_TIER_WEIGHTS` is a compile-time constant. Retuning requires a
code change and redeploy. A future governance-controlled config table
will allow runtime adjustment without redeploy.

## A008 — Layer 4 Tenant + API Key Storage Is In-Process
`CyranoLayer4TenantStore`, `CyranoLayer4ApiKeyService`, and
`CyranoLayer4AuditService` keep their state in process-local Maps.
A restart loses every tenant, key, and audit record. Phase-2 swaps in
Prisma persistence behind the same TypeScript interfaces — the
controller / guard / enterprise service contracts do not change.

## A009 — Layer 4 API Key Hash Is SHA-256 (not Argon2 / bcrypt)
Phase 0 uses SHA-256 (no salt, no work factor) for deterministic and
dependency-free hashing. Raw keys are NEVER persisted; only hashes +
8-character key prefixes. Phase 2 swaps in Argon2id behind the same
public surface (`mint`, `verify`, `revoke`).

## A010 — Layer 4 Voice Synthesis URI Is A Placeholder
`CyranoLayer4VoiceBridge` returns a deterministic
`cyrano-l4://voice/{tenant_id}/{request_id}` URI. The actual TTS provider
integration is wired by the platform voice service team; the bridge is
contract-correct (NATS topic, envelope shape, consent gating, domain
default voice profile) so the swap is opaque to callers.

## A011 — Layer 4 Audit Chain Is In-Memory Hash Chain
`CyranoLayer4AuditService.verifyChain()` walks the in-process records
and replays the SHA-256 chain. Phase 2 wires this through
`ImmutableAuditService` for cross-service WORM sealing; the chain
guarantees (append-only, hash-linked, idempotent on correlation_id)
are identical between the two implementations.

## A012 — Layer 4 Rate Limiter Is Process-Local
The fixed-window per-tenant limiter and 1-second per-key burst
limiter use process-local Maps. Multi-replica deployments need a
shared Redis-backed limiter (planned for Phase 2). The
`consume()` method shape stays identical so callers do not change.

## A013 — Layer 4 Admin Endpoints Have No Built-In Guard
`/cyrano/layer4/tenants*` and `/cyrano/layer4/tenants/*/keys*` and
`/cyrano/layer4/tenants/*/audit` are unguarded by Layer 4 itself —
they are intended to be mounted behind the platform admin guard chain
(`RbacGuard` + `StepUpGuard`). Only `/cyrano/layer4/prompt` carries the
Layer 4 self-guard, since it is the public tenant surface.
