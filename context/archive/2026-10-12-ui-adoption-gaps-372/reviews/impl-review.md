# Implementation review: ui-adoption-gaps-372

Reviewed: the branch diff against plan.md, change.md and issue #372.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. Four additive options, one new server-safe module, defaults unchanged; the #319 tests pass untouched. | No change. |
| 2 | Check | `getExternalRel`, `ExternalLinkProps` and `ExternalLinkSlot` are exported only from `server-external-link.tsx`, so the names reach `index.ts` once and never through the client module. | No change. |
| 3 | Check | `ServerExternalLink` and `ExternalLink` render identical markup (asserted with `renderToStaticMarkup`); the note comes from `getCopy`, no inline copy. | No change. |
| 4 | Check | `closeOutsideOn: "click"` drops only the outside `pointerdown` close; Escape, link click inside, keyboard focus-out and the outside click still close (tested). | No change. |
| 5 | Check | `useDismissed` `initial: "shown"` changes only the pre-hydration snapshot; a stored dismissal still hides the notice after hydration (tested). | No change. |
| 6 | Check | Docs: README sections for all four, migration snippet for ISO values, CHANGELOG `## Unreleased` (no version bump, batched releases). | No change. |

Gates: see plan.md Progress.
