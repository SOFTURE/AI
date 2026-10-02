# Plan: monorepo-tooling

Input: change.md, research.md, frame.md. Complexity: large (5 phases; one tooling theme, every
phase leaves the gates green, so no split).

## Goal

On a fresh clone, with `NODE_ENV=production` in the shell:

- `npm ci && npm run typecheck && npm run lint && npm test && npm run build` all exit 0 at the root;
- `npm test` runs the repository tests (language rule, roadmap contract, Markdown links, package
  shape, template build) with `NODE_ENV=test` and `TZ=America/New_York`;
- every workspace package, starting with `templates/package/`, builds ESM + `.d.ts` per file with
  `tsc`, keeping `"use client"` / `"use server"` directives;
- lefthook rejects a commit with Polish text or a lint warning, rejects a push with a failing test,
  and skips typecheck and lint on a Markdown-only commit;
- `.github/workflows/ci.yml` runs static, test and build jobs on every push and pull request;
- `context/workflow.json` gates are `npm run typecheck`, `npm run lint`, `npm test`.

## Approach

**Chosen:** root-level tooling (one `tsconfig.json`, one ESLint flat config, one Vitest config)
over all workspaces, `tsc` builds per package through a shared `tsconfig.build.json` pattern, a
custom export condition `@softure-ai/source` so typecheck and tests read `src/` without a build,
plain `.mjs` scripts for the hooks, and a template that is itself a private workspace package so
the whole pipeline is exercised before FD-3 adds the first real package.

Rejected: per-package lint/test configs run through `--workspaces` (slower hooks, N copies of the
same config, nothing to run today); TypeScript project references with `tsc -b` (every package
must list its references by hand; a topological script reads them from `package.json`);
tsup (frame.md).

## Phase 1: Toolchain and root gates

**Discipline:** TDD for the environment pin (it fixes a measured wrong value), test-after for the
configuration files.
**Files:** `package.json`, `package-lock.json`, `tsconfig.base.json`, `tsconfig.json`,
`eslint.config.mjs`, `vitest.config.mts`, `tests/repo/test-environment.test.ts`,
`context/workflow.json`.

0. Root `package.json` gets `"type": "module"`: under `NodeNext`, `.ts` files in a package without
   it compile as CommonJS, and `import.meta` in tests and configs fails to typecheck.
1. Install devDependencies: `typescript@~6.0.3`, `eslint@^10`, `@eslint/js@^10`,
   `typescript-eslint@^8.71`, `globals`, `vitest@^5`, `vite@^8`, `@types/node@^22`.
2. `tsconfig.base.json`: `target ES2023`, `lib [ES2023, DOM, DOM.Iterable]`,
   `module`/`moduleResolution` `NodeNext`, `strict`, `noUncheckedIndexedAccess`,
   `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`,
   `skipLibCheck`, `resolveJsonModule`, `jsx react-jsx`, `types [node]`,
   `customConditions ["@softure-ai/source"]`.
3. `tsconfig.json` (root, typecheck only): extends the base, `noEmit`, `allowJs`, `checkJs`,
   includes `**/*.ts`, `**/*.tsx`, `**/*.mts`, `**/*.mjs`; excludes `**/node_modules`, `**/dist`,
   `coverage`, `.claude`.
4. `eslint.config.mjs`: `globalIgnores` (`**/dist/**`, `coverage/**`, `.claude/**`),
   `@eslint/js` recommended, `typescript-eslint` `recommendedTypeChecked` with `projectService`,
   Node globals.
5. Write `tests/repo/test-environment.test.ts` first: asserts `process.env.NODE_ENV === "test"` and
   that `new Date("2026-01-01T03:00:00Z").getDate()` is `31` (New York is UTC−5). Run it with
   `NODE_ENV=production npx vitest run` before the pin and see it red.
6. `vitest.config.mts`: set `process.env.TZ = process.env.TEST_TZ || "America/New_York"` and
   `process.env.NODE_ENV = "test"` before `defineConfig`; `include` the repository tests and
   `{foundation,modules,tools,templates}/*/{src,tests}/**/*.test.{ts,tsx}`; `sequence.shuffle`;
   `maxWorkers: "50%"`; `testTimeout: 60_000`; `resolve.conditions` and `ssr.resolve.conditions`
   prepend `@softure-ai/source` to Vite's defaults. See the test green under the production shell.
