---
change_id: pwa-share-target-959
reviewed: 2026-11-02
verdict: approved
---

# Implementation review: pwa-share-target-959

Scope: `modules/pwa/src/share/*`, `src/next/share-target-route.ts`, `src/manifest.ts`, `src/next/routes.ts`, exports,
README/CHANGELOG; `foundation/testing/src/playwright/share.ts`, its export, README/CHANGELOG; tests in both packages.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | WARNING | `GET` compared `maxFieldBytes` with the string length, so a non-ASCII value could pass a byte limit. | Fixed: the UTF-8 byte length is compared; tested with two-byte characters. |
| F2 | SUGGESTION | `null as TUser` without a reason. | Fixed: a comment says the route's default `TUser` is `null` when there is no `getUser`. |
| F3 | SUGGESTION | The manifest was built per request, so a wrong `shareTarget` failed only at the first fetch. | Fixed in phase 1: `createManifestRoute` builds the body when the module loads (tested). |
| F4 | SUGGESTION | The multipart reader concatenates its buffer on each read. | Kept: the buffer never holds more than one chunk plus a boundary, since body bytes are handed on at once; headers are capped at 8 KiB. |

Plan deviations: none in behaviour. The module manifest gets no mount entry for the share route: it is optional, and
`mount` lists what every app mounts.

Checks: plan criteria met; pwa 281 tests, testing browser tests 15 (Chromium); typecheck, ESLint and the language gate
green in the pre-commit hook.
