---
change_id: theme-kit-default-border-746
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, issue #746, `themes/theme-kit/src/base.css`, `preflight.css` and both
theme-notion README wirings.

- Scope: one base rule and its tests and docs; no component class string changes, no new export, no version bump.
- Cascade: `base.css` follows Tailwind's preflight in `@layer base` in both wirings, so the rule wins over
  `border: 0 solid`; utilities stay above it. Checked against `@softure-ai/ui`'s `softure` layer: above `base`, so
  its explicit colours win.
- Risk: the universal rule also reaches SOFTURE package pages in the mixed wiring; acceptable, the bridge already maps
  their border token to `--border`.
- Tests: the compiled-stylesheet assertion fails today (no such rule) and pins the order after the preflight.

Verdict: approved, no changes.
