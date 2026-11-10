# Plan: mcp-access-form-actions

## Steps

1. `actions` in `TokenManagerSlot` with default `sft:flex sft:flex-wrap sft:items-center sft:gap-2`; the submit button
   of `IssueForm` and `ApiIssueForm`, the "Done" button of both issued panels and the "Open in Claude Code" link are
   wrapped in it (`modules/mcp-access/src/ui/token-manager.tsx`).
2. Tests in `modules/mcp-access/tests/token-manager-actions.test.tsx`: each of those buttons sits in the actions row
   with the default classes; `classNames.actions` overrides it; `unstyled` leaves the row without classes.
3. README slot list and CHANGELOG; patch release 0.7.3 (`npm run release:version`).

## Done when

- The new and existing token-manager tests pass; typecheck, lint and the language gate are clean.
- CI green on the pull request; `auto-release.yml` publishes `mcp-access@0.7.3`.

## Progress

- [x] 1. actions slot
- [x] 2. tests: `npx vitest run modules/mcp-access/tests/token-manager` → 4 files, 42 tests passed
- [ ] 3. docs and version 0.7.3

## Decisions (auto)

- A row slot around the buttons rather than `self-start` on each button: it matches the `actions` slot of the other
  packages and lets an app restyle the row (e.g. right-align it) through `classNames`.
- Patch, not minor: additive and optional, like 0.7.2.
