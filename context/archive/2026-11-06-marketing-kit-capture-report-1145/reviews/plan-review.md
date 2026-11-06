---
change_id: marketing-kit-capture-report-1145
verdict: approved
---

# Plan review (auto)

- Scope matches change.md: the field the issue asks for, the README sentence; no manifest, no lockfile.
- The format is read from hyperframes 0.9.6's own source (research.md), not guessed; the parser accepts a line only
  when every part is known, so a progress or log line with a `·` does not count.
- Risk: a hyperframes upgrade changes the format. The result is then null (never a failed render) and the pinned
  version's tests catch it on the bump.
- Approved.
