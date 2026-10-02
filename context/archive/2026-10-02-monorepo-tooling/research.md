# Research: monorepo-tooling

Input: change.md, roadmap FD-1. Depth: normal (tooling only: no money, data, auth or migrations).

## Summary

The repository has no tooling at all: one root `package.json` with three workspace globs that
match no package yet (`package.json:6-10`; `find . -name package.json -not -path './node_modules/*'`
returns only the root), one devDependency (`@softure-ai/skills`), no tsconfig, ESLint, Vitest,
hooks or CI. `context/workflow.json` has `gates` all `null`. Everything FD-1 delivers is new.

Three measurements change how the roadmap's wording should be read:

1. **tsup drops module directives.** Building `"use client"` / `"use server"` files with tsup 8.5.1
   produced a bundle with both directives gone, without a warning (scratchpad experiment, output
   quoted below). `tsc` keeps them per file. Next server actions shipped from packages (docs/02 §8)
   depend on these directives. tsup is also unmaintained (its README: "This project is not actively
   maintained anymore. Please consider using tsdown"; last release 8.5.1 on 2025-11-12), and its
   `.d.ts` step fails on TypeScript 6.0 (`TS5101: Option 'baseUrl' is deprecated`).
2. **TypeScript 7 cannot be the repo compiler yet.** `typescript-eslint@8.71.0` (latest) declares
   `peerDependencies.typescript: ">=4.8.4 <6.1.0"`, and `typescript@7.0.2` exports only
   `./unstable/*` APIs (`npm view typescript@7 exports`). TypeScript 6.0.3 is the newest version
   both typed linting and the classic compiler API accept.
3. **Vitest does not force `NODE_ENV=test`.** With `NODE_ENV=production` in the shell, a Vitest 5.0.3
   test asserting `process.env.NODE_ENV === "test"` failed with `Received: "production"`. The
   config must pin it (the owner's shell exports `NODE_ENV=production`, change.md Notes).

The framing question this raises (tsup named in the Outcome versus a cheaper, safer `tsc` build)
is settled in `frame.md`.

## Current state

- Root `package.json`: `private`, workspaces `foundation/*`, `modules/*`, `tools/*`,
  `engines.node >=22`, devDependency `@softure-ai/skills ^0.2.1`. No `scripts`.
- `.npmrc:3`: `include=dev` with the comment that a `NODE_ENV=production` shell otherwise skips
  devDependencies. This already answers how `npm ci` behaves on the owner's machine.
- `foundation/{core,db,ui}`, `modules/*` (10 folders) and `tools/marketing-kit` hold only
  `README.md` and `.gitkeep` files (`find foundation tools -type f`). No source, no package.json.
- `.gitignore` already ignores `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`.
- `context/workflow.json`: `gates.typecheck|lint|test` are `null`, `integration.local|remote`
  `null`, `worktree.cloudState: "branch"`.
- Tracked files: 168 (`git ls-files | wc -l`), of which 61 under `context/`, 70 under `modules/`.
- No Polish diacritics anywhere in tracked files (Python scan over `git ls-files`, 0 hits).
- All relative Markdown links in every tracked `*.md` resolve (scan with code spans and fences
  removed, 0 broken).

### FIRE_TRACKER reference (`/home/claude/fire_tracker`)

- `lefthook.yml`: `pre-commit` (parallel) `typecheck` with `glob: "*.{ts,tsx,mts}"` running
  `npx tsc --noEmit` over the whole tree; `lint` with `glob: "*.{ts,tsx,mts,js,mjs,jsx}"` running
  `npx eslint {staged_files} --max-warnings 0 --no-warn-ignored`; `pre-push` `test` with a glob,
  running `npm test`. The file comments say `glob` acts as "was any code touched" gate.
- `package.json:41`: `"prepare": "node -e \"process.exit(process.env.CI?0:1)\" || lefthook install"`.
- Versions: `eslint ^9`, `typescript ^5`, `vitest ^4.1.11`, `lefthook ^2.1.12`.
- `vitest.config.mts`: `process.env.TZ` pinned to `America/New_York` before the config (a negative
  offset zone catches missing explicit zones), `testTimeout: 120_000`, `maxWorkers: "50%"`,
  `sequence.shuffle: true`.
- AGENTS.md (gates section): `pre-push` is the only automatic test gate on push; never
  `--no-verify`; typecheck sees the whole tree, not the staged files.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Root manifest | `package.json`, `package-lock.json` | scripts, devDependencies, `prepare` |
| TypeScript | `tsconfig.base.json`, `tsconfig.json` | shared strict options; whole-tree typecheck |
| Lint | `eslint.config.mjs` | flat config, typed rules, import boundaries |
| Tests | `vitest.config.mts`, `tests/repo/*.test.ts` | runner config; repository tests |
| Hooks | `lefthook.yml` | pre-commit and pre-push gates |
| Scripts | `scripts/check-language.mjs`, `scripts/build-workspaces.mjs` | language gate; ordered builds |
| CI | `.github/workflows/ci.yml` | static + test + build on push and PR |
| Template | `templates/package/**` | package layout from docs/02 §2 |
| Workflow | `context/workflow.json` | gates point at the scripts |
| Docs | `AGENTS.md` (project section), `docs/02-module-standard.md` §12 build line | how to run the gates; build tool decision |

All of these are in FD-1's exclusive list (change.md Constraints) except the two docs lines.
No other change is in flight (every other roadmap row is `ready`; FD-1 runs alone, roadmap Order 1).

## Data

None. No database, no migrations.

## Tests

None exist. The test gate will start with repository tests only (change.md Intent (a)-(c)) plus
package-shape tests that run against `templates/package/` while no workspace package exists.
Command after this change: `npm test` (Vitest 5, root config).

## SOFTURE modules

Not applicable: this change builds the tooling the modules will be built with.

## Risks

- **Hook install writes into the shared `.git/hooks`.** `prepare` runs `lefthook install` on every
  `npm ci`. In the main tree, the roadmap header already tells the manager to run `npm ci` after
  the merge. Low risk; it is the intended effect.
- **Language gate false positives.** Docs quote real FIRE_TRACKER route slugs in code spans
  (`modules/auth/README.md:19`: `src/app/(app)/haslo/`; `docs/01-module-assessment.md:54`).
  A word list scan found exactly these and one English "ten"
  (`context/foundation/roadmaps/roadmap-engagement.md:176`). Mitigation: strip Markdown code
  spans before the word match, choose words that are not English.
- **Roadmap test turning red while items are in flight.** `wt-roadmap.py` writes
  `**in_progress** (...)` in the row and `in_progress (...)` in the block
  (`context/foundation/roadmap.md:34` vs `:64`). Compare with `**` stripped and accept the whole
  WORKFLOW §5 vocabulary.
- **Cross-package imports before a build.** A whole-tree `tsc --noEmit` on a fresh checkout cannot
  resolve `@softure-ai/core` to `dist/` that does not exist yet. Mitigation: a custom export
  condition pointing at `src/` for typecheck and tests (see Answers).
- **Workspace build order.** `npm run build --workspaces` follows the workspace list order, not
  dependencies. `foundation/*` sorts before `modules/*` today, but `modules/auth` depends on
  `modules/security` (docs/01 dependency graph), which sorts after it. Mitigation: a small
  topological build script.

## Relevant lessons

`context/foundation/lessons.md` has no entries yet.

## Answers to unknowns

1. **tsup vs. tsc-only builds for server-only code.** Measured (scratchpad, tsup 8.5.1, TS 6.0.3):
   `tsup src/index.ts --format esm` bundled `a.ts` (`"use client"`) and `b.ts` (`"use server"`)
   into one file with neither directive; `--dts` failed with TS5101. `tsc` with
   `module: NodeNext` and `"type": "module"` emitted `a.js` starting with `"use client";` and
   `index.js` re-exporting `./a.js`, plus `.d.ts` and `.d.ts.map` per file. Decision (frame):
   **tsc for every package**, server-only or not. CSS stays a separate step (FD-5's Tailwind CLI).
2. **Architecture tests once for all packages.** Decided: one root test file
   `tests/repo/packages.test.ts` discovers every workspace package from the root `workspaces` globs
   (plus `templates/package/`) and runs the same rules on each, so a new package is covered by
   being created. Import boundaries (`next/*` not allowed in `src/server/` and `src/ui/`, NFR-3)
   live in ESLint (`no-restricted-imports` scoped by `files`), where they also run per staged file
   in `pre-commit`. Rules that need packages with content (raw colours, copy outside messages,
   every table has a migration) are added by the items that create that content (FD-4, FD-5,
   FD-6) to the same test file.
3. **`NODE_ENV=production` and `npm ci`.** `.npmrc` `include=dev` makes npm install
   devDependencies whatever `NODE_ENV` says (the file exists since the readiness fix,
   `9ff24ed`). Verified during implementation with `NODE_ENV=production npm ci`. Vitest does not
   override it (measurement 3 above), so `vitest.config.mts` sets `process.env.NODE_ENV = "test"`.
4. **Current majors vs. FIRE's.** TypeScript **6.0** (not 7: no stable API, typescript-eslint peer
   `<6.1.0`; not 5: 6.0 is the bridge release and tells us now what TS 7 will reject).
   ESLint **10** with `@eslint/js` 10 and `typescript-eslint` 8.71 (`peerDependencies.eslint`
   includes `^10.0.0`). Vitest **5** with Vite **8** (Vitest 5 lists `vite` as a peer:
   `^6.4.0||^7.0.0||^8.0.0`; engines `^22.12.0 || ^24 || >=26`). Lefthook **2.1**.
   `@types/node` **22** (matches `engines.node >=22` and Vitest's peer `^22.0.0||>=24.0.0`).
5. **Lefthook `glob` for the markdown-only skip.** FIRE relies on `glob: "*.{ts,tsx,mts}"` matching
   nested paths such as `src/lib/x.ts`. Verified during implementation with a markdown-only commit
   (typecheck and lint must print as skipped) and a `.ts` commit. The language job gets no code
   glob, so it runs on Markdown too.

Implicit questions:

- **Where do the hook scripts live, and in which language?** Plain ESM JavaScript (`.mjs`) with
  `// @ts-check` and JSDoc types, checked by the root `tsc` through `checkJs`. Reason: hooks must
  run with bare `node` on any Node 22 without a build or a loader; native type stripping exists only
  from Node 22.18.
- **How do typecheck and tests see packages without a build?** A custom export condition,
  `"@softure-ai/source"`, maps each export to `src/*.ts`. The root `tsconfig.json` sets
  `customConditions: ["@softure-ai/source"]`, and Vitest adds it to `resolve.conditions`. The build
  config (`tsconfig.build.json`) does not set it, so `dist/` is what consumers get.

## Open questions

- tsup in the Outcome vs. tsc: **decided** (auto, frame.md): tsc. Reason: directives preserved,
  no unmaintained dependency, one compiler.
- Does the pre-push hook keep FIRE's code glob? **Decided** (auto): no glob. The repository tests
  check Markdown (links, roadmap contract, language), so a Markdown-only push must run them; the
  suite is seconds, unlike FIRE's.
- Does FD-1 add `./styles.css` to the template's exports? **Decided** (auto): no. FD-5 owns the CSS
  pipeline (its Outcome: "the build that emits `styles.css`"); a declared export without a build
  that produces it would make the template lie. FD-5 adds it to the template.

## Decisions (auto)

- Depth → normal (tooling only, cheap to change before any package ships, roadmap Risk: low).
- Framing → run `softure-frame`: the Outcome names a mechanism (tsup) and research measured a
  cheaper mechanism that also avoids a correctness defect (dropped directives).
- Link test scope → every tracked `*.md`, not only `context/` and `docs/` (a superset of the
  Outcome; all links resolve today, so it costs nothing and guards the READMEs too).
