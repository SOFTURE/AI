import type { Inventory, InventoryApp } from "../inventory/index.js";
import { CLOUDFLARE_RANGES } from "./cloudflare-ranges.js";

/** Where every app's folder lives on the server; deploy.sh and the key's forced command assume it. */
export const APP_ROOT = "/srv";

export type ExtraVars = Record<string, unknown>;

/** How Ansible reaches the server as `user`. */
export function buildConnectionVars(inventory: Inventory, user: string): ExtraVars {
  const { server } = inventory;
  return {
    ansible_host: server.host,
    ansible_user: user,
    ansible_port: server.port,
    ...(server.identityFile === undefined ? {} : { ansible_ssh_private_key_file: server.identityFile }),
  };
}

export interface ServerVarsOptions {
  /** The admin's public key line: system_hardening writes it as the admin user's only authorized key. */
  adminPublicKey: string;
  /** Who Ansible logs in as: the admin user, or a provider's first user (root, ubuntu) on a fresh server. */
  connectAs: string;
}

/** The extra vars of ansible/server.yml: the collection's bootstrap and the three edge roles. */
export function buildServerVars(inventory: Inventory, options: ServerVarsOptions): ExtraVars {
  const { server, edge, firewall } = inventory;
  return {
    ...buildConnectionVars(inventory, options.connectAs),
    vps_app_user: server.adminUser,
    vps_app_group: server.adminUser,
    vps_app_user_ssh_public_key_local: options.adminPublicKey,
    vps_prompt_for_ssh_key: false,
    vps_github_actions_ssh_required: false,
    vps_timezone: server.timezone,
    vps_locale: "en_US.UTF-8",
    vps_auto_updates_enabled: true,
    vps_unattended_upgrades_enabled: true,
    // sshd's AllowUsers: without the deploy user every release is turned away at login.
    vps_ssh_allowed_users: [server.adminUser, server.deployUser],
    docker_networks: [{ name: edge.network }],
    deploy_user_name: server.deployUser,
    deploy_user_app_root: APP_ROOT,
    deploy_user_apps: [],
    traefik_edge_enabled: edge.manage,
    traefik_edge_name: edge.name,
    traefik_edge_dir: `${APP_ROOT}/${edge.name}`,
    traefik_edge_network: edge.network,
    traefik_edge_cert_resolver: edge.certResolver,
    traefik_edge_acme_email: edge.acmeEmail ?? "",
    traefik_edge_trusted_ips: edge.cdn === "cloudflare" ? [...CLOUDFLARE_RANGES] : [],
    cloudflare_origin_enabled: firewall.manage,
    cloudflare_origin_name: firewall.name,
    cloudflare_origin_ranges_file: firewall.rangesFile,
  };
}

export interface AppVarsOptions {
  /** The new release key's public line; absent keeps the line already on the server. */
  publicKey?: string;
  /** A local copy of the app's docker/server/deploy.sh, installed only when the server has none. */
  deployScriptFile: string;
}

/** The extra vars of ansible/app.yml: one app's folder, first deploy.sh and key line, as the admin user. */
export function buildAppVars(inventory: Inventory, app: InventoryApp, options: AppVarsOptions): ExtraVars {
  return {
    ...buildConnectionVars(inventory, inventory.server.adminUser),
    deploy_user_name: inventory.server.deployUser,
    host_app_name: app.slug,
    host_app_root: APP_ROOT,
    host_app_deploy_script_file: options.deployScriptFile,
    ...(options.publicKey === undefined ? {} : { host_app_key: options.publicKey }),
  };
}
