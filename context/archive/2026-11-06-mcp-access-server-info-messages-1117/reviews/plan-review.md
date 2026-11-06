# Plan review: mcp-access-server-info-messages-1117

Verdict: approved.

- Both gaps of the issue are covered: the strings come from the configured messages (all four plus the default
  description), and the changelog names the keys, including a corrected 0.7.0 "Migrate" line.
- Without `config` the tool keeps the English strings, so no app's measured tool list version changes on upgrade.
- The test covers the overridden strings in both the listing and the answers, a second locale and the default.
