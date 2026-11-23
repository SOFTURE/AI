import { describe, expect, it } from "vitest";
import { findApp, parseInventory } from "../inventory/index.js";
import { planSecrets } from "./github-step.js";

function planFor(edge: Record<string, unknown>) {
  const inventory = parseInventory(
    {
      server: { host: "srv.example.com", adminUser: "admin" },
      edge: { manage: false, ...edge },
      apps: [{ slug: "notes", repo: "acme/notes", host: "notes.example.com" }],
    },
    "inventory.yml",
  );
  return planSecrets({ inventory, app: findApp(inventory, "notes"), existing: new Set(), knownHosts: "", privateKey: undefined });
}

describe("planSecrets variables (issue #1429)", () => {
  it("sets EDGE_NETWORK to the inventory's edge network next to APP_HOST", () => {
    expect(planFor({ network: "web" }).variables).toEqual(new Map([["APP_HOST", "notes.example.com"], ["EDGE_NETWORK", "web"]]));
  });

  it("falls back to the edge's name when the inventory names no network", () => {
    expect(planFor({ name: "shared-edge" }).variables.get("EDGE_NETWORK")).toBe("shared-edge");
  });
});
