# Plan review

Verdict: approved. Backward compatible (an end card without `layout` or `seconds` renders as before, 3 s), every step
has a test, no external service. Risk: other open marketing-kit changes touch `captions.ts`; the glyph check change
stays at the call site to keep the overlap small.
