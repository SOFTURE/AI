---
change_id: theme-notion-code-740
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and issue #740.

- `Code`: `<code data-slot="code">` with `rounded-xs bg-secondary px-1 font-mono text-code text-red`, `className`
  through `cn` (an app's `text-blue` replaces `text-red`, tested), other props passed on.
- `CodeBlock`: `<pre data-slot="code-block">` with `overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono
  text-code`; `wrap` switches `whitespace-pre` to `whitespace-pre-wrap break-words` and sets `data-wrap` (tested).
  `label` gives `role="region"`, `aria-label` and `tabIndex={0}`; none without it (tested). An app's own `role` or
  `tabIndex` still wins, since the rest props spread last.
- Root export of `Code`, `CodeBlock`, `CodeBlockProps`; `tests/index.test.ts` still passes (no undefined export).
- Classes are literal strings in `src/notion/`, covered by `softureTheme.sources`.
- Docs: README "Components" lists both with an example; CHANGELOG entry under `Unreleased` with the app's migration.
- Gates: typecheck green, ESLint on the changed files green, language gate green, theme-notion tests 97/97.
- Release note for the coordinator: additive only, a minor or patch of theme-notion; nothing depends on it.

Verdict: approved.
