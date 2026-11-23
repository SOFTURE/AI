# Research: repo-tests-sandbox-real-tools

## What exists

- `tests/repo/workflow-runners.test.ts` `makeSandbox(tools)`: for each tool, `bash -c "command -v <tool>"` and a
  symlink in `<sandbox>/bin`; the step then runs with `PATH=<sandbox>/bin` only.
- Reproduced in this container: `type -a rm` lists `/root/.claude/rm-guard/.../refuse/rm`, `/usr/bin/rm`, `/bin/rm`;
  `npx vitest run tests/repo/workflow-runners.test.ts` fails exactly the four tests named in the issue (`expected 127`).
- Tool locations: on Linux runners every listed tool lives in `/usr/bin` (or `/bin`). On macOS `tar`, `gzip`, `cut`,
  `shasum`, `perl` are in `/usr/bin`, `mkdir`, `rm`, `cp` in `/bin`; `sha256sum` may be missing (the step falls back
  to `shasum`), so a missing tool must stay missing rather than fail.
- macOS `shasum` is a Perl script itself, so "skip scripts" (the issue's first idea) would drop a real tool there.

## Options

- System directories first, then `command -v` (chosen): simple, no file inspection, real binaries on every runner.
- Walk `type -ap` and skip wrappers: needs a rule for what a wrapper is; breaks on macOS `shasum`.
