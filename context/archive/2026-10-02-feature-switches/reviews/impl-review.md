# Implementation review: feature-switches

Reviewed: commits 17a8efb (p1) and 341fe2b (p2) against plan.md (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 1 warning, 2 suggestions; all fixed.
Evidence: gates green (typecheck, lint, 1046 unit tests, build); `npm run e2e` on PostgreSQL 16:
27 passed, including the three tests of `e2e/feature-switches.spec.ts`.

## Drift from plan

- `e2e/ops.spec.ts` and `scripts/container.mjs` list the new module's health check: the health
  answer names every enabled module, so enabling feature-switches in the example changes it.
- docs/02 §7 and its configuration example now describe app-defined switches; the example there
  used `auth.registration_closed`, which this change asks apps not to define yet.
- A `SwitchPanel` unit test (happy-dom) and an architecture test (no inline copy, no raw colours,
  only compiled ui classes) were added on top of the e2e.

## Findings

### W1 [WARNING] A panel toggle for a switch nothing reads
**Where:** registry, `auth.registration_closed`
**Problem:** auth reads its switch itself; listing module-manifest switches automatically would show
a toggle that changes nothing.
**Decision:** Fixed - the registry lists only app-defined switches, the README (sections 7 and 12)
says not to define `auth.registration_closed` yet, and the wiring is a HIGH follow-up in
`context/backlog/identity-followups.md`, carried to the roadmap's owner checks before ID-9.

### S1 [SUGGESTION] The skills installer rewrote `.gitignore` whitespace
**Decision:** Fixed - restored to master's content; not part of this change.

### S2 [SUGGESTION] A refused flip must show the old value, not the requested one
**Decision:** Fixed - the action returns the previous value with the error, the row renders the
server's answer once the save settles (unit test), and the e2e checks the switch is unchecked after
the refusal and that no row was stored.

## Security checklist

- The panel page calls `requireRole(panelRole)` (404 for anonymous visitors and non-holders); the
  action calls `authorizeRole(panelRole)` before it reads the form; e2e covers both.
- The module depends on auth, so a configuration cannot enable the panel without the role check;
  an undeclared `panelRole` throws.
- The actor id comes from the session, never from the form; `updated_by` has no foreign key and
  holds no email.
- A database failure never fails a request that reads a switch: the fail mode applies and the
  failure is logged by error class only; an unreadable override is logged by variable name only.
- Every value has an explicit default (no implicit `false`), and the env override is the way back
  from a bad flip without the panel or the database.
