import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { BatchObservableResult, Meter, ObservableGauge } from "@opentelemetry/api";

/** Where a cgroup v2 container sees its own memory controller (Docker, Kubernetes, systemd). */
export const DEFAULT_CGROUP_DIR = "/sys/fs/cgroup";

/** The gauges' names; a Prometheus backend adds `_bytes` (unit `By`). */
export const MEMORY_METRIC_NAMES = {
  processRss: "process.memory.usage",
  containerUsage: "container.memory.usage",
  containerWorkingSet: "container.memory.working_set",
  containerLimit: "container.memory.limit",
  containerSwap: "container.memory.swap.usage",
} as const;

export type MemoryMetricsOptions = {
  readonly meter: Meter;
  /** The cgroup v2 directory to read; default `/sys/fs/cgroup` (tests point it at a fixture). */
  readonly cgroupDir?: string;
  /** The process's resident set size in bytes; default `process.memoryUsage.rss()` (tests). */
  readonly readRss?: () => number;
};

type CgroupMemory = {
  usage: number;
  workingSet: number | null;
  limit: number | null;
  swap: number | null;
};

/**
 * Registers the process's resident set size and, inside a cgroup v2 container, the container's memory: its usage
 * (`memory.current`, page cache included), its working set (usage minus `inactive_file` from `memory.stat`, what the
 * kernel cannot drop before the OOM killer), its limit (`memory.max`, only when one is set) and its swap
 * (`memory.swap.current`). Outside a cgroup v2 container (macOS, cgroup v1) only the process gauge reports.
 * Every reading happens at collection time; a file that cannot be read skips its gauge for that collection.
 * Returns the function that removes the callback.
 */
export function registerMemoryMetrics(options: MemoryMetricsOptions): () => void {
  const { meter } = options;
  const cgroupDir = options.cgroupDir ?? DEFAULT_CGROUP_DIR;
  const readRss = options.readRss ?? (() => process.memoryUsage.rss());
  const gauge = (name: string, description: string): ObservableGauge =>
    meter.createObservableGauge(name, { unit: "By", description });
  const rss = gauge(MEMORY_METRIC_NAMES.processRss, "Resident set size of the process");
  const usage = gauge(MEMORY_METRIC_NAMES.containerUsage, "Memory charged to the container's cgroup, page cache included");
  const workingSet = gauge(MEMORY_METRIC_NAMES.containerWorkingSet, "Container memory minus inactive file cache");
  const limit = gauge(MEMORY_METRIC_NAMES.containerLimit, "The container's memory limit (memory.max)");
  const swap = gauge(MEMORY_METRIC_NAMES.containerSwap, "Swap used by the container's cgroup");
  const observables = [rss, usage, workingSet, limit, swap];

  const callback = async (result: BatchObservableResult): Promise<void> => {
    result.observe(rss, readRss());
    const cgroup = await readCgroupMemory(cgroupDir);
    if (cgroup === null) return;
    result.observe(usage, cgroup.usage);
    if (cgroup.workingSet !== null) result.observe(workingSet, cgroup.workingSet);
    if (cgroup.limit !== null) result.observe(limit, cgroup.limit);
    if (cgroup.swap !== null) result.observe(swap, cgroup.swap);
  };
  meter.addBatchObservableCallback(callback, observables);
  return () => {
    meter.removeBatchObservableCallback(callback, observables);
  };
}

/** The cgroup's memory, or null outside a cgroup v2 container (no readable `memory.current`). */
export async function readCgroupMemory(cgroupDir: string): Promise<CgroupMemory | null> {
  const read = (file: string): Promise<string | null> => readText(join(cgroupDir, file));
  const [current, max, stat, swap] = await Promise.all([
    read("memory.current"),
    read("memory.max"),
    read("memory.stat"),
    read("memory.swap.current"),
  ]);
  const usage = parseBytes(current);
  if (usage === null) return null;
  const inactiveFile = parseStatField(stat, "inactive_file");
  return {
    usage,
    workingSet: inactiveFile === null ? null : Math.max(0, usage - inactiveFile),
    limit: parseBytes(max),
    swap: parseBytes(swap),
  };
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    // Missing outside a container or without the swap controller: that gauge has nothing to report.
    return null;
  }
}

/** A whole number of bytes; null for a missing file, `max` (no limit) or anything else. */
function parseBytes(text: string | null): number | null {
  if (text === null) return null;
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

function parseStatField(stat: string | null, field: string): number | null {
  if (stat === null) return null;
  for (const line of stat.split("\n")) {
    const [key, value] = line.trim().split(/\s+/);
    if (key === field) return parseBytes(value ?? null);
  }
  return null;
}
