// The hand-over of workerd's `connect` (from `cloudflare:sockets`) between the Worker entry and the bundles that cannot
// import it themselves (next-config/cloudflare-sockets.ts). On globalThis under a `Symbol.for` key, so every bundle's
// copy of this file finds the same function.
const CONNECT_KEY = Symbol.for("@softure-ai/db/cloudflare-sockets-connect");

export type CloudflareConnect = (...args: never[]) => unknown;

type ConnectHost = Record<typeof CONNECT_KEY, ((...args: unknown[]) => unknown) | undefined>;

/** Registers workerd's `connect`; the Worker entry calls it once with `import { connect } from "cloudflare:sockets"`. */
export function registerCloudflareSockets(connect: CloudflareConnect): void {
  (globalThis as unknown as ConnectHost)[CONNECT_KEY] = connect as (...args: unknown[]) => unknown;
}

/** The registered `connect`, or `undefined` before the Worker entry ran. */
export function getRegisteredCloudflareConnect(): ((...args: unknown[]) => unknown) | undefined {
  return (globalThis as unknown as ConnectHost)[CONNECT_KEY];
}
