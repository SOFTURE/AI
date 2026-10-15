import { describe, expect, it } from "vitest";
import { parseInventory } from "../inventory/index.js";
import { buildAppVars, buildCollectionInstall, buildPlaybookRun, buildServerVars, CLOUDFLARE_RANGES, findCollectionsDir } from "./index.js";

const inventory = parseInventory(
  {
    server: { host: "srv.example.com", port: 2222, adminUser: "admin", identityFile: "/keys/admin", timezone: "Europe/Warsaw" },
    edge: { acmeEmail: "ops@example.com", cdn: "cloudflare" },
    apps: [{ slug: "notes", repo: "acme/notes", host: "notes.example.com" }],
  },
  "test",
);
const paths = { ansibleDir: "/pkg/ansible", collectionsDir: "/cache/collections" };

describe("buildServerVars", () => {
  const vars = buildServerVars(inventory, { adminPublicKey: "ssh-ed25519 AAAA admin", connectAs: "root" });

  it("connects as the given user and lets both the admin and the deploy user through sshd", () => {
    expect(vars).toMatchObject({
      ansible_host: "srv.example.com",
      ansible_user: "root",
      ansible_port: 2222,
      ansible_ssh_private_key_file: "/keys/admin",
      vps_app_user: "admin",
      vps_app_user_ssh_public_key_local: "ssh-ed25519 AAAA admin",
      vps_prompt_for_ssh_key: false,
      vps_github_actions_ssh_required: false,
      vps_timezone: "Europe/Warsaw",
      vps_ssh_allowed_users: ["admin", "deploy"],
      vps_auto_updates_enabled: true,
      vps_unattended_upgrades_enabled: true,
    });
  });

  it("switches the edge roles on with the generic names", () => {
    expect(vars).toMatchObject({
      docker_networks: [{ name: "softure-edge" }],
      deploy_user_name: "deploy",
      deploy_user_apps: [],
      traefik_edge_enabled: true,
      traefik_edge_name: "softure-edge",
      traefik_edge_dir: "/srv/softure-edge",
      traefik_edge_network: "softure-edge",
      traefik_edge_cert_resolver: "letsencrypt",
      traefik_edge_acme_email: "ops@example.com",
      traefik_edge_trusted_ips: [...CLOUDFLARE_RANGES],
      cloudflare_origin_enabled: true,
      cloudflare_origin_name: "softure-cloudflare-only",
      cloudflare_origin_ranges_file: "/srv/softure-edge/cloudflare-ips.txt",
    });
  });

  it("trusts no proxy and installs no firewall without a CDN", () => {
    const plain = parseInventory({ server: { host: "h", adminUser: "admin" }, edge: { acmeEmail: "ops@example.com" } }, "t");
    expect(buildServerVars(plain, { adminPublicKey: "k", connectAs: "admin" })).toMatchObject({
      traefik_edge_trusted_ips: [],
      cloudflare_origin_enabled: false,
    });
  });
});

describe("buildAppVars", () => {
  const app = inventory.apps[0];
  if (app === undefined) throw new Error("fixture has an app");

  it("runs as the admin user and passes the key only when one was issued", () => {
    expect(buildAppVars(inventory, app, { deployScriptFile: "/tmp/x/deploy.sh", publicKey: "ssh-ed25519 BBBB notes-release" })).toEqual({
      ansible_host: "srv.example.com",
      ansible_user: "admin",
      ansible_port: 2222,
      ansible_ssh_private_key_file: "/keys/admin",
      deploy_user_name: "deploy",
      host_app_name: "notes",
      host_app_root: "/srv",
      host_app_deploy_script_file: "/tmp/x/deploy.sh",
      host_app_key: "ssh-ed25519 BBBB notes-release",
    });
    expect(buildAppVars(inventory, app, { deployScriptFile: "/tmp/x/deploy.sh" })).not.toHaveProperty("host_app_key");
  });
});

describe("Ansible command lines", () => {
  it("installs the pinned requirements into the package's own folder", () => {
    expect(buildCollectionInstall(paths)).toEqual({
      program: "ansible-galaxy",
      args: ["collection", "install", "-r", "/pkg/ansible/requirements.yml", "-p", "/cache/collections"],
      env: {},
    });
  });

  it("runs a playbook against the inline inventory with the vars as one JSON argument", () => {
    const vars = { vps_app_user_ssh_public_key_local: "ssh-ed25519 AAAA with spaces", ansible_ssh_common_args: "-o IdentitiesOnly=yes" };
    expect(buildPlaybookRun(paths, { playbook: "server.yml", vars, check: false })).toEqual({
      program: "ansible-playbook",
      args: ["/pkg/ansible/server.yml", "-i", "server,", "-e", JSON.stringify(vars)],
      env: { ANSIBLE_COLLECTIONS_PATH: "/cache/collections" },
    });
    expect(buildPlaybookRun(paths, { playbook: "app.yml", vars: {}, check: true }).args.slice(-2)).toEqual(["--check", "--diff"]);
  });

  it("caches collections per package version under XDG_CACHE_HOME, else ~/.cache", () => {
    expect(findCollectionsDir({ XDG_CACHE_HOME: "/xdg" }, "0.1.0")).toBe("/xdg/softure-host/0.1.0/collections");
    expect(findCollectionsDir({ HOME: "/home/u" }, "0.2.0")).toBe("/home/u/.cache/softure-host/0.2.0/collections");
  });
});
