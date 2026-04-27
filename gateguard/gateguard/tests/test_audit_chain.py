import os
import pytest
from gateguard.audit.persistent_log import AuditLog


@pytest.fixture
def audit(tmp_path):
    db = str(tmp_path / "test_audit.db")
    return AuditLog(db_path=db)


def test_log_returns_id(audit):
    decision = {"user_id": "guest_001", "amount": 49.99, "welfare_score": 35.0,
                "chargeback_proxy": 26.3, "tier": "low", "action": "APPROVE"}
    decision_id = audit.log_decision(decision)
    assert len(decision_id) == 36  # UUID4 length


def test_log_persists_row(audit):
    decision = {"user_id": "guest_002", "amount": 100.0, "welfare_score": 70.0,
                "chargeback_proxy": 55.0, "tier": "high", "action": "COOLING_PERIOD_5MIN"}
    audit.log_decision(decision)
    cursor = audit.conn.execute("SELECT COUNT(*) FROM decisions")
    count = cursor.fetchone()[0]
    assert count == 1


def test_row_hash_is_sha256(audit):
    decision = {"user_id": "guest_003", "amount": 200.0, "welfare_score": 90.0,
                "chargeback_proxy": 80.0, "tier": "critical", "action": "HCZ_ESCALATION"}
    audit.log_decision(decision)
    cursor = audit.conn.execute("SELECT row_hash FROM decisions")
    row_hash = cursor.fetchone()[0]
    assert len(row_hash) == 64  # SHA-256 hex digest length
