import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateDeployKey, getFingerprint } from "../ssh/index.js";
import { createFakeRunner, formatCall, type RecordedCall, type Responder } from "../testing/fake-runner.js";
import type { HostDeps } from "./context.js";
import type { CliIo } from "./io.js";
import { runCli } from "./run.js";

const OPERATOR_KEY = generateDeployKey("jaro@laptop").publicKey;
const OPERATOR_BODY = OPERATOR_KEY.split(" ")[1] ?? "";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-host-operator-"));
  writeFileSync(join(dir, "notes-operator.pub"), `${OPERATOR_KEY}\n`);
  writeFileSync(
    join(dir, "inventory.yml"),
    [
      "server:",
      "  host: srv.example.com",
      "  adminUser: admin",
      "  port: 2222",
      "edge:",
      "  manage: false",
      "apps:",
      "  - slug: notes",
      "    repo: acme/notes",
      "    host: notes.example.com",
      "    database: true",
      "",
    ].join("\n"),
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function createIo(): CliIo & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { cwd: dir, env: { HOME: dir }, stdout: (text) => out.push(text), stderr: (text) => err.push(text), out, err };
}

function createDeps(respond: Responder = () => undefined): HostDeps & { runner: ReturnType<typeof createFakeRunner> } {
  return {
    runner: createFakeRunner(respond),
    fetch: () => Promise.reject(new Error("no network in tests")),
    ansible: { ansibleDir: "/pkg/ansible", collectionsDir: "/cache/collections" },
  };
}

function findPlaybook(calls: RecordedCall[]): { args: readonly string[]; vars: Record<string, unknown> } | undefined {
  const call = calls.find((recorded) => recorded.program === "ansible-playbook");
  if (call === undefined) return undefined;
  return { args: call.args, vars: JSON.parse(call.args[4] ?? "{}") as Record<string, unknown> };
}

const BASE = ["--inventory=inventory.yml", "--app=notes"];

describe("softure-host operator add-key", () => {
  it("runs operator.yml with the key's type and body and the label, then prints the ssh line and the commands", async () => {
    const io = createIo();
    const deps = createDeps();
    await expect(runCli(["operator", "add-key", ...BASE, "--key=notes-operator.pub", "--name=laptop"], io, deps)).resolves.toBe(0);
    const playbook = findPlaybook(deps.runner.calls);
    expect(playbook?.args[0]).toBe("/pkg/ansible/operator.yml");
    expect(playbook?.args).not.toContain("--check");
    expect(playbook?.vars).toEqual({
      ansible_host: "srv.example.com",
      ansible_user: "admin",
      ansible_port: 2222,
      deploy_user_name: "deploy",
      host_app_name: "notes",
      host_app_root: "/srv",
      host_operator_label: "laptop",
      host_operator_state: "present",
      host_operator_key_type: "ssh-ed25519",
      host_operator_key_body: OPERATOR_BODY,
    });
    const printed = io.out.join("");
    expect(printed).toContain(`operator: adding notes-operator-laptop (${getFingerprint(OPERATOR_KEY)}) for deploy@srv.example.com\n`);
    expect(printed).toContain(`operator: line: command="/srv/notes/deploy.sh",restrict ssh-ed25519 ${OPERATOR_BODY} notes-operator-laptop\n`);
    expect(printed).toContain("operator: run deploy.sh's commands with: ssh -i notes-operator -p 2222 deploy@srv.example.com <command>\n");
    expect(printed).toContain("operator:   run <script> [--key=value ...]\n");
  });

  it("defaults the label to default", async () => {
    const deps = createDeps();
    await runCli(["operator", "add-key", ...BASE, "--key=notes-operator.pub"], createIo(), deps);
    expect(findPlaybook(deps.runner.calls)?.vars.host_operator_label).toBe("default");
  });

  it("with --check prints the line it would add and runs Ansible in check mode", async () => {
    const io = createIo();
    const deps = createDeps();
    await expect(runCli(["operator", "add-key", ...BASE, "--key=notes-operator.pub", "--check"], io, deps)).resolves.toBe(0);
    expect(findPlaybook(deps.runner.calls)?.args.slice(-2)).toEqual(["--check", "--diff"]);
    const printed = io.out.join("");
    expect(printed).toContain("operator: would add notes-operator-default");
    expect(printed).toContain(`operator: line: command="/srv/notes/deploy.sh",restrict ssh-ed25519 ${OPERATOR_BODY} notes-operator-default\n`);
    expect(printed).toContain("operator: check done; nothing was changed");
    expect(printed).not.toContain("run deploy.sh's commands");
  });

  it.each([
    ["a label with a dash", ["--key=notes-operator.pub", "--name=x-release"], "--name must be"],
    ["the release label", ["--key=notes-operator.pub", "--name=release"], "--name must be"],
    ["no key", [], "--key is required"],
  ])("refuses %s before connecting", async (_name, flags, message) => {
    const io = createIo();
    const deps = createDeps();
    await expect(runCli(["operator", "add-key", ...BASE, ...flags], io, deps)).resolves.toBe(2);
    expect(io.err.join("")).toContain(message);
    expect(deps.runner.calls).toEqual([]);
  });

  it("refuses a private key and a key with options before connecting", async () => {
    writeFileSync(join(dir, "id"), generateDeployKey("x").privateKey);
    writeFileSync(join(dir, "opts.pub"), `command="/bin/bash" ${OPERATOR_KEY}\n`);
    for (const [file, reason] of [["id", "this is a private key"], ["opts.pub", "options before the key"]] as const) {
      const io = createIo();
      const deps = createDeps();
      await expect(runCli(["operator", "add-key", ...BASE, `--key=${file}`], io, deps)).resolves.toBe(2);
      expect(io.err.join("")).toContain(reason);
      expect(deps.runner.calls).toEqual([]);
    }
  });

  it("fails when the playbook refuses the key", async () => {
    const io = createIo();
    const deps = createDeps((call) => (call.program === "ansible-playbook" ? { status: 2 } : undefined));
    await expect(runCli(["operator", "add-key", ...BASE, "--key=notes-operator.pub"], io, deps)).resolves.toBe(1);
    expect(io.err.join("")).toContain("ansible-playbook operator.yml failed (exit 2)");
  });
});

