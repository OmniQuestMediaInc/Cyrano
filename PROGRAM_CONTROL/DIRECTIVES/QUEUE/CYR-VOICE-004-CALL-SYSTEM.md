# DIRECTIVE: CYR-VOICE-004-CALL-SYSTEM

**Status:** `QUEUED`
**Commit prefix:** `CYR:`
**Depends on:** CYR-CORE-001-PROVIDER-RELIABILITY,
CYR-NARR-002-LAYER2-MEMORY
**Target paths:**

- `services/voice-cloning/src/voice-session.service.ts` (CREATE)
- `services/voice-cloning/src/voice.service.ts` (UPDATE — streaming TTS
  via ElevenLabs WebSocket)
- `apps/cyrano-standalone/src/app/call/[twinId]/*` (CREATE — call UI)
- `services/voice-cloning/src/call-quality.monitor.ts` (CREATE)

**Risk class:** R2 (real-time + privacy + paid path)

## Context

Voice cloning is scaffolded; voice CALLING (real-time bidirectional with
the cloned voice + narrative memory + GateGuard moderation in-line) is
not. This is the second headline Cyrano experience after the AI Twin
Creator.

## Tasks

1. **VoiceSessionService:**
   - `startSession({ user_id, twin_id, voice_clone_id, consent })`
     creates a DB-backed `CallSession` row (already in schema, append-only
     with `correlation_id`).
   - REQUIRED: explicit recording consent prompt before session start;
     persist consent fingerprint on the session row.
   - On every TTS turn: pull narrative context via Layer 2
     ContextBuilder; pre-flight ledger debit per minute; stream audio.
   - On every STT turn: pass user transcript through GateGuard
     `analyzeText()`; halt on policy violation.
   - `endSession()` writes session totals (minutes, characters, debit).

2. **Streaming TTS** — switch from current request/response to
   ElevenLabs WebSocket streaming for sub-second first-token latency.

3. **Call UI** at `apps/cyrano-standalone/src/app/call/[twinId]/`:
   - Pre-call consent screen (recording? memory write? policy disclosure).
   - WebRTC mic → STT → narrative → TTS → speaker.
   - Real-time waveform + transcript.
   - "Switch to text" button that gracefully degrades when audio quality
     drops below threshold.

4. **CallQualityMonitor:**
   - Watches packet loss + jitter + first-token latency.
   - Fires `cyrano.voice.call.quality.degraded` NATS event on threshold
     breach; UI hooks into the event and offers fallback.

5. **Privacy:**
   - Audio recordings encrypted at rest, key per session, retention 30 days
     unless user opts in to extended retention.
   - PII redaction on transcripts before they hit MemoryBank.

## Validation

- New unit specs for `voice-session.service` (consent guard, ledger
  pre-flight, narrative context injection).
- New integration spec: round-trip mock STT → narrative → mock TTS yields
  expected ledger debits + memory writes.
- Call quality fallback verified by simulated jitter.
- `yarn typecheck && yarn lint && yarn test` clean.

## Report-back file

`PROGRAM_CONTROL/REPORT_BACK/CYR-VOICE-004-CALL-SYSTEM.md`
