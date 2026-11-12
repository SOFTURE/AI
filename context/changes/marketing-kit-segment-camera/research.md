# Research: marketing-kit-segment-camera

- `getSegmentScales` gives each segment the scale it starts at (zoom cuts alternate in and out); `getSegmentZoomEases`
  eases a zoom cut; a `kenburns` segment tweens from its scale by `kenBurnsPercent` (4 % for a hand edit).
- The draft draws a moving zoom with `zoompan` (`x='(iw-iw/zoom)*0.5'`, `y='(ih-ih/zoom)*0.42'`), a still one with a
  crop about the same point; a punch-in overlay multiplies the segment's own zoom.
- The render plays one picture video (`picture.ts`) and sets its scale per segment with `tl.set`; a fade's outgoing
  tail is baked into the incoming piece at the zoom the outgoing segment ended on, then the composition scales the
  whole picture to the incoming segment's scale. A fade into a tighter segment therefore shows its tail zoomed too.
- `crop=iw/s:ih/s:(iw-iw/s)*ax:(ih-ih/s)*ay` and `transform-origin: ax ay` keep the same point still, and the crop
  stays inside the frame for any anchor in 0..1.
- The fade length is the film's `edit.fadeFrames` everywhere (draft `planFootageDraft`, picture, composition).
