---
change_id: theme-flat-paint-chat-look-1261
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (`842f4f7`).

- Ask 1 (class maps where the look differs): Phase 1, step 1, one map per ui chat component; the user bubble and
  tool card states named in the issue are covered.
- Ask 2 (visual tests in both schemes at 390 and 1440 px): Phase 1, step 3, Chromium test over the four
  combinations; criteria are measurable (computed colours, border styles, contrast, overflow).
- Slot drift: the `IsSameSet` type test fails `typecheck` if ui renames a slot.
- Risk: the browser test imports ui's build script across packages (`foundation/ui/scripts/build-css.mjs`). It is a
  test-only import of a repository file, same as the gallery builds; if the lint rules refuse it, compile ui's CSS from
  `@softure-ai/ui` sources with the same Tailwind input instead.
- Risk: the `typing` dots keep ui's `muted` fill; lime is not used for motion. Fine.
- CI: `PLAYWRIGHT_CHROMIUM_PATH` is set in the test jobs, so the browser test runs there and does not skip silently.

Verdict: approved, no changes.
