---
change_id: ui-testing-guards-403
title: "ui: design-token and component guards in ui/testing (issue #403)"
status: archived
roadmap_item: null
issue: 403
branch: claude/project-thread-ydipi4
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Close [issue #403](https://github.com/SOFTURE/AI/issues/403) (labels `enhancement`, `pkg: ui`, `adoption`): an
adopting app keeps about 600 lines of guard tests around its design system. Only the colour part has a home today.
`@softure-ai/ui/testing` gains source guards, each returning a `file:line: …` list for `expect(...).toEqual([])`:

1. `findUndefinedTokenClasses({ css, sources })`: every Tailwind colour utility (`bg-*`, `text-*`, `border-*`,
   `fill-*`, `stroke-*`, `outline-*`) names a token defined in the given `@theme` CSS; a typo silently renders nothing.
2. The same guard checks `ease-*` and `duration-*`: a named ease must be a defined `--ease-*` token, a
   `(--var)` reference a defined variable, and a named duration is reported (Tailwind 4 compiles none).
3. `findNativeTooltips(sources)`: no `title=` attribute on an HTML element; `Hint` is the tooltip.
4. `findHoverOnlyHandlers(sources)`: an element that opens something on mouse or pointer enter also opens it on
   focus.
5. `findRestrictedElements(sources, { select, createPortal })`: raw `<select>` and `createPortal` appear only in the
   files allowed for them.

The package dogfoods all of them in `foundation/ui/tests/architecture.test.ts`.

## Context

ui is at 0.1.16 on master, testing at 0.1.4. Releases are batched by the coordinator: no version bump, the CHANGELOG
gets `## Unreleased`. Issue #407 (ui components) waits on this change.

## Constraints

- No runtime change to any component; additive exports under `@softure-ai/ui/testing` only.
- The guards take source files as `{ file, source }` (the shape `readSourceFiles` returns) without a dependency on
  `@softure-ai/testing`.

## Process notes

- Framing: skipped. The issue states the five guards and the API shape.

## Decisions (auto)

- No version bump; `## Unreleased` in the CHANGELOG (batched releases).
- Sources are typed structurally (`GuardSource { file, source }`), so ui needs no dependency on
  `@softure-ai/testing`; `readSourceFiles` output fits as is.
- JSX guards (3 to 5) use the TypeScript parser, like `@softure-ai/testing/guards`: `typescript` becomes an optional
  peer dependency of ui, needed only by `ui/testing`. A regex cannot tell `<Card title>` from `<div title>`.
- Colour utilities: the issue's five plus `outline-*` (focus rings are a token too). `ring-*`, `divide-*` and
  gradients stay out: their non-colour forms would need long exception lists.
- Guard 4 is a hover-without-focus guard on JSX handlers; the package's `Hint` already opens on focus (tested).
- Class names are read from string literals only (not comments); an `allow` option takes classes the guard must not
  report (a `data-testid` that looks like a utility).
