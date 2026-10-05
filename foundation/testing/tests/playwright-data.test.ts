import { describe, expect, it } from "vitest";
import { clientAddressHeaders, randomClientAddress, uniqueEmail, uniqueName, waitFor, withDatabase } from "@softure-ai/testing/playwright";

describe("randomClientAddress", () => {
  it("stays inside 198.18.0.0/15 and never uses a network or broadcast host", () => {
    for (let index = 0; index < 500; index += 1) {
      const parts = randomClientAddress().split(".").map(Number);
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe(198);
      expect([18, 19]).toContain(parts[1]);
      expect(parts[2]).toBeGreaterThanOrEqual(0);
      expect(parts[2]).toBeLessThanOrEqual(255);
      expect(parts[3]).toBeGreaterThanOrEqual(1);
      expect(parts[3]).toBeLessThanOrEqual(254);
    }
  });

  it("puts the address in the cf-connecting-ip header", () => {
    expect(clientAddressHeaders("198.18.0.7")).toEqual({ "cf-connecting-ip": "198.18.0.7" });
    expect(Object.keys(clientAddressHeaders())).toEqual(["cf-connecting-ip"]);
  });
});

describe("uniqueName and uniqueEmail", () => {
  it("keeps the prefix and never repeats", () => {
    const names = new Set(Array.from({ length: 100 }, () => uniqueName("e2e-entry")));
    expect(names.size).toBe(100);
    for (const name of names) expect(name).toMatch(/^e2e-entry-[0-9a-f-]{36}$/);
  });

  it("builds an address on example.com unless another domain is given", () => {
    expect(uniqueEmail("e2e-auth")).toMatch(/^e2e-auth-[0-9a-f-]{36}@example\.com$/);
    expect(uniqueEmail("e2e-auth", "test.local")).toMatch(/@test\.local$/);
  });
});

describe("withDatabase", () => {
  function createHandle(): { close: () => Promise<void>; closed: number } {
    const handle = {
      closed: 0,
      close: () => {
        handle.closed += 1;
        return Promise.resolve();
      },
    };
    return handle;
  }

  it("returns what the work returns and closes the handle", async () => {
    const handle = createHandle();
    await expect(withDatabase(() => Promise.resolve(handle), () => Promise.resolve(42))).resolves.toBe(42);
    expect(handle.closed).toBe(1);
  });

  it("closes the handle when the work fails and rethrows the failure", async () => {
    const handle = createHandle();
    await expect(withDatabase(() => Promise.resolve(handle), () => Promise.reject(new Error("insert failed")))).rejects.toThrow("insert failed");
    expect(handle.closed).toBe(1);
  });
});

describe("waitFor", () => {
  it("returns the first value that is neither null nor undefined", async () => {
    const answers = [null, undefined, "link"];
    let calls = 0;
    const value = await waitFor(() => Promise.resolve(answers[calls++]), { description: "a link", intervalMs: 1 });
    expect(value).toBe("link");
    expect(calls).toBe(3);
  });

  it("keeps polling through errors", async () => {
    let calls = 0;
    const value = await waitFor(
      () => {
        calls += 1;
        return calls < 3 ? Promise.reject(new Error("not up yet")) : Promise.resolve(0);
      },
      { description: "the app", intervalMs: 1 },
    );
    expect(value).toBe(0);
  });

  it("times out naming what it waited for, with the last error as the cause", async () => {
    const failure = await waitFor(() => Promise.reject(new Error("connection refused")), {
      description: "the reset mail",
      timeoutMs: 20,
      intervalMs: 5,
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("waitFor: gave up waiting for the reset mail after 20 ms");
    expect(((failure as Error).cause as Error).message).toBe("connection refused");
  });

  it("times out without a cause when the probe only returned nothing", async () => {
    const failure = await waitFor(() => Promise.resolve(null), { description: "a row", timeoutMs: 10, intervalMs: 2 }).catch((error: unknown) => error);
    expect((failure as Error).cause).toBeUndefined();
  });
});
