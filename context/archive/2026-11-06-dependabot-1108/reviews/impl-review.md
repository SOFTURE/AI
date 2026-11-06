# Implementation review: dependabot-1108

Verdict: approved.

- The test change keeps the assertion (order in the cascade) and only stops pinning the selector's outer shape; the
  compiled CSS still puts the line override (line 2785) and the focus border (2799) after the boundary (2772).
- One hyperframes, one undici in the lockfile; audit 0.
