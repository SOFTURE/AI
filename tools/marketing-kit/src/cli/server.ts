import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { join } from "node:path";

import type { MarketingConfig, VideoConfig } from "../config/config.js";
import { fail } from "./failure.js";

const START_TIMEOUT_SECONDS = 90;

async function isUp(url: string): Promise<boolean> {
  try {
    // 10 s: the first compile of a page in `next dev` can take longer than 3 s.
    return (await fetch(url, { signal: AbortSignal.timeout(10_000) })).ok;
  } catch {
    // Any failure to answer means "not up"; the caller starts its own server or reports the URL.
    return false;
  }
}

/** A running app, or one the CLI starts in the config folder for the recording and stops afterwards. */
export async function ensureServer(config: MarketingConfig, video: VideoConfig, explicitUrl?: string): Promise<{ url: string; stop: () => void }> {
  const url = explicitUrl ?? video.url;
  if (await isUp(url)) {
    console.log(`server: recording ${url}; make sure it serves this checkout (${config.root}).`);
    return { url, stop: () => {} };
  }
  if (explicitUrl !== undefined) fail(`${url} does not answer.`);
  const [command, ...args] = config.app.startCommand;
  // The config schema requires at least one element.
  const executable = command as string;
  console.log(`server: ${url} does not answer; starting ${config.app.startCommand.join(" ")} in ${config.root}.`);
  mkdirSync(config.output.buildDir, { recursive: true });
  const serverLog = join(config.output.buildDir, "server.log");
  const logFd = openSync(serverLog, "w");
  const child: ChildProcess = spawn(executable, args, { cwd: config.root, stdio: ["ignore", logFd, logFd], detached: true });
  // An object, not a `let`: the listeners write it later, which control-flow narrowing cannot see.
  const state: { exited: string | null } = { exited: null };
  child.on("error", (error) => {
    state.exited = `did not start: ${error.message}`;
  });
  child.on("exit", (code, signal) => {
    state.exited = `exited (code ${code ?? "-"}, signal ${signal ?? "-"})`;
  });
  let isStopped = false;
  const stop = () => {
    if (isStopped || child.pid === undefined) return;
    isStopped = true;
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      // ESRCH: the server is already gone, which is the point. Any other error is reported.
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        console.error(`server: could not stop the app (pid ${child.pid}): ${String(error)}`);
      }
    }
  };
  // `process.exit` skips finally blocks; without this hook an interrupted recording would leave an
  // orphaned server on the port (measured in FIRE).
  process.once("exit", stop);
  process.once("SIGINT", () => process.exit(130));
  for (let i = 0; i < START_TIMEOUT_SECONDS; i += 1) {
    if (state.exited !== null) fail(`the app ${state.exited}; log: ${serverLog}.`);
    if (await isUp(video.ownUrl)) return { url: video.ownUrl, stop };
    await new Promise((done) => setTimeout(done, 1000));
  }
  stop();
  fail(`the app did not answer at ${video.ownUrl} within ${START_TIMEOUT_SECONDS} s; log: ${serverLog}.`);
}
