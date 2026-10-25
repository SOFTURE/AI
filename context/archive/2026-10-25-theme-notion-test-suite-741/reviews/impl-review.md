---
change_id: theme-notion-test-suite-741
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md and issue #741, after merging master with #735–#740, #742, #746, #747,
#752, #756, #759, #760 and #763.

- Layer 1, render (`tests/render.test.tsx`): one gallery case per export and per `cva` variant × size. RadioGroup,
  Code, CodeBlock and SortableList (row and handle) were added after the merge. The inventory test fails for an
  export without a case.
- Layer 2, parity (`tests/parity.test.tsx`, `tests/fixtures/notion-slots.json`): regenerated on the merged master.
  The diff matches the merged changes: `text-link`, the destructive dark fills, the ItemGroup `listitem` and the
  muted tab and group-label text.
- Layer 3, upstream guard (`tests/upstream.test.ts`, `tests/upstream/`): 37 pinned files including radio-group.
  Every hunk of the merged sources is listed with a reason in `deltas.ts`. The four #735 drifts each fail the guard.
- Layer 4, behaviour (`tests/behaviour/`): sidebar, controls, overlays and every message path. The sortable
  instructions and handle label are covered here; the drag announcements are covered in
  `tests/notion/Sortable.test.tsx`.
- Layer 5, Tailwind generation (`tests/tailwind-classes.test.ts`): every class in `src/ui`, `src/notion` and the
  fixture generates CSS.
- Layers 6–7, visual and axe (`visual/`, `.github/workflows/themes.yml`): 84 baselines at 1440/390 in light and
  dark. They match locally twice in a row and matched on the CI runner for the previous head.
  - axe runs WCAG 2.1 A/AA with `color-contrast` on.
  - The only known violations left are library markup: the cmdk listbox and the Radix Select aria-hidden focus.
    #763 (filed by this change) fixed the last two parts below AA before the merge.
- Contrast (`tests/contrast.test.ts`): taken from #756 (every rendered pair at AA).
- Layer 8, inventory (`tests/inventory.test.ts`): exports, files, README list, gallery and `CVA_AXES` agree.
- Coverage: at or above 97% statements and 92% branches of `src`, against a 90% threshold in CI.
- Docs: README "Testing" section; CHANGELOG `Unreleased` entry, with no change needed in an app. No version bump.

Verdict: approved.
