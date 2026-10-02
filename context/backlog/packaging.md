# Backlog: packaging

Loose findings about what a published package contains. Entry format: WORKFLOW §3.

- [x] 2026-10-02 monorepo-tooling impl review F6: source and declaration maps in `dist/` point at `../src/*.ts`, which `files` does not publish; FD-2 (`release-pipeline`) decides whether packages ship `src/` or no maps (SUGGESTION) `context/archive/2026-10-02-monorepo-tooling/reviews/impl-review.md` → decided in `release-pipeline` (FD-2): packages ship `src/` without tests next to `dist/`, so maps and the `@softure-ai/source` exports resolve; `scripts/release/README.md`
