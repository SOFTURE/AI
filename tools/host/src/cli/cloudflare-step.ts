import { createCloudflareApi, ensureDnsRecord, findZone, readTlsMode, reconcileAccess } from "../cloudflare/index.js";
import type { Inventory, InventoryApp } from "../inventory/index.js";
import { say, type HostDeps } from "./context.js";
import { fail, USAGE_EXIT_CODE } from "./failure.js";
import type { CliIo } from "./io.js";

/**
 * DNS, the TLS mode check and Access for one app. Runs only for an edge behind Cloudflare and with a token in
 * CLOUDFLARE_API_TOKEN (zone DNS edit, Access edit); otherwise one line says it was left to the owner.
 */
export async function runCloudflareStep(io: CliIo, deps: HostDeps, inventory: Inventory, app: InventoryApp, check: boolean): Promise<void> {
  if (inventory.edge.cdn !== "cloudflare") return;
  const token = io.env.CLOUDFLARE_API_TOKEN;
  if (token === undefined || token === "") {
    say(io, "cloudflare", "CLOUDFLARE_API_TOKEN is not set: DNS, TLS and Access left as they are");
    return;
  }
  const { ipv4, ipv6 } = inventory.server;
  if (ipv4 === undefined) return fail("cloudflare: the DNS record needs server.ipv4 in the inventory", USAGE_EXIT_CODE);
  const api = createCloudflareApi(token, deps.fetch);
  const zone = await findZone(api, app.host);
  const records: ["A" | "AAAA", string][] = [["A", ipv4], ...(ipv6 === undefined ? [] : [["AAAA", ipv6] as ["AAAA", string]])];
  for (const [type, content] of records) {
    const outcome = await ensureDnsRecord(api, { zone, type, name: app.host, content, check });
    say(io, "cloudflare", `${type} ${app.host} → ${content} (proxied): ${outcome}`);
  }
  const mode = await readTlsMode(api, zone);
  say(io, "cloudflare", mode === "strict" ? `${zone.name} TLS is Full (strict)` : `warning: ${zone.name} TLS is "${mode}"; set Full (strict) under SSL/TLS (zone-wide, so not changed here)`);
  if (!app.access.enabled) return;
  const report = await reconcileAccess(api, { zone, app, check });
  for (const { name, outcome } of report.outcomes) say(io, "cloudflare", `Access "${name}": ${outcome}`);
  for (const name of report.stale) say(io, "cloudflare", `Access "${name}" is no longer in the inventory; left as it is, remove it by hand if unused`);
}
