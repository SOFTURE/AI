---
change_id: theme-notion-sortable-752
verdict: approved
---

# Implementation review

Reviewed d482450 and 4a0f7c1 against plan.md and issue #752.

- Acceptance: `SortableList`, `SortableItem`, `SortableHandle` and their types are exported from the package root.
  The lifted look is `data-dragging` with `bg-accent-strong shadow-menu relative z-10`; rows carry
  `touch-manipulation select-none [-webkit-touch-callout:none]`; touch and mouse sensors hold for 500 ms with an
  8 px tolerance; `instructions` and `announcements` take the app's strings with `{item}`, `{position}`, `{total}`;
  the optional handle is a named ghost grip button.
- Behaviour: keyboard pick, move and drop calls `onReorder` with the moved order and the move; Escape leaves the order
  alone; the vertical-only modifier is a plain function, so no extra dependency. The keyboard sensor only starts on a
  key pressed on the activator itself, so Enter on a link inside a row still follows the link.
- Accessibility: the row keeps `role="listitem"` in row mode; the "picked up" announcement is no longer replaced by
  a "moved" one for the row's own place at the start of a drag.
- Tailwind: every class is a literal under `src/notion/`; `tests/theme-css.test.ts` compiles them through the real
  Tailwind CLI (callout property and `data-[dragging]` variants included).
- Fix applied in this review: the drag binding now spreads after the caller's props on the row and the handle, so an
  app's own `onPointerDown` or `onKeyDown` cannot silently disable dragging.
- Gates: typecheck, ESLint, language gate, build and theme-notion tests (129) green.

Verdict: approved after the fix above.
