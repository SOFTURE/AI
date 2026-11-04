import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { FootageClip } from "./film.js";
import { buildNormalizeArgs, buildVideoFilter, normalizeFootage, resolveFit, toneMapFilter } from "./normalize.js";
import { probeFile, type FootageProbe } from "./probe.js";

const FRAME = { width: 1080, height: 1920 };

const probe = (changes: Partial<FootageProbe> = {}): FootageProbe => ({
  duration: 10,
  width: 1920,
  height: 1080,
  rotation: 0,
  displayWidth: 1920,
  displayHeight: 1080,
  codec: "h264",
  pixelFormat: "yuv420p",
  colorTransfer: null,
  hdr: null,
  hasAudio: true,
  ...changes,
});

const clip = (changes: Partial<FootageClip> = {}): FootageClip => ({ id: "broll", source: "/in.mov", role: "broll", fit: "auto", trim: { start: 0, end: null }, script: null, ...changes });

describe("resolveFit", () => {
  it("crops a portrait phone clip into a vertical frame and blurs a landscape one", () => {
    expect(resolveFit("auto", { displayWidth: 1080, displayHeight: 1920 }, FRAME)).toBe("crop");
    expect(resolveFit("auto", { displayWidth: 1440, displayHeight: 1920 }, FRAME)).toBe("blur");
    expect(resolveFit("auto", { displayWidth: 1920, displayHeight: 1080 }, FRAME)).toBe("blur");
  });

  it("keeps a fit the clip names", () => {
    expect(resolveFit("crop", { displayWidth: 1920, displayHeight: 1080 }, FRAME)).toBe("crop");
    expect(resolveFit("blur", { displayWidth: 1080, displayHeight: 1920 }, FRAME)).toBe("blur");
  });
});

describe("toneMapFilter", () => {
  it("does nothing for SDR", () => {
    expect(toneMapFilter(null, "bt709")).toEqual([]);
  });

  it("tone-maps PQ from its own transfer and Dolby Vision through its HLG base", () => {
    expect(toneMapFilter("pq", "smpte2084")[0]).toBe("zscale=tin=smpte2084:pin=bt2020:min=bt2020nc:t=linear:npl=100");
    expect(toneMapFilter("dolby-vision", null)[0]).toBe("zscale=tin=arib-std-b67:pin=bt2020:min=bt2020nc:t=linear:npl=100");
    expect(toneMapFilter("hlg", "arib-std-b67")).toContain("tonemap=tonemap=hable:desat=0");
    expect(toneMapFilter("hlg", "arib-std-b67").at(-1)).toBe("format=yuv420p");
  });

  it("applies a LUT in 16-bit R'G'B' when given one, for every HDR kind", () => {
    for (const hdr of ["pq", "hlg", "dolby-vision"] as const) {
      expect(toneMapFilter(hdr, null, "tonemap-v1-smpte2084.cube")).toEqual([
        "zscale=min=bt2020nc:m=gbr:r=full",
        "format=gbrp16le",
        "lut3d=file=tonemap-v1-smpte2084.cube:interp=tetrahedral",
        "zscale=tin=linear:pin=bt709:t=bt709:p=bt709:m=bt709:r=tv",
        "format=yuv420p",
      ]);
    }
  });

  it("ignores a LUT for SDR", () => {
    expect(toneMapFilter(null, "bt709", "tonemap-v1-arib-std-b67.cube")).toEqual([]);
  });
});

describe("buildVideoFilter", () => {
  const TONE_MAP = toneMapFilter("pq", "smpte2084").join(",");

  it("covers and crops for crop", () => {
    expect(buildVideoFilter({ fit: "crop", frame: FRAME, hdr: null, transfer: null })).toBe(
      "[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=yuv420p[v]",
    );
  });

  it("lays the whole picture over a blurred copy made from it for blur", () => {
    expect(buildVideoFilter({ fit: "blur", frame: FRAME, hdr: null, transfer: null })).toBe(
      [
        "[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2,split=2[bg][fg]",
        "[bg]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=20:2,scale=1080:1920,eq=brightness=-0.06[back]",
        "[back][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]",
      ].join(";"),
    );
  });

  it("crops to the frame before the float tone map, so it runs on frame-sized pictures", () => {
    expect(buildVideoFilter({ fit: "crop", frame: FRAME, hdr: "pq", transfer: "smpte2084" })).toBe(
      `[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${TONE_MAP},setsar=1,format=yuv420p[v]`,
    );
  });

  it("fits the picture into the frame before the float tone map for blur", () => {
    const graph = buildVideoFilter({ fit: "blur", frame: FRAME, hdr: "pq", transfer: "smpte2084" });
    expect(graph.startsWith(`[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2,${TONE_MAP},split=2[bg][fg]`)).toBe(true);
  });

  it("drops to 30 fps and scales before the float format for every HDR kind and fit", () => {
    for (const hdr of ["pq", "hlg", "dolby-vision"] as const) {
      for (const fit of ["crop", "blur"] as const) {
        const graph = buildVideoFilter({ fit, frame: FRAME, hdr, transfer: null });
        expect(graph.startsWith("[0:v]fps=30,scale=")).toBe(true);
        expect(graph.indexOf("scale=1080:1920")).toBeLessThan(graph.indexOf("format=gbrpf32le"));
      }
    }
  });
});

