// @ts-check
// Tells a tag release whether its commit already passed the gates on master:
// `node scripts/release/master-gates.mjs <sha>` prints `passed` or `run`.
//
// `ci.yml` runs typecheck, lint and the whole test suite on every push to master. When the tagged commit has a
// successful run of it, `release.yml` skips repeating those gates (20 to 30 minutes on one runner). While such a run is
// queued or in progress the script waits for it. No run, a failed or cancelled run, a timeout or any API error
// answers `run`: the release then runs the gates itself, so a commit is never published untested.
// Needs GITHUB_TOKEN (actions: read) and GITHUB_REPOSITORY. See scripts/release/README.md.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKFLOW = "ci.yml";
const BRANCH = "master";
const POLL_MS = 30_000;
const WAIT_LIMIT_MS = 30 * 60_000;
const SHA_PATTERN = /^[0-9a-f]{40}$/;

/**
 * @typedef {{ status: string | null, conclusion: string | null }} WorkflowRun
 * @typedef {"passed" | "wait" | "run"} GatesDecision
 */

/**
 * What a release does about its gates, given the master push runs of `ci.yml` for its commit.
 * @param {WorkflowRun[]} runs
 * @returns {GatesDecision}
 */
export function decideGates(runs) {
  if (runs.some((run) => run.status === "completed" && run.conclusion === "success")) return "passed";
  if (runs.some((run) => run.status !== "completed")) return "wait";
  return "run";
}

/**
 * Reads the push runs of `ci.yml` on master for one commit.
 * @param {{ repository: string, sha: string, token: string }} options
 * @returns {Promise<WorkflowRun[]>}
 */
async function fetchMasterRuns({ repository, sha, token }) {
  const query = new URLSearchParams({ head_sha: sha, event: "push", branch: BRANCH, per_page: "20" });
  const url = `https://api.github.com/repos/${repository}/actions/workflows/${WORKFLOW}/runs?${query.toString()}`;
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Listing ${WORKFLOW} runs of ${sha} failed: HTTP ${String(response.status)}`);
  /** @type {unknown} */
  const body = await response.json();
  const runs = /** @type {{ workflow_runs?: unknown }} */ (body).workflow_runs;
  if (!Array.isArray(runs)) throw new Error(`Listing ${WORKFLOW} runs of ${sha} returned no workflow_runs`);
  return runs.map((run) => readRun(/** @type {unknown} */ (run)));
}

/**
 * Narrows one run of the API answer to the two fields the decision reads.
 * @param {unknown} run
 * @returns {WorkflowRun}
 */
function readRun(run) {
  const fields = typeof run === "object" && run !== null ? /** @type {Record<string, unknown>} */ (run) : {};
  return {
    status: typeof fields.status === "string" ? fields.status : null,
    conclusion: typeof fields.conclusion === "string" ? fields.conclusion : null,
  };
}

/**
 * Waits for a decision: `passed` or `run`, never `wait`.
 * @param {{ repository: string, sha: string, token: string }} options
 * @returns {Promise<"passed" | "run">}
 */
async function waitForGates(options) {
  const deadline = Date.now() + WAIT_LIMIT_MS;
  for (;;) {
    const decision = decideGates(await fetchMasterRuns(options));
    if (decision !== "wait") return decision;
    if (Date.now() >= deadline) {
      console.error(`The ${WORKFLOW} run of ${options.sha} on ${BRANCH} is still running after 30 minutes.`);
      return "run";
    }
    console.error(`The ${WORKFLOW} run of ${options.sha} on ${BRANCH} is still running; checking again in 30 s.`);
    await new Promise((done) => setTimeout(done, POLL_MS));
  }
}

async function runCli() {
  const sha = process.argv[2] ?? "";
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const token = process.env.GITHUB_TOKEN ?? "";
  if (!SHA_PATTERN.test(sha) || repository === "" || token === "") {
    console.error("Checking the master gates needs a full commit SHA, GITHUB_REPOSITORY and GITHUB_TOKEN.");
    console.log("run");
    return;
  }
  try {
    console.log(await waitForGates({ repository, sha, token }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.log("run");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
