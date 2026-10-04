# Plan: billing-retro-reviews

Input: change.md, research.md. Complexity: low (2 phases, documents only). Risk: low.
Plan review: reviews/plan-review.md (W1, S1 applied).

## Goal

- `context/archive/2026-10-03-billing-entitlements/reviews/plan-review.md` reviews MO-1's plan after
  the fact, every finding checked against `master` (b6c92c4) and marked still applies / fixed by.
- `context/archive/2026-10-03-billing-plans-pricing/research.md` and `reviews/plan-review.md` do
  the same for MO-2, the research answering MO-2's three roadmap unknowns as the code stands today.
- Every finding that still applies and needs code is filed as an FU item (FU-24 to FU-27) in
  `context/backlog/roadmap-followups/` and `context/foundation/roadmap.md`, lane C.

**Out of scope:** any change under `modules/` or `examples/` (lane C owns billing code); editing the
archived documents that already exist.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where the retro documents live | in the two archive folders, new files only, headed "written after the fact" | the roadmap outcome names them | change.md Notes |
| Format | the skills' plan-review and research templates; decisions in `## Decisions (auto)` | same shape as every other archive | softure-plan-review |
| What a decision means after the fact | `Defer` to an FU item, `Dismiss` with evidence, `Fixed later (<item>)` for findings later changes closed | no plan to apply fixes to | research |
| Grouping of findings into items | one item per theme: existing accounts, Stripe currencies, guard and race tests, invoice requests | four reviewable outcomes instead of twelve small ones | research Summary |
| Lane | lane C after FU-22, in the order FU-24, FU-25, FU-26, FU-27 | all touch `modules/billing/` | roadmap Order |

## Phase 1: Retro documents

- Each retro document is headed "written after the fact" with `Snapshot: b6c92c4 (master, 2026-10-04)`.
- MO-1 plan review: lenses, findings, grounding 19/19.
- MO-2 research: the three unknowns, the flows, prior decisions superseded by MO-3, FU-11, FU-9.
- MO-2 plan review: lenses, findings, grounding 37/37, stale plan claims named.

**Done when:**
- Both archives hold the new files; every finding names its decision and, when deferred, its FU id.
- `npm test` passes (relative links in every `*.md`).

## Phase 2: Followup items

- FU-24 `billing-existing-accounts`, FU-25 `billing-stripe-currency-units`,
  FU-26 `billing-guard-race-tests`, FU-27 `billing-invoice-request-hygiene`: an entry each, a row in
  the backlog README, a row, an item block, a lane C entry, an order entry and an "Owner at the
  keyboard?" row in the roadmap.
- FU-12's own row and block move to `in_progress (implement 2/2, …)`; archive sets `done`.

**Done when:**
- Four entries exist with `status: backlog`; the roadmap table, blocks, lane C and order list name
  them; the roadmap contract test passes.
- Gates green (typecheck, lint, test).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Retro documents

#### Automated
- [x] 1.1 Both archives hold the new files; every finding names its decision and, when deferred, its FU id — a7c54d1
- [x] 1.2 Gates green (typecheck, lint, test) — a7c54d1

### Phase 2: Followup items

#### Automated
- [x] 2.1 Four entries exist with `status: backlog`; the roadmap table, blocks, lane C and order list name them — 71c912f
- [x] 2.2 Gates green (typecheck, lint, test) — 71c912f
