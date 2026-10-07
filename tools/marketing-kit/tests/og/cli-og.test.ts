import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { writeOgImages } from "../../src/cli/og.js";
import { loadMarketingConfig } from "../../src/config/config.js";
import { renderConfiguredOgImage } from "../../src/og/render.js";
import { COLORS, LOGO_SVG, SAMPLE_DATA, getInterFile, readPngSize } from "./helpers.js";

describe("og command", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marketing-og-cli-"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  function loadConfig() {
    const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "examples", "fixture", "marketing.json"), "utf8")) as Record<string, unknown>;
    writeFileSync(join(dir, "mark.svg"), LOGO_SVG);
    const config = {
      ...fixture,
      $schema: undefined,
      brand: {
        ...(fixture.brand as Record<string, unknown>),
        tokensFrom: undefined,
        colors: COLORS,
        logo: { svg: "mark.svg" },
        fonts: { heading: { family: "Inter", files: [{ path: getInterFile(400), weight: 400 }, { path: getInterFile(700), weight: 700 }] } },
      },
      output: { dir: "out" },
      ogImages: [
        { id: "share", template: "headline-cta", data: SAMPLE_DATA["headline-cta"] },
        { id: "number", template: "big-number", size: "square", data: SAMPLE_DATA["big-number"] },
        { id: "myth", template: "carousel", data: SAMPLE_DATA.carousel },
      ],
    };
    writeFileSync(join(dir, "marketing.json"), JSON.stringify(config));
    const loaded = loadMarketingConfig(join(dir, "marketing.json"));
    if (!loaded.ok) throw new Error(loaded.error);
    return loaded.config;
  }

  it("writes one file per card and one per carousel slide, at the entry's size", async () => {
    const config = loadConfig();
    await writeOgImages(config, null);
    const og = join(config.output.dir, "og");
    const files = readdirSync(og).sort();
    expect(files).toEqual(["myth-1.png", "myth-2.png", "myth-3.png", "number.png", "share.png"]);
    expect(files.map((file) => readPngSize(readFileSync(join(og, file))))).toEqual([
      [1080, 1350],
      [1080, 1350],
      [1080, 1350],
      [1080, 1080],
      [1200, 630],
    ]);
  });

  it("writes each slide as renderConfiguredOgImage draws it", async () => {
    const config = loadConfig();
    await writeOgImages(config, "myth");
    const second = await renderConfiguredOgImage({ config, id: "myth", slide: 2 });
    if (!second.ok) throw new Error(second.error);
    const og = join(config.output.dir, "og");
    expect(readFileSync(join(og, "myth-2.png")).equals(second.value)).toBe(true);
    expect(readFileSync(join(og, "myth-1.png")).equals(second.value)).toBe(false);
    expect(readdirSync(og).sort()).toEqual(["myth-1.png", "myth-2.png", "myth-3.png"]);
  });
});
