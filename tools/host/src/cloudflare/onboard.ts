import { z } from "zod";
import { fail } from "../cli/failure.js";
import type { InventoryApp } from "../inventory/index.js";
import { readResult, type CloudflareApi } from "./api.js";

/** Marks the Access applications this package manages; others are never changed. */
export const MANAGED_SUFFIX = "(softure-host)";

export interface Zone {
  id: string;
  name: string;
  accountId: string;
}

const zonesSchema = z.array(z.object({ id: z.string(), name: z.string(), account: z.object({ id: z.string() }) }));

/** The zone that holds `host`: the longest suffix of it Cloudflare knows (`a.b.example.com` → `b.example.com`, …). */
export async function findZone(api: CloudflareApi, host: string): Promise<Zone> {
  const labels = host.split(".");
  for (let start = 0; start <= labels.length - 2; start += 1) {
    const name = labels.slice(start).join(".");
    const zones = readResult(zonesSchema, await api.request("GET", `/zones?name=${encodeURIComponent(name)}`), "the zone lookup");
    const zone = zones[0];
    if (zone !== undefined) return { id: zone.id, name: zone.name, accountId: zone.account.id };
  }
  return fail(`cloudflare: no zone of this token holds ${host}`);
}

export type Outcome = "created" | "updated" | "unchanged" | "would create" | "would update";

const recordsSchema = z.array(z.object({ id: z.string(), content: z.string(), proxied: z.boolean().optional() }));

/** One proxied A or AAAA record for the app's host, pointing at the server. */
export async function ensureDnsRecord(
  api: CloudflareApi,
  options: { zone: Zone; type: "A" | "AAAA"; name: string; content: string; check: boolean },
): Promise<Outcome> {
  const { zone, type, name, content, check } = options;
  const path = `/zones/${zone.id}/dns_records`;
  const records = readResult(recordsSchema, await api.request("GET", `${path}?type=${type}&name=${encodeURIComponent(name)}`), "the DNS lookup");
  if (records.length > 1) return fail(`cloudflare: ${name} has ${records.length} ${type} records; leave one`);
  const body = { type, name, content, proxied: true, ttl: 1 };
  const existing = records[0];
  if (existing === undefined) {
    if (!check) await api.request("POST", path, body);
    return check ? "would create" : "created";
  }
  if (existing.content === content && existing.proxied === true) return "unchanged";
  if (!check) await api.request("PATCH", `${path}/${existing.id}`, body);
  return check ? "would update" : "updated";
}

const sslSchema = z.object({ value: z.string() });

/** The zone's SSL/TLS mode; `strict` is Full (strict). Read only: the mode is zone-wide. */
export async function readTlsMode(api: CloudflareApi, zone: Zone): Promise<string> {
  return readResult(sslSchema, await api.request("GET", `/zones/${zone.id}/settings/ssl`), "the SSL/TLS setting").value;
}

interface AccessRule {
  email?: { email: string };
  everyone?: Record<string, never>;
}

interface AccessPolicy {
  name: string;
  decision: "allow" | "bypass";
  include: AccessRule[];
}

export interface AccessApplication {
  name: string;
  domain: string;
  type: "self_hosted";
  session_duration: string;
  app_launcher_visible: boolean;
  policies: AccessPolicy[];
}

/** The Access applications the inventory asks for: the whole host for its emails, one bypass per path. */
export function buildAccessApplications(app: InventoryApp): AccessApplication[] {
  const base = { type: "self_hosted" as const, session_duration: "24h", app_launcher_visible: false };
  return [
    {
      ...base,
      name: `${app.slug} ${MANAGED_SUFFIX}`,
      domain: app.host,
      policies: [
        {
          name: `${app.slug} owners ${MANAGED_SUFFIX}`,
          decision: "allow",
          include: app.access.emails.map((email) => ({ email: { email } })),
        },
      ],
    },
    ...app.access.bypassPaths.map((path) => ({
      ...base,
      name: `${app.slug} bypass ${path} ${MANAGED_SUFFIX}`,
      domain: `${app.host}${path}`,
      policies: [{ name: `${app.slug} bypass ${path} ${MANAGED_SUFFIX}`, decision: "bypass" as const, include: [{ everyone: {} }] }],
    })),
  ];
}

const existingAppsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    domain: z.string().optional(),
    policies: z.array(z.object({ decision: z.string(), include: z.array(z.unknown()) })).default([]),
  }),
);

type ExistingApp = z.infer<typeof existingAppsSchema>[number];

/** Same domain and the same decisions over the same rules: nothing to send. */
function isSameApplication(existing: ExistingApp, wanted: AccessApplication): boolean {
  const normalize = (policies: { decision: string; include: unknown[] }[]) =>
    JSON.stringify(policies.map((policy) => ({ decision: policy.decision, include: policy.include })));
  return existing.domain === wanted.domain && normalize(existing.policies) === normalize(wanted.policies);
}

async function listAccessApplications(api: CloudflareApi, accountId: string): Promise<ExistingApp[]> {
  const all: ExistingApp[] = [];
  for (let page = 1; ; page += 1) {
    const batch = readResult(existingAppsSchema, await api.request("GET", `/accounts/${accountId}/access/apps?per_page=100&page=${page}`), "the Access listing");
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

export interface AccessReport {
  outcomes: { name: string; outcome: Outcome }[];
  /** Applications this package made for the app that the inventory no longer lists: left for the owner. */
  stale: string[];
}

/** Creates or updates the app's Access applications by name; never touches, nor deletes, any other application. */
export async function reconcileAccess(
  api: CloudflareApi,
  options: { zone: Zone; app: InventoryApp; check: boolean },
): Promise<AccessReport> {
  const { zone, app, check } = options;
  const path = `/accounts/${zone.accountId}/access/apps`;
  const existing = await listAccessApplications(api, zone.accountId);
  const wanted = buildAccessApplications(app);
  const outcomes: AccessReport["outcomes"] = [];
  for (const application of wanted) {
    const current = existing.find((candidate) => candidate.name === application.name);
    if (current === undefined) {
      if (!check) await api.request("POST", path, application);
      outcomes.push({ name: application.name, outcome: check ? "would create" : "created" });
    } else if (isSameApplication(current, application)) {
      outcomes.push({ name: application.name, outcome: "unchanged" });
    } else {
      if (!check) await api.request("PUT", `${path}/${current.id}`, application);
      outcomes.push({ name: application.name, outcome: check ? "would update" : "updated" });
    }
  }
  const wantedNames = new Set(wanted.map((application) => application.name));
  const stale = existing
    .map((candidate) => candidate.name)
    .filter((name) => name.startsWith(`${app.slug} `) && name.endsWith(MANAGED_SUFFIX) && !wantedNames.has(name));
  return { outcomes, stale };
}
