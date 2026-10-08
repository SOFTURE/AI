# Plan review: blog-config-bound-body-options

Reviewed: `plan.md` against `change.md`, issue #279, `modules/blog/src/next/{pages.tsx,json-ld.ts,index.ts}`,
`src/pages/body.ts`, `tests/next/pages.test.tsx`, `tests/architecture.test.ts` and `.github/workflows/auto-release.yml`.

Verdict: **approve with fixes applied** (one finding accepted into the plan, two checked without a change).

## Findings

### F1 (Warning, low effort): the version lives in three files — accepted
`module.json` carries `"version": "0.1.9"` too, and `auto-release` tags the version it reads from `package.json` on
master, so a bump left out of the change would release nothing. **Decision:** D4 now names `package.json`,
`module.json` and the lockfile without the "if".

### F2 (Suggestion): the new file must keep Next out of the page logic — checked, no change
`architecture.test.ts` keeps `next` imports out of `ui`, `pages`, `discovery` and `proxy`, and keeps
`@softure-ai/seo` out of the pages entirely. `src/next/body.ts` imports neither (only `@softure-ai/core`,
`getBlogOptions`, `toGlossary`, `getPageContext`), so the guard holds. **Decision:** none.

### F3 (Suggestion): name clash on `getBodyOptions` — checked, no change
No other export in `/next`, `/server` or the root entry carries the name; the issue proposes it, so an app that
reads the issue finds it. **Decision:** keep the issue's names (D1).

## Checks that passed

- Additive only: the pages' output does not change (the same function moves), so 0.1.10 is a patch with no
  migration note.
- D2 follows the conventions (more than three inputs become an options object).
- The tests compare against the ready-made pages' output, an oracle of a different kind than the new code.
