// `@softure-ai/connections/github-app`: the calls that let an app's own users connect a GitHub App installation (one
// per user, kept by the app), with installation tokens minted on demand. Stateless and Workers-safe; it needs neither
// the module's tables nor its configuration.
export {
  createGithubInstallationToken,
  exchangeGithubUserCode,
  getGithubAppInstallation,
  GITHUB_API_URL,
  GITHUB_OAUTH_URL,
  listGithubInstallationRepositories,
  listGithubUserInstallationRepositories,
  type GithubAccount,
  type GithubAppCallOptions,
  type GithubAppFailure,
  type GithubAppFailureCode,
  type GithubAppInstallation,
  type GithubInstallationToken,
  type GithubRepository,
  type GithubRepositoryPage,
  type GithubUserCodeExchange,
} from "./client.js";
export { createGithubAppJwt, type GithubAppCredentials, type GithubAppKeyInvalid } from "./jwt.js";
