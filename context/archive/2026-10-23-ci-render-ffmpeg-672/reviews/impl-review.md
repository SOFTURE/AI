---
change_id: ci-render-ffmpeg-672
reviewed: 2026-10-23
verdict: approved
---

# Implementation review: ci-render-ffmpeg-672

Checked the diff (888e6b8, fa624f8) against change.md, plan.md, the plan review and issue #672.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The apt install is gone from the render job; ffmpeg and ffprobe come from the versioned `b6.0` release, are checked with `sha256sum -c` before unpacking, and the step fails within `timeout-minutes: 3`. The job timeout (15), the render test and its assertions are unchanged. | No change. |
| 2 | Check | `$GITHUB_PATH` prepends the tool directory, so the pinned ffmpeg wins over any runner copy (plan review #2); the step prints the version it installed. | No change. |
| 3 | Check | The repository test failed on the old workflow and passes now; it pins a versioned release (not `latest`), both checksums and the shorter step timeout. | No change. |
| 4 | Check | FFmpeg 6.0 instead of Ubuntu's 6.1.1: the render test (phone, JSON twin, desktop, placeholder rehearsal) passes locally with it first on `PATH`. | No change. |
| 5 | Minor | `curl --retry 3` retries transient failures but not a slow transfer; the step timeout bounds that case and names the step. | Accepted as is: GitHub's release CDN is the same source the job already relies on for checkout and actions. |

No findings to fix. Gates: language, typecheck and ESLint (pre-commit), actionlint on ci.yml, `tests/repo` and the full
suite (pre-push), the render job on the pull request.
