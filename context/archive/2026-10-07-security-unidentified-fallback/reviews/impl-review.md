---
change_id: security-unidentified-fallback
reviewed: eb96992
date: 2026-10-07
verdict: approved
---

# Implementation review: security-unidentified-fallback

Checked the diff against `plan.md` and the issue's two proposals and warning.

## Verification

- The five new tests (shared key, explicit `"refuse"`, a resolver match winning over the fallback, an invalid key,
  an unknown field or value) failed with `Unrecognized key: "unidentified"` before the schema change and pass after.
- The README §3 snippet, run as a scratch Vitest test against the package: with `RATE_LIMIT_SHARED_FALLBACK=1` or
  outside production an unidentified request is `unidentified:test-stack`; in production it is
  `security.client_unidentified`; a request with `CF-Connecting-IP` is `ip:203.0.113.7` in every case.
- Gates: `npm run typecheck`, `npm run lint`, `npm test` (318 files passed, 6 skipped) green.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Suggestion | Apps that today pass `() => "0.0.0.0"` as the last resolver keep working; the README now shows the option instead, but nothing tells them to move. | No change: the old pattern is valid config; the README is the guidance. |
| 2 | Suggestion | The package version stays 0.1.6; the option is a backward-compatible addition, so the next release is a minor-or-patch bump of security. | Left to the owner's release (`release.owner: true`). |

No finding blocks the change.
