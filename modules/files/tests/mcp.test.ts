// The MCP upload tools: registered for writers only, create_upload answers a URL and a curl loop, finalize_upload
// stores the file and answers codes as sentences.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { buildCurlUploadScript, FILE_UPLOAD_MCP_TOOLS, registerFileUploadTools, type FileUploadToolsOptions } from "@softure-ai/files/mcp";
import { writeUploadChunk } from "@softure-ai/files/server";
import { afterEach, describe, expect, it } from "vitest";
import { ALICE, BOB, chunked, closeTestFiles, createTestFiles, type TestFiles } from "./support.js";

type Handler = (args: Record<string, unknown>) => Promise<CallToolResult>;

/** A server that keeps what was registered, so a test calls a tool's handler directly. */
function createRecordingServer() {
  const tools = new Map<string, { config: { annotations?: Record<string, unknown> }; handler: Handler }>();
  return {
    tools,
    registerTool(name: string, config: unknown, handler: unknown) {
      tools.set(name, { config: config as { annotations?: Record<string, unknown> }, handler: handler as Handler });
    },
  };
}

/** Calls a registered tool's handler; a missing tool fails the test. */
function call(tools: ReadonlyMap<string, { handler: Handler }>, name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const tool = tools.get(name);
  if (tool === undefined) throw new Error(`tool ${name} is not registered`);
  return tool.handler(args);
}

function readJson(result: CallToolResult): Record<string, unknown> {
  const [first] = result.content;
  if (first?.type !== "text") throw new Error("expected text");
  return JSON.parse(first.text) as Record<string, unknown>;
}

function readText(result: CallToolResult): string {
  const [first] = result.content;
  return first?.type === "text" ? first.text : "";
}

describe("the MCP upload tools", () => {
  let test: TestFiles;

  async function register(options: Partial<FileUploadToolsOptions> = {}) {
    test = await createTestFiles({ files: { uploads: { chunkBytes: 1024 } } });
    const server = createRecordingServer();
    registerFileUploadTools(server as never, { identity: { userId: ALICE, canWrite: true }, getContext: () => test.ctx, ...options });
    return server.tools;
  }

  afterEach(closeTestFiles);

  it("registers nothing for a read-only identity and lists both tools as writes in the catalog", async () => {
    const tools = await register({ identity: { userId: ALICE, canWrite: false } });
    expect(tools.size).toBe(0);
    expect(FILE_UPLOAD_MCP_TOOLS.map((tool) => [tool.name, tool.access])).toEqual([
      ["create_upload", "write"],
      ["finalize_upload", "write"],
    ]);
  });

  it("creates an upload, then finalizes it into the owner's file", async () => {
    const tools = await register({ kind: "input" });
    expect([...tools.keys()]).toEqual(["create_upload", "finalize_upload"]);
    const created = readJson(await call(tools, "create_upload", { name: "clip.mp4", size: 1500, content_type: "video/mp4" }));
    expect(created).toMatchObject({ chunk_size: 1024, chunk_count: 2, browser_page: created.upload_url });
    expect(created.curl).toContain(`URL='${String(created.upload_url)}'`);

    const uploadId = String(created.upload_id);
    const incomplete = await call(tools, "finalize_upload", { upload_id: uploadId });
    expect(incomplete.isError).toBe(true);
    expect(readText(incomplete)).toBe("The upload is not complete yet: some parts have not arrived. (files.upload_incomplete)");

    await writeUploadChunk(test.ctx, uploadId, { range: { start: 0, end: 1023 }, body: chunked("a".repeat(1024), 512) });
    await writeUploadChunk(test.ctx, uploadId, { range: { start: 1024, end: 1499 }, body: chunked("b".repeat(476), 512) });
    const finalized = readJson(await call(tools, "finalize_upload", { upload_id: uploadId }));
    expect(finalized).toMatchObject({ name: "clip.mp4", size: 1500, content_type: "video/mp4" });
    const rows = await test.database.client.query<{ owner_id: string; kind: string }>("SELECT owner_id, kind FROM files.files");
    expect(rows.rows).toEqual([{ owner_id: ALICE, kind: "input" }]);
  });

  it("finalizes only the identity's own uploads, and answers a thrown error with a fixed text", async () => {
    const tools = await register();
    const created = readJson(await call(tools, "create_upload", { name: "a", size: 10 }));
    const bob = createRecordingServer();
    registerFileUploadTools(bob as never, { identity: { userId: BOB, canWrite: true }, getContext: () => test.ctx });
    expect(readText(await call(bob.tools, "finalize_upload", { upload_id: created.upload_id }))).toContain("files.not_found");

    const failing = createRecordingServer();
    registerFileUploadTools(failing as never, { identity: { userId: ALICE, canWrite: true }, getContext: () => Promise.reject(new Error("db down: secret")) });
    const failed = await call(failing.tools, "create_upload", { name: "a", size: 10 });
    expect(failed).toEqual({ content: [{ type: "text", text: "Something went wrong. Try again." }], isError: true });
  });

  it("builds a curl loop that sends every chunk with its Content-Range", () => {
    const dir = mkdtempSync(join(tmpdir(), "softure-files-curl-"));
    try {
      const file = join(dir, "clip.bin");
      writeFileSync(file, "0123456789");
      const script = buildCurlUploadScript({ uploadUrl: "https://app.example.com/u/x/1.y", chunkSize: 4, chunkCount: 3 }, 10)
        .replace("FILE='path/to/the/file'", `FILE='${file}'`)
        // A stand-in for the upload: the range and the bytes each request would carry, so the loop runs offline.
        .replace(/curl -sS --fail -X PUT .* >\/dev\/null/, 'printf "%s=%s\\n" "bytes $start-$end/10" "$(cat)" >> "$LOG"')
        .replace(/\ncurl -sS "\$URL"$/, "");
      const log = join(dir, "log");
      execFileSync("bash", ["-c", script], { env: { ...process.env, LOG: log } });
      expect(execFileSync("cat", [log]).toString()).toBe("bytes 0-3/10=0123\nbytes 4-7/10=4567\nbytes 8-9/10=89\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
