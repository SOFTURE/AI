---
change_id: marketing-kit-travel-overlays
verdict: approved
---

# Implementation review (auto)

- Old overlay tests pass unchanged; the new test file covers every kind at its bounds, the hook guards, markup and
  draft events, and burns a draft through libass.
- Render and draft contact sheets of every new kind compared: same boxes, pin and magnifier drawn, counter and typing
  step correctly, no wrapped lines.
- `tests/repo/deploy-workflows.test.ts` needs `ssh-keygen`, absent in the review container; unrelated to this change.
