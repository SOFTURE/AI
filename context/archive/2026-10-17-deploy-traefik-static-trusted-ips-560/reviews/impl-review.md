---
change_id: deploy-traefik-static-trusted-ips-560
reviewed: 2026-10-17
verdict: approved
---

# Implementation review: deploy-traefik-static-trusted-ips-560

Reviewed: the branch diff against plan.md, change.md and issue #560.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance: with the ranges in the file no warning (YAML block, YAML flow, TOML multi-line tests); a missing range warns in the file layout (new test) and in the compose layout (existing test, unchanged). | No change. |
| 2 | Check | Without the option the compose check is the same: `missing_from` is the old loop moved into a function; the existing compose test passes unchanged. | No change. |
| 3 | Check | A key like `trustedIPsExtra` or a commented `# trustedIPs: [...]` is not read: comments are stripped first and the key must be followed by `:` or `=` (the missing-range test carries such a comment). | No change. |
| 4 | Check | bash 3.2 and BSD tools: a here-string, `case`, awk with POSIX classes and an octal `\047` escape; the `macos` CI job runs these tests with the system awk. | No change. |
| 5 | Minor | `for range in $(...)` splits on words and would glob; a range that passed the hook's CIDR patterns holds no glob character. | No change. |
| 6 | Check | Bad arguments fail before any download, so a typo in deploy.json shows on the first release instead of silently checking nothing. | No change. |
