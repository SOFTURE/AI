# Plan review: blog-tool-block-nodes

Reviewed: plan.md @ 2026-10-15. Mode: full. Verdict: ready.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: `defineToolBlock`, `BlogToolIsland`, `ArticleBody`, `BlogViewOptions`, `getViewContext`,
`checkBlockRequires` exist as named; `render/`, `server/` and the root import no `react` today.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: ask 1 → P2 (mode), ask 2 → P2 (`lazyToolIsland`, decided in research), ask 3 → P1 + P2, ask 4 → P1 |
| Grounding | PASS |
| Scope | PASS: only `modules/blog/` |
| Risk | WARN (below) |
| Testability | PASS |

## Findings
- WARNING: a node segment that is not a tool node still renders as given, so a plain object from an app's own plugin
  would still crash; that is today's contract for `node` and stays. But the island map is typed loosely
  (`ComponentType<any>`): justify the `any` in a comment (the props are checked by the config-side schema; the page
  cannot link the two). Accepted into Phase 2.
- SUGGESTION: in append mode the static part needs no class of its own (the architecture test requires a rule for
  every `blog-*` class); use data attributes. Already in the plan.

## Decisions (auto)
- Breaking move of `defineToolBlock` out of `/ui` (no re-export): a re-export would keep configs importing `/ui`
  and React.
- Lazy loading as a page-side helper instead of `loadIsland` on the definition (research option 2 rejected).
- One plugin-level `requires` for `defineToolBlocks`.
