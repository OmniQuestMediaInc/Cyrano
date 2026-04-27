# Feature flags — services/gamification

| Flag                                  | Default | Effect                                                       |
| ------------------------------------- | ------- | ------------------------------------------------------------ |
| `GAMIFICATION_ENABLED`                | `true`  | Master kill-switch for the entire `/games` REST surface.     |
| `GAMIFICATION_RRR_BURN_ENABLED`       | `true`  | Permits paying for plays via burned RRR points.              |
| `GAMIFICATION_MOUSE_SHAKE_REQUIRED`   | `true`  | Requires client-side mouse-shake proof on every play.        |
| `GAMIFICATION_CAPTCHA_ON_SUSPICIOUS`  | `true`  | Enforces CAPTCHA after rate-limit threshold per session.     |
| `GAMIFICATION_ANALYTICS_ENABLED`      | `true`  | Enables creator analytics endpoint.                          |

Flags are evaluated lazily at request time via `process.env`, never cached.
