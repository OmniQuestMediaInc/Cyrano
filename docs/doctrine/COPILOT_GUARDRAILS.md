### SECTION 4: THE REFLECTION PROTOCOL (OQMI-RP-v1)

**Requirement:** Before finalizing any code change or committing to `main`, the Agent must execute this 4-point self-audit to ensure the integrity of the ChatNow.Zone financial and operational layers.

---

#### 1. The Append-Only Invariant
- **Check:** Does this code attempt to `UPDATE` or `DELETE` a record in the `ledger_entries` or `finance_snapshots` tables?
- **Correction:** If yes, refactor the logic to use an **Offset Entry** (for ledger) or a **New Version** (for snapshots). The source of truth must remain immutable.

#### 2. The Dependency Verification
- **Check:** Are there any hardcoded financial constants (e.g., 0.065, 0.125) or time-based integers?
- **Correction:** All such values MUST be imported from `GovernanceConfigService`. If a required constant is missing, the Agent must update the Config service first before proceeding.

#### 3. The Audit Trail Mandate
- **Check:** Does this function change the state of an entity (User, Event, Transaction)?
- **Correction:** Every state change must be accompanied by an `audit_events` emission containing the `prev_state`, `new_state`, `reason_code`, and `correlation_id`.

#### 4. The Temporal Truth Check
- **Check:** Is `new Date()` being used for business-critical logic (payout windows, grace periods, T-Minus calculations)?
- **Correction:** Business logic must utilize the `America/Toronto` timezone context as defined in the `GovernanceConfigService` to ensure deterministic execution across all server nodes.

---

**Protocol Execution Status:** [ ] AUDIT PASSED | [ ] REPAIRS APPLIED
