---
project: "SOFTURE AI"
version: 2
status: accepted
created: 2026-10-02
updated: 2026-10-04
source: shape-notes.md (session 1)
---

# PRD v1: tested building blocks that AI agents assemble instead of rewriting

## Summary

- **Problem:** AI agents rebuild the same app infrastructure for every product, slowly and with
  different bugs each time.
- **Who:** the owner's agents (first consumer: FIRE_TRACKER), then open-source React/Next.js/Postgres users.
- **Outcome:** a public family of `@softure-ai/*` packages. Each package is a vertical slice from
  migrations to styled UI, switched on through one config file.
- **Appetite:** wave by wave. Each wave ends with FIRE_TRACKER running on the released modules.
- **Release boundary for v1:** the foundation, plus the identity modules adopted by FIRE.
  The remaining themes are queued roadmaps.

## Goals

- **G-1:** An agent adds a generic capability to a Next.js app by installing and configuring a
  module, without writing the capability itself (measured in the example app and in FIRE).
- **G-2:** Every module is proven in production by FIRE_TRACKER adopting it and deleting its own
  implementation.
- **G-3:** Modules can be styled and translated by parameters alone (tokens, slots, messages),
  with no forking.
- **G-4:** Releases are reproducible and verifiable: a tag produces npm and GitHub Packages
  artifacts with provenance, plus a GitHub Release.

## Non-goals

- A hosted service or a dashboard.
- Frameworks other than Next.js in v1 (the server core stays framework-free so they can come later).
- Databases other than Postgres (PGlite is supported for tests and dev).
- A visual page builder or CMS.

## Users

See `shape-notes.md` → "Who it is for".

## Current system

Plan and skeletons only (`docs/01`–`05`, READMEs). Docs 01–05 stay the reference: 01 is the
source map, 02 the module standard, 03 the marketing-kit, 04 the skills, 05 the adoption playbook.

## Functional requirements

| ID | Requirement (observable behaviour) | Priority | Goal | Module |
|---|---|---|---|---|
| FR-1 | A monorepo build produces typed ESM packages and compiled CSS; gates (typecheck, lint, unit) run in CI on every push | must | G-4 | tooling |
| FR-2 | A per-package tag (`<package>@x.y.z`, e.g. `core@0.1.0`) publishes `@softure-ai/<package>` to npm (OIDC, provenance), `@softure/<package>` to GitHub Packages, and creates a GitHub Release with the tarball | must | G-4 | tooling |
| FR-3 | `defineSoftureConfig` validates the app config at startup; a module is enabled by being listed | must | G-1 | @softure-ai/core |
| FR-4 | Modules expose `Result`/error codes, an injectable clock and DB, and messages with partial overrides | must | G-3 | @softure-ai/core |
| FR-5 | `softure migrate` applies each enabled module's SQL migrations in its own schema, in dependency order, with checksums, a lock, `--plan` and `--adopt` | must | G-1 | @softure-ai/db |
| FR-6 | `createTestDatabase(modules)` gives a PGlite database with real migrations for unit tests | must | G-2 | @softure-ai/db |
| FR-7 | UI ships `--sft-*` tokens (light and dark), a theme provider and switch, compiled CSS in `@layer softure`, and `classNames`/`unstyled` on every component | must | G-3 | @softure-ai/ui |
| FR-8 | UI primitives: Button, Modal, Toast, Select, Switch/Checkbox/SegmentedControl, form fields, Card, Hint, ActionForm, icons | must | G-1 | @softure-ai/ui |
| FR-9 | An example Next app mounts every released module, and e2e tests run against it in CI | must | G-2 | examples |
| FR-10 | Rate limiting with configurable buckets and a pluggable client-IP resolver | must | G-1 | @softure-ai/security |
| FR-11 | Register (with stored consent), login, logout, sessions, change password | must | G-1 | @softure-ai/auth |
| FR-12 | Password reset with an emailed, single-use, expiring token | must | G-1 | @softure-ai/auth |
| FR-13 | Roles with `requireRole`; admin-only surfaces fail closed | must | G-1 | @softure-ai/auth |
| FR-14 | Runtime feature switches declared by app and modules, with an admin-only panel, env overrides and a fail mode | must | G-1 | @softure-ai/feature-switches |
| FR-15 | Health endpoint aggregating module checks; a migrate step runnable in a container before app start | must | G-1 | @softure-ai/ops |
| FR-16 | Mail transport via adapters (Resend first), signed one-click unsubscribe (RFC 8058), exactly-once delivery ledger | should | G-1 | @softure-ai/mailing |
| FR-17 | Campaigns sent from a content file through the ledger; DNS check for SPF/DKIM/DMARC | could | G-1 | @softure-ai/mailing |
| FR-18 | Waitlist sign-up with consent scopes, a welcome mail and unsubscribe | should | G-1 | @softure-ai/waitlist |
| FR-19 | MCP access tokens (hashed, scoped, expiring) with a Bearer-protected endpoint around an app-provided server factory, and a token UI | should | G-1 | @softure-ai/mcp-access |
| FR-20 | GDPR registry: modules and the app register export/delete contributors; self-service export and account deletion | should | G-1 | @softure-ai/privacy |
| FR-21 | Consent records (who, what, when, document version) and a legal-document shell | should | G-1 | @softure-ai/privacy |
| FR-22 | Entitlements trial/paid/read-only with a write guard, plans from config, pricing tiles, a manual payment adapter | could | G-1 | @softure-ai/billing |
| FR-23 | Channel tagging and a cookieless funnel counter with daily aggregates and a report function | could | G-1 | @softure-ai/analytics |
| FR-24 | Marketing-kit CLI renders videos from `marketing.json` + brand, reproducing FIRE's current film (same scenes, timing and output format) | should | G-1 | @softure-ai/marketing-kit |
| FR-25 | Marketing-kit renders screenshots with quality gates and OG images from templates outside Next | could | G-1 | @softure-ai/marketing-kit |
| FR-26 | Each module has an adoption guide; FIRE_TRACKER adopts it and deletes its own implementation | must | G-2 | all |
| FR-27 | `robots` names AI crawlers in explicit, switchable lists (search, on-demand, training); a sitemap carries real `lastmod` values from contributors; changed URLs are submitted through IndexNow | should | G-1 | @softure-ai/seo |
| FR-28 | Articles and glossary terms live as Markdown files with a validated frontmatter and are published to the module's tables by a CLI (dry run by default) that keeps slug history | should | G-1 | @softure-ai/blog |
| FR-29 | The blog renders on the server with a safe Markdown renderer and glossary links, and ships listing, article and glossary pages with JSON-LD, 301/410, OG images, RSS and "read next" | should | G-1 | @softure-ai/blog |
| FR-30 | A quality gate (structure, links, style rulesets, YMYL, rule plugins) blocks publishing a failing text; a writing skill installed into the app follows the same rules | should | G-1 | @softure-ai/blog |
| FR-31 | SVG chart primitives (scales, ticks, axes, lines, legend, flags) render on the server; a cursor works with the keyboard and a data table backs every chart | could | G-1 | @softure-ai/charts |
| FR-32 | Test helpers check WCAG contrast in both themes and colour distance under colour-vision simulation, for ui tokens and chart palettes | could | G-2 | @softure-ai/ui, @softure-ai/charts |
| FR-33 | A deploy CLI renders production env from secrets, writes release notes, backs up and guards the schema before a deploy, and verifies production from config; reusable workflows build, deploy over SSH and verify | could | G-1 | @softure-ai/deploy |
| FR-34 | `softure-deploy init` generates the app-owned deploy files (compose, Traefik rules, Dockerfile, server script, caller workflow) once | could | G-1 | @softure-ai/deploy |
| FR-35 | Test tools: a Vitest clock shift and generic Playwright helpers used by the example app | could | G-2 | @softure-ai/testing |

