---
change_id: marketing-kit-mouth-clicks-1182-1183
verdict: approved
---

# Plan review (auto)

- Scope matches both issues: #1182's three missing pieces (zone on the real sound, the impulse rule, the quiet check)
  and its API; #1183's minimum pause, protection zone, limits with `skippedLimit` and the shared rule.
- #1182 asks for no change to the declick stage: the new behaviour is a new level, `gentle` / `strong` keep their
  output sample for sample (only the report gains `skippedLimit: 0`).
- Compatibility: additive except `findImpulses` / `DECLICK_SETTINGS` narrowing to the two detector levels (0.x minor).
- Risk: the window choice for the energy bound; the research note settles it. Approved.
