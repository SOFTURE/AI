/**
 * How hyperframes captured a render, read from the summary it prints at the end (issue #1145). hyperframes 0.9.6 prints
 * `beginframe capture · software gpu · compile 0.8s · extract 8.7s · … · assemble 0.6s` and, after a screenshot
 * capture it did not ask for, a line `Screenshot capture (slower): BeginFrame did not run. …`.
 */

/** hyperframes' capture modes: `beginframe` (fast), `screenshot` (slower), `drawelement`. */
export type HyperframesCapturePath = "beginframe" | "screenshot" | "drawelement";

/** The browser's GPU mode for the render. */
export type HyperframesGpuMode = "software" | "hardware";

/** The pipeline stages hyperframes times, in the order it prints them. */
export const HYPERFRAMES_CAPTURE_STAGES = ["compile", "extract", "audio", "probe", "setup", "capture", "encode", "assemble"] as const;

export type HyperframesCaptureStage = (typeof HYPERFRAMES_CAPTURE_STAGES)[number];

export interface HyperframesCapture {
  /** The capture path; null when hyperframes printed none. */
  path: HyperframesCapturePath | null;
  /** The browser's GPU mode; null when hyperframes printed none. */
  gpu: HyperframesGpuMode | null;
  /** Seconds per stage, only the stages hyperframes printed. */
  seconds: Partial<Record<HyperframesCaptureStage, number>>;
  /** The encode ran during the capture (`encode (during capture)`), so its seconds overlap the capture's. */
  isEncodeStreamed: boolean;
  /** hyperframes' hint after a screenshot capture (`Screenshot capture (slower): …`); null when it printed none. */
  fallbackHint: string | null;
}

const SEPARATOR = " · ";
const CAPTURE_PATHS: readonly string[] = ["beginframe", "screenshot", "drawelement"];
const GPU_MODES: readonly string[] = ["software", "hardware"];
const STAGES: readonly string[] = HYPERFRAMES_CAPTURE_STAGES;
const FALLBACK_HINT_PREFIX = "Screenshot capture";
// SGR colour codes (`\x1b[2m…\x1b[22m`) that hyperframes' dim style may add.
// eslint-disable-next-line no-control-regex -- the escape character is what the pattern matches
const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;

/** hyperframes' `formatDuration`: `8.7s` under a minute, `1m 31.4s` from a minute on. */
function readDurationSeconds(text: string): number | null {
  const match = /^(?:(\d+)m )?(\d+(?:\.\d+)?)s$/.exec(text);
  if (match === null) return null;
  const minutes = match[1] === undefined ? 0 : Number(match[1]);
  return Math.round((minutes * 60 + Number(match[2])) * 1000) / 1000;
}

type SummaryPart =
  | { kind: "path"; path: HyperframesCapturePath }
  | { kind: "gpu"; gpu: HyperframesGpuMode }
  | { kind: "stage"; stage: HyperframesCaptureStage; seconds: number; isStreamed: boolean };

function readSummaryPart(part: string): SummaryPart | null {
  const path = /^(\w+) capture$/.exec(part)?.[1];
  if (path !== undefined) return CAPTURE_PATHS.includes(path) ? { kind: "path", path: path as HyperframesCapturePath } : null;
  const gpu = /^(\w+) gpu$/.exec(part)?.[1];
  if (gpu !== undefined) return GPU_MODES.includes(gpu) ? { kind: "gpu", gpu: gpu as HyperframesGpuMode } : null;
  const stage = /^(\w+)( \(during capture\))? (.+)$/.exec(part);
  if (stage === null) return null;
  const [, name = "", streamed, duration = ""] = stage;
  const seconds = readDurationSeconds(duration);
  if (!STAGES.includes(name) || seconds === null) return null;
  return { kind: "stage", stage: name as HyperframesCaptureStage, seconds, isStreamed: streamed !== undefined };
}

/** A summary line: every ` · ` part is a capture path, a GPU mode or a timed stage. Null for any other line. */
function readSummaryLine(line: string): Omit<HyperframesCapture, "fallbackHint"> | null {
  const parts = line.split(SEPARATOR).map(readSummaryPart);
  if (parts.length === 0 || parts.some((part) => part === null)) return null;
  const capture: Omit<HyperframesCapture, "fallbackHint"> = { path: null, gpu: null, seconds: {}, isEncodeStreamed: false };
  for (const part of parts) {
    if (part === null) continue;
    if (part.kind === "path") capture.path = part.path;
    else if (part.kind === "gpu") capture.gpu = part.gpu;
    else {
      capture.seconds[part.stage] = part.seconds;
      if (part.stage === "encode" && part.isStreamed) capture.isEncodeStreamed = true;
    }
  }
  return capture;
}

/**
 * The capture report from hyperframes' output lines (stdout and stderr, in order): the last summary line, plus the
 * screenshot hint when one was printed. Null when no line is a summary (an older or quiet hyperframes).
 */
export function readHyperframesCapture(lines: readonly string[]): HyperframesCapture | null {
  let summary: Omit<HyperframesCapture, "fallbackHint"> | null = null;
  let fallbackHint: string | null = null;
  for (const raw of lines) {
    const line = raw.replace(ANSI_PATTERN, "").trim();
    if (line.length === 0) continue;
    if (line.startsWith(FALLBACK_HINT_PREFIX)) {
      fallbackHint = line;
      continue;
    }
    summary = readSummaryLine(line) ?? summary;
  }
  return summary === null ? null : { ...summary, fallbackHint };
}
