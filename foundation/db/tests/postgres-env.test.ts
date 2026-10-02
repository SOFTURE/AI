import { describe, expect, it } from "vitest";
import { POSTGRES_ADMIN_URL } from "./support/postgres.js";

describe("the Postgres test server", () => {
  // Locally the Postgres cases may skip; in CI a skipped Postgres suite would hide every
  // driver-specific bug, so a missing server fails here.
  it.runIf(process.env.CI !== undefined && process.env.CI !== "")("is configured in CI", () => {
    expect(POSTGRES_ADMIN_URL).toMatch(/^postgres(ql)?:\/\//);
  });
});
