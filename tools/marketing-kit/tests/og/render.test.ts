import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadMarketingConfig } from "../../src/config/config.js";
import { renderConfiguredOgImage, renderOgImage, renderOgSvg } from "../../src/og/render.js";
import { OG_TEMPLATE_IDS } from "../../src/og/templates/index.js";
import { COLORS, LOGO_SVG, PNG_SIGNATURE, SAMPLE_DATA, getInterFile, loadInter, readPngSize } from "./helpers.js";

const SNAPSHOT_DIR = join(import.meta.dirname, "__snapshots__");
const isUpdating = process.env.UPDATE_OG_SNAPSHOTS === "1";

function brandInput(template: string, size?: [number, number]) {
  return { template, data: SAMPLE_DATA[template], size, brand: { name: "Fixture Plan", colors: COLORS, logoSvg: LOGO_SVG }, fonts: loadInter() };
}

describe("renderOgImage", () => {
  it("renders a PNG at 1200×630 by default", async () => {
    const png = await renderOgImage(brandInput("headline-cta"));
    if (!png.ok) throw new Error(png.error);
    expect(png.value.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    expect(readPngSize(png.value)).toEqual([1200, 630]);
  });

  it("renders at the entry's size", async () => {
    const png = await renderOgImage(brandInput("headline-chart", [1080, 1080]));
    expect(png.ok && readPngSize(png.value)).toEqual([1080, 1080]);
  });

  it("draws text as paths, so the PNG needs no machine fonts", async () => {
    const svg = await renderOgSvg(brandInput("headline-cta"));
    expect(svg.ok && svg.value.includes("<text")).toBe(false);
  });

  it("returns invalid data as an error, not an exception", async () => {
    const png = await renderOgImage({ ...brandInput("headline-cta"), data: { cta: "Go" } });
    expect(png.ok ? null : png.error).toBe('OG image: the data of template "headline-cta" is not valid:\n  data.headline: Invalid input: expected string, received undefined');
  });

  // One committed PNG per template, compared byte for byte. After an intended change:
  // `UPDATE_OG_SNAPSHOTS=1 npx vitest run tools/marketing-kit/tests/og`, then look at the PNGs.
  it.each(OG_TEMPLATE_IDS)("matches the committed snapshot of %s", async (template) => {
    const png = await renderOgImage(brandInput(template));
    if (!png.ok) throw new Error(png.error);
    const file = join(SNAPSHOT_DIR, `${template}.png`);
    if (isUpdating) {
      mkdirSync(SNAPSHOT_DIR, { recursive: true });
      writeFileSync(file, png.value);
    }
    expect(existsSync(file), `${file} is missing; run with UPDATE_OG_SNAPSHOTS=1`).toBe(true);
    expect(png.value.equals(readFileSync(file)), `${template} differs from ${file}`).toBe(true);
  });

  it("has no snapshot without a template", () => {
    const snapshots = existsSync(SNAPSHOT_DIR) ? readdirSync(SNAPSHOT_DIR) : [];
    expect(snapshots.sort()).toEqual(OG_TEMPLATE_IDS.map((template) => `${template}.png`).sort());
  });
});

describe("renderConfiguredOgImage", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marketing-og-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeConfig(overrides: Record<string, unknown>): string {
    const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "examples", "fixture", "marketing.json"), "utf8")) as Record<string, unknown>;
    const brand = fixture.brand as Record<string, unknown>;
    writeFileSync(join(dir, "mark.svg"), LOGO_SVG);
    const config = {
      ...fixture,
      $schema: undefined,
      brand: {
        ...brand,
        tokensFrom: undefined,
        colors: COLORS,
        logo: { svg: "mark.svg" },
        fonts: { heading: { family: "Inter", files: [{ path: getInterFile(400), weight: 400 }, { path: getInterFile(700), weight: 700 }] } },
      },
      ogImages: [{ id: "calculator", template: "headline-cta", data: SAMPLE_DATA["headline-cta"] }],
      ...overrides,
    };
    writeFileSync(join(dir, "marketing.json"), JSON.stringify(config));
    return join(dir, "marketing.json");
  }

  function loadConfig() {
    const loaded = loadMarketingConfig(writeConfig({}));
    if (!loaded.ok) throw new Error(loaded.error);
    return loaded.config;
  }

  it("refuses an unknown template or wrong data when marketing.json is loaded", () => {
    const loaded = loadMarketingConfig(
      writeConfig({
        ogImages: [
          { id: "poster", template: "poster", data: {} },
          { id: "chart", template: "headline-chart", data: { headline: "x", chart: { viewBox: [10, 10], paths: [] } } },
        ],
      }),
    );
    expect(loaded.ok ? null : loaded.error.split("\n").slice(1)).toEqual([
      "  ogImages[0].template: Invalid discriminator value. Expected 'headline-cta' | 'headline-chart'",
      "  ogImages[1].data.chart.paths: a chart needs at least one path",
    ]);
  });

  it("renders an entry with the brand's fonts, colours and logo, like renderOgImage", async () => {
    const config = loadConfig();
    const fromConfig = await renderConfiguredOgImage({ config, id: "calculator" });
    const direct = await renderOgImage(brandInput("headline-cta"));
    expect(fromConfig.ok && direct.ok && fromConfig.value.equals(direct.value)).toBe(true);
  });

  it("takes a route's data in place of the entry's", async () => {
    const config = loadConfig();
    const replaced = await renderConfiguredOgImage({ config, id: "calculator", data: { headline: "Stop working at 52" } });
    const original = await renderConfiguredOgImage({ config, id: "calculator" });
    expect(replaced.ok && original.ok && replaced.value.equals(original.value)).toBe(false);
  });

  it("checks a route's data against the template", async () => {
    const result = await renderConfiguredOgImage({ config: loadConfig(), id: "calculator", data: { headline: "x".repeat(91) } });
    expect(result.ok ? null : result.error).toBe('OG image: the data of template "headline-cta" is not valid:\n  data.headline: must be at most 90 characters');
  });

  it("names the known ids when the id is unknown", async () => {
    const config = loadConfig();
    const result = await renderConfiguredOgImage({ config, id: "pricing" });
    expect(result.ok ? null : result.error).toBe(`OG image: no "pricing" in ogImages of ${config.file}; known: calculator.`);
  });

  it("refuses a brand whose only font is .woff2 before laying anything out", async () => {
    const config = loadConfig();
    config.brand.fonts.heading = { family: "Inter", fallback: "sans-serif", files: [{ path: getInterFile(400, "woff2"), weight: "400", style: "normal", unicodeRange: null }] };
    const result = await renderConfiguredOgImage({ config, id: "calculator" });
    expect(result.ok ? null : result.error).toBe("OG images: brand.fonts.heading.files[0] is .woff2; Satori reads only .ttf, .otf and .woff files.");
  });
});
