# Plan review: mailing-dns-expectations

Reviewed: plan.md against change.md, issue #206 and the code on master `98c8113` (`dns.ts`, `cli/run.ts`,
`options.ts`, `tests/dns.test.ts`, `tests/cli.test.ts`). Mode: autonomous (`--auto`), findings decided here.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Node's `resolveMx` answers a null MX (`0 .`) with `exchange: ""`, not `"."`. A check for `"."` alone would read a domain that refuses all mail as `found`. | Accepted: treat `""` and `"."` (after trimming a trailing dot) as null; test both. |
| 2 | Warning | Report keys `replyTo` / `returnPath` change the shape an app may compare with `toEqual`. | Accepted as additive: keys are always present (`null` / `[]`), which keeps the union explicit; the CHANGELOG names them. |
| 3 | Warning | A `targetDomain` match built as a regular expression from input is a ReDoS / injection risk (CodeQL flagged lazy patterns in this repo before). | Accepted: compare strings (`target === d || target.endsWith("." + d)`), no RegExp from input. |
| 4 | Suggestion | Order of the reply-path checks is unstated: a domain with no MX and two SPF records should report the MX failure (the one that bounces replies). | Accepted: MX first; SPF only after MX passes. |
| 5 | Suggestion | `--resend-return-path` needs the domain, which may come from the config; parse it as a boolean and expand after the domain is known. | Accepted. |
| 6 | Suggestion | `expectDmarc.policy: "none"` would be meaningless. | Accepted: the type allows only `quarantine` and `reject`; the CLI refuses other values as a usage error. |
| 7 | Suggestion | The default CLI summary line ("list mail ... will land in spam") is wrong when only the reply path fails. | Accepted: keep that line for SPF/DKIM/DMARC failures (existing output unchanged) and add one line per other failing group. |

No Critical findings. Lessons checked: none in `context/foundation/lessons.md` contradicts the plan; "a bug fix starts
with a failing test" is honoured by phase 1 being TDD. Plan updated in place where the decision added detail
(items 1, 3, 4, 7 are implementation notes covered by the phase 1 and 2 test lists).

Verdict: ready to implement.
