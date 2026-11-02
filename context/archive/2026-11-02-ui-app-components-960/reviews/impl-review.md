---
change_id: ui-app-components-960
verdict: approved
---

# Implementation review

Reviewed the diff of e7b9100, 77e2ede and abaa205 against plan.md and change.md.

- Phase 1: the seven ui components keep theme-notion's props; every slot takes `classNames`, `unstyled` keeps
  structure, ARIA and the screen choice of `RouteLoading`. No width on `ProgressBar`'s root and a `size` prop for the
  hairline, so no two utilities of one property meet in `@layer softure` (checked in the compiled `styles.css`: the
  `md` display query and `md:min-h-0` come after the base rules, `p-4` before `pr-14`). `styles.css` is 7.2 kB gzip.
- The pwa counter runs on ui's markup in `tests/repo/pwa-launch-screens.test.ts` (launch screen and top bar).
- Rendered in Chromium with ui's default theme: the prompts sit inside the insets with the icon, title, description
  and action aligned; the iOS steps and the 44 px close button fit; the launch screen centres; the mini progress
  label reads on both the fill and the track.
- Phase 2: the maps hold only differences; the slot types match ui's (a compile-time check in `app-look.test.tsx`);
  every map class compiles in an app's Tailwind; thin bars keep `accent`, never lime.
- Phase 3: ui, Flat Paint and pwa docs and changelogs; relative links checked by the repository test.
- Findings: none blocking. Noted: `font-bold` beside the Flat Paint type steps, since ui's `font-semibold` sets the
  weight variable the step reads.

Verdict: approved.
