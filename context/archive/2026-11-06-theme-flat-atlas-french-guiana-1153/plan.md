# Plan: theme-flat-atlas-french-guiana-1153

## Phases

1. Generator: split French Guiana out of France (polygons whose first point lies west of 30° W) into id `254`,
   failing the build when none is found. Regenerate `world-110m.ts`.
2. Test: the shape count includes French Guiana; France's path has no part near French Guiana and the `254` path has
   only such parts. The test fails on the old data.
3. CHANGELOG 0.1.1 entry.

## Progress

- [x] 1. Generator and regenerated data (`npx tsx scripts/build-world-map.ts`: 177 shapes).
- [x] 2. Test (`npx vitest run themes/theme-flat-atlas`: 5 files, 69 tests passed).
- [x] 3. CHANGELOG.
