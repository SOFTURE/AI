import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFakeRunner, formatCall, type RecordedCall, type Responder } from "../testing/fake-runner.js";
import type { HostDeps } from "./context.js";
import type { CliIo } from "./io.js";
import { runCli } from "./run.js";

const ADMIN_KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAOhB7/zzhC+HXDdGOdLwJln5NYwm6UNXx3chmQSVTG4 admin@laptop";
const HOST_KEYS = "ssh-ed25519 AAAAHOSTKEY root@srv\n";
const DEPLOY_SCRIPT = "#!/usr/bin/env bash\necho deploy\n";
const COMPOSE = "x: ${POSTGRES_PASSWORD:?}\ny: ${RESEND_API_KEY:?}\nz: ${DEPLOY_SSH_HOST:?}\n";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-host-cli-"));
  writeFileSync(join(dir, "admin.pub"), `${ADMIN_KEY}\n`);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function writeInventory(extra = ""): string {
  const path = join(dir, "inventory.yml");
  writeFileSync(
    path,
    [
      "server:",
      "  host: srv.example.com",
      "  ipv4: 203.0.113.10",
      "  adminUser: admin",
      "  adminPublicKey: admin.pub",
      "edge:",
      "  acmeEmail: ops@example.com",
      "apps:",
      "  - slug: notes",
      "    repo: acme/notes",
      "    host: notes.example.com",
      "    database: true",
      extra,
    ].join("\n"),
  );
  return path;
}

function createIo(): CliIo & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { cwd: dir, env: { HOME: dir }, stdout: (text) => out.push(text), stderr: (text) => err.push(text), out, err };
}

function createDeps(respond: Responder): HostDeps & { runner: ReturnType<typeof createFakeRunner> } {
  return {
    runner: createFakeRunner(respond),
    fetch: () => Promise.reject(new Error("no network in tests")),
    ansible: { ansibleDir: "/pkg/ansible", collectionsDir: "/cache/collections" },
  };
}

/** A GitHub repository as gh sees it, plus the server's host keys. */
function createWorld(options: { environment: boolean; secrets: string[]; tagPolicy?: boolean; deployScript?: boolean }): Responder {
  return (call) => {
    const line = formatCall(call);
    if (line === "gh api repos/acme/notes/environments/production --silent") {
      return options.environment ? {} : { status: 1, stderr: "gh: Not Found (HTTP 404)\n" };
    }
    if (line.endsWith("environments/production/deployment-branch-policies")) {
      return { stdout: JSON.stringify({ branch_policies: options.tagPolicy === true ? [{ name: "v*", type: "tag" }] : [] }) };
    }
    if (line.startsWith("gh secret list")) return { stdout: JSON.stringify(options.secrets.map((name) => ({ name }))) };
    if (line.endsWith("contents/docker/server/deploy.sh")) {
      return options.deployScript === false ? { status: 1, stderr: "gh: Not Found (HTTP 404)\n" } : { stdout: DEPLOY_SCRIPT };
    }
    if (line.endsWith("contents/docker/prod/docker-compose.yml")) return { stdout: COMPOSE };
    if (call.program === "ssh") return { stdout: HOST_KEYS };
    if (call.program === "ansible-playbook") {
      // The deploy script must exist while Ansible runs.
      const vars = JSON.parse(call.args[4] ?? "{}") as { host_app_deploy_script_file?: string };
      if (vars.host_app_deploy_script_file !== undefined) {
        expect(readFileSync(vars.host_app_deploy_script_file, "utf8")).toBe(DEPLOY_SCRIPT);
      }
    }
    return undefined;
  };
}

function findPlaybookVars(calls: RecordedCall[]): Record<string, unknown> {
  const playbook = calls.find((call) => call.program === "ansible-playbook");
  return JSON.parse(playbook?.args[4] ?? "{}") as Record<string, unknown>;
}

function isWrite(call: RecordedCall): boolean {
  const line = formatCall(call);
  return /^gh (api -X|secret set|variable set)/.test(line);
}

