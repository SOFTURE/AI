# Research: quality-review focus, paths and scope (issue #1289)

## Current package (0.1.1)

- `review.ts` `runReview`: deletes the old report, reads the ignore rules (`quality-review.ignore`, AGENTS.md
  section), runs the agent with `prompt/quality-review.md` as the system prompt and a short task (`buildTask`), keeps
  the `<finding>` blocks, `verifyLocations`, `dedupeFindings`, `applyIgnoreRules`, `renderReport`.
- `findings.ts`: `CATEGORY_RULES` drives the zod schema of a finding, the parser's rule check and the ignore file's
  `rule` lines. Adding rules to `security` extends all three at once; existing ids do not change (the id hashes the
  rule name, file and symbol).
- `report.ts`: header table with fixed fields; `parseReport` reads rows by name from the table, so optional rows
  (`Focus`, `Scope`, `Paths`) can be added without a format bump as long as a general report has none of them.
- `cli/command.ts`: `run` and `check`; `--out` defaults to `QUALITY-REPORT.md`.
- `ignore.ts`: `matchesGlob` (`**`, `*`, `?`) already serves path globs; it serves `paths` and scope filters too.
- Workflow: `review` job (key, contents read) and `deliver` job (write, no key); branch input `quality-review`;
  `tests/repo/quality-review-workflow.test.ts` pins the shape (only the review step sees the key, one `git push`, the
  `cli-version` default equals the package version).

## Workspaces

Root `package.json` `workspaces` lists globs such as `foundation/*`, `modules/*`, `tools/*`, `themes/*`,
`templates/*`. A package name resolves by expanding each pattern (a trailing `/*` lists subfolders; other entries are
literal folders) and reading each folder's `package.json` `name`. An app repository may have no workspaces: then only
a folder scope works and a package name fails clearly.

## Decisions taken from the issue

- `paths` globs are repository-relative, like every other glob of the package; with `scope` a finding must be inside
  both.
- The scope's ignore file lives at `<scope>/quality-review.ignore`; its globs are relative to the scope folder (the
  natural reading for a package-local file); id lines work as anywhere.
