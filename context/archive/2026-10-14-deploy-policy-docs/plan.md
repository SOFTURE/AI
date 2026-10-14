# Plan: deploy-policy-docs

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase).

## Goal

Every document outside the archives and `node_modules/` that describes when a production deploy happens says: the
owner has given standing approval, so the deploy runs right after the release, without asking or waiting.

**Out of scope:** the deploy and release pipelines, the skills package and the managed block of `AGENTS.md`,
archived changes.

## Key decisions

- **Project rule overrides the managed block.** `AGENTS.md` gets a `## Production deploys` section outside the
  managed block, which the block itself says takes precedence; editing the block would be undone by the next
  `npx softure-skills`.
- **shape-notes.md**: the no-go is amended in place with the date of the decision, as on 2026-10-12.

## Phase 1: Align the documents

- Edit `README.md`, `scripts/release/README.md`, `context/foundation/shape-notes.md`; add the project rule to
  `AGENTS.md`.

Done when: `grep -rn -i -E "deploy[^.]*(always waits|waits for the owner)|deploys by agents without"` over the
tree (without archives, `node_modules/`, the managed block of `AGENTS.md` and this change folder) returns nothing;
`npm run lint` and `npx vitest run tests/repo` are green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Align the documents

#### Automated
- [x] 1.1 Deploy wording aligned with the owner's standing approval in the four documents — 0472de0
- [x] 1.2 Grep from Done when returns nothing; lint and repository tests green — 0472de0
