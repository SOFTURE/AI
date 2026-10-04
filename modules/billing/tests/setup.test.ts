// Setup checks that fail once, loudly, instead of on a later request: `billing({ adminRole })` must
// be a role `auth({ roles })` declares, checked at the first billing request and by the readiness
// probe.
import { getBillingContext } from "@softure-ai/billing/next";
import { assertAdminRoleDeclared, checkBillingTables } from "@softure-ai/billing/server";
import { describe, expect, it } from "vitest";
import { createConfig, createTestBilling } from "./support.js";

const MISSPELT = 'billing({ adminRole }) is "admn", which auth({ roles }) does not declare (declared: admin)';

describe("assertAdminRoleDeclared", () => {
  it("accepts the default admin role and a role the app declared", () => {
    expect(() => assertAdminRoleDeclared(createConfig())).not.toThrow();
    expect(() => assertAdminRoleDeclared(createConfig({ adminRole: "billing-admin" }, ["billing-admin"]))).not.toThrow();
  });

  it("refuses a role auth does not declare, naming the option and the declared roles", () => {
    expect(() => assertAdminRoleDeclared(createConfig({ adminRole: "admn" }))).toThrow(MISSPELT);
  });

  it("stops the first billing request before it opens the database", async () => {
    await expect(getBillingContext(createConfig({ adminRole: "admn" }))).rejects.toThrow(MISSPELT);
  });

  it("fails the readiness probe", async () => {
    const test = await createTestBilling({ adminRole: "admn" });
    try {
      await expect(checkBillingTables(test.ctx)).rejects.toThrow(MISSPELT);
    } finally {
      await test.database.close();
    }
  });
});
