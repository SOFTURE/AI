// What the build info route answers, without Next: the release from the container's environment, the commit and
// build time `withBuildInfo` inlined at build, the process start, the app's changelog and its own fields when it passes
// them.
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
  /**
   * The app's own fields, answered at the top level next to the build facts (e.g. its MCP tool list version and tool
   * count), so the deploy's smoke check can compare them (`softure-deploy smoke --expect-file`). Only what is public:
   * the route has no session. The build facts and `changelog` win over a field of the same name.
   */
  fields?: () => Readonly<Record<string, unknown>> | Promise<Readonly<Record<string, unknown>>>;
}

/** The build info with its changelog and the app's own fields, when the app passes their providers. */
export type BuildInfoAnswer = BuildInfo & { readonly changelog?: unknown; readonly [field: string]: unknown };

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
 * still reaches a deploy's smoke check. With a `fields` provider it adds the app's fields under the build facts; one
 * that fails adds none, so the smoke check names the missing field.
 */
export async function createBuildInfoResponse(options: BuildInfoOptions = {}): Promise<Response> {
  const info = readBuildInfo(options);
  const fields = options.fields === undefined ? {} : await readFields(options.fields);
  const changelog = options.changelog === undefined ? {} : { changelog: await readChangelog(options.changelog) };
  const body: BuildInfoAnswer = { ...fields, ...info, ...changelog };
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

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readFields(provider: NonNullable<BuildInfoOptions["fields"]>): Promise<Readonly<Record<string, unknown>>> {
  let fields: unknown;
  try {
    fields = await provider();
  } catch (error) {
    console.error(`build info: the fields provider failed: ${errorLogLabel(error)}`);
    return {};
  }
  if (isPlainObject(fields)) return fields;
  console.error("build info: the fields provider returned something other than an object");
  return {};
}
