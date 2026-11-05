# Implementation review: marketing-kit-draft-nbsp-1080

Verdict: approved.

- `toAssText` collapses every white space but U+00A0, trims ordinary spaces only, then writes U+00A0 as `\h`; the
  escape is added after backslashes are replaced, so caption text cannot inject an override tag.
- The test covers a `phrase` and a `highlight` film (every highlight piece keeps `\h`), and a trailing run of tab and
  newline collapsing to nothing. It failed before the fix.
- The regex uses ` ` escapes, not the raw character (ESLint `no-irregular-whitespace`).
- Changelog entry under `## Unreleased`; no version bump, as briefed.
