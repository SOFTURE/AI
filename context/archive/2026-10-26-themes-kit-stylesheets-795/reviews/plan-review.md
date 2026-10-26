---
change_id: themes-kit-stylesheets-795
verdict: approved
---

# Plan review

- Coverage: the issue's option 1 for both themes (re-export, README) has steps; generic through the contract.
- Risk: the bare `@import` not resolving from a theme's `dist/` under a strict layout. The Tailwind CLI test with
  the kit only in the theme's nested `node_modules` proves it. Accepted.
- Risk: a theme's own stylesheet named `base.css` silently overwritten by the re-export. The config parser refuses
  it. Accepted.
- Risk: double import when an app keeps both `@softure-ai/theme-kit/base.css` and the theme's. Rules are identical
  and layered; harmless, and the CHANGELOG migration says to replace. Accepted.
- Risk: the parallel theme-flat-paint changes touching `package.json` and README. Small, mechanical conflicts;
  master is merged in before the merge.
