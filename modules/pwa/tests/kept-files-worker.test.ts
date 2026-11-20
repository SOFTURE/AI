// The worker's kept files (MR-344 of an adopting app, #1255): same-origin files the page keeps are answered from their
// cache first, even under an excluded prefix; one not kept goes to the network and is not stored; the cache survives a
// new build's activate and is left alone by clear-pages.
import { resolveServiceWorkerConfig, serviceWorker, type ServiceWorkerOptions } from "@softure-ai/pwa/worker";
import { describe, expect, it } from "vitest";

import { answer, FakeWorkerScope, ORIGIN } from "@softure-ai/pwa/testing";

const OPTIONS: ServiceWorkerOptions = {
  app: "trip",
  offlinePath: "/offline",
  navigationTimeoutMs: 20,
  keptFiles: { cache: "documents", pathPrefixes: ["/api/documents/"] },
};

async function installWorker(options: Partial<ServiceWorkerOptions> = {}, build = "b1"): Promise<FakeWorkerScope> {
  const scope = new FakeWorkerScope();
  serviceWorker(scope.asScope(), resolveServiceWorkerConfig({ ...OPTIONS, ...options }, build));
  scope.route("/offline", answer("<html>offline</html>"));
  await scope.dispatchLifecycle("install");
  return scope;
}

async function keep(scope: FakeWorkerScope, path: string, body: string): Promise<void> {
  await (await scope.caches.open("trip-documents")).put(`${ORIGIN}${path}`, answer(body, { contentType: "application/pdf" }));
}

async function fetchText(scope: FakeWorkerScope, path: string): Promise<string | null> {
  const dispatched = scope.dispatchFetch(new Request(`${ORIGIN}${path}`));
  if (dispatched.response === null) return null;
  return (await dispatched.response).text();
}

describe("the service worker's kept files (MR-344)", () => {
  it("MR-344 answers a kept file from its cache without the network, under the excluded /api/ prefix", async () => {
    const scope = await installWorker();
    await keep(scope, "/api/documents/d1", "%PDF kept");
    scope.fetched.length = 0;

    expect(await fetchText(scope, "/api/documents/d1")).toBe("%PDF kept");
    expect(scope.fetched).toEqual([]);
  });

  it("MR-344 answers the kept copy even when the network has a newer one (the page replaces it on its next sync)", async () => {
    const scope = await installWorker();
    await keep(scope, "/api/documents/d1", "old");
    scope.route("/api/documents/d1", answer("new"));

    expect(await fetchText(scope, "/api/documents/d1")).toBe("old");
  });

  it("MR-344 sends a file that is not kept to the network and never stores it", async () => {
    const scope = await installWorker();
    scope.route("/api/documents/d2", answer("%PDF fresh", { contentType: "application/pdf" }));

    expect(await fetchText(scope, "/api/documents/d2")).toBe("%PDF fresh");
    expect(scope.caches.get("trip-documents").getPaths()).toEqual([]);
  });

  it("MR-344 lets a file that is not kept fail as the network fails, offline", async () => {
    const scope = await installWorker();
    const dispatched = scope.dispatchFetch(new Request(`${ORIGIN}/api/documents/missing`));

    await expect(dispatched.response).rejects.toThrow("Failed to fetch");
  });

  it("MR-344 matches the prefix on whole segments and leaves other /api/ paths to the browser", async () => {
    const scope = await installWorker();
    await keep(scope, "/api/documents-other/x", "never served");

    expect(scope.dispatchFetch(new Request(`${ORIGIN}/api/documents-other/x`)).response).toBeNull();
    expect(scope.dispatchFetch(new Request(`${ORIGIN}/api/plan`)).response).toBeNull();
  });

  it("MR-344 leaves a POST to a kept path to the browser", async () => {
    const scope = await installWorker();
    expect(scope.dispatchFetch(new Request(`${ORIGIN}/api/documents/d1`, { method: "POST", body: "x" })).response).toBeNull();
  });

  it("MR-344 keeps the cache through a new build's activate", async () => {
    const scope = await installWorker({}, "b1");
    await keep(scope, "/api/documents/d1", "%PDF kept");
    await scope.dispatchLifecycle("activate");
    serviceWorker(scope.asScope(), resolveServiceWorkerConfig(OPTIONS, "b2"));
    await scope.dispatchLifecycle("install");
    await scope.dispatchLifecycle("activate");

    expect(await scope.caches.has("trip-documents")).toBe(true);
    expect(await scope.caches.has("trip-shell-b1")).toBe(false);
    expect(await fetchText(scope, "/api/documents/d1")).toBe("%PDF kept");
  });

  it("MR-344 keeps the cache on clear-pages (sign-out deletes it through registerDeviceData)", async () => {
    const scope = await installWorker();
    await keep(scope, "/api/documents/d1", "%PDF kept");
    await scope.dispatchMessage({ type: "clear-pages" });

    expect(scope.caches.get("trip-documents").getPaths()).toEqual(["/api/documents/d1"]);
  });

  it("MR-344 serves nothing from a kept-files cache without the option", async () => {
    const scope = await installWorker({ keptFiles: undefined });
    await keep(scope, "/api/documents/d1", "%PDF kept");

    expect(scope.dispatchFetch(new Request(`${ORIGIN}/api/documents/d1`)).response).toBeNull();
  });
});

describe("resolveServiceWorkerConfig's kept files (MR-344)", () => {
  it("MR-344 copies the cache and the prefixes", () => {
    expect(resolveServiceWorkerConfig(OPTIONS, "b1").keptFiles).toEqual({ cache: "documents", pathPrefixes: ["/api/documents/"] });
  });

  it.each([
    [{ cache: "Docs", pathPrefixes: ["/api/d/"] }, 'kept files cache "Docs" must be lowercase letters, digits and dashes'],
    [{ cache: "pages-docs", pathPrefixes: ["/api/d/"] }, 'kept files cache "pages-docs" must not start with "shell" or "pages"'],
    [{ cache: "shell", pathPrefixes: ["/api/d/"] }, 'kept files cache "shell" must not start with "shell" or "pages"'],
    [{ cache: "docs", pathPrefixes: [] }, "keptFiles.pathPrefixes must name at least one path"],
    [{ cache: "docs", pathPrefixes: ["api/d/"] }, 'kept files path prefix "api/d/" must start with / and name a folder'],
    [{ cache: "docs", pathPrefixes: ["/"] }, 'kept files path prefix "/" must start with / and name a folder'],
  ])("MR-344 refuses %j", (keptFiles, message) => {
    expect(() => resolveServiceWorkerConfig({ ...OPTIONS, keptFiles }, "b1")).toThrow(`resolveServiceWorkerConfig: ${message}`);
  });

  it("MR-344 refuses a cache an extra origin already uses", () => {
    expect(() =>
      resolveServiceWorkerConfig({ ...OPTIONS, extraOrigins: [{ origin: "https://tiles.example.com", cache: "documents" }] }, "b1"),
    ).toThrow('resolveServiceWorkerConfig: kept files cache "documents" is already an extra origin\'s cache');
  });
});
