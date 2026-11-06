# Security policy

This repository publishes the `@softure-ai/*` packages: the folders under `foundation/`, `modules/`, `themes/` and
`tools/` (listed in the [README](README.md#repository-layout)). This policy covers those packages and the release
machinery that publishes them.

## Supported versions

Every package is still in `0.x`, where a minor release may change the API. A fix therefore lands on the **latest
minor line of each package** and ships as a new patch release of that line.

| Version | Supported |
| --- | --- |
| Latest published minor of a package (for example `0.13.x` when `0.13.1` is the newest) | Yes |
| Older minor lines of the same package | No: upgrade to the latest minor |
| Unpublished workspaces (`examples/`, `templates/`) and `master` before a release | Not shipped, fixed on `master` only |

The current version of a package is on npm: `npm view @softure-ai/<name> version`.

The agent skills (`@softure-ai/skills`) live in [SOFTURE/SKILLS](https://github.com/SOFTURE/SKILLS) and have their
own policy there.

## Reporting a vulnerability

**Do not open a public issue, pull request or discussion for a vulnerability.**

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**
([direct link](https://github.com/SOFTURE/AI/security/advisories/new)). Only the maintainers see the report.

Please include:

- the package and version (`@softure-ai/<name>@x.y.z`);
- what an attacker can do, and under which configuration;
- steps or a minimal proof of concept to reproduce it;
- any fix or mitigation you have in mind.

Never include real secrets, tokens or personal data in a report; use placeholders.

## What to expect

| Step | Target |
| --- | --- |
| Acknowledgement of the report | within 3 business days |
| First assessment (confirmed or not, severity) | within 7 days |
| Fix released for a critical or high severity issue | within 14 days of confirmation |
| Fix released for a medium or low severity issue | with the next regular release |

We keep you updated in the private advisory until it is resolved, and tell you if a report is not accepted and why.

## Disclosure

We follow coordinated disclosure. Once a fixed version is on npm, we publish a GitHub security advisory for the
affected package (with a CVE when it qualifies), naming the fixed version, and credit the reporter unless they
prefer otherwise. Please give us up to 90 days from the report before disclosing it yourself; we publish earlier when
the fix is out.

## How fixes ship

- Every release is built and published from GitHub Actions (`release.yml`) through npm trusted publishing, with
  provenance: `npm audit signatures` verifies a package came from this repository.
- A fix is a patch release of the supported line; the advisory names the version to upgrade to.

## Automated checks

- **Dependabot** alerts and security updates are on. Security fixes arrive as one grouped pull request, version
  updates once a week ([`.github/dependabot.yml`](.github/dependabot.yml)); a green security update is merged and
  rides the next release.
- **Code scanning, Dependabot and secret scanning alerts** are turned into issues labelled `security` every hour
  ([`security-alerts.yml`](.github/workflows/security-alerts.yml)), and those issues are worked like any other. The
  issue is closed automatically when its alert is fixed or dismissed. A secret's value never appears in an issue.
- Private vulnerability reports are never turned into issues: they stay in the private advisory until disclosure.

## Out of scope

- Vulnerabilities in an application that uses these packages, unless the package itself causes them.
- Issues in third-party dependencies that already have a public advisory (Dependabot picks those up); a report is
  still welcome when a package uses a dependency in a way that makes it exploitable.
- Missing hardening with no demonstrated impact, and findings from automated scanners without a working scenario.
