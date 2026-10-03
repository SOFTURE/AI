# Plan review: mk-core-port

Reviewed: plan.md @ 2026-10-03. Mode: deep (the riskiest claims checked by hand against FIRE at 58e6c84
and a scratch install). Verdict: ready after fixes.
Findings: 0 critical, 3 warning, 1 suggestion.
Grounding: 14/14 paths (FIRE `video/src/*.ts`, `templates/package/*`, `tests/repo/packages.test.ts`,
`vitest.config.mts`, `examples/next-app/playwright.config.ts`, `scripts/check-language.mjs`), 7/7 symbols
(`voiceoverKey`, `readChannelTag`, `readSiteTokens`, `composeFilm`, `recordFilm`, `checkManifest`,
`findWorkspaces`), 4/4 commands (`npm run typecheck|lint|test|build` from `workflow.json`).

## Riskiest claims

| Claim | Result |
| --- | --- |
| hyperframes runs from `node_modules` without `npx` and without a Chrome download | confirmed: no `exports`, `bin/hyperframes.mjs`; render with `HYPERFRAMES_BROWSER_PATH` took 6.5 s (research, Measurements) |
| Files under `tools/marketing-kit/examples/` are typechecked and linted | confirmed: the root `tsconfig.json` excludes only `./examples`; ESLint's ignore is `examples/**` from the root; the package `tsconfig.json` must include `examples/**` for the project service |
| Vitest does not run the fixture by default | confirmed: `include` covers `tools/*/{src,tests}` only (`vitest.config.mts:33-36`); the render test is `runIf` on an env variable |
| `bin` passes the release rules | confirmed: `checkManifest` checks name, version, licence, `repository`, `publishConfig`, `files`, internal ranges; nothing forbids `bin` (`scripts/release/release-rules.mjs:141-159`) |

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS |
| Verifiability | WARN (S1) |
| Data and migrations | PASS (none) |
| Tests | PASS |
| Security | WARN (W1) |
| Lean | PASS |
| Fit | PASS |
| Cost and defaults | WARN (W2, W3) |
| Scope | PASS |
| Reuse | PASS |
| Lessons | PASS (L-001: build with tsc) |
| Progress format | PASS |

## Findings

### W1 [WARNING] A start command string would need a shell
**Effort:** low. **Lens:** Security. **Where:** Key decisions, Config.
**Problem:** FIRE spawns `npx next dev -p 3100` as an argument list (`cli.ts:225`). A config string
would have to be split or run through a shell, which turns a config value into shell syntax.
**Fix:** `startCommand` is an argument array with a `{port}` placeholder, spawned without a shell in
the config folder.
**Decision:** Fix now (applied to plan.md).

### W2 [WARNING] The TTS language stays Polish for an English project
**Effort:** n/a here. **Lens:** Cost and defaults. **Where:** `voiceover.ts:48-66`.
**Problem:** `voiceoverKey` and `buildTtsRequest` fix `pl`. With `locale: "en"` a paid voiceover would
still be read with Polish number normalisation. Changing the key now would orphan FIRE's paid cache.
**Fix:** keep it byte-identical in MK-1 (the plan's critical detail) and say so in the README; the
language becomes part of the key and the request in MK-7 (`mk-tts-adapters`), which the roadmap
already scopes ("cache key includes voice, model and language").
**Decision:** Accept (owned by MK-7; noted for MK-2/MK-7 in the handoff).

### W3 [WARNING] hyperframes telemetry is on by default
**Effort:** low. **Lens:** Cost and defaults. **Where:** Key decisions, hyperframes.
**Problem:** FIRE never set `HYPERFRAMES_NO_TELEMETRY`; a public package would send anonymous render
telemetry from every user's machine.
**Fix:** already in the plan: set `HYPERFRAMES_NO_TELEMETRY=1` unless the caller set it. The README names it.
**Decision:** Fix now (in plan).

### S1 [SUGGESTION] Make the manual check concrete
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 3, Manual.
**Problem:** "a frame shows the phone" did not say which frame or how to get it.
**Fix:** extract the mid-scene and last-second frames with ffmpeg and look at them.
**Decision:** Fix now (applied to plan.md).
