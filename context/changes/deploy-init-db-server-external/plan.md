# Plan: deploy-init-db-server-external

Input: change.md (research and framing skipped, reasons there). Complexity: small (two phases, one package).

## Goal

`softure-deploy init` warns, next to the `standalone` warning, when the database part is on and the app's
`next.config.*` does not name `@softure-ai/db` in `serverExternalPackages`; tests cover the three cases of the issue;
README line and deploy 0.1.4.

**Out of scope:** checking the driver entries (`pg`, `@electric-sql/pglite`) themselves, parsing the config with a
TypeScript parser, editing the app's config, the db README section itself (PR #185).

## Findings (the reading behind the plan)

- `tools/deploy/src/init/app-facts.ts`: `readAppFacts` finds the first of `next.config.{ts,mts,js,mjs}` and sets
  `isStandalone` by a plain `includes("standalone")` on its text. `hasDatabase` is `@softure-ai/db` in
  `dependencies` or `devDependencies`.
- `tools/deploy/src/cli/init-command.ts` `listWarnings(facts)`: no config → one warning; config without
  `standalone` → one warning; otherwise none. Lines are printed as `warning <text>` before the summary line.
- `AppFacts` is part of the public API (`src/init/index.ts` → `src/index.ts`) and is built by hand in
  `generate.test.ts`, `server-files.test.ts`; `scripts/write-e2e-app.ts` calls `readAppFacts`.
- `tools/deploy/tests/init-cli.test.ts` runs the CLI on a temp folder (`writeApp(pkg, nextConfig)`) and asserts the
  printed lines.
- `foundation/db/README.md` §2 is "Installation"; on master it says the drivers are regular dependencies. PR #185
  (#179) makes them optional peers and documents `serverExternalPackages` (the issue: "db README §2").
- Deploy README, "Read from the app": "a `next.config.*` without `standalone` is a warning."

## Key decisions

- **D1 detection.** A new optional `AppFacts` field `isDbServerExternal?: boolean`, set by `readAppFacts` from the
  config text: when the text has a literal `serverExternalPackages: [ … ]`, the entry must be a quoted
  `"@softure-ai/db"` inside that array; when the list is not a literal array (built from a variable), the file must
  mention both `serverExternalPackages` and the quoted package name. Without a config file the field is `false`
  (no warning is printed then: the missing-config warning already covers it). Text matching, like `isStandalone`,
  and leaning towards no warning when the shape is unusual.
- **D2 optional field.** Optional, so callers that build `AppFacts` by hand still compile; absent means "not
  checked" and gives no warning.
- **D3 warning text.** `<file> does not list "@softure-ai/db" in serverExternalPackages; next build cannot resolve
  the database driver the app does not install (see serverExternalPackages in the @softure-ai/db README, §2
  Installation)`. It names the entry and the section without depending on a heading #185 has not merged yet.
- **D4 order.** The `serverExternalPackages` warning follows the `standalone` warning; both can appear. With no
  config file only the existing warning appears.

## Phase 1: the warning (TDD)

**Discipline:** TDD. **Files:** `tools/deploy/src/init/app-facts.ts`, `tools/deploy/src/cli/init-command.ts`,
`tools/deploy/tests/init-cli.test.ts`.

- Tests (CLI): database app with `serverExternalPackages: ["@softure-ai/db", "pg"]` → no warning; database app
  with `serverExternalPackages: ["pg"]` → the warning; database app with no `serverExternalPackages` → the warning;
  database app whose list is a variable naming the package → no warning; app without `@softure-ai/db` and no list →
  no warning; database app without `standalone` and without the entry → both warnings, in that order.
- Code: `isDbServerExternal` in `app-facts.ts`; `listWarnings` in `init-command.ts`.

Done when: the new tests were seen red, then green; gates green.

## Phase 2: docs and version

**Discipline:** test-after (docs). **Files:** `tools/deploy/README.md`, `tools/deploy/package.json`,
`package-lock.json`.

- README "Read from the app": the new warning. Version 0.1.4, lockfile via `npm install --package-lock-only`.

Done when: gates green (typecheck, lint, test, build).

## Risks and rollback

- False warning on an unusual config shape (a spread from another file): the warning is advice only, `init` still
  writes every file and exits 0. Rollback: revert the two phase commits.

## Decisions (auto)

- Where the warning points → "see serverExternalPackages in the @softure-ai/db README, §2 Installation" (PR #185 is
  not merged; the issue names §2; naming the key keeps the pointer right whatever the subsection is called).
- New `AppFacts` field required or optional → optional (the type is public; backward compatible).
- Check the driver entries too → no (the issue asks for `@softure-ai/db`; which driver an app installs is not
  known from `package.json` alone when it relies on the package's own).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: the warning

#### Automated
- [ ] 1.1 CLI tests for the three cases of the issue (plus variable list and both warnings) seen red, then green
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: docs and version

#### Automated
- [ ] 2.1 README line, deploy 0.1.4 and the lockfile, gates green (typecheck, lint, test, build)
