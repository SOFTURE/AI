---
change_id: theme-flat-paint-look-maps-782
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and issue #782.

- Scope: five class maps, exports, tests and docs inside theme-flat-paint; no ui change. The menu map touches only
  app-side classes, so #777's ui change to panel links does not conflict (only master must be merged first).
- Fit: every delta of the issue maps to a slot; the per-state ones rely on `data-done` / `data-state`, which ui
  already sets on the `<li>`. The step-stamp motion stays in the app, as the issue says.
- Risks: `in-*` matches any ancestor with the attribute, so a checklist nested in a done item would inherit the done
  look; acceptable (ui never nests them). The panel's `translate` reset must cover `starting:` and the closed state
  too, or ui's slide survives under the scale.
- Tests: assert the compiled selectors, not only the strings, as the existing test does.

Verdict: approved.
