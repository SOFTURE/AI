// Test helpers of @softure-ai/mailing: a provider that captures mail instead of sending it, and a
// reader for its outbox file. Server-only (it writes files).
export { fakeMailProvider, type CapturedMail, type FakeMailProvider, type FakeMailProviderOptions } from "./fake-provider.js";
export { readMailOutbox } from "./outbox.js";
