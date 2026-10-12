import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../cli/run.js";
import { installFakeSsh, type FakeSsh } from "./fake-ssh.js";

let fake: FakeSsh | null = null;

afterEach(() => {
  fake?.restore();
  fake = null;
});

function runSsh(env: Record<string, string | undefined>, args: string[], input: string) {
  return spawnSync("ssh", args, { env, input, encoding: "utf8" });
}

describe("installFakeSsh", () => {
  it("answers an ssh found on PATH with the reply and records its arguments and stdin", () => {
    const env: Record<string, string | undefined> = { PATH: process.env.PATH };
    fake = installFakeSsh({ reply: { stdout: "remote: out\n", stderr: "remote: err\n", status: 3 }, env });
    const result = runSsh(env, ["-T", "--", "app-prod", "run grant-access --commit"], "from the operator\n");
    expect(result.status).toBe(3);
    expect(result.stdout).toBe("remote: out\n");
    expect(result.stderr).toBe("remote: err\n");
    expect(fake.calls).toEqual([{ args: ["-T", "--", "app-prod", "run grant-access --commit"], stdin: "from the operator\n" }]);
  });

  it("keeps arguments with blanks, newlines and none at all as they were", () => {
    const env: Record<string, string | undefined> = { PATH: process.env.PATH };
    fake = installFakeSsh({ env });
    runSsh(env, ["two words", "line\nbreak", ""], "");
    runSsh(env, [], "");
    expect(fake.calls).toEqual([
      { args: ["two words", "line\nbreak", ""], stdin: "" },
      { args: [], stdin: "" },
    ]);
  });

  it("uses a list of replies one per call, the last one repeating", () => {
    const env: Record<string, string | undefined> = { PATH: process.env.PATH };
    fake = installFakeSsh({ reply: [{ stdout: "first\n" }, { stdout: "then\n", status: 1 }], env });
    const outputs = [1, 2, 3].map(() => runSsh(env, ["x"], ""));
    expect(outputs.map((result) => [result.stdout, result.status])).toEqual([
      ["first\n", 0],
      ["then\n", 1],
      ["then\n", 1],
    ]);
    expect(fake.calls).toHaveLength(3);
  });

  it("answers with nothing and status 0 by default and starts with no calls", () => {
    const env: Record<string, string | undefined> = { PATH: process.env.PATH };
    fake = installFakeSsh({ env });
    expect(fake.calls).toEqual([]);
    const result = runSsh(env, ["x"], "");
    expect([result.stdout, result.stderr, result.status]).toEqual(["", "", 0]);
  });

  it("restores PATH and removes its folder", () => {
    const env: Record<string, string | undefined> = { PATH: "/usr/bin:/bin" };
    const installed = installFakeSsh({ env });
    expect(env.PATH).toBe(`${installed.binDir}:/usr/bin:/bin`);
    installed.restore();
    installed.restore();
    expect(env.PATH).toBe("/usr/bin:/bin");
    expect(existsSync(installed.binDir)).toBe(false);
  });

  it("removes PATH again when the environment had none", () => {
    const env: Record<string, string | undefined> = {};
    const installed = installFakeSsh({ env });
    expect(env.PATH).toBe(installed.binDir);
    installed.restore();
    expect("PATH" in env).toBe(false);
  });

  it("changes process.env when no environment is given", () => {
    const before = process.env.PATH;
    fake = installFakeSsh();
    expect(process.env.PATH?.startsWith(`${fake.binDir}:`)).toBe(true);
    fake.restore();
    expect(process.env.PATH).toBe(before);
  });

  it.each([
    [{ reply: [] }, "installFakeSsh: reply is an empty list; give at least one reply"],
    [{ reply: { status: 256 } }, "installFakeSsh: reply 0 has status 256; use an integer from 0 to 255"],
    [{ reply: [{}, { status: 1.5 }] }, "installFakeSsh: reply 1 has status 1.5; use an integer from 0 to 255"],
    [{ name: "../ssh" }, 'installFakeSsh: "../ssh" is not a program name'],
  ])("refuses %j", (options, message) => {
    expect(() => installFakeSsh({ ...options, env: {} })).toThrow(message);
  });

  it("stands in for ssh behind softure-deploy run", async () => {
    const env: Record<string, string | undefined> = { PATH: process.env.PATH };
    fake = installFakeSsh({ reply: { stdout: "COMMITTED\n" }, env });
    const out: string[] = [];
    const status = await runCli(["run", "--host=app-prod", "grant-access", "--email=a@example.com", "--commit"], {
      cwd: process.cwd(),
      env,
      stdout: (text) => out.push(text),
      stderr: () => undefined,
      stdin: Readable.from([""]),
    });
    expect(status).toBe(0);
    expect(out.join("")).toBe("COMMITTED\n");
    expect(fake.calls.map((call) => call.args)).toEqual([["-T", "--", "app-prod", "run grant-access --email=a@example.com --commit"]]);
  });
});
