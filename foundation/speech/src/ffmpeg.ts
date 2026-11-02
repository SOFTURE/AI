// Input normalization through ffmpeg: any audio or video → raw PCM, mono, 16 kHz (exact duration from its size), then
// FLAC chunks cut from it one at a time, so a long input never sits in memory.
import { spawn } from "node:child_process";
import { mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { err, ok, type Err, type Ok } from "@softure-ai/core";

const SAMPLE_RATE = 16_000;
const BYTES_PER_SAMPLE = 2;
const SAFE_EXTENSION = /^\.[A-Za-z0-9]{1,8}$/;
const QUIET_ARGS = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y"] as const;
const PCM_FORMAT_ARGS = ["-f", "s16le", "-ar", String(SAMPLE_RATE), "-ac", "1"] as const;

/** What to transcribe: a file on disk, or bytes the app already holds (an upload, a download). */
export type AudioInput =
  | { readonly kind: "file"; readonly path: string }
  /** `fileName`'s extension helps ffmpeg tell some formats apart. */
  | { readonly kind: "bytes"; readonly bytes: Uint8Array; readonly fileName?: string };

export interface NormalizeOptions {
  /** A longer input is `speech.too_long`; ffmpeg stops decoding just past this. */
  readonly maxDurationSeconds: number;
  readonly chunkSeconds: number;
  /** How much neighbouring chunks share. */
  readonly overlapSeconds: number;
}

/** One file ready for a provider. */
export interface AudioFile {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly mimeType: string;
}

/** One chunk of the normalized audio; `read()` encodes it when it is needed. */
export interface AudioChunk {
  /** Where the chunk starts and ends in the input, in seconds. */
  readonly start: number;
  readonly end: number;
  read(): Promise<AudioFile>;
}

export interface NormalizedAudio {
  readonly durationSeconds: number;
  readonly chunks: readonly AudioChunk[];
  /** Removes the temporary files; call it on every path. */
  dispose(): Promise<void>;
}

export interface AudioNormalizer {
  normalize(
    input: AudioInput,
    options: NormalizeOptions,
  ): Promise<Ok<NormalizedAudio> | Err<"speech.unsupported_format" | "speech.too_long">>;
}

/** Runs a program with arguments (never through a shell) and resolves with its exit code. */
export type CommandRunner = (command: string, args: readonly string[]) => Promise<{ readonly exitCode: number }>;

export interface FfmpegNormalizerOptions {
  /** Default: `FFMPEG_PATH` from the environment, else `ffmpeg` on `PATH`. A missing binary throws on first use. */
  readonly ffmpegPath?: string;
  /** Where the private temporary folder of each call is made. Default: the system's temp folder. */
  readonly tempDir?: string;
  /** Replaces process spawning; tests pass a fake. */
  readonly run?: CommandRunner;
}

/** The default normalizer: ffmpeg decodes anything it can read into mono 16 kHz audio, chunked as FLAC. */
export function createFfmpegNormalizer(options: FfmpegNormalizerOptions = {}): AudioNormalizer {
  const ffmpeg = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? "ffmpeg";
  const run = options.run ?? runCommand;

  async function normalize(
    input: AudioInput,
    normalizeOptions: NormalizeOptions,
  ): Promise<Ok<NormalizedAudio> | Err<"speech.unsupported_format" | "speech.too_long">> {
    const dir = await mkdtemp(join(options.tempDir ?? tmpdir(), "softure-speech-"));
    const dispose = () => rm(dir, { recursive: true, force: true });
    try {
      const inputPath = await getInputPath(input, dir);
      const pcmPath = join(dir, "audio.pcm");
      // `file:` keeps ffmpeg from reading the path as a URL or another protocol.
      const decoded = await run(ffmpeg, [
        ...QUIET_ARGS,
        "-i",
        `file:${inputPath}`,
        "-t",
        String(normalizeOptions.maxDurationSeconds + 1),
        "-vn",
        "-acodec",
        "pcm_s16le",
        ...PCM_FORMAT_ARGS,
        `file:${pcmPath}`,
      ]);
      const size = decoded.exitCode === 0 ? await getSize(pcmPath) : 0;
      if (size < BYTES_PER_SAMPLE) {
        await dispose();
        return err("speech.unsupported_format");
      }
      const durationSeconds = Math.floor(size / BYTES_PER_SAMPLE) / SAMPLE_RATE;
      if (durationSeconds > normalizeOptions.maxDurationSeconds) {
        await dispose();
        return err("speech.too_long");
      }
      const chunks = planChunks(durationSeconds, normalizeOptions).map((span, index) => ({
        ...span,
        read: () => encodeChunk({ ffmpeg, run, dir, pcmPath, index, ...span }),
      }));
      return ok({ durationSeconds, chunks, dispose });
    } catch (error) {
      await dispose();
      throw error;
    }
  }

  return { normalize };
}

/** Chunk spans covering `[0, duration]`: `chunkSeconds` long, each starting `chunkSeconds - overlapSeconds` later. */
export function planChunks(
  durationSeconds: number,
  options: Pick<NormalizeOptions, "chunkSeconds" | "overlapSeconds">,
): { readonly start: number; readonly end: number }[] {
  const step = options.chunkSeconds - options.overlapSeconds;
  if (!(step > 0)) throw new RangeError("planChunks: chunkSeconds must be longer than overlapSeconds");
  const spans: { start: number; end: number }[] = [];
  for (let start = 0; ; start += step) {
    const end = Math.min(start + options.chunkSeconds, durationSeconds);
    spans.push({ start, end });
    if (end >= durationSeconds) return spans;
  }
}

async function getInputPath(input: AudioInput, dir: string): Promise<string> {
  if (input.kind === "file") return resolve(input.path);
  const extension = extname(input.fileName ?? "");
  const path = join(dir, `input${SAFE_EXTENSION.test(extension) ? extension : ""}`);
  await writeFile(path, input.bytes);
  return path;
}

async function getSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    // ffmpeg exited 0 without writing (no audio stream): the same as nothing decoded.
    return 0;
  }
}

