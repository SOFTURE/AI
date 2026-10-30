import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findBrowserProblem, readFfmpegListing } from "./tools.js";

describe("readFfmpegListing", () => {
  it("reads the names of `ffmpeg -decoders` and `-filters`, not the legend", () => {
    const decoders = ["Decoders:", " V..... = Video", " ------", " VFS..D h264                 H.264 / AVC", " VFS..D hevc                 HEVC (High Efficiency Video Coding)"].join("\n");
    const filters = ["Filters:", "  T.. = Timeline support", "  | = Source or sink filter", " ... tonemap           V->V       Conversion to/from different dynamic ranges.", " .S. zscale            V->V       Apply resizing, colorspace and bit depth conversion."].join("\n");
    expect([...readFfmpegListing(decoders)]).toEqual(["h264", "hevc"]);
    expect([...readFfmpegListing(filters)]).toEqual(["tonemap", "zscale"]);
  });
});

describe("findBrowserProblem", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "footage-tools-"));
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("finds the chrome-headless-shell hyperframes downloaded into its cache", () => {
    const folder = join(home, ".cache", "hyperframes", "chrome", "chrome-headless-shell", "linux-152.0.7977.30", "chrome-headless-shell-linux64");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "chrome-headless-shell"), "");
    expect(findBrowserProblem({ HOME: home })).toBeNull();
  });

  it("takes HYPERFRAMES_BROWSER_PATH when it names a file, and says so when it does not", () => {
    const browser = join(home, "chrome");
    writeFileSync(browser, "");
    expect(findBrowserProblem({ HOME: home, HYPERFRAMES_BROWSER_PATH: browser })).toBeNull();
    expect(findBrowserProblem({ HOME: home, HYPERFRAMES_BROWSER_PATH: join(home, "gone") })).toBe(`HYPERFRAMES_BROWSER_PATH names ${join(home, "gone")}, which does not exist.`);
  });

  it("reports a machine without any browser", () => {
    expect(findBrowserProblem({ HOME: home })).toBe(
      "hyperframes has no browser: run `npx hyperframes browser ensure` in the image, or set HYPERFRAMES_BROWSER_PATH to a chrome-headless-shell.",
    );
  });
});
