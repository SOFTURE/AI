import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Edl } from "./edl.js";
import { DEFAULT_EDIT } from "./film.js";
import { buildCutPreviewArgs, buildLastFrameArgs, buildMusicArgs, buildSpeechArgs, getSpeechCutOptions } from "./render.js";

const edl: Edl = {
  version: 2,
  film: "film",
  segments: [
    { id: "g1", clip: "talk", start: 0.5, end: 2, transition: "cut", motion: "none" },
    { id: "g2", clip: "street", start: 0, end: 3, transition: "fade", motion: "kenburns" },
  ],
};

describe("buildSpeechArgs", () => {
  it("cuts each segment from its clip's audio with short fades and joins them in order", () => {
    const args = buildSpeechArgs(edl, { talk: "/clean/talk.mp3", street: "clips/street.mp4" }, "/out/speech.mp3");
    expect(args.slice(3, 7)).toEqual(["-i", "/clean/talk.mp3", "-i", "clips/street.mp4"]);
    const graph = args[args.indexOf("-filter_complex") + 1] ?? "";
    expect(graph).toContain("[0:a]atrim=start=0.5:end=2,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=1.5,afade=t=in:d=0.02,afade=t=out:st=1.48:d=0.02[a0]");
    expect(graph.endsWith("[a0][a1]concat=n=2:v=0:a=1[speech]")).toBe(true);
    expect(args.at(-1)).toBe("/out/speech.mp3");
  });

  it("refuses a segment of a clip without audio", () => {
    expect(() => buildSpeechArgs(edl, { talk: "/a.mp3" }, "/out.mp3")).toThrow('No audio for clip "street" of the EDL.');
  });
});

