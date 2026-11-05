import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { quoteShellArgument, splitFilterGraph, type FfmpegFailure } from "./ffmpeg-command.js";
import { runFfprobe } from "./probe.js";

/** The files `writeFfmpegFailure` writes, by name. */
export const FFMPEG_FAILURE_FILES = { command: "command.sh", filterGraph: "filtergraph.txt", stderr: "stderr.log", inputs: "inputs.json" } as const;

/** One input's ffprobe facts (`ffprobe -show_format -show_streams` JSON), or why there are none. */
export type FfmpegFailureInput =
  | { input: string; kind: "probed"; json: unknown }
  | { input: string; kind: "probe-failed"; error: string }
  | { input: string; kind: "lavfi" };

/** The command's `-filter_complex` graph; null when it has none. */
function findFilterGraph(args: readonly string[]): string | null {
  const at = args.indexOf("-filter_complex");
  return at === -1 ? null : (args[at + 1] ?? null);
}

/**
 * `command.sh` for a failure: runs the same ffmpeg in the same folder. A `-filter_complex` graph is read from
 * `filtergraph.txt` next to the script, with `-/filter_complex` on ffmpeg 7.1 and later and `-filter_complex_script`
 * before it (the script asks `ffmpeg -version`).
 */
export function buildFfmpegFailureScript(failure: FfmpegFailure): string {
  const at = failure.args.indexOf("-filter_complex");
  const hasGraph = findFilterGraph(failure.args) !== null;
  const words = failure.args.map((arg, index) => {
    if (hasGraph && index === at) return '"$graph_option"';
    if (hasGraph && index === at + 1) return `"$here/${FFMPEG_FAILURE_FILES.filterGraph}"`;
    return quoteShellArgument(arg);
  });
  const lines = [
    "#!/bin/sh",
    `# ${failure.step}: ffmpeg ended with code ${String(failure.code)} (signal ${failure.signal ?? "-"}).`,
    "# Runs the same ffmpeg command in the folder it ran in. stderr.log holds what it printed, inputs.json its inputs.",
    'here=$(cd "$(dirname "$0")" && pwd)',
    `cd ${quoteShellArgument(failure.cwd)} || exit 1`,
  ];
  if (hasGraph) {
    lines.push(
      "# ffmpeg 7.1 and later read a filter graph file with -/filter_complex, earlier versions with -filter_complex_script.",
      "graph_option=-/filter_complex",
      "case \"$(ffmpeg -version 2>/dev/null | sed -n '1s/^ffmpeg version n\\{0,1\\}\\([0-9][0-9]*\\.[0-9][0-9]*\\).*/\\1/p')\" in",
      "  [0-6].* | 7.0) graph_option=-filter_complex_script ;;",
      "esac",
    );
  }
  lines.push(`exec ffmpeg ${words.join(" ")}`, "");
  return lines.join("\n");
}

/** ffprobe's facts of every input; a `lavfi` source is not a file and is not probed. */
async function probeInputs(failure: FfmpegFailure, signal: AbortSignal | undefined): Promise<FfmpegFailureInput[]> {
  const probed: FfmpegFailureInput[] = [];
  for (const input of failure.inputs) {
    // Files are resolved to absolute paths; a lavfi source (`anullsrc=...`) is kept as it is.
    if (!isAbsolute(input)) {
      probed.push({ input, kind: "lavfi" });
      continue;
    }
    const result = await runFfprobe(input, signal === undefined ? {} : { signal });
    probed.push(result.ok ? { input, kind: "probed", json: result.json } : { input, kind: "probe-failed", error: result.error });
  }
  return probed;
}

/**
 * Writes a failed ffmpeg step to `dir` for a person to run again: `command.sh` (the command, run from the folder it
 * ran in), `filtergraph.txt` (its `-filter_complex` graph, one chain per line; only when it has one), `stderr.log`
 * (the whole stderr) and `inputs.json` (ffprobe's facts of every input). Answers the paths written.
 */
export async function writeFfmpegFailure(dir: string, failure: FfmpegFailure, options: { signal?: AbortSignal } = {}): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const written: string[] = [];
  const write = async (name: string, content: string, mode?: number): Promise<void> => {
    const path = join(dir, name);
    await writeFile(path, content, mode === undefined ? {} : { mode });
    written.push(path);
  };
  await write(FFMPEG_FAILURE_FILES.command, buildFfmpegFailureScript(failure), 0o755);
  const graph = findFilterGraph(failure.args);
  if (graph !== null) await write(FFMPEG_FAILURE_FILES.filterGraph, `${splitFilterGraph(graph).join(";\n")}\n`);
  await write(FFMPEG_FAILURE_FILES.stderr, failure.stderr.map((line) => `${line}\n`).join(""));
  await write(FFMPEG_FAILURE_FILES.inputs, `${JSON.stringify(await probeInputs(failure, options.signal), null, 2)}\n`);
  return written;
}
