---
change_id: theme-notion-top-loading-bar-923
---

# Research: top loading bar (issue #923)

## What exists

- `Progress` (theme-notion, Radix): root and indicator carry `data-state` (`indeterminate` without a value, `loading`
  with one). Without a value the indicator still gets `translateX(-100%)`, so an indeterminate bar draws nothing.
- `LaunchScreen`: `fixed inset-0 z-50` on the background, `Progress value={0}`, percentage, inline script.
- `launchProgress` (pwa): finds its root only by `script.closest('[data-slot="launch-screen"]')`, then moves
  `progress`, `progress-indicator` (inline transform) and `launch-screen-percent`. Stops when the root is gone or at 99.
- A script in a streamed fallback runs while the browser parses it; React never runs a `<script>` it inserts on a
  client navigation, so there the counter never starts.
- theme-notion imports `tw-animate-css`: `animate-out`, `slide-out-to-right-[n%]`, `repeat-infinite` and
  `duration-*` give an endless slide without new keyframes. Tailwind v4 `translate-x-*` sets the `translate`
  property, which adds to the animated `transform`.
- Playwright baselines run with `animations: "disabled"`: an infinite animation shows its first frame.

## Options

1. Indeterminate fill keyed on `data-[state=indeterminate]:` classes of the indicator, no inline transform then;
   `TopLoadingBar` = a `Progress` without a value at the top edge, which the counter, once it runs, turns determinate by
   writing `data-state="loading"`. On the first streamed load the counter moves it; on a client navigation it slides
   indeterminately. Chosen.
2. A determinate bar only (value 0 + script). Rejected: on a client navigation it would stay empty.
3. Pick full screen or bar by reading the request in `app/loading.tsx`. Rejected by the issue (makes pages dynamic).
   Instead `RouteLoading` renders both and CSS shows one: full screen below `md` or in `display-mode: standalone`,
   the bar otherwise.
