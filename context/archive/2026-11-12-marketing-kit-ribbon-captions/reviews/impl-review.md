# Implementation review: marketing-kit-ribbon-captions

- Drift from plan: none; the tilt range is -10 to 10 (both directions), recorded in the plan.
- Backward compatibility (checked): the other styles' HTML and ASS carry no ribbon rule, class or capitals (tests);
  the full marketing-kit suite passes unchanged.
- Draft measuring (Warning, fixed): the draft measured the font only with a brand style; a ribbon without one now
  measures it too, so its strips fit their lines.
- Rotation and entrance (checked): the turn sits on the caption box, the entrance tween on `.ribbon`; the browser test
  reads the turn's matrix after the timeline is sought.
- Verdict: approve.
