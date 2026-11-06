# Research: security-policy

## Findings

- No `SECURITY.md` exists (root, `.github/`, `docs/`). The README has a `## Contributing` section that links AGENTS.md.
- Published packages: 34 public workspaces under `foundation/`, `modules/`, `themes/` and `tools/`, all `0.x`
  (`@softure-ai/core` 0.2.7 … `@softure-ai/marketing-kit` 0.13.1). In `0.x` a minor bump may break, so a fix lands
  on the latest minor only and ships as a patch release (`auto-release.yml` → `release.yml`, npm trusted publishing
  with provenance, also GitHub Packages as `@softure/<name>` and a GitHub Release per tag).
- `examples/` and `templates/` are private workspaces, never published. `@softure-ai/skills` lives in SOFTURE/SKILLS.
- Dependabot (`.github/dependabot.yml`): weekly grouped npm and Actions updates plus security updates; monthly
  Docker base images. AGENTS.md "Dependabot pull requests" says green minor, patch and security updates merge as is.
- `security-alerts.yml` (hourly at :17) turns open code scanning, Dependabot and secret scanning alerts into public
  issues labelled `security` and closes them when the alert is fixed or dismissed. It never reads a secret's value.
  It does not read repository security advisories, so a private report stays private.
- Private vulnerability reporting is a repository setting (Settings → Code security → Private vulnerability
  reporting, or `PUT /repos/{owner}/{repo}/private-vulnerability-reporting`). The session's GitHub tools have no
  call for it.
- `tests/repo/links.test.ts` checks relative links in every `*.md`.
