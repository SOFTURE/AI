import { buildCollectionInstall, buildPlaybookRun, type PlaybookRun } from "../ansible/index.js";
import type { HostDeps } from "./context.js";
import { fail } from "./failure.js";

/** Installs the pinned collections, then runs one playbook; a non-zero exit of either stops the command. */
export async function runPlaybook(deps: HostDeps, run: PlaybookRun): Promise<void> {
  const install = buildCollectionInstall(deps.ansible);
  const installStatus = await deps.runner.stream(install.program, install.args, install.env);
  if (installStatus !== 0) fail(`ansible-galaxy could not install the collections (exit ${installStatus})`);
  const playbook = buildPlaybookRun(deps.ansible, run);
  const status = await deps.runner.stream(playbook.program, playbook.args, playbook.env);
  if (status !== 0) fail(`ansible-playbook ${run.playbook} failed (exit ${status}); nothing after it ran`);
}
