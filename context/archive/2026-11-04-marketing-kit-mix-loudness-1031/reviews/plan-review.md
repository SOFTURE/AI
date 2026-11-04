---
change_id: marketing-kit-mix-loudness-1031
verdict: approved
---

# Plan review: marketing-kit-mix-loudness-1031

- Covers the three asks: the mix normalized to a target in the finish (default on, null off, silent left as is, log
  line), ducking attack and release on `FootageMusic` and in `marketing.json`, and a measured test.
- Compatibility: new fields are optional. Default behaviour changes on purpose (the issue asks for publishable
  defaults): a film's audio is now re-encoded once in the finish; the video is still copied.
- Risk: the AAC encode after `loudnorm` could overshoot the true peak; research measured it well under the target on
  two fixtures, and the test pins the bound.
- Approved without changes.
