import { describe, expect, it } from "vitest";
import { parseInventory } from "../inventory/index.js";
import {
  buildAccessApplications,
  createCloudflareApi,
  ensureDnsRecord,
  findZone,
  readTlsMode,
  reconcileAccess,
  type CloudflareApi,
  type HttpMethod,
} from "./index.js";

interface ApiCall {
  method: HttpMethod;
  path: string;
  body?: unknown;
}

/** An API that answers GETs from `routes` (by path prefix) and records every call. */
function createFakeApi(routes: Record<string, unknown>): CloudflareApi & { calls: ApiCall[] } {
  const calls: ApiCall[] = [];
  return {
    calls,
    request(method, path, body) {
      calls.push({ method, path, ...(body === undefined ? {} : { body }) });
      if (method !== "GET") return Promise.resolve({ id: "new" });
      const route = Object.keys(routes).find((prefix) => path.startsWith(prefix));
      return Promise.resolve(route === undefined ? [] : routes[route]);
    },
  };
}

const zone = { id: "z1", name: "example.com", accountId: "acc1" };
const inventory = parseInventory(
  {
    server: { host: "srv.example.com", adminUser: "admin" },
    edge: { acmeEmail: "ops@example.com", cdn: "cloudflare" },
    apps: [
      {
        slug: "notes",
        repo: "acme/notes",
        host: "notes.example.com",
        access: { enabled: true, bypassPaths: ["/api/mcp"], emails: ["owner@example.com"] },
      },
    ],
  },
  "t",
);
const app = inventory.apps[0];
if (app === undefined) throw new Error("fixture has an app");

describe("createCloudflareApi", () => {
  it("sends the bearer token and returns the result", async () => {
    const seen: { url: string; init: RequestInit | undefined }[] = [];
    const fetchFn = ((url: string, init?: RequestInit) => {
      seen.push({ url, init });
      return Promise.resolve(new Response(JSON.stringify({ success: true, errors: [], result: { value: "strict" } })));
    }) as typeof fetch;
    const api = createCloudflareApi("tok", fetchFn);
    await expect(api.request("GET", "/zones/z1/settings/ssl")).resolves.toEqual({ value: "strict" });
    expect(seen[0]?.url).toBe("https://api.cloudflare.com/client/v4/zones/z1/settings/ssl");
    expect(new Headers(seen[0]?.init?.headers).get("authorization")).toBe("Bearer tok");
  });

  it("names the refused call and Cloudflare's reasons, never the token", async () => {
    const fetchFn = (() =>
      Promise.resolve(new Response(JSON.stringify({ success: false, errors: [{ code: 9109, message: "Unauthorized" }], result: null }), { status: 403 }))) as typeof fetch;
    const failure = createCloudflareApi("secret-token", fetchFn).request("POST", "/zones/z1/dns_records", {});
    await expect(failure).rejects.toThrow("cloudflare: POST /zones/z1/dns_records refused: Unauthorized");
    await expect(failure).rejects.not.toThrow("secret-token");
  });
});

describe("findZone", () => {
  it("walks the host's suffixes to the zone the token holds", async () => {
    const api = createFakeApi({ "/zones?name=example.com": [{ id: "z1", name: "example.com", account: { id: "acc1" } }] });
    await expect(findZone(api, "a.notes.example.com")).resolves.toEqual(zone);
    expect(api.calls.map((call) => call.path)).toEqual(["/zones?name=a.notes.example.com", "/zones?name=notes.example.com", "/zones?name=example.com"]);
    await expect(findZone(createFakeApi({}), "notes.example.com")).rejects.toThrow("no zone of this token holds notes.example.com");
  });
});

