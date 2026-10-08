import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TEST_TIME_ZONE, pinTestTimeZone, pinTimeZone, readTestTimeZone } from "@softure-ai/testing";

const TIME_ZONE_SOURCE = new URL("../src/vitest/time-zone.ts", import.meta.url);
const STARTING_TIME_ZONE = readProcessTimeZone();

afterEach(() => {
  vi.unstubAllEnvs();
});

function readProcessTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Pins `TZ` and `TEST_TZ` through `vi.stubEnv`, so `afterEach` assigns the old values back. */
function stubZone(timeZone: string, testTimeZone?: string): void {
  vi.stubEnv("TZ", timeZone);
  vi.stubEnv("TEST_TZ", testTimeZone);
}

/** Runs `pinTimeZone(timeZone)` in a worker thread and resolves with its error message, or null. */
function pinInWorkerThread(timeZone: string): Promise<string | null> {
  const code = `
    import { parentPort, workerData } from "node:worker_threads";
    const { pinTimeZone } = await import(workerData.source);
    try {
      pinTimeZone(workerData.timeZone);
      parentPort.postMessage(null);
    } catch (error) {
      parentPort.postMessage(error.message);
    }
  `;
  const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(code)}`), {
    workerData: { source: TIME_ZONE_SOURCE.href, timeZone },
  });
  return new Promise((resolve, reject) => {
    worker.once("message", (message: string | null) => {
      resolve(message);
      void worker.terminate();
    });
    worker.once("error", reject);
  });
}

describe("readTestTimeZone", () => {
  it("defaults to a zone with a negative offset when TEST_TZ is unset or empty", () => {
    expect(DEFAULT_TEST_TIME_ZONE).toBe("America/New_York");
    expect(readTestTimeZone(undefined)).toBe("America/New_York");
    expect(readTestTimeZone("")).toBe("America/New_York");
  });

  it("returns the zone TEST_TZ names", () => {
    expect(readTestTimeZone("Europe/Warsaw")).toBe("Europe/Warsaw");
  });

  it("rejects a name that is not a time zone, which TZ would turn into UTC silently", () => {
    expect(() => readTestTimeZone("Mars/Olympus")).toThrow(
      new RangeError('TEST_TZ must be an IANA time zone such as America/New_York, got "Mars/Olympus"'),
    );
  });
});

describe("pinTimeZone", () => {
  it("switches the process to the zone", () => {
    stubZone("UTC");

    pinTimeZone("Asia/Tokyo");

    expect(process.env.TZ).toBe("Asia/Tokyo");
    expect(readProcessTimeZone()).toBe("Asia/Tokyo");
    expect(new Date(Date.UTC(2026, 0, 1, 20)).getDate()).toBe(2);
  });

  it("is switched back when the stubbed TZ is restored", () => {
    stubZone("UTC");
    pinTimeZone("Asia/Tokyo");

    vi.unstubAllEnvs();

    expect(readProcessTimeZone()).toBe(STARTING_TIME_ZONE);
  });

  it("rejects a name that is not a time zone", () => {
    stubZone("UTC");

    expect(() => pinTimeZone("Mars/Olympus")).toThrow(
      new RangeError('pinTimeZone: "Mars/Olympus" is not an IANA time zone'),
    );
    expect(readProcessTimeZone()).toBe("UTC");
  });

  it("fails inside a worker thread, where TZ cannot switch the zone, and names the fixes", async () => {
    stubZone("UTC");

    const message = await pinInWorkerThread("Asia/Tokyo");

    expect(message).toBe(
      'pinTimeZone: the process still runs in "UTC" after TZ was set to "Asia/Tokyo". ' +
        "Node applies TZ per process, so it cannot change inside a worker thread (Vitest pools threads and vmThreads). " +
        'Call pinTestTimeZone() at the top of vitest.config.* (it runs before the workers start), or use pool: "forks".',
    );
  });

  it("passes inside a worker thread when the process already runs in the zone", async () => {
    stubZone("Asia/Tokyo");

    await expect(pinInWorkerThread("Asia/Tokyo")).resolves.toBeNull();
  });
});

describe("pinTestTimeZone", () => {
  it("pins the default zone and stores it in TEST_TZ for the workers", () => {
    stubZone("UTC");

    expect(pinTestTimeZone()).toBe("America/New_York");

    expect(process.env.TEST_TZ).toBe("America/New_York");
    expect(readProcessTimeZone()).toBe("America/New_York");
  });

  it("pins the zone it is given", () => {
    stubZone("UTC");

    expect(pinTestTimeZone("Europe/Warsaw")).toBe("Europe/Warsaw");

    expect(process.env.TEST_TZ).toBe("Europe/Warsaw");
    expect(readProcessTimeZone()).toBe("Europe/Warsaw");
  });

  it("lets TEST_TZ from the shell win over the zone in the config, for a one-off probe", () => {
    stubZone("UTC", "Asia/Tokyo");

    expect(pinTestTimeZone("Europe/Warsaw")).toBe("Asia/Tokyo");

    expect(readProcessTimeZone()).toBe("Asia/Tokyo");
  });
});
