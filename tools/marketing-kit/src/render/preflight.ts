import { spawnSync } from "node:child_process";

import { HYPERFRAMES_VERSION, runHyperframes } from "./hyperframes.js";

function isHyperframesReady(cwd: string): boolean {
  try {
    return runHyperframes(["--version"], { cwd, stdio: "ignore" }).status === 0;
  } catch {
    // Resolving the package failed: it is not installed, which is what the caller reports.
    return false;
  }
}

/**
 * A check of the machine before anything that takes a while: ffmpeg in PATH, and hyperframes when
 * the command renders. Returns the problem, or null when the machine is ready.
 */
export function findMachineProblem(options: { needsRender: boolean; cwd: string }): string | null {
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) {
    return "no ffmpeg in PATH: install it (macOS: brew install ffmpeg, Debian/Ubuntu: apt install ffmpeg).";
  }
  if (options.needsRender) {
    if (!isHyperframesReady(options.cwd)) {
      return `hyperframes ${HYPERFRAMES_VERSION} does not run: reinstall @softure-ai/marketing-kit. Its first render downloads a headless Chrome unless HYPERFRAMES_BROWSER_PATH names one.`;
    }
  }
  return null;
}
