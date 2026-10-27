---
change_id: theme-notion-command-input-809
---

# Research

## Accessible name

- cmdk 1.x (`Command`) renders `<label cmdk-label for={inputId} id={labelId} style={srOnly}>{label}</label>` and its
  `Command.Input` sets `aria-labelledby={labelId}`. `aria-labelledby` takes precedence over `aria-label` in the
  accessible name computation, so with no `label` the combobox is named by an empty label, whatever `aria-label` the
  app gives `CommandInput`.
- `CommandDialog` already holds a `title` (default `messages.command.title`, "Command Palette") for the dialog
  heading. Passing it as `Command`'s `label` names the combobox with the same words, overridable by the same prop.
- A bare `Command` outside the dialog needs `label` from the app; cmdk has no other way to name the input.

## Trailing content and wrapper size

- `CommandInput` renders `<div data-slot="command-input-wrapper" class="flex h-9 items-center gap-2 border-b px-3">`
  around the search icon and the input; `className` reaches only the input. `CommandDialog` sets the 48 px row height
  from the parent (`**:data-[slot=command-input-wrapper]:h-12`).
- The wrapper is a flex row with `gap-2`: children rendered after the input sit at its right end with no positioning,
  because the input is `w-full` and the trailing element keeps its own width (`shrink-0` on the app's element or the
  `Kbd`'s own `inline-flex`).
- `Command.Input` takes no children (it renders an `<input>`), so `children` on `CommandInput` is free to mean the
  trailing slot; the input props type must drop `children` from its own props.

## Options

1. `children` after the input and `wrapperClassName` merged into the wrapper with `cn`. Chosen: the issue's first
   choice, the smallest API, and the classes stay byte-equal without the new props.
2. An `end` prop plus a `size` variant. Rejected: two new concepts for one slot and one height.
