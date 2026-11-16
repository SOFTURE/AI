import { describe, expect, it } from "vitest";

import { classifyImport, listValueImports } from "./workers-entries.js";

describe("listValueImports", () => {
  it("keeps value imports, re-exports, side-effect and dynamic imports", () => {
    const source = [
      'import { a } from "./a.js";',
      'import def from "./b.js";',
      'import * as all from "./c.js";',
      'import "./d.js";',
      'export { e } from "./e.js";',
      'export * from "./f.js";',
      'import { type T, value } from "./g.js";',
      'const lazy = () => import("node:fs");',
    ].join("\n");
    expect(listValueImports("x.ts", source)).toEqual(["./a.js", "./b.js", "./c.js", "./d.js", "./e.js", "./f.js", "./g.js", "node:fs"]);
  });

  it("skips type-only imports and re-exports", () => {
    const source = [
      'import type { A } from "node:fs";',
      'import { type B, type C } from "node:net";',
      'export type { D } from "node:os";',
      'export { type E } from "node:http";',
    ].join("\n");
    expect(listValueImports("x.ts", source)).toEqual([]);
  });
});

describe("classifyImport", () => {
  it.each([
    ["node:crypto", { kind: "builtin", name: "crypto", isAllowed: true }],
    ["node:fs", { kind: "builtin", name: "fs", isAllowed: true }],
    ["fs/promises", { kind: "builtin", name: "fs/promises", isAllowed: true }],
    ["node:child_process", { kind: "builtin", name: "child_process", isAllowed: false }],
    ["node:net", { kind: "builtin", name: "net", isAllowed: true }],
    ["node:http", { kind: "builtin", name: "http", isAllowed: true }],
    ["node:os", { kind: "builtin", name: "os", isAllowed: false }],
    ["./x.js", { kind: "relative" }],
    ["@softure-ai/core", { kind: "softure", packageName: "@softure-ai/core", exportKey: "." }],
    ["@softure-ai/db/testing", { kind: "softure", packageName: "@softure-ai/db", exportKey: "./testing" }],
    ["zod", { kind: "package", packageName: "zod", isAllowed: true }],
    ["@opentelemetry/sdk-node", { kind: "package", packageName: "@opentelemetry/sdk-node", isAllowed: false }],
  ])("%s", (specifier, expected) => {
    expect(classifyImport(specifier)).toEqual(expected);
  });
});
