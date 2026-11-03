---
change_id: deploy-worker-bundle-marketing-kit-995
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (fe3e7b5).

- Scope: the issue's three proposals are covered (external kit with a comment, a bundle test with the generated
  command, a CHANGELOG line for 0.5.0 apps).
- The test reads the flags from the generated file, so it guards the template itself, not a copy of its flags.
- `--packages=external` is rejected with a concrete reason (the `server-only` alias); the narrower flag is enough for
  the measured case.
- Compatibility: only the worker starter changes; the app Dockerfile and its tests stay byte for byte the same.

Verdict: approved, no changes.
