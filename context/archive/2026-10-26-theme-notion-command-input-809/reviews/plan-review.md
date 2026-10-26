---
change_id: theme-notion-command-input-809
verdict: approved
---

# Plan review

- Coverage: both asks of the issue (name via `CommandDialog`, README note for a bare `Command`; trailing slot and
  wrapper class) have a step and a test.
- Risk: the slot snapshot and the upstream guard pin the wrapper classes. `cn` of the same string with no extra class
  returns it unchanged, and the deltas list the edit. Accepted.
- Risk: an app already passing `label` to `CommandDialog`'s inner `Command` cannot (it is internal). It passes
  `title`, which now names both. Accepted.
- Risk: `children` typed by cmdk's input props (`React.ComponentProps<typeof CommandPrimitive.Input>` has
  `children`?) clashing with the slot; the type is redeclared as `ReactNode`. Accepted.
- Risk: the CHANGELOG `Unreleased` section also added by #795; master merged in before the merge.
