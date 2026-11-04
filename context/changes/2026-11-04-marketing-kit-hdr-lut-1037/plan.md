---
change_id: marketing-kit-hdr-lut-1037
status: in_progress
---

# Plan: footage normalize tone-maps HDR through a 3D LUT (issue #1037)

Input: change.md, research.md. Complexity: small to medium.

## Phase 1: the LUT and the graph (TDD)

Files: `src/footage/tonemap-lut.ts` (new), `src/footage/tonemap-lut.test.ts`, `src/footage/normalize.ts`,
`src/footage/normalize.test.ts`, `src/footage/tools.ts`.

- `tonemap-lut.ts`: `TONE_MAP_LUT_SIZE = 65`; `getToneMapTransfer(hdr, transfer)` (moved from `toneMapFilter`'s
  input choice); `getToneMapLutName(transfer)` → `tonemap-v1-<transfer>.cube`; `buildIdentityLattice(size)` (rgb48le
  bytes, red fastest); `buildToneMapLutArgs(transfer, size, lattice, output)`; `formatCube(size, rgb48)` (the
  `.cube` text); `ensureToneMapLut(transfer, dir, options)` writes the file once (lattice and raw output in the
  folder, removed after; the `.cube` written to a temporary name and renamed, so a stopped run never leaves half a
  LUT) and returns its name.
- `toneMapFilter(hdr, transfer, lut?)`: with a LUT name, `zscale=min=bt2020nc:m=gbr:r=full` →
  `format=gbrp16le` → `lut3d=file=<name>:interp=tetrahedral` →
  `zscale=tin=linear:pin=bt709:t=bt709:p=bt709:m=bt709:r=tv` → `format=yuv420p`; without, the float chain as today.
- `buildVideoFilter` and `buildNormalizeArgs` take the optional LUT name (`NormalizeInput.toneMapLut`).
- `normalizeFootage`: for an HDR clip with no `toneMapLut`, ensures the LUT in the output's folder and runs ffmpeg
  there (`cwd`), so the file name resolves.
- `REQUIRED_FILTERS` gains `lut3d`.
- Tests: lattice order and size, cube text (header, line count, value format), LUT args, the filter with and
  without a LUT, the graph order (crop/fit before the LUT), `normalizeFootage` generates and uses the LUT (with
  ffmpeg, skipped where the tools are missing, as the existing ffmpeg tests do).

## Phase 2: docs and a real measurement

README (HDR cost per footage second, 4K HEVC needs about two CPUs), CHANGELOG `## Unreleased`. Measure the real
`buildNormalizeArgs` on one CPU before and after (ultrafast, threads 1) on the generated HLG clip, and compare the
output with the float chain (PSNR).

## Progress

- [x] Phase 1: the LUT and the graph (7bc3cef)
- [x] Phase 2: docs and a real measurement (see the commit `docs(marketing-kit-hdr-lut-1037)`)

## Decisions (auto)

- 65-point grid: the same speed as 33, 4 to 9 dB closer to the float chain; 7 MB of text per transfer in the build
  folder, about 0.2 s to load per clip.
- The LUT is generated at run time by the installed ffmpeg, not shipped: the same zscale and tonemap that defined
  the look define the LUT, and no binary asset enters the package.
- Gamut: the LUT path clips out-of-BT.709 colours per RGB channel instead of in YUV; stated in the CHANGELOG.
- The LUT ends in unclamped linear BT.709 light and the transfer is applied after it (research, "final design"):
  an R'G'B' output clipped at the lattice points was 4 to 8 dB off on saturated pictures.
- `toneMapLut` passed by a caller is used as given, with no `cwd`: a caller that builds the arguments itself names a
  path ffmpeg can open.
- `NORMALIZE_VERSION` stays: in-gamut output is the same, so cached clips are not redone.
- The float chain stays for `buildNormalizeArgs` callers that pass no LUT (public API).

## Verification

- `vitest run tools/marketing-kit`: green (967 tests, 4 skipped), including the ffmpeg tests of the LUT (made once,
  no temporary files left, abort cleans up) and of `normalizeFootage` on a generated HLG clip (LUT next to the
  output, relative source, PSNR above 45 dB against the float chain).
- Measured with the kit's arguments: research, "Measured with the kit".
