---
change_id: theme-notion-code-740
status: in_progress
---

# Plan: Code and CodeBlock (issue #740)

Input: change.md, research.md. Complexity: small (one file of two parts, a test file, docs).

## Phase 1: parts and docs

Files: `themes/theme-notion/src/notion/Code.tsx`, `themes/theme-notion/tests/notion/Code.test.tsx`,
`themes/theme-notion/src/index.ts`, `themes/theme-notion/README.md`, `themes/theme-notion/CHANGELOG.md`.

1. `Code(props: ComponentProps<"code">)`: `<code data-slot="code">` with
   `rounded-xs bg-secondary px-1 font-mono text-code text-red`, `className` merged through `cn`, other props passed on.
2. `CodeBlock({ label, wrap = false, className, ...props }: CodeBlockProps)`: `<pre data-slot="code-block">` with
   `overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono text-code` plus `whitespace-pre` or
   `whitespace-pre-wrap break-words` by `wrap`, and `data-wrap` when wrapping. With `label`: `role="region"`,
   `aria-label={label}` and `tabIndex={0}` (a scrollable region keyboard users can reach).
3. Export both and `CodeBlockProps` from the root.
4. Tests: classes and slot on both parts; `wrap` switches `whitespace-pre` / `whitespace-pre-wrap`; `label` gives
   `role="region"`, the name and `tabindex="0"`, none of them without it; an app's `className` overrides a default.
5. README: both parts in "Components" with a short example; CHANGELOG entry under `Unreleased`.

## Decisions (auto)

- `tabIndex={0}` only with `label`: a focusable element must have a name, and an unnamed block is plain text.
- `break-words` with `wrap`, so a long path without spaces wraps too instead of overflowing.
- No version bump: the coordinator releases in a batch (brief).

## Progress

- [ ] Phase 1: parts and docs
