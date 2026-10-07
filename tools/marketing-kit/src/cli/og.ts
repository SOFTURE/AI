import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { MarketingConfig } from "../config/config.js";
import { getOgImageNames } from "../config/og-image-names.js";
import { renderConfiguredOgImage } from "../og/render.js";
import { fail } from "./failure.js";

/**
 * `og [image]`: writes `<output.dir>/og/<id>.png` for every `ogImages` entry, or for the one named; a carousel
 * writes one file per slide, `<id>-1.png`…`<id>-<n>.png`.
 */
export async function writeOgImages(config: MarketingConfig, imageId: string | null): Promise<void> {
  const entries = imageId === null ? config.ogImages : config.ogImages.filter((image) => image.id === imageId);
  if (config.ogImages.length === 0) fail(`no OG images: add entries to ogImages in ${config.file}.`);
  if (entries.length === 0) {
    fail(`no "${imageId ?? ""}" in ogImages of ${config.file}; known: ${config.ogImages.map((image) => image.id).join(", ")}.`);
  }
  const dir = join(config.output.dir, "og");
  mkdirSync(dir, { recursive: true });
  for (const entry of entries) {
    const names = getOgImageNames(entry);
    for (const [index, name] of names.entries()) {
      const png = await renderConfiguredOgImage({ config, id: entry.id, slide: index + 1 });
      if (!png.ok) fail(png.error);
      const path = join(dir, `${name}.png`);
      writeFileSync(path, png.value);
      const slide = names.length > 1 ? `, slide ${String(index + 1)}/${String(names.length)}` : "";
      console.log(`✓ ${path} (${String(entry.size[0])}×${String(entry.size[1])}, ${entry.template}${slide})`);
    }
  }
}
