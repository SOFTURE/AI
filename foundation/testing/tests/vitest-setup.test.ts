import { afterEach, describe, expect, it, vi } from "vitest";
import { isClockShifted, restoreClock } from "@softure-ai/testing";

const REAL_DATE = Date;

afterEach(() => {
  restoreClock();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

async function loadSetupFile(testToday: string | undefined): Promise<void> {
  vi.stubEnv("TEST_TODAY", testToday);
  vi.resetModules();
  await import("@softure-ai/testing/vitest-setup");
}

describe("the vitest-setup entry", () => {
  it("shifts the clock to TEST_TODAY and says so on stderr", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await loadSetupFile("2027-01-02");

    expect(isClockShifted()).toBe(true);
    expect(new Date().getFullYear()).toBe(2027);
    expect(new Date().getMonth()).toBe(0);
    expect(new Date().getDate()).toBe(2);
    expect(warn).toHaveBeenCalledExactlyOnceWith("[@softure-ai/testing] test clock shifted to 2027-01-02 (TEST_TODAY)");
  });

  it("leaves the real clock alone and prints nothing without TEST_TODAY", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await loadSetupFile(undefined);

    expect(isClockShifted()).toBe(false);
    expect(Date).toBe(REAL_DATE);
    expect(warn).not.toHaveBeenCalled();
  });

  it("pins the process to a zone with a negative offset by default", async () => {
    vi.stubEnv("TZ", "UTC");
    vi.stubEnv("TEST_TZ", undefined);

    await loadSetupFile(undefined);

    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/New_York");
    expect(new Date(Date.UTC(2026, 0, 1, 2)).getDate()).toBe(31);
  });

  it("pins the zone TEST_TZ names", async () => {
    vi.stubEnv("TZ", "UTC");
    vi.stubEnv("TEST_TZ", "Asia/Tokyo");

    await loadSetupFile(undefined);

    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Tokyo");
  });

  it("shifts the clock to noon of TEST_TODAY in the pinned zone", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("TZ", "Asia/Tokyo");
    vi.stubEnv("TEST_TZ", undefined);

    await loadSetupFile("2027-01-02");

    const now = new Date();
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/New_York");
    expect([now.getFullYear(), now.getMonth(), now.getDate()]).toEqual([2027, 0, 2]);
    expect(now.getUTCDate()).toBe(2);
  });

  it("fails the run on a malformed TEST_TODAY instead of running on the real date", async () => {
    await expect(loadSetupFile("sh")).rejects.toThrow(
      'TEST_TODAY must be a real date in the form YYYY-MM-DD, got "sh". Example: 2027-01-02',
    );
    expect(isClockShifted()).toBe(false);
  });
});
