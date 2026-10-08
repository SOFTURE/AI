# Plan: agent-ready-0-1-1

Input: change.md (research and framing skipped; reasons there). Complexity: trivial (one phase, docs only).

## Goal

agent-ready 0.1.1 on master with the CLI commands in the README; released by auto-release through the trusted
publisher (OIDC, provenance).

**Out of scope:** any code change; `release.yml` (already takes OIDC for a package that exists on npm).

## Key decisions

- **D1 No workflow change.** `publish-npm` looks the package up anonymously and exports `NPM_TOKEN` only when npm
  does not know the package; 0.1.0 exists, so the run logs "publishing through its trusted publisher (OIDC)".
- **D2 Version through `npm run release:version -- agent-ready patch`.** It sets the version in all four places and
  promotes `## Unreleased`; its local tag is deleted, auto-release creates the tag on master.
- **D3 Verification after the release.** `npm view @softure-ai/agent-ready@0.1.1 dist.attestations` shows the
  provenance attestation; the run's notice names the OIDC path.

## Phase 1: docs and version

- README § 2: a table of the three CLI commands, each pointing to where section 4 describes it.
- CHANGELOG: the entry for 0.1.1.
- `release:version` patch.

Done when: gates green (typecheck, lint, test, build); the version reads 0.1.1 in package.json, module.json and
`src/index.ts`.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: docs and version

#### Automated
- [ ] 1.1 README lists the CLI commands
- [ ] 1.2 CHANGELOG entry and version 0.1.1
- [ ] 1.3 Gates green (typecheck, lint, test, build)

#### Manual
- [ ] 1.4 After the release: 0.1.1 on npm with a provenance attestation, published through OIDC