describe("buildVideoFilter with a tone map LUT", () => {
  const LUT = "tonemap-v1-arib-std-b67.cube";

  it("crops to the frame before the LUT", () => {
    const graph = buildVideoFilter({ fit: "crop", frame: FRAME, hdr: "hlg", transfer: "arib-std-b67", toneMapLut: LUT });
    expect(graph).toBe(
      `[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${toneMapFilter("hlg", "arib-std-b67", LUT).join(",")},setsar=1,format=yuv420p[v]`,
    );
    expect(graph).not.toContain("tonemap=");
  });

  it("fits the picture into the frame before the LUT for blur", () => {
    const graph = buildVideoFilter({ fit: "blur", frame: FRAME, hdr: "hlg", transfer: null, toneMapLut: LUT });
    expect(graph.indexOf("force_original_aspect_ratio=decrease")).toBeLessThan(graph.indexOf("lut3d="));
    expect(graph.indexOf("lut3d=")).toBeLessThan(graph.indexOf("split=2"));
  });
});

describe("buildNormalizeArgs", () => {
  it("tone-maps an HDR clip through the LUT it is given, and in float without one", () => {
    const hdr = probe({ hdr: "hlg", colorTransfer: "arib-std-b67" });
    const withLut = buildNormalizeArgs({ clip: clip(), file: "/in.mov", probe: hdr, frame: FRAME, output: "/out.mp4", toneMapLut: "tonemap-v1-arib-std-b67.cube" });
    expect(withLut[withLut.indexOf("-filter_complex") + 1]).toContain("lut3d=file=tonemap-v1-arib-std-b67.cube:interp=tetrahedral");
    const float = buildNormalizeArgs({ clip: clip(), file: "/in.mov", probe: hdr, frame: FRAME, output: "/out.mp4" });
    expect(float[float.indexOf("-filter_complex") + 1]).toContain("tonemap=tonemap=hable:desat=0");
  });

  it("seeks to the trim, limits the length and maps the clip's own sound", () => {
    const args = buildNormalizeArgs({ clip: clip({ trim: { start: 2, end: 6.5 } }), file: "/in.mov", probe: probe(), frame: FRAME, output: "/out.mp4" });
    expect(args.slice(0, 7)).toEqual(["-v", "error", "-y", "-ss", "2", "-i", "/in.mov"]);
    expect(args[args.indexOf("-t") + 1]).toBe("4.500");
    expect(args[args.lastIndexOf("-map") + 1]).toBe("0:a:0");
    expect(args[args.indexOf("-g") + 1]).toBe("15");
    expect(args.at(-1)).toBe("/out.mp4");
  });

  it("adds silence for a clip without sound", () => {
    const args = buildNormalizeArgs({ clip: clip(), file: "/in.mov", probe: probe({ hasAudio: false }), frame: FRAME, output: "/out.mp4" });
    expect(args).toContain("anullsrc=r=48000:cl=stereo");
    expect(args[args.lastIndexOf("-map") + 1]).toBe("1:a");
    expect(args).not.toContain("-ss");
  });

  it("encodes with veryfast and ffmpeg's own thread count by default", () => {
    const args = buildNormalizeArgs({ clip: clip(), file: "/in.mov", probe: probe(), frame: FRAME, output: "/out.mp4" });
    expect(args[args.indexOf("-preset") + 1]).toBe("veryfast");
    expect(args).not.toContain("-threads");
    expect(args).not.toContain("-filter_complex_threads");
  });

  it("takes the app's preset and thread count for the intermediate", () => {
    const args = buildNormalizeArgs({ clip: clip(), file: "/in.mov", probe: probe(), frame: FRAME, output: "/out.mp4", encoder: { preset: "superfast", threads: 1 } });
    expect(args[args.indexOf("-preset") + 1]).toBe("superfast");
    expect(args.slice(3, 5)).toEqual(["-filter_complex_threads", "1"]);
    expect(args[args.indexOf("-threads") + 1]).toBe("1");
    expect(args.indexOf("-threads")).toBeGreaterThan(args.indexOf("-filter_complex"));
  });

  it("refuses a thread count that is not a positive whole number", () => {
    for (const threads of [0, -1, 1.5, Number.NaN]) {
      expect(() => buildNormalizeArgs({ clip: clip(), file: "/in.mov", probe: probe(), frame: FRAME, output: "/out.mp4", encoder: { threads } })).toThrow(
        `normalize.threads must be a positive whole number, got ${threads}.`,
      );
    }
  });
});