7. Root scripts: `typecheck` (`tsc --noEmit`), `lint` (`eslint . --max-warnings 0`), `test`
   (`vitest run`), `test:watch`.
8. `context/workflow.json`: `gates` → `npm run typecheck`, `npm run lint`, `npm test`; every other
   key unchanged.

**Done when:** automated: `NODE_ENV=production npm test` is green and the environment test was
seen red before the pin; `npm run typecheck` and `npm run lint` exit 0; `workflow.json` gates
point at the three scripts and `worktree.cloudState` is still `"branch"`.

## Phase 2: Language gate

**Discipline:** TDD (a text classifier with clear inputs and outputs).
**Files:** `scripts/check-language.mjs`, `tests/repo/language.test.ts`, `package.json`.

1. Write `tests/repo/language.test.ts` first, against an exported `findPolishText(path, text)`:
   - a TS comment with a diacritic is reported with its line number;
   - an ASCII-only Polish sentence (assembled in the test, so the test file stays exempt only by path) is reported;
   - English text with "ten" or "to" is clean;
   - a Markdown inline code span with a FIRE slug (`` `src/app/nie-pamietam-hasla/` ``) is clean,
     the same words outside a code span are reported;
   - a file under a `messages/` segment is exempt (`isExempt`);
   - a hyphenated slug in code (`nie-pamietam-hasla`) is clean;
   - an empty file and a binary file (NUL byte) are clean;
   - test (a): every tracked file (`git ls-files`) passes.
2. Implement `scripts/check-language.mjs` (`// @ts-check`, JSDoc types): diacritic class
   (the nine Polish letters with diacritics, both cases) on every line; a fixed list of about 40 Polish function words that
   are not English words, matched whole-word and case-insensitive, not adjacent to letters, digits,
   `-`, `_`, `/` or `.`; Markdown inline code spans removed before the word match; exempt paths:
   any `messages/` segment, the gate itself and its test (they must spell the words);
   binary files (NUL byte) skipped; missing files skipped. CLI: `node scripts/check-language.mjs
   <files…>` or `--all` (tracked files); prints `path:line: <reason>` and exits 1 on any hit.
3. Root script `lint:language`; `lint` becomes `npm run lint:code && npm run lint:language` with
   `lint:code` = `eslint . --max-warnings 0`.

**Done when:** automated: the new tests were red before the implementation and are green after;
`node scripts/check-language.mjs --all` exits 0; a scratch file with a Polish comment passed to the
CLI exits 1 and prints its path and line.

## Phase 3: Roadmap contract and link tests

**Discipline:** TDD (parsers with fixtures).
**Files:** `tests/repo/roadmap-contract.test.ts`, `tests/repo/links.test.ts`,
`tests/repo/repo-files.ts` (shared helpers: repo root, tracked files).

1. Roadmap contract, fixtures first (inline strings): a valid roadmap passes; a row whose status is
   outside the vocabulary fails; a row/block status mismatch fails; `**in_progress** (research,
   since 2026-10-02; …)` in the row equals `in_progress (research, since 2026-10-02; …)` in the block;
   a queued roadmap with an `in_progress` row fails; a duplicate change-id fails.
2. Then the real files: `context/foundation/roadmap.md` and every
   `context/foundation/roadmaps/roadmap-*.md`: every `| **ID** |` row matches
   ``^\| \*\*([A-Z]+-\d+)\*\* \| `([^`]+)` \|``; the last cell is a WORKFLOW §5 status
   (`**` stripped); each ID has exactly one `### <ID>:` block with `- **Change ID:**` and
   `- **Status:**` directly under it, equal to the row; change-ids unique across all files; each
   change-id is a non-empty folder in exactly one of `context/changes/<id>/`,
   `context/backlog/roadmap-*/<id>/`, `context/archive/<YYYY-MM-DD>-<id>/`.
3. Links: fixtures first (a broken relative link fails, a link inside a code span or fence is
   ignored, an `https:` link and a `#anchor` are ignored, a link leaving the repo fails), then
   every tracked `*.md`: each relative link and image target resolves to a tracked file or a
   folder holding one (anchors stripped, `%`-decoding applied).

**Done when:** automated: fixture tests were red first; all three test files green on the real
tree; breaking one link in a scratch copy of a fixture is reported with file and target.

## Phase 4: Package template and builds

