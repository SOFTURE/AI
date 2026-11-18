import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FILESYSTEM_MOUNTPOINT_ATTRIBUTE, HOST_METRIC_NAMES } from "../src/node/index.js";
import {
  type FilesystemStats,
  getBusyShare,
  parseCpuTimes,
  parseLoad1m,
  parseMeminfo,
  registerHostMetrics,
} from "../src/node/host-metrics.js";

const KIB = 1024;
const MEMINFO = ["MemTotal:        8000000 kB", "MemFree:          500000 kB", "MemAvailable:    2000000 kB", ""].join(
  "\n",
);
const STAT_FIRST = "cpu  100 0 100 700 100 0 0 0 0 0\ncpu0 50 0 50 350 50 0 0 0 0 0\n";
const STAT_SECOND = "cpu  250 0 150 1000 100 0 0 0 0 0\ncpu0 125 0 75 500 50 0 0 0 0 0\n";

type Point = {
  readonly value: number;
  readonly attributes: Record<string, unknown>;
};

let procDir: string;
let exporter: InMemoryMetricExporter;
let reader: PeriodicExportingMetricReader;
let provider: MeterProvider;

beforeEach(async () => {
  procDir = await mkdtemp(join(tmpdir(), "proc-"));
  exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 3_600_000,
  });
  provider = new MeterProvider({ readers: [reader] });
});

afterEach(async () => {
  await provider.shutdown();
  await rm(procDir, { recursive: true, force: true });
});

async function writeProc(files: Record<string, string>): Promise<void> {
  await Promise.all(Object.entries(files).map(([name, text]) => writeFile(join(procDir, name), text)));
}

/** The points of the last collection, by metric name, with their units checked. */
async function collect(): Promise<Map<string, Point[]>> {
  exporter.reset();
  await reader.forceFlush();
  const points = new Map<string, Point[]>();
  for (const batch of exporter.getMetrics()) {
    for (const scope of batch.scopeMetrics) {
      for (const metric of scope.metrics) {
        points.set(
          metric.descriptor.name,
          metric.dataPoints.map((point) => ({
            value: point.value as number,
            attributes: { ...point.attributes },
          })),
        );
      }
    }
  }
  return points;
}

function valueOf(points: Map<string, Point[]>, name: string): number | undefined {
  return points.get(name)?.[0]?.value;
}

const ROOT_DISK: FilesystemStats = {
  blockSize: 4096,
  blocks: 1000,
  availableBlocks: 150,
};

