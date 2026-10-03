// A token's expiry status: the instant decides expired (the same boundary as verification), the
// calendar days of the app's time zone decide how many days are left.
import { getAccessTokenStatus } from "@softure-ai/mcp-access";
import { describe, expect, it } from "vitest";

const OPTIONS = { timezone: "Europe/Warsaw", warningDays: 14 };

describe("getAccessTokenStatus", () => {
  it("is active beyond the warning threshold", () => {
    expect(getAccessTokenStatus(new Date("2026-10-01T10:00:00Z"), new Date("2026-09-15T10:00:00Z"), OPTIONS)).toEqual({ kind: "active" });
  });

  it("is expiring within the threshold, counting calendar days in the app's time zone", () => {
    // 10:00 Warsaw today to 09:00 Warsaw in ten days: under ten full days, ten calendar days.
    expect(getAccessTokenStatus(new Date("2026-09-25T07:00:00Z"), new Date("2026-09-15T08:00:00Z"), OPTIONS)).toEqual({ kind: "expiring", daysLeft: 10 });
    expect(getAccessTokenStatus(new Date("2026-09-29T10:00:00Z"), new Date("2026-09-15T10:00:00Z"), OPTIONS)).toEqual({ kind: "expiring", daysLeft: 14 });
  });

  it("counts a token expiring later today as 0 days, and one past midnight in Warsaw as tomorrow", () => {
    expect(getAccessTokenStatus(new Date("2026-09-15T21:00:00Z"), new Date("2026-09-15T10:00:00Z"), OPTIONS)).toEqual({ kind: "expiring", daysLeft: 0 });
    // 22:30 UTC is already the next day in Warsaw (UTC+2).
    expect(getAccessTokenStatus(new Date("2026-09-15T22:30:00Z"), new Date("2026-09-15T10:00:00Z"), OPTIONS)).toEqual({ kind: "expiring", daysLeft: 1 });
  });

  it("is expired at the expiry instant and after it", () => {
    const expiresAt = new Date("2026-09-15T10:00:00Z");
    expect(getAccessTokenStatus(expiresAt, expiresAt, OPTIONS)).toEqual({ kind: "expired" });
    expect(getAccessTokenStatus(expiresAt, new Date(expiresAt.getTime() - 1), OPTIONS)).toEqual({ kind: "expiring", daysLeft: 0 });
  });
});
