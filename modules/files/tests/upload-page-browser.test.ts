// The browser upload page as a real browser runs it, from the module as a production bundler ships it: minified, so
// `sendUpload` loses its name. The page must still send the file (an app's minified build once broke it: the inlined
// function came out as `function l(...)` while the page called `sendUpload(...)`, so "Upload" did nothing).
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "@playwright/test";
import { createUpload, getUpload, serveUpload, type FilesContext } from "@softure-ai/files/server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { renderUploadPage as renderSourcePage } from "../src/server/upload-page.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";
import { bundleMinifiedPage, type RenderPage } from "./minified-page.js";
import { ALICE, closeTestFiles, createTestFiles } from "./support.js";

const CHUNK = 1024;
const CONTENT = Buffer.from("a".repeat(CHUNK) + "b".repeat(CHUNK) + "c".repeat(CHUNK / 2));

describe.skipIf(!hasChromium)("the upload page in a browser", () => {
  let browser: Browser;
  let outdir: string;
  let minified: { render: RenderPage; source: string };
  let server: Server | undefined;

  beforeAll(async () => {
    outdir = await mkdtemp(join(tmpdir(), "files-upload-page-"));
    minified = await bundleMinifiedPage(outdir);
    browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  });

  afterAll(async () => {
    await browser.close();
    await rm(outdir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (server === undefined) resolve();
      else server.close(() => resolve());
    });
    server = undefined;
    await closeTestFiles();
  });

  /** An upload session behind a local HTTP server whose HTML page comes from `render`, the rest from the route. */
  async function serveSession(render: RenderPage): Promise<{ ctx: FilesContext; uploadId: string; pageUrl: string }> {
    const test = await createTestFiles({ files: { uploads: { chunkBytes: CHUNK } } });
    const created = await createUpload(test.ctx, { ownerId: ALICE, name: "clip.mp4", contentType: "video/mp4", size: CONTENT.length });
    if (!created.ok) throw new Error(`setup: ${created.error}`);
    const { uploadId, uploadUrl } = created.value;
    const appOrigin = new URL(uploadUrl).origin;

    server = createServer((incoming, outgoing) => {
      void answer(test.ctx, render, uploadId, appOrigin, incoming, outgoing);
    });
    const listening = server;
    await new Promise<void>((resolve) => listening.listen(0, "127.0.0.1", resolve));
    const { port } = listening.address() as AddressInfo;
    const path = new URL(uploadUrl).pathname + new URL(uploadUrl).search;
    return { ctx: test.ctx, uploadId, pageUrl: `http://127.0.0.1:${String(port)}${path}` };
  }

  async function uploadInBrowser(pageUrl: string): Promise<{ status: string; errors: string[] }> {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    try {
      await page.goto(pageUrl);
      await page.setInputFiles("#file", { name: "clip.mp4", mimeType: "video/mp4", buffer: CONTENT });
      await page.click("#start");
      await page.waitForFunction(() => {
        const text = document.getElementById("status")?.textContent ?? "";
        return text.startsWith("Upload complete") || text.startsWith("The upload stopped") || text.startsWith("This upload link");
      }, undefined, { timeout: 15_000 }).catch(() => undefined);
      return { status: (await page.textContent("#status")) ?? "", errors };
    } finally {
      await page.close();
    }
  }

  it("ships a bundle in which the inlined function has lost its name", () => {
    // The precondition of the regression: a minifier renames the top-level `sendUpload`.
    expect(minified.source).not.toMatch(/function sendUpload\b/);
  });

  it("sends every chunk from the minified page and the session completes", async () => {
    const { ctx, uploadId, pageUrl } = await serveSession(minified.render);
    const result = await uploadInBrowser(pageUrl);
    expect(result.errors).toEqual([]);
    expect(result.status).toBe("Upload complete. Go back to where you started it to finish.");
    const status = await getUpload(ctx, uploadId);
    expect(status?.state).toBe("complete");
    expect(status?.receivedBytes).toBe(CONTENT.length);
  });

  it("sends every chunk from the page built from source", async () => {
    const { ctx, uploadId, pageUrl } = await serveSession(renderSourcePage);
    const result = await uploadInBrowser(pageUrl);
    expect(result.errors).toEqual([]);
    expect(result.status).toBe("Upload complete. Go back to where you started it to finish.");
    expect((await getUpload(ctx, uploadId))?.state).toBe("complete");
  });

  it("refuses a file of another size without sending anything", async () => {
    const { ctx, uploadId, pageUrl } = await serveSession(minified.render);
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(pageUrl);
      await page.setInputFiles("#file", { name: "other.mp4", mimeType: "video/mp4", buffer: Buffer.from("short") });
      await page.click("#start");
      await page.waitForFunction(() => (document.getElementById("status")?.textContent ?? "") !== "");
      expect(await page.textContent("#status")).toBe("This file has a different size than the upload expects.");
    } finally {
      await page.close();
    }
    expect(errors).toEqual([]);
    expect((await getUpload(ctx, uploadId))?.receivedBytes).toBe(0);
  });
});

/** Answers one request: the HTML page from `render`, every other request from the upload route. */
async function answer(
  ctx: FilesContext,
  render: RenderPage,
  uploadId: string,
  appOrigin: string,
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (typeof value === "string") headers.set(name, value);
  }
  const method = incoming.method ?? "GET";
  const request = new Request(new URL(incoming.url ?? "/", appOrigin), {
    method,
    headers,
    body: method === "PUT" ? Buffer.concat(chunks) : undefined,
  });
  let response: Response;
  if (method === "GET" && (incoming.headers.accept ?? "").includes("text/html")) {
    const status = await getUpload(ctx, uploadId);
    response = status === null ? new Response("gone", { status: 404 }) : render(ctx, status);
  } else {
    response = await serveUpload(ctx, request);
  }
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}
