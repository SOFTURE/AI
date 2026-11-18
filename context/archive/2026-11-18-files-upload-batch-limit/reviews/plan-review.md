# Plan review: files-upload-batch-limit

- Suggestion (accepted): keep the limit rather than replace it with a queue; the bound on unfinished sessions per owner
  is the point of the option, and an app that needs more already sets it.
- Suggestion (accepted): the test also pins that an expired session stops counting and that the quota is checked
  independently of the session limit, so the loosened default cannot hide a regression in either.

Verdict: proceed.
