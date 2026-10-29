import { describe, expect, it } from "vitest";

import type { Edl } from "./edl.js";
import { buildCutPreviewArgs, buildLastFrameArgs, buildMusicArgs, buildSpeechArgs } from "./render.js";

const edl: Edl = {
  version: 1,
  film: "film",
  segments: [
    { clip: "talk", start: 0.5, end: 2, transition: "cut", motion: "none" },
    { clip: "street", start: 0, end: 3, transition: "fade", motion: "kenburns" },
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
      "[0:v]trim=start=0.5:end=2,setpts=PTS-STARTPTS,scale=540:-2,setsar=1[v0];[1:v]trim=start=0:end=3,setpts=PTS-STARTPTS,scale=540:-2,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[cut]",
    );
  });

  it("takes the frame just before the last segment ends", () => {
    expect(buildLastFrameArgs(edl, { street: "clips/street.mp4" }, "/last.jpg")).toEqual(["-v", "error", "-y", "-ss", "2.93", "-i", "clips/street.mp4", "-frames:v", "1", "-q:v", "2", "/last.jpg"]);
  });
});
