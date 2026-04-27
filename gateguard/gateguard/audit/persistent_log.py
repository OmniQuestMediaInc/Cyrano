import sqlite3
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any


class AuditLog:
    def __init__(self, db_path: str = "gateguard_audit.db"):
        self.conn = sqlite3.connect(db_path)
        self.conn.execute(
            """CREATE TABLE IF NOT EXISTS decisions (
            decision_id TEXT PRIMARY KEY,
            timestamp TEXT,
            user_id TEXT,
            amount REAL,
            telemetry TEXT,
            welfare_score REAL,
            chargeback_proxy REAL,
            tier TEXT,
            action TEXT,
            prior_hash TEXT,
            row_hash TEXT
        )"""
        )
        self.conn.commit()

    def log_decision(self, decision: Dict[str, Any]) -> str:
        decision_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        prior_hash = "genesis"  # simplified for prototype
        telemetry_str = json.dumps(decision, sort_keys=True)
        row_data = (
            f"{decision_id}{timestamp}{decision.get('user_id')}"
            f"{decision.get('amount')}{telemetry_str}"
        )
        row_hash = hashlib.sha256(row_data.encode()).hexdigest()

        self.conn.execute(
            "INSERT INTO decisions VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                decision_id,
                timestamp,
                decision.get("user_id"),
                decision.get("amount", 0),
                telemetry_str,
                decision.get("welfare_score", 0),
                decision.get("chargeback_proxy", 0),
                decision.get("tier", ""),
                decision.get("action", ""),
                prior_hash,
                row_hash,
            ),
        )
        self.conn.commit()
        return decision_id
