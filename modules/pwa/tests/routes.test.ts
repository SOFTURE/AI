import { createIconRoute, createManifestRoute, createServiceWorkerRoute, createVersionRoute } from "@softure-ai/pwa/next";
import { Wallet } from "lucide";
import { describe, expect, it } from "vitest";

import { THEME } from "./support/theme.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

function readPngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe("the manifest route", () => {
  it("serves the manifest as application/manifest+json", async () => {
    const GET = createManifestRoute({ theme: THEME, copy: { name: "Fire Tracker", shortName: "Fire", description: "FIRE" }, lang: "en" });
    const response = GET();

    expect(response.headers.get("content-type")).toBe("application/manifest+json; charset=utf-8");
    expect(await response.json()).toMatchObject({ name: "Fire Tracker", short_name: "Fire", background_color: "#fefefe" });
  });
});

describe("the icon route", () => {
  const route = createIconRoute({ theme: THEME, icon: Wallet });

  it("lists every registry name for the build", () => {
    expect(route.generateStaticParams()).toEqual([
      { name: "icon-32.png" },
      { name: "apple-icon-180.png" },
      { name: "icon-192.png" },
      { name: "icon-512.png" },
      { name: "icon-maskable-512.png" },
    ]);
  });

  it.each([
    { name: "icon-32.png", size: 32 },
    { name: "apple-icon-180.png", size: 180 },
    { name: "icon-maskable-512.png", size: 512 },
  ])("draws $name as a $size px PNG", async ({ name, size }) => {
    const response = await route.GET(new Request(`https://app.example.com/pwa/icons/${name}`), { params: Promise.resolve({ name }) });
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect([...bytes.slice(0, 4)]).toEqual(PNG_SIGNATURE);
    expect(readPngSize(bytes)).toEqual({ width: size, height: size });
  });

  it("answers 404 for a name outside the registry", async () => {
    const response = await route.GET(new Request("https://app.example.com/pwa/icons/icon-64.png"), {
      params: Promise.resolve({ name: "icon-64.png" }),
    });

    expect(response.status).toBe(404);
  });
});

describe("the version route", () => {
  it("serves the build version, never cached", async () => {
    const response = createVersionRoute()();

    expect(response.headers.get("cache-control")).toBe("no-store");
    // The repository root has no Next build.
    expect(await response.json()).toEqual({ version: "dev" });
  });
});

describe("the service worker route", () => {
  it("serves the worker for this build with the headers a root worker needs", async () => {
    const response = createServiceWorkerRoute({ app: "fire", offlinePath: "/offline" })();
    const source = await response.text();

    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("service-worker-allowed")).toBe("/");
    expect(source).toContain("// fire service worker, build dev (@softure-ai/pwa)");
    expect(source).toContain('"offlinePath":"/offline"');
  });

  it("fails on options it cannot serve, when the route is created", () => {
    expect(() => createServiceWorkerRoute({ app: "Fire App", offlinePath: "/offline" })).toThrow("app \"Fire App\" must be lowercase");
  });
});
