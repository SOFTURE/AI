// Test helpers of @softure-ai/auth: accounts created directly in the database, for tests that need
// a user but are not about registration, and a fake OpenID Connect provider and a fake GitHub OAuth App for tests of
// the sign-in.
// Server-only; never imported by the module's runtime code.
export { createTestAccount, type TestAccountHashInput, type TestAccountInput } from "./account.js";
export {
  createFakeOidcProvider,
  type FakeOidcFailure,
  type FakeOidcProvider,
  type FakeOidcProviderOptions,
  type FakeOidcUser,
  type FakeSignInOptions,
} from "./oidc-provider.js";
export {
  createFakeGithubProvider,
  type FakeGithubEmail,
  type FakeGithubFailure,
  type FakeGithubProvider,
  type FakeGithubProviderOptions,
  type FakeGithubSignInOptions,
  type FakeGithubUser,
} from "./github-provider.js";
