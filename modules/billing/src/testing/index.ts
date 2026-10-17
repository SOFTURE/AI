// Test helpers of @softure-ai/billing: entitlement rows written the way a fixture needs them, and
// accounts put in a named access state relative to the clock. Server-only; never imported by the
// module's runtime code.
export {
  createTestEntitlement,
  setTestEntitlementState,
  type TestEntitlementInput,
  type TestEntitlementState,
  type TestEntitlementStateInput,
} from "./entitlement.js";
