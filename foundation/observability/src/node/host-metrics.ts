import { statfs } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { join } from "node:path";

import type { BatchObservableResult, Meter, ObservableGauge } from "@opentelemetry/api";

import { readText } from "./memory-metrics.js";

/** Where Linux shows the machine's memory and CPU; inside a container without lxcfs it is the host's. */
export const DEFAULT_PROC_DIR = "/proc";

/** The gauges' names; a Prometheus backend adds `_bytes` (unit `By`) or `_ratio` (unit `1`). */
export const HOST_METRIC_NAMES = {
  memoryLimit: "system.memory.limit",
  memoryAvailable: "system.memory.available",
  memoryUtilization: "system.memory.utilization",
  cpuUtilization: "system.cpu.utilization",
  cpuLoad1m: "system.cpu.load_average.1m",
  cpuCount: "system.cpu.logical.count",
  filesystemLimit: "system.filesystem.limit",
  filesystemAvailable: "system.filesystem.available",
  filesystemUtilization: "system.filesystem.utilization",
} as const;

/** The attribute that names the filesystem's path on the filesystem gauges. */
export const FILESYSTEM_MOUNTPOINT_ATTRIBUTE = "system.filesystem.mountpoint";

/** What `statfs` answers for one path, in the fields the gauges read. */
export type FilesystemStats = {
  readonly blockSize: number;
  readonly blocks: number;
  /** Blocks free to an unprivileged process (`f_bavail`), what an app can still write. */
  readonly availableBlocks: number;
};

export type HostMetricsOptions = {
  readonly meter: Meter;
  /** The paths whose filesystems are measured; default `["/"]`, in a container the disk its image and volumes live on. */
  readonly filesystems?: readonly string[];
  /** The `/proc` directory to read; default `/proc` (tests point it at a fixture). */
  readonly procDir?: string;
  /** `statfs` of a path; default `node:fs/promises` `statfs` (tests). */
  readonly readFilesystem?: (path: string) => Promise<FilesystemStats>;
  /** The machine's logical CPU count; default `os.availableParallelism()` (tests). */
  readonly readCpuCount?: () => number;
};

/** CPU time counters of `/proc/stat`'s `cpu` line, in clock ticks. */
type CpuTimes = { readonly busy: number; readonly total: number };

/**
 * Registers the machine's memory, CPU and filesystems, read at collection time from inside the process, so a
 * container on a shared host reports the host without an agent: memory from `/proc/meminfo` (`MemTotal`,
 * `MemAvailable`), CPU utilization from `/proc/stat` over the interval since the previous collection (none on the
 * first), the 1-minute load from `/proc/loadavg`, and each filesystem's size and free space from `statfs`, with its
 * path as `system.filesystem.mountpoint`. A source that cannot be read skips its gauges for that collection (macOS
 * has no `/proc`). Returns the function that removes the callback.
 */
