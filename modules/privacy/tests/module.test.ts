// The module definition: its manifest, its options and the modules it needs.
import { readFileSync } from "node:fs";
import { defineSoftureConfig, ok, toModuleJson } from "@softure-ai/core";
import { DEFAULT_EXPORT_MAX_BYTES, privacy } from "@softure-ai/privacy";
import { describe, expect, it } from "vitest";
import { createConfig } from "./support.js";

const exportNothing = () => Promise.resolve(ok({}));

describe("the privacy module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(privacy));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(privacy.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults: no app contributors, a 10 MiB export named account-data", () => {
    expect(privacy().options).toEqual({ contributors: [], export: { maxBytes: DEFAULT_EXPORT_MAX_BYTES, fileName: "account-data" } });
    expect(DEFAULT_EXPORT_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it("refuses contributors it cannot run, listing every problem", () => {
    expect(() =>
      privacy({
        contributors: [
          { id: "User_Profile", exportUserData: exportNothing },
          { id: "empty" },
          { id: "profile", exportUserData: exportNothing },
          { id: "profile", exportUserData: exportNothing },
          // @ts-expect-error: a JavaScript config can pass something that is not a function.
          { id: "broken", deleteUserData: "yes" },
        ],
        export: { maxBytes: 10, fileName: "My Data" },
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "privacy":',
        "- options.contributors.0.id: must be kebab-case, e.g. user-profile",
        "- options.contributors.1: needs exportUserData, deleteUserData or both",
        "- options.contributors.4.deleteUserData: must be a function",
        "- options.export.maxBytes: Too small: expected number to be >=1024",
        "- options.export.fileName: must be 1-64 lowercase letters, digits or -",
      ].join("\n"),
    );
  });

  it("refuses an app contributor registered twice", () => {
    expect(() =>
      privacy({
        contributors: [
          { id: "profile", exportUserData: exportNothing },
          { id: "profile", exportUserData: exportNothing },
        ],
      }),
    ).toThrow('options.contributors.1.id: "profile" is registered twice');
  });

  it("needs auth and security, so a deletion always reaches the account and attempts are counted", () => {
    expect(() =>
      defineSoftureConfig({ database: { url: "pglite://" }, locale: "en", timezone: "UTC", appOrigin: "http://localhost:3000", modules: [privacy()] }),
    ).toThrow(/module "privacy" needs module "auth" \(\^0\.0\.0\), which is not listed/);
  });

  it("is listed after the modules it collects from when sorting", () => {
    expect(createConfig().modules.map((module) => module.id)).toEqual(["security", "auth", "feature-switches", "notes", "privacy"]);
  });
});
