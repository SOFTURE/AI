import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readReleasePackages } from "../../scripts/release/pack.mjs";
import { getReleaseTag, setInlineManifestVersion, setModuleVersion } from "../../scripts/release/version.mjs";
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

describe("setInlineManifestVersion", () => {
  const source = [
    "// `defineModule({ manifest: { version: \"1.0.0\" } })` in a comment is not the manifest.",
    'const NOTE = "version: \\"9.9.9\\"";',
    "export const ops = defineModule({",
    "  manifest: {",
    "    id: MODULE_ID,",
    '    version: "0.1.5",',
    '    dependsOn: { core: { version: "0.1.0" } },',
    '    routes: { health: "/api/health" },',
    "  },",
    "});",
    "",
  ].join("\n");

  it("replaces only the version of the manifest object", () => {
    const result = setInlineManifestVersion(source, "0.1.6");
    expect(result).toEqual({ ok: true, text: source.replace('    version: "0.1.5",', '    version: "0.1.6",') });
  });

  it("leaves a version in a comment before the manifest alone", () => {
    const text = '/** `privacy({ documents: [{ id: "terms", version: "2026-10-01" }] })` */\nconst m = defineModule({ manifest: { id: "x", version: "0.1.0" } });\n';
    const result = setInlineManifestVersion(text, "0.2.0");
    expect(result).toEqual({ ok: true, text: text.replace('version: "0.1.0"', 'version: "0.2.0"') });
  });

  it("refuses a file without an inline manifest", () => {
    const result = setInlineManifestVersion('export const MODULE_ID = "x";\n', "0.1.0");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("no inline manifest") as string });
  });

  it("refuses a manifest without a top-level version", () => {
    const result = setInlineManifestVersion('defineModule({ manifest: { id: "x", dependsOn: { core: { version: "0.1.0" } } } });\n', "0.2.0");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("version") as string });
  });

  it("refuses two manifests in one file", () => {
    const text = 'defineModule({ manifest: { version: "0.1.0" } });\ndefineModule({ manifest: { version: "0.1.0" } });\n';
    const result = setInlineManifestVersion(text, "0.2.0");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("2 inline manifests") as string });
  });

  const modules = readReleasePackages(REPO_ROOT).filter(
    (pkg) => pkg.manifest.private !== true && existsSync(join(REPO_ROOT, pkg.dir, "module.json")),
  );

  it("finds the released modules", () => {
    expect(modules.length).toBeGreaterThanOrEqual(12);
  });

  it.each(modules.map((pkg) => [pkg.dir]))("changes only the manifest version line of %s/src/index.ts", (dir) => {
    const text = readFileSync(join(REPO_ROOT, dir, "src/index.ts"), "utf8");
    const result = setInlineManifestVersion(text, "99.0.0");
    if (!result.ok) throw new Error(result.reason);
    const before = text.split("\n");
    const after = result.text.split("\n");
    const changed = after.flatMap((line, index) => (line === before[index] ? [] : [line]));
    expect(after).toHaveLength(before.length);
    expect(changed).toEqual(['    version: "99.0.0",']);
  });
});