export function registerHostMetrics(options: HostMetricsOptions): () => void {
  const { meter } = options;
  const procDir = options.procDir ?? DEFAULT_PROC_DIR;
  const filesystems = options.filesystems ?? ["/"];
  const readFilesystem = options.readFilesystem ?? readFilesystemWithStatfs;
  const readCpuCount = options.readCpuCount ?? availableParallelism;
  const gauge = (name: string, unit: string, description: string): ObservableGauge =>
    meter.createObservableGauge(name, { unit, description });
  const memoryLimit = gauge(HOST_METRIC_NAMES.memoryLimit, "By", "The machine's memory (MemTotal)");
  const memoryAvailable = gauge(
    HOST_METRIC_NAMES.memoryAvailable,
    "By",
    "Memory available without swapping (MemAvailable)",
  );
  const memoryUtilization = gauge(HOST_METRIC_NAMES.memoryUtilization, "1", "Share of the machine's memory in use");
  const cpuUtilization = gauge(
    HOST_METRIC_NAMES.cpuUtilization,
    "1",
    "Share of the machine's CPU time busy since the last collection",
  );
  const cpuLoad = gauge(HOST_METRIC_NAMES.cpuLoad1m, "{thread}", "The machine's 1-minute load average");
  const cpuCount = gauge(HOST_METRIC_NAMES.cpuCount, "{cpu}", "The machine's logical CPUs");
  const filesystemLimit = gauge(HOST_METRIC_NAMES.filesystemLimit, "By", "The filesystem's size");
  const filesystemAvailable = gauge(
    HOST_METRIC_NAMES.filesystemAvailable,
    "By",
    "Space an unprivileged process can still write",
  );
  const filesystemUtilization = gauge(HOST_METRIC_NAMES.filesystemUtilization, "1", "Share of the filesystem in use");
  const observables = [
    memoryLimit,
    memoryAvailable,
    memoryUtilization,
    cpuUtilization,
    cpuLoad,
    cpuCount,
    filesystemLimit,
    filesystemAvailable,
    filesystemUtilization,
  ];
  let previousCpu: CpuTimes | null = null;

  const callback = async (result: BatchObservableResult): Promise<void> => {
    const [meminfo, stat, loadavg, disks] = await Promise.all([
      readText(join(procDir, "meminfo")),
      readText(join(procDir, "stat")),
      readText(join(procDir, "loadavg")),
      Promise.all(
        filesystems.map(async (path) => ({
          path,
          stats: await readFilesystemOrNull(readFilesystem, path),
        })),
      ),
    ]);
    result.observe(cpuCount, readCpuCount());
    const memory = parseMeminfo(meminfo);
    if (memory !== null) {
      result.observe(memoryLimit, memory.total);
      result.observe(memoryAvailable, memory.available);
      result.observe(memoryUtilization, memory.total === 0 ? 0 : (memory.total - memory.available) / memory.total);
    }
    const cpu = parseCpuTimes(stat);
    if (cpu !== null) {
      const busyShare = previousCpu === null ? null : getBusyShare(previousCpu, cpu);
      if (busyShare !== null) result.observe(cpuUtilization, busyShare);
      previousCpu = cpu;
    }
    const load = parseLoad1m(loadavg);
    if (load !== null) result.observe(cpuLoad, load);
    for (const { path, stats } of disks) {
      if (stats === null) continue;
      const attributes = { [FILESYSTEM_MOUNTPOINT_ATTRIBUTE]: path };
      const size = stats.blocks * stats.blockSize;
      const available = stats.availableBlocks * stats.blockSize;
      result.observe(filesystemLimit, size, attributes);
      result.observe(filesystemAvailable, available, attributes);
      result.observe(filesystemUtilization, size === 0 ? 0 : (size - available) / size, attributes);
    }
  };
  meter.addBatchObservableCallback(callback, observables);
  return () => {
    meter.removeBatchObservableCallback(callback, observables);
  };
}

async function readFilesystemWithStatfs(path: string): Promise<FilesystemStats> {
  const stats = await statfs(path);
  return {
    blockSize: stats.bsize,
    blocks: stats.blocks,
    availableBlocks: stats.bavail,
  };
}

async function readFilesystemOrNull(
  read: (path: string) => Promise<FilesystemStats>,
  path: string,
): Promise<FilesystemStats | null> {
  try {
    return await read(path);
  } catch {
    // A path that is gone or not mounted: its gauges have nothing to report this collection.
    return null;
  }
}

/** `MemTotal` and `MemAvailable` in bytes; null without either (no `/proc`, or a kernel older than 3.14). */
export function parseMeminfo(text: string | null): { readonly total: number; readonly available: number } | null {
  if (text === null) return null;
  const readKib = (field: string): number | null => {
    const match = new RegExp(`^${field}:\\s+(\\d+) kB$`, "m").exec(text);
    return match?.[1] === undefined ? null : Number(match[1]) * 1024;
  };
  const total = readKib("MemTotal");
  const available = readKib("MemAvailable");
  return total === null || available === null ? null : { total, available };
}

/** The aggregate `cpu` line of `/proc/stat`: idle and iowait are not busy; null when the line is missing. */
export function parseCpuTimes(text: string | null): CpuTimes | null {
  const line = text?.split("\n").find((row) => row.startsWith("cpu "));
  if (line === undefined) return null;
  const ticks = line.trim().split(/\s+/).slice(1).map(Number);
  if (ticks.length < 4 || ticks.some((tick) => !Number.isFinite(tick))) return null;
  const total = ticks.reduce((sum, tick) => sum + tick, 0);
  const idle = (ticks[3] ?? 0) + (ticks[4] ?? 0);
  return { busy: total - idle, total };
}

/** The busy share between two readings; null when no tick passed or the counters went back (a restart). */
export function getBusyShare(previous: CpuTimes, current: CpuTimes): number | null {
  const total = current.total - previous.total;
  const busy = current.busy - previous.busy;
  if (total <= 0 || busy < 0) return null;
  return Math.min(1, busy / total);
}

/** The first field of `/proc/loadavg`; null when it is not a number. */
export function parseLoad1m(text: string | null): number | null {
  const first = text?.trim().split(/\s+/)[0];
  if (first === undefined || first === "") return null;
  const value = Number(first);
  return Number.isFinite(value) ? value : null;
}
