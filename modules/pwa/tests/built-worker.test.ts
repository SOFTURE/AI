// The worker runs from its function's text, so the text tsc emits for the package must run on its own: no import, no
// helper outside the function's body. The file is compiled as the build compiles it and its source evaluated.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runInThisContext } from "node:vm";

import type { ServiceWorkerConfig, WorkerScope } from "@softure-ai/pwa/worker";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

import { answer, FakeWorkerScope, navigation } from "./support/fake-worker-scope.js";

const SOURCE = new URL("../src/worker/service-worker.ts", import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "softure-pwa-worker-"));

async function loadBuiltWorker(): Promise<(scope: WorkerScope, config: ServiceWorkerConfig) => void> {
  const configPath = ts.findConfigFile(new URL("..", import.meta.url).pathname, (path) => ts.sys.fileExists(path), "tsconfig.build.json");
  if (configPath === undefined) throw new Error("no tsconfig.build.json for the pwa package");
  const { config } = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path)) as { config: unknown };
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, join(configPath, ".."));
  const output = ts.transpileModule(readFileSync(SOURCE, "utf8"), { compilerOptions: { ...options, sourceMap: false } });
  const file = join(outDir, "service-worker.mjs");
  writeFileSync(file, output.outputText);
  const built = (await import(pathToFileURL(file).href)) as { serviceWorker: (scope: WorkerScope, config: ServiceWorkerConfig) => void };
  return built.serviceWorker;
}

describe("the built worker", () => {
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  it("runs from its own text, as /sw.js runs it", async () => {
    const serviceWorker = await loadBuiltWorker();
    const config: ServiceWorkerConfig = {
      app: "fire",
      build: "b1",
      offlinePath: "/offline",
      excludedPrefixes: ["/sw.js"],
      staticPrefixes: ["/_next/static/"],
      navigationTimeoutMs: 20,
      navigationMaxWaitMs: 80,
      assetTimeoutMs: 40,
      // The start page kept at install runs from the text too (#924).
      startPath: "/tasks",
      maxPages: 60,
      extraOrigins: [],
    };
    const scope = new FakeWorkerScope();
    scope.route("/offline", answer("<html>offline</html>"));
    scope.route("/tasks", answer("<p>tasks</p>"));

    // A fresh script from the text alone: anything it reached outside its body would be undefined here.
    const run = runInThisContext(`(function (self, config) { (${serviceWorker.toString()})(self, config); })`) as (
      self: WorkerScope,
      workerConfig: ServiceWorkerConfig,
    ) => void;
    run(scope.asScope(), config);
    await scope.dispatchLifecycle("install");
    expect(scope.caches.get("fire-pages-b1").getPaths()).toEqual(["/tasks"]);
    const dispatched = scope.dispatchFetch(navigation("/tasks"));

    expect(await (await dispatched.response)?.text()).toBe("<p>tasks</p>");
    await dispatched.settled();
    expect(scope.caches.get("fire-pages-b1").getPaths()).toEqual(["/tasks"]);
  });
});
