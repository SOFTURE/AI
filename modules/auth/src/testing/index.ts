// Test helpers of @softure-ai/auth: accounts created directly in the database, for tests that need
// a user but are not about registration. Server-only; never imported by the module's runtime code.
export { createTestAccount, type TestAccountInput } from "./account.js";
