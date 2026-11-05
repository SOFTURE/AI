# Plan review: marketing-kit-draft-nbsp-1080

Verdict: approved.

- The plan covers both caption styles, matching the issue's test request.
- Trimming must not strip a leading or trailing U+00A0 before it becomes `\h`: `trim()` also strips U+00A0, so the
  trim runs on ordinary spaces only. Recorded as a requirement for the implementation.
- The `\h` escape is emitted after backslashes are replaced, so the text cannot inject override tags.
