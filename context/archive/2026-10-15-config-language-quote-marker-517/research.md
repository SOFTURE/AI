---
change_id: config-language-quote-marker-517
---

# Research: config-language-quote-marker-517

Sources: `tools/config/src/language/index.ts`, `tools/config/src/cli/check-language-command.ts`,
`tools/config/tests/pl/language.test.ts`, `tools/config/README.md` (language gate), issue #517.

- `findPolishText(path, text)` checks each line: a diacritic anywhere on the raw line is a hit; otherwise a Polish
  word on the line (code spans removed for `.md`) is a hit. Lines are independent today; a multi-line region needs
  state carried across lines inside `findPolishText`.
- `removeCodeSpans` tokenises on backtick runs in linear time; the marker scan can reuse that tokenisation so a
  marker shown in a code span is not a marker.
- Every caller (`checkFiles`, the CLI for files, `--all` and `--commit-msg`, `tests/repo/language.test.ts`) goes
  through `findPolishText`, so the marker works in every mode without CLI changes. A commit message is not `.md`,
  so markers do not apply there.
- This repository's own gate (`npm run lint:language`, `tests/repo/language.test.ts`) uses the same function, so its
  `context/` artifacts get the marker too.
