// @softure-ai/ops on the built app: GET /api/health runs the database check and the checks the
// guestbook, auth, feature-switches, mcp-access, mailing, privacy, waitlist and analytics modules contribute. The 503 side (Postgres stopped) is covered by the container run,
// scripts/container.mjs.
import { expect, test } from "@playwright/test";

test("GET /api/health answers 200 with the database and module checks, never cached", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok", checks: { database: "ok", guestbook: "ok", auth: "ok", "feature-switches": "ok", "mcp-access": "ok", mailing: "ok", privacy: "ok", waitlist: "ok", analytics: "ok" } });
});
