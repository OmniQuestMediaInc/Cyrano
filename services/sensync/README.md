# SenSync™ Biometric Layer

**Service prefix:** `HZ:` (HeartZone domain)
**Tier gate:** VIP_DIAMOND (hardware bridges); any tier with consent (PHONE_HAPTIC)
**Compliance:** Quebec Law 25, PIPEDA, GDPR Art. 17 (right to erasure)

## Overview

SenSync™ is the biometric data pipeline for ChatNow.Zone. It accepts
raw BPM samples (`bpm_raw`) from hardware bridges (Lovense SDK, WebUSB, Web
Bluetooth), applies a plausibility filter [30–220 BPM], normalizes the value
internally (passthrough today — smoothing/filtering extension point), and
publishes the result to the NATS `sensync.biometric.data` topic
for consumption by the FFS (FairPlay/FairPay Scoring) engine.

Consent is stored persistently in Postgres (`sensync_consents`) to satisfy
Law 25 audit requirements. A two-phase purge flow satisfies the right-to-
erasure obligation.

## NATS Topics

| Topic | Description |
|-------|-------------|
| `sensync.consent.granted` | Guest granted biometric consent |
| `sensync.consent.revoked` | Guest revoked biometric consent |
| `sensync.biometric.data` | Normalized BPM payload (opt-in only) |
| `sensync.plausibility.rejected` | BPM outside [30..220] range |
| `sensync.tier.disabled` | Non-Diamond tier attempted hardware session |
| `sensync.purge.requested` | Law 25 deletion request received |
| `sensync.purge.completed` | Purge job completed data minimization |
| `sensync.hardware.connected` | Hardware bridge connected |
| `sensync.hardware.disconnected` | Hardware bridge disconnected |

## Hardware Bridges

| Bridge | Description |
|--------|-------------|
| `LOVENSE` | Lovense SDK (primary partner) |
| `WEB_USB` | Generic WebUSB HID device |
| `WEB_BLUETOOTH` | Generic GATT Heart Rate Profile (0x180D) |
| `PHONE_HAPTIC` | Mobile fallback — no BPM hardware required |

## Non-Adult Extension Points

The `domain` field on every consent record and biometric payload enables
domain-specific Cyrano™ prompt template routing:

- `ADULT_ENTERTAINMENT` (default)
- `TEACHING`
- `COACHING`
- `FIRST_RESPONDER`
- `FACTORY_SAFETY`
- `MEDICAL`

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sensync/sessions` | Open a SenSync session |
| DELETE | `/sensync/sessions/:id` | Close a session |
| GET | `/sensync/sessions/:id` | Get session state |
| POST | `/sensync/consent/grant` | Grant biometric consent |
| POST | `/sensync/consent/revoke` | Revoke biometric consent |
| POST | `/sensync/samples` | Submit a BPM sample |
| POST | `/sensync/hardware-events` | Record hardware lifecycle event |
| POST | `/sensync/purge/request` | Request Law 25 data purge |
| POST | `/sensync/purge/complete` | Mark purge complete (worker only) |
