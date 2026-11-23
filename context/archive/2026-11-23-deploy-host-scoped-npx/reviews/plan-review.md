---
change_id: deploy-host-scoped-npx
verdict: approved
---

# Plan review

- Covers the issue's acceptance criteria: operator-facing examples and the CLI's next step use the scoped, pinned
  form; a test pins the message.
- The printed `app add` command gains `--inventory=<path>`, which the command requires; the old line could not run
  as printed.
- The `app add` message stays in app context on purpose and says so; no version guessed.
- Text-only change in both packages; no generated file changes, so adopting apps need nothing.

Verdict: approved, no changes.