const hasFfmpeg = spawnSync("ffprobe", ["-version"]).status === 0 && spawnSync("ffmpeg", ["-version"]).status === 0;

describe.runIf(hasFfmpeg)("normalizeFootage of an HDR clip with ffmpeg (issue #1037)", () => {
  const SMALL = { width: 270, height: 480 };
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "normalize-hdr-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** A 1 s portrait HLG clip of smooth BT.709 colours (10-bit FFV1, tagged BT.2020 HLG) with sound. */
  function makeHlgClip(): string {
    const file = join(dir, "hlg.mkv");
    const picture = "gradients=s=270x480:r=30:d=1:n=4:seed=7:speed=0.05,format=gbrpf32le,zscale=tin=bt709:pin=bt709:t=arib-std-b67:p=bt2020:m=bt2020nc:r=tv:npl=100,format=yuv420p10le";
    const args = ["-v", "error", "-y", "-f", "lavfi", "-i", picture, "-f", "lavfi", "-i", "sine=d=1", "-c:v", "ffv1", "-color_primaries", "bt2020", "-color_trc", "arib-std-b67", "-colorspace", "bt2020nc", "-c:a", "aac", "-shortest", file];
    const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`ffmpeg could not make the HLG clip: ${result.stderr}`);
    return file;
  }

  /** PSNR (average, dB) of two clips' pictures. */
  function measurePsnr(a: string, b: string): number {
    const result = spawnSync("ffmpeg", ["-hide_banner", "-i", a, "-i", b, "-lavfi", "[0:v][1:v]psnr", "-f", "null", "-"], { encoding: "utf8" });
    const match = /average:([\d.]+|inf)/.exec(result.stderr);
    if (match?.[1] === undefined) throw new Error(`no PSNR in: ${result.stderr}`);
    return match[1] === "inf" ? Number.POSITIVE_INFINITY : Number(match[1]);
  }

  it("makes the LUT next to the output, runs from a relative source and matches the float chain", async () => {
    const source = makeHlgClip();
    const probed = await probeFile(source);
    if (!probed.ok) throw new Error(probed.error);
    expect(probed.probe.hdr).toBe("hlg");
    const out = join(dir, "clips");
    mkdirSync(out);
    const output = join(out, "hlg.mp4");
    await normalizeFootage({ clip: clip({ id: "hlg", fit: "crop" }), file: relative(process.cwd(), source), probe: probed.probe, frame: SMALL, output });
    expect(readdirSync(out).sort()).toEqual(["hlg.mp4", "tonemap-v1-arib-std-b67.cube"]);

    const float = join(dir, "float.mp4");
    const args = buildNormalizeArgs({ clip: clip({ id: "hlg", fit: "crop" }), file: source, probe: probed.probe, frame: SMALL, output: float });
    expect(spawnSync("ffmpeg", args).status).toBe(0);
    expect(measurePsnr(float, output)).toBeGreaterThan(45);
  });

  it("leaves an SDR clip's folder without a LUT", async () => {
    const source = join(dir, "sdr.mp4");
    expect(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=270x480:r=30:d=1", "-pix_fmt", "yuv420p", "-c:v", "libx264", source]).status).toBe(0);
    const probed = await probeFile(source);
    if (!probed.ok) throw new Error(probed.error);
    const output = join(dir, "out", "sdr.mp4");
    mkdirSync(join(dir, "out"));
    await normalizeFootage({ clip: clip({ id: "sdr", fit: "crop" }), file: source, probe: probed.probe, frame: SMALL, output });
    expect(existsSync(output)).toBe(true);
    expect(readdirSync(join(dir, "out"))).toEqual(["sdr.mp4"]);
  });
});
