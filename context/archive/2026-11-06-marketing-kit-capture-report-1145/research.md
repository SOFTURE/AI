---
change_id: marketing-kit-capture-report-1145
status: done
---

# Research: hyperframes' capture summary (issue #1145)

## The code today

- `runHyperframesRender` (`tools/marketing-kit/src/footage/pipeline.ts`) spawns `hyperframes render`, sends every
  non-progress line to `options.log` and returns `ok(null)`. `RenderedFootage` (`kind: "rendered"`) has no capture field.

## hyperframes 0.9.6 (`node_modules/hyperframes/dist`)

- `printRenderComplete` → `printRenderPipeline` (`render-*.js`) prints, after the output path and size,
  `"   " + c.dim(formatRenderPipelineDetail(...))` and, when it applies, `"   " + c.dim(formatScreenshotFallbackHint(...))`.
  `c.dim` may wrap ANSI codes, so the parser strips them.
- `formatRenderPipelineDetail` (`chunk-*.js`) joins with `" · "` (U+00B7): `<mode> capture` (mode `beginframe`,
  `screenshot` or `drawelement`), `<software|hardware> gpu`, then the stages present in this order: `compile`,
  `extract`, `audio`, `probe`, `setup`, `capture`, `encode` (`encode (during capture)` with streaming encode),
  `assemble`, each `formatDuration(ms)`: `8.7s` under a minute, `1m 31.4s` from a minute on. Each part is optional.
- The fallback hint starts `Screenshot capture (slower): BeginFrame did not run.` (two variants, Linux only).
- `--quiet` suppresses the summary; the kit does not pass it.

## Conclusion

A pure parser over the collected lines: the last line whose every ` · ` part is a capture mode, a GPU mode or a
known stage with a duration (at least one part) is the summary; the hint is the line starting `Screenshot capture`.
