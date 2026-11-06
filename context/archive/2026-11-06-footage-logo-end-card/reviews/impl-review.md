# Implementation review

Verdict: approved. An end card without `layout` or `seconds` composes exactly as before (existing compose and config
tests unchanged and green). The logo card fades in over the last frame, sits in the safe zone, never upscales a PNG,
and the music fade covers the whole card; speech still ends at the cut and the mix pass covers the whole film.
The glyph check reads the line through `getEndCardTexts`, so `captions.ts` (touched by a parallel change) is unchanged.
