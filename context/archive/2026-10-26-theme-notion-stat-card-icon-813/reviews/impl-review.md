---
change_id: theme-notion-stat-card-icon-813
verdict: approved
---

# Implementation review

- Plan conformance: the three phases done as planned; no deviation.
- Icon: `StatCard.icon?: LucideIcon`, drawn before the label inside the label row (`flex items-center gap-1.5`),
  `aria-hidden`, `strokeWidth={ICON_STROKE_WIDTH}`, `size-4 shrink-0`, colour inherited from the muted label. The
  test fails without the change (no `<svg>` in the row) and pins the text nodes to the label and the figure.
- Unchanged without an icon: the label's markup stays `<div class="text-section-label text-muted-foreground">`
  (test); existing tests and the slot snapshot pass untouched.
- Gallery: one existing StatCards case card got an icon, so the visual and contrast suites render it.
- Design Notion: the artifact's bundle rebuilt from the changed source together with #809's (still unmerged)
  `command.tsx`, so the published bundle keeps that change; `bundle.css` rebuilt with the recorded recipe came out
  byte-identical (no new classes). The StatCards preview shows `icon` on all three cards; rendered with Playwright in
  light and dark: icon 16 px, stroke 1.75, `aria-hidden`, 6 px gap, the label's colour, no console errors. README and
  `index.d.ts` list `icon?`.
- Gates: typecheck, lint, language gate on every commit; theme-notion tests 808; full `npm test` in the pre-push hook.

## Before the next release

- Nothing beyond the coordinator's batch release of theme-notion (minor-safe: an additive optional field).
