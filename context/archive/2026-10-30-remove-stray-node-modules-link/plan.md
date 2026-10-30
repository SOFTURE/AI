---
change_id: remove-stray-node-modules-link
status: archived
---

# Plan: remove the stray node_modules link

## Phase 1

- `git rm` `themes/theme-notion/node_modules`; `.gitignore` `node_modules/` becomes `node_modules`.

## Decisions (auto)

- The ignore pattern widens so a symlink named `node_modules` can never be staged again.

## Progress

- [x] Phase 1
- [x] Implementation review: approved
