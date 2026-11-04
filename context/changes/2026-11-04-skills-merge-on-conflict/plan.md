# Plan: skills-merge-on-conflict

## Phases

1. Bump `@softure-ai/skills` to `^0.15.0` (`package.json`, `package-lock.json`); the installer refreshes the managed
   block in `AGENTS.md` and `.claude/skills/`. Add the project section "Merging: master only on a conflict" outside
   the managed block, overriding Merging. Gates: typecheck, lint (language), repository tests for docs and links.

## Decisions (auto)

- Narrow `when-needed` with a project rule rather than a new `remergeMain` value: the package offers only
  `when-needed` and `always`; a generic `on-conflict` value belongs to SOFTURE/SKILLS and is reported to the
  coordinator as a gap.

## Progress

- [ ] p1
