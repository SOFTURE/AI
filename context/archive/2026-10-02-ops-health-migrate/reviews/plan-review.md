# Plan review: ops-health-migrate

Reviewed: plan.md @ 2026-10-02 (author's check against change.md, research.md, docs/02 and
AGENTS.md). Verdict: approve. Findings: 0 critical, 2 warning, 1 suggestion.

## Findings

### W1 [WARNING] Default privileges cover only objects the migrator creates from now on
**Where:** Approach, Roles
**Problem:** a database migrated earlier by the superuser (every existing app) leaves the app role
without grants on the existing schemas and tables; the app would fail on its first query.
**Decision:** Fix now (applied) - the recipe documents the one-time grants for an existing
database and the ownership transfer (`REASSIGN OWNED`), and the roles file grants on existing
objects too.

### W2 [WARNING] The health route mounted without `ops()` in the config
**Where:** Phase 1, route
**Problem:** silently answering 200 would hide a setup bug; answering 503 would restart a
healthy container forever without saying why.
**Decision:** Fix now (applied) - the route throws with a message naming the fix; Next answers 500
and logs it, which an orchestrator also treats as unhealthy.

### S1 [SUGGESTION] A timed-out check keeps its query running
**Where:** Approach, Check shape
**Decision:** Kept as planned - the pool is capped at two connections and single flight stops a
pile-up; recorded under Limitations in the README.
