import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findLastRecordingTime, waitForPace } from "./pace.js";

const NOW = Date.parse("2026-10-06T18:00:00Z");

let cacheDir: string;
let lines: string[];
let slept: number[];
const log = (line: string) => lines.push(line);
const sleep = (milliseconds: number) => {
  slept.push(milliseconds);
  return Promise.resolve();
};

/** A recording's words file, written `secondsAgo` before NOW. */
function writeRecording(relative: string, secondsAgo: number): void {
  const path = join(cacheDir, relative);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "[]\n");
  const time = (NOW - secondsAgo * 1000) / 1000;
  utimesSync(path, time, time);
}

beforeEach(() => {
  cacheDir = join(mkdtempSync(join(tmpdir(), "pace-")), "voiceover");
  lines = [];
  slept = [];
});

afterEach(() => {
  rmSync(join(cacheDir, ".."), { recursive: true, force: true });
});

describe("findLastRecordingTime", () => {
  it("is null for a missing or empty cache", () => {
    expect(findLastRecordingTime(cacheDir)).toBeNull();
    mkdirSync(cacheDir);
    expect(findLastRecordingTime(cacheDir)).toBeNull();
  });

  it("takes the newest words file at the root and in the video folders, ignoring audio files", () => {
    writeRecording("aaaa.json", 300);
    writeRecording("ania/bbbb.json", 40);
    writeRecording("ola/cccc.json", 90);
    writeRecording("ola/dddd.mp3", 1);
    expect(findLastRecordingTime(cacheDir)).toBe(NOW - 40_000);
  });
});

describe("waitForPace", () => {
  it("waits the rest of the interval after a recording 40 s old", async () => {
    writeRecording("ania/bbbb.json", 40);
    const waited = await waitForPace({ cacheDir, minIntervalSeconds: 60, now: () => NOW, sleep, log });
    expect(waited).toBe(20);
    expect(slept).toEqual([20_000]);
    expect(lines).toEqual([`voiceover: the last paid recording in ${cacheDir} is under 60 s old (voice.minIntervalSeconds); waiting 20 s before the next call.`]);
  });

  it.each([
    ["the interval has passed", 60, 60],
    ["the recording is older than the interval", 61, 60],
    ["pacing is off", 1, 0],
  ])("does not wait when %s", async (_label, secondsAgo, minIntervalSeconds) => {
    writeRecording("ania/bbbb.json", secondsAgo);
    expect(await waitForPace({ cacheDir, minIntervalSeconds, now: () => NOW, sleep, log })).toBe(0);
    expect(slept).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("does not wait for an empty cache", async () => {
    expect(await waitForPace({ cacheDir, minIntervalSeconds: 60, now: () => NOW, sleep, log })).toBe(0);
    expect(slept).toEqual([]);
  });

  it("rounds a partial second up, so the call never comes early", async () => {
    writeRecording("ania/bbbb.json", 59.5);
    expect(await waitForPace({ cacheDir, minIntervalSeconds: 60, now: () => NOW, sleep, log })).toBe(1);
  });
});
