// The export download's file name carries the day of the download in the app's time zone.
import { describe, expect, it } from "vitest";
import { getFileName } from "../src/next/route.js";
import { createConfig } from "./support.js";

describe("the export file name", () => {
  it("dates the download in the app's time zone, not in UTC", () => {
    // 01:30 UTC on 3 October is still the evening of 2 October in New York.
    expect(getFileName(createConfig(), new Date("2026-10-03T01:30:00Z"))).toBe("account-data-2026-10-02.json");
    expect(getFileName(createConfig(), new Date("2026-10-03T04:00:00Z"))).toBe("account-data-2026-10-03.json");
  });

  it("uses the configured file name", () => {
    const config = createConfig({ export: { fileName: "my-data" } });
    expect(getFileName(config, new Date("2026-10-03T12:00:00Z"))).toBe("my-data-2026-10-03.json");
  });
});
