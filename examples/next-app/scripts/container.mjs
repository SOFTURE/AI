// @ts-check
// The container run of the example app: `npm run e2e:container` at the repository root, and the
// `container` job of .github/workflows/e2e.yml. It proves the @softure-ai/ops container recipe end
// to end on compose.container.yaml:
//
// 1. builds the image and starts Postgres, which creates the migrator and app roles;
// 2. runs the one-off migrate service as the migrator, then the app as the app role, and waits until
//    the image HEALTHCHECK (GET /api/health) reports healthy;
// 3. checks that /api/health answers 200 with the database and module checks;
// 4. checks that the app role cannot change the schema (least privilege);
// 5. stops Postgres and checks that /api/health turns 503 (FIRE_TRACKER's baseline: a dead database
//    must not look healthy);
// 6. removes the containers and the volume, also when a step failed.
//
// `--no-build` uses an image built before (`docker build -f examples/next-app/Dockerfile -t
// softure-example-app:local .`), e.g. one built with network options compose cannot pass.
// Docker Hub limits anonymous pulls; NODE_IMAGE and POSTGRES_IMAGE name other copies of
// node:22-alpine and postgres:16 (e.g. mirror.gcr.io/library/node:22-alpine).
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_PORT = process.env.APP_PORT ?? "3200";
const HEALTH_URL = `http://localhost:${APP_PORT}/api/health`;
const COMPOSE = ["compose", "--file", "compose.container.yaml"];
const UNHEALTHY_DEADLINE_MS = 30_000;
const SHOULD_BUILD = !process.argv.includes("--no-build");

/**
 * Runs docker with the compose file and returns its output; throws when it fails unless `allowFailure`.
 * @param {string[]} args
 * @param {{ allowFailure?: boolean, quiet?: boolean }} [options]
 */
function compose(args, options = {}) {
  console.log(`\n> docker ${[...COMPOSE, ...args].join(" ")}`);
  const result = spawnSync("docker", [...COMPOSE, ...args], {
    cwd: APP_DIR,
    encoding: "utf8",
    stdio: options.quiet ? "pipe" : ["ignore", "inherit", "inherit"],
    env: { ...process.env, APP_PORT },
  });
  if (result.error) {
    throw new Error(`Running docker ${args.join(" ")} failed: ${result.error.message}`);
  }
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`docker ${args.join(" ")} exited with ${String(result.status)}\n${result.stderr ?? ""}`);
  }
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

/**
 * @param {boolean} condition
 * @param {string} message
 */
function check(condition, message) {
  if (!condition) throw new Error(`container check failed: ${message}`);
  console.log(`ok: ${message}`);
}

async function readHealth() {
  const response = await fetch(HEALTH_URL);
  return { status: response.status, body: /** @type {unknown} */ (await response.json()) };
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

async function main() {
  compose(["up", ...(SHOULD_BUILD ? ["--build"] : []), "--wait", "app"]);

  const migrateLog = compose(["logs", "--no-color", "migrate"], { quiet: true }).output;
  check(/migration\(s\) applied/.test(migrateLog), "the migrate service applied the module migrations before the app started");

  const healthy = await readHealth();
  check(healthy.status === 200, `GET /api/health answers 200 (got ${String(healthy.status)})`);
  check(
    JSON.stringify(healthy.body) === JSON.stringify({ status: "ok", checks: { database: "ok", guestbook: "ok", auth: "ok", "feature-switches": "ok", "mcp-access": "ok", mailing: "ok", privacy: "ok", waitlist: "ok", analytics: "ok", billing: "ok", blog: "ok" } }),
    `the answer lists the database, guestbook, auth, feature-switches, mcp-access, mailing, privacy, waitlist, analytics and billing checks (got ${JSON.stringify(healthy.body)})`,
  );

  const ddl = compose(
    ["exec", "-T", "-e", "PGPASSWORD=app-local", "postgres", "psql", "-h", "127.0.0.1", "-U", "softure_app", "-d", "softure_example",
      "-v", "ON_ERROR_STOP=1", "-c", "CREATE TABLE guestbook.intruder (id int)"],
    { allowFailure: true, quiet: true },
  );
  check(ddl.status !== 0 && /permission denied/.test(ddl.output), "the app role cannot create a table in a module schema");

  compose(["stop", "postgres"]);
  const deadline = Date.now() + UNHEALTHY_DEADLINE_MS;
  let unhealthy = await readHealth();
  while (unhealthy.status === 200 && Date.now() < deadline) {
    await sleep(1_000);
    unhealthy = await readHealth();
  }
  check(unhealthy.status === 503, `GET /api/health answers 503 with Postgres stopped (got ${String(unhealthy.status)})`);
  // `failed` when the connection is refused, `timed_out` when it hangs (on GitHub runners the
  // stopped container's address stops answering): both mean "will not take traffic".
  const body = /** @type {{ status?: unknown, checks?: Record<string, unknown> }} */ (unhealthy.body);
  const isDown = (/** @type {unknown} */ state) => state === "failed" || state === "timed_out";
  check(
    body.status === "unavailable" && isDown(body.checks?.database) && isDown(body.checks?.guestbook) && isDown(body.checks?.auth) && isDown(body.checks?.["feature-switches"]) && isDown(body.checks?.["mcp-access"]) && isDown(body.checks?.mailing) && isDown(body.checks?.privacy) && isDown(body.checks?.waitlist) && isDown(body.checks?.analytics) && isDown(body.checks?.billing),
    `the answer marks the database, guestbook, auth, feature-switches, mcp-access, mailing, privacy, waitlist, analytics and billing checks as down (got ${JSON.stringify(unhealthy.body)})`,
  );
}

try {
  await main();
  console.log("\ncontainer run passed");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  compose(["logs", "--no-color", "--tail", "50"], { allowFailure: true });
  process.exitCode = 1;
} finally {
  compose(["down", "--volumes", "--remove-orphans"], { allowFailure: true });
}
