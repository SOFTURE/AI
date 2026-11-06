# Plan review: security-policy

Verdict: approved.

- Covers every point of the brief: supported versions from the real packages, private reporting, response times,
  Dependabot and the alert sync.
- Stating support per version line keeps the file true after every release with no test to maintain.
- The policy keeps private reports out of public issues; the alert sync does not read advisories, so it cannot leak one.
