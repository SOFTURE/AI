import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP_ROOT, buildAppVars } from "../ansible/index.js";
import { findRequiredNames, readRepositoryFile } from "../github/index.js";
import { findApp, loadInventory } from "../inventory/index.js";
import { formatKnownHosts, generateDeployKey, getFingerprint, readHostKeys, type DeployKey } from "../ssh/index.js";
import { runPlaybook } from "./ansible-step.js";
import { runCloudflareStep } from "./cloudflare-step.js";
import { resolvePath, say, type HostDeps } from "./context.js";
import { fail } from "./failure.js";
import { planSecrets, prepareEnvironment, writeSecrets } from "./github-step.js";
import type { CliIo } from "./io.js";
import { readFlags, requireFlag } from "./options.js";

/** Where `softure-deploy init` puts the server script and the production compose file of an app. */
export const DEPLOY_SCRIPT_PATH = "docker/server/deploy.sh";
export const COMPOSE_PATH = "docker/prod/docker-compose.yml";

/** Stands in for the key a real run would issue, so check mode reports the key line it would write. */
const DRY_RUN_KEY = `ssh-ed25519 ${"A".repeat(68)} dry-run`;

/**
 * `softure-host app add`: onboards one app of the inventory, in order: the GitHub Environment (before anything reads
 * its secrets), the server (folder, first deploy.sh, release key line), the GitHub secrets, Cloudflare. Idempotent;
 * `--check` changes nothing anywhere. A deploy key is issued when GitHub has none, or with `--rotate-key`.
 */
export async function runAppAdd(args: string[], io: CliIo, deps: HostDeps): Promise<void> {
  const flags = readFlags("app add", args, {
    inventory: { type: "string" },
    app: { type: "string" },
    check: { type: "boolean", default: false },
    "rotate-key": { type: "boolean", default: false },
  });
  const inventory = await loadInventory(resolvePath(io, requireFlag("app add", "inventory", flags.inventory)));
  const app = findApp(inventory, requireFlag("app add", "app", flags.app));
  const { check } = flags;
  say(io, "app", `${check ? "checking" : "onboarding"} ${app.slug} (${app.repo}, https://${app.host}) on ${inventory.server.host}`);

  const existing = await prepareEnvironment(io, deps, app.repo, check);
  const deployScript = await readRepositoryFile(deps.runner, app.repo, DEPLOY_SCRIPT_PATH);
  if (deployScript === null) return fail(`app add: ${app.repo} has no ${DEPLOY_SCRIPT_PATH}; run softure-deploy init in the app first`);

  const needsKey = flags["rotate-key"] || !existing.has("DEPLOY_SSH_KEY");
  // A dry run issues no key: the playbook's check mode is told one would be written.
  const key: DeployKey | undefined = needsKey && !check ? generateDeployKey(`${app.slug}-release`) : undefined;
  if (needsKey) say(io, "server", `${check ? "would issue" : "issued"} a new release key for ${app.slug}${key === undefined ? "" : ` (${getFingerprint(key.publicKey)})`}`);

  const workDir = await mkdtemp(join(tmpdir(), "softure-host-"));
  try {
    const deployScriptFile = join(workDir, "deploy.sh");
    await writeFile(deployScriptFile, deployScript, { mode: 0o600 });
    const publicKey = key?.publicKey ?? (needsKey ? DRY_RUN_KEY : undefined);
    await runPlaybook(deps, { playbook: "app.yml", vars: buildAppVars(inventory, app, { publicKey, deployScriptFile }), check });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
  say(io, "server", `${APP_ROOT}/${app.slug} ready for ${inventory.server.deployUser}`);

  const hostKeys = await readHostKeys(deps.runner, inventory);
  for (const hostKey of hostKeys) say(io, "server", `host key ${hostKey.type} ${getFingerprint(`${hostKey.type} ${hostKey.key}`)}`);
  const plan = planSecrets({
    inventory,
    app,
    existing,
    knownHosts: formatKnownHosts(inventory.server.host, inventory.server.port, hostKeys),
    privateKey: key?.privateKey,
  });
  await writeSecrets(io, deps, app.repo, plan, check);

  await runCloudflareStep(io, deps, inventory, app, check);

  const compose = await readRepositoryFile(deps.runner, app.repo, COMPOSE_PATH);
  if (compose !== null) {
    const missing = findRequiredNames(compose).filter((name) => !existing.has(name) && !plan.secrets.has(name));
    say(io, "github", missing.length === 0 ? `every name ${COMPOSE_PATH} requires is set` : `still to set by hand (the app's own secrets): ${missing.join(", ")}`);
  }
  say(io, "app", check ? "check done; nothing was changed" : `done. Next: run ${app.repo}'s release workflow; its deploy.json verify checks the result`);
}
