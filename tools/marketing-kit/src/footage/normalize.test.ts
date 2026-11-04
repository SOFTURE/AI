import { describe, expect, it } from "vitest";

import type { FootageClip } from "./film.js";
import { buildNormalizeArgs, buildVideoFilter, resolveFit, toneMapFilter } from "./normalize.js";
import type { FootageProbe } from "./probe.js";

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

describe("buildNormalizeArgs", () => {
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
