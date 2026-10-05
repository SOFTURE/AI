# Plan: blog-skill-check-without-database

Input: change.md. Complexity: small (one phase).

## Goal

- `softure-blog skill install` and `softure-blog skill install --check` load an app config whose
  `database.url` is missing or empty; the config they get has `database: null`, and they run as today.
- `softure-blog publish` loads the config as today (database required).
- The blog README says which commands need no database URL.

**Out of scope:** `softure migrate` and `softure-mail` (they connect); release or version bumps (releases
stay with the owner).

## Approach

**Starting point:** `modules/blog/src/cli/command.ts` passes `database: "optional"` only for `check`.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Which commands are optional | every command but `publish` (`check`, `skill-install`) | the only one that opens the database; a new command defaults to required unless listed | plan |
| Shape | a `kind` set of commands that never connect, read by the bin | names the reason once; one place to add a command | plan |
| Test fixture | BF-6's `without-database.config.mjs`, copied per test | its variable is asserted unset (BF-6 plan review W1) | BF-6 |

## Phase 1: Optional database for `softure-blog skill install`

**Discipline:** TDD. **Files:** `modules/blog/src/cli/command.ts`, `modules/blog/tests/cli.test.ts`,
`modules/blog/README.md`.

1. Test first in `cli.test.ts`, block "with a config without a database URL": `skill install` writes the
   skill (exit 0, the `skill: installed` line), then `skill install --check` over the same folder says it
   is up to date (exit 0); both fail before the change with the load error.
2. `command.ts`: `const COMMANDS_WITHOUT_DATABASE = new Set(["check", "skill-install"])`; `database` is
   `"optional"` for those; the comment says neither connects.
3. README: the `check` paragraph becomes one about `check` and `skill install` (no database URL; the
   app-script variant wraps its import with `withDatabaseOptional`); the skill section's CI sentence says
   the job needs no `DATABASE_URL`.

**Tests:** the bin's `skill install` and `skill install --check` over the fixture without a URL (exit 0,
no errors); the existing `publish` refusal over the same fixture stays.

**Done when:**
- Automated: the new test passes and failed before step 2; the existing blog cli, skill-cli and check-cli
  tests pass unchanged; gates green (typecheck, lint, test, build).

## Risks and rollback

- A future command that connects lands in the optional set by mistake → the set lists the commands that
  are optional, so a new one is required by default.
- Rollback: revert the phase commit. Nothing persistent changes.

## Decisions (auto)

- A set or a second ternary branch? → a set of the commands that never connect: the reason stays in one
  comment and the default for a new command is "required".

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Optional database for `softure-blog skill install`

#### Automated
- [ ] 1.1 The bin's `skill install` and `skill install --check` run over a config without a database URL
- [ ] 1.2 `publish` over the same config still refuses it; existing blog cli tests pass unchanged
- [ ] 1.3 Gates green (typecheck, lint, test, build)
