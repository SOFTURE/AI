---
change_id: theme-kit-text-size-adjust-1056
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (d9174ae).

- Acceptance of #1056: `base.css` carries the `html` rule with both properties, in `@layer base` (phase 1), with a
  test that the sheet carries it (phase 1).
- Scope: only `base.css`, its test and docs. Themes re-export the file, so no theme source changes.
- Risk: `100%` disables Safari's autosizing on every page of an app on the kit, which is what Tailwind's full
  preflight already does for apps not on the scoped one; pinch zoom is unaffected.
- The theme tests that compile `base.css` through Tailwind keep passing: plain properties, no new variables.

Verdict: approved, no changes.
