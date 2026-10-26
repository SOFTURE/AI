---
change_id: ui-disclosure-panel-links-777
verdict: approved
---

# Implementation review

Reviewed the diff of 5b12d52 and 8bf4082 against plan.md.

- Fix: every panel link rule compiles to `:where(.<class> a:not([data-variant])…)`. Checked in Chromium on the
  compiled `styles.css`: a plain link in the panel keeps `display: block`, `8px 12px` padding and the foreground
  colour; a link with an app class (`sft:text-accent`) keeps the panel padding and takes its own colour; a
  `ButtonLink variant="primary"` in the panel has the same padding, colour and background as one outside it
  (`0px 16px`, accent fill). Its `display` is `flex` because the panel is a flex column (a flex item is blockified);
  the CHANGELOG migration says how to keep its own width.
- Tests: `disclosure-panel-links-777.test.tsx` fails on master (the selectors are not `:where()`) and passes with the
  fix; `styles.test.ts` still compiles every `sft:` class.
- Docs: README paragraph and CHANGELOG `Unreleased` with the migration (drop the `[&_a]` resets).
- Language gate, typecheck and lint green in the pre-commit hook.

Verdict: approved, no changes.
