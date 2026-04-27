import pytest
from gateguard.decision_combiner import GateGuardDecision
from gateguard.state_provider import StateProvider


def test_approve_low_risk():
    engine = GateGuardDecision()
    telemetry = {"user_id": "guest_001", "amount": 10.0, "session_heat": 10,
                 "velocity_z": 0.1, "duration": 5, "hour": 14}
    result = engine.make_decision(telemetry)
    assert result["action"] == "APPROVE"
    assert result["tier"] == "low"


def test_high_risk_triggers_cooling():
    engine = GateGuardDecision()
    telemetry = {"user_id": "guest_002", "amount": 200.0, "session_heat": 80,
                 "velocity_z": 2.5, "duration": 120, "hour": 14}
    result = engine.make_decision(telemetry)
    assert result["action"] in ("COOLING_PERIOD_5MIN", "HCZ_ESCALATION", "SOFT_NUDGE")


def test_cooling_period_blocks():
    state = StateProvider()
    state.set_cooling_period("guest_003", hours=24)
    engine = GateGuardDecision()
    telemetry = {"user_id": "guest_003", "amount": 50.0, "session_heat": 20,
                 "velocity_z": 0.5, "duration": 10, "hour": 10}
    result = engine.make_decision(telemetry, state_provider=state)
    assert result["action"] == "COOLING_PERIOD_24H"
    assert result["tier"] == "blocked"


def test_critical_risk_triggers_hcz():
    # cross_session_trend requires >=3 history entries with low welfare scores
    # to push total score into critical tier (>=85)
    state = StateProvider()
    for _ in range(3):
        state.record_welfare_score("guest_004", 0.0)  # trend=0 → cross_session_trend=1.0
    engine = GateGuardDecision()
    telemetry = {"user_id": "guest_004", "amount": 500.0, "session_heat": 100,
                 "velocity_z": 3.0, "duration": 180, "hour": 2}
    result = engine.make_decision(telemetry, state_provider=state)
    assert result["action"] == "HCZ_ESCALATION"
    assert result["tier"] == "critical"
