// The module definition: its manifest and its options.
import { readFileSync } from "node:fs";
import { toModuleJson } from "@softure-ai/core";
import { agentReady, getDefaultMcpSkillName } from "@softure-ai/agent-ready";
import { describe, expect, it } from "vitest";
import { BASE_OPTIONS } from "./support.js";

describe("the agent-ready module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(agentReady));
  });

  it("keeps the package version and the manifest version in step", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(agentReady.manifest.version).toBe(pkg.version);
  });

  it("fills in the defaults", () => {
    const { options } = agentReady(BASE_OPTIONS);
    expect(options.mcp.path).toBe("/api/mcp");
    expect(options.scopes).toEqual({ read: "mcp:read", write: "mcp:write" });
    expect(options.serviceDoc).toEqual({ path: "/" });
    expect(options.openapi).toEqual({ version: "1.0.0" });
    expect(options.apiCatalog).toEqual({});
    expect(options.skills).toEqual([]);
    expect(options.mcpSkill).toEqual({});
    expect(options.catalog).toEqual({ queries: {} });
    expect(options.a2a).toEqual({ enabled: true });
    expect(options.webBotAuth).toEqual({ privateKeyEnv: "WEB_BOT_AUTH_PRIVATE_KEY", retiredKeysEnv: "WEB_BOT_AUTH_RETIRED_PUBLIC_KEYS" });
    expect(options.dnsAid.records.map((record) => `${record.label}->${record.target}`)).toEqual(["_index->apex", "_mcp->app"]);
    expect(options.markdown).toBe(false);
    expect(options.oauth).toBeUndefined();
  });

  it("reduces configured origins to bare origins", () => {
    const { options } = agentReady({ ...BASE_OPTIONS, appOrigin: "https://App.Example.com/", apexOrigin: "https://example.com" });
    expect(options.appOrigin).toBe("https://app.example.com");
    expect(options.apexOrigin).toBe("https://example.com");
  });

  it("refuses options it cannot run with, listing every problem", () => {
    expect(() =>
      agentReady({
        ...BASE_OPTIONS,
        name: "no-namespace",
        appOrigin: "https://example.com/app",
        mcp: { path: "api/mcp", server: () => null },
        skills: [{ name: "Bad Name", description: "x", body: () => "" }],
        catalog: { queries: { mcp: ["only one"] } },
        dnsAid: { records: [{ label: "mcp", target: "apex" }] },
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "agent-ready":',
        "- options.appOrigin: must be an http(s) origin without a path, e.g. https://example.com",
        "- options.name: must be a reverse-DNS namespace and a name, e.g. com.example/app",
        "- options.mcp.path: must be a path starting with a single /",
        "- options.skills.0.name: must be lower-case letters, digits and single hyphens, at most 64 characters",
        "- options.catalog.queries.mcp: Too small: expected array to have >=2 items",
        "- options.dnsAid.records.0.label: must be a DNS label starting with _, e.g. _mcp",
      ].join("\n"),
    );
  });

  it("refuses a skill listed twice, also against the generated MCP skill", () => {
    const skill = { name: "notes", description: "Notes.", body: () => "" };
    expect(() => agentReady({ ...BASE_OPTIONS, skills: [skill, skill] })).toThrow('- options.skills: skill "notes" is listed twice');
    expect(() => agentReady({ ...BASE_OPTIONS, skills: [{ ...skill, name: "app-mcp" }] })).toThrow('- options.skills: skill "app-mcp" is listed twice');
    expect(() => agentReady({ ...BASE_OPTIONS, mcpSkill: false, skills: [{ ...skill, name: "app-mcp" }] })).not.toThrow();
  });

  it("refuses a DNS label listed twice", () => {
    expect(() =>
      agentReady({ ...BASE_OPTIONS, dnsAid: { records: [{ label: "_mcp", target: "app" }, { label: "_mcp", target: "apex" }] } }),
    ).toThrow('- options.dnsAid.records: label "_mcp" is listed twice');
  });

  it("refuses an MCP server that is not a function", () => {
    // @ts-expect-error: a JavaScript config could pass the server itself.
    expect(() => agentReady({ ...BASE_OPTIONS, mcp: { server: {} } })).toThrow("- options.mcp.server: must be a function () => McpServer | Promise<McpServer>");
  });

  it("names the generated MCP skill after the card name, always a valid skill name", () => {
    expect(getDefaultMcpSkillName("com.example/My_App")).toBe("my-app-mcp");
    expect(getDefaultMcpSkillName("com.example/___")).toBe("app-mcp");
    expect(getDefaultMcpSkillName(`com.example/${"a".repeat(59)}_b`)).toBe(`${"a".repeat(59)}-mcp`);
    expect(() => agentReady({ ...BASE_OPTIONS, name: `com.example/${"a".repeat(59)}_b` })).not.toThrow();
  });

  it("refuses catalog queries for an entry that does not exist", () => {
    expect(() => agentReady({ ...BASE_OPTIONS, catalog: { queries: { mpc: ["a", "b"] } } })).toThrow(
      "- options.catalog.queries.mpc: is not an AI catalog entry: mcp, a2a, api-catalog or a skill name",
    );
    expect(() => agentReady({ ...BASE_OPTIONS, catalog: { queries: { "app-mcp": ["a", "b"], "api-catalog": ["a", "b"] } } })).not.toThrow();
  });
});