describe("buildSpeechArgs at the cuts", () => {
  const three: Edl = {
    version: 2,
    film: "film",
    segments: [
      { id: "s1", clip: "talk", start: 0.5, end: 2, transition: "cut", motion: "none" },
      { id: "s2", clip: "talk", start: 2.5, end: 3.5, transition: "cut", motion: "none" },
      { id: "s3", clip: "talk", start: 0.01, end: 1, transition: "cut", motion: "none" },
    ],
  };
  const graphOf = (args: string[]): string => args[args.indexOf("-filter_complex") + 1] ?? "";

  it("keeps the 20 ms dip of every cut by default", () => {
    expect(getSpeechCutOptions(DEFAULT_EDIT)).toEqual({ fadeSeconds: 0.02, isCrossfade: false });
    expect(graphOf(buildSpeechArgs(three, { talk: "/a.mp3" }, "/o.mp3"))).toBe(graphOf(buildSpeechArgs(three, { talk: "/a.mp3" }, "/o.mp3", getSpeechCutOptions(DEFAULT_EDIT))));
  });

  it("fades every cut over the film's cutAudioFadeMs", () => {
    const graph = graphOf(buildSpeechArgs(three, { talk: "/a.mp3" }, "/o.mp3", getSpeechCutOptions({ cutAudioFadeMs: 40, isCutAudioCrossfade: false })));
    expect(graph.match(/afade=t=in:d=0\.04,/g)).toHaveLength(3);
    expect(graph).toContain("apad=whole_dur=1.5,afade=t=in:d=0.04,afade=t=out:st=1.46:d=0.04[a0]");
    expect(graph).toContain("apad=whole_dur=1,afade=t=in:d=0.04,afade=t=out:st=0.96:d=0.04[a1]");
    expect(graph).not.toContain("d=0.02");
  });

  it("cross-fades every cut, each side running on half the fade into its source, silence where the source starts too late", () => {
    const graph = graphOf(buildSpeechArgs(three, { talk: "/a.mp3" }, "/o.mp3", { fadeSeconds: 0.04, isCrossfade: true }));
    expect(graph).toContain("[0:a]atrim=start=0.5:end=2.02,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=1.52,atrim=end=1.52[a0]");
    expect(graph).toContain("[1:a]atrim=start=2.48:end=3.52,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=1.04,atrim=end=1.04[a1]");
    expect(graph).toContain("[2:a]atrim=start=0:end=1,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,adelay=10:all=1,apad=whole_dur=1.01,atrim=end=1.01[a2]");
    expect(graph).toContain("[a0][a1]acrossfade=d=0.04:c1=tri:c2=tri[x1];[x1][a2]acrossfade=d=0.04:c1=tri:c2=tri[x2]");
    expect(graph.endsWith("[x2]afade=t=in:d=0.04,afade=t=out:st=3.45:d=0.04[speech]")).toBe(true);
  });

  it("refuses a fade of 0 seconds", () => {
    expect(() => buildSpeechArgs(three, { talk: "/a.mp3" }, "/o.mp3", { fadeSeconds: 0 })).toThrow("The speech track's cut fade must be above 0 seconds, got 0.");
  });

  it("writes a cross-faded track exactly as long as the cut with real ffmpeg", () => {
    const dir = mkdtempSync(join(tmpdir(), "footage-speech-"));
    try {
      const source = join(dir, "talk.wav");
      const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=220:d=4:sample_rate=48000", source]);
      expect(made.status).toBe(0);
      const borrowed: Edl = { ...three, segments: [...three.segments, { id: "r1", clip: "talk", start: 0, end: 0.5, transition: "cut", motion: "none", audio: { clip: "talk", start: 3.5, end: 4, ownVolume: 0.3 } }] };
      const output = join(dir, "speech.mp3");
      const run = spawnSync("ffmpeg", buildSpeechArgs(borrowed, { talk: source }, output, { fadeSeconds: 0.04, isCrossfade: true }), { encoding: "utf8" });
      expect(run.stderr).toBe("");
      const probed = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", output], { encoding: "utf8" });
      // 1.5 + 1 + 0.99 + 0.5 s; MP3 frames round it up by a few milliseconds at most.
      expect(Math.abs(Number(probed.stdout) - 3.99)).toBeLessThan(0.06);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("buildSpeechArgs with borrowed sound", () => {
  it("cuts the sound from the other clip's span and mixes the picture clip's own sound under it", () => {
    const cut: Edl = {
      version: 2,
      film: "film",
      segments: [
        { id: "s1", clip: "talk", start: 0.5, end: 2, transition: "cut", motion: "none" },
        { id: "r1", clip: "street", start: 0, end: 2, transition: "cut", motion: "none", audio: { clip: "talk", start: 3, end: 5, ownVolume: 0.2 } },
      ],
    };
    const args = buildSpeechArgs(cut, { talk: "/a/talk.mp3", street: "clips/street.mp4" }, "/out/speech.mp3");
    expect(args.slice(3, 9)).toEqual(["-i", "/a/talk.mp3", "-i", "/a/talk.mp3", "-i", "clips/street.mp4"]);
    const graph = args[args.indexOf("-filter_complex") + 1] ?? "";
    expect(graph).toContain("[1:a]atrim=start=3:end=5,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=2,atrim=end=2[s1]");
    expect(graph).toContain("[2:a]atrim=start=0:end=2,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=2,atrim=end=2,volume=0.2[o1]");
    expect(graph).toContain("[s1][o1]amix=inputs=2:duration=first:normalize=0,afade=t=in:d=0.02,afade=t=out:st=1.98:d=0.02[a1]");
  });
});

describe("buildMusicArgs", () => {
  it("loops the music to the film's length, ducks it and fades it in and out", () => {
    const args = buildMusicArgs({ input: "/music.mp3", seconds: 12, keyframes: [{ t: 0, volume: 0.35 }], output: "/out/music.mp3" });
    expect(args.slice(3, 9)).toEqual(["-stream_loop", "-1", "-i", "/music.mp3", "-t", "12"]);
    expect(args[args.indexOf("-af") + 1]).toBe(
      "aformat=sample_rates=48000:channel_layouts=stereo,volume=eval=frame:volume='lt(t,0)*0.35+gte(t,0)*0.35',afade=t=in:d=1,afade=t=out:st=10.5:d=1.5",
    );
  });
});

describe("buildCutPreviewArgs and buildLastFrameArgs", () => {
  it("joins the segments' pictures small and silent", () => {
    const args = buildCutPreviewArgs(edl, { talk: "clips/talk.mp4", street: "clips/street.mp4" }, "/cut.mp4");
    expect(args[args.indexOf("-filter_complex") + 1]).toBe(
      "[0:v]setpts=PTS-STARTPTS,scale=540:-2,setsar=1[v0];[1:v]setpts=PTS-STARTPTS,scale=540:-2,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[cut]",
    );
  });

  it("seeks each segment's input instead of decoding its clip from the start", () => {
    const args = buildCutPreviewArgs(edl, { talk: "clips/talk.mp4", street: "clips/street.mp4" }, "/cut.mp4");
    expect(args.slice(3, args.indexOf("-filter_complex"))).toEqual(["-ss", "0.5", "-t", "1.5", "-i", "clips/talk.mp4", "-ss", "0", "-t", "3", "-i", "clips/street.mp4"]);
    expect(args[args.indexOf("-filter_complex") + 1]).not.toContain("trim");
  });

  it("takes the frame just before the last segment ends", () => {
    expect(buildLastFrameArgs(edl, { street: "clips/street.mp4" }, "/last.jpg")).toEqual(["-v", "error", "-y", "-ss", "2.93", "-i", "clips/street.mp4", "-frames:v", "1", "-q:v", "2", "/last.jpg"]);
  });
});
