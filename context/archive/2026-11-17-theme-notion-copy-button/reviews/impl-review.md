# Implementation review: CopyButton

Verdict: approve.

- Matches the plan: one composition, words through props with English defaults, `onCopied`, the reset timer cleared on
  unmount and on a second copy.
- Accessibility: the name is the visible word; `aria-live="polite"` announces "Copied"; the icon is hidden; axe passes on
  the gallery in light and dark, desktop and phone.
- No finding left open.
