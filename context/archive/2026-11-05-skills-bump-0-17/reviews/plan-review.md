# Plan review: skills-bump-0-17

Verdict: approved.

- Scope matches change.md: one dependency bump, the installer's block, one config key, one project section.
- Risk: the new 0.17.0 rules apply to coordinator and threads from the merge on; issues mode and
  `cloudState: "branch"` need no code change.
- The project section stays above the block marker, so a later installer run keeps it.
