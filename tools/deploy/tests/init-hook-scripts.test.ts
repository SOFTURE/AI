import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppFacts } from "../src/init/app-facts.js";
import type { InitAnswers } from "../src/init/answers.js";
import { planInitFiles } from "../src/init/generate.js";

// The shell files `init` writes for hooks and the Cloudflare origin lock, run with bash against stubs: a recording
// iptables, Cloudflare's lists as file:// URLs, a recording docker. The bundle test runs esbuild with the Dockerfile's
// own flags and the bundle with node.

const ANSWERS: InitAnswers = {
  domain: "example.com",
  image: "ghcr.io/acme/app",
  name: "acme-app",
  paths: ["/"],
  www: false,
  env: [],
  tables: [],
  cdn: "cloudflare",
};

const FACTS: AppFacts = {
  packageName: "acme-app",
  hasDatabase: true,
  hasHealthRoute: true,
  hasPublicDir: false,
  nextConfigFile: "next.config.ts",
  isStandalone: true,
};

const FILES = new Map(planInitFiles({ answers: ANSWERS, facts: FACTS, cliVersion: "9.9.9" }).map((file) => [file.path, file.text]));

function fileText(path: string): string {
  const text = FILES.get(path);
  if (text === undefined) throw new Error(`${path} was not planned`);
  return text;
}

const IPV4 = "173.245.48.0/20\n103.21.244.0/22";
const IPV6 = "2400:cb00::/32\n2606:4700::/32";

let dir: string;

