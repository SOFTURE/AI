---
change_id: mcp-access-api-tokens-961
reviewed: 2026-11-02
verdict: approved
---

# Plan review: mcp-access-api-tokens-961

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | CRITICAL | An API token must never open the MCP endpoint and an MCP or legacy-pattern value must never pass `requireApiToken`. | Planned: the lookup filters on `kind`, shapes are checked per kind; tests cross both ways. |
| F2 | WARNING | A prefix equal to an OAuth prefix would make the shape checks ambiguous. | Planned: the options refuse any prefix starting with `sftmc`. |
| F3 | WARNING | `requireApiToken` asked for a scope the app never declared is a programming bug that would answer 403 forever. | Planned: it throws, named, like the missing bucket. |
| F4 | WARNING | Existing rows get `kind = 'mcp'` and empty scopes through the defaults; the check must hold for them. | Planned: migration test over a row written before 0004 semantics (default values) and the check both ways. |
| F5 | SUGGESTION | An `IssuedToken` union would break apps that read `issued.setup` directly. | Superseded by D4: a separate `api-ok` form state keeps `IssuedToken` as it is. |

No open CRITICAL findings.
