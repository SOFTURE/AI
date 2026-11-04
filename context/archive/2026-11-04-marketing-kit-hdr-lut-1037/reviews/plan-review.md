---
change_id: marketing-kit-hdr-lut-1037
verdict: approved
---

# Plan review: marketing-kit-hdr-lut-1037

- Covers the issue's expected outcome: direction 1 (a 3D LUT from the same Hable curve, applied in 16-bit) with a
  measured halving of the tone map's cost; direction 2 is ruled out with a reason (float-only `tonemap`); direction 3
  is documented, since the HEVC decoder has no reduced-resolution decode.
- Correctness risks: lattice order must match `.cube` (red fastest) or colours swap; checked by a per-channel test
  (a pure red input lands in the red channel). The RGB path's gamut clip differs from today's YUV clamp only outside
  BT.709 and is measured. Filter-graph escaping is avoided by the `cwd` run. A half-written LUT is avoided by the
  rename.
- Compatibility: `buildNormalizeArgs` without `toneMapLut` is unchanged; `normalizeFootage` uses the LUT
  automatically. `lut3d` joins the machine check, a core filter present in every ffmpeg build.
- Approved without changes.
