# Implementation review: mailing-dns-expectations

Reviewed: the branch diff against master `98c8113` (`modules/mailing/src/server/dns.ts`, `src/server/index.ts`,
`src/cli/run.ts`, `tests/dns.test.ts`, `tests/cli.test.ts`, README, CHANGELOG, versions) against plan.md and
issue #206. Mode: autonomous (`--auto`).

## Plan conformance

| Plan item | Where | State |
|---|---|---|
| `expectDmarc` minimum (policy, subdomainPolicy, adkim, aspf, `pct` with a policy), finding `weak` | `dns.ts` `checkDmarc`, `meetsDmarcExpectation` | done, as planned |
| Reply path: MX, null MX, at most one SPF, MX reported first | `dns.ts` `checkReplyPath` | done, as planned |
| Return path: CNAME with `targetDomain`, MX fallback, `resendReturnPath` | `dns.ts` `checkReturnPath`, `resendReturnPath` | done, as planned |
| `resolveMx` / `resolveCname` options on the function and the CLI | `dns.ts`, `run.ts` | done |
| CLI flags, configured `replyTo`, `REPLY` / `PATH` lines, per-group summary | `run.ts` | done |
| README, CHANGELOG, version 0.1.8 (package.json, module.json, manifest, lockfile) | | done |

No drift. Phase 1 tests were seen red (27 failing) before the implementation, then green.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The first CLI run of the old "configured sender" test went red against the real resolver: `example.com` publishes a null MX, so the configured `replyTo` failed. The test had injected only `resolveTxt`; MX lookups reached the network. | Fixed: the dns CLI tests inject `resolveMx` and `resolveCname` fakes, so no test asks live DNS. It also confirmed the null-MX path on a real answer (`exchange: ""`). |
| 2 | Warning | `unexpected-target` is 17 characters; `padEnd(15)` would glue it to the host in the CLI line. | Fixed: one space is always kept (`"<finding> ".padEnd(15)`), existing lines unchanged; test "keeps a space after a long finding". |
| 3 | Suggestion | The DMARC tag reader moved from a per-tag `RegExp` built from the tag name to one split over `;`. Same semantics (first occurrence wins, case-insensitive), no pattern from input. | Kept. |
| 4 | Suggestion | A non-numeric `pct` (`pct=abc`) reads as weak when a policy is required. Receivers treat an invalid `pct` as 100, so this is stricter than receivers. | Kept: a malformed record next to a required policy deserves a red line; README says `pct` under 100 fails. |
| 5 | Suggestion | `resendReturnPath` is not a default of the `resend()` adapter. | Kept, per plan: older Resend domains have no `rsend` record and a default would turn them red. |

Security: no input reaches a `RegExp` (target domain compared as strings); the check reads public DNS only and never
throws. No secrets, no logging of addresses.

Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (results in Progress).

Verdict: approve.
