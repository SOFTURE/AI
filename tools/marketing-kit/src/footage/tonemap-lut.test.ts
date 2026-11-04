import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildIdentityLattice, buildToneMapLutArgs, ensureToneMapLut, formatCube, getToneMapLutName, getToneMapTransfer, TONE_MAP_LUT_SIZE } from "./tonemap-lut.js";

/** The lattice point at (red, green, blue) as 16-bit values. */
function readPoint(lattice: Buffer, size: number, red: number, green: number, blue: number): number[] {
  const offset = (red + green * size + blue * size * size) * 6;
  return [lattice.readUInt16LE(offset), lattice.readUInt16LE(offset + 2), lattice.readUInt16LE(offset + 4)];
}

describe("getToneMapTransfer", () => {
  it("keeps a PQ or HLG stream's own transfer", () => {
    expect(getToneMapTransfer("hlg", "smpte2084")).toBe("smpte2084");
    expect(getToneMapTransfer("pq", "arib-std-b67")).toBe("arib-std-b67");
  });

  it("falls back to the kind's transfer, Dolby Vision through its HLG base", () => {
    expect(getToneMapTransfer("pq", null)).toBe("smpte2084");
    expect(getToneMapTransfer("hlg", "bt2020-10")).toBe("arib-std-b67");
    expect(getToneMapTransfer("dolby-vision", null)).toBe("arib-std-b67");
  });
});

describe("getToneMapLutName", () => {
  it("names the LUT by version and transfer, without a path", () => {
    expect(getToneMapLutName("arib-std-b67")).toBe("tonemap-v1-arib-std-b67.cube");
    expect(getToneMapLutName("smpte2084")).toBe("tonemap-v1-smpte2084.cube");
  });
});

describe("buildIdentityLattice", () => {
  it("lists every point as rgb48le, red fastest, then green, then blue", () => {
    const lattice = buildIdentityLattice(3);
    expect(lattice.length).toBe(27 * 6);
    expect(readPoint(lattice, 3, 0, 0, 0)).toEqual([0, 0, 0]);
    expect([lattice.readUInt16LE(6), lattice.readUInt16LE(8), lattice.readUInt16LE(10)]).toEqual([32_768, 0, 0]);
    expect([lattice.readUInt16LE(18), lattice.readUInt16LE(20), lattice.readUInt16LE(22)]).toEqual([0, 32_768, 0]);
    expect([lattice.readUInt16LE(54), lattice.readUInt16LE(56), lattice.readUInt16LE(58)]).toEqual([0, 0, 32_768]);
    expect(readPoint(lattice, 3, 2, 1, 0)).toEqual([65_535, 32_768, 0]);
    expect(readPoint(lattice, 3, 2, 2, 2)).toEqual([65_535, 65_535, 65_535]);
  });

  it("refuses fewer than two points or a fraction", () => {
    expect(() => buildIdentityLattice(1)).toThrow("A LUT needs at least 2 whole points per axis, got 1.");
    expect(() => buildIdentityLattice(2.5)).toThrow("A LUT needs at least 2 whole points per axis, got 2.5.");
  });
});

describe("buildToneMapLutArgs", () => {
  it("runs the Hable float chain from HDR R'G'B' to linear BT.709 light on the raw lattice", () => {
    const args = buildToneMapLutArgs({ transfer: "arib-std-b67", size: 65, lattice: "/b/l.rgb48", output: "/b/m.rgb48" });
    expect(args).toEqual([
      "-v",
      "error",
      "-y",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb48le",
      "-s",
      "65x4225",
      "-i",
      "/b/l.rgb48",
      "-vf",
      "zscale=tin=arib-std-b67:pin=bt2020:t=linear:p=bt2020:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "gbrpf32le",
      "/b/m.rgb48",
    ]);
  });
});

describe("formatCube", () => {
  /** Planar float output (green, blue, red planes) for the given red, green, blue points. */
  const toPlanar = (points: number[][]): Buffer => {
    const buffer = Buffer.alloc(points.length * 12);
    const plane = points.length * 4;
    points.forEach(([red = 0, green = 0, blue = 0], i) => {
      buffer.writeFloatLE(green, i * 4);
      buffer.writeFloatLE(blue, plane + i * 4);
      buffer.writeFloatLE(red, 2 * plane + i * 4);
    });
    return buffer;
  };

  it("writes the size and one red green blue line per point from the planar output, keeping values outside 0 to 1", () => {
    const points = [[0, 0, 0], [0.5, -0.25, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1.125], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const text = formatCube(2, toPlanar(points));
    const lines = text.trimEnd().split("\n");
    expect(lines[0]?.startsWith("# ")).toBe(true);
    expect(lines[1]).toBe("LUT_3D_SIZE 2");
    expect(lines.slice(2)).toEqual([
      "0.000000 0.000000 0.000000",
      "0.500000 -0.250000 0.000000",
      "0.000000 1.000000 0.000000",
      "1.000000 1.000000 0.000000",
      "0.000000 0.000000 1.125000",
      "1.000000 0.000000 1.000000",
      "0.000000 1.000000 1.000000",
      "1.000000 1.000000 1.000000",
    ]);
    expect(text.endsWith("\n")).toBe(true);
  });

  it("refuses output of the wrong length", () => {
    expect(() => formatCube(2, Buffer.alloc(42))).toThrow("A 2-point LUT needs 96 bytes of gbrpf32le, got 42.");
  });
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

describe.runIf(hasFfmpeg)("ensureToneMapLut with ffmpeg", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tonemap-lut-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** The LUT's entry for lattice indexes (red, green, blue). */
  const readEntry = (lines: string[], red: number, green: number, blue: number): number[] =>
    (lines[2 + red + green * TONE_MAP_LUT_SIZE + blue * TONE_MAP_LUT_SIZE ** 2] ?? "").split(" ").map(Number);

  it("writes the HLG LUT once, keeping colours in their channels and leaving no temporary files", async () => {
    const name = await ensureToneMapLut("arib-std-b67", dir);
    expect(readdirSync(dir)).toEqual([name]);
    const lines = readFileSync(join(dir, name), "utf8").trimEnd().split("\n");
    expect(lines).toHaveLength(2 + TONE_MAP_LUT_SIZE ** 3);
    const top = TONE_MAP_LUT_SIZE - 1;
    expect(readEntry(lines, 0, 0, 0)).toEqual([0, 0, 0]);
    const grey = readEntry(lines, 32, 32, 32);
    expect(grey[0]).toBeCloseTo(grey[1] ?? -1, 3);
    expect(grey[1]).toBeCloseTo(grey[2] ?? -1, 3);
    const white = readEntry(lines, top, top, top);
    expect(white[0]).toBeGreaterThan(grey[0] ?? 1);
    expect(white[0]).toBeLessThanOrEqual(1);
    // BT.2020 red lies outside BT.709: red stays the strongest, the others go negative instead of being clipped.
    const [red = 0, green = 0, blue = 0] = readEntry(lines, top, 0, 0);
    expect(red).toBeGreaterThan(0.3);
    expect(green).toBeLessThan(0);
    expect(blue).toBeLessThan(0);

    const before = readFileSync(join(dir, name), "utf8");
    expect(await ensureToneMapLut("arib-std-b67", dir)).toBe(name);
    expect(readFileSync(join(dir, name), "utf8")).toBe(before);
  });

  it("removes its temporary files and leaves no LUT when aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("stopped"));
    await expect(ensureToneMapLut("smpte2084", dir, { signal: controller.signal })).rejects.toThrow("stopped");
    expect(existsSync(join(dir, getToneMapLutName("smpte2084")))).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });
});