describe("registerHostMetrics", () => {
  it("reports the machine's memory, load, CPU count and each filesystem", async () => {
    await writeProc({
      meminfo: MEMINFO,
      stat: STAT_FIRST,
      loadavg: "1.25 0.80 0.50 2/300 4242\n",
    });
    registerHostMetrics({
      meter: provider.getMeter("test"),
      procDir,
      filesystems: ["/", "/srv/data"],
      readFilesystem: (path) =>
        Promise.resolve(path === "/" ? ROOT_DISK : { blockSize: 1024, blocks: 200, availableBlocks: 200 }),
      readCpuCount: () => 4,
    });

    const points = await collect();

    expect(valueOf(points, HOST_METRIC_NAMES.memoryLimit)).toBe(8_000_000 * KIB);
    expect(valueOf(points, HOST_METRIC_NAMES.memoryAvailable)).toBe(2_000_000 * KIB);
    expect(valueOf(points, HOST_METRIC_NAMES.memoryUtilization)).toBe(0.75);
    expect(valueOf(points, HOST_METRIC_NAMES.cpuLoad1m)).toBe(1.25);
    expect(valueOf(points, HOST_METRIC_NAMES.cpuCount)).toBe(4);
    expect(points.get(HOST_METRIC_NAMES.filesystemLimit)).toEqual([
      {
        value: 4_096_000,
        attributes: { [FILESYSTEM_MOUNTPOINT_ATTRIBUTE]: "/" },
      },
      {
        value: 204_800,
        attributes: { [FILESYSTEM_MOUNTPOINT_ATTRIBUTE]: "/srv/data" },
      },
    ]);
    expect(points.get(HOST_METRIC_NAMES.filesystemAvailable)).toEqual([
      {
        value: 614_400,
        attributes: { [FILESYSTEM_MOUNTPOINT_ATTRIBUTE]: "/" },
      },
      {
        value: 204_800,
        attributes: { [FILESYSTEM_MOUNTPOINT_ATTRIBUTE]: "/srv/data" },
      },
    ]);
    expect(points.get(HOST_METRIC_NAMES.filesystemUtilization)).toEqual([
      { value: 0.85, attributes: { [FILESYSTEM_MOUNTPOINT_ATTRIBUTE]: "/" } },
      {
        value: 0,
        attributes: { [FILESYSTEM_MOUNTPOINT_ATTRIBUTE]: "/srv/data" },
      },
    ]);
  });

  it("reports CPU utilization only from the second collection, over the interval between them", async () => {
    await writeProc({
      meminfo: MEMINFO,
      stat: STAT_FIRST,
      loadavg: "0.1 0.1 0.1 1/1 1\n",
    });
    registerHostMetrics({
      meter: provider.getMeter("test"),
      procDir,
      readFilesystem: () => Promise.resolve(ROOT_DISK),
    });

    const first = await collect();
    expect(first.has(HOST_METRIC_NAMES.cpuUtilization)).toBe(false);

    await writeProc({ stat: STAT_SECOND });
    const second = await collect();
    // 500 ticks passed, 200 of them busy (user 150 + system 50); idle and iowait are not busy.
    expect(valueOf(second, HOST_METRIC_NAMES.cpuUtilization)).toBe(0.4);
  });

  it("skips the gauges whose source cannot be read and keeps the rest", async () => {
    registerHostMetrics({
      meter: provider.getMeter("test"),
      procDir: join(procDir, "missing"),
      filesystems: ["/gone"],
      readFilesystem: () => Promise.reject(new Error("ENOENT: no such file or directory, statfs '/gone'")),
      readCpuCount: () => 2,
    });

    const points = await collect();

    expect([...points.keys()]).toEqual([HOST_METRIC_NAMES.cpuCount]);
    expect(valueOf(points, HOST_METRIC_NAMES.cpuCount)).toBe(2);
  });

  it("reads the real machine's root filesystem and CPU count by default", async () => {
    registerHostMetrics({ meter: provider.getMeter("test") });

    const points = await collect();

    expect(valueOf(points, HOST_METRIC_NAMES.cpuCount)).toBeGreaterThan(0);
    const rootLimit = points.get(HOST_METRIC_NAMES.filesystemLimit)?.[0];
    expect(rootLimit?.attributes).toEqual({
      [FILESYSTEM_MOUNTPOINT_ATTRIBUTE]: "/",
    });
    expect(rootLimit?.value).toBeGreaterThan(0);
  });

  it("stops reporting once removed", async () => {
    const remove = registerHostMetrics({
      meter: provider.getMeter("test"),
      readCpuCount: () => 2,
    });
    remove();

    const points = await collect();

    expect(points.size).toBe(0);
  });

  it("reports zero utilization for an empty filesystem and an empty machine", async () => {
    await writeProc({ meminfo: "MemTotal: 0 kB\nMemAvailable: 0 kB\n" });
    registerHostMetrics({
      meter: provider.getMeter("test"),
      procDir,
      readFilesystem: () => Promise.resolve({ blockSize: 4096, blocks: 0, availableBlocks: 0 }),
    });

    const points = await collect();

    expect(valueOf(points, HOST_METRIC_NAMES.memoryUtilization)).toBe(0);
    expect(valueOf(points, HOST_METRIC_NAMES.filesystemUtilization)).toBe(0);
  });
});

describe("parseMeminfo", () => {
  it("returns null without the file or without MemAvailable", () => {
    expect(parseMeminfo(null)).toBeNull();
    expect(parseMeminfo("MemTotal: 1000 kB\n")).toBeNull();
    expect(parseMeminfo("MemAvailable: 1000 kB\n")).toBeNull();
  });
});

describe("parseCpuTimes", () => {
  it("reads the aggregate line only and counts idle and iowait as not busy", () => {
    expect(parseCpuTimes(STAT_FIRST)).toEqual({ busy: 200, total: 1000 });
  });

  it("returns null without the file, the aggregate line or numeric fields", () => {
    expect(parseCpuTimes(null)).toBeNull();
    expect(parseCpuTimes("cpu0 1 2 3 4\n")).toBeNull();
    expect(parseCpuTimes("cpu  1 2 3\n")).toBeNull();
    expect(parseCpuTimes("cpu  1 2 x 4\n")).toBeNull();
  });

  it("reads a line with exactly four fields (no iowait)", () => {
    expect(parseCpuTimes("cpu  10 0 10 80\n")).toEqual({
      busy: 20,
      total: 100,
    });
  });
});

describe("getBusyShare", () => {
  it("returns null when no tick passed or the counters went back", () => {
    expect(getBusyShare({ busy: 10, total: 100 }, { busy: 10, total: 100 })).toBeNull();
    expect(getBusyShare({ busy: 10, total: 100 }, { busy: 5, total: 50 })).toBeNull();
    expect(getBusyShare({ busy: 10, total: 100 }, { busy: 5, total: 150 })).toBeNull();
  });

  it("caps the share at one", () => {
    expect(getBusyShare({ busy: 0, total: 100 }, { busy: 200, total: 200 })).toBe(1);
    expect(getBusyShare({ busy: 0, total: 0 }, { busy: 50, total: 100 })).toBe(0.5);
  });
});

describe("parseLoad1m", () => {
  it("reads the first field and returns null for anything else", () => {
    expect(parseLoad1m("0.42 0.30 0.10 1/100 7\n")).toBe(0.42);
    expect(parseLoad1m(null)).toBeNull();
    expect(parseLoad1m("   \n")).toBeNull();
    expect(parseLoad1m("abc 1 2\n")).toBeNull();
  });
});
