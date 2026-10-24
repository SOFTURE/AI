---
change_id: themes-notion-708
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, `tests/repo/packages.test.ts`, `scripts/build-workspaces.mjs` and the
reference app's implementation.

- Scope: no existing package changes; the new group needs the workspaces list and the Vitest include, nothing in
  release scripts (they read `findWorkspaces`).
- Reuse: the kit holds only what any shadcn theme repeats; app-specific meaning tables stay out.
- Risks: Tailwind must see the components' classes; `@source` in the shipped `theme.css` covers it, and the README
  says so. NodeNext needs `.js` imports; typecheck catches a miss. Dark scheme selectors must not fight; tested.
- Tests: snapshot equality, generator output, component rendering, barrel completeness.

Verdict: approved, no changes.
