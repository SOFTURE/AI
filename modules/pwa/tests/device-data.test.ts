import { clearDeviceData, registerDeviceData, type DeviceDataDependencies } from "@softure-ai/pwa";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FakeIndexedDb } from "./support/fake-indexed-db.js";

const unregisters: (() => void)[] = [];

afterEach(() => {
  for (const unregister of unregisters.splice(0)) unregister();
});

function register(...args: Parameters<typeof registerDeviceData>): void {
  unregisters.push(registerDeviceData(...args));
}

function fakeCaches(names: string[] = []) {
  const kept = new Set(names);
  return { kept, delete: vi.fn((name: string) => Promise.resolve(kept.delete(name))) };
}

function fakeStorage(entries: Record<string, string> = {}) {
  const kept = new Map(Object.entries(entries));
  return {
    kept,
    removeItem: vi.fn((key: string) => {
      kept.delete(key);
    }),
  };
}

function fakeServiceWorker() {
  return { controller: { postMessage: vi.fn() } };
}

/** Every API present: caches, IndexedDB, storage and a controlling worker. */
function devices(overrides: Partial<DeviceDataDependencies> = {}) {
  const caches = fakeCaches(["fire-maps", "other"]);
  const indexedDB = new FakeIndexedDb();
  const storage = fakeStorage({ draft: "x", theme: "dark" });
  const serviceWorker = fakeServiceWorker();
  const dependencies: DeviceDataDependencies = { caches, indexedDB, storage, serviceWorker, ...overrides };
  return { caches, indexedDB, storage, serviceWorker, dependencies };
}

describe("clearDeviceData", () => {
  it("clears every registered part and asks the worker to drop its pages", async () => {
    const device = devices();
    device.indexedDB.addStore("fire", "snapshots");
    device.indexedDB.addStore("fire", "settings");
    device.indexedDB.addStore("drafts", "items");
    register({ caches: ["fire-maps"], indexedDb: [{ database: "fire", store: "snapshots" }, { database: "drafts" }], storageKeys: ["draft"] });

    const result = await clearDeviceData(device.dependencies);

    expect(result).toEqual({ failed: [] });
    expect([...device.caches.kept]).toEqual(["other"]);
    expect([...device.storage.kept.keys()]).toEqual(["theme"]);
    expect(device.indexedDB.databases.get("fire")?.get("snapshots")?.size).toBe(0);
    expect(device.indexedDB.databases.get("fire")?.get("settings")?.size).toBe(1);
    expect(device.indexedDB.databases.has("drafts")).toBe(false);
    expect(device.indexedDB.closed).toBe(1);
    expect(device.serviceWorker.controller.postMessage).toHaveBeenCalledWith({ type: "clear-pages" });
  });

  it("clears the parts of every registration, each once", async () => {
    const device = devices();
    register({ caches: ["fire-maps"], storageKeys: ["draft"] });
    register({ caches: ["fire-maps", "other"] });

    expect(await clearDeviceData(device.dependencies)).toEqual({ failed: [] });
    expect(device.caches.delete.mock.calls).toEqual([["fire-maps"], ["other"]]);
    expect(device.storage.removeItem).toHaveBeenCalledTimes(1);
  });

  it("forgets an unregistered part", async () => {
    const device = devices();
    const unregister = registerDeviceData({ caches: ["fire-maps"] });
    unregister();

    await clearDeviceData(device.dependencies);

    expect(device.caches.delete).not.toHaveBeenCalled();
  });

  it("goes on past failed parts, a part that throws at once included, and names them", async () => {
    const storage = {
      removeItem: vi.fn((key: string) => {
        if (key === "draft") throw new DOMException("blocked", "SecurityError");
      }),
    };
    const device = devices({ caches: { delete: vi.fn(() => Promise.reject(new Error("quota"))) }, storage });
    device.indexedDB.addStore("fire", "snapshots");
    device.indexedDB.failingStores.add("fire/snapshots");
    device.indexedDB.addStore("drafts", "items");
    register({
      caches: ["fire-maps"],
      indexedDb: [{ database: "fire", store: "snapshots" }, { database: "drafts" }],
      storageKeys: ["draft", "theme"],
    });

    const result = await clearDeviceData(device.dependencies);

    expect(result).toEqual({ failed: ["cache:fire-maps", "indexedDb:fire/snapshots", "storage:draft"] });
    expect(device.indexedDB.databases.has("drafts")).toBe(false);
    expect(storage.removeItem).toHaveBeenCalledWith("theme");
    expect(device.indexedDB.closed).toBe(1);
    expect(device.serviceWorker.controller.postMessage).toHaveBeenCalledTimes(1);
  });

  it("reports a database another connection holds instead of waiting for it", async () => {
    const device = devices();
    device.indexedDB.addStore("fire", "snapshots");
    device.indexedDB.blocked.add("fire");
    register({ indexedDb: [{ database: "fire" }] });

    expect(await clearDeviceData(device.dependencies)).toEqual({ failed: ["indexedDb:fire"] });
  });

  it("leaves no database behind when the one to empty does not exist, and skips a missing store", async () => {
    const device = devices();
    device.indexedDB.addStore("fire", "settings");
    register({ indexedDb: [{ database: "never-opened", store: "snapshots" }, { database: "fire", store: "snapshots" }] });

    expect(await clearDeviceData(device.dependencies)).toEqual({ failed: [] });
    expect([...device.indexedDB.databases.keys()]).toEqual(["fire"]);
    expect(device.indexedDB.databases.get("fire")?.get("settings")?.size).toBe(1);
  });

  it("skips the parts whose API is missing", async () => {
    register({ caches: ["fire-maps"], indexedDb: [{ database: "fire" }], storageKeys: ["draft"] });

    const result = await clearDeviceData({ caches: null, indexedDB: null, storage: null, serviceWorker: { controller: null } });

    expect(result).toEqual({ failed: [] });
  });

  it("reads the browser globals when nothing is injected, and skips the ones the runtime lacks", async () => {
    const storage = fakeStorage({ draft: "x" });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("caches", undefined);
    vi.stubGlobal("indexedDB", undefined);
    try {
      register({ caches: ["fire-maps"], indexedDb: [{ database: "fire" }], storageKeys: ["draft"] });

      expect(await clearDeviceData()).toEqual({ failed: [] });
      expect(storage.kept.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("clears only the worker's pages when nothing is registered", async () => {
    const device = devices();

    expect(await clearDeviceData(device.dependencies)).toEqual({ failed: [] });
    expect(device.serviceWorker.controller.postMessage).toHaveBeenCalledWith({ type: "clear-pages" });
  });
});

describe("registerDeviceData", () => {
  it("refuses an empty name", () => {
    expect(() => registerDeviceData({ caches: [""] })).toThrow("registerDeviceData: a cache name must not be empty");
    expect(() => registerDeviceData({ storageKeys: [" "] })).toThrow("registerDeviceData: a storage key name must not be empty");
    expect(() => registerDeviceData({ indexedDb: [{ database: "fire", store: "" }] })).toThrow(
      "registerDeviceData: a store name must not be empty",
    );
  });
});
