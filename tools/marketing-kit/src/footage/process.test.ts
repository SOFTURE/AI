import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readFfmpegProgressSeconds, runProcess } from "./process.js";

/** The children here are `node` itself, so the tests need no ffmpeg. */
const node = (script: string): { command: string; args: string[] } => ({ command: process.execPath, args: ["-e", script] });

describe("runProcess", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "footage-process-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("collects the output and the exit code", async () => {
    const outcome = await runProcess(node("process.stdout.write('out'); process.stderr.write('err'); process.exit(3)"));
    expect(outcome).toEqual({ kind: "exited", code: 3, signal: null, stdout: "out", stderr: "err" });
  });

  it("hands each line on, a last line without a newline included", async () => {
    const lines: string[] = [];
    await runProcess({ ...node("process.stdout.write('a\\nb\\r\\nc')"), onStdoutLine: (line) => lines.push(line) });
    expect(lines).toEqual(["a", "b", "c"]);
  });

  it("reports a command that does not start as a value", async () => {
    const outcome = await runProcess({ command: join(dir, "no-such-tool"), args: [] });
    expect(outcome.kind).toBe("not-started");
  });

  it("kills the child on abort, removes its partial file and rejects with the signal's reason", async () => {
    const partial = join(dir, "partial.mp4");
    writeFileSync(partial, "half a film");
    const controller = new AbortController();
    const started = Date.now();
    const run = runProcess({ ...node("setTimeout(() => {}, 60000)"), signal: controller.signal, removeOnAbort: [partial] });
    setTimeout(() => controller.abort(), 50);
    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(existsSync(partial)).toBe(false);
  });

  it("starts nothing when the signal is already aborted", async () => {
    const marker = join(dir, "ran");
    const controller = new AbortController();
    controller.abort(new Error("the job was cancelled"));
    await expect(runProcess({ ...node(`require("node:fs").writeFileSync(${JSON.stringify(marker)}, "")`), signal: controller.signal })).rejects.toThrow("the job was cancelled");
    expect(existsSync(marker)).toBe(false);
  });
});

describe("readFfmpegProgressSeconds", () => {
  it("reads out_time_us as seconds and ignores every other line", () => {
    expect(readFfmpegProgressSeconds("out_time_us=2500000")).toBe(2.5);
    expect(readFfmpegProgressSeconds("out_time_ms=2500000")).toBeNull();
    expect(readFfmpegProgressSeconds("out_time_us=N/A")).toBeNull();
    expect(readFfmpegProgressSeconds("progress=end")).toBeNull();
  });
});
