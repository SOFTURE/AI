// @softure-ai/ops on the built app: GET /api/health runs the database check and the checks the
// guestbook, auth, feature-switches, mcp-access, mailing, privacy, waitlist, analytics, billing and blog modules contribute. The 503 side (Postgres stopped) is covered by the container run,
// scripts/container.mjs.
import { expect, test } from "@playwright/test";

test("GET /api/health answers 200 with the database and module checks, never cached", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok", checks: { database: "ok", guestbook: "ok", auth: "ok", "feature-switches": "ok", "mcp-access": "ok", mailing: "ok", privacy: "ok", waitlist: "ok", analytics: "ok", billing: "ok", blog: "ok" } });
});

// The build info route (issue #878): the commit and the build time withBuildInfo inlined at `next build` reach the
// route inside the package's bundled code; the release is unset outside a deploy.
test("GET /api/health/build answers the build's commit, build time and start time, never cached", async ({ request }) => {
  const response = await request.get("/api/health/build");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const info = (await response.json()) as Record<string, unknown>;
  expect(Object.keys(info).sort()).toEqual(["builtAt", "commit", "release", "startedAt"]);
  expect(info.release).toBeNull();
  expect(info.commit).toMatch(/^[0-9a-f]{40}$/);
  const builtAt = Date.parse(String(info.builtAt));
  const startedAt = Date.parse(String(info.startedAt));
  expect(builtAt).toBeLessThanOrEqual(startedAt);
  expect(startedAt).toBeLessThanOrEqual(Date.now());
});
