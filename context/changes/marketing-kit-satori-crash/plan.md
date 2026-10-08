# Plan: marketing-kit-satori-crash

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one package).

## Goal

The `softure-marketing` CLI loads satori only for `og`, and the kit pins satori to an exact known-good version,
with a regression test, CHANGELOG and marketing-kit 0.1.10.

**Out of scope:** dropping the OG re-exports from the root entry (a breaking change; the pin covers apps importing
it); moving to satori 0.37 (new minor, untested with the templates).

## Key decisions

- **D1** `main.ts` drops the static `import { writeOgImages } from "./og.js"` and loads it inside the `og` branch
  with `await import("./og.js")`. No other module in the CLI's static import graph may reach `satori`.
- **D2** `dependencies.satori` becomes `"0.35.1"` exactly: the newest 0.35 patch that loads, same API as the
  0.35.0 the lockfile has today. A floating range is what let a bad patch break every `npx` user at once; the kit
  already pins `hyperframes` exactly for the same reason.
- **D3** Test (`tests/satori-isolation.test.ts`): walks the static (non-type) imports from `src/cli/main.ts` and
  asserts no reached module imports `satori`, while `src/cli/og.ts` does reach it (so the walker is proven to see
  satori); and asserts the satori dependency is an exact version (`/^\d+\.\d+\.\d+$/`).
- **D4** Docs: CHANGELOG `0.1.10`; README `npx` example unchanged except the version it shows.

## Phase 1: lazy OG import and satori pin (TDD)

- Tests first (`tests/satori-isolation.test.ts`), seen red on master code.
- Code: `src/cli/main.ts`, `package.json` (satori pin, 0.1.10), lockfile, CHANGELOG, README version.
- Real check: build the kit, put satori 0.35.2 next to it, and run `node dist/cli/main.js --help`-like command
  (a non-`og` command) before and after: crash before, no crash after.

Done when: the new test was seen red, then green; the real check shows the crash gone; gates green (typecheck,
lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: lazy OG import and satori pin

#### Automated
- [ ] 1.1 Isolation and pin tests seen red, then green
- [ ] 1.2 Built CLI survives satori 0.35.2 on a non-og command
- [ ] 1.3 Gates green (typecheck, lint, test, build)
- [ ] 1.4 CHANGELOG, README and version 0.1.10
