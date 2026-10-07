# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/blog`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`blog@x.y.z`).

## 0.1.6

- Adapters and commands use the configured database handle.
- `@softure-ai/ui` is a peer dependency; the package keeps its own CSS.
