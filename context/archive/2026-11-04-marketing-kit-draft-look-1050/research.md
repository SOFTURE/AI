---
change_id: marketing-kit-draft-look-1050
---

# Research: the draft's captions, brand and music (issue #1050)

## How the render does it

- Captions (`compose.ts`): `highlight` uses `captionChunks(words)` (up to four words, a chunk ends at punctuation),
  `phrase` uses `phraseChunks`. Both are timed by `getCaptionSpans`. The pill is `captionBackground`, its text
  `captionText`; each word turns `captionHighlight` at its start and back 0.32 s later (0.2 s colour tween). Font:
  the brand's body font (`fontStack(fonts.body)`), weight 650, the pill padded 16 px × 28 px.
- Colours are hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `colors.ts`).
- Music (`pipeline.ts` `getMusic`): `none` → none; `file` → the file; `prompt` → `getPromptMusicCache` (keyed by the
  prompt, provider id and model); `video` → `getVideoMusicCache` (keyed by the cut and the clips' hashes). A miss
  buys only with `isCommit`. The track: `buildMusicArgs` with `duckingKeyframes(words, getDuckingOptions(film.music))`,
  looped (`-stream_loop -1`), faded in 1 s and out 1.5 s. hyperframes plays speech and music at volume 1 (a sum).

## libass

- `ass` with `fontsdir` loads every font file in the folder and matches the style's `Fontname` against the families
  in each file's `name` table, not the CSS family a brand config gives. The draft must read the file's own family
  (name ID 1) to name it. FreeType reads TTF/OTF; a WOFF2-only brand font cannot be used: fall back to DejaVu Sans.
- `BorderStyle=3` draws an opaque box per line in `OutlineColour` (the box grows by `Outline`), `BackColour` is the
  shadow. No rounded corners.
- ASS colours are `&HAABBGGRR`, alpha 00 opaque.
- Inline `{\c&HBBGGRR&}` recolours the text after it; `{\r}` resets to the style.

## Options

1. Per-interval events: split each chunk span at every word's start and start+0.32 s, one `Dialogue` per interval
   with the lit words recoloured. Matches the render's timing exactly (no tween). Chosen.
2. `\k` karaoke: lights words cumulatively (stays lit), not the render's single moving word. Rejected.

Music: share one lookup with the render (`findFootageMusic` in `pipeline.ts`), so the cache keys cannot drift.
