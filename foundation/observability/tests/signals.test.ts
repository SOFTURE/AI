import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { startOtlpReceiver, type OtlpReceiver } from "./otlp-receiver.js";

const CHILD = fileURLToPath(new URL("./fixtures/signal-child.ts", import.meta.url));

type ChildResult = { code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string };

let receiver: OtlpReceiver | undefined;

afterEach(async () => {
  await receiver?.close();
  receiver = undefined;
});

/** Starts the child, sends SIGTERM once it is ready and resolves when it exits. */
function runChild(endpoint: string, withAppHandler: boolean): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    // `node --import tsx`, not the tsx binary: its wrapper process would receive the signal instead of the child.
    // The source condition reads workspace packages from `src/`, as the tests do: CI runs them before any build.
    const child = spawn(process.execPath, ["--conditions=@softure-ai/source", "--import", "tsx", CHILD], {
      env: {
        PATH: process.env.PATH,
        CHILD_ENDPOINT: endpoint,
        CHILD_APP_HANDLER: withAppHandler ? "1" : "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    let signalled = false;
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (!signalled && stdout.includes("ready")) {
        signalled = true;
        child.kill("SIGTERM");
      }
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

describe("handleSignals", () => {
  it("flushes on SIGTERM and lets the signal end the process", async () => {
    receiver = await startOtlpReceiver();

    const result = await runChild(receiver.url, false);

    expect(result.signal, result.stderr).toBe("SIGTERM");
    expect(receiver.requests.some((request) => request.path === "/v1/logs")).toBe(true);
  });

  it("flushes and leaves the exit to the app when the app listens to SIGTERM itself", async () => {
    receiver = await startOtlpReceiver();

    const result = await runChild(receiver.url, true);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout.match(/app handler ran/g)).toHaveLength(1);
    expect(receiver.requests.some((request) => request.path === "/v1/logs")).toBe(true);
  });
});
