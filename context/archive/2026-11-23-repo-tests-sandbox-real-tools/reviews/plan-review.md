---
change_id: repo-tests-sandbox-real-tools
verdict: approved
---

# Plan review

- Scope matches issue #1424: only the sandbox lookup changes; the step under test and the workflows are untouched.
- The machine's own `gh` cannot enter the sandbox: `gh` is not in the tool list, and the list is unchanged.
- "Names the tools it needs and does not find" relies on `curl` and `tar` being absent: they still are, since only the
  listed tools are linked.
- macOS: `/usr/bin` and `/bin` hold BSD tools, which the step must support anyway (AGENTS.md, bash 3.2 rule); a tool
  that is in neither directory falls back to the old lookup, so nothing that resolved before stops resolving.
- The new test fails with the old lookup (it would return the wrapper).

Verdict: approved, no changes.
