import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { MUSIC_FILE_TYPES, checkMusicFileType, describeAudioProbe, probeAudio, readAudioProbe } from "./audio.js";

function ffprobe(streams: Record<string, unknown>[], format: Record<string, unknown> = { duration: "94.32", bit_rate: "192300" }) {
  return { streams, format };
}

const STEREO_MP3 = { codec_type: "audio", codec_name: "mp3", sample_rate: "44100", channels: 2, bit_rate: "192000", duration: "94.320000" };

describe("readAudioProbe", () => {
  it("reads a stereo mp3", () => {
    expect(readAudioProbe(ffprobe([STEREO_MP3]))).toEqual({
      ok: true,
      probe: { duration: 94.32, codec: "mp3", sampleRate: 44100, channels: 2, bitRate: 192000 },
    });
  });

  it("ignores the cover art an mp3 carries as a video stream", () => {
    const result = readAudioProbe(ffprobe([{ codec_type: "video", codec_name: "mjpeg", width: 600, height: 600 }, STEREO_MP3]));
    expect(result.ok && result.probe.codec).toBe("mp3");
  });

  it("fails with no-audio-stream for a file with video only", () => {
    expect(readAudioProbe(ffprobe([{ codec_type: "video", codec_name: "h264", width: 1920, height: 1080 }]))).toEqual({ ok: false, reason: "no-audio-stream", error: "no audio stream" });
  });

  it("falls back to the stream's duration and bit rate to the format's", () => {
    const result = readAudioProbe(ffprobe([{ ...STEREO_MP3, bit_rate: undefined, duration: "12.5" }], { bit_rate: "128000" }));
    expect(result.ok && [result.probe.duration, result.probe.bitRate]).toEqual([12.5, 128000]);
  });

  it("answers a null bit rate when neither the stream nor the format reports one", () => {
    const result = readAudioProbe(ffprobe([{ codec_type: "audio", codec_name: "opus", sample_rate: "48000", channels: 1 }], { duration: "30" }));
    expect(result).toEqual({ ok: true, probe: { duration: 30, codec: "opus", sampleRate: 48000, channels: 1, bitRate: null } });
  });

  it.each([[{}], [{ duration: "0" }], [{ duration: "N/A" }]])("fails with no-duration for the format %j", (format) => {
    expect(readAudioProbe(ffprobe([{ ...STEREO_MP3, duration: undefined }], format))).toEqual({ ok: false, reason: "no-duration", error: "no duration" });
  });

  it("fails with unexpected-output for a shape ffprobe never prints", () => {
    expect(readAudioProbe({ streams: "none" })).toEqual({ ok: false, reason: "unexpected-output", error: "ffprobe printed an unexpected shape" });
  });
});