describe("ensureDnsRecord", () => {
  const options = { zone, type: "A" as const, name: "notes.example.com", content: "203.0.113.10" };

  it("creates a missing record, proxied", async () => {
    const api = createFakeApi({});
    await expect(ensureDnsRecord(api, { ...options, check: false })).resolves.toBe("created");
    expect(api.calls[1]).toEqual({
      method: "POST",
      path: "/zones/z1/dns_records",
      body: { type: "A", name: "notes.example.com", content: "203.0.113.10", proxied: true, ttl: 1 },
    });
  });

  it("leaves a matching record alone and patches a different one", async () => {
    const same = createFakeApi({ "/zones/z1/dns_records": [{ id: "r1", content: "203.0.113.10", proxied: true }] });
    await expect(ensureDnsRecord(same, { ...options, check: false })).resolves.toBe("unchanged");
    expect(same.calls).toHaveLength(1);
    const unproxied = createFakeApi({ "/zones/z1/dns_records": [{ id: "r1", content: "203.0.113.10", proxied: false }] });
    await expect(ensureDnsRecord(unproxied, { ...options, check: false })).resolves.toBe("updated");
    expect(unproxied.calls[1]).toMatchObject({ method: "PATCH", path: "/zones/z1/dns_records/r1" });
  });

  it("writes nothing in a dry run and refuses duplicate records", async () => {
    const api = createFakeApi({ "/zones/z1/dns_records": [{ id: "r1", content: "198.51.100.1", proxied: true }] });
    await expect(ensureDnsRecord(api, { ...options, check: true })).resolves.toBe("would update");
    await expect(ensureDnsRecord(createFakeApi({}), { ...options, check: true })).resolves.toBe("would create");
    expect(api.calls.every((call) => call.method === "GET")).toBe(true);
    const two = createFakeApi({ "/zones/z1/dns_records": [{ id: "r1", content: "a" }, { id: "r2", content: "b" }] });
    await expect(ensureDnsRecord(two, { ...options, check: false })).rejects.toThrow("notes.example.com has 2 A records; leave one");
  });
});

describe("readTlsMode", () => {
  it("reads the zone's SSL/TLS mode", async () => {
    await expect(readTlsMode(createFakeApi({ "/zones/z1/settings/ssl": { id: "ssl", value: "full" } }), zone)).resolves.toBe("full");
  });
});

describe("Access", () => {
  const wanted = buildAccessApplications(app);

  it("asks for the whole host for its emails and one bypass per path", () => {
    expect(wanted).toEqual([
      {
        name: "notes (softure-host)",
        domain: "notes.example.com",
        type: "self_hosted",
        session_duration: "24h",
        app_launcher_visible: false,
        policies: [{ name: "notes owners (softure-host)", decision: "allow", include: [{ email: { email: "owner@example.com" } }] }],
      },
      {
        name: "notes bypass /api/mcp (softure-host)",
        domain: "notes.example.com/api/mcp",
        type: "self_hosted",
        session_duration: "24h",
        app_launcher_visible: false,
        policies: [{ name: "notes bypass /api/mcp (softure-host)", decision: "bypass", include: [{ everyone: {} }] }],
      },
    ]);
  });

  it("creates, updates by name, keeps what matches and never touches other applications", async () => {
    const api = createFakeApi({
      "/accounts/acc1/access/apps": [
        { id: "a1", name: "notes (softure-host)", domain: "notes.example.com", policies: [{ decision: "allow", include: [{ email: { email: "old@example.com" } }] }] },
        { id: "a2", name: "notes bypass /api/old (softure-host)", domain: "notes.example.com/api/old", policies: [] },
        { id: "a3", name: "blog (by hand)", domain: "blog.example.com", policies: [] },
      ],
    });
    const report = await reconcileAccess(api, { zone, app, check: false });
    expect(report).toEqual({
      outcomes: [
        { name: "notes (softure-host)", outcome: "updated" },
        { name: "notes bypass /api/mcp (softure-host)", outcome: "created" },
      ],
      stale: ["notes bypass /api/old (softure-host)"],
    });
    expect(api.calls.filter((call) => call.method !== "GET").map((call) => `${call.method} ${call.path}`)).toEqual([
      "PUT /accounts/acc1/access/apps/a1",
      "POST /accounts/acc1/access/apps",
    ]);
  });

  it("reports an application that already matches as unchanged and writes nothing in a dry run", async () => {
    const current = wanted.map((application, index) => ({ id: `a${index}`, name: application.name, domain: application.domain, policies: application.policies }));
    const api = createFakeApi({ "/accounts/acc1/access/apps": current });
    const report = await reconcileAccess(api, { zone, app, check: true });
    expect(report.outcomes.map((entry) => entry.outcome)).toEqual(["unchanged", "unchanged"]);
    const empty = createFakeApi({});
    const dry = await reconcileAccess(empty, { zone, app, check: true });
    expect(dry.outcomes.map((entry) => entry.outcome)).toEqual(["would create", "would create"]);
    expect(empty.calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("pages through the account's applications", async () => {
    const page = Array.from({ length: 100 }, (_, index) => ({ id: `x${index}`, name: `other ${index}`, policies: [] }));
    const calls: string[] = [];
    const api: CloudflareApi = {
      request(method, path) {
        calls.push(`${method} ${path}`);
        return Promise.resolve(path.endsWith("&page=1") ? page : []);
      },
    };
    await reconcileAccess(api, { zone, app, check: true });
    expect(calls).toEqual(["GET /accounts/acc1/access/apps?per_page=100&page=1", "GET /accounts/acc1/access/apps?per_page=100&page=2"]);
  });
});
