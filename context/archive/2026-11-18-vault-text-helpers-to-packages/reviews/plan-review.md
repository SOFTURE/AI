# Plan review: vault-text-helpers-to-packages

- Suggestion (accepted): keep the folding byte-identical to the app's, since the app stores its output in an indexed
  column; a different fold would silently stop matching stored passages until a re-index. The plan moves the code
  verbatim and splits it into `foldText` (no punctuation change) and `foldWords` (the app's function).
- Suggestion (accepted): the markers are product copy, so the package takes them as input instead of shipping
  English defaults; it refuses blank or equal markers, which would make `defuse` meaningless.

Verdict: proceed.
