# Plan: cli-config-loader

Input: change.md, research.md. Complexity: small (one phase, follows the existing copies).

## Goal

- `@softure-ai/core/cli` (new subpath, `foundation/core/src/cli/`) exports the config loading every module
  command shares: `DEFAULT_CONFIG_FILES`, `takeConfigOption(argv)`, `findDefaultConfig(cwd)`,
  `loadConfig(path, appScript)` and `loadAppConfig({ cwd, configPath, appScript })` (find, then load, with
  the "no config found" message).
- `softure migrate`, `softure-mail` and `softure-blog` use it; their `cli/command.ts` keep only their own
  flow (help, subcommand, `needsConfig`, the name prefix on each problem).
- The three bins' existing tests pass without a change to their expected messages.

**Out of scope:** a config without a database (BF-6); new config file names; changing any message text;
release or version bumps (every package is `0.0.0` and unpublished; releases stay with the owner).

## Approach

**Starting point:** three copies of the same ~45 lines (research §Current state:
`foundation/db/src/cli/command.ts:58-101`, `modules/mailing/src/cli/command.ts:54-93`,
`modules/blog/src/cli/command.ts:54-93`), differing only in the app-script hint and db's looser
`isConfigLike`.

**Chosen:** a `./cli` subpath of `@softure-ai/core` - every bin's package already depends on core, the
loader needs only core's types and Node built-ins, and the root entry stays free of `node:` imports.
Rejected: `@softure-ai/db/cli` - pulls the migrator into every command and ties config loading to the
database package; a new `@softure-ai/cli` package - a whole package for ~60 lines.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Home | `@softure-ai/core/cli` | all three depend on core; no `node:` in core's root entry | research |
| Result shape | discriminated unions `{ ok: true, … } \| { ok: false, problem }` instead of "value or string" | AGENTS.md: alternatives as discriminated unions | plan |
| Name prefix | stays in each bin; the loader returns the bare problem | bins prefix differently (`softure migrate:` vs `softure:`) | research |
| App-script hint | parameter `appScript: { runner, packageName }` | the only text that differs between copies | research |
| Config check | `modules` array and a `database` key for all three | `defineSoftureConfig` always sets `database`; one check, typed `SoftureConfig` | research Risks |
| Find + load | `loadAppConfig` combines them, so the "no config found" text lives once too | the outcome: error texts once | plan |

## Phase 1: Shared loader in core, used by the three bins

**Discipline:** TDD. **Files:** `foundation/core/src/cli/load-config.ts`, `foundation/core/src/cli/index.ts`,
`foundation/core/package.json`, `foundation/core/tests/cli.test.ts`, `foundation/core/tests/fixtures/cli/*`,
`foundation/core/README.md`, `foundation/db/README.md`, `foundation/db/src/cli/command.ts`, `modules/mailing/src/cli/command.ts`,
`modules/blog/src/cli/command.ts`.

1. `foundation/core/tests/cli.test.ts` with fixtures (a default-export config, a `config`-named export, an
   object without `modules`, a file that throws on import): the cases below, failing first.
2. `foundation/core/src/cli/load-config.ts`: the five exports. Contracts:
   `takeConfigOption(argv) → { ok: true; configPath: string | undefined; argv: string[] } | { ok: false; problem: string }`;
   `findDefaultConfig(cwd) → string | undefined`;
   `loadConfig(path, appScript) → Promise<{ ok: true; config: SoftureConfig } | { ok: false; problem: string }>`;
   `loadAppConfig({ cwd, configPath, appScript })` → the same result as `loadConfig`;
   `appScript: { runner: string; packageName: string }`. Texts copied verbatim from the copies.
3. `foundation/core/src/cli/index.ts` re-exports them; `package.json` gains the `./cli` export (source,
   types, default) after `./next`.
4. The three `command.ts` files drop their copies and the now unused imports, and call `takeConfigOption`
   and `loadAppConfig` with their own prefix and hint (`runMigrateCli`/`@softure-ai/db`,
   `runMailCli`/`@softure-ai/mailing`, `runBlogCli`/`@softure-ai/blog`).
5. `foundation/core/README.md`: §1 names the `cli` entry; a short paragraph under §4 (Mounting) shows how a
   module's bin uses it. `foundation/db/README.md`: the paragraph on how `softure migrate` finds the config
   says the lookup is `@softure-ai/core/cli`'s, shared with the other module commands.

**Tests:** `takeConfigOption` (`--config x`, `--config=x`, missing value at the end, value starting with
`--`, other arguments kept in order, no option); `findDefaultConfig` (first existing name in the list order,
none); `loadConfig` (default export, `config` export, missing file text, not-a-config text, import failure
text with the hint); `loadAppConfig` (explicit path resolved against `cwd`, default found, none found:
the exact "no config found" text). The bins' tests (`foundation/db/tests/cli.test.ts`,
`modules/mailing/tests/cli.test.ts`, `modules/blog/tests/cli.test.ts`) unchanged, and db's container bundle
test (`foundation/db/tests/bundle.test.ts`), which bundles `@softure-ai/db/cli` and so now
`@softure-ai/core/cli`.

**Done when:**
- Automated: the core cli tests pass; the three bins' cli tests and db's bundle test pass with no change to
  their files; no
  `function takeConfigOption|findDefaultConfig|loadConfig` left in the three `command.ts` files (grep);
  Gates green (typecheck, lint, test).

## Risks and rollback

- A message drifts in the move → the bins' unchanged tests pin them; core tests assert exact texts.
- The new export breaks the package shape rules → `tests/repo/packages.test.ts` runs in the gates.
- Rollback: revert the phase commit; nothing persistent changes.

## Decisions (auto)

- Where does the loader live? → `@softure-ai/core/cli` (research verdict).
- Keep db's looser config check? → no, one check with `database` (no real config changes behaviour).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Shared loader in core, used by the three bins

#### Automated
- [ ] 1.1 The core cli tests pass (option parse, default file, load, find and load)
- [ ] 1.2 The db, mailing and blog cli tests and db's bundle test pass with their test files unchanged
- [ ] 1.3 No copy of `takeConfigOption`, `findDefaultConfig` or `loadConfig` remains in the three `command.ts` files
- [ ] 1.4 Gates green (typecheck, lint, test)
