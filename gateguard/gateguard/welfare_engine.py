import numpy as np
from typing import Dict, Any


class WelfareGuardianScore:
    def __init__(self):
        self.rule_weights = {
            "velocity_anomaly": 0.25,
            "session_duration": 0.20,
            "heat_intensity": 0.20,
            "chasing_behavior": 0.15,
            "circadian_risk": 0.10,
            "cross_session_trend": 0.10,
        }

    def calculate(self, telemetry: Dict, state_provider=None) -> Dict[str, Any]:
        v_z = abs(telemetry.get("velocity_z", 0))
        duration = telemetry.get("duration", 0)
        heat = telemetry.get("session_heat", 0)
        hour = telemetry.get("hour", 12)

        rules = {
            "velocity_anomaly": min(1.0, v_z / 3.0),
            "session_duration": min(1.0, duration / 180.0),
            "heat_intensity": heat / 100.0,
            "chasing_behavior": 0.0,
            "circadian_risk": 1.0 if hour > 22 or hour < 6 else 0.0,
            "cross_session_trend": (
                0.0
                if not state_provider
                else (100 - state_provider.get_welfare_trend(telemetry.get("user_id", ""))) / 100.0
            ),
        }

        rule_score = sum(rules[k] * self.rule_weights[k] for k in rules)
        welfare_score = min(100.0, rule_score * 100)
        tier = self._get_tier(welfare_score)

        return {"welfare_score": round(welfare_score, 2), "tier": tier}

    def _get_tier(self, score: float) -> str:
        if score >= 85:
            return "critical"
        elif score >= 65:
            return "high"
        elif score >= 40:
            return "medium"
        return "low"