describe("softure-host operator remove-key", () => {
  it("runs operator.yml with state absent and no key", async () => {
    const io = createIo();
    const deps = createDeps();
    await expect(runCli(["operator", "remove-key", ...BASE, "--name=laptop"], io, deps)).resolves.toBe(0);
    const vars = findPlaybook(deps.runner.calls)?.vars;
    expect(vars).toMatchObject({ host_operator_label: "laptop", host_operator_state: "absent" });
    expect(vars).not.toHaveProperty("host_operator_key_body");
    expect(io.out.join("")).toContain("operator: notes-operator-laptop is not in deploy's authorized_keys");
  });
});

describe("softure-host operator list", () => {
  it("reads authorized_keys over the admin's connection and lists the app's operator keys", async () => {
    const file = [
      `command="/srv/notes/deploy.sh",restrict ssh-ed25519 ${OPERATOR_BODY} notes-release`,
      `command="/srv/notes/deploy.sh",restrict ssh-ed25519 ${OPERATOR_BODY} notes-operator-laptop`,
      `ssh-ed25519 ${OPERATOR_BODY} notes-operator-byhand`,
    ].join("\n");
    const io = createIo();
    const deps = createDeps((call) => (call.program === "ssh" ? { stdout: file } : undefined));
    await expect(runCli(["operator", "list", ...BASE], io, deps)).resolves.toBe(0);
    expect(deps.runner.calls.map(formatCall)).toEqual([
      "ssh -o BatchMode=yes -p 2222 admin@srv.example.com sudo -n cat ~deploy/.ssh/authorized_keys",
    ]);
    const fingerprint = getFingerprint(OPERATOR_KEY);
    expect(io.out.join("")).toBe(
      `operator: notes-operator-laptop ${fingerprint}\n` +
        `operator: notes-operator-byhand ${fingerprint} (NOT bound to deploy.sh with restrict: re-add it with operator add-key)\n`,
    );
  });

  it("says when the app has none, and fails when the file cannot be read", async () => {
    const io = createIo();
    await runCli(["operator", "list", ...BASE], io, createDeps());
    expect(io.out.join("")).toContain("notes has no operator keys");

    const failing = createIo();
    const deps = createDeps(() => ({ status: 255, stderr: "Permission denied (publickey).\n" }));
    await expect(runCli(["operator", "list", ...BASE], failing, deps)).resolves.toBe(1);
    expect(failing.err.join("")).toContain("cannot read deploy's authorized_keys as admin@srv.example.com: Permission denied (publickey).");
  });
});
