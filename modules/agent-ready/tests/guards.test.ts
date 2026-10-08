// The guards an app runs in its own tests, each with the failure it exists to catch.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAgentSkillsIndex, buildApiCatalog, createAgentSkill } from "@softure-ai/agent-ready";
import {
  collectUrls,
  expectCardToolsMatchServer,
  expectCatalogTargetsExist,
  expectNoAccountData,
  expectOriginMatrix,
  expectSkillDigestsMatch,
  findAppRoute,
} from "@softure-ai/agent-ready/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { APEX, APP, createContext } from "./support.js";

let appDir = "";

function addRoute(path: string, file = "route.ts"): void {
  mkdirSync(join(appDir, path), { recursive: true });
  writeFileSync(join(appDir, path, file), "export {};\n");
}

beforeAll(() => {
  appDir = mkdtempSync(join(tmpdir(), "agent-ready-app-"));
  addRoute(".well-known/api-catalog");
  addRoute("openapi.json");
  addRoute("(marketing)", "page.tsx");
  addRoute(".well-known/agent-skills/[name]/SKILL.md");
  addRoute("(app)/api/mcp");
  addRoute("docs/[...slug]", "page.mdx");
  addRoute("help/[[...slug]]", "page.tsx");
});

afterAll(() => {
  rmSync(appDir, { recursive: true, force: true });
});

describe("findAppRoute", () => {
  it("finds dotted folders, route groups, dynamic and catch-all segments", () => {
    expect(findAppRoute(appDir, "/openapi.json")).toBe(join(appDir, "openapi.json"));
    expect(findAppRoute(appDir, "/")).toBe(join(appDir, "(marketing)"));
    expect(findAppRoute(appDir, "/api/mcp")).toBe(join(appDir, "(app)/api/mcp"));
    expect(findAppRoute(appDir, "/.well-known/agent-skills/notes/SKILL.md")).toBe(join(appDir, ".well-known/agent-skills/[name]/SKILL.md"));
    expect(findAppRoute(appDir, "/docs/a/b")).toBe(join(appDir, "docs/[...slug]"));
    expect(findAppRoute(appDir, "/help")).toBe(join(appDir, "help/[[...slug]]"));
  });

  it("finds nothing for a path without a route file", () => {
    expect(findAppRoute(appDir, "/.well-known/ai-catalog.json")).toBeNull();
    expect(findAppRoute(appDir, "/.well-known")).toBeNull();
    expect(findAppRoute(join(appDir, "missing"), "/")).toBeNull();
  });
});

describe("expectCatalogTargetsExist", () => {
  const catalog = buildApiCatalog(createContext());

  it("passes when every URL on the app's hosts has a route", () => {
    expect(() =>
      expectCatalogTargetsExist({ appDir, documents: [catalog], origins: [APP, APEX], servedElsewhere: ["/.well-known/mcp/server-card.json"] }),
    ).not.toThrow();
  });

  it("lists every URL without a route", () => {
    expect(() => expectCatalogTargetsExist({ appDir, documents: [catalog], origins: [APP, APEX] })).toThrow(
      `agent-ready: documents name URLs the app has no route for:\n- ${APEX}/.well-known/mcp/server-card.json`,
    );
  });

  it("ignores hosts the app does not serve", () => {
    expect(() => expectCatalogTargetsExist({ appDir, documents: [{ a: "https://other.example.org/x" }], origins: [APP] })).not.toThrow();
  });
});

describe("expectSkillDigestsMatch", () => {
  const skill = createAgentSkill("notes", "Notes.", "\nBody\n");
  const index = buildAgentSkillsIndex([skill]);

  it("passes when the files are the indexed bytes", async () => {
    await expect(expectSkillDigestsMatch(index, () => skill.markdown)).resolves.toBeUndefined();
  });

  it("fails on one changed byte", async () => {
    await expect(expectSkillDigestsMatch(index, () => `${skill.markdown} `)).rejects.toThrow("agent-ready: skill digests do not match their files:\n- notes: index sha256:");
  });
});

describe("expectCardToolsMatchServer", () => {
  const server = { protocolVersion: "x", serverInfo: { name: "x", version: "1" }, capabilities: {}, tools: [{ name: "a" }, { name: "b" }] };

  it("passes for the same tools in any order, on either card", () => {
    expect(() => expectCardToolsMatchServer({ tools: [{ name: "b" }, { name: "a" }] }, server)).not.toThrow();
    expect(() => expectCardToolsMatchServer({ skills: [{ id: "a" }, { id: "b" }] }, server)).not.toThrow();
  });

  it("names tools the card has too many and too few", () => {
    expect(() => expectCardToolsMatchServer({ tools: [{ name: "a" }, { name: "c" }] }, server)).toThrow(
      "agent-ready: the card and the server disagree: not on the server [c], missing from the card [b]",
    );
  });
});

describe("expectNoAccountData", () => {
  it("passes a clean document and catches an account value in a nested field or a string", () => {
    expect(() => expectNoAccountData({ a: { b: "public" } }, ["user-1", ""])).not.toThrow();
    expect(() => expectNoAccountData({ a: ["x", { email: "person@example.com" }] }, ["person@example.com"])).toThrow(
      'agent-ready: a public document contains account data: "person@example.com"',
    );
    expect(() => expectNoAccountData("token sftmcp_abc", ["sftmcp_"])).toThrow('"sftmcp_"');
  });
});

describe("expectOriginMatrix", () => {
  it("passes URLs on the app, the apex and allowed hosts, and lists any other", () => {
    expect(() => expectOriginMatrix({ a: `${APP}/x`, b: [`${APEX}/y`], c: "https://schemas.example.org/s" }, { appOrigin: APP, apexOrigin: APEX, external: ["https://schemas.example.org"] })).not.toThrow();
    expect(() => expectOriginMatrix({ a: "http://0.0.0.0:3000/api/mcp" }, { appOrigin: APP, apexOrigin: APEX })).toThrow(
      "agent-ready: a document names hosts the app does not serve:\n- http://0.0.0.0:3000/api/mcp",
    );
  });

  it("collects URLs depth first and skips other strings", () => {
    expect(collectUrls({ a: ["https://a.example/1", { b: "not a url", c: "http://b.example" }], d: 3 })).toEqual(["https://a.example/1", "http://b.example"]);
  });
});
