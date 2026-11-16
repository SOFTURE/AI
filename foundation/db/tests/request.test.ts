import { closeSharedDatabases, getConfiguredDatabase, getSharedDatabase, withRequestDatabase } from "@softure-ai/db";
import { getRequestDatabase } from "@softure-ai/db/request";
import { afterEach, describe, expect, it, vi } from "vitest";

// node-postgres opens no connection until a query, so a handle on an unreachable host can be opened and closed.
const URL_A = "postgres://user:secret@127.0.0.1:9/a";
const URL_B = "postgres://user:secret@127.0.0.1:9/b";

describe("withRequestDatabase", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await closeSharedDatabases();
  });

  it("gives every module the request's handle through getConfiguredDatabase, once per request", async () => {
    await withRequestDatabase({ url: URL_A }, async () => {
      const first = await getConfiguredDatabase({ url: "postgres://ignored/app" });
      const second = await getConfiguredDatabase({ url: "postgres://ignored/app" });
      expect(second).toBe(first);
      expect(first.kind).toBe("postgres");
      expect(first.kind === "postgres" ? first.pool.options.connectionString : null).toBe(URL_A);
    });
  });

  it("keeps concurrent requests apart", async () => {
    const seen: unknown[] = [];
    await Promise.all([
      withRequestDatabase({ url: URL_A }, async () => {
        seen.push(await getConfiguredDatabase({ url: "" }));
      }),
      withRequestDatabase({ url: URL_B }, async () => {
        seen.push(await getConfiguredDatabase({ url: "" }));
      }),
    ]);
    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
  });

  it("closes the handle after the handler resolves and after it throws", async () => {
    let closes = 0;
    const track = async () => {
      const handle = await getConfiguredDatabase({ url: "" });
      const close = handle.close;
      Object.assign(handle, { close: () => ((closes += 1), close()) });
    };
    await withRequestDatabase({ url: URL_A }, track);
    await expect(
      withRequestDatabase({ url: URL_A }, async () => {
        await track();
        throw new Error("handler failed");
      }),
    ).rejects.toThrow("handler failed");
    expect(closes).toBe(2);
  });

  it("hands the close to waitUntil", async () => {
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    await withRequestDatabase({ url: URL_A, waitUntil }, async () => {
      await getConfiguredDatabase({ url: "" });
    });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0]?.[0];
  });

  it("opens nothing for a request that never queries", async () => {
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    const result = await withRequestDatabase({ url: URL_A, waitUntil }, () => Promise.resolve("static"));
    expect(result).toBe("static");
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("refuses PGlite inside a request", async () => {
    await withRequestDatabase({ url: "pglite://" }, async () => {
      await expect(getConfiguredDatabase({ url: "" })).rejects.toThrow("PGlite is Node-only");
    });
  });

  it("answers no request handle outside a scope, and Node keeps its shared handle", async () => {
    expect(getRequestDatabase()).toBeUndefined();
    const shared = await getConfiguredDatabase({ url: "pglite://" });
    expect(shared).toBe(await getSharedDatabase("pglite://"));
  });

  it("refuses the shared handle on Workers outside a request scope", async () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    await expect(getConfiguredDatabase({ url: URL_A })).rejects.toThrow("wrap the Worker's fetch handler in withRequestDatabase");
  });
});
