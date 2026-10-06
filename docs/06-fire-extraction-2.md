# 06: Second extraction from FIRE_TRACKER: blog, charts, deploy

Source: FIRE_TRACKER `master` as of 2026-10-04 (read only, like the first analysis in
[`01-module-assessment.md`](01-module-assessment.md)). Since the first analysis, FIRE added a blog with SEO
(migrations 0050–0053), and two older candidates never landed here: chart primitives (in `ui`'s scope in `01`) and
the deploy pipeline.

The owner chose three roadmaps on 2026-10-04: [`blog`](../context/foundation/archive/2026-10-04-2-roadmap.md) (main, closed on 2026-10-04),
[`charts`](../context/foundation/roadmap.md) (main from 2026-10-06) and
[`deploy`](../context/foundation/archive/2026-10-06-roadmap.md) (main from 2026-10-05, closed on 2026-10-06).

## What is taken

| # | Candidate | FIRE_TRACKER source | Size | Goes to | Roadmap |
| --- | --- | --- | --- | --- | --- |
| 1 | Blog: Markdown articles, safe renderer, glossary auto-links, RSS, "read next", OG per article, publish CLI | `src/lib/blog-*.ts`, `src/app/blog/**`, `src/db/blog*`, `scripts/blog-*`, `drizzle/0050`–`0053` | ~6–8k LOC | `@softure-ai/blog` (`modules/blog/`) | blog, BL-2…BL-5 |
| 2 | Text quality gate: structure, links, AI-writing patterns, YMYL; the writing skill | `src/lib/blog/quality/*`, `scripts/blog-check.mts`, `.claude/skills/blog-pisz/` | ~1.5k | `@softure-ai/blog` (`src/quality/`, `skill/`) | blog, BL-6, BL-7 |
| 3 | SEO and AI crawler access: `robots` with AI crawler lists, sitemap, IndexNow | `src/lib/{ai-crawlers,indexnow,blog-discovery}.ts`, `src/app/{robots,sitemap}.ts` | ~500 | `@softure-ai/seo` (`modules/seo/`) | blog, BL-1, BL-5 |
| 4 | SVG chart primitives: axes, scale, ticks, legend, flags, nearest-point cursor | `src/components/chart/*`, `src/lib/{chart-scale,chart-ticks,nearest-point}.ts` | ~1.5k | `@softure-ai/charts` (`foundation/charts/`) | charts, CH-1, CH-2, CH-4 |
| 5 | Colour guards: colour-vision simulation, WCAG contrast, both-theme contrast test | `src/lib/color-vision.ts`, `src/app/theme-contrast.test.ts` | ~300 | `@softure-ai/ui/testing` | charts, CH-3 |
| 6 | One-VPS deploy: Docker, Traefik, release pipeline, release notes, verify | `docker/**`, `.github/workflows/{release,auto-release,release-opis}.yml`, `scripts/{verify-production.sh,render-env-prod.mts,release-notes.mts}`, `src/lib/release-notes.ts` | ~2.5k (shell, YAML) | `@softure-ai/deploy` (`tools/deploy/`) + reusable workflows + `init` templates | deploy, DP-1…DP-5 |
| 7 | Test tools: clock shift (`TEST_TODAY`), Playwright helpers | `vitest.shift-clock.ts`, `integration/infrastructure/*` | ~600 | `@softure-ai/testing` (`foundation/testing/`) | deploy, DP-6, DP-7 |

## What stays in FIRE_TRACKER

- Blog domain parts become **plugins** of `@softure-ai/blog`: the engine chart block (`blog-chart.ts`,
  `blog-chart-html.ts`), the facts and chart quality rules (`rules-facts.ts`, `rules-chart.ts`) and the calculator
  scenario field in the frontmatter.
- The public shell and small UI (header, footer, tabs, view picker): a possible later theme, tied to FIRE's copy.
- NBP rates and currency conversion, the interview report, the `impeccable` skill, the MCP tools and the FIRE engine:
  domain or third-party code.

## Deploy: package or template

The rule: logic that does not change from app to app goes into the package and reusable workflows; whatever
describes one app or one server is generated once and then owned by the app.

| Part | Where | Why |
| --- | --- | --- |
| Build, deploy over SSH, verify (`release.yml`, 381 lines, 2 domain spots) | reusable workflows (`workflow_call`) | an app keeps one `uses:` line with inputs |
| `.env.prod` rendering, release notes, backup, schema guard, verify engine | `@softure-ai/deploy` CLI | today bash; becomes TS with tests; the guard reads the `@softure-ai/db` ledger |
| Route lists for verify (100+ lines of FIRE routes) | the app's `deploy.json` | the engine is generic, the list is the app's |
| Production compose, Traefik rules, Dockerfile, server `deploy.sh` | `softure-deploy init` templates | every app has other services, paths and build steps |
| SSH gateway with a forced command, Cloudflare-only firewall | `softure.vps_foundation` (Ansible, outside this repository) | server configuration installed once, not an npm concern |
