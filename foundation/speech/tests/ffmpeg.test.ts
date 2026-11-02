import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFfmpegNormalizer, type CommandRunner } from "../src/index.js";
import { planChunks } from "../src/ffmpeg.js";

const BYTES_PER_SECOND = 32_000;
const options = { maxDurationSeconds: 60, chunkSeconds: 10, overlapSeconds: 2 };

let tempDir: string;
beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "speech-test-"));
});
afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

/** A runner that plays ffmpeg: writes `outputBytes` bytes to the output file (the last argument) and records calls. */
function fakeRunner(decodedBytes: number, exitCode = 0): { run: CommandRunner; calls: string[][] } {
  const calls: string[][] = [];
  const run: CommandRunner = (command, args) => {
    calls.push([command, ...args]);
    const output = String(args.at(-1)).replace(/^file:/, "");
    const isEncode = output.endsWith(".flac");
    if (exitCode === 0) writeFileSync(output, isEncode ? Buffer.from("fLaC") : Buffer.alloc(decodedBytes));
    return Promise.resolve({ exitCode });
  };
  return { run, calls };
}

describe("planChunks", () => {
  it("returns one chunk for audio no longer than a chunk", () => {
    expect(planChunks(10, options)).toEqual([{ start: 0, end: 10 }]);
    expect(planChunks(0.5, options)).toEqual([{ start: 0, end: 0.5 }]);
  });

  it("overlaps chunks by overlapSeconds and ends the last one at the end of the audio", () => {
    expect(planChunks(25, options)).toEqual([
      { start: 0, end: 10 },
      { start: 8, end: 18 },
      { start: 16, end: 25 },
    ]);
  });

  it("refuses an overlap as long as the chunk", () => {
    expect(() => planChunks(25, { chunkSeconds: 2, overlapSeconds: 2 })).toThrow(RangeError);
  });
});

describe("createFfmpegNormalizer with a runner", () => {
  it("decodes a file to mono 16 kHz PCM through file: paths, capped just past the length limit", async () => {
    const { run, calls } = fakeRunner(5 * BYTES_PER_SECOND);
    const normalizer = createFfmpegNormalizer({ ffmpegPath: "/opt/ffmpeg", tempDir, run });

    const result = await normalizer.normalize({ kind: "file", path: "/media/clip.mp4" }, options);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.durationSeconds).toBe(5);
    expect(result.value.chunks.map(({ start, end }) => ({ start, end }))).toEqual([{ start: 0, end: 5 }]);
    const [command, ...args] = calls[0] ?? [];
    expect(command).toBe("/opt/ffmpeg");
    expect(args).toEqual(expect.arrayContaining(["-i", "file:/media/clip.mp4", "-t", "61", "-vn", "-ac", "1", "-ar", "16000"]));
    await result.value.dispose();
    expect(readdirSync(tempDir)).toEqual([]);
  });

  it("encodes each chunk as FLAC on read, from exactly its samples", async () => {
    const { run, calls } = fakeRunner(25 * BYTES_PER_SECOND);
    const normalizer = createFfmpegNormalizer({ tempDir, run });

    const result = await normalizer.normalize({ kind: "bytes", bytes: new Uint8Array([1]), fileName: "note.ogg" }, options);
    if (!result.ok) throw new Error(result.error);
    const file = await result.value.chunks[1]!.read(); // the plan above has three chunks

    expect(file).toEqual({ bytes: new Uint8Array(Buffer.from("fLaC")), fileName: "chunk-1.flac", mimeType: "audio/flac" });
    expect(calls[0]).toEqual(expect.arrayContaining([expect.stringMatching(/^file:.+\/input\.ogg$/)]));
    expect(calls[1]).toEqual(expect.arrayContaining(["-f", "s16le", "-c:a", "flac"]));
    await result.value.dispose();
    expect(readdirSync(tempDir)).toEqual([]);
  });

  it("returns speech.unsupported_format when ffmpeg fails or decodes nothing, and leaves no files", async () => {
    const failing = createFfmpegNormalizer({ tempDir, run: fakeRunner(0, 1).run });
    const silent = createFfmpegNormalizer({ tempDir, run: fakeRunner(0).run });

    expect(await failing.normalize({ kind: "file", path: "x.txt" }, options)).toEqual({ ok: false, error: "speech.unsupported_format" });
    expect(await silent.normalize({ kind: "file", path: "x.mp4" }, options)).toEqual({ ok: false, error: "speech.unsupported_format" });
    expect(readdirSync(tempDir)).toEqual([]);
  });

  it("returns speech.too_long past maxDurationSeconds, and leaves no files", async () => {
    const normalizer = createFfmpegNormalizer({ tempDir, run: fakeRunner(61 * BYTES_PER_SECOND).run });

    expect(await normalizer.normalize({ kind: "file", path: "long.mp3" }, options)).toEqual({ ok: false, error: "speech.too_long" });
    expect(readdirSync(tempDir)).toEqual([]);
  });

  it("throws naming the path when the ffmpeg binary is missing, and leaves no files", async () => {
    const normalizer = createFfmpegNormalizer({ ffmpegPath: join(tempDir, "no-ffmpeg"), tempDir: join(tempDir, "work") });
    execFileSync("mkdir", [join(tempDir, "work")]);

    await expect(normalizer.normalize({ kind: "file", path: "a.mp3" }, options)).rejects.toThrow(
      `ffmpeg was not found at "${join(tempDir, "no-ffmpeg")}"`,
    );
    expect(readdirSync(join(tempDir, "work"))).toEqual([]);
  });
});

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasFfmpeg)("createFfmpegNormalizer with the real ffmpeg", () => {
  it("turns a stereo 44.1 kHz video's sound into chunked mono 16 kHz FLAC of the same length", async () => {
    const video = join(tempDir, "clip.mp4");
    execFileSync("ffmpeg", [
      ...["-hide_banner", "-loglevel", "error", "-y"],
      ...["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=25"],
      ...["-f", "lavfi", "-i", "color=c=black:s=64x64:d=25"],
      ...["-ac", "2", "-shortest", video],
    ]);
    const normalizer = createFfmpegNormalizer({ tempDir });

    const result = await normalizer.normalize({ kind: "file", path: video }, options);
    if (!result.ok) throw new Error(result.error);
    const files = await Promise.all(result.value.chunks.map((chunk) => chunk.read()));

    expect(result.value.durationSeconds).toBeCloseTo(25, 1);
    expect(result.value.chunks).toHaveLength(3);
    for (const file of files) expect(Buffer.from(file.bytes.subarray(0, 4)).toString()).toBe("fLaC");
    // Decoded back without telling ffmpeg the format: a FLAC file of exactly 10 s of mono 16 kHz samples.
    const probe = join(tempDir, "probe.flac");
    writeFileSync(probe, files[0]!.bytes);
    const samples = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", probe, "-f", "s16le", "-"]);
    expect(samples.byteLength).toBe(10 * BYTES_PER_SECOND);
    await result.value.dispose();
    expect(readdirSync(tempDir).sort()).toEqual(["clip.mp4", "probe.flac"]);
  });

  it("returns speech.unsupported_format for a file that is not media", async () => {
    const text = join(tempDir, "notes.txt");
    writeFileSync(text, "not audio at all");

    expect(await createFfmpegNormalizer({ tempDir }).normalize({ kind: "file", path: text }, options)).toEqual({
      ok: false,
      error: "speech.unsupported_format",
    });
  });
});
