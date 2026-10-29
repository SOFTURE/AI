// What the build info route answers, without Next: the release from the container's environment, the commit and
// build time `withBuildInfo` inlined at build, the process start, and the app's changelog when it passes one.
//
// The variables are read as literal `process.env.NAME` expressions on purpose: Next replaces exactly that form with
// the values `withBuildInfo` put into `env`, in the app's code and in the bundled code of this package.
import { errorLogLabel } from "@softure-ai/core";
import type { BuildInfo } from "../contract.js";

export interface BuildInfoOptions {
  /** The release tag; default `SOFTURE_RELEASE` of the environment at call time. */
  release?: string | null;
  /** The build's commit; default `SOFTURE_BUILD_COMMIT`. */
  commit?: string | null;
  /** The build time, ISO 8601; default `SOFTURE_BUILD_TIME`. */
  builtAt?: string | null;
  /** The process start; default the start of this process. */
  startedAt?: Date;
  /**
   * The app's changelog (e.g. the JSON `softure-deploy changelog` wrote before the build), answered as `changelog`.
   * Only what is public: the route has no session.
   */
  changelog?: () => unknown;
}

/** The build info with its changelog, when the app passes a changelog provider. */
export type BuildInfoAnswer = BuildInfo & { readonly changelog?: unknown };

function getProcessStart(): Date {
  return new Date(Date.now() - process.uptime() * 1000);
}

/** An unset or empty value is `null`. */
function readValue(option: string | null | undefined, fromEnv: string | undefined): string | null {
  const value = option === undefined ? fromEnv : option;
  return value === undefined || value === null || value.trim() === "" ? null : value.trim();
}

/** The build info of this process; reads the environment on every call, so a release set at start is current. */
export function readBuildInfo(options: BuildInfoOptions = {}): BuildInfo {
  return {
    release: readValue(options.release, process.env.SOFTURE_RELEASE),
    commit: readValue(options.commit, process.env.SOFTURE_BUILD_COMMIT),
    builtAt: readValue(options.builtAt, process.env.SOFTURE_BUILD_TIME),
    startedAt: (options.startedAt ?? getProcessStart()).toISOString(),
  };
}

/**
 * The build info route's answer: the build info as JSON, never cached. With a `changelog` provider it adds
 * `changelog`; a provider that fails answers `changelog: null` and logs the error class, so the build info itself
 * still reaches a deploy's smoke check.
 */
export async function createBuildInfoResponse(options: BuildInfoOptions = {}): Promise<Response> {
  const info: BuildInfoAnswer = readBuildInfo(options);
  const body = options.changelog === undefined ? info : { ...info, changelog: await readChangelog(options.changelog) };
  // A cached answer would name the build before the deploy: the very thing a smoke check looks for.
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}

async function readChangelog(provider: () => unknown): Promise<unknown> {
  try {
    return (await provider()) ?? null;
  } catch (error) {
    console.error(`build info: the changelog provider failed: ${errorLogLabel(error)}`);
    return null;
  }
}
