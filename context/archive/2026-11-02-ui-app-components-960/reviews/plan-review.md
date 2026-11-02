---
change_id: ui-app-components-960
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (c9380e5).

- Ask (components for Flat Paint): Phases 1 and 2; through ui, so a later ui-based theme gets them too.
- Ask (the visual tests both themes run): Phase 2 adds render and compiled-CSS tests to Flat Paint; theme-notion's
  stay unchanged since it is untouched.
- Ask (pwa README): Phase 3.
- Contract with pwa's counter: Phase 1 tests run the counter's own function on ui's markup, so a slot rename fails a
  test instead of an app.
- Risk: ui's CSS budget (20 kB gzip). The new classes are few; the build prints the size and fails over budget.
  Accepted.
- Risk: `RouteLoading`'s display rules sit in `@layer softure`; an app class setting `display` on the launch screen
  root would beat them. Documented; the Flat Paint map sets no display.
- Risk: ui's minor range (`^0.3.x` in other packages) is the coordinator's release call; the change only adds exports.

Verdict: approved, no changes.
