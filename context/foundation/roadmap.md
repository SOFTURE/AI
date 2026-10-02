---
project: "SOFTURE AI"
roadmap: foundation
version: 1
status: ready
prd_version: 1
created: 2026-10-02
updated: 2026-10-02
---

# Roadmap foundation: the ground every module stands on

> Run-wide orders (read by orchestrators):
> - Push main branch: at the end. Also push `master` after every merge, so an ephemeral cloud
>   container never holds the only copy. Claude reviews and merges its own changes into `master`
>   (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - After merging FD-1, run `npm ci` in the main tree: FD-1 installs git hooks (lefthook) that need
>   the new devDependencies, also for conflict-resolution commits during later merges.
> - Owner at the keyboard: FD-8 (first publish of each new package on npm: approve the staged
>   release, then configure the trusted publisher).
>
> Queued after this one (WORKFLOW §5.1, files in `roadmaps/`, entries in `context/backlog/`):
> 1. [`roadmap-identity`](roadmaps/roadmap-identity.md): security, auth, feature-switches, ops, then FIRE adopts them.
> 2. [`roadmap-engagement`](roadmaps/roadmap-engagement.md): mailing, waitlist, mcp-access, privacy.
> 3. [`roadmap-monetization`](roadmaps/roadmap-monetization.md): billing, analytics.
> 4. [`roadmap-marketing-kit`](roadmaps/roadmap-marketing-kit.md): video, screenshot and OG generator. Independent, so it can be promoted any time.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **FD-1** | `monorepo-tooling` | workspaces build typed ESM + CSS; typecheck, lint, language and unit gates run in lefthook hooks (as in FIRE_TRACKER) and in CI | — | autonomous | done |
| **FD-2** | `release-pipeline` | a `<package>@x.y.z` tag publishes that package to npm (OIDC) and GitHub Packages and creates a GitHub Release | FD-1 | autonomous | **in_progress** (implement 3/4, since 2026-10-02; cloud session, branch `claude/fd-2-release-pipeline-y0qm8t` — do not take in another session) |
| **FD-3** | `core-contract` | `@softure-ai/core`: config, module contract, Result, clock, messages | FD-1 | autonomous | ready |
| **FD-4** | `db-migrator` | `@softure-ai/db`: client, per-module schemas, migrator with plan/adopt, PGlite test DB | FD-3 | autonomous | ready |
| **FD-5** | `ui-tokens-theme` | `@softure-ai/ui` tokens (light/dark), theme provider + switch, compiled CSS pipeline | FD-3 | autonomous | ready |
| **FD-6** | `ui-primitives` | Button, Modal, Toast, Select, form fields, Card, Hint, ActionForm, icons with slots and messages | FD-5 | autonomous | ready |
| **FD-7** | `example-app` | Next example app consuming core/db/ui, Playwright e2e in CI | FD-4, FD-6 | autonomous | ready |
| **FD-8** | `foundation-release` | core, db and ui 0.1.0 published through FD-2; docs updated; foundation verified end to end | FD-2, FD-7 | owner | ready |

## Order

1. **FD-1 first, alone.** It owns `package.json`, `tsconfig*.json`, `eslint.config.*`,
   `vitest.config.*` and `.github/workflows/ci.yml`. Every later item builds on it.
2. **Then in parallel:** FD-2 (owns `.github/workflows/release.yml`, `scripts/release/`) and
   FD-3 (owns `foundation/core/`).
3. **Then in parallel:** FD-4 (owns `foundation/db/`; the only migration-adding item) and FD-5
   (owns `foundation/ui/` tokens, theme and build).
4. **FD-6** after FD-5. It shares `foundation/ui/`, so it is not parallel with FD-5.
5. **FD-7** after FD-4 and FD-6. It owns `examples/next-app/` and `.github/workflows/e2e.yml`.
6. **FD-8** last. It is an owner item: tags and first publishes.

Lockfile: parallel items all touch `package-lock.json`. On conflict, take the main branch's lockfile,
then run `npm install` and commit the regenerated file.

Risk first: the module contract (FD-3) and the migrator (FD-4) carry the most design risk, so
they come before the UI breadth (FD-6).

## Items

### FD-1: Monorepo tooling and gates
- **Change ID:** `monorepo-tooling`
- **Status:** done
- **Outcome:** `npm ci && npm run typecheck && npm run lint && npm test` works at the root over
  all workspaces; each package builds ESM + `.d.ts` (tsup) and, where it has styles, compiled CSS;
  a package template (`templates/package/`) matches docs/02 §2; `context/workflow.json` gates
  point at the real scripts. **Git hooks via lefthook, mirroring FIRE_TRACKER's gates**
  (`FIRE_TRACKER/lefthook.yml` and the pre-push gates section of its AGENTS.md are the reference):
  - `pre-commit` (seconds, parallel): `tsc --noEmit` over the whole tree; `eslint
    {staged_files} --max-warnings 0 --no-warn-ignored`; a **language gate** that fails on
    Polish text (diacritics and common words) in staged files outside `messages/` dictionaries
    (the mandatory English-only rule in AGENTS.md). Code jobs are skipped by `glob` when only
    markdown changed; the language gate runs on markdown too.
  - `pre-push`: the full `npm test`.
  - `prepare` installs hooks only outside CI (`CI` set → skip), as FIRE does.
  - CI (`.github/workflows/ci.yml`) runs the same `static` job (typecheck, lint, language) and
    the unit tests on every push and PR. The suite is fast here, unlike FIRE's on-demand tests.
  - **Repository tests from day one**, so the test gate guards something before any package
    exists: (a) the language rule over all tracked files; (b) the roadmap contract: every row
    in `roadmap.md` and `roadmaps/roadmap-*.md` parses with the WORKFLOW §5 regexes, the row
    status equals the item block status, each change-id is unique and lives in exactly one of
    `changes/`, `backlog/`, `archive/`; (c) relative links in `context/` and `docs/` resolve.
- **Prerequisites:** none.
- **Unknowns:** tsup vs. tsc-only builds for server-only code; how to run architecture tests
  (docs/02 §5) once for all packages; how NODE_ENV=production on the owner's machine affects
  `npm ci` (FIRE needs `--include=dev`); current majors (TypeScript 7, ESLint 10, Vitest 5)
  vs. FIRE's (TS 5, ESLint 9, Vitest 4): pick deliberately and record why; lefthook `glob`
  behaviour for the markdown-only skip.
- **Risk:** low. Wrong choices are cheap to change before any package ships.
- **Baseline:** no build, no hooks. After: all four commands green; a commit with a Polish
  comment or a lint warning is rejected by `pre-commit`; a push with a failing test is rejected
  by `pre-push`; a commit touching only `*.md` skips typecheck and lint.
- **PRD refs:** FR-1, NFR-1, NFR-3, NFR-6.

### FD-2: Tag-driven release pipeline
- **Change ID:** `release-pipeline`
- **Status:** in_progress (implement 3/4, since 2026-10-02; cloud session, branch `claude/fd-2-release-pipeline-y0qm8t` — do not take in another session)
- **Outcome:** a `<package>@x.y.z` tag (e.g. `core@0.1.0`) validates the package, publishes
  `@softure-ai/<package>` to npm through trusted publishing with provenance, publishes
  `@softure/<package>` to GitHub Packages and creates a GitHub Release with the tarball, the same
  way as SOFTURE/SKILLS (`release.yml` there is the reference).
- **Prerequisites:** FD-1.
- **Unknowns:** one workflow file for all packages vs. one per package (npm binds the trusted
  publisher to a workflow file name per package); changesets vs. plain `npm version -w`; how a
  brand-new package does its first publish (staged approval by the owner).
- **Risk:** medium. Publishing mistakes are public and versions cannot be reused.
- **Baseline:** no release path. After: a `workflow_dispatch` dry run (pack, validate, no publish)
  passes in CI. The first real tag is the owner's (FD-8); expect this item to end as
  `done_code (…; waiting: first tagged release)`.
- **PRD refs:** FR-2, G-4.

### FD-3: Module contract in @softure-ai/core
- **Change ID:** `core-contract`
- **Status:** ready
- **Outcome:** `defineSoftureConfig` (zod-validated), `defineModule` (manifest, dependencies,
  migrations, routes, switches, privacy contributors), `Result<T, ErrorCode>`, `Clock`,
  messages with `pl`/`en` dictionaries and partial overrides, `locale`/`timezone`, and a
  `safeError` helper, with unit tests and a README per docs/02 §11.
- **Prerequisites:** FD-1.
- **Unknowns:** how server actions read the registered config (docs/02 §8, global registry vs.
  explicit import). Record the choice as provisional: identity ID-1 (`next-actions-spike`) confirms
  or replaces it; the shape of `module.json` vs. the TS manifest (single source of truth).
- **Risk:** high. Every module depends on this contract.
- **Baseline:** none. After: a dummy module defined, validated and listed in a test app config.
- **PRD refs:** FR-3, FR-4, NFR-6.

### FD-4: Database client and module migrator
- **Change ID:** `db-migrator`
- **Status:** ready
- **Outcome:** `@softure-ai/db` with a pg/PGlite client chosen by `DATABASE_URL`;
  `softure migrate` applying each module's SQL in its own schema in dependency order with a
  `softure.migrations` journal, checksums, an advisory lock, `--plan` and `--adopt`; and
  `createTestDatabase(modules)`. Bundle-friendly for a container migrate step.
- **Prerequisites:** FD-3.
- **Unknowns:** whether drizzle's migrator can be reused per schema or a small custom runner is
  simpler; the `--adopt` schema comparison method (information_schema diff vs. a checksum of
  expected DDL).
- **Risk:** high. Data safety for every adopting app.
- **Baseline:** none. After: two dummy modules migrate in order on PGlite and Postgres;
  re-running is a no-op; an edited migration fails; `--adopt` marks existing tables.
- **PRD refs:** FR-5, FR-6, NFR-4.

### FD-5: UI tokens, theme and CSS pipeline
- **Change ID:** `ui-tokens-theme`
- **Status:** ready
- **Outcome:** `--sft-*` token contract with light and dark defaults, `SoftureThemeProvider`
  (object or `design.json` input), a theme switch with a no-flash boot script, a Tailwind 4
  bridge file, and the build that emits `styles.css` in `@layer softure`.
- **Prerequisites:** FD-3 (messages for switch labels).
- **Unknowns:** how to compile Tailwind-authored components to static CSS per package; the token
  naming scheme vs. the FIRE semantic names (mapping table).
- **Risk:** medium.
- **Baseline:** none. After: a page renders with default tokens and with an override theme;
  CSS size is measured (NFR-7).
- **PRD refs:** FR-7, NFR-7.

### FD-6: UI primitives
- **Change ID:** `ui-primitives`
- **Status:** ready
- **Outcome:** Button/ButtonLink/IconButton, Modal (+ ModalForm), Toast, Select (ARIA listbox),
  Switch/Checkbox/SegmentedControl, TextField/PasswordField/MoneyField/SelectField, Card/Stat/EmptyState,
  Hint, ActionForm, icons. Every component has typed `classNames` slots, `unstyled`, messages for
  every visible or ARIA text, and an injected `LinkComponent`. Ported from FIRE_TRACKER
  `src/components/*` with their tests.
- **Prerequisites:** FD-5.
- **Unknowns:** which FIRE components carry domain props that must be dropped (e.g. data-tone
  accents); keyboard behaviour coverage worth porting from FIRE integration tests.
- **Risk:** medium (breadth).
- **Baseline:** FIRE's component tests. After: the same behaviour tests pass in the package.
- **PRD refs:** FR-8, NFR-3, NFR-6.

### FD-7: Example app and e2e harness
- **Change ID:** `example-app`
- **Status:** ready
- **Outcome:** `examples/next-app` (Next 16) consuming core, db and ui through `softure.config.ts`,
  running migrations on Postgres in Docker, with Playwright e2e in `.github/workflows/e2e.yml`.
  This is the harness every later module adds scenarios to. Sets `integration.local` in
  `context/workflow.json` to the e2e command, so orchestrators run it before READY.
- **Prerequisites:** FD-4, FD-6.
- **Unknowns:** workspace linking vs. packed tarballs in e2e (packed is closer to real consumers).
- **Risk:** low.
- **Baseline:** none. After: e2e green in CI with theme switch, a modal and a migration check.
- **PRD refs:** FR-9, NFR-2.

### FD-8: Foundation release
- **Change ID:** `foundation-release`
- **Status:** ready
- **Outcome:** `@softure-ai/core`, `@softure-ai/db` and `@softure-ai/ui` 0.1.0 published through
  FD-2 (the owner approves each first, staged publish and configures its trusted publisher), README
  status lines updated, docs/02 updated with whatever the foundation changed, and a finish review
  across FD-1…FD-7.
- **Prerequisites:** FD-2, FD-7.
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, G-4.

## Owner decisions and checks

- [ ] **FD-8**: approve the first (staged) publish of core, db and ui on npmjs.com, then add a
  trusted publisher for each (`SOFTURE` / `AI` / the release workflow file).

## Done

- **FD-1** `monorepo-tooling`: typecheck, lint, language and unit gates at the root, in lefthook hooks and in CI; tsc package builds and `templates/package/`; archived in `archive/2026-10-02-monorepo-tooling/`

## Decisions (auto)

- Foundation is the main roadmap because every queued roadmap depends on it. → The queued
  themes wait in `roadmaps/` (WORKFLOW §5.1).
- The Next server-actions spike is not here but is the first item of `roadmap-identity`. → It
  needs core and db to exist in order to test realistically.
- The FIRE adoption of each theme is the last item of that theme's roadmap. → It keeps the
  "a version is verified only when FIRE runs on it" rule visible in one place.
