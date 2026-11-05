---
change_id: marketing-kit-caption-keep-with-next-1081
verdict: approved
---

# Plan review

- Covers the issue's ask: the option on `captionChunks`, the film option, applied in film time by the render and the
  draft alike, language-keyed defaults. `phraseChunks` is covered too, since `phrase` is the default style and the
  issue's flaw shows there first.
- `maxCharacters` dropped with a reason: moving the kept word forward never grows a card. Acceptable.
- Backward compatible: a number argument still works; no predicate means no change for screen films.
- Risk: a pause rule override could glue words across a long silence; only after a kept word, which is the point.
- Risk: conflicts with #1077; the plan builds on master after it. Good.
- Verdict: approved.
