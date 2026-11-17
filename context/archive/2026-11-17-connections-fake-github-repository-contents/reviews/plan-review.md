---
change_id: connections-fake-github-repository-contents
verdict: approved
---

# Plan review

- Scope matches change.md: testing entry only, no runtime code, no migration.
- Risk: a fake that answers contents to any bearer would hide a token bug in an app. Addressed: only a live token of an
  installation reaching the repository, narrowed `repository_ids` honoured; tested with another installation, no token
  and an uninstalled installation.

Verdict: approved, no changes.
