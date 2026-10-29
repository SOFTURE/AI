// The module definition: its manifest, its options and the constraints of its table.
import { readFileSync } from "node:fs";
import { toModuleJson } from "@softure-ai/core";
import { files, filesMessages, getFilesErrorMessage } from "@softure-ai/files";
import { createMemoryStorage } from "@softure-ai/files/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALICE, createTestFiles, NOW, type TestFiles } from "./support.js";

describe("the files module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(files));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(files.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults", () => {
    const storage = createMemoryStorage();
    expect(files({ storage }).options).toEqual({
      storage,
      maxFileBytes: 100 * 1024 * 1024,
      quotaBytesPerOwner: null,
      dedupe: false,
      defaultTtlSeconds: null,
      links: { maxTtlSeconds: 7 * 24 * 60 * 60, disposition: "attachment" },
      health: { minFreeBytes: 1024 * 1024 * 1024 },
    });
  });

  it("refuses to start without a storage driver, or with something that is not one", () => {
    expect(() => files()).toThrow(/storage/);
    expect(() => files({ storage: { kind: "fake", put: () => undefined } as never })).toThrow(/storage driver/);
    expect(() => files({ storage: createMemoryStorage(), maxFileBytes: 0 })).toThrow(/maxFileBytes/);
  });

  it("translates every code and falls back to the generic message", () => {
    expect(getFilesErrorMessage(filesMessages.en, "files.too_large")).toBe("The file is too large.");
    expect(getFilesErrorMessage(filesMessages.en, "files.unknown")).toBe("Something went wrong. Try again.");
    expect(getFilesErrorMessage(filesMessages.en, "auth.forbidden")).toBe("Something went wrong. Try again.");
  });
});

describe("the files table", () => {
  let test: TestFiles;

  beforeEach(async () => {
    test = await createTestFiles();
  });
  afterEach(async () => {
    await test.database.close();
  });

  async function insert(overrides: Readonly<Record<string, unknown>>): Promise<unknown> {
    const row = {
      id: "3f1c2b4a-5d6e-4f70-8192-a3b4c5d6e7f8",
      owner_id: ALICE,
      sha256: "a".repeat(64),
      size: 1,
      content_type: "text/plain",
      original_name: "a.txt",
      kind: "file",
      storage_key: "3f/1c/3f1c2b4a-5d6e-4f70-8192-a3b4c5d6e7f8",
      created_at: NOW,
      ...overrides,
    };
    const names = Object.keys(row);
    return test.database.client.query(
      `INSERT INTO files.files (${names.join(", ")}) VALUES (${names.map((_, index) => `$${String(index + 1)}`).join(", ")})`,
      Object.values(row),
    );
  }

  it("accepts a well-formed row", async () => {
    await expect(insert({})).resolves.toBeDefined();
  });

  it.each([
    ["an uppercase hash", { sha256: "A".repeat(64) }],
    ["a negative size", { size: -1 }],
    ["a content type with a line break", { content_type: "text/plain\r\nx: y" }],
    ["a name with a slash", { original_name: "../etc/passwd" }],
    ["a name with a control character", { original_name: "a\u0007b" }],
    ["an uppercase kind", { kind: "Output" }],
    ["a storage key with ..", { storage_key: "../escape" }],
    ["an expiry before creation", { expires_at: new Date(NOW.getTime() - 1000) }],
    ["an empty owner", { owner_id: "" }],
  ])("refuses %s", async (_label, overrides) => {
    await expect(insert(overrides)).rejects.toThrow(/check constraint/);
  });
});
