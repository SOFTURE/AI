# Plan review: marketing-kit-draft-baseline-caption-fit

Verdict: approved.

- The shifts are pure and default to 0 without metrics or fonts, so callers without `fonts` keep their output: checked
  against the existing draft tests (pinned ASS stays byte-identical for them).
- The fit mirrors `getCaptionFitScript` (1 px steps, floor `round(size * 0.7)`, words kept whole as the render's inline
  blocks); the width is the box less the pill's horizontal padding, as the render's `p` wraps inside its padding.
- The regression scenario fails on master's code for both causes separately (run once with all of master's `src`,
  once with master's `draft.ts` only), so each half is pinned.
