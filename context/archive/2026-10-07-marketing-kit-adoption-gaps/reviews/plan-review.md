# Plan review: marketing-kit-adoption-gaps

Reviewed: [`plan.md`](../plan.md) against [`change.md`](../change.md), [`research.md`](../research.md) and the code on
`master` e2d1974. Reviewer: Claude (self-review, owner's autonomous mode).

## Coverage of issue #118

| Item | Phase |
| --- | --- |
| 1 ad-hoc shots | 2 |
| 2 scroll frame, extra wait | 1 (entries), 2 (flags) |
| 3 authenticated screens | 1 (`storageState`), 2 (`--auth`) |
| 4 Chrome cache path | 4 |
| 5 FIRE's pre-redesign look | 4 |
| 6 npm, `npx` in the README | done on npm (0.1.7); README in 4 |
| 7 renderable dry-run voiceover | 3 |

Nothing is deferred.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The scroll frame: `window.scrollTo` past the page end clamps silently, so a frame "at 3000 px" of a 2000 px page is just the bottom. A gate is the kit's rule for silent wrong output. | Accepted: the shot is refused (gate `scroll`) when the page cannot reach the offset; added to phase 1. |
| 2 | Warning | Scroll-driven motion: with the entry default `motion: "reduce"` a motion frame shows the end state. FIRE defaults `no-preference` for scroll frames. | Accepted: keep the schema default (backward compatible, explicit); README says to set `motion: "no-preference"` for motion frames. |
| 3 | Warning | `storageState` resolution: the CLI resolves it against `config.root`; the library API (`takeScreenshots`) gets an absolute path. Plan step 3 says it, step 4 must check after resolving. | Accepted as written; clarified in phase 1 step 3. |
| 4 | Suggestion | `--page` reuses `screenshotSchema` for bounds, but the schema requires `id` and `path`. | Accepted: build the entry with `id: "page"`, `path: "/"`, and report issues by flag name. |
| 5 | Warning | Placeholder log key: `render` without `--placeholder` on a placeholder log must not say "the script changed"; it must name the flag. | Accepted: phase 3 step 3 already requires it; tests assert the message. |
| 6 | Suggestion | `preview` reads the composition only, so it needs no flag; `posts` neither. | Accepted: refuse `--placeholder` there with a message (phase 3 step 3). |
| 7 | Warning | The fake TTS provider stays text bytes; changing it would break its tests' contract. | Accepted: the placeholder is its own module, the fake is unchanged. |

## Verdict

Approve with the accepted fixes applied to the plan.
