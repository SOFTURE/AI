// The upload page's inline script, run outside a browser: the HTML of the minified module (as an app's production
// build ships it) and of the source, its script evaluated in a fresh `vm` context with a stand-in DOM, the upload
// route behind `fetch`. It runs without Chromium, so the page's script is checked on every machine.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { createUpload, getUpload, serveUpload, type FilesContext } from "@softure-ai/files/server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { renderUploadPage as renderSourcePage } from "../src/server/upload-page.js";
import { bundleMinifiedPage, type RenderPage } from "./minified-page.js";
import { ALICE, closeTestFiles, createTestFiles } from "./support.js";

const CHUNK = 1024;
const CONTENT = "a".repeat(CHUNK) + "b".repeat(CHUNK / 2);

type ElementId = "upload-config" | "file" | "start" | "bar" | "status";

interface FakeElement {
  textContent: string;
  value: number;
  disabled: boolean;
  files: Blob[];
  listeners: Map<string, () => Promise<void>>;
  addEventListener(type: string, listener: () => Promise<void>): void;
}

function createElement(textContent = ""): FakeElement {
  return {
    textContent,
    value: 0,
    disabled: false,
    files: [],
    listeners: new Map(),
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    },
  };
}

/** The two inline scripts of the page: its JSON config and its code. */
function readScripts(html: string): { config: string; code: string } {
  const config = /<script id="upload-config" type="application\/json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  const code = /<script nonce="[^"]+">([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (config === undefined || code === undefined) throw new Error("the page has no upload script");
  return { config, code };
}

describe("the upload page script", () => {
  let outdir: string;
  let minified: RenderPage;

  beforeAll(async () => {
    outdir = await mkdtemp(join(tmpdir(), "files-upload-script-"));
    minified = (await bundleMinifiedPage(outdir)).render;
  });

  afterAll(async () => {
    await rm(outdir, { recursive: true, force: true });
  });

  afterEach(closeTestFiles);

  /** Renders the page with `render`, runs its script against `file`, clicks Upload and waits for the send. */
  async function runPage(render: RenderPage, file: Blob): Promise<{ ctx: FilesContext; uploadId: string; elements: Record<ElementId, FakeElement>; requests: string[] }> {
    const test = await createTestFiles({ files: { uploads: { chunkBytes: CHUNK } } });
    const created = await createUpload(test.ctx, { ownerId: ALICE, name: "clip.mp4", contentType: "video/mp4", size: CONTENT.length });
    if (!created.ok) throw new Error(`setup: ${created.error}`);
    const { uploadId, uploadUrl } = created.value;
    const status = await getUpload(test.ctx, uploadId);
    if (status === null) throw new Error("setup: no upload status");
    const { config, code } = readScripts(await render(test.ctx, status).text());

    const elements: Record<ElementId, FakeElement> = {
      "upload-config": createElement(config),
      file: createElement(),
      start: createElement(),
      bar: createElement(),
      status: createElement(),
    };
    elements.file.files = [file];
    const requests: string[] = [];
    const fetchUpload = async (url: string, init: RequestInit): Promise<Response> => {
      requests.push(`${init.method ?? "GET"} ${(init.headers as Record<string, string> | undefined)?.["content-range"] ?? ""}`.trim());
      return serveUpload(test.ctx, new Request(url, init));
    };
    runInNewContext(code, {
      document: { getElementById: (id: string) => (Object.hasOwn(elements, id) ? elements[id as ElementId] : null) },
      location: { href: uploadUrl },
      fetch: fetchUpload,
    });
    const click = elements.start.listeners.get("click");
    if (click === undefined) throw new Error("the page wired no click handler");
    await click();
    return { ctx: test.ctx, uploadId, elements, requests };
  }

  it.each([
    ["minified", () => minified],
    ["source", () => renderSourcePage],
  ])("sends the missing chunks from the %s page and shows the done copy", async (_name, getRender) => {
    const { ctx, uploadId, elements, requests } = await runPage(getRender(), new Blob([CONTENT]));
    expect(elements.status.textContent).toBe("Upload complete. Go back to where you started it to finish.");
    expect(elements.bar.value).toBe(1);
    expect(elements.start.disabled).toBe(true);
    expect(requests).toEqual(["HEAD", `PUT bytes 0-1023/${String(CONTENT.length)}`, `PUT bytes 1024-1535/${String(CONTENT.length)}`]);
    const status = await getUpload(ctx, uploadId);
    expect(status?.state).toBe("complete");
    expect(status?.receivedBytes).toBe(CONTENT.length);
  });

  it("binds the inlined client to its own name, whatever the minifier called the function", async () => {
    const test = await createTestFiles({ files: { uploads: { chunkBytes: CHUNK } } });
    const created = await createUpload(test.ctx, { ownerId: ALICE, name: "clip.mp4", contentType: "video/mp4", size: CONTENT.length });
    if (!created.ok) throw new Error(`setup: ${created.error}`);
    const status = await getUpload(test.ctx, created.value.uploadId);
    if (status === null) throw new Error("setup: no upload status");
    const { code } = readScripts(await minified(test.ctx, status).text());
    expect(code.startsWith("const sendUpload = (async function ")).toBe(true);
    expect(code).not.toMatch(/^const sendUpload = \(async function sendUpload\(/);
  });

  it("refuses a file of another size before sending anything", async () => {
    const { ctx, uploadId, elements, requests } = await runPage(minified, new Blob(["short"]));
    expect(elements.status.textContent).toBe("This file has a different size than the upload expects.");
    expect(elements.start.disabled).toBe(false);
    expect(requests).toEqual([]);
    expect((await getUpload(ctx, uploadId))?.receivedBytes).toBe(0);
  });
});
