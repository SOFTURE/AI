# Plan review: auth-security-adoption-gaps

Reviewed: [plan.md](../plan.md) against change.md, research.md, the auth and security sources on master `05b5107`
and the rules in AGENTS.md. Effort: high (14 points, security-relevant).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Critical | `legacySession.tokenPattern` as a `RegExp` with `g` or `y` keeps `lastIndex` between `test` calls, so every second lookup of the same token would fail (a user flips between signed in and out). | Accepted: schema refuses `g` and `y`; the module anchors the pattern. Plan updated. |
| 2 | Warning | NFC retry adds a second scrypt derivation only for known accounts if the dummy path does not retry too: a timing oracle for account existence with a non-NFC password. | Accepted: `verifyDummyPassword` goes through `verifyPassword`, so it retries the same way; test asserts both paths derive twice. Plan updated. |
| 3 | Warning | Registration field values come from the client (hidden inputs a link can set); a hook that trusts them as attribution could be fed anything. | Accepted: README §10 says to validate; values are strings cut to 512 chars, `File` entries ignored. Plan updated. |
| 4 | Warning | A legacy cookie name equal to the current one makes the fallback read the same cookie with another shape rule. | Accepted: refused by the schema. |
| 5 | Warning | Clearing the legacy cookie needs its exact path and domain, which the module does not know. | Accepted: cleared with `Path=/` and the configured domain; README states the limit (the session row is ended anyway). |
| 6 | Suggestion | `exclude: ["/"]` as a prefix would switch the guard off; treating it as the home page only is the one useful reading. | Accepted as planned, with a test. |
| 7 | Suggestion | `module.json` is also changed by #158; keep its edit to nothing (auth stays 0.1.6), so the two do not conflict. | Accepted: auth's version is unchanged; `module.json` untouched. |
| 8 | Suggestion | Point 14 cannot be closed by the agent (publishing is a separate release step). | Accepted: the issue comment says 0.1.6 is ready on master and names the `auto-release` run as the remaining step. |

No open findings. Verdict: ready to implement.
