# Plan review: skills-merge-on-conflict

Verdict: approved.

- Scope matches change.md: one dependency bump, the installer's block, one project section.
- Risk: 0.15.0 rules beyond Merging apply to coordinator and threads from the merge on; they are the package's
  intended behaviour and need no code change here (issues mode, `cloudState: "branch"`).
- The project rule is placed outside the managed block, so the next installer run keeps it.
