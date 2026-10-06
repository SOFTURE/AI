import { readFileSync } from "node:fs";
import { parseDeployConfig, type DeployConfig } from "../verify/schema.js";
import { fail } from "./failure.js";

export const DEFAULT_DEPLOY_CONFIG = "deploy.json";

/** The app's `deploy.json` at `path`; an unreadable or invalid file stops `command` with exit 1 and the zod issues. */
export function readDeployConfig(command: string, path: string, shownPath: string): DeployConfig {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const reason = error instanceof SyntaxError ? "not valid JSON" : ((error as NodeJS.ErrnoException).code ?? "unknown error");
    return fail(`${command}: cannot read ${shownPath} (${reason}).`);
  }
  const parsed = parseDeployConfig(json);
  if (!parsed.ok) return fail(`${command}: ${shownPath} is not valid:\n${parsed.issues.map((issue) => `  ${issue}`).join("\n")}`);
  return parsed.config;
}
