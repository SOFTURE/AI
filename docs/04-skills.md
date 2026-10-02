# 04 — Agent skills

SOFTURE agent skills live in a separate public repository,
[SOFTURE/SKILLS](https://github.com/SOFTURE/SKILLS), published as
[`@softure-ai/skills`](https://www.npmjs.com/package/@softure-ai/skills) (MIT).

```
SOFTURE/
  AI/        public (MIT): @softure-ai/* modules + marketing-kit
  SKILLS/    public (MIT): @softure-ai/skills, the softure-* chain + worktree orchestrators
```

## What the package contains

- **The `softure-*` delivery chain:** init, shape, frame, prd, roadmap, new, research, plan,
  plan-review, implement, impl-review, code-review, lesson, archive, rule-review. It is original
  work, written from a single process contract,
  [`WORKFLOW.md`](https://github.com/SOFTURE/SKILLS/blob/master/WORKFLOW.md), which defines the
  artifacts in `context/`, the statuses, the Progress format and autonomous mode. It is not
  derived from any course material.
- **`softure-worktree` and `softure-worktree-manager`:** run one change, or a whole roadmap, in
  parallel git worktrees and merge on the owner's signal. Everything project-specific comes from
  `context/workflow.json`.
- **"SOFTURE modules first":** research and planning check the `@softure-ai/*` catalog before
  building anything generic.

## Quality gate

`scripts/validate.mjs` blocks a release when it finds:
- frontmatter errors;
- a skill without the `softure-` prefix;
- third-party course branding;
- any non-English text in shipped files.

## Installation in a project

`npm i -D @softure-ai/skills` (or `npx @softure-ai/skills`). The installer:
- copies skills into `.claude/skills/`;
- manages a rules block in `AGENTS.md`, including the mandatory rule that all code, comments and
  commits are in English;
- adds a managed `.gitignore` block, so installed skills are restored by `npm install`, never committed;
- never overwrites a skill folder it did not install.

Third-party skills (for example Apache-2.0 ones such as impeccable or hyperframes) are not
bundled for now.