/** Cuts the chunk's samples out of the PCM file exactly and encodes them as FLAC. */
async function encodeChunk(chunk: {
  readonly ffmpeg: string;
  readonly run: CommandRunner;
  readonly dir: string;
  readonly pcmPath: string;
  readonly index: number;
  readonly start: number;
  readonly end: number;
}): Promise<AudioFile> {
  const offset = Math.round(chunk.start * SAMPLE_RATE) * BYTES_PER_SAMPLE;
  const length = Math.round((chunk.end - chunk.start) * SAMPLE_RATE) * BYTES_PER_SAMPLE;
  const slicePath = join(chunk.dir, `chunk-${String(chunk.index)}.pcm`);
  const flacPath = join(chunk.dir, `chunk-${String(chunk.index)}.flac`);
  const samples = Buffer.alloc(length);
  const handle = await open(chunk.pcmPath, "r");
  try {
    await handle.read(samples, 0, length, offset);
  } finally {
    await handle.close();
  }
  await writeFile(slicePath, samples);
  try {
    const encoded = await chunk.run(chunk.ffmpeg, [
      ...QUIET_ARGS,
      ...PCM_FORMAT_ARGS,
      "-i",
      `file:${slicePath}`,
      "-c:a",
      "flac",
      `file:${flacPath}`,
    ]);
    // ffmpeg wrote the PCM file itself a moment ago; failing to encode it back is a broken installation, not input.
    if (encoded.exitCode !== 0) throw new Error(`ffmpeg could not encode chunk ${String(chunk.index)} as FLAC`);
    return { bytes: new Uint8Array(await readFile(flacPath)), fileName: `chunk-${String(chunk.index)}.flac`, mimeType: "audio/flac" };
  } finally {
    await rm(slicePath, { force: true });
    await rm(flacPath, { force: true });
  }
}

/** Spawns `command` without a shell; its output is discarded (it can quote paths). */
function runCommand(command: string, args: readonly string[]): Promise<{ readonly exitCode: number }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error(`ffmpeg was not found at "${command}": install it in the image or set ffmpegPath / FFMPEG_PATH`));
        return;
      }
      reject(error);
    });
    child.once("close", (code) => resolvePromise({ exitCode: code ?? 1 }));
  });
}
