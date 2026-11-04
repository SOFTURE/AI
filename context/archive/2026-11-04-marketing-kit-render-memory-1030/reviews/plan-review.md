---
change_id: marketing-kit-render-memory-1030
verdict: approved
---

# Plan review: marketing-kit-render-memory-1030

- Covers the issue's expected outcome with measurements: extraction bounded to one ffmpeg (direction 1 of the issue,
  by layout rather than a concurrency limit the kit cannot set), the capture peak inside 1.2 GB on the measured
  film, and the memory settings passed through (direction 3). Direction 2 (releasing frames inside Chrome) is out of
  the kit's reach and is stated as such in research and the README.
- Correctness risks: frame alignment (pieces must start on film frames or the picture drifts against the speech
  track: piece lengths come from rounded film frame boundaries, so the error never accumulates); a fade must look
  as before (the outgoing tail keeps its zoom, the incoming segment's scale is 1 by `getSegmentScales`); a clip
  shorter than its segment (`tpad` clone, as the draft does).
- Compatibility: `composeFootage` without `picture` is unchanged; the render's look changes only by the Ken Burns
  detail during a fade, which goes in the CHANGELOG. Render time grows by one encode of the cut.
- Approved without changes.
