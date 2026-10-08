# Plan review: marketing-kit-satori-crash

Reviewed: plan.md against change.md, issue #254, `tools/marketing-kit/src/cli/{main,og}.ts`, `src/index.ts`,
`package.json` and the lockfile.

Verdict: **ready to implement** (no blocking findings).

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The lazy import alone does not protect the `og` command or apps that import the root entry: both still load satori. The exact pin (D2) is what fixes them; the lazy import limits the blast radius of the next bad OG dependency. Both are needed. | No change: D1 and D2 together. |
| 2 | Suggestion | The isolation test must ignore `import type` lines (erased at build time) or `main.ts`'s type imports would be counted as edges. It must also follow `export … from` re-exports. | Accepted: the walker reads `import … from` and `export … from`, skipping `import type`/`export type`. |
| 3 | Check | No other dependency of the kit pulls satori (`hyperframes` dist has no satori import; the lockfile lists it once, under the kit). | No change. |
| 4 | Check | Pinning is the kit's existing convention (`hyperframes: "0.8.85"`). Renovate-style bumps are manual; that is the point. | No change. |
| 5 | Check | Coordination with #253 (same package): this change bumps to 0.1.10; #253 adds its entries under the same unreleased 0.1.10 after merging master. The release goes out from whichever lands last. | Recorded in change.md. |

No migration, no API removal, `marketing.json` schema untouched.
