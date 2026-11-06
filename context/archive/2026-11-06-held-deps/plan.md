# Plan: held-deps

## Phases

1. typescript-eslint ^8.72.1 with single-run inference off in `eslint.config.mjs`; measure the lint's peak memory.
2. OpenTelemetry 3.1 / 0.301 and forwarded-parse 2.2.0 in observability (and sdk-trace in llm); refresh the root and
   example app lockfiles.
3. satori 0.63.2: border-box default in `h()`; portrait-fit oracle green; re-record and compare the four snapshots.
4. fflate: README note with the consumer override; changelog entries.
5. Gates (typecheck, lint, language, full tests), PR, CI, merge on the coordinator's go, combined release.

## Decisions (auto)

- No Dependabot ignore rules: all three upgrades land. fflate is not a Dependabot version update in this repository
  (the root override already holds 0.7.5).
- Border box as the default in `h()` rather than per template: every template was written for it, and one place keeps
  new templates right.
- Drop observability's `forwarded-parse` dependency: the static import makes the workaround dead code, and leaving
  the version to `instrumentation-http` ends the hold for good.
- typescript-eslint `^8.72.1` instead of `~`: the hold is gone, later 8.x minors arrive through Dependabot.

## Progress

- [x] p1 lint with 8.72.1 and single-run off: exit 0, peak RSS 5.95 GB (8.72.1 with it on: OOM at 8 GB)
- [x] p2 OTel 3.1 / 0.301, forwarded-parse 2.2.0 single copy (from instrumentation-http); workaround removed;
  `npm audit`: 0 vulnerabilities (root and example app); example app `BUILD_STANDALONE=1 next build` ships
  `node_modules/forwarded-parse`, `node server.js` with an OTLP endpoint answers 200 with no missing module
- [x] p3 satori 0.63.2: `vitest run tools/marketing-kit` 1080 passed; snapshot diffs are anti-aliasing only (looked at
  side by side)
- [x] p4 README and changelogs
- [ ] p5 gates, PR, merge, release
