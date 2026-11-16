# Plan review: aside-panel-keeps-sidebar

- Backward compatibility (Warning, accepted): optional prop, default keeps the fold; existing tests stay untouched and
  must pass.
- Opener label (Suggestion, accepted): the default label says "and hide the panel", wrong in the new mode; the app
  passes its own label, and the README says so (no new message key, to keep the change small).
- Verdict: approve.
