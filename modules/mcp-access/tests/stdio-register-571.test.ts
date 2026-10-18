import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const register = join(import.meta.dirname, "../src/stdio/register.ts");
const SERVER_ONLY_ERROR = "This module cannot be imported from a Client Component module.";

// A copy of the published `server-only@0.0.1` shape: only "." is exported, `react-server` gets the empty file.
const writePackage = (root: string, name: string, files: Record<string, string>) => {
  const dir = join(root, "node_modules", name);
  mkdirSync(dir, { recursive: true });
  for (const [file, content] of Object.entries(files)) writeFileSync(join(dir, file), content);
};

describe("stdio/register with server-only installed (issue #571)", () => {
  let root = "";

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "mcp-register-571-"));
    writePackage(root, "server-only", {
      "package.json": JSON.stringify({ name: "server-only", version: "0.0.1", main: "index.js", exports: { ".": { "react-server": "./empty.js", default: "./index.js" } } }),
      "index.js": `throw new Error(${JSON.stringify(SERVER_ONLY_ERROR)});\n`,
      "empty.js": "",
    });
    writePackage(root, "plain-dependency", { "package.json": JSON.stringify({ name: "plain-dependency", main: "index.js" }), "index.js": "module.exports = 'plain';\n" });
    writeFileSync(join(root, "require.cjs"), "require('server-only'); console.log('loaded');\n");
    writeFileSync(join(root, "import.mjs"), "import 'server-only'; console.log('loaded');\n");
    writeFileSync(join(root, "other.cjs"), "console.log(require('plain-dependency'));\n");
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const run = (file: string, args: string[] = ["--import", register]) => spawnSync(process.execPath, [...args, join(root, file)], { encoding: "utf8", cwd: root });

  it("lets a CommonJS require of server-only load", () => {
    expect(run("require.cjs")).toMatchObject({ status: 0, stdout: "loaded\n" });
  });

  it("lets an ES import of server-only load", () => {
    expect(run("import.mjs")).toMatchObject({ status: 0, stdout: "loaded\n" });
  });

  it("fails without the hook, so the fixture is the real marker package", () => {
    const result = run("require.cjs", []);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(SERVER_ONLY_ERROR);
  });

  it("resolves every other package as usual", () => {
    expect(run("other.cjs")).toMatchObject({ status: 0, stdout: "plain\n" });
  });
});
