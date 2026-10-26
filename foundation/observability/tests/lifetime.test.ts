import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { startOtlpReceiver, type OtlpReceiver } from "./otlp-receiver.js";

const CHILD = fileURLToPath(new URL("./fixtures/short-lived-child.ts", import.meta.url));

type ChildResult = { code: number | null; stderr: string };

let receiver: OtlpReceiver | undefined;

afterEach(async () => {
  await receiver?.close();
  receiver = undefined;
});

function runChild(endpoint: string): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    // The source condition reads workspace packages from `src/`, as the tests do: CI runs them before any build.
    const child = spawn(process.execPath, ["--conditions=@softure-ai/source", "--import", "tsx", CHILD], {
      env: { PATH: process.env.PATH, CHILD_ENDPOINT: endpoint },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, stderr }));
  });
}

describe("lifetime: short", () => {
  it("flushes logs before a script ends on its own, exports no metrics and keeps the script's exit code", async () => {
    receiver = await startOtlpReceiver();

    const result = await runChild(receiver.url);

    expect(result.code, result.stderr).toBe(3);
    expect(receiver.bodyOf("/v1/logs").toString()).toContain("migration done");
    expect(receiver.requests.filter((request) => request.path === "/v1/metrics")).toEqual([]);
  });
});
