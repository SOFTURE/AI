// Where an app runs (docs/07-runtime-providers.md): the runtime decides which APIs a package may use, the host decides
// how the app is built, deployed, scheduled and backed up. One package serves every pair through the config, so an
// app moves between hosts by changing `platform` in `softure.config.ts`.
export const SOFTURE_RUNTIMES = ["node", "workers"] as const;
export const SOFTURE_HOSTS = ["vps", "cloudflare"] as const;

/** `node`: a long-running Node.js process. `workers`: Cloudflare Workers (workerd) with `nodejs_compat`. */
export type SoftureRuntime = (typeof SOFTURE_RUNTIMES)[number];
/** `vps`: a server the app's deploy owns (Docker Compose). `cloudflare`: Cloudflare's network. */
export type SoftureHost = (typeof SOFTURE_HOSTS)[number];

export interface SofturePlatform {
  readonly runtime: SoftureRuntime;
  readonly host: SoftureHost;
}

/** What the app writes; a missing host is `vps` and a missing runtime is the host's first supported one. */
export interface SofturePlatformInput {
  readonly runtime?: SoftureRuntime;
  readonly host?: SoftureHost;
}

/** The runtimes each host supports, the first one being its default. A new host or pair is one entry here. */
export const SUPPORTED_PLATFORMS: Readonly<Record<SoftureHost, readonly [SoftureRuntime, ...SoftureRuntime[]]>> = Object.freeze({
  vps: ["node"],
  cloudflare: ["workers"],
});

export const DEFAULT_PLATFORM: SofturePlatform = Object.freeze({ runtime: "node", host: "vps" });

export type PlatformResolution = { readonly ok: true; readonly platform: SofturePlatform } | { readonly ok: false; readonly reason: string };

/** The platform an input names, or the reason it is not a supported pair. */
export function resolvePlatform(input: SofturePlatformInput | undefined): PlatformResolution {
  const host = input?.host ?? DEFAULT_PLATFORM.host;
  const runtimes = SUPPORTED_PLATFORMS[host];
  const runtime = input?.runtime ?? runtimes[0];
  if (!runtimes.includes(runtime)) {
    return { ok: false, reason: `the ${host} host does not run the ${runtime} runtime (supported: ${describeSupportedPlatforms()})` };
  }
  return { ok: true, platform: Object.freeze({ runtime, host }) };
}

/** The runtimes a module declares in its manifest; a module that declares none runs on Node only. */
export function getModuleRuntimes(manifest: { readonly runtimes?: readonly SoftureRuntime[] | undefined }): readonly SoftureRuntime[] {
  return manifest.runtimes ?? ["node"];
}

function describeSupportedPlatforms(): string {
  return Object.entries(SUPPORTED_PLATFORMS)
    .flatMap(([host, runtimes]) => runtimes.map((runtime) => `${host}+${runtime}`))
    .join(", ");
}
