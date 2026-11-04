# Plan review: ci-macos-on-script-changes

Verdict: approved.

- Scope matches change.md: one workflow moved, one test block, one sentence in `AGENTS.md`.
- The `paths` list covers what the tests execute and read (research.md); the repository test ties the list to the
  vitest command so the two cannot drift apart.
- Risk: a portability regression in a file outside the list (none known) would surface only on the weekly run or on
  the owner's pre-push; accepted by the owner's choice.
- `ci.yml` keeps its triggers and stays without a paths filter.
