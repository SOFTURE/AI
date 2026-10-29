// The module definition: its manifest, in step with module.json and package.json.
import { readFileSync } from "node:fs";

import { toModuleJson } from "@softure-ai/core";
import { pwa } from "@softure-ai/pwa";
import { describe, expect, it } from "vitest";

describe("the pwa module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(pwa));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(pwa.manifest.version).toBe(manifest.version);
  });

  it("names the public paths as its routes and ships its English copy", () => {
    const module = pwa();
    expect(module.routes).toEqual({
      manifest: "/pwa/manifest.webmanifest",
      icons: "/pwa/icons",
      version: "/pwa/version",
      serviceWorker: "/sw.js",
    });
    expect(module.messages.en.update.reload).toBe("Reload");
  });
});
