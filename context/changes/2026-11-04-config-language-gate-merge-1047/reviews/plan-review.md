---
change_id: config-language-gate-merge-1047
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (b83ea31).

- Acceptance of #1047: a merge commit whose staged files carry Polish lines from the main branch passes (phase 1);
  lines written during the merge still fail (phase 1 test); `--all` and `--commit-msg` unchanged.
- Safety: the filter only drops hits whose exact line text already exists in a parent, which passed (or bypassed) the
  gate there; any git error returns `null`, so the file is checked in full.
- Known looseness: a Polish line moved or duplicated within the merge passes, since its text exists in a parent. It is
  not new text, so this matches the issue's intent.
- The repository's own hook uses the same `runCheckLanguage` through the bin entry, so it gets the fix too.

Verdict: approved, no changes.
