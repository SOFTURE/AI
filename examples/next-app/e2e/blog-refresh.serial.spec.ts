// The blog's cache refresh on the built app: `npm run blog:publish -- --commit` with BLOG_REFRESH_SECRET
// calls /api/blog/refresh, so an article page cached for blog({ revalidateSeconds }) shows the new text
// on the very next request. A serial spec (playwright.config.ts): it publishes a changed fixture text,
// which other specs read, and publishes the original back at the end.
import { spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { BLOG_REFRESH_SECRET } from "./outbox.ts";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(APP_DIR, "content/blog/bond-basics.md");
const ADDED = "A bond fund holds many bonds at once, so one late payment matters less.";

test.describe.configure({ mode: "serial" });

/** A fresh address per request (198.18.0.0/15), so the refresh bucket never fills up across runs. */
function randomAddress(): string {
  return `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`;
}

/** Runs the app's publish command on one file, as an editor would, with the app's origin and secret. */
function publish(file: string, baseURL: string): string {
  const result = spawnSync("npm", ["run", "--silent", "blog:publish", "--", file, "--commit", "--no-indexnow"], {
    cwd: APP_DIR,
    encoding: "utf8",
    env: { ...process.env, APP_ORIGIN: baseURL, BLOG_REFRESH_SECRET },
  });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  return result.stdout;
}

test("the refresh route refuses a request without the secret", async ({ request }) => {
  for (const authorization of [undefined, "Bearer not-the-secret"]) {
    const response = await request.post("/api/blog/refresh", {
      headers: { "cf-connecting-ip": randomAddress(), ...(authorization === undefined ? {} : { authorization }) },
    });
    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toBe("Bearer");
  }
});

test("a committed publish shows on the cached article page at once", async ({ request, baseURL }) => {
  const origin = String(baseURL);
  // Twice: the first request renders and caches the page, the second is served from that cache.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const before = await request.get("/blog/bond-basics");
    expect(before.status()).toBe(200);
    expect(await before.text()).not.toContain(ADDED);
  }

  const dir = mkdtempSync(join(tmpdir(), "softure-blog-refresh-"));
  try {
    const changed = join(dir, "bond-basics.md");
    writeFileSync(changed, `${readFileSync(FIXTURE, "utf8").trimEnd()}\n\n${ADDED}\n`);
    const output = publish(changed, origin);
    expect(output).toContain("changed bond-basics published/bond-basics -> published/bond-basics");
    expect(output).toContain(`cache: refreshed ${origin}/api/blog/refresh`);

    const after = await request.get("/blog/bond-basics");
    expect(after.status()).toBe(200);
    expect(await after.text()).toContain(ADDED);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    expect(publish(FIXTURE, origin)).toContain(`cache: refreshed ${origin}/api/blog/refresh`);
  }
  expect(await (await request.get("/blog/bond-basics")).text()).not.toContain(ADDED);
});
