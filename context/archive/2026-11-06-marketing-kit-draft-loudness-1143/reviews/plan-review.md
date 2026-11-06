---
change_id: marketing-kit-draft-loudness-1143
verdict: approved
---

# Plan review (auto)

- Scope matches change.md and the issue's three asks (same speech stages, same mix stage with its options, the
  loudness answered as the render does).
- Reuse over copy: every stage is the render's exported function, so the draft cannot drift from it and #1139's
  edits reach both.
- Risk: the draft becomes slower by the mix stage's probes; they are audio only and capped (`MIX_GAIN_PROBES`).
- Risk: a draft can now fail on loudness; that is the render's behaviour, which is what the owner judges by.
- The acceptance asks for a quiet-fixture test that fails before the fix.
- Approved.
