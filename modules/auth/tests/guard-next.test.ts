// The guard's response run through Next's own proxy adapter (#452): unit tests call the guard directly
// and cannot see what Next does with its `Location`.
import { AsyncLocalStorage } from "node:async_hooks";
import { createAuthGuard } from "@softure-ai/auth/proxy";
import { describe, expect, it } from "vitest";
import { createConfig } from "./support.js";

interface AdapterParams {
  readonly page: string;
  readonly handler: (request: Request) => Response;
  readonly request: { url: string; headers: Record<string, string>; method: string; nextConfig: Record<string, never> };
}
type Adapter = (params: AdapterParams) => Promise<{ response: Response }>;

// Next's proxy runs where the edge runtime provides this global; its modules read it as they load.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
const { adapter } = (await import("next/dist/server/web/adapter.js")) as unknown as { adapter: Adapter };

const config = createConfig({ appOrigin: "https://app.example.com" });
const ORIGIN = "http://localhost:41234";

async function runInNextProxy(redirect: "absolute" | "relative", path: string): Promise<Response> {
  const guard = createAuthGuard(config, { protect: ["/account"], redirect });
  const result = await adapter({
    page: "/proxy",
    handler: (request) => guard(request) ?? new Response(null, { status: 200 }),
    request: { url: `${ORIGIN}${path}`, headers: { host: "localhost:41234" }, method: "GET", nextConfig: {} },
  });
  return result.response;
}

describe("createAuthGuard inside Next's proxy (#452)", () => {
  it("answers a relative redirect with 307 and a path-only Location on the wire", async () => {
    const response = await runInNextProxy("relative", "/account/billing?tab=1");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/login?next=%2Faccount%2Fbilling%3Ftab%3D1");
  });

  it("keeps the default redirect on appOrigin", async () => {
    const response = await runInNextProxy("absolute", "/account");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.com/login?next=%2Faccount");
  });

  it.each(["absolute", "relative"] as const)("gives Next a Location that parses without a base in %s mode", (redirect) => {
    const location = createAuthGuard(config, { protect: ["/account"], redirect })(new Request(`${ORIGIN}/account`))?.headers.get("location");
    expect(() => new URL(location ?? "")).not.toThrow();
  });
});
