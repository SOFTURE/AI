# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/feature-switches`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`feature-switches@x.y.z`).

## 0.1.6

- `override: "towards-fail-mode"` on a switch: its environment variable can move it only to the fail-mode value; the other value is ignored and logged once.
- Adapters use the configured database handle; `@softure-ai/ui` is a peer dependency.
