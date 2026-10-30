import { launchProgress, type LaunchProgressConfig } from "./launch-progress.js";

export interface LaunchProgressOptions {
  /** 10 by default. */
  readonly paintShare?: number;
  /** 60 by default. */
  readonly assetsShare?: number;
  /** 29 by default. */
  readonly timeShare?: number;
  /** 4000 ms by default. */
  readonly timeConstantMs?: number;
  /** 100 ms by default. */
  readonly intervalMs?: number;
}

export const DEFAULT_LAUNCH_PROGRESS: LaunchProgressConfig = {
  paintShare: 10,
  assetsShare: 60,
  timeShare: 29,
  timeConstantMs: 4_000,
  intervalMs: 100,
};

function checkShare(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`resolveLaunchProgressConfig: ${name} must be a number of 0 or more, got ${value}`);
  return value;
}

function checkDuration(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`resolveLaunchProgressConfig: ${name} must be a positive number, got ${value}`);
  return value;
}

/** The counter's config: the options with their defaults, checked. The shares add up to at most 100. */
export function resolveLaunchProgressConfig(options: LaunchProgressOptions = {}): LaunchProgressConfig {
  const config: LaunchProgressConfig = {
    paintShare: checkShare("paintShare", options.paintShare ?? DEFAULT_LAUNCH_PROGRESS.paintShare),
    assetsShare: checkShare("assetsShare", options.assetsShare ?? DEFAULT_LAUNCH_PROGRESS.assetsShare),
    timeShare: checkShare("timeShare", options.timeShare ?? DEFAULT_LAUNCH_PROGRESS.timeShare),
    timeConstantMs: checkDuration("timeConstantMs", options.timeConstantMs ?? DEFAULT_LAUNCH_PROGRESS.timeConstantMs),
    intervalMs: checkDuration("intervalMs", options.intervalMs ?? DEFAULT_LAUNCH_PROGRESS.intervalMs),
  };
  const total = config.paintShare + config.assetsShare + config.timeShare;
  if (total > 100) throw new Error(`resolveLaunchProgressConfig: the shares add up to ${total}, more than 100`);
  return config;
}

/**
 * The text of the launch screen's inline `<script>`: the counter function called with the page's globals and the
 * config. Put it inside the launch screen (`LaunchScreen`'s `script` prop), which it finds from `document.currentScript`.
 */
export function buildLaunchProgressScript(options: LaunchProgressOptions = {}): string {
  const config = resolveLaunchProgressConfig(options);
  // `</` is escaped so the text can never close its own `<script>` element.
  const source = `(${launchProgress.toString()})({script:document.currentScript,document:document,performance:performance,timers:window},${JSON.stringify(config)});`;
  return source.replaceAll("</", "<\\/");
}
