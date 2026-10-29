// The `next.config` side of the build info: puts the commit and the build time into Next's `env`, which Next inlines
// at build wherever the code reads `process.env.SOFTURE_BUILD_COMMIT` or `process.env.SOFTURE_BUILD_TIME`. The image
// keeps no git history and no build arguments at run time, so the build is the only moment both are known.
import { execFileSync } from "node:child_process";

export const BUILD_COMMIT_ENV = "SOFTURE_BUILD_COMMIT";
export const BUILD_TIME_ENV = "SOFTURE_BUILD_TIME";

const COMMIT = /^[0-9a-f]{7,64}$/i;

export interface WithBuildInfoOptions {
  /** The commit; default `SOFTURE_BUILD_COMMIT` of the build's environment, then `GITHUB_SHA`, then `git rev-parse HEAD`. */
  commit?: string;
  /** The build time; default now. */
  builtAt?: Date;
  /** The folder `git rev-parse` runs in; default the current one. */
  cwd?: string;
  /** The build's environment; default `process.env`. */
  env?: Readonly<Record<string, string | undefined>>;
}

/** The part of a Next config this helper touches, so the package needs no `next` types. */
interface ConfigWithEnv {
  env?: Record<string, string | undefined>;
}

function readGitCommit(cwd: string | undefined): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    // No git or no repository (a Docker build without .git): the commit comes from the build argument or stays unknown.
    return undefined;
  }
}

/** The first candidate that is a commit (7 to 64 hex digits), lower-cased; an empty string when none is. */
export function resolveBuildCommit(options: WithBuildInfoOptions = {}): string {
  const env = options.env ?? process.env;
  const candidates = [options.commit, env[BUILD_COMMIT_ENV], env.GITHUB_SHA];
  for (const candidate of candidates) {
    const value = candidate?.trim() ?? "";
    if (value === "") continue;
    if (COMMIT.test(value)) return value.toLowerCase();
    console.warn(`withBuildInfo: ${JSON.stringify(value)} is not a commit (7 to 64 hex digits); ignored.`);
  }
  const fromGit = readGitCommit(options.cwd);
  return fromGit !== undefined && COMMIT.test(fromGit) ? fromGit.toLowerCase() : "";
}

/**
 * `export default withBuildInfo(nextConfig)`: the same config with `SOFTURE_BUILD_COMMIT` and `SOFTURE_BUILD_TIME` in
 * its `env`, next to the app's own entries. An unknown commit is an empty value, which the route answers as `null`.
 */
export function withBuildInfo<T extends ConfigWithEnv>(config: T, options: WithBuildInfoOptions = {}): T {
  return {
    ...config,
    env: {
      ...config.env,
      [BUILD_COMMIT_ENV]: resolveBuildCommit(options),
      [BUILD_TIME_ENV]: (options.builtAt ?? new Date()).toISOString(),
    },
  };
}
