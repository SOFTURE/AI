---
change_id: theme-notion-a11y-747
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and issue #747.

- Scope: two shadcn files of theme-notion, their tests and the docs; no other package, no API break (both additions
  are optional or automatic).
- Semantics: a role on an `asChild` link would hide the link from assistive tech; skipping it is right, the README
  note covers the gap.
- Risks: a caller that already passed `role` to `Item` keeps it; the context default is `false`, so a lone `Item`
  renders as before.
- Tests: cover every acceptance item at the markup level; the axe run itself lives in #741's gallery.

Verdict: approved.
