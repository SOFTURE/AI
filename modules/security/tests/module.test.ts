// The module definition: its manifest, its options and the constraints of its table.
import { readFileSync } from "node:fs";
import { toModuleJson } from "@softure-ai/core";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestSecurity, NOW, type TestSecurity } from "./support.js";

const BUCKETS = { login: { limit: 5, windowMinutes: 15 } };

describe("the security module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(security));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(security.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults and takes a single resolver as a list", () => {
    const resolver = headerIp("x-real-ip");
    const module = security({ clientIp: resolver, buckets: BUCKETS });
    expect(module.options).toEqual({ clientIp: [resolver], buckets: BUCKETS, ipv6Subnet: 64, cleanupProbability: 0.01 });
  });

  it("refuses options it cannot run with, listing every problem", () => {
    expect(() =>
      // @ts-expect-error: the test passes values the types already forbid, as a JavaScript config could.
      security({ clientIp: "cf-connecting-ip", buckets: { Login: { limit: 0, windowMinutes: 15 } }, ipv6Subnet: 129, extra: true }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "security":',
        "- options.clientIp: must be a client-IP resolver or a non-empty list of them, e.g. cloudflareIp()",
        "- options.buckets.Login.limit: Too small: expected number to be >=1",
        "- options.buckets.Login: is not a bucket name: lowercase letters, digits, _ . and -, starting with a letter",
        "- options.ipv6Subnet: Too big: expected number to be <=128",
        '- options: Unrecognized key: "extra"',
      ].join("\n"),
    );
  });

  it("refuses a bucket name that is not lowercase", () => {
    expect(() => security({ clientIp: headerIp("x-real-ip"), buckets: { Login: { limit: 1, windowMinutes: 1 } } })).toThrow(
      "- options.buckets.Login: is not a bucket name: lowercase letters, digits, _ . and -, starting with a letter",
    );
  });

  it("refuses an empty list of resolvers", () => {
    expect(() => security({ clientIp: [], buckets: BUCKETS })).toThrow("options.clientIp: must be a client-IP resolver");
  });

  it("refuses an empty bucket map", () => {
    expect(() => security({ clientIp: headerIp("x-real-ip"), buckets: {} })).toThrow("must define at least one bucket");
  });
});

describe("security.rate_limits constraints", () => {
  let test: TestSecurity;

  beforeEach(async () => {
    test = await createTestSecurity();
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function insertRow(bucket: string, identifier: string, attempts: number): Promise<unknown> {
    return test.database.client.query(
      "INSERT INTO security.rate_limits (bucket, identifier, attempts, window_started_at) VALUES ($1, $2, $3, $4)",
      [bucket, identifier, attempts, NOW],
    );
  }

  it("accepts a valid row", async () => {
    await expect(insertRow("login", "ip:192.0.2.1", 1)).resolves.toBeDefined();
  });

  it.each([
    ["an uppercase bucket", "Login", "ip:192.0.2.1", 1],
    ["an empty identifier", "login", "", 1],
    ["an identifier over 200 characters", "login", "x".repeat(201), 1],
    ["zero attempts", "login", "ip:192.0.2.1", 0],
  ])("rejects %s", async (_case, bucket, identifier, attempts) => {
    await expect(insertRow(bucket, identifier, attempts)).rejects.toThrow(/check constraint/);
  });

  it("rejects a second row for the same bucket and identifier", async () => {
    await insertRow("login", "ip:192.0.2.1", 1);
    await expect(insertRow("login", "ip:192.0.2.1", 1)).rejects.toThrow(/duplicate key/);
  });
});
