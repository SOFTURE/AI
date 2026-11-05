# Research: no-break spaces in the draft's ASS (issue #1080)

- `toAssText` (draft.ts) is the only place caption text is turned into ASS dialogue; both the `phrase` path (a whole
  chunk) and the `highlight` path (one word at a time) call it.
- JavaScript's `\s` includes U+00A0 (and U+202F, U+2007), so `/\s+/g` turns them into U+0020.
- libass: `\h` is a hard space that never breaks a line; `\n`/`\N` are breaks. Backslashes in caption text are already
  replaced with `/` before any escape is emitted, so a `\h` written afterwards cannot be forged by the text.
- Options: (1) exclude U+00A0 from the collapse and map it to `\h` (the issue's proposal); (2) also map U+202F and
  U+2007. Option 1 is what the issue and the adopting app need; U+202F/U+2007 are left as they are today.
