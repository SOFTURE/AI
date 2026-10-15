# Plan review: auth-waitlist-mail-jobs

Reviewed: plan.md @ 2026-10-14. Mode: light. Verdict: ready.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: `password-reset.ts`, `password-reset-sender.ts`, `auth/src/options.ts`, `auth/src/mailing/`,
`waitlist/src/server/signups.ts`, `confirmation-mail.ts`, `waitlist/src/next/actions.ts`, jobs `enqueue.ts`,
`handlers.ts`, core `config.ts` dependency check and `tests/repo/packages.test.ts` re-checked against the tree.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (asks 1 to 4 of #494 each have a step and a test) |
| Grounding | PASS |
| Scope | PASS (auth and waitlist only; prunes and mailing left to #491 and #492) |
| Risk | WARN (see finding 1) |

## Findings
- Warning: jobs is 0.0.0 on master, so a test config with `jobs()` next to auth or the waitlist fails core's
  `dependsOn` check until jobs 0.1.0 lands. Not a reason to loosen the range: the coordinator was asked to release
  jobs; the branch takes master in once the bump is there.
- Suggestion: assert that the job payload holds no address and no token (ids only), not just that a job exists.
  Taken into both phases' tests.

## Decisions (auto)
- Own handlers instead of #492's delivery job: the link is a credential and must be rendered at send time.
- Waitlist option named `confirmationMail.enqueue`, not a `doubleOptIn` field, so `doubleOptIn: true` keeps its shape.
- No release in this change; the coordinator batches it.