Acceptance criteria per FR are written in the roadmap item that delivers it and refined in that
change's research and plan. This PRD does not duplicate them.

## Non-functional requirements

- **NFR-1:** Every package runs on Node ≥ 22 and Next ≥ 16 / React 19, and builds ESM with `.d.ts`.
- **NFR-2:** Every module has unit tests on PGlite, plus e2e in the example app. A release needs
  100 % green gates.
- **NFR-3:** No module's `server/` imports `next/*`. No `ui/` contains raw colours, inline copy
  or `next/link` (architecture tests).
- **NFR-4:** Every migration is forward-only SQL with a rollback note. Editing an applied
  migration fails the checksum.
- **NFR-5:** Security defaults: hashed tokens only, secure cookies, rate limits on public
  endpoints, authorization on every action, fail-closed admin checks.
- **NFR-6:** All code, comments, identifiers and commits are in English. UI copy comes as `pl` +
  `en` dictionaries with complete keys.
- **NFR-7:** The compiled CSS of one module is ≤ 20 kB gzip, and no runtime CSS-in-JS is used.

## Success metrics

| Metric | Baseline | Target | How measured | When |
|---|---|---|---|---|
| FIRE generic code replaced by modules | 0 modules | security, auth, switches, ops adopted | FIRE adoption changes merged, CI green | end of identity roadmap |
| Time for an agent to add auth + switches to a fresh app | not measured | < 1 h agent time | timed run on the example app | end of identity roadmap |
| Release integrity | n/a | 100 % of releases with provenance and a GitHub Release | registry + releases page | every release |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Server actions from `node_modules` misbehave in Next | medium | high | spike first (identity roadmap item 1); fall back to route handlers + client hooks |
| Adoption migrations corrupt FIRE data | low | high | `--adopt --plan`, dry run on a production copy, backups before release |
| Over-generalising modules slows delivery | medium | medium | extract only what FIRE proves; gaps go to issues |
| Next major changes break adapters | medium | medium | the adapter layer is thin; the core is framework-free |

## Out of scope

Landing sections and the public shell (possible later theme), domain-specific MCP tools, a CMS with a
web editor (the blog publishes Markdown files from the repository), server provisioning (the owner's Ansible
collection).

## Open questions

- Payment provider after the manual adapter: owner, before the monetization roadmap.
- Second consuming app after FIRE: owner, at the end of the identity roadmap.

## Changelog

- v1 2026-10-02: first version, from shaping session 1 and docs 01–05.
- v2 2026-10-04: FR-27…FR-35 from the second FIRE_TRACKER extraction (`docs/06-fire-extraction-2.md`): blog with
  SEO, charts with accessibility guards, deploy and test tools. SEO helpers and the blog engine leave "Out of scope".
