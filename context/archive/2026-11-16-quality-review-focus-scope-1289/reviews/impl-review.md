---
change_id: quality-review-focus-scope-1289
verdict: approved
---

# Implementation review (auto)

- Acceptance of #1289, point by point:
  - `run --focus security [--paths …]` and the workflow inputs exist; `general` stays the default, and a test pins the
    general system prompt (the 0.1 file) and the general task word for word, and a report without new rows.
  - The security prompt is `prompt/security-review.md`, shipped (`files: prompt`); a test checks every scenario of the
    issue and every security rule, the eight new ones included.
  - Findings outside `paths` are dropped (fixture monorepo test), also inside a scope.
  - `check` validates a security report and a scoped one (round trip `renderReport(parseReport(x)) === x`); ids do
    not depend on focus or scope (test: the same id scoped and whole).
  - `--scope <folder|@name>` resolves through `workspaces`; an unknown name, a missing folder, a file, the root, `..`,
    an absolute path and a symlink out of the repository fail before any model call (test: the query never runs and
    the old report stays).
  - The scope's AGENTS.md files on its path, README, package.json, CHANGELOG and test folders reach the task (test).
  - Report header `Focus`, `Scope`, `Paths`; default report path in the scope; per-scope ignore file with globs
    relative to the scope; per-scope branch and concurrency group in the workflow; README dispatch and matrix
    examples; cost line for security.
- Security of the tool itself: the agent's guards are unchanged (three read tools inside the checkout); scope files
  quoted in the task are framed as data; `paths` globs with `..` or an absolute path are refused; the workflow
  validates `focus`, `scope` and `paths` before use and the resolve step has no API key.
- Shell: the deliver step stays bash 3.2 compatible (no `${var^}`).
- Release: lockfile kept as on master except the package version (the release script rewrote unrelated `dev` flags,
  as in the theme-flat-paint 0.4.1 bump); `cli-version` default 0.2.0 equals the package version.
- Approved.
