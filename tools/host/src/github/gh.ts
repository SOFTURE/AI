import { z } from "zod";
import { fail } from "../cli/failure.js";
import type { CaptureResult, Runner } from "../cli/process.js";

/** The one Environment an app's release workflow deploys from. */
export const ENVIRONMENT = "production";
/** Release tags only: `softure-deploy init`'s release workflow tags `v*`. */
export const TAG_POLICY = "v*";

function isNotFound(result: CaptureResult): boolean {
  return result.status !== 0 && /HTTP 404/.test(result.stderr);
}

function describe(result: CaptureResult): string {
  return result.stderr.trim().split("\n").at(-1) ?? `exit ${result.status}`;
}

async function runGh(runner: Runner, args: string[], what: string, input?: string): Promise<string> {
  const result = await runner.capture("gh", args, input);
  if (result.status !== 0) return fail(`gh: cannot ${what}: ${describe(result)}`);
  return result.stdout;
}

function parseJson<T>(schema: z.ZodType<T>, text: string, what: string): T {
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return fail(`gh: ${what} did not answer with JSON`);
  }
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : fail(`gh: ${what} answered in an unexpected shape`);
}

/** Whether the repository has the Environment; a 404 is "no", any other failure stops the command. */
export async function hasEnvironment(runner: Runner, repo: string): Promise<boolean> {
  const result = await runner.capture("gh", ["api", `repos/${repo}/environments/${ENVIRONMENT}`, "--silent"]);
  if (result.status === 0) return true;
  if (isNotFound(result)) return false;
  return fail(`gh: cannot read the ${ENVIRONMENT} environment of ${repo}: ${describe(result)}`);
}

/** Creates the Environment with custom deployment policies (the tag policy follows). */
export async function createEnvironment(runner: Runner, repo: string): Promise<void> {
  const body = JSON.stringify({ deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } });
  await runGh(runner, ["api", "-X", "PUT", `repos/${repo}/environments/${ENVIRONMENT}`, "--input", "-"], `create the ${ENVIRONMENT} environment of ${repo}`, body);
}

const policiesSchema = z.object({ branch_policies: z.array(z.object({ name: z.string(), type: z.string().optional() })) });

/** Whether the Environment already lets `v*` tags deploy. */
export async function hasTagPolicy(runner: Runner, repo: string): Promise<boolean> {
  const what = `read the deployment policies of ${repo}`;
  const text = await runGh(runner, ["api", `repos/${repo}/environments/${ENVIRONMENT}/deployment-branch-policies`], what);
  const { branch_policies } = parseJson(policiesSchema, text, what);
  return branch_policies.some((policy) => policy.name === TAG_POLICY && policy.type === "tag");
}

export async function addTagPolicy(runner: Runner, repo: string): Promise<void> {
  await runGh(
    runner,
    ["api", "-X", "POST", `repos/${repo}/environments/${ENVIRONMENT}/deployment-branch-policies`, "-f", `name=${TAG_POLICY}`, "-f", "type=tag"],
    `add the ${TAG_POLICY} tag policy to ${repo}`,
  );
}

const secretListSchema = z.array(z.object({ name: z.string() }));

/** The names of the Environment's secrets (never their values: GitHub does not return them). */
export async function listSecretNames(runner: Runner, repo: string): Promise<Set<string>> {
  const what = `list the ${ENVIRONMENT} secrets of ${repo}`;
  const text = await runGh(runner, ["secret", "list", "--env", ENVIRONMENT, "--repo", repo, "--json", "name"], what);
  return new Set(parseJson(secretListSchema, text, what).map((secret) => secret.name));
}

/** Sets one Environment secret; the value goes to `gh` on stdin, never on its command line. */
export async function setSecret(runner: Runner, repo: string, name: string, value: string): Promise<void> {
  await runGh(runner, ["secret", "set", name, "--env", ENVIRONMENT, "--repo", repo], `set the secret ${name} of ${repo}`, value);
}

/** Sets one repository variable (not secret: it is printed in workflow logs anyway). */
export async function setVariable(runner: Runner, repo: string, name: string, value: string): Promise<void> {
  await runGh(runner, ["variable", "set", name, "--repo", repo, "--body", value], `set the variable ${name} of ${repo}`);
}

/** A file of the repository's default branch as text, or null when it does not exist. */
export async function readRepositoryFile(runner: Runner, repo: string, path: string): Promise<string | null> {
  const result = await runner.capture("gh", ["api", "-H", "Accept: application/vnd.github.raw", `repos/${repo}/contents/${path}`]);
  if (result.status === 0) return result.stdout;
  if (isNotFound(result)) return null;
  return fail(`gh: cannot read ${path} of ${repo}: ${describe(result)}`);
}
