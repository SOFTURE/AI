# Plan review: feature-switches

Reviewed: plan.md @ 2026-10-02 (author's review, `--auto`). Verdict: approve after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.

## Findings

### W1 [WARNING] A stored value must never be able to lock out the fix
**Where:** Approach, value order
**Problem:** if a flip breaks the app (or the panel), an operator needs a way back that does not go
through the panel or the database.
**Decision:** Fix now (applied) - the env override wins over the stored row, its name is derived
and documented per switch, and the panel shows when a switch is held by the environment.

### W2 [WARNING] The action must refuse before it reads anything
**Where:** Phase 2, `setSwitchAction`
**Problem:** an action that parses the form or looks up the switch before the role check tells a
prober which switches exist.
**Decision:** Fix now (applied) - `authorizeRole(panelRole)` is the first await; the e2e checks that
a refused submit stores nothing.

### S1 [SUGGESTION] Manifest switches the app forgot to define go unnoticed
**Decision:** Defer - with auth not reading through the module yet, the only such switch is
`auth.registration_closed`; the follow-up that wires auth also decides how a missing definition is
reported (`context/backlog/identity-followups.md`).
