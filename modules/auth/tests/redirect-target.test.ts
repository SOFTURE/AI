// The redirect after an auth action: the app's `rewriteRedirect` may change the path (e.g. to keep
// a channel tag), but never send the visitor to another origin, and a failing rewrite never blocks
// the redirect.
import { resolveRedirectTarget } from "../src/redirect-target.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "./support.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveRedirectTarget", () => {
  it("returns auth's path when the app sets no rewrite", async () => {
    expect(await resolveRedirectTarget(createConfig(), "/account")).toBe("/account");
  });

  it("returns the rewritten path, from a function or a promise, with the app's config", async () => {
    const rewriteRedirect = vi.fn((path: string) => `${path}?z=ads`);
    const config = createConfig({ auth: { rewriteRedirect } });
    expect(await resolveRedirectTarget(config, "/account")).toBe("/account?z=ads");
    expect(rewriteRedirect).toHaveBeenCalledExactlyOnceWith("/account", { config });

    const asyncConfig = createConfig({ auth: { rewriteRedirect: (path) => Promise.resolve(`${path}&z=ads`) } });
    expect(await resolveRedirectTarget(asyncConfig, "/login?reset=1")).toBe("/login?reset=1&z=ads");
  });

  it("keeps auth's path when the rewrite leaves the app or returns no path", async () => {
    for (const rewritten of ["https://evil.example.com/account", "//evil.example.com/account", "/\\evil.example.com", "account", ""]) {
      const config = createConfig({ auth: { rewriteRedirect: () => rewritten } });
      expect(await resolveRedirectTarget(config, "/account")).toBe("/account");
    }
    const notAString = createConfig({ auth: { rewriteRedirect: () => 42 as unknown as string } });
    expect(await resolveRedirectTarget(notAString, "/account")).toBe("/account");
  });

  it("keeps auth's path and logs the error's name when the rewrite throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const config = createConfig({ auth: { rewriteRedirect: () => Promise.reject(new TypeError("secret detail")) } });
    expect(await resolveRedirectTarget(config, "/account")).toBe("/account");
    expect(log).toHaveBeenCalledExactlyOnceWith("@softure-ai/auth: rewriting the redirect to /account failed: TypeError");
  });
});
