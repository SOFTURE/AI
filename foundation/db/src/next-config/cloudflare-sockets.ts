// What a Cloudflare build bundles in place of `cloudflare:sockets` (`withDatabaseBuild`). OpenNext bundles the app's
// proxy (Node middleware) on its own and cannot resolve a `cloudflare:*` import there, so pg's Workers socket
// (pg-cloudflare) reaches workerd's `connect` through the Worker entry, which imports the real module and registers
// it with `registerCloudflareSockets` from @softure-ai/db/request.
import { getRegisteredCloudflareConnect } from "../sockets-bridge.js";

export function connect(...args: unknown[]): unknown {
  const registered = getRegisteredCloudflareConnect();
  if (registered === undefined) {
    throw new Error("cloudflare:sockets is not registered: call registerCloudflareSockets(connect) in the Worker's entry (worker.ts)");
  }
  return registered(...args);
}
