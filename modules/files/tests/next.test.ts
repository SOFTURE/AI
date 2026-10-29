// The Next adapter: the route reads the registered config and the configured database (the test PGlite through
// `database.handle`), and serves a link to a file saved on the local disk driver.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineSoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { closeConfiguredDatabases, createPgliteHandle } from "@softure-ai/db";
import { createTestDatabase } from "@softure-ai/db/testing";
import { files } from "@softure-ai/files";
import { getFilesContext, serveFileLinkRoute } from "@softure-ai/files/next";
import { createFileLink, createLocalStorage, saveFile } from "@softure-ai/files/server";
import { createTestLinkKeys } from "@softure-ai/files/testing";
import { afterEach, describe, expect, it } from "vitest";
import { ALICE, chunked } from "./support.js";

describe("the Next adapter", () => {
  const envBefore = { ...process.env };
  let dir: string | undefined;

  afterEach(async () => {
    for (const name of Object.keys(process.env)) if (!(name in envBefore)) delete process.env[name];
    clearSoftureConfig();
    // The configured handle wraps the test PGlite, so closing it closes the test database too.
    await closeConfiguredDatabases();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  });

  it("serves GET and HEAD for a link, reading the keyring from process.env", async () => {
    dir = mkdtempSync(join(tmpdir(), "softure-files-next-"));
    const base = {
      locale: "en",
      timezone: "Europe/Warsaw",
      appOrigin: "https://app.example.com",
      modules: [files({ storage: createLocalStorage({ dir }) })],
    };
    const database = await createTestDatabase(base.modules);
    const client = database.client;
    registerSoftureConfig(
      defineSoftureConfig({
        ...base,
        database: {
          url: "pglite://",
          handle: () => createPgliteHandle(client),
        },
      }),
    );
    Object.assign(process.env, createTestLinkKeys());
    const ctx = await getFilesContext();

    const saved = await saveFile(ctx, {
      ownerId: ALICE,
      body: chunked("video bytes"),
      name: "clip.mp4",
      contentType: "video/mp4",
    });
    if (!saved.ok) throw new Error(`setup: ${saved.error}`);
    const link = await createFileLink(ctx, saved.value.id, { ttlSeconds: 600 });
    if (!link.ok) throw new Error(`setup: ${link.error}`);

    const get = await serveFileLinkRoute(new Request(link.value.url, { headers: { range: "bytes=6-" } }));
    expect([get.status, get.headers.get("content-type"), await get.text()]).toEqual([206, "video/mp4", "bytes"]);
    const head = await serveFileLinkRoute(new Request(link.value.url, { method: "HEAD" }));
    expect([head.status, head.headers.get("content-length")]).toEqual([200, "11"]);
    expect((await serveFileLinkRoute(new Request(`${link.value.url}x`))).status).toBe(404);
  });

  it("refuses an app without a database", async () => {
    const config = defineSoftureConfig({
      locale: "en",
      timezone: "UTC",
      appOrigin: "https://app.example.com",
      database: null,
      modules: [],
    });
    await expect(getFilesContext(config)).rejects.toThrow(/no database/);
  });
});
