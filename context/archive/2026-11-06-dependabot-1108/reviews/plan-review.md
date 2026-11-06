# Plan review: dependabot-1108

Verdict: approved.

- Scope matches change.md: the passing part of #1108, nothing else.
- Risk: Tailwind 4.3.4 changes how group variants serialize; the theme-notion CSS tests cover the cascade order that
  matters (line variant and focus border after the selected tab's boundary).
