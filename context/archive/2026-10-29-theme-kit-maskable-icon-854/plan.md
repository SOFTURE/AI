---
change_id: theme-kit-maskable-icon-854
status: archived
---

# Plan: maskable app icons in theme-kit (issue #854)

Input: change.md, research.md. Complexity: small (one file of code, its tests, docs).

## Phase 1: shape, scale and stroke (TDD)

Files: `themes/theme-kit/src/next/draw-app-icon.tsx`, `src/next/index.ts`, `tests/draw-app-icon.test.tsx`.

- `AppIconShape` gains `maskable`: radius 0, default glyph scale `0.5`. `rounded` and `square` keep `0.625`.
- `glyphScale` option (share of the shorter side, `0 < glyphScale ≤ 1`). For `maskable` it must keep the glyph box
  inside the safe zone circle (`glyphScale ≤ MASKABLE_SAFE_ZONE / √2`, `MASKABLE_SAFE_ZONE = 0.8`, exported).
  Out of range throws (a bug in the app's icon file), naming the value and the limit.
- `strokeWidth` option: the stroke of an `IconNode` glyph (default `2`, lucide's). Must be a positive finite number.
  `renderIconSvg(icon, color, { strokeWidth })` takes it; with `{ svg }` markup it throws, since the markup draws its
  own stroke.
- `MANIFEST_ICON_SIZE` (192 × 192) and `MANIFEST_LARGE_ICON_SIZE` (512 × 512) for the manifest icons.
- Tests: maskable box and glyph size at 512, a custom scale per shape, the scale limits (0, above 1, above the safe
  zone for maskable, the safe-zone maximum accepted), stroke width in the markup, invalid stroke width, stroke width
  with `{ svg }` refused, a maskable PNG of 512 × 512.

## Phase 2: docs

`themes/theme-kit/README.md`: options table (`shape`, `glyphScale`, `strokeWidth`), a "Manifest icons" example
(`app/manifest.ts` and `app/icons/[variant]/route.ts`); `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Defaults unchanged for `rounded` / `square` (0.625): a default change would redraw every app's icon in a patch.
- The maskable scale limit is enforced, not only documented: a glyph cut by the launcher is the bug the issue reports.
- `strokeWidth` with `{ svg }` throws rather than being ignored: a silently ignored option is a hidden bug.
- No `next build` proof: the subpath, its `next/og` import and `ImageResponse` are unchanged since #839's proof; a
  route handler only changes the caller.
- No version bump: the coordinator releases (theme-kit patch).

## Progress

- [x] Phase 1: shape, scale and stroke, e67404f
- [x] Phase 2: docs, b27b908
- [x] Implementation review: approved
