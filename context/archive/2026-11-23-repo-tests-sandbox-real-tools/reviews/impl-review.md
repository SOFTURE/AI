---
change_id: repo-tests-sandbox-real-tools
verdict: approved
---

# Implementation review

Reviewed the diff against `plan.md` and issue #1424.

- **Acceptance 1:** the four tests from the issue pass in this container, whose `PATH` starts with a guarded `rm`;
  with the old lookup they and the new resolver test fail (5 of 96).
- **Acceptance 2:** typecheck and lint green.
- **Acceptance 3 (macOS):** every listed tool is in `/usr/bin` or `/bin` there, and anything else keeps the old
  `PATH` lookup; the sandbox still links only the listed tools, so no `gh` gets in.
- Test-only change; the step under test and the workflows are untouched, so no release.

Findings: none.
