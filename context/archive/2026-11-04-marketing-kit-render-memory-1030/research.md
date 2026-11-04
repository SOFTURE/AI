---
change_id: marketing-kit-render-memory-1030
---

# Research: renderFootage memory on a small worker

## Setup

A fictional 45 s film: three 25 s 1080x1920 30 fps clips, 12 segments (cuts, zooms, fades, Ken Burns), captions,
end card, composed with the kit's own `composeFootage` and rendered with hyperframes 0.8.85 exactly as
`renderFootage` calls it, plus `--low-memory-mode --workers 1` (the profile the issue's worker gets), one CPU
(`taskset`), the frame cache off so every run extracts. Memory is the cgroup's `total_rss + total_shmem`, sampled
every 0.5 s, peak per hyperframes stage. The container has no cgroup v2 limit hyperframes can read, so its Node-side
frame cache used the large-host profile; a run with that cache forced to the small profile (32 entries, 64 MB)
peaked 24 MiB lower only.

## Where the memory goes

| Composition | `video_extract` | `capture_streaming` |
| --- | --- | --- |
| today: one `<video>` per segment, 12 over 3 clips | 970 MiB | 1716 MiB |
| 12 `<video>` over one frame-aligned cut source | 198 MiB | 1623 MiB |
| no `<video>` at all (captions, end card, audio only) | 0 | 634 MiB |
| one `<video>` over the cut in film time | 218 MiB | 1128 MiB |
| 12 `<video>`, `--quality draft` (x264 `veryfast`) | 191 MiB | 1473 MiB |

- **Extraction.** hyperframes runs one ffmpeg per `<video>` (about 110 MB each) with `Promise.all`. It merges
  windows of one source into a single "superset" extraction only when they overlap or touch and their media starts
  lie on whole frames (`planSupersetGroups`, `isIntegralFrameOffset`). Segments of a cut never touch in their clips,
  so every one extracts alone. One source laid out frame by frame merges them into one ffmpeg.
- **Capture.** Chrome's renderer carries most of it (1.36 GB RSS at the start of capture with 12 videos); libx264
  `medium` about 400 MB beside it. Every `<video>` element costs about 40 MB in the renderer before the first frame
  (1186 MiB with 12 at the start of capture, 748 with one), and the renderer then grows by about 0.3 MB per
  captured frame whatever the video count (+350 to +450 MiB over the film).
- **What does not help.** A Chrome with `--expose-gc` and a page that collects garbage every 2 s (1692 MiB), and in
  a Playwright replay of the injection loop: CDP `HeapProfiler.collectGarbage`, a critical memory-pressure
  notification, blob URLs revoked after use. The per-frame growth is inside hyperframes' frame injection and
  Chrome; the kit cannot reach it without patching hyperframes.
- hyperframes takes no extra Chrome flags; `--workers` and `--low-memory-mode` are its own memory settings.

## Options

1. **The picture as one video in film time** (recommended). `renderFootage` renders the cut's picture itself, one
   short ffmpeg per segment, one after the other, joined by stream copy: each piece starts on a film frame and lasts
   to the next segment's frame, a cross-fade drawn into the incoming piece (the outgoing segment's tail held at its
   zoom, `xfade`). The composition carries one `<video>` over it; zoom cuts and Ken Burns stay GSAP tweens on that
   element. Measured: extraction 970 to 218 MiB, capture 1716 to 1128 MiB (1.18 GB, inside the issue's 1.2 GB).
   Cost: one extra encode of the cut (about 70 s for 46 s of film at one CPU, `veryfast`; the render itself takes
   about 18 s per second of film). During a fade the outgoing tail also follows the incoming segment's Ken Burns
   (at most a few tenths of a percent over a third of a second).
2. One frame-aligned cut source under the existing 12 `<video>` elements: extraction fixed, capture not (1623 MiB).
3. Pass hyperframes' memory settings through `renderFootage` (`workers`, `lowMemory`). Cheap, complements 1.
4. Patch hyperframes or file it upstream: out of the kit's reach (third-party, pinned).

Recommended: 1 + 3, and the README states the measured peaks and the time cost.
