# Plan review: ui-hint-select-toast-gaps

Reviewed: `plan.md` against `change.md`, issue #163 and the current sources of `hint.tsx`, `select.tsx`, `toast.tsx`
and `scripts/build-css.mjs`. Verdict: **approved with fixes applied**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | D5 ignored only events from the list, but the chevron's own `rotate` transition ends inside the select on every open and would trigger a re-measure (harmless, but noise and a second layout per open). | Fixed in the plan: ignore every event from inside the select's wrapper; the Phase 1 test asserts the chevron case. |
| F2 | Suggestion | D2: a pointer already resting on the trigger at hydration loses the CSS hover and the bubble hides until the pointer moves (React state starts closed). | Accepted as is: one frame of difference at hydration time only; documenting it would cost more than it says. |
| F3 | Warning | D7 changes the line height of every package element with `text-*` and no `leading-*`, not only the toast. Elements with a fixed height keep their size, but text blocks (field hints, empty states, card subtitles) may grow or shrink by a pixel or two. | Accepted, it is the issue's request (the package should behave like Tailwind's own `text-*`); the impl review lists the affected components. Added to D7. |
| F4 | Suggestion | Phase 1's `triggerGap` component test needs a measured bubble; happy-dom returns zero rects and `measure` would only retry. | Test mocks `getBoundingClientRect` for the trigger and the bubble; no plan change. |
| F5 | Suggestion | D3 names the prop `triggerGap` while the rest of the API speaks px implicitly (`durationMs` on `ToastHost` carries its unit). | Kept `triggerGap` with px stated in the JSDoc: Hint's other numeric inputs are CSS-like, and `triggerGapPx` reads awkwardly in JSX. |

No missing phase, no migration, no cross-package contract. The version bump and release stay with this change
(no other open change touches `@softure-ai/ui`).
