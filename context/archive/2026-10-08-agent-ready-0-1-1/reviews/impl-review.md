# Implementation review: agent-ready-0-1-1

Verdict: approve. Diff matches the plan; no code change.

Checked:

- README § 2: the three commands and their arguments match the usage text in `src/cli/run.ts`; each row points to
  the paragraph of section 4 that describes it.
- `release:version` set 0.1.1 in `package.json`, `module.json`, the inline manifest of `src/index.ts` and the lockfile,
  and promoted `## Unreleased` to `## 0.1.1`; its local tag was deleted (auto-release creates the tag on master).
- Gates: typecheck, lint (with the language gate) and build green; `tests/repo` and the agent-ready tests green
  (26 files); the full `npm test` runs in `pre-push`.
- `release.yml` is unchanged: agent-ready exists on npm, so `publish-npm` takes the OIDC path.

Findings: none. Item 1.4 (provenance on npm) is checked by the thread after the release and reported to the owner;
it does not block the archive.