function write(path: string, text: string, mode = 0o644): string {
  const target = join(dir, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
  chmodSync(target, mode);
  return target;
}

function run(options: { script: string; args?: string[]; cwd?: string; env?: Record<string, string> }) {
  const result = spawnSync("bash", [options.script, ...(options.args ?? [])], {
    cwd: options.cwd ?? dir,
    encoding: "utf8",
    env: { ...process.env, PATH: `${join(dir, "bin")}:${process.env.PATH ?? ""}`, ...options.env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-hook-scripts-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("cloudflare-only.sh", () => {
  // Every call is logged; `-S DOCKER-USER` answers per family (IP6_DOCKER_USER), `-C` finds no jump unless JUMP_EXISTS.
  const STUB_IPTABLES = `#!/usr/bin/env bash
tool="$(basename "$0")"
printf '%s %s\\n' "$tool" "$*" >> "$IPTABLES_LOG"
case " $* " in
  *" -S DOCKER-USER "*) [ "$tool" = iptables ] || [ -n "\${IP6_DOCKER_USER:-}" ] ;;
  *" -C "*) [ -n "\${JUMP_EXISTS:-}" ] ;;
  *) exit 0 ;;
esac
`;

  function setUp(ranges: string): { script: string; log: string; env: Record<string, string> } {
    write("bin/iptables", STUB_IPTABLES, 0o755);
    write("bin/ip6tables", STUB_IPTABLES, 0o755);
    const log = join(dir, "iptables.log");
    const env = { IPTABLES_LOG: log, CLOUDFLARE_RANGES_FILE: write("cloudflare-ips.txt", ranges), CLOUDFLARE_ONLY_INTERFACE: "eth0" };
    return { script: write("cloudflare-only.sh", fileText("docker/server/cloudflare-only.sh"), 0o755), log, env };
  }

  function readLog(log: string): string[] {
    return existsSync(log) ? readFileSync(log, "utf8").trimEnd().split("\n") : [];
  }

  it("fills the chain DROP first, then lets each range through, and jumps to it for ports 80 and 443", () => {
    const { script, log, env } = setUp(`${IPV4}\n${IPV6}\n`);
    const result = run({ script, env: { ...env, IP6_DOCKER_USER: "yes" } });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const v4 = readLog(log).filter((line) => line.startsWith("iptables "));
    expect(v4).toEqual([
      "iptables -w -S DOCKER-USER",
      "iptables -w -N SOFTURE-CLOUDFLARE",
      "iptables -w -F SOFTURE-CLOUDFLARE",
      "iptables -w -A SOFTURE-CLOUDFLARE -j DROP",
      "iptables -w -I SOFTURE-CLOUDFLARE 1 -s 173.245.48.0/20 -j RETURN",
      "iptables -w -I SOFTURE-CLOUDFLARE 1 -s 103.21.244.0/22 -j RETURN",
      "iptables -w -C DOCKER-USER -i eth0 -p tcp -m conntrack --ctorigdstport 80 --ctdir ORIGINAL -j SOFTURE-CLOUDFLARE",
      "iptables -w -I DOCKER-USER 1 -i eth0 -p tcp -m conntrack --ctorigdstport 80 --ctdir ORIGINAL -j SOFTURE-CLOUDFLARE",
      "iptables -w -C DOCKER-USER -i eth0 -p tcp -m conntrack --ctorigdstport 443 --ctdir ORIGINAL -j SOFTURE-CLOUDFLARE",
      "iptables -w -I DOCKER-USER 1 -i eth0 -p tcp -m conntrack --ctorigdstport 443 --ctdir ORIGINAL -j SOFTURE-CLOUDFLARE",
    ]);
    const v6 = readLog(log).filter((line) => line.startsWith("ip6tables "));
    expect(v6).toContain("ip6tables -w -I SOFTURE-CLOUDFLARE 1 -s 2606:4700::/32 -j RETURN");
    expect(v6).toContain("ip6tables -w -I DOCKER-USER 1 -i eth0 -p tcp -m conntrack --ctorigdstport 443 --ctdir ORIGINAL -j SOFTURE-CLOUDFLARE");
    expect(result.stdout).toBe(
      [
        "cloudflare-only: iptables DOCKER-USER lets 2 ranges reach ports 80, 443 on eth0.",
        "cloudflare-only: ip6tables DOCKER-USER lets 2 ranges reach ports 80, 443 on eth0.",
        "",
      ].join("\n"),
    );
  });

  it("guards IPv6 in INPUT when Docker does not manage ip6tables, and adds no second jump", () => {
    const { script, log, env } = setUp(`${IPV4}\n${IPV6}`);
    const result = run({ script, env: { ...env, JUMP_EXISTS: "yes" } });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("cloudflare-only: ip6tables INPUT lets 2 ranges reach ports 80, 443 on eth0.");
    expect(readLog(log)).toContain("ip6tables -w -C INPUT -i eth0 -p tcp -m conntrack --ctorigdstport 80 --ctdir ORIGINAL -j SOFTURE-CLOUDFLARE");
    expect(readLog(log).filter((line) => line.includes(" -I DOCKER-USER ") || line.includes(" -I INPUT "))).toEqual([]);
  });

  it("leaves IPv6 alone without IPv6 ranges", () => {
    const { script, log, env } = setUp(`${IPV4}\n`);
    const result = run({ script, env });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("cloudflare-only: no IPv6 ranges; IPv6 left as it is.\n");
    expect(readLog(log).filter((line) => line.startsWith("ip6tables "))).toEqual([]);
  });

  it.each([
    ["a line that is not a range", `${IPV4}\n0.0.0.0\n`, "holds a line that is not an allowed CIDR range: 0.0.0.0"],
    ["a /0", `${IPV4}\n0.0.0.0/0\n`, "holds a line that is not an allowed CIDR range: 0.0.0.0/0"],
    ["an option", `${IPV4}\n-j ACCEPT\n`, "holds a line that is not an allowed CIDR range: -j ACCEPT"],
    ["no IPv4 range", `${IPV6}\n`, "has no IPv4 range; nothing was changed."],
  ])("changes nothing for a ranges file with %s", (_case, ranges, message) => {
    const { script, log, env } = setUp(ranges);
    const result = run({ script, env });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(readLog(log)).toEqual([]);
  });

  it("changes nothing before the hook wrote any ranges", () => {
    const { script, log, env } = setUp("");
    const result = run({ script, env });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("the release's cloudflare-ranges hook writes them.");
    expect(readLog(log)).toEqual([]);
  });
});

describe("hooks/cloudflare-ranges.sh", () => {
  function setUp(lists: { v4?: string; v6?: string }): { script: string; env: Record<string, string> } {
    write("app/hooks/lib.sh", fileText("docker/prod/hooks/lib.sh"));
    write("app/docker-compose.yml", fileText("docker/prod/docker-compose.yml"));
    if (lists.v4 !== undefined) write("cloudflare/ips-v4", lists.v4);
    if (lists.v6 !== undefined) write("cloudflare/ips-v6", lists.v6);
    const script = write("app/hooks/cloudflare-ranges.sh", fileText("docker/prod/hooks/cloudflare-ranges.sh"));
    return { script, env: { CLOUDFLARE_IPS_URL: `file://${join(dir, "cloudflare")}` } };
  }

  const ranges = (): string => readFileSync(join(dir, "app/cloudflare-ips.txt"), "utf8");

  it("writes both lists, one range per line, then reports them unchanged", () => {
    const { script, env } = setUp({ v4: IPV4, v6: `${IPV6}\n` });
    const first = run({ script, cwd: join(dir, "app"), env });
    expect(first.stderr).toBe("hook: wrote 4 Cloudflare ranges to cloudflare-ips.txt.\n");
    expect(first.status).toBe(0);
    expect(ranges()).toBe(`${IPV4}\n${IPV6}\n`);
    const second = run({ script, cwd: join(dir, "app"), env });
    expect(second.stderr).toBe("hook: Cloudflare's ranges unchanged (4 in cloudflare-ips.txt).\n");
    expect(second.status).toBe(0);
  });

  it("warns when the compose file's trustedIPs lack a range Cloudflare publishes", () => {
    const { script, env } = setUp({ v4: `${IPV4}\n198.51.100.0/24`, v6: IPV6 });
    const result = run({ script, cwd: join(dir, "app"), env });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      "hook: warning: forwardedHeaders.trustedIPs in docker-compose.yml lacks Cloudflare's 198.51.100.0/24; add them there.\n",
    );
  });

  it("keeps the ranges already there when the download fails, and fails when there are none", () => {
    const { script, env } = setUp({ v4: IPV4 });
    const none = run({ script, cwd: join(dir, "app"), env });
    expect(none.status).toBe(1);
    expect(none.stderr).toContain("hook: cannot download Cloudflare's ranges, and there are none in cloudflare-ips.txt yet.\n");
    write("app/cloudflare-ips.txt", "173.245.48.0/20\n");
    const kept = run({ script, cwd: join(dir, "app"), env });
    expect(kept.status).toBe(0);
    expect(kept.stderr).toContain("hook: warning: cannot download Cloudflare's ranges; cloudflare-ips.txt stays as it is.\n");
    expect(ranges()).toBe("173.245.48.0/20\n");
  });

  it.each([
    ["a page instead of a list", "<html>error</html>", IPV6, "IPv4 list holds a line that is not an allowed CIDR range: <html>error</html>"],
    ["an IPv6 range in the IPv4 list", "2400:cb00::/32", IPV6, "IPv4 list holds a line that is not an allowed CIDR range: 2400:cb00::/32"],
    ["an empty IPv4 list", "", IPV6, "Cloudflare's IPv4 list is empty"],
  ])("refuses %s and keeps the ranges already there", (_case, v4, v6, message) => {
    const { script, env } = setUp({ v4, v6 });
    write("app/cloudflare-ips.txt", "173.245.48.0/20\n");
    const result = run({ script, cwd: join(dir, "app"), env });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(ranges()).toBe("173.245.48.0/20\n");
  });
});

describe("hooks/lib.sh", () => {
  const HOOK = `set -euo pipefail
. hooks/lib.sh
"$@"
`;

  function setUp(envProd: string): string {
    write("app/hooks/lib.sh", fileText("docker/prod/hooks/lib.sh"));
    write("app/.env.prod", envProd);
    write("bin/docker", '#!/usr/bin/env bash\nprintf \'%s\\n\' "$*"\n', 0o755);
    return write("app/hooks/check.sh", HOOK);
  }

  const ENV_PROD = "# header\nAUTH_SECRET='a b$c'\nPLAIN=value=with=equals\nSHORT=abc\nTAG=v1\n";

  it("reads values from .env.prod without env render's quotes", () => {
    const script = setUp(ENV_PROD);
    expect(run({ script, cwd: join(dir, "app"), args: ["env_value", "AUTH_SECRET"] }).stdout).toBe("a b$c\n");
    expect(run({ script, cwd: join(dir, "app"), args: ["env_value", "PLAIN"] }).stdout).toBe("value=with=equals\n");
  });

  it("fails for a name .env.prod lacks or one that is not a name", () => {
    const script = setUp(ENV_PROD);
    const missing = run({ script, cwd: join(dir, "app"), args: ["env_value", "AUTH"] });
    expect(missing).toMatchObject({ status: 1, stdout: "", stderr: "hook: AUTH is not in .env.prod.\n" });
    const pattern = run({ script, cwd: join(dir, "app"), args: ["env_value", ".*"] });
    expect(pattern).toMatchObject({ status: 1, stderr: "hook: env_value: .* is not a variable name.\n" });
  });

  it("fails a secret shorter than its minimum by name only", () => {
    const script = setUp(ENV_PROD);
    const short = run({ script, cwd: join(dir, "app"), args: ["require_min_length", "SHORT", "4"] });
    expect(short).toMatchObject({ status: 1, stdout: "", stderr: "hook: SHORT in .env.prod is shorter than 4 characters.\n" });
    expect(run({ script, cwd: join(dir, "app"), args: ["require_min_length", "SHORT", "3"] }).status).toBe(0);
    expect(run({ script, cwd: join(dir, "app"), args: ["require_min_length", "AUTH", "3"] })).toMatchObject({
      status: 1,
      stderr: "hook: AUTH is not in .env.prod.\n",
    });
  });

  it("runs docker compose with the live compose file and .env.prod, and fails with a message", () => {
    const script = setUp(ENV_PROD);
    expect(run({ script, cwd: join(dir, "app"), args: ["compose", "exec", "-T", "app", "node", "a b.mjs"] }).stdout).toBe(
      "compose --env-file .env.prod --file docker-compose.yml exec -T app node a b.mjs\n",
    );
    expect(run({ script, cwd: join(dir, "app"), args: ["fail", "the import", "stopped"] })).toMatchObject({
      status: 1,
      stderr: "hook: the import stopped\n",
    });
  });
});

describe("the Dockerfile's esbuild flags", () => {
  const ESBUILD = join(import.meta.dirname, "../../../node_modules/.bin/esbuild");

  // The flags between the migrate bundle's entry point and its externals, as the generated Dockerfile spells them.
  function readBundleFlags(): string {
    const dockerfile = fileText("Dockerfile");
    const start = dockerfile.indexOf("scripts/migrate.ts --bundle");
    const end = dockerfile.indexOf("--external:pg", start);
    return dockerfile.slice(start + "scripts/migrate.ts".length, end).replaceAll("\\\n", " ");
  }

  it("bundles a server-only data layer with a CJS dependency that plain node runs", () => {
    write("app/node_modules/server-only/package.json", JSON.stringify({ name: "server-only", main: "index.js" }));
    write("app/node_modules/server-only/index.js", 'throw new Error("This module cannot be imported from a Client Component module.");\n');
    write("app/node_modules/legacy/package.json", JSON.stringify({ name: "legacy", main: "index.js" }));
    write("app/node_modules/legacy/index.js", 'const path = require("node:path");\nmodule.exports = { join: (a, b) => path.join(a, b) };\n');
    write("app/src/data.ts", 'import "server-only";\nimport legacy from "legacy";\nexport const where = legacy.join("a", "b");\n');
    write("app/scripts/migrate.ts", 'import { where } from "../src/data";\nconsole.log(`migrated ${where}`);\n');
    const setup = 'mkdir -p .esbuild && printf \'export {};\\n\' > .esbuild/empty.mjs';
    expect(fileText("Dockerfile")).toContain(`RUN ${setup}`);
    const command = `${setup} && "${ESBUILD}" scripts/migrate.ts ${readBundleFlags()} --outfile=migrate.mjs --log-level=error`;
    const bundle = spawnSync("bash", ["-c", command], { cwd: join(dir, "app"), encoding: "utf8" });
    expect(bundle.stderr).toBe("");
    expect(bundle.status).toBe(0);
    const node = spawnSync(process.execPath, ["migrate.mjs"], { cwd: join(dir, "app"), encoding: "utf8" });
    expect(node.stderr).toBe("");
    expect(node.stdout).toBe("migrated a/b\n");
  });
});
