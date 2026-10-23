---
change_id: ci-render-ffmpeg-672
reviewed: 2026-10-23
verdict: approved
---

# Plan review: ci-render-ffmpeg-672

Checked plan.md against change.md, research.md, issue #672 and the render job in `.github/workflows/ci.yml`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The fix targets the measured cause (the apt step), not the symptom: the job timeout, the render test and its assertions stay unchanged. | No change. |
| 2 | Minor | Put the tool directory first on `PATH` (`$GITHUB_PATH` prepends) so a runner image that one day ships its own ffmpeg does not silently win over the pinned one. | Covered by `$GITHUB_PATH`; say so in the step comment. |
| 3 | Minor | Verify the checksum before unpacking and fail the step on any mismatch (`sha256sum -c` exits non-zero); keep `set -e` behaviour of the default bash shell. | Adopted in Phase 2. |
| 4 | Check | The repository test is written first and fails on the current workflow, as the conventions ask for a bug fix. | No change. |

No Critical findings.
