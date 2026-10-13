---
change_id: mailing-inbound-spf-all-425
reviewed: 2026-10-13
verdict: approved
---

# Plan review: mailing-inbound-spf-all-425

Checked plan.md against change.md, research.md, issue #425 and `dns.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Term matching must be case-insensitive (`~ALL`) and must not match `include:all.example` or `a:all`: compare the whole term. | Taken into Phase 1: whole-term match on the lower-cased term. |
| 2 | Warning | A `+all` record is reported as `weak` here but as `permissive` by the sender check; two names for one thing. The issue asks for `weak`, and `permissive` is a warning there while this must fail. | Keep `weak`; the README names it. |
| 3 | Check | The CLI counts failed inbound checks generically and prints the finding: no CLI change. | No change. |
| 4 | Check | The adopting app's workaround is a stricter rule; the release note says it can be dropped. | Taken into the CHANGELOG entry. |

No Critical findings.
