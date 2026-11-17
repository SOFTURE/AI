import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// workerd leaves a bundled Worker's `import.meta.url` undefined. A config that enables a module loads at the Worker's
// start (a jobs Worker's scheduled handler needs it before any request), and every module package resolves its
// migrations folder from `import.meta.url` when it loads, so the Worker must start anyway (@softure-ai/core
// resolveMigrationsDir). Runs in the Workers suite only: it needs wrangler's workerd, not the app.
const FIXTURE = join(import.meta.dirname, "fixtures", "workerd-module-config");
const PORT = 3195;
const ORIGIN = `http://127.0.0.1:${String(PORT)}`;

test.skip(process.env.E2E_HOST !== "cloudflare", "the Workers suite only (playwright.workers.config.ts)");

let wrangler: ChildProcess | undefined;
let output = "";

test.beforeAll(async () => {
  test.setTimeout(120_000);
  wrangler = spawn(
    "npx",
    ["wrangler", "dev", "--config", join(FIXTURE, "wrangler.jsonc"), "--port", String(PORT), "--ip", "127.0.0.1", "--inspector-port", "9239"],
    { cwd: FIXTURE, env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"] },
  );
  wrangler.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  wrangler.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  await expect
    .poll(async () => fetch(ORIGIN).then((response) => response.status).catch(() => 0), { timeout: 90_000 })
    .not.toBe(0)
    .catch((error: unknown) => {
      throw new Error(`wrangler dev did not serve the Worker:\n${output}`, { cause: error });
    });
});

test.afterAll(() => {
  wrangler?.kill("SIGTERM");
});

test("a Worker that enables a module in its config starts and keeps the module's migrations folder", async () => {
  const response = await fetch(ORIGIN);
  expect(response.status, output).toBe(200);
  expect(await response.json()).toEqual({
    platform: { runtime: "workers", host: "cloudflare" },
    modules: [{ id: "security", migrations: "file:///migrations/" }],
  });
});