describe("checkMusicFileType", () => {
  it.each(Object.keys(MUSIC_FILE_TYPES))("accepts the extension %s", (extension) => {
    expect(checkMusicFileType({ fileName: `bed${extension}` })).toEqual({ ok: true, extension, contentType: null });
  });

  it("reads the extension of a path in any letter case", () => {
    expect(checkMusicFileType({ fileName: "/music/Calm Bed.MP3" })).toEqual({ ok: true, extension: ".mp3", contentType: null });
  });

  it("accepts a content type alone, ignoring parameters and case", () => {
    expect(checkMusicFileType({ contentType: "Audio/MP4; codecs=mp4a.40.2" })).toEqual({ ok: true, extension: null, contentType: "audio/mp4" });
  });

  it("accepts a name with a content type of its extension", () => {
    expect(checkMusicFileType({ fileName: "bed.wav", contentType: "audio/x-wav" })).toEqual({ ok: true, extension: ".wav", contentType: "audio/x-wav" });
  });

  it("rejects a content type that does not belong to the extension", () => {
    expect(checkMusicFileType({ fileName: "bed.mp3", contentType: "audio/wav" })).toEqual({ ok: false, error: "bed.mp3: content type audio/wav does not match .mp3 (expected audio/mpeg or audio/mp3)" });
  });

  it("accepts a video file whose sound can be the bed, by name and by content type", () => {
    expect(checkMusicFileType({ fileName: "clip.mp4", contentType: "video/mp4" })).toEqual({ ok: true, extension: ".mp4", contentType: "video/mp4" });
    expect(checkMusicFileType({ fileName: "clip.MOV" })).toEqual({ ok: true, extension: ".mov", contentType: null });
    expect(checkMusicFileType({ contentType: "video/quicktime" })).toEqual({ ok: true, extension: null, contentType: "video/quicktime" });
  });

  it("rejects a file type that is neither music nor a video with sound", () => {
    expect(checkMusicFileType({ fileName: "clip.mkv" })).toEqual({ ok: false, error: "clip.mkv: not a music file (accepted: .mp3, .m4a, .aac, .wav, .ogg, .oga, .opus, .flac, .mp4, .m4v, .mov, .webm)" });
    expect(checkMusicFileType({ contentType: "image/png" })).toEqual({ ok: false, error: "content type image/png is not a music file (accepted: .mp3, .m4a, .aac, .wav, .ogg, .oga, .opus, .flac, .mp4, .m4v, .mov, .webm)" });
  });

  it("treats a name without an extension as no name (a storage key)", () => {
    expect(checkMusicFileType({ fileName: "ab/cd/0f5e3a1c-2b9d-4c1e-9a7f-1d2e3f4a5b6c", contentType: "audio/mp4" })).toEqual({ ok: true, extension: null, contentType: "audio/mp4" });
    expect(checkMusicFileType({ fileName: "bed" })).toEqual({ ok: false, error: "a music file needs a file name or a content type to check" });
  });

  it("rejects a prototype key as an extension", () => {
    expect(checkMusicFileType({ fileName: "bed.constructor" }).ok).toBe(false);
  });

  it("needs a name or a content type", () => {
    expect(checkMusicFileType({})).toEqual({ ok: false, error: "a music file needs a file name or a content type to check" });
  });
});

describe("describeAudioProbe", () => {
  it("names the codec, length, rate, channels and bit rate", () => {
    expect(describeAudioProbe({ duration: 94.32, codec: "mp3", sampleRate: 44100, channels: 2, bitRate: 192000 })).toBe("mp3, 94.3 s, 44100 Hz, 2 channels, 192 kb/s");
    expect(describeAudioProbe({ duration: 30, codec: "opus", sampleRate: 48000, channels: 1, bitRate: null })).toBe("opus, 30.0 s, 48000 Hz, mono");
  });
});

const hasFfmpeg = spawnSync("ffprobe", ["-version"]).status === 0 && spawnSync("ffmpeg", ["-version"]).status === 0;

describe.runIf(hasFfmpeg)("probeAudio with ffprobe", () => {
  const dir = mkdtempSync(join(tmpdir(), "marketing-kit-audio-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const make = (name: string, args: string[]): string => {
    const file = join(dir, name);
    const result = spawnSync("ffmpeg", ["-v", "error", "-y", ...args, file], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`ffmpeg could not make ${name}: ${result.stderr}`);
    return file;
  };

  it("reads a generated wav", async () => {
    const file = make("bed.wav", ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2", "-ac", "2"]);
    expect(await probeAudio(file)).toEqual({ ok: true, probe: { duration: 2, codec: "pcm_s16le", sampleRate: 48000, channels: 2, bitRate: 1536000 } });
  });

  it("fails with no-audio-stream for a silent video", async () => {
    const file = make("silent.mp4", ["-f", "lavfi", "-i", "color=c=black:s=64x64:d=1", "-pix_fmt", "yuv420p"]);
    expect(await probeAudio(file)).toEqual({ ok: false, reason: "no-audio-stream", error: `${file}: no audio stream` });
  });

  it("fails with unreadable for a missing file", async () => {
    const result = await probeAudio(join(dir, "missing.mp3"));
    expect(result.ok ? null : result.reason).toBe("unreadable");
  });
});
