---
change_id: remove-stray-node-modules-link
verdict: approved
---

# Plan review

One tracked symlink removed, one ignore pattern widened; `node_modules` matches directories and files alike, so no
tracked file is newly ignored (`git ls-files -i -c --exclude-standard` is empty). Verdict: approved.
