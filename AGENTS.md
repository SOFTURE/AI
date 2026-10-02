# SOFTURE AI: agent rules

## Language: English only in code

Everything that lands in the repository is written in **English**: code, identifiers, comments,
commit messages, script output, log and error messages, file and folder names, configuration keys,
and skill or agent instructions. This holds even when the conversation with the owner is in Polish.

- Do not translate the conversation into the code. A Polish request still produces English code.
- User-facing product copy is the only exception. It lives in message dictionaries (e.g. `messages/pl.ts`),
  never inline in code.
- When you touch a file that contains Polish code, comments or identifiers, translate them in the
  same change.
- Before every commit, check the diff for Polish (Polish diacritics and Polish words) outside
  message dictionaries. Treat any hit as a failing gate. `npm run lint:language` does this check
  (the `pre-commit` hook runs it on staged files).

## Gates and hooks

```bash
npm ci                 # installs devDependencies (also under NODE_ENV=production, see .npmrc) and the git hooks
npm run typecheck      # tsc over the whole tree; packages resolve to src/ through the @softure-ai/source condition
npm run lint           # ESLint (typed rules, zero warnings) + the language gate over every tracked file
npm test               # Vitest: package tests and the repository tests in tests/repo/
npm run build          # tsc builds of every workspace package, in dependency order
```

- `lefthook.yml`: `pre-commit` runs typecheck, ESLint on staged files and the language gate in
  parallel (a Markdown-only commit skips typecheck and lint); `commit-msg` runs the language gate
  on the message; `pre-push` runs `npm test`.
- Never `--no-verify`. A red hook is a red gate: fix the cause.
- `.github/workflows/ci.yml` runs the same gates (static, test, build) on every push and pull request.
- The repository tests guard the docs too: the roadmap contract (WORKFLOW §5), relative links in
  every `*.md`, and the shape of every workspace package. Start a package by copying
  `templates/package/`.
- Tests run with `NODE_ENV=test` and `TZ=America/New_York` whatever the shell exports
  (`vitest.config.mts`).

<!-- softure-skills:begin (managed by @softure-ai/skills, do not edit) -->
# SOFTURE workflow and conventions

Installed by `@softure-ai/skills`. Project-specific rules outside this block take precedence,
except the language rule below (when this block carries it), which always applies.

## Language: English in everything you write to the repository (mandatory)

Code, identifiers, comments, commit messages, script and log output, error messages, file and
folder names, configuration keys, and agent or skill instructions are written in **English**.
This holds even when the conversation with the user is in another language.

- A request in another language still produces English code. Do not carry the conversation
  language into the code.
- The only exception is user-facing product copy. It lives in message dictionaries
  (e.g. `messages/pl.ts`), never inline in code.
- When you touch a file with non-English code, comments or identifiers, translate them in the
  same change.
- Before every commit, scan the diff for non-English text outside message dictionaries. Any hit
  is a failing gate, just like a red test.

## How work flows

Work happens as a chain of skills. Each one leaves a file in `context/` that the next one reads.
The full contract is in `node_modules/@softure-ai/skills/WORKFLOW.md`.

- **Product:** `softure-init` → `softure-shape` → `softure-prd` → `softure-roadmap`. Use
  `softure-frame` whenever the problem itself is in doubt.
- **One change:** `softure-new` → `softure-research` → `softure-plan` → `softure-plan-review` →
  `softure-implement` → `softure-impl-review` → `softure-archive`.
- **In parallel:** `softure-worktree` runs one change end to end in its own worktree.
  `softure-worktree-manager` runs several at once and merges them.
- **Any time:** `softure-code-review`, `softure-rule-review`, `softure-lesson`.

Execution state lives only in the `## Progress` section of `plan.md`. Commands, the main branch
and the artifact language come from `context/workflow.json`. Before building anything generic
(auth, mail, feature switches, billing, GDPR, analytics, UI primitives), check the
`@softure-ai/*` modules.

## Conventions

**Code**
- Name things by what they do: functions start with a verb, booleans read as questions
  (`isActive`, `hasAccess`), constants are UPPER_SNAKE_CASE, and a file is named after its main export.
- One function does one job. More than three inputs become an options object. Return early
  instead of nesting.
- Functions that read (`get*`, `find*`, `is*`) have no side effects.

**TypeScript**
- External data enters as `unknown` and is narrowed with a schema (zod) at the boundary.
- Model alternatives as discriminated unions, not as bags of optional fields.
- `any` and non-null assertions need a comment that says why.

**Errors**
- Every awaited call either handles its failure or deliberately lets it propagate. Nothing is
  swallowed silently.
- Error messages name the operation and the input that failed. Users never see stack traces
  or internal paths.
- Expected failures are returned as values (result types). Exceptions are for bugs.

**Data**
- An invariant that can be a database constraint is one. Code checks are a second line, not the only one.
- SQL is always parameterized. Migrations move forward only and say how to roll back.
- A write that depends on a read happens in one transaction, with a conditional `UPDATE` or a lock.

**Security**
- Secrets come from the environment and are never logged.
- Every server action and route checks authorization, not just a session.
- Public endpoints are rate-limited and validate their input.

**React / Next.js**
- Server components by default. Use client components only for interaction.
- User-visible text, including `aria-label`, goes through the project's message layer.
- Styling uses design tokens. Raw colours and magic sizes are not allowed.

**Tests**
- A test name states the behaviour. Each test builds and cleans up its own data.
- Assert exact values. Cover empty, boundary and failure cases.
- A bug fix starts with a test that fails without it.
<!-- softure-skills:end -->
