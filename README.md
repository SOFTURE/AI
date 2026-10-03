# SOFTURE AI

Ready-made, tested building blocks for applications (React / Next.js / Postgres) that an AI
agent **assembles** instead of writing from scratch. Every module is a complete vertical slice:
from database migrations, through server logic and endpoints, to UI components. Look and copy
come in as parameters, and the whole module is switched on through the application's configuration.

Sister repositories:
- [SOFTURE/SKILLS](https://github.com/SOFTURE/SKILLS) (`@softure-ai/skills`): the agent skills workflow
  that knows how to use these modules.
- .NET libraries: [COMMON](https://github.com/SOFTURE/COMMON) and [API](https://github.com/SOFTURE/API).

> Status: **planned, implementation starting**. Structure, module standard, PRD and roadmaps are ready;
> package code arrives through the main roadmap (`context/foundation/roadmap.md`).
> The first source of modules is the FIRE_TRACKER project (see `docs/01-module-assessment.md`).

## Repository layout

```
foundation/          shared foundations every module depends on
  core/              @softure-ai/core: module contract, configuration, i18n, results, clock/DI
  db/                @softure-ai/db: pg/PGlite client, module migrator, test database
  ui/                @softure-ai/ui: tokens, theme, primitives (Button, Modal, Toast, Select, fields…)
modules/             feature modules (each one works on its own on top of the foundations)
  security/          rate limiting, client IP, safe errors
  auth/              registration, login, sessions, password change and reset, roles
  feature-switches/  runtime switches + admin panel
  mailing/           mail transport, unsubscribe (RFC 8058), delivery ledger, campaigns
  waitlist/          sign-ups with consent scopes, welcome mail, standalone form
  mcp-access/        access tokens + MCP endpoint (Bearer) + token UI
  billing/           trial/paid/read-only entitlements, pricing, write guard
  privacy/           GDPR: data export and deletion, consent ledger, legal page shell
  analytics/         channel tags (?z=) and a cookieless funnel counter
  ops/               health check, migration runner in the image, safe SQL operations pattern
tools/
  marketing-kit/     materials generator: video, screenshots, OG images from JSON and a brand
docs/                assessment, module standard, plans
```

## Documents

| File | What it covers |
|---|---|
| [docs/01-module-assessment.md](docs/01-module-assessment.md) | What we extract from FIRE_TRACKER, from where, in what order, and the gaps |
| [docs/02-module-standard.md](docs/02-module-standard.md) | The module contract: layout, migrations, styling, i18n, switches, Next adapter, tests, publishing |
| [docs/03-marketing-kit.md](docs/03-marketing-kit.md) | `@softure-ai/marketing-kit`: architecture and JSON contract |
| [docs/04-skills.md](docs/04-skills.md) | Agent skills: where they live (SOFTURE/SKILLS) |
| [docs/05-adoption-playbook.md](docs/05-adoption-playbook.md) | Playbook for an application agent that removes its own code and switches to a module |

## Contributing

Everything in this repository is written in English: code, identifiers, comments, commit
messages and docs. User-facing copy lives only in message dictionaries. See [AGENTS.md](AGENTS.md).

## Working on this repository

```bash
npm ci        # .npmrc forces devDependencies, which installs the agent skills into .claude/skills/
```

Development runs on the `softure-*` agent workflow from [`@softure-ai/skills`](https://github.com/SOFTURE/SKILLS):

| Where | What |
|---|---|
| `context/workflow.json` | gates, main branch, worktree setup, research sources |
| `context/foundation/shape-notes.md`, `prd.md` | why and what (PRD v1, FR/NFR IDs) |
| `context/foundation/roadmap.md` | **the main roadmap being executed** (engagement, EN-1…EN-8) |
| `context/foundation/roadmaps/` | queued roadmaps: monetization, marketing-kit |
| `context/changes/` | changes in flight (one folder per change) |
| `context/backlog/roadmap-<slug>/` | prepared entries of queued roadmaps |

Run the main roadmap end to end with `/softure-worktree-manager` (parallel git worktrees, merges on
completion), or one item with `/softure-worktree <ID>`. Agents never tag or publish; the owner does.

## License

MIT, see [LICENSE](LICENSE).
