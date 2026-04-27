# SenSync™ Service — Assumptions

1. **Diamond-tier gate**: Only VIP_DIAMOND sessions may connect hardware
   bridges (Lovense SDK, WebUSB, WebBluetooth). Lower tiers receive a
   TIER_SENSYNC_HARDWARE_DISABLED rejection. PHONE_HAPTIC (no actual
   BPM hardware) is available to any tier with consent.

2. **Consent is persisted**: Unlike HeartSync (in-memory only), SenSync
   writes every consent grant/revocation to the `sensync_consents` Postgres
   table. This satisfies Law 25 audit requirements.

3. **FFS integration is opt-in**: `sensync.biometric.data` NATS events are
   only published when the guest has an active, non-revoked consent. The FFS
   scoring service subscribes independently; SenSync has no direct FFS
   dependency.

4. **BPM normalization is a passthrough**: In v1 the `bpm_normalized` value
   equals `bpm_raw` (after plausibility filter). A future smoothing/filtering
   pass (EMA, Kalman) may be added as a pure extension at the
   `bpm_normalized` assignment line in `submitSample`.

5. **Purge is two-phase**: `requestPurge` stamps `purge_requested_at` and
   fires the NATS event. An async purge worker (separate service or cron)
   listens on `SENSYNC_PURGE_REQUESTED`, nullifies `ip_hash` and
   `device_fingerprint`, and calls `completePurge` to stamp
   `purge_completed_at`. The split ensures deletion is auditable.

6. **Non-adult domains**: `domain` is carried on every consent row and
   biometric payload. Cyrano prompt templates are domain-aware; the
   SenSync service itself is domain-agnostic.

7. **No raw IP storage**: `ip_hash` is always a SHA-256 hex digest of the
   guest's IP address. Raw IPs are never stored.
