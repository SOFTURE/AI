---
change_id: ui-menus-color-presets-558
title: "ui: AccountMenu trigger and exit transition, MobileMenu groups, ColorField presets (issue #558)"
status: archived
roadmap_item: null
issue: 558
branch: claude/project-thread-ia89y3
created: 2026-10-17
updated: 2026-10-17
archived_at: 2026-10-17
---

## Intent

Close [issue #558](https://github.com/SOFTURE/AI/issues/558), a follow-up to #407. An adopting app still keeps its
own header menus and colour field because of four gaps:

1. `AccountMenu` always shows the user icon; the app shows the account's initial in a circle.
2. The menu panel is hidden with `hidden`, so it cannot animate out.
3. `MobileMenu` takes a flat list; the app groups links under headings.
4. `ColorField` has no preset swatches.

## Context

Labels: `enhancement`, `pkg: ui`, `adoption`. ui 0.3.2 is on master. Releases are batched by the coordinator: no
version bump, the CHANGELOG gets `## Unreleased`.

## Constraints

- Every addition is optional; existing calls keep their markup, names and look.
- All new copy is English, in `messages/en.ts`, and overridable through `messages` / the provider.
- Respect `prefers-reduced-motion`.

## Notes

- Framing: skipped. The issue names each gap and a proposal for it.

## Decisions (auto)

- `AccountMenu.trigger` (`ReactNode`) replaces the user icon inside the trigger button; the button keeps its
  accessible name from `messages.accountMenu`, so the initial is decoration.
- The leave motion lives in `DisclosureMenu`, so `AccountMenu` and `MobileMenu` both get it. The panel carries
  `data-state="open" | "closed"`, enters with `@starting-style` and leaves on `data-state="closed"`; `hidden` is set
  only once its transition ends (or at once when none runs, which is the case under reduced motion). The default
  motion is a short fade and lift on `--sft-duration-fast`. `useDisclosure` is unchanged.
- The leave-time helpers move out of `modal.tsx` into a shared module so the menu and the dialog read the same
  computed durations.
- `MobileMenu.items` accepts `MobileMenuGroup` (`{ heading, items }`) next to plain items; a group is an `<li>` with
  a heading and a nested list named by it (`aria-labelledby`). New slots `group`, `heading`, `groupList`.
- `ColorField.presets` renders a `role="radiogroup"` of `role="radio"` swatch buttons (roving tab stop, arrow keys)
  above the input. Buttons, not native radios: a native radio would add a field to the form's data. The group is
  named by the new `colorField.presets` message ("Preset colours: {label}"); each swatch by its preset's `label`.
- No native `title` tooltip on the swatches: the package's architecture test forbids hover-only tooltips.
