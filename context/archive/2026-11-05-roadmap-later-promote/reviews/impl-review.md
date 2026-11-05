# Implementation review: roadmap-later-promote

Verdict: approved.

- `roadmap.md` is the former queued file (`git mv`), `status: ready`, version 2; rows and blocks agree (LT-4 and LT-5
  `ready`); `wt-startable.py` prints `START LT-4` and `WAIT LT-5 waiting for LT-4`.
- Both entries live only in `context/changes/<id>/backlog-input.md`; the backlog folder is gone, and the archived
  files that linked the queued roadmap or its backlog folder now link `roadmap.md`.
- The roadmap contract test asked for queued roadmaps to exist; it now checks only that the main roadmap exists,
  since an empty queue is valid.
- `context/workflow.json`: `autonomy.reports.hours` is `null`.
- Gates: pre-commit (typecheck, ESLint, language) green; pre-push repository tests 849 passed, 69 skipped.
