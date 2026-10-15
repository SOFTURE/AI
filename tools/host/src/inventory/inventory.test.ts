import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CliFailure } from "../cli/failure.js";
import { findApp, loadInventory, parseInventory } from "./index.js";

const MINIMAL = { server: { host: "203.0.113.10", adminUser: "admin" }, edge: { acmeEmail: "ops@example.com" } };

describe("parseInventory", () => {
  it("fills the generic defaults of the shared names", () => {
    const inventory = parseInventory(MINIMAL, "test");
    expect(inventory.server).toEqual({ host: "203.0.113.10", port: 22, adminUser: "admin", deployUser: "deploy", timezone: "UTC" });
    expect(inventory.edge).toEqual({
      name: "softure-edge",
      network: "softure-edge",
      certResolver: "letsencrypt",
      manage: true,
      acmeEmail: "ops@example.com",
      cdn: "none",
    });
    expect(inventory.firewall).toEqual({ name: "softure-cloudflare-only", manage: false, rangesFile: "/srv/softure-edge/cloudflare-ips.txt" });
    expect(inventory.apps).toEqual([]);
  });

  it("manages the origin firewall by default for a managed edge behind Cloudflare", () => {
    const inventory = parseInventory({ ...MINIMAL, edge: { ...MINIMAL.edge, cdn: "cloudflare", name: "edge-a" } }, "test");
    expect(inventory.firewall).toEqual({ name: "softure-cloudflare-only", manage: true, rangesFile: "/srv/edge-a/cloudflare-ips.txt" });
  });

  it("takes an edge managed elsewhere as it is, without an ACME address and without a firewall", () => {
    const inventory = parseInventory(
      { server: MINIMAL.server, edge: { manage: false, network: "first-app-edge", certResolver: "le", cdn: "cloudflare" } },
      "test",
    );
    expect(inventory.edge).toMatchObject({ manage: false, network: "first-app-edge", certResolver: "le" });
    expect(inventory.firewall.manage).toBe(false);
  });

  it("applies the defaults of an app", () => {
    const inventory = parseInventory({ ...MINIMAL, apps: [{ slug: "notes", repo: "acme/notes", host: "notes.example.com" }] }, "test");
    expect(inventory.apps[0]).toEqual({
      slug: "notes",
      repo: "acme/notes",
      host: "notes.example.com",
      database: false,
      access: { enabled: false, bypassPaths: [], emails: [] },
    });
  });

  it("lists every problem with its path", () => {
    const parse = () =>
      parseInventory(
        {
          server: { host: "a b", adminUser: "admin" },
          edge: {},
          apps: [
            { slug: "Notes", repo: "notes", host: "notes.example.com" },
            { slug: "x", repo: "a/x", host: "x.example.com", access: { enabled: true } },
          ],
          extra: true,
        },
        "inv.yml",
      );
    expect(parse).toThrow(CliFailure);
    const message = (() => {
      try {
        parse();
        return "";
      } catch (error) {
        return (error as Error).message;
      }
    })();
    expect(message).toContain("inventory inv.yml is not valid:");
    expect(message).toContain("server.host: a host name or IP address");
    expect(message).toContain("apps.0.slug: lower-case letters, digits and dashes, starting with a letter");
    expect(message).toContain("apps.0.repo: owner/name");
    expect(message).toContain("apps.1.access.emails: access.enabled needs at least one address in access.emails");
    expect(message).toContain('(root): Unrecognized key: "extra"');
  });

  it("refuses a managed edge without an ACME address, and a slug listed twice", () => {
    const app = { slug: "notes", repo: "acme/notes", host: "notes.example.com" };
    expect(() => parseInventory({ server: MINIMAL.server, apps: [app, app] }, "test")).toThrow(
      /edge\.acmeEmail: edge\.manage needs edge\.acmeEmail[\s\S]*apps\.1\.slug: notes is listed twice/,
    );
  });
});

describe("loadInventory and findApp", () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  function writeInventory(text: string): string {
    const dir = mkdtempSync(join(tmpdir(), "softure-host-inventory-"));
    dirs.push(dir);
    const path = join(dir, "inventory.yml");
    writeFileSync(path, text);
    return path;
  }

  it("reads YAML and finds an app by slug", async () => {
    const path = writeInventory(
      "server:\n  host: srv.example.com\n  adminUser: admin\nedge:\n  acmeEmail: ops@example.com\napps:\n  - slug: notes\n    repo: acme/notes\n    host: notes.example.com\n",
    );
    const inventory = await loadInventory(path);
    expect(findApp(inventory, "notes").repo).toBe("acme/notes");
    expect(() => findApp(inventory, "blog")).toThrow('the inventory has no app "blog" (apps: notes)');
  });

  it("refuses a missing file and a file that is not YAML, with exit code 2", async () => {
    await expect(loadInventory("/nonexistent/inventory.yml")).rejects.toMatchObject({ exitCode: 2 });
    await expect(loadInventory(writeInventory("server: [unclosed"))).rejects.toThrow(/is not YAML/);
  });
});
