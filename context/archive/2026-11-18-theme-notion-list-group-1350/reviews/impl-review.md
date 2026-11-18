# Implementation review: a sticky group heading for List (#1350)

Verdict: approve.

- Matches the plan: two parts, `asChild` on both, `LIST_CLASSES.group`, `groupHeading`, `tintedGroupHeading`; only
  theme tokens and Tailwind's spacing scale (`px-2`, `px-4`, `py-2`, `min-h-10`, `scroll-mt-10`).
- The issue's three failures are measured gone in Chromium (gallery case, 256 px scrollport, 160 px high): the heading
  sits at the scrollport's top edge at every scroll position (no strip), is 256 px wide like the scrollport, is pushed
  up by the next group's heading (−30 px when the next is at 10 px), and `scrollIntoView({ block: "nearest" })` stops a
  row at 40–48 px, below the 40 px heading (`scroll-margin-top` computes to 40px, so the descendant variant compiles).
- Accessibility: the heading keeps the app's element (`h3` in the gallery); axe passes on the gallery in light and
  dark, desktop and phone. Contrast is the theme's pinned `foreground` on `background` and on `secondary`.
- No finding left open.
