# Plan review: auth-adoption-gaps

Reviewed: `plan.md` against `change.md`, issue #193 and the code (`modules/auth/src/next/actions.ts`,
`src/proxy/index.ts`, `src/session-cookie.ts`, `src/next/next-modules.d.ts`, Next 16.3 `resolve-routes.js`,
`scripts/release/README.md`, `tests/repo/packages.test.ts`).

Verdict: **ready after the fixes below** (all applied to plan.md).

| # | Severity | Finding | Evidence | Decision |
| --- | --- | --- | --- | --- |
| 1 | Warning | `logoutAction` is a public server action: a client can call it with any serializable value, not only `FormData` or `{ next }`. The plan typed the input but did not say it is narrowed at the boundary. | conventions: external data enters as `unknown`, zod at the boundary | Fixed: input read as `unknown`, narrowed with zod; tests for a string and a number argument. |
| 2 | Warning | The version step said "CHANGELOG `## 0.1.8`" and a hand-edited `package.json`. The repo bumps with `npm run release:version`, which also sets `module.json` and needs `## Unreleased` as the newest section; a hand bump would leave `module.json` behind and fail the release preflight. | `scripts/release/README.md` "Release a version"; `tests/repo/packages.test.ts:80` | Fixed: `## Unreleased`, then `release:version auth patch` in its own commit. |
| 3 | Suggestion | `trustedOrigins` written with a trailing slash (`https://example.com/`) is the most likely typo; refusing it costs an adopter a startup crash for no safety gain. | — | Fixed: a bare `/` path is accepted and dropped; any other path still throws. |
| 4 | Suggestion | Forwarded hosts carry ports (`example.com:8443`) and can be malformed. The plan did not say how either compares. | Next's `X-Forwarded-Host` fill-in from `Host` | Fixed: parsed through `URL` (lowercased, default port dropped); a port must match the entry's; an unparsable value falls back to `appOrigin`. Tests added to the list. |
| 5 | Suggestion | No `LogoutButton` test file exists; the plan named `forms.test.tsx` "or" another. | `grep LogoutButton modules/auth/tests` → none | Fixed: `pages.test.tsx` named. |

Checked and fine:
- Defaults unchanged: no argument at logout and no `trustedOrigins` keep 0.1.7's redirects (tests listed).
- No open redirect: the guard only ever uses `appOrigin` or a listed origin; logout's `next` goes through
  `toSafeNextPath`, which keeps it on the app.
- Point 3 decision is backed by a recorded measurement (`next-modules.d.ts`), so documenting rather than
  changing specifiers is right; the plan verifies the documented setting for real (manual 1.3).
- Single phase is proportionate: three small, independent edits in one package.