describe("softure-host", () => {
  it("prints the usage for help, and exits 2 without a command or on an unknown one", async () => {
    const io = createIo();
    await expect(runCli(["help"], io, createDeps(() => undefined))).resolves.toBe(0);
    expect(io.out.join("")).toContain("app add --inventory=<file> --app=<slug> [--check] [--rotate-key]");
    await expect(runCli([], createIo(), createDeps(() => undefined))).resolves.toBe(2);
    const unknown = createIo();
    await expect(runCli(["app", "remove"], unknown, createDeps(() => undefined))).resolves.toBe(2);
    expect(unknown.err.join("")).toContain('unknown command "app remove"');
  });
});

describe("softure-host server", () => {
  it("installs the pinned collections, then runs server.yml with the admin's key", async () => {
    const io = createIo();
    const deps = createDeps(() => undefined);
    await expect(runCli(["server", `--inventory=${writeInventory()}`, "--connect-as=root"], io, deps)).resolves.toBe(0);
    expect(deps.runner.calls.map((call) => `${call.kind} ${call.program} ${call.args[0] ?? ""}`)).toEqual([
      "stream ansible-galaxy collection",
      "stream ansible-playbook /pkg/ansible/server.yml",
    ]);
    expect(findPlaybookVars(deps.runner.calls)).toMatchObject({
      ansible_user: "root",
      vps_app_user: "admin",
      vps_app_user_ssh_public_key_local: ADMIN_KEY,
      vps_ssh_allowed_users: ["admin", "deploy"],
    });
    expect(deps.runner.calls[1]?.env).toEqual({ ANSIBLE_COLLECTIONS_PATH: "/cache/collections" });
    expect(io.out.join("")).toContain("server: done. Log in as admin from now on");
  });

  it("runs Ansible in check mode with --check", async () => {
    const deps = createDeps(() => undefined);
    await runCli(["server", `--inventory=${writeInventory()}`, "--check"], createIo(), deps);
    expect(deps.runner.calls[1]?.args.slice(-2)).toEqual(["--check", "--diff"]);
    expect(findPlaybookVars(deps.runner.calls).ansible_user).toBe("admin");
  });

  it("refuses an inventory without the admin's public key, and stops when Ansible fails", async () => {
    const path = writeInventory();
    writeFileSync(path, readFileSync(path, "utf8").replace("  adminPublicKey: admin.pub\n", ""));
    const io = createIo();
    await expect(runCli(["server", `--inventory=${path}`], io, createDeps(() => undefined))).resolves.toBe(2);
    expect(io.err.join("")).toContain("the inventory needs server.adminPublicKey");

    const failing = createIo();
    const deps = createDeps((call) => (call.program === "ansible-playbook" ? { status: 4 } : undefined));
    await expect(runCli(["server", `--inventory=${writeInventory()}`], failing, deps)).resolves.toBe(1);
    expect(failing.err.join("")).toContain("ansible-playbook server.yml failed (exit 4)");
  });

  it("asks for --inventory", async () => {
    const io = createIo();
    await expect(runCli(["server"], io, createDeps(() => undefined))).resolves.toBe(2);
    expect(io.err.join("")).toContain("server: --inventory is required");
  });
});

