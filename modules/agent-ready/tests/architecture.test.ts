// Import boundaries: the root entry loads in next.config.ts and proxy.ts, the WebMCP entry in the browser, and the
// server entry outside Next. Each may only import what its place allows.
import { join } from "node:path";
import { readImports, readSourceFiles } from "@softure-ai/testing/guards";
import { describe, expect, it } from "vitest";

const files = readSourceFiles(join(import.meta.dirname, "../src")).map(({ file, source }) => ({ file, imports: readImports(source) }));
const rootFiles = files.filter(({ file }) => !/^(server|next|cli|testing|webmcp)\//.test(file));

describe("import boundaries", () => {
  it("has files to check", () => {
    expect(rootFiles.length).toBeGreaterThan(10);
  });

  it("keeps the root entry free of Next, the MCP SDK and the server and Next adapters", () => {
    for (const { file, imports } of rootFiles) {
      const forbidden = imports.filter((name) => /^next(\/|$)|@softure-ai\/core\/next|@modelcontextprotocol\/|(^|\/)(server|next)\//.test(name));
      expect(forbidden, file).toEqual([]);
    }
  });

  it("keeps the WebMCP entry free of every import", () => {
    for (const { file, imports } of files.filter(({ file }) => file.startsWith("webmcp/"))) expect(imports, file).toEqual([]);
  });

  it("keeps the Link header importable without path aliases", () => {
    expect(files.find(({ file }) => file === "link-header.ts")?.imports).toEqual([]);
  });

  it("keeps server code free of Next", () => {
    for (const { file, imports } of files.filter(({ file }) => file.startsWith("server/"))) {
      expect(imports.filter((name) => /^next(\/|$)|core\/next/.test(name)), file).toEqual([]);
    }
  });
});
