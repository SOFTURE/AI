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
  it("covers and crops for crop", () => {
    expect(buildVideoFilter({ fit: "crop", frame: FRAME, hdr: null, transfer: null })).toBe(
      "[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=yuv420p[v]",
    );
  });

  it("lays the whole picture over a blurred copy for blur", () => {
    const graph = buildVideoFilter({ fit: "blur", frame: FRAME, hdr: null, transfer: null });
    expect(graph).toContain("split=2[bg][fg]");
    expect(graph).toContain("boxblur=20:2");
    expect(graph).toContain("[fg]scale=1080:1920:force_original_aspect_ratio=decrease[front]");
    expect(graph.endsWith("[back][front]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]")).toBe(true);
  });

  it("tone-maps before anything else", () => {
    expect(buildVideoFilter({ fit: "crop", frame: FRAME, hdr: "pq", transfer: "smpte2084" }).startsWith("[0:v]zscale=tin=smpte2084")).toBe(true);
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
});
