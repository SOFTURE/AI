import { randomBytes } from "node:crypto";
import {
  addTagPolicy,
  createEnvironment,
  ENVIRONMENT,
  hasEnvironment,
  hasTagPolicy,
  listSecretNames,
  setSecret,
  setVariable,
  TAG_POLICY,
} from "../github/index.js";
import type { Inventory, InventoryApp } from "../inventory/index.js";
import { say, type HostDeps } from "./context.js";
import type { CliIo } from "./io.js";

/** The database passwords `softure-deploy init`'s compose file requires; URL-safe, since they go into URLs. */
export const DATABASE_SECRETS = ["POSTGRES_PASSWORD", "SOFTURE_MIGRATOR_PASSWORD", "SOFTURE_APP_PASSWORD"] as const;

/**
 * Makes sure the Environment exists with its tag policy, then lists its secret names. The Environment comes first:
 * listing the secrets of one that does not exist is a 404. A dry run creates nothing and, for an Environment that
 * does not exist yet, reads nothing under it.
 */
export async function prepareEnvironment(io: CliIo, deps: HostDeps, repo: string, check: boolean): Promise<Set<string>> {
  const exists = await hasEnvironment(deps.runner, repo);
  if (!exists) {
    if (check) {
      say(io, "github", `would create the ${ENVIRONMENT} environment of ${repo} with the tag policy ${TAG_POLICY}`);
      return new Set();
    }
    await createEnvironment(deps.runner, repo);
    say(io, "github", `created the ${ENVIRONMENT} environment of ${repo}`);
  }
  if (await hasTagPolicy(deps.runner, repo)) {
    say(io, "github", `${ENVIRONMENT} deploys from ${TAG_POLICY} tags`);
  } else if (check) {
    say(io, "github", `would add the deployment policy: ${TAG_POLICY} tags`);
  } else {
    await addTagPolicy(deps.runner, repo);
    say(io, "github", `added the deployment policy: ${TAG_POLICY} tags`);
  }
  return listSecretNames(deps.runner, repo);
}

export interface SecretPlan {
  /** Name → value. Values are only ever handed to `gh` on stdin. */
  secrets: Map<string, string>;
  variables: Map<string, string>;
}

export interface SecretPlanInput {
  inventory: Inventory;
  app: InventoryApp;
  existing: ReadonlySet<string>;
  knownHosts: string;
  /** The new private key, when one was issued. */
  privateKey: string | undefined;
}

/** What `app add` writes: the deploy connection always, the key when new, passwords only when missing. */
export function planSecrets(input: SecretPlanInput): SecretPlan {
  const { inventory, app, existing } = input;
  const secrets = new Map<string, string>([
    ["DEPLOY_SSH_HOST", inventory.server.host],
    ["DEPLOY_SSH_USER", inventory.server.deployUser],
    ["DEPLOY_SSH_KNOWN_HOSTS", input.knownHosts],
  ]);
  if (input.privateKey !== undefined) secrets.set("DEPLOY_SSH_KEY", input.privateKey);
  if (inventory.edge.cdn === "cloudflare" && inventory.server.ipv4 !== undefined) {
    secrets.set("DEPLOY_ORIGIN_IP", inventory.server.ipv4);
  }
  if (app.database) {
    // A new password on an existing database volume locks the app out: only a missing one is generated.
    for (const name of DATABASE_SECRETS) {
      if (!existing.has(name)) secrets.set(name, randomBytes(32).toString("hex"));
    }
  }
  return { secrets, variables: new Map([["APP_HOST", app.host]]) };
}

/** Writes the plan, or in a dry run prints the names it would write. Never prints a value. */
export async function writeSecrets(io: CliIo, deps: HostDeps, repo: string, plan: SecretPlan, check: boolean): Promise<void> {
  const names = [...plan.secrets.keys()];
  if (check) {
    say(io, "github", `would set the ${ENVIRONMENT} secrets ${names.join(", ")} and the variable ${[...plan.variables.keys()].join(", ")}`);
    return;
  }
  for (const [name, value] of plan.secrets) await setSecret(deps.runner, repo, name, value);
  for (const [name, value] of plan.variables) await setVariable(deps.runner, repo, name, value);
  say(io, "github", `set the ${ENVIRONMENT} secrets ${names.join(", ")} and the variable ${[...plan.variables.keys()].join(", ")}`);
}
