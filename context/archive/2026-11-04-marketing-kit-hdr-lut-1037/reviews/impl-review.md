---
change_id: marketing-kit-hdr-lut-1037
verdict: approved
---

# Implementation review: marketing-kit-hdr-lut-1037

- Scope matches change.md: `tonemap-lut.ts` makes the LUT, `toneMapFilter` / `buildVideoFilter` /
  `buildNormalizeArgs` take it, `normalizeFootage` makes and uses it, `lut3d` joins the machine check, README and
  CHANGELOG describe the cost and the gamut behaviour. No version bump.
- Correctness: lattice order (red fastest) and the planar float read (green, blue, red planes) are covered by unit
  tests and by the ffmpeg test (BT.2020 red keeps red strongest, grey stays grey, black stays black). Relative clip
  sources resolve before ffmpeg runs in the LUT's folder (tested). A stopped LUT run leaves no files (tested), and the
  `.cube` appears only by rename. The LUT name is generated, so the filter graph needs no escaping.
- Deviation from the plan, recorded: the LUT ends in unclamped linear light and the transfer follows `lut3d`, after
  saturated test patterns showed the first design 4 to 8 dB off.
- Known limit, accepted: two runs generating the same LUT in the same folder at once would share temporary names;
  `prepareFootage` normalizes one clip at a time, and a LUT already there is reused.
- Gates: typecheck, lint (pre-commit), `vitest run tools/marketing-kit` (967 passed, 4 skipped) and `tests/repo`
  (green with `ssh-keygen` installed) pass.
- Approved.
