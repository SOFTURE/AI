# Research: skills-bump-0-17

## Findings

- Registry: `@softure-ai/skills` versions end at 0.16.0 and 0.17.0; `latest` is 0.17.0. Installed: 0.15.0.
- Managed block changes from 0.15.0 to 0.17.0 (installer diff): a new autonomous rule "Verify, never leave checks
  for the owner", a coordinator duty to turn open owner checks into a verifying thread, `wt-roadmap.py done` refusing
  `Owner check:` lines (outside `cloudState: "branch"`), and a new `autonomy.remergeMain` value `"on-conflict"`.
- `"on-conflict"` merges a pull request as it is unless the merge would conflict (`--not-mergeable` or a conflicting
  trial merge), exactly the project section "Merging: master only on a conflict".
- `.claude/skills/` and `.claude/softure-skills.json` are git-ignored; only `AGENTS.md` changes in the tree.
