import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { getHyperframesBin, getHyperframesEnv, HYPERFRAMES_VERSION } from "../render/hyperframes.js";
import { runProcess } from "./process.js";

/**
 * The machine check before a footage run, so a worker image without the HEVC decoder or `zscale` fails at start
 * instead of inside the first HDR iPhone clip's normalize. Nothing here downloads anything.
 */

export interface FootageToolsOptions {
  /** Check hyperframes and its browser too (a run that renders); true by default. */
  needsRender?: boolean;
  /**
   * Accept a machine without hyperframes' browser, which its first render downloads (a developer's machine); a
   * worker image ships the browser, so the default is false.
   */
  isBrowserDownloadAllowed?: boolean;
  /** The environment the run sees (`HYPERFRAMES_BROWSER_PATH`, `PRODUCER_HEADLESS_SHELL_PATH`, `HOME`). */
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

/** What the footage blocks need from ffmpeg: decoders and filters, by the name ffmpeg lists them under. */
export const REQUIRED_DECODERS = ["hevc", "h264"] as const;
export const REQUIRED_FILTERS = ["zscale", "tonemap"] as const;

const INSTALL_HINT = "install an ffmpeg built with libzimg (macOS: brew install ffmpeg, Debian/Ubuntu: apt install ffmpeg)";

/** The names in `ffmpeg -decoders` or `-filters` output: the second column of each listing line. */
export function readFfmpegListing(output: string): Set<string> {
  const names = new Set<string>();
  for (const line of output.split("\n")) {
    const match = /^\s*[A-Z.|]{2,}\s+(\S+)\s/.exec(line);
    if (match?.[1] !== undefined && match[1] !== "=") names.add(match[1]);
  }
  return names;
}

async function listFfmpeg(kind: "-decoders" | "-filters", signal: AbortSignal | undefined): Promise<Set<string> | null> {
  const result = await runProcess({ command: "ffmpeg", args: ["-hide_banner", kind], ...(signal === undefined ? {} : { signal }) });
  return result.kind === "exited" && result.code === 0 ? readFfmpegListing(result.stdout) : null;
}

async function isRunnable(command: string, args: string[], options: { env?: NodeJS.ProcessEnv; signal?: AbortSignal }): Promise<boolean> {
  const result = await runProcess({ command, args, ...options });
  return result.kind === "exited" && result.code === 0;
}

/** A `chrome-headless-shell` binary in one of hyperframes' cache folders (`<base>/<version>/<platform folder>/`). */
function findCachedHeadlessShell(base: string): string | null {
  if (!existsSync(base)) return null;
  for (const version of readdirSync(base)) {
    const versionDir = join(base, version);
    if (!statSync(versionDir).isDirectory()) continue;
    for (const folder of readdirSync(versionDir)) {
      for (const name of ["chrome-headless-shell", "chrome-headless-shell.exe"]) {
        const binary = join(versionDir, folder, name);
        if (existsSync(binary)) return binary;
      }
    }
  }
  return null;
}

/**
 * The browser hyperframes renders with, resolved as hyperframes 0.8 does: `PRODUCER_HEADLESS_SHELL_PATH`, then
 * `HYPERFRAMES_BROWSER_PATH`, then its own and puppeteer's cache of chrome-headless-shell. A problem when none is there.
 */
export function findBrowserProblem(env: NodeJS.ProcessEnv): string | null {
  for (const name of ["PRODUCER_HEADLESS_SHELL_PATH", "HYPERFRAMES_BROWSER_PATH"]) {
    const path = env[name];
    if (path === undefined || path.length === 0) continue;
    return existsSync(path) ? null : `${name} names ${path}, which does not exist.`;
  }
  const home = env.HOME ?? env.USERPROFILE ?? homedir();
  const caches = [join(home, ".cache", "hyperframes", "chrome", "chrome-headless-shell"), join(home, ".cache", "puppeteer", "chrome-headless-shell")];
  if (caches.some((base) => findCachedHeadlessShell(base) !== null)) return null;
  return "hyperframes has no browser: run `npx hyperframes browser ensure` in the image, or set HYPERFRAMES_BROWSER_PATH to a chrome-headless-shell.";
}

/**
 * Checks the machine for a footage run: ffmpeg and ffprobe run, ffmpeg decodes HEVC and H.264 and has `zscale` and
 * `tonemap` (HDR clips), and, for a render, hyperframes runs and has its browser. Returns every problem found; an
 * empty list means the machine is ready.
 */
export async function checkFootageTools(options: FootageToolsOptions = {}): Promise<string[]> {
  const { signal } = options;
  const env = options.env ?? process.env;
  const problems: string[] = [];
  const aborting = signal === undefined ? {} : { signal };
  const decoders = await listFfmpeg("-decoders", signal);
  if (decoders === null) {
    problems.push(`no ffmpeg in PATH: ${INSTALL_HINT}.`);
  } else {
    const filters = await listFfmpeg("-filters", signal);
    for (const decoder of REQUIRED_DECODERS) if (!decoders.has(decoder)) problems.push(`ffmpeg has no ${decoder} decoder: ${INSTALL_HINT}.`);
    for (const filter of REQUIRED_FILTERS) {
      if (filters?.has(filter) !== true) problems.push(`ffmpeg has no ${filter} filter (HDR clips need it): ${INSTALL_HINT}.`);
    }
  }
  if (!(await isRunnable("ffprobe", ["-version"], aborting))) problems.push(`no ffprobe in PATH: it comes with ffmpeg; ${INSTALL_HINT}.`);
  if (options.needsRender === false) return problems;
  let hyperframes: string | null = null;
  try {
    hyperframes = getHyperframesBin();
  } catch {
    // Resolving the package failed: it is not installed, reported below.
  }
  if (hyperframes === null || !(await isRunnable(process.execPath, [hyperframes, "--version"], { env: getHyperframesEnv(env), ...aborting }))) {
    problems.push(`hyperframes ${HYPERFRAMES_VERSION} does not run: reinstall @softure-ai/marketing-kit.`);
  } else if (options.isBrowserDownloadAllowed !== true) {
    const browser = findBrowserProblem(env);
    if (browser !== null) problems.push(browser);
  }
  return problems;
}
