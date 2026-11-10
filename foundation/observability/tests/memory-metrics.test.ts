import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
  type ResourceMetrics,
} from "@opentelemetry/sdk-metrics";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MEMORY_METRIC_NAMES } from "../src/node/index.js";
import { readCgroupMemory, registerMemoryMetrics } from "../src/node/memory-metrics.js";

const MIB = 1024 * 1024;

let cgroupDir: string;
let exporter: InMemoryMetricExporter;
let reader: PeriodicExportingMetricReader;
let provider: MeterProvider;

beforeEach(async () => {
  cgroupDir = await mkdtemp(join(tmpdir(), "cgroup-"));
  exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 3_600_000 });
  provider = new MeterProvider({ readers: [reader] });
});

afterEach(async () => {
  await provider.shutdown();
  await rm(cgroupDir, { recursive: true, force: true });
});

async function writeCgroup(files: Record<string, string>): Promise<void> {
  await Promise.all(Object.entries(files).map(([name, text]) => writeFile(join(cgroupDir, name), text)));
}

async function collectGauges(): Promise<Map<string, number>> {
  await reader.forceFlush();
  const batches: ResourceMetrics[] = exporter.getMetrics();
  const values = new Map<string, number>();
  for (const batch of batches) {
    for (const scope of batch.scopeMetrics) {
      for (const metric of scope.metrics) {
        const point = metric.dataPoints.at(-1);
        if (point !== undefined) values.set(metric.descriptor.name, point.value as number);
        expect(metric.descriptor.unit).toBe("By");
      }
    }
  }
  return values;
}

const STAT = ["anon 104857600", "file 52428800", "inactive_file 31457280", "active_file 20971520", ""].join("\n");

describe("registerMemoryMetrics", () => {
  it("reports the process RSS and the container's usage, working set, limit and swap", async () => {
    await writeCgroup({
      "memory.current": `${String(200 * MIB)}\n`,
      "memory.max": `${String(1536 * MIB)}\n`,
      "memory.stat": STAT,
      "memory.swap.current": `${String(8 * MIB)}\n`,
    });
    registerMemoryMetrics({ meter: provider.getMeter("test"), cgroupDir, readRss: () => 123 * MIB });

    const values = await collectGauges();

    expect(Object.fromEntries(values)).toEqual({
      [MEMORY_METRIC_NAMES.processRss]: 123 * MIB,
      [MEMORY_METRIC_NAMES.containerUsage]: 200 * MIB,
      [MEMORY_METRIC_NAMES.containerWorkingSet]: 170 * MIB,
      [MEMORY_METRIC_NAMES.containerLimit]: 1536 * MIB,
      [MEMORY_METRIC_NAMES.containerSwap]: 8 * MIB,
    });
  });

  it("reports no limit for memory.max `max` and no swap without the swap file", async () => {
    await writeCgroup({ "memory.current": "4096", "memory.max": "max\n", "memory.stat": STAT });
    registerMemoryMetrics({ meter: provider.getMeter("test"), cgroupDir, readRss: () => 1 });

    const values = await collectGauges();

    expect(values.has(MEMORY_METRIC_NAMES.containerLimit)).toBe(false);
    expect(values.has(MEMORY_METRIC_NAMES.containerSwap)).toBe(false);
    // The inactive cache exceeds a tiny usage: the working set floors at zero.
    expect(values.get(MEMORY_METRIC_NAMES.containerWorkingSet)).toBe(0);
    expect(values.get(MEMORY_METRIC_NAMES.containerUsage)).toBe(4096);
  });

  it("reports only the process outside a cgroup v2 container", async () => {
    registerMemoryMetrics({ meter: provider.getMeter("test"), cgroupDir: join(cgroupDir, "missing") });

    const values = await collectGauges();

    expect([...values.keys()]).toEqual([MEMORY_METRIC_NAMES.processRss]);
    expect(values.get(MEMORY_METRIC_NAMES.processRss)).toBeGreaterThan(0);
  });

  it("stops reporting once removed", async () => {
    const stop = registerMemoryMetrics({ meter: provider.getMeter("test"), cgroupDir, readRss: () => 7 });
    stop();

    const values = await collectGauges();

    expect(values.size).toBe(0);
  });
});

describe("readCgroupMemory", () => {
  it("is null when memory.current is not a number", async () => {
    await writeCgroup({ "memory.current": "garbage" });

    expect(await readCgroupMemory(cgroupDir)).toBeNull();
  });

  it("has no working set when memory.stat lacks inactive_file or is missing", async () => {
    await writeCgroup({ "memory.current": "100", "memory.stat": "anon 50\n" });
    expect(await readCgroupMemory(cgroupDir)).toEqual({ usage: 100, workingSet: null, limit: null, swap: null });

    await rm(join(cgroupDir, "memory.stat"));
    expect(await readCgroupMemory(cgroupDir)).toEqual({ usage: 100, workingSet: null, limit: null, swap: null });
  });

  it("ignores an inactive_file line without a value", async () => {
    await writeCgroup({ "memory.current": "100", "memory.stat": "inactive_file\n" });

    expect(await readCgroupMemory(cgroupDir)).toEqual({ usage: 100, workingSet: null, limit: null, swap: null });
  });
});
