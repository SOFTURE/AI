import { resolve } from "node:path";

import { buildThemePackage } from "../build/build-theme-package.js";

export interface ThemeCssCommandInput {
  argv: readonly string[];
  cwd: string;
  write?: (line: string) => void;
  writeError?: (line: string) => void;
}

const USAGE = "Usage: softure-theme-css [packageDir]   (default: the current folder, after tsc)";

/** `softure-theme-css [packageDir]`: builds a theme package's stylesheets; returns the exit code. */
export async function runThemeCssCommand({
  argv,
  cwd,
  write = (line) => console.log(line),
  writeError = (line) => console.error(line),
}: ThemeCssCommandInput): Promise<number> {
  if (argv.length > 1 || argv[0] === "--help" || argv[0] === "-h") {
    writeError(USAGE);
    return argv.length > 1 ? 1 : 0;
  }
  const packageDir = resolve(cwd, argv[0] ?? ".");
  const result = await buildThemePackage(packageDir);
  if (!result.ok) {
    writeError(`softure-theme-css: ${result.error}`);
    return 1;
  }
  write(`softure-theme-css: ${result.files.join(", ")} in ${resolve(packageDir, "dist")}`);
  return 0;
}
