// The module definition: its manifest and its options.
import { readFileSync } from "node:fs";
import { toModuleJson } from "@softure-ai/core";
import { ops } from "@softure-ai/ops";
import { describe, expect, it } from "vitest";
import { passingCheck } from "./support.js";

describe("the ops module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(ops));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(ops.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults", () => {
    expect(ops().options).toEqual({ checks: {}, timeoutMs: 3000, detail: "status" });
    expect(ops().routes).toEqual({ health: "/api/health" });
  });

  it("keeps the app's checks by name", () => {
    expect(ops({ checks: { "app.queue": passingCheck } }).options.checks).toEqual({ "app.queue": passingCheck });
  });

  it("refuses options it cannot run with, listing every problem", () => {
    expect(() =>
      // @ts-expect-error: the test passes values the types already forbid, as a JavaScript config could.
      ops({ checks: { "app.cache": "select 1" }, timeoutMs: 50, detail: "all", getDatabase: "db", extra: true }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "ops":',
        "- options.checks.app.cache: must be a function (context) => Promise<Result<undefined>>",
        "- options.timeoutMs: Too small: expected number to be >=100",
        '- options.detail: Invalid option: expected one of "status"|"checks"',
        "- options.getDatabase: must be a function () => Promise<Queryable>, e.g. the app's own getDatabase",
        '- options: Unrecognized key: "extra"',
      ].join("\n"),
    );
  });

  it("refuses a check name that is not lowercase", () => {
    expect(() => ops({ checks: { Queue: passingCheck } })).toThrow(
      "- options.checks.Queue: is not a check name: lowercase letters, digits, _ . and -, starting with a letter",
    );
  });
});
