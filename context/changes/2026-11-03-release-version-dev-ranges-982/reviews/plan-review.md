---
change_id: release-version-dev-ranges-982
verdict: approved
---

# Plan review: release-version-dev-ranges-982

- Covers both asks of #982 plus a repo guard; scope matches change.md (scripts and tests only).
- Risk checked: the stricter shared check also gates `release:pack`; measured green on master (research), and a
  tag that fails it would indeed test against a registry copy, so the refusal is right there too.
- Restore path: `git checkout -- .` restores tracked files only; npm's `node_modules` changes need `npm ci`, and the
  message says so. Acceptable: the tree was clean before (the script refuses a dirty one).
- The guard compares before/after, so a pre-existing copy does not block every bump; the repo test makes such a copy
  impossible to commit. Consistent.
- Tests name behaviour and assert exact values. Approved without changes.
