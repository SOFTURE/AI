---
change_id: marketing-kit-satori-crash
title: "marketing-kit: CLI crashes on satori 0.35.2 (issue #254)"
status: archived
roadmap_item: null
issue: 254
branch: claude/project-thread-wjb5ct
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Every `softure-marketing` command of marketing-kit 0.1.9 dies on start-up when npm resolves `satori: ^0.35.0` to
0.35.2 (or 0.36.0), which is what happens through `npx`, where the consumer has no lockfile
([#254](https://github.com/SOFTURE/AI/issues/254)). After the change the CLI starts with any satori, only `og` loads
satori, and the kit depends on one known-good satori version.

A reviewer checks the new test in `tools/marketing-kit/tests/`, the lazy import in `src/cli/main.ts`, the exact
satori pin, the CHANGELOG and the version bump (marketing-kit 0.1.10).

## Context

- Measured (Node 22, ESM file, satori alone): `import satori from "satori"` succeeds on 0.35.2 and 0.36.0, but the
  import starts the yoga WebAssembly loader in the background; its loader reads `__dirname`, which ESM does not
  define, and the rejected promise ends the process (exit 1) a moment later. 0.35.0, 0.35.1 and 0.37.1 survive the
  import and render. So it is not the `og` command that fails: merely loading satori kills the process.
- `src/cli/main.ts` imports `./og.js` statically, which imports `../og/render.js`, which imports `satori`. Every
  command therefore loads satori.
- The root entry (`src/index.ts`) re-exports the OG API, so an app importing the root entry also loads satori.
  The `./og` subpath already exists.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Backward compatible: no export removed, `marketing.json` unchanged.
- Only `@softure-ai/marketing-kit` changes. Another open change (#253) also touches the kit; this one merges first
  and the kit is released by whichever of the two lands last.

## Process notes

- Research: skipped as a separate artefact. The issue names the cause and the two files; the measurement above
  (five satori versions, import and render) is the whole investigation and fits here.
- Framing: skipped. The failure, its cause and both fixes are measured; there is no competing explanation.
