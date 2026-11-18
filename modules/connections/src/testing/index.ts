// `@softure-ai/connections/testing`: a fake OAuth provider and a fake GitHub App for an app's own tests, and a test keyring.
export {
  createFakeGithubApp,
  type FakeGithubApp,
  type FakeGithubAppFailure,
  type FakeGithubAppOptions,
  type FakeGithubFiles,
  type FakeGithubInstallationInput,
  type FakeGithubRepositoryInput,
} from "./fake-github-app.js";
export { createFakeOAuthProvider, type FakeConsentOptions, type FakeFailure, type FakeOAuthProvider, type FakeOAuthProviderOptions } from "./fake-provider.js";
export { createTestKeyring } from "./keyring.js";
