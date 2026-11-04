import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { HdrKind } from "./probe.js";
import { runFfmpeg } from "./process.js";

/**
 * The HDR to SDR tone map as a 3D LUT. The float chain (zscale to linear light, Hable curve, zscale back to BT.709)
 * costs about a second per footage second at 1080x1920 on one CPU; the same chain is run once over an identity
 * lattice of HDR R'G'B' values and written as a `.cube` file, which `lut3d` then applies per frame in 16-bit at about
 * half the cost. A 3D LUT keeps what a per-channel curve would lose: HLG's system gamma and Hable's scaling both
 * depend on all three channels.
 *
 * The LUT ends in linear BT.709 light, unclamped (negative where a colour lies outside BT.709), and the BT.709
 * transfer is applied after it: the mapping up to there is smooth, so the lattice interpolates it closely, while the
 * transfer's steep start and the gamut edge would not interpolate.
 */

/** Points per axis: 65 is as fast as 33 in `lut3d` and closer to the float chain. */
export const TONE_MAP_LUT_SIZE = 65;
/** Bumped when the curve or the lattice changes, so a build folder's older LUT is not reused. */
const TONE_MAP_LUT_VERSION = 1;

/** The HDR transfers the tone map reads, by ffmpeg's names. */
export type ToneMapTransfer = "smpte2084" | "arib-std-b67";

const TRANSFER_BY_KIND: Record<HdrKind, ToneMapTransfer> = { pq: "smpte2084", hlg: "arib-std-b67", "dolby-vision": "arib-std-b67" };

/** The transfer to tone-map from: the stream's own when it is PQ or HLG, else the kind's (Dolby Vision through its HLG base layer). */
export function getToneMapTransfer(hdr: HdrKind, transfer: string | null): ToneMapTransfer {
  return transfer === "smpte2084" || transfer === "arib-std-b67" ? transfer : TRANSFER_BY_KIND[hdr];
}

/** The float stages between linear BT.2020 light and linear BT.709 light: the Hable curve, no desaturation. */
export const HABLE_STAGES = ["format=gbrpf32le", "zscale=p=bt709", "tonemap=tonemap=hable:desat=0"] as const;

/** The LUT's file name; the file sits in the folder ffmpeg runs in, so the filter graph needs no path escaping. */
export function getToneMapLutName(transfer: ToneMapTransfer): string {
  return `tonemap-v${TONE_MAP_LUT_VERSION}-${transfer}.cube`;
}

/** Every lattice point as 16-bit R, G, B (`rgb48le`), red changing fastest, then green, then blue, as `.cube` lists them. */
export function buildIdentityLattice(size: number): Buffer {
  if (!Number.isInteger(size) || size < 2) throw new Error(`A LUT needs at least 2 whole points per axis, got ${size}.`);
  const levels = Array.from({ length: size }, (_, i) => Math.round((i / (size - 1)) * 65_535));
  const lattice = Buffer.alloc(size ** 3 * 6);
  let offset = 0;
  for (const blue of levels) {
    for (const green of levels) {
      for (const red of levels) {
        offset = lattice.writeUInt16LE(red, offset);
        offset = lattice.writeUInt16LE(green, offset);
        offset = lattice.writeUInt16LE(blue, offset);
      }
    }
  }
  return lattice;
}

/**
 * ffmpeg's arguments to run the float chain over the lattice: HDR R'G'B' (BT.2020, raw `rgb48le`) in, tone-mapped
 * linear BT.709 light out (raw planar float `gbrpf32le`, unclamped).
 */
export function buildToneMapLutArgs(options: { transfer: ToneMapTransfer; size: number; lattice: string; output: string }): string[] {
  const { transfer, size } = options;
  const chain = [`zscale=tin=${transfer}:pin=bt2020:t=linear:p=bt2020:npl=100`, ...HABLE_STAGES].join(",");
  return ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb48le", "-s", `${size}x${size * size}`, "-i", options.lattice, "-vf", chain, "-f", "rawvideo", "-pix_fmt", "gbrpf32le", options.output];
}

/** The `.cube` text for the mapped lattice (planar float: the green, blue, red planes). Throws when `mapped` does not hold `size`³ points. */
export function formatCube(size: number, mapped: Buffer): string {
  const points = size ** 3;
  if (mapped.length !== points * 12) throw new Error(`A ${size}-point LUT needs ${points * 12} bytes of gbrpf32le, got ${mapped.length}.`);
  const lines = ["# HDR to linear BT.709 light, Hable curve (marketing-kit footage normalize)", `LUT_3D_SIZE ${size}`];
  const plane = points * 4;
  for (let offset = 0; offset < plane; offset += 4) {
    const green = mapped.readFloatLE(offset);
    const blue = mapped.readFloatLE(plane + offset);
    const red = mapped.readFloatLE(2 * plane + offset);
    lines.push(`${red.toFixed(6)} ${green.toFixed(6)} ${blue.toFixed(6)}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Makes the transfer's LUT in `dir` unless it is there, and returns its file name. The lattice and ffmpeg's raw output
 * are removed afterwards; the `.cube` is written under a temporary name and renamed, so a stopped run never leaves half
 * a LUT. Throws (naming the step) when ffmpeg fails; an abort rejects with the signal's reason.
 */
export async function ensureToneMapLut(transfer: ToneMapTransfer, dir: string, options: { signal?: AbortSignal } = {}): Promise<string> {
  const name = getToneMapLutName(transfer);
  const path = join(dir, name);
  if (existsSync(path)) return name;
  const lattice = `${path}.lattice.rgb48`;
  const mapped = `${path}.mapped.gbrpf32`;
  const partial = `${path}.partial`;
  try {
    writeFileSync(lattice, buildIdentityLattice(TONE_MAP_LUT_SIZE));
    await runFfmpeg(`Making the ${transfer} tone map LUT (${path})`, buildToneMapLutArgs({ transfer, size: TONE_MAP_LUT_SIZE, lattice, output: mapped }), {
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      output: mapped,
    });
    writeFileSync(partial, formatCube(TONE_MAP_LUT_SIZE, readFileSync(mapped)));
    renameSync(partial, path);
  } finally {
    for (const file of [lattice, mapped, partial]) rmSync(file, { force: true });
  }
  return name;
}
