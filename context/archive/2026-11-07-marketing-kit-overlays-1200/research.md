# Research: EDL overlays (issue #1200)

- `footage/edl.ts`: `Edl { version: 2, film, segments }`, `edlSchema` (strict), `validateEdl` (no words). Words in film
  time come from `remapWords` in the render and the draft, so a word-anchored overlay resolves there.
- Render: `composeFootage` plays one `#picture` (or `#seg<i>`) and sets each segment's scale; `zoom` cuts ease and
  `kenburns` segments tween the same element's scale, so a punch-in must stay off Ken Burns segments and out of a
  zoom ease.
- Draft: `buildPictureFilters` zooms with `crop` or `zoompan` around the render's origin; libass draws ASS drawings
  (`\p1`) at absolute positions and `BorderStyle 3` cards, so every overlay kind has an ffmpeg-only form.
- HyperFrames registry (https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry, Apache-2.0):
  `push-in` (camera push, IN 0.8 s sine.inOut), `lt-soft-pill` (pill scale-pop back.out(1.7), dot back.out(3), text
  settle), `marker-highlight` (stroke dash draw), `hw-arrow` (draw-on arrow, head arrives last). They are
  standalone compositions with CDN scripts; the kit adapts their motion into its own markup and credits them.
- Safe zones: `CAPTION_SAFE_ZONES` (9:16 1080×1920); caption band from the film's caption box and line count.
- hyperframes 0.9.20: same dependencies (undici 7.25.0), same render flags and capture summary as 0.9.6.
