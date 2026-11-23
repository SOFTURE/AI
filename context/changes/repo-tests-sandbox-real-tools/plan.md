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

- [x] Phase 1 (985a663c): `findRealTool` checks `/usr/bin` and `/bin` before `command -v`; the new test
      "links the real tool when a wrapper of the same name comes first on PATH (issue #1424)" fails with the old lookup
      (5 failed of 96, the four from the issue included) and passes with the new one;
      `npx vitest run tests/repo/workflow-runners.test.ts` 96 of 96 in this container with the `rm` guard first on
      `PATH`. `npm run typecheck`, `npm run lint` green.
