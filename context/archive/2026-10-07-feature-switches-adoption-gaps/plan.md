# Plan: feature-switches-adoption-gaps

Input: change.md (research and framing skipped, see its Notes). Complexity: small.

## Goal

An app composes the switches panel inside its own shell from exported parts, flips a switch and sees a fresh
source note without a reload, calls the privacy helpers with `{ db }` and gets a cleared count, and adopts an
existing switches table by following a README checklist that a test runs.

**Out of scope:** props on `SwitchesPage` for the heading and outer element (the exported row mapping covers the
shell case without a second layout API), a history of switch changes, changes to `@softure-ai/privacy` or core.

## Approach

**Starting point:** `pages.tsx:20-35` holds the private `describeSource`; `actions.ts:28-41` stores and returns;
`privacy.ts:15-31` takes `ModuleContext`; the README has no adoption or break-glass section.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Shell fit | export `describeSwitchSource(view, messages, config)` and `toSwitchPanelRows(views, messages, config)` from `/next`; `SwitchesPage` uses them | the issue's first suggestion; one mapping for the page and the app | issue |
| `config` parameter | `Pick<SoftureConfig, "locale" \| "timezone">` | the mapping reads nothing else; an app can pass its own values | plan |
| Revalidation | `revalidatePath(routes.panel)` inside `setSwitchAction` after `ok` | billing and mcp-access do the same; a server action cannot take options from the client safely, and the route is already overridable | billing `actions.ts:62` |
| Privacy context | `Pick<ModuleContext, "db">` on both helpers | the issue; still assignable to `PrivacyContributor` (parameter contravariance) | issue |
| Cleared count | `deleteSwitchesUserData` returns `ok({ clearedSwitches })` from `UPDATE … RETURNING`; the contributor wraps it and returns `ok()` | core's contract is `Result<undefined>` | core `module.ts:28` |
| Adoption recipe | README §5 checklist plus a test that runs the same SQL in an app `before` hook with `baseline: { "feature-switches": 1 }`, and that the hook without the constraint rename fails | proves the checklist instead of describing it | issue |
| Version | `0.1.7` via `npm run release:version -- feature-switches patch` | additive API, one return-value change on a 0.x helper | scripts/release |

## Phase 1: the Next adapter (row mapping, revalidation)

**Discipline:** TDD. **Files:** `src/next/panel-rows.ts` (new), `src/next/pages.tsx`, `src/next/actions.ts`,
`src/next/index.ts`, `src/next/next-modules.d.ts`, `src/server/options.ts` (`getFeatureSwitchesRoutes`),
`tests/panel-rows.test.ts` (new), `tests/next-action.test.ts` (new)

**Tests:** each source (env, stored with the date in the config's locale and time zone, stored without a date,
default, fail mode) gives its sentence; `toSwitchPanelRows` maps label, description, `isLocked` only for env;
`setSwitchAction` as an admin stores the value and revalidates the panel route (also an overridden route);
refused (no session) and an unknown switch revalidate nothing.

**Done when:** new tests red before, green after; gates green.

## Phase 2: privacy helpers, README, version

**Discipline:** TDD. **Files:** `src/server/privacy.ts`, `tests/privacy.test.ts`, `tests/adoption.test.ts` (new),
`README.md`, `CHANGELOG.md`, version files

**Tests:** both helpers called with `{ db }` only; deletion returns `{ clearedSwitches: 1 }`, `0` for a stranger;
the contributor still returns `ok()`; adoption: the README checklist run over a legacy
`public.feature_switches` (with a badly named row) migrates with the baseline, keeps the valid rows, renames
`registration_closed` to `auth.registration_closed`; without the constraint rename the migration fails.

README: §4 composing inside a shell (`toSwitchPanelRows` + `routes.panel`) and the Vitest inline note; §5
"Adopting an existing switches table" and "Changing a switch from SQL"; §11 the `{ db }` signature and count;
drop the reporting-app reference from the intro.

**Done when:** new tests red before, green after; gates green (typecheck, lint, test, build); README SQL is the
SQL the test runs (copied verbatim).

## Risks and rollback

- An app comparing `deleteSwitchesUserData`'s value to `ok()` sees a new value: recorded in the CHANGELOG.
- Revalidating a route that the app does not serve is a no-op in Next.
- Rollback: revert the phase commits.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: the Next adapter (row mapping, revalidation)

#### Automated
- [x] 1.1 New tests fail before the implementation and pass after — a4b8914
- [x] 1.2 Gates green (typecheck, lint, test) — a4b8914

### Phase 2: privacy helpers, README, version

#### Automated
- [x] 2.1 New tests fail before the implementation and pass after — 3916256
- [x] 2.2 Gates green (typecheck, lint, test, build) — 3916256

#### Manual
- [x] 2.3 README SQL matches the SQL the adoption test runs — 3916256 (verified by agent: the test reads the block from the README)
