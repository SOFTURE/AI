---
change_id: marketing-kit-mix-retry-1095
verdict: approved
---

# Plan review (auto)

- Scope matches change.md: only the retry rule and its caller; first encode unchanged, so one-encode films keep their
  result. No manifest or lockfile.
- The model is backed by measured tries (research.md), and the acceptance criterion requires a test that fails
  before the fix, so the fix is evidenced, not assumed.
- Risk: a fitted slope near 1 would blow up the gain (`1 / (1 - b)`); the plan clamps it to 0.7. A wild gain still
  meets the limiter and the true peak check, and fails visibly after `MIX_ATTEMPTS` rather than publishing.
- The ffmpeg test runs several seeds, so it covers the noise that made the 6 s fixture pass by chance; its runtime
  must stay reasonable (8 s fixtures, few seeds).
- Approved.
