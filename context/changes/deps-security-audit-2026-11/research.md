# Research: deps-security-audit-2026-11

## Findings

- `npm audit --json` on `f05735c`: 20 entries. Direct: `next`, `zod`, `markdown-it`, `vite`, `happy-dom`, `satori`,
  `eslint`, `@eslint/js`, `typescript-eslint`. The eslint, typescript-eslint and satori entries are only carriers of
  `minimatch` and `fflate`.
- In-range fixes (lockfile only): `zod` 4.6.7, `vite` 8.3.6, `undici` 7.x latest (`@ai-sdk/provider-utils` asks
  `^7.29.0`), `puppeteer-core` 25.16.0 (`hyperframes` asks `^25.10.0`), which brings a fixed `chromium-bidi`.
- `next`: latest 16.4.5; root asks `^16.3.8`, `examples/next-app` pins `16.3.8`. Modules declare peer `^16.0.0`.
- `markdown-it` 15.0.3 fixes both advisories; `@softure-ai/blog` asks `^15.0.2`.
- `happy-dom`: the fix for GHSA-834v-8h66-3h79 is only in 21.0.4 (major). Used only as the Vitest environment.
- `fflate`: every satori version up to 0.63.2 pins `fflate` `0.7.3` exactly, so no satori upgrade helps; `0.7.5` is
  the fixed patch in the same minor. A root override is the only fix inside this repository; npm does not apply a
  dependency's overrides for its consumers.
- `minimatch`: eslint 10.14.0, `@eslint/config-array` 0.23.5 and `@typescript-eslint/typescript-estree` 8.72.1 still
  ask `^10.x`; the fix is `>=11.0.1`. Dev only; a root override to `^11.0.4` is the fix, provided lint still runs.

## Decisions (auto)

- Peer range of `next` and runtime floors of `zod` stay; see change.md Constraints.
- Overrides over waiting for upstream: both are dev or build-time paths and the gates prove they work.
