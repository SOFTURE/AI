# Research: cli-config-loader

Input: change.md (BF-1). Mode: autonomous.

## Current state

| Copy | `isConfigLike` | "cannot load" hint | Caller specifics |
| --- | --- | --- | --- |
| `foundation/db/src/cli/command.ts:58-101` | `modules` array only; typed `Pick<SoftureConfig, "database" \| "modules">` | `call runMigrateCli … (see the @softure-ai/db README)` | `--help` before the option parse; `migrate` subcommand |
| `modules/mailing/src/cli/command.ts:54-93` | `modules` array and a `database` key | `call runMailCli … (see the @softure-ai/mailing README)` | skips the config when `needsConfig` says so |
| `modules/blog/src/cli/command.ts:54-93` | `modules` array and a `database` key | `call runBlogCli … (see the @softure-ai/blog README)` | parses the command before loading |

Everything else is identical text: `DEFAULT_CONFIG_FILES` (`softure.config.{ts,mts,js,mjs}`), the
`--config <file>` / `--config=<file>` parse and its "--config needs a file path" problem, the "no config
found; looked for … in <cwd>; pass --config <file>" message, "config file <path> does not exist", and
"<path> must export (default or as \"config\") the result of defineSoftureConfig". Each bin prefixes the
problem with its own name (`softure:`, `softure-mail:`, `softure-blog:`; the option problem with
`softure migrate:` in db).

Tests that pin the messages: `foundation/db/tests/cli.test.ts:186-222`,
`modules/mailing/tests/cli.test.ts:229-250`, `modules/blog/tests/cli.test.ts:255-275`.

## Where the loader can live

- `@softure-ai/core`: every package with a bin depends on it; the loader depends only on core's
  `SoftureConfig` type and Node built-ins. Core has no Node imports today, so the loader needs its own
  subpath (`@softure-ai/core/cli`) to keep the root entry free of `node:fs`.
- `@softure-ai/db/cli`: mailing and blog depend on db already, but importing it pulls the migrator into
  every command, and a future command of a module without a database (seo, marketing-kit) would depend on
  db for config loading only. BF-6 (a config without a database URL) also reads better against core.

Verdict: a `./cli` subpath of `@softure-ai/core`.

## SOFTURE modules

No module covers command-line config loading; this change creates the shared piece.

## Risks

- db's `isConfigLike` accepts an object without a `database` key; the shared check requiring it makes
  `softure migrate` refuse such a hand-written object with the "must export … defineSoftureConfig"
  message instead of "the config has no database". `defineSoftureConfig` always sets `database`, so no
  real config changes behaviour; db's `no-modules.config.mjs` fixture is refused either way.
- Core's `package.json` exports gain an entry; `tests/repo/packages.test.ts` checks its shape.

## Open questions

None.