describe("softure-host app add", () => {
  it("onboards a new app: Environment first, then the server, then the secrets", async () => {
    const io = createIo();
    const deps = createDeps(createWorld({ environment: false, secrets: [] }));
    await expect(runCli(["app", "add", `--inventory=${writeInventory()}`, "--app=notes"], io, deps)).resolves.toBe(0);
    const lines = deps.runner.calls.map(formatCall);
    const order = [
      "gh api repos/acme/notes/environments/production --silent",
      "gh api -X PUT repos/acme/notes/environments/production --input -",
      "gh api repos/acme/notes/environments/production/deployment-branch-policies",
      "gh api -X POST repos/acme/notes/environments/production/deployment-branch-policies -f name=v* -f type=tag",
      "gh secret list --env production --repo acme/notes --json name",
    ];
    expect(lines.slice(0, order.length)).toEqual(order);
    const playbookIndex = lines.findIndex((line) => line.startsWith("ansible-playbook /pkg/ansible/app.yml"));
    const firstSecret = lines.findIndex((line) => line.startsWith("gh secret set"));
    expect(playbookIndex).toBeGreaterThan(order.length);
    expect(firstSecret).toBeGreaterThan(playbookIndex);

    const vars = findPlaybookVars(deps.runner.calls);
    expect(vars).toMatchObject({ ansible_user: "admin", host_app_name: "notes", host_app_root: "/srv", deploy_user_name: "deploy" });
    expect(vars.host_app_key).toMatch(/^ssh-ed25519 [A-Za-z0-9+/=]+ notes-release$/);
    expect(existsSync(String(vars.host_app_deploy_script_file))).toBe(false);

    const secrets = new Map(
      deps.runner.calls.filter((call) => call.args[0] === "secret" && call.args[1] === "set").map((call) => [call.args[2], call.input]),
    );
    expect([...secrets.keys()].sort()).toEqual([
      "DEPLOY_SSH_HOST",
      "DEPLOY_SSH_KEY",
      "DEPLOY_SSH_KNOWN_HOSTS",
      "DEPLOY_SSH_USER",
      "POSTGRES_PASSWORD",
      "SOFTURE_APP_PASSWORD",
      "SOFTURE_MIGRATOR_PASSWORD",
    ]);
    expect(secrets.get("DEPLOY_SSH_HOST")).toBe("srv.example.com");
    expect(secrets.get("DEPLOY_SSH_USER")).toBe("deploy");
    expect(secrets.get("DEPLOY_SSH_KNOWN_HOSTS")).toBe("srv.example.com ssh-ed25519 AAAAHOSTKEY");
    expect(secrets.get("DEPLOY_SSH_KEY")).toMatch(/^-----BEGIN OPENSSH PRIVATE KEY-----\n/);
    expect(secrets.get("POSTGRES_PASSWORD")).toMatch(/^[0-9a-f]{64}$/);
    expect(lines).toContain("gh variable set APP_HOST --repo acme/notes --body notes.example.com");

    // No secret value on any command line, nor in the output.
    const printed = io.out.join("") + io.err.join("");
    for (const value of secrets.values()) {
      if (value === "srv.example.com" || value === "deploy" || value?.startsWith("srv.example.com ")) continue;
      expect(lines.some((line) => line.includes(String(value)))).toBe(false);
      expect(printed).not.toContain(String(value));
    }
    expect(printed).toContain("github: still to set by hand (the app's own secrets): RESEND_API_KEY");
    expect(printed).toMatch(/server: issued a new release key for notes \(SHA256:/);
  });

  it("keeps the key and the passwords GitHub already has", async () => {
    const deps = createDeps(
      createWorld({
        environment: true,
        tagPolicy: true,
        secrets: ["DEPLOY_SSH_KEY", "POSTGRES_PASSWORD", "SOFTURE_APP_PASSWORD", "SOFTURE_MIGRATOR_PASSWORD", "RESEND_API_KEY"],
      }),
    );
    const io = createIo();
    await expect(runCli(["app", "add", `--inventory=${writeInventory()}`, "--app=notes"], io, deps)).resolves.toBe(0);
    const lines = deps.runner.calls.map(formatCall);
    expect(lines.some((line) => line.includes("-X PUT") || line.includes("-X POST"))).toBe(false);
    expect(findPlaybookVars(deps.runner.calls)).not.toHaveProperty("host_app_key");
    const set = deps.runner.calls.filter((call) => call.args[0] === "secret" && call.args[1] === "set").map((call) => call.args[2]);
    expect(set.sort()).toEqual(["DEPLOY_SSH_HOST", "DEPLOY_SSH_KNOWN_HOSTS", "DEPLOY_SSH_USER"]);
    expect(io.out.join("")).toContain("github: every name docker/prod/docker-compose.yml requires is set");
  });

  it("issues a new key with --rotate-key", async () => {
    const deps = createDeps(createWorld({ environment: true, tagPolicy: true, secrets: ["DEPLOY_SSH_KEY"] }));
    await runCli(["app", "add", `--inventory=${writeInventory()}`, "--app=notes", "--rotate-key"], createIo(), deps);
    expect(findPlaybookVars(deps.runner.calls).host_app_key).toMatch(/ notes-release$/);
    expect(deps.runner.calls.some((call) => call.args[2] === "DEPLOY_SSH_KEY")).toBe(true);
  });

  it("changes nothing with --check, and reads nothing under an Environment that does not exist", async () => {
    const io = createIo();
    const deps = createDeps(createWorld({ environment: false, secrets: [] }));
    await expect(runCli(["app", "add", `--inventory=${writeInventory()}`, "--app=notes", "--check"], io, deps)).resolves.toBe(0);
    expect(deps.runner.calls.filter(isWrite)).toEqual([]);
    expect(deps.runner.calls.some((call) => formatCall(call).startsWith("gh secret list"))).toBe(false);
    expect(deps.runner.calls.some((call) => formatCall(call).includes("deployment-branch-policies"))).toBe(false);
    const playbook = deps.runner.calls.find((call) => call.program === "ansible-playbook");
    expect(playbook?.args.slice(-2)).toEqual(["--check", "--diff"]);
    expect(findPlaybookVars(deps.runner.calls).host_app_key).toMatch(/ dry-run$/);
    const printed = io.out.join("");
    expect(printed).toContain("github: would create the production environment of acme/notes with the tag policy v*");
    expect(printed).toContain("github: would set the production secrets DEPLOY_SSH_HOST");
    expect(printed).toContain("app: check done; nothing was changed");
  });

  it("stops before the server when the app has no deploy.sh", async () => {
    const io = createIo();
    const deps = createDeps(createWorld({ environment: true, tagPolicy: true, secrets: [], deployScript: false }));
    await expect(runCli(["app", "add", `--inventory=${writeInventory()}`, "--app=notes"], io, deps)).resolves.toBe(1);
    expect(io.err.join("")).toContain("acme/notes has no docker/server/deploy.sh; run softure-deploy init in the app first");
    expect(deps.runner.calls.some((call) => call.program === "ansible-playbook")).toBe(false);
  });

  it("refuses an app the inventory does not list", async () => {
    const io = createIo();
    await expect(runCli(["app", "add", `--inventory=${writeInventory()}`, "--app=blog"], io, createDeps(() => undefined))).resolves.toBe(2);
    expect(io.err.join("")).toContain('the inventory has no app "blog" (apps: notes)');
  });

  it("leaves Cloudflare to the owner without a token, and needs server.ipv4 with one", async () => {
    const path = writeInventory();
    writeFileSync(path, readFileSync(path, "utf8").replace("  acmeEmail: ops@example.com\n", "  acmeEmail: ops@example.com\n  cdn: cloudflare\n"));
    const io = createIo();
    const deps = createDeps(createWorld({ environment: true, tagPolicy: true, secrets: [] }));
    await runCli(["app", "add", `--inventory=${path}`, "--app=notes"], io, deps);
    expect(io.out.join("")).toContain("cloudflare: CLOUDFLARE_API_TOKEN is not set: DNS, TLS and Access left as they are");
    // Behind Cloudflare, the deploy workflow's origin check gets the server's own address.
    expect(deps.runner.calls.find((call) => call.args[2] === "DEPLOY_ORIGIN_IP")?.input).toBe("203.0.113.10");

    writeFileSync(path, readFileSync(path, "utf8").replace("  ipv4: 203.0.113.10\n", ""));
    const withToken = { ...createIo(), env: { HOME: dir, CLOUDFLARE_API_TOKEN: "tok" } };
    const errors: string[] = [];
    withToken.stderr = (text) => errors.push(text);
    await expect(runCli(["app", "add", `--inventory=${path}`, "--app=notes"], withToken, createDeps(createWorld({ environment: true, tagPolicy: true, secrets: [] })))).resolves.toBe(2);
    expect(errors.join("")).toContain("cloudflare: the DNS record needs server.ipv4 in the inventory");
  });
});
