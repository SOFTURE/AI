// Import boundaries: the root entry loads in next.config.ts and proxy.ts, the WebMCP entry in the browser, and the
// server entry outside Next. Each may only import what its place allows.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "../src");

function listSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listSources(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

function readImports(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(/^(?:import|export)[^;]*?from\s+"([^"]+)"/gms)].map((match) => match[1] ?? "");
}

const files = listSources(SRC).map((file) => ({ file: relative(SRC, file), imports: readImports(file) }));
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
