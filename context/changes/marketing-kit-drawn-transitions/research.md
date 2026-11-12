# Research: marketing-kit-drawn-transitions

- A dissolve is an overlap: the outgoing segment plays on for `fadeFrames` past its end under the incoming one. The
  draft gives each segment's stream the next fade's tail (`planFootageDraft` `seconds`) and joins with `xfade` at the
  incoming start; the picture builds the incoming piece from the outgoing tail (`PictureFadeTail`, held at the zoom
  it ended on, relative to the incoming camera's start) and the piece's own clip. The composition does nothing at a
  fade when it plays the picture.
- So a drawn transition can reuse the overlap: give whip, card and paper a fixed length (14, 13 and 12 frames), let
  the outgoing tail run under the incoming head, and blend the two streams with one filter builder in both paths.
  The draft splits the joined stream at the incoming start (head, tail), blends the tail with the incoming head and
  concatenates; the picture blends inside the incoming piece.
- ffmpeg 6.1 (local) and 7.1 (the image) checked by prototype on 540x960 test sources:
  - whip: `hstack` of a stream with itself and a `crop` whose `x` follows the frame number gives a wrap-around slide;
    `gblur` with `sigmaV=0` and `enable='eq(n,k)'` per frame gives a horizontal blur that grows with the speed;
    the incoming side lands with `zoompan` from 110 % (0.3 s for 14 frames at 540x960);
  - card: `scale` with per-frame sizes breaks `geq` and `rotate` (a crash on a size change), so each of the 13 frames
    is its own chain (`trim` one frame, `scale`, rounded corners through `geq` on alpha, `rotate`, `pad` back to the
    frame), joined by `interleave` (a `concat` of one-frame pieces after `setpts` loses frames), then `overlay`
    (0.6 s);
  - paper: a `color` source with static `noise` and a soft vertical `gblur` makes a paper grain; `blend` with `N`
    multiplies it in over four frames, a second `blend` opens a torn band (sums of sines along the height) from the
    middle with a light rim (2 s at 540x960, about 8 s at 1080x1920 for 12 frames).
- The stutter is a scale, not a picture: the first five frames at the full frame, then the segment's own still
  framing (or 150 %). The composition sets the scale twice; the draft's `zoompan` steps.
- Overlays already treat any transition other than a plain cut as a shot break and refuse a punch-in on it.