**Discipline:** TDD for the build order (graph logic) and the shape rules; test-after for the
template files.
**Files:** `templates/package/**`, `scripts/build-workspaces.mjs`,
`tests/repo/build-order.test.ts`, `tests/repo/packages.test.ts`, `package.json` (workspaces
`templates/*`, `build` script), `eslint.config.mjs` (boundary rule), `docs/02-module-standard.md`
(§12 build line).

1. `tests/repo/build-order.test.ts` first, against exported `orderWorkspaces(packages)`: a package
   depending on another builds after it whatever the input order; dependencies outside the
   workspace are ignored; a cycle throws an error naming the packages.
2. `scripts/build-workspaces.mjs`: discovers workspaces from the root `workspaces` globs (only
   `dir/*` forms), orders them, runs `npm run build -w <name> --if-present` one by one, stops on
   the first failure. Root script `build`.
3. `templates/package/` (docs/02 §2, without `./styles.css`, which FD-5 adds with its pipeline):
   `package.json` (`@softure-ai/template-module`, `private: true`, `type: module`, `files: [dist]`,
   `engines.node >=22`, `sideEffects: false`, exports `.`, `./server`, `./next`, `./ui` each as
   `{ "@softure-ai/source": "./src/…ts", "types": "./dist/….d.ts", "default": "./dist/….js" }`,
   scripts `build` = `tsc -p tsconfig.build.json`), `tsconfig.json` (extends the base, `include` its `src/**` and `tests/**`, because
   typescript-eslint's project service picks the nearest `tsconfig.json` for each file),
   `tsconfig.build.json` (`rootDir src`, `outDir dist`, declarations and maps,
   `customConditions []`), `module.json`, `README.md` with the 12 docs/02 §11 headings, `migrations/`,
   `src/{index,contract}.ts`, `src/server/index.ts`, `src/next/{index,actions}.ts` (`actions.ts`
   starts with `"use server"`), `src/ui/index.ts`, `src/messages/{pl,en,index}.ts`, and
   `tests/messages.test.ts`.
4. Add `templates/*` to root `workspaces` and run `npm install` so the template links as
   `@softure-ai/template-module`.
5. `tests/repo/packages.test.ts`: for every workspace package (template included): name
   `@softure-ai/<folder>` (the template: `template-module`), `type: module`, `files` includes `dist`,
   every export has the three conditions in order and its `src` file exists, `build` script and
   `tsconfig.build.json` present, README present; packages under `modules/` and the template have a
   `module.json` whose `id` is the name without scope and the 12 README headings; `pl` and `en`
   dictionaries have the same key paths. Plus: building the template with
   `tsc -p templates/package/tsconfig.build.json --outDir <tmp>` emits `index.js`, `index.d.ts`,
   `server/index.js`, `next/actions.js` that still starts with `"use server"`; and importing
   `@softure-ai/template-module` in a test resolves to the source (no build needed).
6. `eslint.config.mjs`: `no-restricted-imports` for `next` and `next/*` in `**/src/server/**` and
   `**/src/ui/**` (NFR-3); a test lints `import "next/headers";` with the file path of the template's
   `src/server/index.ts` through the ESLint API and expects that rule.
7. `docs/02-module-standard.md` §12: build line becomes `tsc` per package (ESM + `.d.ts`, directives
   kept) and the Tailwind CLI for `styles.css`, with a pointer to this change's frame.

**Done when:** automated: build-order and shape tests were red first; `npm run build` exits 0 and
`templates/package/dist/` holds `index.js`, `index.d.ts`, `next/actions.js` with its directive;
`git status --short` shows no `dist/` (ignored); the boundary-rule test is green.

## Phase 5: Hooks, CI and agent docs

**Discipline:** test-after (configuration verified by provoking each hook).
**Files:** `lefthook.yml`, `package.json` (`lefthook` devDependency, `prepare`),
`.github/workflows/ci.yml`, `AGENTS.md` (project section above the managed block).

1. Add `lefthook@^2.1` and `"prepare": "node -e \"process.exit(process.env.CI?0:1)\" || lefthook install"`.
2. `lefthook.yml`: `pre-commit` parallel jobs: `typecheck` (`glob` code and JSON extensions,
   `npx tsc --noEmit`), `lint` (`glob` code extensions,
   `npx eslint {staged_files} --max-warnings 0 --no-warn-ignored`), `language` (no glob,
   `node scripts/check-language.mjs {staged_files}`); `pre-push`: `test` (`npm test`, no glob,
   because the repository tests check Markdown too).
3. `.github/workflows/ci.yml`: on `push` (branches `**`, no tags) and `pull_request`;
   `permissions: contents: read`; concurrency per ref; jobs `static` (typecheck, lint, which
   includes language), `test` (`npm test`), `build` (`npm run build`); Node 22, `npm ci`.
4. `AGENTS.md`: a short "Gates and hooks" section (commands, what each hook runs, never
   `--no-verify`, `npm ci` installs hooks, `NODE_ENV=production` is handled).
5. Run `npm install` so the hooks install, then provoke each one in a scratchpad clone of this
   branch with `node_modules` symlinked from the checkout and `npx lefthook install` run there
   (never on the real history): a Polish comment commit, a lint-warning commit, a
   Markdown-only commit, a failing-test push to a local bare remote.

**Done when:** automated: `NODE_ENV=production npm ci` then `CI=1 npm ci` (no hook install,
exit 0); the four provocations behave as stated (rejected, rejected, typecheck and lint printed
as skipped, push rejected); `ci.yml` parses as YAML and lists the jobs `static`, `test`, `build`.
Manual: the first `ci` run on GitHub is green (owner, or agent if GitHub tools are available).

## Risks and rollback

- Hooks block a commit by mistake (false positive in the language gate) → fix the word list in
  `scripts/check-language.mjs`; `--no-verify` stays forbidden. Rollback of phase 5: revert its
  commit and run `npx lefthook uninstall`.
- `@softure-ai/source` leaks to consumers → it points at `src/`, which `files: [dist]` does not
  publish; a consumer would need to opt into this exact condition name. FD-2 may strip it at pack
  time; recorded for FD-2.
- TypeScript 6 deprecations surface in TS 7 → the base config uses no deprecated option (no
  `baseUrl`, no `moduleResolution node`), so the TS 7 switch is a version bump once
  typescript-eslint supports it.
- Every phase is one commit; reverting a phase is `git revert <sha>`.

## Decisions (auto)

- Complexity confirmation → large, kept as one change (every phase serves one gate set; splitting
  would leave hooks without tests to run).
- Build tool → `tsc` (frame.md).
- Template as a private workspace → yes: `npm run build`, typecheck, tests and the source condition
  get exercised by a real package before FD-3; `private: true` keeps FD-2 from ever publishing it.
- Hook scripts language → `.mjs` with `// @ts-check` (runs on any Node 22, still typechecked).
- Pre-push glob → none (the suite checks Markdown; it takes seconds).
- Language gate in `lint` → yes (`lint:code && lint:language`), so the `lint` gate, the static CI
  job and test (a) all enforce it.
- Test time zone → `America/New_York` (docs/02 §10: test zone ≠ UTC; FIRE precedent).
- `testTimeout` → 60 s globally (the template build test spawns `tsc`; global per FIRE's L-052
  reasoning, not per test).
- Import boundary rules → ESLint, not the architecture test (they run per staged file in the hook
  and in the editor).
- `./styles.css` export → left to FD-5 (research Open questions).
- Typed lint on `.mjs` → kept (the scripts are in the TS program through `checkJs`).
- (implement p2) Word adjacency also excludes `+` and `=`, and `package-lock.json` is exempt → base64
  integrity hashes can contain a listed word between those characters; the lockfile is generated.
- (impl review) A `commit-msg` job runs the language gate on the message (`--commit-msg` mode drops
  git's comment lines and the `git commit -v` diff) → AGENTS.md makes commit messages English and
  nothing else enforced it; see reviews/impl-review.md F1.
- (implement p5) Hook provocations ran in a scratchpad clone at 5cfebb6: a Polish comment and an
  unused `eslint-disable` directive (a warning) were rejected by `pre-commit`; a Markdown-only commit
  printed `typecheck (skip) no matching staged files` and `lint (skip)` and ran `language`; a commit
  with a failing test was rejected by `pre-push` (`1 failed | 62 passed`). In the same clone,
  `NODE_ENV=production npm ci` installed eslint, lefthook, tsc, vitest and both hooks, `CI=1 npm ci`
  installed no hooks, and typecheck, lint, test and build all exited 0 without a prior build.
- (implement p5) Action versions `actions/checkout@v7` and `actions/setup-node@v7` → the newest the
  owner already runs (FIRE_TRACKER `release.yml`, `integration-tests.yml`).
- (implement p4) Shape tests were written after the template; seen red by sabotage instead (export
  conditions reordered and the package renamed: 2 red; a Polish dictionary key renamed: parity and
  template build red), then restored from scratchpad copies.
- (implement p4) The template ships `migrations/README.md` instead of `.gitkeep` → it says what goes
  there; `files` also lists `migrations` and `module.json`, which a module publishes.
- (implement p4) Source and declaration maps point at `src/`, which `files` does not publish → left
  for FD-2 to decide when it packs (publish `src/` or drop the maps).
- (implement p3) Parsers live in `tests/repo/roadmap-contract.ts` and `tests/repo/markdown-links.ts`
  (files added to phase 3) → the test files stay readable and the helpers can be unit-tested.
- (implement p3) Repository tests read tracked plus untracked, not-ignored files
  (`git ls-files --cached --others --exclude-standard`) → a new change folder or document is
  checked by the gates that run before its first commit, and a link to a git-ignored file still
  fails as it would in CI.
- (implement p2) plan.md itself quoted the diacritic class and failed the gate → reworded; the gate
  checks diacritics everywhere, code spans included.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Toolchain and root gates

#### Automated
- [x] 1.1 `tests/repo/test-environment.test.ts` fails under `NODE_ENV=production npx vitest run` before the pin and passes after it — 03f56a1
- [x] 1.2 `npm run typecheck` and `npm run lint` exit 0 on the whole tree — 03f56a1
- [x] 1.3 `context/workflow.json` gates are `npm run typecheck`, `npm run lint`, `npm test`, and `worktree.cloudState` is still `"branch"` — 03f56a1
- [x] 1.4 Gates green (typecheck, lint, test) — 03f56a1

### Phase 2: Language gate

#### Automated
- [x] 2.1 Language tests fail before `scripts/check-language.mjs` exists and pass after — 366cb10
- [x] 2.2 `node scripts/check-language.mjs --all` exits 0 on every tracked file — 366cb10
- [x] 2.3 A scratch file with a Polish comment makes the CLI exit 1 and print `path:line` — 366cb10
- [x] 2.4 Gates green (typecheck, lint, test) — 366cb10

### Phase 3: Roadmap contract and link tests

#### Automated
- [x] 3.1 Roadmap fixture tests fail before the parser exists and pass after — 67c1cae
- [x] 3.2 Every roadmap file passes the contract (rows, vocabulary, block equality, unique ids, one location each) — 67c1cae
- [x] 3.3 Link fixture tests fail before the checker exists and pass after; every tracked `*.md` passes — 67c1cae
- [x] 3.4 Gates green (typecheck, lint, test) — 67c1cae

### Phase 4: Package template and builds

#### Automated
- [x] 4.1 Build-order tests fail before `orderWorkspaces` exists and pass after — 31a70df
- [x] 4.2 Package shape tests pass for the template; the template build keeps `"use server"` in `next/actions.js` — 31a70df
- [x] 4.3 A test imports `@softure-ai/template-module` from source without a build — 31a70df
- [x] 4.4 `npm run build` exits 0 and `dist/` stays untracked — 31a70df
- [x] 4.5 The ESLint boundary test reports `no-restricted-imports` for `next/headers` in `src/server/` — 31a70df
- [x] 4.6 Gates green (typecheck, lint, test) — 31a70df

### Phase 5: Hooks, CI and agent docs

#### Automated
- [x] 5.1 `NODE_ENV=production npm ci` installs devDependencies and the hooks; `CI=1 npm ci` skips the hook install — 5cfebb6
- [x] 5.2 `pre-commit` rejects a commit with a Polish comment and a commit with a lint warning — 5cfebb6
- [x] 5.3 A Markdown-only commit skips typecheck and lint and runs the language job — 5cfebb6
- [x] 5.4 `pre-push` rejects a push with a failing test — 5cfebb6
- [x] 5.5 `.github/workflows/ci.yml` parses and defines the jobs `static`, `test`, `build` — 5cfebb6
- [x] 5.6 Gates green (typecheck, lint, test) — 5cfebb6

#### Manual
- [ ] 5.7 The first `ci` workflow run on GitHub for this branch is green
