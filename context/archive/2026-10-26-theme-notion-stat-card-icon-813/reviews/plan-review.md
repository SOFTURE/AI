---
change_id: theme-notion-stat-card-icon-813
verdict: approved
---

# Plan review

- Coverage: both acceptance points (icon before the label, unchanged card without it; decorative icon) have a step
  and a test.
- Risk: the gallery's visual baselines or slot snapshot pin the StatCards markup; a new case is added rather than an
  existing one changed, so existing baselines stay valid. Accepted.
- Risk: `LucideIcon` excludes a non-Lucide icon. The design system uses Lucide only. Accepted.
- Risk: the CHANGELOG `Unreleased` section is also edited by #809; master merged in before the merge.
