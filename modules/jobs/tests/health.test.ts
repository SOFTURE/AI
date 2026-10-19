// The worker's heartbeat: the loop touches a file after each round whose claims reached the database, and
// `--health` (or checkJobWorkerHealth) fails when that file is missing or older than the limit.
import { existsSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { ok, type SoftureConfig } from "@softure-ai/core";
import { defineJobHandler } from "@softure-ai/jobs";
import type { JobsLogger } from "@softure-ai/jobs/server";
import { checkJobWorkerHealth, getJobWorkerHealthMaxAgeMs, runJobWorker, runJobWorkerProcess } from "@softure-ai/jobs/worker";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig } from "./support.js";

const FAST = { pollIntervalMs: 50 };
const handlers = { "ai.reply": defineJobHandler({ payload: z.object({}), run: () => Promise.resolve(ok()) }) };
const silentLogger: JobsLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

function createRecordingLogger(): JobsLogger & { lines: string[] } {
  const lines: string[] = [];
  const write = (level: string) => (message: string) => lines.push(`${level}: ${message}`);
  return { lines, info: write("info"), warn: write("warn"), error: write("error") };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("waitFor: timed out");
    await delay(10);
  }
}

let dir: string;
let healthFile: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-jobs-health-"));
  healthFile = join(dir, "worker.alive");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runJobWorker with a health file", () => {
  let database: TestDatabase;
  let config: SoftureConfig;
  let isClosed: boolean;

  beforeEach(async () => {
    config = createConfig(FAST);
    database = await createTestDatabase(config.modules);
    isClosed = false;
  });

  afterEach(async () => {
    if (!isClosed) await database.close();
  });

  it("removes a stale file at start, keeps the file fresh while it runs and removes it after a clean stop", async () => {
    writeFileSync(healthFile, "stale");
    const old = new Date(Date.now() - 60_000);
    utimesSync(healthFile, old, old);
    const controller = new AbortController();
    const worker = runJobWorker({ db: database.db, config, handlers, signal: controller.signal, logger: silentLogger, healthFile });

    await waitFor(() => existsSync(healthFile) && statSync(healthFile).mtimeMs > old.getTime() + 1000);
    const first = statSync(healthFile).mtimeMs;
    await waitFor(() => statSync(healthFile).mtimeMs > first);
    controller.abort();
    await worker;

    expect(existsSync(healthFile)).toBe(false);
  });

  it("does not touch the file after a round whose claims failed", async () => {
    const controller = new AbortController();
    const logger = createRecordingLogger();
    const worker = runJobWorker({ db: database.db, config, handlers, signal: controller.signal, logger, healthFile });
    await waitFor(() => existsSync(healthFile));

    await database.close();
    isClosed = true;
    rmSync(healthFile);
    await waitFor(() => logger.lines.includes("error: could not claim jobs"));
    await delay(200);

    expect(existsSync(healthFile)).toBe(false);
    controller.abort();
    await worker;
  });

  it("writes nothing without a health file", async () => {
    const controller = new AbortController();
    const worker = runJobWorker({ db: database.db, config, handlers, signal: controller.signal, logger: silentLogger });
    await delay(150);
    controller.abort();
    await worker;
    expect(existsSync(healthFile)).toBe(false);
  });
});

describe("checkJobWorkerHealth", () => {
  it("fails on a missing file, fails on a file older than the limit and passes on a fresh one", () => {
    expect(checkJobWorkerHealth({ healthFile, maxAgeMs: 30_000 })).toEqual({ ok: false, reason: "missing" });

    writeFileSync(healthFile, "");
    const mtimeMs = statSync(healthFile).mtimeMs;
    expect(checkJobWorkerHealth({ healthFile, maxAgeMs: 30_000, now: mtimeMs + 30_000 })).toEqual({ ok: true, ageMs: 30_000 });
    expect(checkJobWorkerHealth({ healthFile, maxAgeMs: 30_000, now: mtimeMs + 30_001 })).toEqual({ ok: false, reason: "stale", ageMs: 30_001 });
  });
});

describe("getJobWorkerHealthMaxAgeMs", () => {
  it("is 30 s at short poll intervals and five poll intervals at long ones", () => {
    expect(getJobWorkerHealthMaxAgeMs(createConfig())).toBe(30_000);
    expect(getJobWorkerHealthMaxAgeMs(createConfig({ pollIntervalMs: 6000 }))).toBe(30_000);
    expect(getJobWorkerHealthMaxAgeMs(createConfig({ pollIntervalMs: 10_000 }))).toBe(50_000);
  });
});

describe("runJobWorkerProcess --health", () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it("exits 0 on a fresh file and 1 on a missing or stale one, without opening the database", async () => {
    // A config whose database cannot be opened: the check must not try.
    const config = { ...createConfig(), database: null };
    const logger = createRecordingLogger();

    expect(await runJobWorkerProcess({ config, handlers, logger, healthFile, argv: ["--health"] })).toBe(1);
    expect(process.exitCode).toBe(1);
    writeFileSync(healthFile, "");
    expect(await runJobWorkerProcess({ config, handlers, logger, healthFile, argv: ["--health"] })).toBe(0);
    const old = new Date(Date.now() - 120_000);
    utimesSync(healthFile, old, old);
    expect(await runJobWorkerProcess({ config, handlers, logger, healthFile, healthMaxAgeMs: 60_000, argv: ["--health"] })).toBe(1);

    expect(logger.lines[0]).toBe(`error: the worker's health file is missing: ${healthFile}`);
    expect(logger.lines[1]).toMatch(/^info: the worker's loop ran \d+ ms ago$/);
    expect(logger.lines[2]).toMatch(/^error: the worker's loop last ran 1\d{5} ms ago \(limit 60000 ms\)$/);
  });

  it("exits 1 on --health without a health file, instead of starting a worker", async () => {
    const logger = createRecordingLogger();
    expect(await runJobWorkerProcess({ config: createConfig(), handlers, logger, argv: ["--health"] })).toBe(1);
    expect(logger.lines).toEqual(["error: --health needs the worker's healthFile option; pass healthFile to runJobWorkerProcess"]);
  });
});
