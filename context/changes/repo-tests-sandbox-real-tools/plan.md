# Plan: repo-tests-sandbox-real-tools

## Approach

Extract the lookup of `makeSandbox` into `findRealTool(tool, path)` that checks `/usr/bin/<tool>` and `/bin/<tool>`
before `command -v` on the given `PATH`, and pin it with a test that puts a wrapper `rm` first on `PATH`.

## Decisions (auto)

- System directories before `PATH` instead of skipping shell scripts (macOS `shasum` is a script).
- `PATH` fallback kept for tools outside the system directories (e.g. `sha256sum` from Homebrew on macOS).
- The resolver takes the `PATH` as an argument so the test can put a wrapper first without touching `process.env`.

## Phases

1. Test first (the resolver test fails on master's logic), then `findRealTool` and its use in `makeSandbox`.

## Acceptance

- `npx vitest run tests/repo/workflow-runners.test.ts` passes in this container (wrapper `rm` first on `PATH`), the
  four tests from #1424 included; it failed 4 of 95 before.
- `npm run typecheck` and `npm run lint` green.
- macOS: the `macos.yml` workflow is not triggered by a test-file change, so the evidence is the tool locations above
  (every tool resolves to `/usr/bin` or `/bin`, or to the previous `PATH` lookup).

## Progress

- [ ] Phase 1
