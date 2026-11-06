# Research: footage-logo-end-card

- `src/footage/compose.ts`: `END_CARD_SECONDS = 3` drives `getFootageFilmSeconds`; the card HTML (brand row,
  headline, url pill, note) and its tweens (0.3-1.8 s after the cut) over `#last` (the cut's last frame) and a 0.82 shade.
- `src/footage/paid.ts:269` and `src/footage/pipeline.ts:356` add `END_CARD_SECONDS` to the clips' length for the
  paid-step estimate.
- `src/footage/render.ts` `buildMusicArgs`: the music is looped to the film's length and faded out over its last
  1.5 s (`MUSIC_FADE_OUT`); the speech track lasts the cut (`compose.ts` audio, `film-mix.ts`).
- `src/footage/pipeline.ts`: the brand logo is copied to `assets/logo.svg` whatever its type; the glyph check gets
  `film.endCard`; `mixFootage` normalizes the whole film's mix (-14 LUFS, -1 dBTP), the card's tail included.
- `src/config/schema.ts`: `endCardSchema` (`headline`, `url`, `note`), shared with nothing else in footage;
  `brand.logo` accepts `.svg` only and is read by the OG images (data URI) and the screen film.
- `CAPTION_SAFE_ZONES` (`src/footage/captions.ts`) holds the 9:16 platforms' margins.
- No external service involved; everything is testable with the pure builders.
