import { createAuthGuard } from "@softure-ai/auth/proxy";
import { describe, expect, it } from "vitest";
import { createConfig } from "./support.js";

const config = createConfig({ appOrigin: "https://app.example.com" });
const guard = createAuthGuard(config, { protect: ["/account", "/dashboard/"] });

function request(path: string, cookie?: string): Request {
  // The internal host a reverse proxy forwards to; redirects must not use it.
  return new Request(`http://10.0.0.5:3000${path}`, { headers: cookie === undefined ? {} : { cookie } });
}

describe("createAuthGuard", () => {
  it("redirects a protected path without a session cookie to the login page on appOrigin, keeping the path", () => {
    const response = guard(request("/account/billing?tab=invoices"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("https://app.example.com/login?next=%2Faccount%2Fbilling%3Ftab%3Dinvoices");
  });

  it("lets a protected path with a session cookie through", () => {
    expect(guard(request("/account", "theme=dark; __Host-softure_session=abc"))).toBeNull();
  });

  it("treats an empty session cookie or another cookie's name as no session", () => {
    expect(guard(request("/account", "__Host-softure_session="))?.status).toBe(307);
    expect(guard(request("/account", "softure_session=abc"))?.status).toBe(307);
    expect(guard(request("/account", "x__Host-softure_session=abc"))?.status).toBe(307);
  });

  it.each(["/", "/login", "/accounting", "/dashboards", "/public/account"])("lets %s through without a cookie", (path) => {
    expect(guard(request(path))).toBeNull();
  });

  it.each(["/account", "/account/", "/dashboard", "/dashboard/stats"])("guards %s, matching whole segments", (path) => {
    expect(guard(request(path))?.status).toBe(307);
  });

  it.each(["/%61ccount", "/ACCOUNT/password", "/Account", "/%E0%A4%A"])("guards the encoded or differently cased path %s", (path) => {
    expect(guard(request(path))?.status).toBe(307);
  });

  it("always guards the change-password route", () => {
    const bare = createAuthGuard(config, { protect: [] });
    expect(bare(request("/account/password"))?.status).toBe(307);
    expect(bare(request("/account"))).toBeNull();
  });

  it("follows the app's route overrides and cookie name", () => {
    const custom = createConfig({ appOrigin: "http://localhost:3000", auth: { cookie: { name: "sid" }, routes: { login: "/sign-in" } } });
    const customGuard = createAuthGuard(custom, { protect: ["/app"] });
    expect(customGuard(request("/app"))?.headers.get("location")).toBe("http://localhost:3000/sign-in?next=%2Fapp");
    expect(customGuard(request("/app", "sid=abc"))).toBeNull();
  });

  it("refuses a protected path that does not start with /", () => {
    expect(() => createAuthGuard(config, { protect: ["account"] })).toThrow('createAuthGuard: protected path "account" must start with /');
  });
});
