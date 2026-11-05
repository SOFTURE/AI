# Plan review: mcp-access-tool-contract-1078

Verdict: approved.

- Each acceptance line of the issue maps to a test: equality with `tools/list` for both levels, the version, `name`,
  unknown name, no user data, README wording.
- Backwards compatible: with `tools` off nothing in the listed tool changes, so no app sees a new version.
- The contract comes from the same measurement as the version, so the two never disagree.
- Risk: the measurement includes `get_server_info` itself; its handler reads the measurement lazily at call time, so
  there is no cycle.
