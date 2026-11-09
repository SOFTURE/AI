import { describe, expect, it } from "vitest";
import { buildLifecycleJson, buildLifecycleXml, parseLifecycleDays } from "@softure-ai/backup/offsite";

describe("the remote retention rule", () => {
  it("defaults to 30 days and takes whole days from 1 to 3650", () => {
    expect(parseLifecycleDays(undefined)).toEqual({ ok: true, days: 30 });
    expect(parseLifecycleDays("1")).toEqual({ ok: true, days: 1 });
    expect(parseLifecycleDays("3650")).toEqual({ ok: true, days: 3650 });
    expect(parseLifecycleDays("0")).toEqual({ ok: false, problem: "--days is from 1 to 3650, not 0" });
    expect(parseLifecycleDays("3651")).toEqual({ ok: false, problem: "--days is from 1 to 3650, not 3651" });
    expect(parseLifecycleDays("7.5").ok).toBe(false);
    expect(parseLifecycleDays("-1").ok).toBe(false);
  });

  it("expires only the app's prefix and drops unfinished uploads after a day", () => {
    const xml = buildLifecycleXml("acme-app", 30);
    expect(xml).toContain("<Filter><Prefix>acme-app/</Prefix></Filter>");
    expect(xml).toContain("<Expiration><Days>30</Days></Expiration>");
    expect(xml).toContain("<DaysAfterInitiation>1</DaysAfterInitiation>");
    expect(JSON.parse(buildLifecycleJson("prod/acme", 45))).toEqual({
      Rules: [
        {
          ID: "softure-backup-prod-acme",
          Status: "Enabled",
          Filter: { Prefix: "prod/acme/" },
          Expiration: { Days: 45 },
          AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
        },
      ],
    });
  });
});
