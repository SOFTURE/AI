# Plan review: theme-notion-result-badge-attributes

Verdict: approve. The research confirms the order that matters: `Badge` spreads its props last, so `ResultBadge` must
spread the app's props before its own attributes, which the plan does; a JSX `undefined` still overrides, so a resting
badge cannot be marked spinning by an app. Excluding `variant`, `color` and `asChild` keeps the result's look the
theme's. The acceptance from the issue (the attribute reaches `[data-slot=result-badge]`, an app's `data-tone` cannot
override) is the red test of Phase 1. The change is additive, so no adopting app breaks.
