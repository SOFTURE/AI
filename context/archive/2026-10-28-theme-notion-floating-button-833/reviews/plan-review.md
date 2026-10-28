---
change_id: theme-notion-floating-button-833
verdict: approved
---

# Plan review

- Coverage: the issue's expected result (opaque in every state, tint on top, both schemes) has a step for rest,
  hover, pressed (`aria-expanded`) and disabled; the outline defect in the title is fixed in place.
- Risk: the gradient layer over `bg-background` differs from today's `hover:bg-accent` when an outline button sits on
  a non-`background` surface (a card): today it would show accent over the card, now accent over the background. The
  outline's rest state already paints `bg-background`, so the hovered button now matches its own rest surface.
  Accepted.
- Risk: an app's `hover:bg-*` override on `outline` still works (`background-color` is untouched by the layer), but a
  gradient `bg-linear-*` override from the app merges with ours through `cn`. Accepted.
- Risk: the CHANGELOG `Unreleased` section is also edited by #831/#832; master merged in before the merge.
- Tests pin the class contract and fail without the change (no `floating`, `hover:bg-accent` on outline).
