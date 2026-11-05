# Plan: skills-bump-0-17

## Phases

1. Bump `@softure-ai/skills` to `^0.17.0` (`package.json`, `package-lock.json`); the installer refreshes the managed
   block in `AGENTS.md`. Set `autonomy.remergeMain: "on-conflict"` in `context/workflow.json` and reword the
   project merge section to point at it. Gates: typecheck, lint (language), repository tests.

## Decisions (auto)

- Use the new package value instead of keeping only the project override: the script then prints the verdict the
  owner's order asks for, and the project section stays as the human-readable reason.

## Progress

- [x] p1 fe4c51b: skills ^0.17.0 (installer refreshed the managed block), `remergeMain: "on-conflict"`, project merge section points at it; typecheck green, `tests/repo` 595 passed (deploy-workflows.test.ts fails on the base too: no `ssh-keygen` in the container).
