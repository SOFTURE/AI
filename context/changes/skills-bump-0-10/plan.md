# Plan: skills-bump-0-10

Input: change.md, research.md. Complexity: small (one phase).

## Goal

`@softure-ai/skills@^0.10.0` in the root `package.json`, the lockfile and the managed `AGENTS.md` block regenerated
by the installer, gates green.

**Out of scope:** the hosted project's instructions (owner-only), any package release.

## Phase 1: Bump and reinstall

- `npm install --save-dev @softure-ai/skills@^0.10.0` (the postinstall rewrites the managed block and the git-ignored
  skills).
- Check the diff touches only the managed block, `package.json` and `package-lock.json`.

Done when: `npm run typecheck`, `npm run lint`, `npm test` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Bump and reinstall

#### Automated
- [x] 1.1 Bump the dependency and refresh the lockfile and managed block — f8e832b
- [x] 1.2 Typecheck, lint and test green — f8e832b
