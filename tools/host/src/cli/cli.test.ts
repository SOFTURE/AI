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
/** What the probe prints on a server `softure-host server` set up: its own edge on its own network. */
const OWN_SERVER = [
  "sudo\tpasswordless",
  "docker\t27.3.1",
  "network\tbridge",
  "network\tsofture-edge",
  "edge\tsofture-edge-traefik-1\ttraefik:v3.3\tsofture-edge\tsofture-edge,\t--entrypoints.websecure.address=:443 --certificatesresolvers.letsencrypt.acme.email=ops@example.com",
].join("\n");
/** A server another app set up: its Traefik in its own compose project and network. */
const SHARED_SERVER = [
  "sudo\tpasswordless",
  "docker\t27.3.1",
  "network\tbridge",
  "network\tfirst-app-edge",
  "edge\tfirst-app-traefik-1\ttraefik:v3.3\tfirst-app\tfirst-app-edge,\t--entrypoints.websecure.address=:443 --certificatesresolvers.le.acme.tlschallenge=true",
].join("\n");

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
function createWorld(options: {
  environment: boolean;
  secrets: string[];
  tagPolicy?: boolean;
  deployScript?: boolean;
  server?: string;
  compose?: string;
}): Responder {
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
    if (line.endsWith("contents/docker/prod/docker-compose.yml")) return { stdout: options.compose ?? COMPOSE };
    if (call.program === "ssh" && call.args.includes("sh")) {
      expect(call.input).toContain(" -T -C ");
      return { stdout: options.server ?? OWN_SERVER };
    }
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
      "gh api -H Accept: application/vnd.github.raw repos/acme/notes/contents/docker/prod/docker-compose.yml",
      "ssh -o BatchMode=yes -p 22 admin@srv.example.com sh -s -- deploy softure-cloudflare-only",
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
    expect(lines).toContain("gh variable set EDGE_NETWORK --repo acme/notes --body softure-edge");

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

  it("refuses a deploy user that is the admin user before running anything, with and without --check (issue #1431)", async () => {
    const path = writeInventory();
    writeFileSync(path, readFileSync(path, "utf8").replace("  adminUser: admin\n", "  adminUser: admin\n  deployUser: admin\n"));
    for (const flags of [[], ["--check"]]) {
      const io = createIo();
      const deps = createDeps(createWorld({ environment: false, secrets: [] }));
      await expect(runCli(["app", "add", `--inventory=${path}`, "--app=notes", ...flags], io, deps)).resolves.toBe(2);
      expect(io.err.join("")).toContain("server.deployUser: must differ from server.adminUser (admin)");
      expect(deps.runner.calls).toEqual([]);
    }
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
    expect(printed).toContain(" and the variables APP_HOST, EDGE_NETWORK\n");
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
  it("runs the preflight first: the server's own edge and network pass (issue #1432)", async () => {
    const io = createIo();
    const deps = createDeps(createWorld({ environment: true, tagPolicy: true, secrets: [] }));
    await expect(runCli(["app", "add", `--inventory=${writeInventory()}`, "--app=notes", "--check"], io, deps)).resolves.toBe(0);
    expect(io.out.join("")).toContain("preflight: the edge network softure-edge exists\n");
    expect(io.out.join("")).toContain("preflight: docker/prod/docker-compose.yml joins no external network\n");
  });

  it("stops with --check before any change when an edge already runs and edge.manage is true (issue #1432)", async () => {
    for (const flags of [["--check"], []]) {
      const io = createIo();
      const deps = createDeps(createWorld({ environment: false, secrets: [], server: SHARED_SERVER }));
      await expect(runCli(["app", "add", `--inventory=${writeInventory()}`, "--app=notes", ...flags], io, deps)).resolves.toBe(1);
      const error = io.err.join("");
      expect(error).toContain("app add: stopped before any change:");
      expect(error).toContain(
        "an edge already runs on srv.example.com: first-app-traefik-1 (compose project first-app, networks first-app-edge), while the inventory has edge.manage: true. Set edge.manage: false",
      );
      expect(error).toContain("the inventory's edge.network softure-edge does not exist on srv.example.com (Docker networks there: bridge, first-app-edge)");
      expect(deps.runner.calls.filter(isWrite)).toEqual([]);
      expect(deps.runner.calls.some((call) => call.program === "ansible-playbook" || formatCall(call).includes("environments/production"))).toBe(false);
    }
  });

  it("names both networks when the compose file joins another edge network (issue #1432)", async () => {
    const path = writeInventory();
    writeFileSync(path, readFileSync(path, "utf8").replace("  acmeEmail: ops@example.com\n", "  manage: false\n  network: first-app-edge\n  certResolver: le\n"));
    const literal = "services: {}\nnetworks:\n  edge:\n    external: true\n    name: proxy\n";
    const io = createIo();
    const deps = createDeps(createWorld({ environment: true, tagPolicy: true, secrets: [], server: SHARED_SERVER, compose: literal }));
    await expect(runCli(["app", "add", `--inventory=${path}`, "--app=notes", "--check"], io, deps)).resolves.toBe(1);
    expect(io.err.join("")).toContain(
      "docker/prod/docker-compose.yml joins the external network proxy, but the inventory's edge.network is first-app-edge.",
    );

    // The default of ${EDGE_NETWORK:-…} does not matter: app add sets the variable to edge.network (issue #1429).
    const variable = literal.replace("name: proxy", "name: ${EDGE_NETWORK:-proxy}");
    const passing = createIo();
    const passingDeps = createDeps(createWorld({ environment: true, tagPolicy: true, secrets: [], server: SHARED_SERVER, compose: variable }));
    await expect(runCli(["app", "add", `--inventory=${path}`, "--app=notes", "--check"], passing, passingDeps)).resolves.toBe(0);
    expect(passing.out.join("")).toContain("preflight: docker/prod/docker-compose.yml joins first-app-edge\n");
  });
});

describe("softure-host survey", () => {
  it("prints what the inventory needs and the edge block for an edge that already runs, changing nothing (issue #1432)", async () => {
    const io = createIo();
    const deps = createDeps((call) => (call.program === "ssh" ? { stdout: SHARED_SERVER } : undefined));
    await expect(runCli(["survey", `--inventory=${writeInventory()}`], io, deps)).resolves.toBe(0);
    expect(deps.runner.calls.map(formatCall)).toEqual(["ssh -o BatchMode=yes -p 22 admin@srv.example.com sh -s -- deploy softure-cloudflare-only"]);
    const printed = io.out.join("");
    expect(printed).toContain("survey: srv.example.com as admin (read-only; nothing was changed)\n");
    expect(printed).toContain("edge: first-app-traefik-1 (traefik:v3.3), compose project first-app, networks first-app-edge");
    expect(printed).toContain("edge:\n  manage: false\n  network: first-app-edge\n  certResolver: le\n");
  });

  it("stops when the admin cannot log in", async () => {
    const io = createIo();
    const deps = createDeps(() => ({ status: 255, stderr: "Permission denied (publickey).\n" }));
    await expect(runCli(["survey", `--inventory=${writeInventory()}`], io, deps)).resolves.toBe(1);
    expect(io.err.join("")).toContain("cannot survey srv.example.com as admin: Permission denied (publickey).");
  });
});
