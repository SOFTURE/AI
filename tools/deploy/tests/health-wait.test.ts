import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

// Issue #516: an app behind an access proxy (Cloudflare Access on the whole host) keeps the deploy action's health
// wait with `health-status` (the status that counts as up) and `health-headers` (a service token, masked). The step
// runs here as the runner runs it, with a stub curl on PATH.

const ACTION = join(import.meta.dirname, "../../../.github/actions/deploy/action.yml");

interface Step {
  name?: string;
  run?: string;
  env?: Record<string, string>;
}

interface ActionFile {
  inputs: Record<string, { default?: string }>;
  runs: { steps: Step[] };
}

const action = parse(readFileSync(ACTION, "utf8")) as ActionFile;
const HEALTH_STEP = action.runs.steps.find((step) => step.name === "Wait for the health route");

// Records its arguments and the header file it was given, and answers CURL_STATUS.
const STUB_CURL = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CURL_LOG"
previous=""
for arg in "$@"; do
  if [ "$previous" = "-H" ] && [ "\${arg#@}" != "$arg" ]; then cat "\${arg#@}" > "$CURL_LOG.headers"; fi
  previous="$arg"
done
printf '%s' "\${CURL_STATUS:-200}"
`;

let root: string;
let curlLog: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "softure-deploy-health-wait-"));
  curlLog = join(root, "curl.log");
  mkdirSync(join(root, "bin"));
  mkdirSync(join(root, "runner"));
  writeFileSync(join(root, "bin", "curl"), STUB_CURL);
  chmodSync(join(root, "bin", "curl"), 0o755);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function waitForHealth(env: Record<string, string>): { status: number | null; stdout: string } {
  const result = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", HEALTH_STEP?.run ?? "exit 9"], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: `${join(root, "bin")}:${process.env.PATH ?? ""}`,
      RUNNER_TEMP: join(root, "runner"),
      CURL_LOG: curlLog,
      APP_URL: "https://example.com/",
      HEALTH_PATH: "/api/health",
      VERIFY_TIMEOUT: "0",
      HEALTH_STATUS: "200",
      HEALTH_HEADERS: "",
      ...env,
    },
  });
  return { status: result.status, stdout: result.stdout };
}

describe("the deploy action's health wait", () => {
  it("takes health-status and health-headers as optional inputs", () => {
    expect(action.inputs["health-status"]?.default).toBe("200");
    expect(action.inputs["health-headers"]?.default).toBe("");
    expect(HEALTH_STEP?.env).toMatchObject({
      HEALTH_STATUS: "${{ inputs.health-status }}",
      HEALTH_HEADERS: "${{ inputs.health-headers }}",
    });
  });

  it("waits for 200 with no header, as before", () => {
    const result = waitForHealth({});
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("verify: https://example.com/api/health answered 200.\n");
    expect(readFileSync(curlLog, "utf8")).toBe("-sS -o /dev/null -w %{http_code} --max-time 10 https://example.com/api/health\n");
  });

  it("counts the given status as up and fails on any other", () => {
    expect(waitForHealth({ HEALTH_STATUS: "302", CURL_STATUS: "302" }).stdout).toBe("verify: https://example.com/api/health answered 302.\n");
    const other = waitForHealth({ HEALTH_STATUS: "302", CURL_STATUS: "200" });
    expect(other.status).toBe(1);
    expect(other.stdout).toBe("::error::verify: https://example.com/api/health did not answer 302 within 0s (last: 200).\n");
  });

  it("sends the headers from a file, masks each value and removes the file", () => {
    const result = waitForHealth({ HEALTH_HEADERS: "CF-Access-Client-Id: id.access\r\nCF-Access-Client-Secret: s3cret value\n" });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      "::add-mask::id.access\n::add-mask::s3cret value\nverify: https://example.com/api/health answered 200.\n",
    );
    expect(readFileSync(`${curlLog}.headers`, "utf8")).toBe("CF-Access-Client-Id: id.access\nCF-Access-Client-Secret: s3cret value\n");
    expect(readFileSync(curlLog, "utf8")).not.toContain("s3cret");
    expect(existsSync(join(root, "runner", "health-headers"))).toBe(false);
  });

  it("refuses a status that is not one and a header line without a name, never printing the line", () => {
    const status = waitForHealth({ HEALTH_STATUS: "ok" });
    expect(status.status).toBe(1);
    expect(status.stdout).toBe("::error::Input health-status is not valid: a three-digit HTTP status such as 200 or 302\n");
    const header = waitForHealth({ HEALTH_HEADERS: "X-Token: a\nsecret-without-a-name" });
    expect(header.status).toBe(1);
    expect(header.stdout).toBe("::add-mask::a\n::error::Input health-headers is not valid on line 2: one 'Name: value' header a line\n");
    expect(existsSync(curlLog)).toBe(false);
  });
});
