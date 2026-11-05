# Research: security-alerts-sync

## Findings

- REST endpoints (all `state=open`, `per_page=100`, paged through the `Link` header):
  - code scanning `GET /repos/{owner}/{repo}/code-scanning/alerts`: readable with `GITHUB_TOKEN` and
    `security-events: read`; `rule.security_severity_level` or `rule.severity`, `rule.description`,
    `most_recent_instance.location.path` and `start_line`, `tool.name`, `html_url`;
  - Dependabot `GET /repos/{owner}/{repo}/dependabot/alerts`: not readable with `GITHUB_TOKEN`; needs a token with
    "Dependabot alerts: read". `security_advisory.ghsa_id`, `summary`, `severity`, `dependency.package`,
    `dependency.manifest_path`, `security_vulnerability.vulnerable_version_range`, `first_patched_version`;
  - secret scanning `GET /repos/{owner}/{repo}/secret-scanning/alerts`: needs "Secret scanning alerts: read". The
    alert carries the secret itself in `secret`, which must never reach an issue; the file and line come from
    `GET .../secret-scanning/alerts/{number}/locations` (`details.path`, `details.start_line`).
  - one alert by number (`GET .../{kind}/alerts/{number}`) gives `state` and `dismissed_reason` for the closing
    comment.
- Issues: `GET /repos/{owner}/{repo}/issues?labels=security&state=all` lists pull requests too (`pull_request` key);
  creating an issue with a label that does not exist creates the label, so `pkg: <name>` is added only when
  `GET /repos/{owner}/{repo}/labels` lists it. The repository has `security` and `pkg: <name>` for every workspace
  package (`foundation/`, `modules/`, `tools/`, `themes/`, `templates/`).
- The coordinator's hourly issue check fires at :39 UTC; a sync at :17 lands before it.
- `scripts/release/*.mjs` sets the pattern: `// @ts-check` ES modules, pure rules in one file tested from
  `tests/repo/`, I/O in another. Node 22's `fetch` needs no dependency, so the job needs no `npm ci`.
- The owner creates `SECURITY_ALERTS_TOKEN` on 2026-11-06 and asked (2026-11-05) that the change land now; until
  then a run must not fail every hour.
