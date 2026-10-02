import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getReleaseTag, setModuleVersion } from "../../scripts/release/version.mjs";
import { REPO_ROOT } from "./repo-files.js";

describe("getReleaseTag", () => {
  it("names the tag the release workflow listens to", () => {
    expect(getReleaseTag("core", "0.1.0")).toBe("core@0.1.0");
    expect(getReleaseTag("feature-switches", "1.0.0-0")).toBe("feature-switches@1.0.0-0");
  });
});

describe("setModuleVersion", () => {
  const template = readFileSync(join(REPO_ROOT, "templates/package/module.json"), "utf8");

  it("replaces only the top-level version and keeps the formatting", () => {
    const result = setModuleVersion(template, "0.2.0");
    expect(result).toEqual({ ok: true, text: template.replace('"version": "0.0.0"', '"version": "0.2.0"') });
  });

  it("leaves a nested version alone", () => {
    const text = '{\n  "id": "x",\n  "version": "0.1.0",\n  "dependsOn": { "core": { "version": "0.1.0" } }\n}\n';
    const result = setModuleVersion(text, "0.1.1");
    expect(result).toEqual({
      ok: true,
      text: '{\n  "id": "x",\n  "version": "0.1.1",\n  "dependsOn": { "core": { "version": "0.1.0" } }\n}\n',
    });
  });

  it("reports a module.json without a top-level version", () => {
    const result = setModuleVersion('{\n  "id": "x"\n}\n', "0.1.0");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("version") as string });
  });
});
