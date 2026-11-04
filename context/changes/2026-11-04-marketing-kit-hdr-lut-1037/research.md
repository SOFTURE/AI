---
change_id: marketing-kit-hdr-lut-1037
---

# Research: a faster HDR tone map in footage normalize (issue #1037)

## Where the time goes

`toneMapFilter` (src/footage/normalize.ts) runs, after the picture is scaled to the frame:
`zscale=tin=<hdr>:pin=bt2020:min=bt2020nc:t=linear:npl=100` → `format=gbrpf32le` → `zscale=p=bt709` →
`tonemap=hable:desat=0` → `zscale=t=bt709:m=bt709:r=tv` → `format=yuv420p`. Four float passes over a 1080x1920 frame.

Measured here (ffmpeg 6.1.1, one core pinned with `taskset`, `-threads 1 -filter_complex_threads 1`, a generated
10 s 1080x1920 HEVC 10-bit HLG clip, decode plus the normalize filter graph, no encode, best of three):

| Graph | Time for 10 s | Tone map share |
| --- | --- | --- |
| decode, fps, crop (no tone map) | 3.2 s | - |
| float chain (today) | 12.7 s | 9.5 s (0.95 s per footage second) |
| zscale YUV to RGB 16-bit and back, no LUT | 4.5 s | 1.3 s |
| zscale to RGB 16-bit, `lut3d` 65, tetrahedral, zscale back | 8.1 s | 4.9 s (0.49 s per footage second) |
| same, 33 grid | 7.7 s to 8.1 s | the same within noise |
| swscale conversions instead of zscale | 9.7 s | slower |
| 8-bit or 10-bit RGB around `lut3d` | 18.8 s, 19.7 s | slower (no SIMD path) |
| `interp=trilinear` / `pyramid` | 22 s / 23 s | slower |

The issue's machine measured 1.4 s per footage second for the float chain; the LUT path halves the tone map's share,
so about 0.7 s there.

## Directions from the issue

1. **3D LUT from the same curve**: chosen. A 3D LUT keyed on the HDR R'G'B' (BT.2020, non-linear) captures the HLG
   system gamma (it depends on luminance across channels) and Hable's max-channel scaling, which a per-channel 1D
   LUT cannot.
2. **`tonemap` at 16-bit**: not possible. ffmpeg's `tonemap` takes float formats only (gbrpf32, gbrapf32).
3. **4K HEVC decoding at a lower resolution**: the software HEVC decoder has no reduced-resolution decode (`-lowres`
   is for MPEG-family codecs only). Documented instead: 4K HDR footage needs about two CPUs.

## Generating the LUT

- The identity lattice (65^3 R'G'B' points, red fastest, as `.cube` orders them) is written as `rgb48le` raw video,
  65 pixels wide and 65^2 high, and run through the kit's float chain with RGB in and out:
  `zscale=tin=<t>:pin=bt2020:t=linear:p=bt2020:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709,format=rgb48le`.
  zscale needs `p=bt2020` stated on RGB input ("no path between colorspaces" otherwise). The output is written as
  a `.cube` file (`LUT_3D_SIZE 65`, values 0 to 1). Generation takes about 0.2 s; loading a 65 grid in `lut3d` about
  0.2 s per clip.
- Checked per colour: the RGB chain gives the same linear, tone-mapped and BT.709 values as the YUV chain (to 1e-4).

## Accuracy, first prototype (LUT to BT.709 R'G'B', PSNR against the float chain, 30 frames, 1080x1920)

| Clip | float chain today | float chain, clipped in RGB before YUV |
| --- | --- | --- |
| UI screenshot as HLG (in BT.709 gamut) | 74 dB (65 grid), 71 dB (33 grid) | 77 dB |
| same as PQ | 73 dB (65), 69 dB (33) | 74 dB |
| BT.2020 gradients beyond the BT.709 gamut, HLG | 20 dB | 65 dB (65), 56 dB (33) |
| same, PQ | 20 dB | 56 dB (65), 51 dB (33) |

In gamut the LUT path is the float chain (above 70 dB). The one difference is colours outside BT.709: the float
chain carries negative or above-one RGB into the final YUV conversion and lets the 8-bit YUV clamp cut them, which
shifts hue; the LUT path clips each RGB channel to the BT.709 gamut, as a player does. That is the float chain plus a
gamut clip (56 to 65 dB), not a change of curve.

## Accuracy, final design

Smaller saturated test patterns (270x480 testsrc2, SMPTE bars) showed the first prototype 4 to 8 dB off the float
chain. The cause: lattice points whose BT.709 values are negative were clipped to 0 in the `rgb48le` output before
interpolation, and the BT.709 transfer's steep start and the gamut edge do not interpolate. The final LUT therefore
ends in linear BT.709 light, stored as unclamped floats (read from `gbrpf32le`), and the BT.709 transfer and matrix
are applied after `lut3d` in one zscale (`tin=linear:pin=bt709:t=bt709:p=bt709:m=bt709:r=tv`). Against the float
chain with an RGB gamut clip it is 55 to 60 dB on every pattern (against the float chain as is, 42 to 46 dB on the
saturated patterns, the YUV-versus-RGB clip, and about 52 dB on smooth gradients after the x264 encode). Its cost is
the same within noise (8.6 s against 8.3 s for 10 s of 1080x1920).

## Measured with the kit (`buildNormalizeArgs`, one CPU, threads 1, 20 s 1080x1920 HEVC 10-bit HLG, best of two)

| Preset | float chain | LUT | per footage second |
| --- | --- | --- | --- |
| `ultrafast` | 32.6 s | 23.5 s | 1.63 s to 1.17 s |
| `veryfast` | 41.7 s | 31.2 s | 2.09 s to 1.56 s |

The float chain's 1.63 s matches the issue's own measurement.

## Risks

- `lut3d`'s file path inside the filter graph: escaping. Avoided by running ffmpeg in the LUT's folder and naming the
  file without a path (`runFfmpeg`'s `cwd` exists for exactly this).
- A worker image without `lut3d`: it is a core ffmpeg filter with no external library; `REQUIRED_FILTERS` adds it so
  the machine check names it.
- Stale clips: the normalized output is equivalent, so `NORMALIZE_VERSION` stays; old HDR clips are not redone.
