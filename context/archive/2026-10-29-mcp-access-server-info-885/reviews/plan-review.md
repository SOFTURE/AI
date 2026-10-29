---
change_id: mcp-access-server-info-885
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (6e688f8).

- Acceptance of #885: an optional `get_server_info` tool in mcp-access answering the build info of the route and the
  tool list version of #877; opt-in (factory option), read only (`readOnlyHint`, no input), no user data. Phase 1.
- Bundling: no ops import in `/server`, typed structurally; the README shows the wiring with `readBuildInfo`.
- Version consistency: registering the tool on the recording server too keeps the measured version describing the
  served list; the test that the version changes when the option is on pins it.
- Failure: the changelog failure mirrors the route; a `buildInfo` failure is a tool error, never a crash.
- Risk: none for existing apps; the option is new and off by default.

Verdict: approved.
