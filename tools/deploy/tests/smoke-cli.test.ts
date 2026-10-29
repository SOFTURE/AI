import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CliIo } from "../src/cli/io.js";
import { runCli } from "../src/cli/run.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";

let dir: string;
let out: string[];
let err: string[];
let server: Server;
let baseUrl: string;
let answer: { status: number; body: string };
let requests: { url: string | undefined; headers: IncomingHttpHeaders }[];

function makeIo(): CliIo {
  return { cwd: dir, env: {}, stdout: (text) => out.push(text), stderr: (text) => err.push(text) };
}

function answerInfo(info: Record<string, unknown>): void {
  answer = { status: 200, body: JSON.stringify(info) };
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-smoke-"));
  out = [];
  err = [];
  requests = [];
  answerInfo({ release: "v1.4.0", commit: SHA, builtAt: "2026-10-29T14:30:00.000Z", startedAt: "2026-10-29T15:01:00.000Z" });
  server = createServer((request, response) => {
    requests.push({ url: request.url, headers: request.headers });
    response.writeHead(answer.status, { "content-type": "application/json" }).end(answer.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

describe("softure-deploy smoke", () => {
  it("passes when production answers the tag, its commit and a start after the deploy", async () => {
    const status = await runCli(["smoke", `${baseUrl}/`, "--tag=v1.4.0", `--commit=${SHA}`, "--deployed-at=2026-10-29T15:00:00Z"], makeIo());
    expect(err.join("")).toBe("");
    expect(status).toBe(0);
    expect(requests.map((request) => request.url)).toEqual(["/api/health/build"]);
    expect(out.join("")).toBe(
      [
        `Build info of ${baseUrl}/api/health/build`,
        "Result  Check    Detail",
        "PASS    release  release v1.4.0",
        `PASS    commit   commit ${SHA}`,
        "PASS    started  started 2026-10-29T15:01:00.000Z, after the deploy at 2026-10-29T15:00:00.000Z",
        "",
      ].join("\n"),
    );
  });

  it("fails, naming the checks, when an old container answers", async () => {
    answerInfo({ release: "v1.3.0", commit: "fedcba9", startedAt: "2026-10-28T09:00:00.000Z" });
    const status = await runCli(["smoke", baseUrl, "--tag=v1.4.0", `--commit=${SHA}`, "--deployed-at=2026-10-29T15:00:00Z"], makeIo());
    expect(status).toBe(1);
    expect(err.join("")).toBe("smoke: production does not run v1.4.0: the release, commit, started checks failed.\n");
    expect(out.join("")).toContain("FAIL    release  release v1.3.0, expected v1.4.0");
  });

  it("reads another path and sends the headers of the headers file", async () => {
    mkdirSync(join(dir, "secrets"));
    writeFileSync(join(dir, "secrets", "headers"), "CF-Access-Client-Id: id-1\r\nCF-Access-Client-Secret: secret-2\n\n");
    const status = await runCli(["smoke", baseUrl, "--tag=v1.4.0", "--path=/ops/build", "--headers-file=secrets/headers"], makeIo());
    expect(status).toBe(0);
    expect(requests[0]?.url).toBe("/ops/build");
    expect(requests[0]?.headers).toMatchObject({ "cf-access-client-id": "id-1", "cf-access-client-secret": "secret-2" });
  });

  it("names a malformed header line by its number, never its text", async () => {
    writeFileSync(join(dir, "headers"), "X-Ok: 1\nsecret-token-value\n");
    expect(await runCli(["smoke", baseUrl, "--tag=v1.4.0", "--headers-file=headers"], makeIo())).toBe(2);
    expect(err.join("")).toBe("smoke: --headers-file line 2 is not one 'Name: value' header.\n");
    expect(readFileSync(join(dir, "headers"), "utf8")).toContain("secret-token-value");
    expect(requests).toEqual([]);
  });

  it("fails when the route does not answer 200 JSON build info", async () => {
    answer = { status: 302, body: "" };
    expect(await runCli(["smoke", baseUrl, "--tag=v1.4.0"], makeIo())).toBe(1);
    expect(err.join("")).toBe(`smoke: ${baseUrl}/api/health/build: it answered 302, not 200.\n`);
    err = [];
    answer = { status: 200, body: "<html>" };
    expect(await runCli(["smoke", baseUrl, "--tag=v1.4.0"], makeIo())).toBe(1);
    expect(err.join("")).toBe(`smoke: ${baseUrl}/api/health/build: it answered something other than JSON.\n`);
    err = [];
    answer = { status: 200, body: JSON.stringify({ status: "ok" }) };
    expect(await runCli(["smoke", baseUrl, "--tag=v1.4.0"], makeIo())).toBe(1);
    expect(err.join("")).toBe(`smoke: ${baseUrl}/api/health/build: its JSON is not build info (release, commit and startedAt).\n`);
  });

  it("refuses a wrong command line before any request", async () => {
    const cases: [string[], string][] = [
      [["smoke", "--tag=v1"], "smoke: pass exactly one URL, for example softure-deploy smoke https://example.com --tag=v1.2.0\n"],
      [["smoke", baseUrl], "smoke: pass --tag=<the deployed release tag>.\n"],
      [["smoke", baseUrl, "--tag=v1", "--commit=main"], 'smoke: --commit "main" is not a commit (7 to 64 hex digits).\n'],
      [["smoke", baseUrl, "--tag=v1", "--deployed-at=today"], 'smoke: --deployed-at "today" is not an ISO 8601 time such as 2026-10-29T15:00:00Z.\n'],
      [["smoke", baseUrl, "--tag=v1", "--path=build"], 'smoke: --path "build" is not a path starting with /.\n'],
      [["smoke", baseUrl, "--tag=v1", "--tolerance-seconds=-1"], "smoke: --tolerance-seconds must be a whole number from 0 to 3600.\n"],
      [["smoke", "ftp://example.com", "--tag=v1"], "smoke: ftp: is not http or https.\n"],
    ];
    for (const [args, message] of cases) {
      err = [];
      expect(await runCli(args, makeIo()), args.join(" ")).toBe(2);
      expect(err.join(""), args.join(" ")).toBe(message);
    }
    expect(requests).toEqual([]);
  });
});

describe("softure-deploy changelog", () => {
  const TABLE = "## At a glance\n\n| ID | Change | Outcome | Status |\n| --- | --- | --- | --- |\n| AB-1 | ab-1 | One | done |\n";

  it("prints the finished items of the newest roadmaps, or writes them to --out", async () => {
    mkdirSync(join(dir, "context", "foundation"), { recursive: true });
    writeFileSync(join(dir, "context", "foundation", "roadmap.md"), TABLE);
    const expected = [{ roadmap: "context/foundation/roadmap.md", items: [{ id: "AB-1", changeId: "ab-1", status: "done" }] }];
    expect(await runCli(["changelog"], makeIo())).toBe(0);
    expect(JSON.parse(out.join(""))).toEqual(expected);
    out = [];
    expect(await runCli(["changelog", "--out=changelog.json", "--roadmaps=1"], makeIo())).toBe(0);
    expect(out.join("")).toBe("changelog: 1 finished items of 1 roadmaps written to changelog.json.\n");
    expect(JSON.parse(readFileSync(join(dir, "changelog.json"), "utf8"))).toEqual(expected);
  });

  it("refuses a --roadmaps that is not 1 to 50", async () => {
    for (const value of ["0", "51", "two"]) {
      err = [];
      expect(await runCli(["changelog", `--roadmaps=${value}`], makeIo())).toBe(2);
      expect(err.join("")).toBe("changelog: --roadmaps must be a whole number from 1 to 50.\n");
    }
  });
});
