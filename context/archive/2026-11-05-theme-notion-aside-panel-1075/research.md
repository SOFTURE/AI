# Research: AsidePanel follow-ups (issue #1075)

## What exists

- `AsidePanelToggle` hard-codes `PanelRightOpen`/`PanelRightClose`; its ref (`toggleRef`) is where Escape and the
  sheet's close return focus, so a hand-made toggle loses that.
- Icon props in the package: `Timeline` takes `icon?: LucideIcon` (a component, drawn with `ICON_STROKE_WIDTH` and
  `aria-hidden`); `PageHeader`/`PropertyList` take a `ReactNode`. A component keeps the stroke width and
  `aria-hidden` consistent, so the toggle follows `Timeline`.
- `useIsMobile` (theme-kit) is `false` on the server; `MOBILE_BREAKPOINT` is 768 px, the same as Tailwind's `md`
  (48rem). `max-md:hidden` hides exactly the widths where the client renders the sheet instead. The sheet is
  portalled and never server-rendered closed content, so the class does not reach it.
- Buttons set only `aria-label`. `title` from the same string restores the hover hint; the accessible name is
  unchanged (`aria-label` wins).
- `SheetContent` gets `aria-describedby={undefined}` to silence Radix's missing-description warning; `SheetDescription`
  exists in `ui/sheet.tsx`.

## Options

1. One `icon` for both states (the variant and `aria-expanded` already carry the state).
2. `openIcon`/`closeIcon` pair.

Recommendation: option 1; an app that wants two icons can still swap `icon` from `useAsidePanel().isOpen`.

## Risks

- `max-md:hidden` against `flex` in the same class list: different variants, `tailwind-merge` keeps both.
