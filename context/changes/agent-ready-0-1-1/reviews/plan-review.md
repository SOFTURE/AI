# Plan review: agent-ready-0-1-1

Verdict: approve. Trivial documentation patch with a version bump.

Checked:

- The claim behind D1 against `release.yml` (`publish-npm`, the `lookup` of the package name): a known package
  never gets `NODE_AUTH_TOKEN` from `NPM_TOKEN`, so the publish authenticates with the job's OIDC token
  (`id-token: write`) and `--provenance`. Holds.
- D2 against `scripts/release/README.md`: `release:version` needs a clean tree and a non-empty `## Unreleased`;
  the plan writes the entry first and runs it on a committed tree. Holds.
- The README table against `src/cli/run.ts` (usage lines): the three commands and their arguments match.

Findings: none.
