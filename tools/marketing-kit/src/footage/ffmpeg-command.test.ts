import { describe, expect, it } from "vitest";

import { findFfmpegInputs, formatFfmpegCommand, quoteShellArgument, splitFilterGraph } from "./ffmpeg-command.js";

describe("findFfmpegInputs", () => {
  it("resolves every file input against the folder and keeps a lavfi source as it is", () => {
    const args = ["-progress", "pipe:1", "-i", "clip.mp4", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-i", "/music/song.mp3", "-filter_complex", "[0:v]null[v]", "out.mp4"];
    expect(findFfmpegInputs(args, "/build/draft")).toEqual(["/build/draft/clip.mp4", "anullsrc=r=48000:cl=stereo", "/music/song.mp3"]);
  });

  it("is empty for a command without inputs", () => {
    expect(findFfmpegInputs(["-version"], "/build")).toEqual([]);
  });
});

describe("quoteShellArgument", () => {
  it("leaves a plain argument as it is and single-quotes every other, a quote inside included", () => {
    expect(quoteShellArgument("-filter_complex")).toBe("-filter_complex");
    expect(quoteShellArgument("/build/clip.mp4")).toBe("/build/clip.mp4");
    expect(quoteShellArgument("[0:v]scale=64:64[v]")).toBe("'[0:v]scale=64:64[v]'");
    expect(quoteShellArgument("it's")).toBe(`'it'"'"'s'`);
    expect(quoteShellArgument("")).toBe("''");
  });
});

describe("formatFfmpegCommand", () => {
  it("writes the command as one shell line", () => {
    expect(formatFfmpegCommand(["-i", "my clip.mp4", "-vf", "fps=30", "out.mp4"])).toBe("ffmpeg -i 'my clip.mp4' -vf fps=30 out.mp4");
  });
});

describe("splitFilterGraph", () => {
  it("splits at each top-level semicolon", () => {
    expect(splitFilterGraph("[0:v]scale=64:64[a];[a]fps=30[b];[1:a]anull[c]")).toEqual(["[0:v]scale=64:64[a]", "[a]fps=30[b]", "[1:a]anull[c]"]);
  });

  it("keeps an escaped semicolon and one inside single quotes in its chain", () => {
    const graph = "[0:v]drawtext=text='a;b'[a];[a]subtitles=x\\;y.ass[b]";
    expect(splitFilterGraph(graph)).toEqual(["[0:v]drawtext=text='a;b'[a]", "[a]subtitles=x\\;y.ass[b]"]);
    expect(splitFilterGraph(graph).join(";")).toBe(graph);
  });

  it("reads a backslash inside single quotes as a plain character", () => {
    expect(splitFilterGraph("[0:v]drawtext=text='a\\'[a];[a]null[b]")).toEqual(["[0:v]drawtext=text='a\\'[a]", "[a]null[b]"]);
  });

  it("answers one chain for a graph without a semicolon", () => {
    expect(splitFilterGraph("[0:v]null[v]")).toEqual(["[0:v]null[v]"]);
  });
});
