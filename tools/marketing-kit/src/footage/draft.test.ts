import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { readCharacterMap } from "../og/character-map.js";
import { getCaptionSpans, getFootageCaptionLayout, phraseChunks } from "./captions.js";
import { getSegmentScales } from "./compose.js";
import {
  FOOTAGE_DRAFT_CAPTION_COLORS,
  FOOTAGE_DRAFT_FONT,
  buildFootageDraftArgs,
  buildFootageDraftCaptions,
  getFootageDraftFrame,
  planFootageDraft,
  renderFootageDraft,
  toAssColor,
  type FootageDraftArgsInput,
} from "./draft.js";
import { getEdlDuration, type Edl } from "./edl.js";
import { formatFfmpegCommand, type FfmpegFailure } from "./ffmpeg-command.js";
import { writeFfmpegFailure } from "./ffmpeg-failure.js";
import { createFakeIsolationProvider, createFakeMusicProvider, createFakeSttProvider } from "./fake.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { getPromptMusicCache } from "./paid.js";
import type { PreparedClip } from "./pipeline.js";
import type { FootageProbe } from "./probe.js";
import { DRAFT_FILTERS, checkFootageTools, readFfmpegListing } from "./tools.js";

const film: FootageFilm = {
  id: "street",
  title: "Street",
  format: "9:16",
  language: "pl",
  clips: [],
  isolateVoice: false,
  cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
  transitions: DEFAULT_TRANSITIONS,
  music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
  captions: true,
  endCard: null,
};

const edl: Edl = {
  version: 2,
  film: "street",
  segments: [
    { id: "g1", clip: "talk", start: 0.5, end: 2.5, transition: "cut", motion: "none" },
    { id: "g2", clip: "talk", start: 3, end: 4, transition: "zoom", motion: "none" },
    { id: "g3", clip: "talk", start: 5, end: 6, transition: "zoom", motion: "none" },
    { id: "g4", clip: "street", start: 0, end: 3, transition: "fade", motion: "kenburns" },
    { id: "g5", clip: "talk", start: 7, end: 8, transition: "whoosh", motion: "none" },
  ],
};

const FRAME = LAYOUTS["9:16"].frame;

function argsInput(changes: Partial<FootageDraftArgsInput> = {}): FootageDraftArgsInput {
  return {
    film,
    edl,
    clips: { talk: "/clips/talk.mp4", street: "/clips/street.mp4" },
    speech: "/draft/speech.mp3",
    frame: FRAME,
    captions: "captions.ass",
    fontsDir: "fonts",
    output: "/out/draft.mp4",
    ...changes,
  };
}

function getGraph(args: string[]): string[] {
  return (args[args.indexOf("-filter_complex") + 1] as string).split(";");
}

describe("getFootageDraftFrame", () => {
  it("scales the film's frame to the width, both sides even", () => {
    expect(getFootageDraftFrame(FRAME)).toEqual({ width: 540, height: 960 });
    expect(getFootageDraftFrame(FRAME, 405)).toEqual({ width: 406, height: 720 });
    expect(getFootageDraftFrame({ width: 1920, height: 1080 }, 640)).toEqual({ width: 640, height: 360 });
  });
});

describe("planFootageDraft", () => {
  it("starts each segment at the cut's start and zooms as the render does", () => {
    const plans = planFootageDraft(film, edl);
    expect(plans.map((plan) => plan.start)).toEqual([0, 2, 3, 4, 7]);
    expect(plans.map((plan) => plan.scale)).toEqual(getSegmentScales(edl));
    expect(plans.map((plan) => plan.scale)).toEqual([1, 1.08, 1, 1, 1]);
  });

  it("runs the segment before a fade on for the fade's length and zooms Ken Burns b-roll by 4 % without a film percent", () => {
    const plans = planFootageDraft(film, edl);
    expect(plans.map((plan) => plan.fade)).toEqual([0, 0, 0, 0.333, 0]);
    expect(plans.map((plan) => plan.length)).toEqual([2, 1, 1, 3, 1]);
    expect(plans.map((plan) => plan.seconds)).toEqual([2, 1, 1.333, 3, 1]);
    expect(plans[3]?.endScale).toBe(1.04);
    expect(plans.filter((_, index) => index !== 3).every((plan) => plan.endScale === plan.scale)).toBe(true);
  });

  it("follows the film's edit settings and never fades longer than the incoming segment", () => {
    const short: Edl = { ...edl, segments: [edl.segments[0], { ...(edl.segments[3] as Edl["segments"][number]), end: 0.25 }] as Edl["segments"] };
    const plans = planFootageDraft({ edit: { fadeFrames: 30, kenBurnsPercent: 2, zoomPercent: 110 } }, short);
    expect(plans.map((plan) => plan.fade)).toEqual([0, 0.25]);
    expect(plans[0]?.seconds).toBe(2.25);
    expect(plans[1]?.endScale).toBe(1.02);
  });
});

describe("buildFootageDraftArgs", () => {
  it("seeks every segment in its own input, as long as it plays", () => {
    const args = buildFootageDraftArgs(argsInput());
    const seeks = args.flatMap((arg, index) => (arg === "-ss" ? [[args[index + 1], args[index + 3], args[index + 5]]] : []));
    expect(seeks).toEqual([
      ["0.5", "2", "/clips/talk.mp4"],
      ["3", "1", "/clips/talk.mp4"],
      ["5", "1.333", "/clips/talk.mp4"],
      ["0", "3", "/clips/street.mp4"],
      ["7", "1", "/clips/talk.mp4"],
    ]);
  });

  it("crops a zoom cut around the render's zoom origin and scales every segment to the draft", () => {
    const graph = getGraph(buildFootageDraftArgs(argsInput()));
    expect(graph[0]).toBe("[0:v]setpts=PTS-STARTPTS,scale=540:960,setsar=1,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=2,trim=duration=2,setpts=PTS-STARTPTS,settb=1/30,fps=30[v0]");
    expect(graph[1]).toContain("[1:v]setpts=PTS-STARTPTS,crop=iw/1.08:ih/1.08:(iw-iw/1.08)*0.5:(ih-ih/1.08)*0.42,scale=540:960,");
    expect(graph[2]).toContain("[2:v]setpts=PTS-STARTPTS,scale=540:960,");
  });

  it("zooms Ken Burns b-roll over its own length with zoompan", () => {
    const graph = getGraph(buildFootageDraftArgs(argsInput()));
    expect(graph[3]).toContain("zoompan=z='1+0.04*min(on/90,1)':x='(iw-iw/zoom)*0.5':y='(ih-ih/zoom)*0.42':d=1:s=540x960:fps=30");
  });

  it("eases a zoom cut over zoomEaseFrames with zoompan, as the render's power1.out", () => {
    const eased = argsInput({ film: { edit: { zoomEaseFrames: 4 } } });
    const plans = planFootageDraft(eased.film, edl);
    expect(plans.map((plan) => [plan.startScale, plan.scale, plan.easeFrames])).toEqual([
      [1, 1, 0],
      [1, 1.08, 4],
      [1.08, 1, 4],
      [1, 1, 0],
      [1, 1, 0],
    ]);
    const graph = getGraph(buildFootageDraftArgs(eased));
    expect(graph[1]).toContain("[1:v]setpts=PTS-STARTPTS,zoompan=z='1+(0.08)*(1-pow(1-min(on/4,1),2))':x='(iw-iw/zoom)*0.5':y='(ih-ih/zoom)*0.42':d=1:s=540x960:fps=30,setsar=1");
    expect(graph[2]).toContain("[2:v]setpts=PTS-STARTPTS,zoompan=z='1.08+(-0.08)*(1-pow(1-min(on/4,1),2))'");
  });

  it("joins a fade with xfade at the segment's start and every other cut with concat", () => {
    const graph = getGraph(buildFootageDraftArgs(argsInput()));
    expect(graph.slice(5, 9)).toEqual([
      "[v0][v1]concat=n=2:v=1:a=0,settb=1/30,fps=30[j1]",
      "[j1][v2]concat=n=2:v=1:a=0,settb=1/30,fps=30[j2]",
      "[j2][v3]xfade=transition=fade:duration=0.333:offset=4[j3]",
      "[j3][v4]concat=n=2:v=1:a=0,settb=1/30,fps=30[j4]",
    ]);
  });

  it("burns the captions in with the font folder, or passes the picture through without captions", () => {
    expect(getGraph(buildFootageDraftArgs(argsInput())).at(-1)).toBe("[j4]ass=filename=captions.ass:fontsdir=fonts[draft]");
    expect(getGraph(buildFootageDraftArgs(argsInput({ captions: null, fontsDir: null }))).at(-1)).toBe("[j4]null[draft]");
  });

  it("muxes the speech track and writes exactly the cut's length as fast-start H.264 and AAC", () => {
    const args = buildFootageDraftArgs(argsInput());
    expect(args.slice(args.indexOf("-map"))).toEqual([
      "-map",
      "[draft]",
      "-map",
      "5:a",
      "-t",
      String(getEdlDuration(edl)),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "28",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "/out/draft.mp4",
    ]);
    expect(args[args.indexOf("/draft/speech.mp3") - 1]).toBe("-i");
  });

  it("mixes the music track under the speech, summed as the render plays them", () => {
    const args = buildFootageDraftArgs(argsInput({ music: "music.mp3" }));
    expect(args.slice(args.indexOf("/draft/speech.mp3") - 1, args.indexOf("/draft/speech.mp3") + 3)).toEqual(["-i", "/draft/speech.mp3", "-i", "music.mp3"]);
    expect(getGraph(args).at(-1)).toBe("[5:a][6:a]amix=inputs=2:duration=first:normalize=0[sound]");
    expect(args.slice(args.indexOf("-map"), args.indexOf("-map") + 4)).toEqual(["-map", "[draft]", "-map", "[sound]"]);
    expect(buildFootageDraftArgs(argsInput({ music: null }))).toEqual(buildFootageDraftArgs(argsInput()));
  });

  it("leaves the thread counts to ffmpeg by default", () => {
    const args = buildFootageDraftArgs(argsInput());
    expect(args).not.toContain("-threads");
    expect(args).not.toContain("-filter_complex_threads");
  });

  it("caps the filter graph, every segment's decoder and the encoder at the given threads", () => {
    const args = buildFootageDraftArgs(argsInput({ threads: 1 }));
    expect(args.slice(3, 5)).toEqual(["-filter_complex_threads", "1"]);
    const threadIndexes = args.flatMap((arg, index) => (arg === "-threads" ? [index] : []));
    expect(threadIndexes.map((index) => args[index + 1])).toEqual(["1", "1", "1", "1", "1", "1"]);
    expect(threadIndexes.slice(0, 5).map((index) => [args[index + 2], args[index + 7]])).toEqual([
      ["-ss", "/clips/talk.mp4"],
      ["-ss", "/clips/talk.mp4"],
      ["-ss", "/clips/talk.mp4"],
      ["-ss", "/clips/street.mp4"],
      ["-ss", "/clips/talk.mp4"],
    ]);
    expect(args[args.indexOf("/draft/speech.mp3") - 3]).not.toBe("-threads");
    const encoderThreads = threadIndexes.at(-1) as number;
    expect(encoderThreads).toBeGreaterThan(args.indexOf("-filter_complex"));
    expect(args.at(-1)).toBe("/out/draft.mp4");
  });

  it("rejects a thread count that is not a positive whole number", () => {
    for (const threads of [0, -1, 1.5, Number.NaN]) {
      expect(() => buildFootageDraftArgs(argsInput({ threads }))).toThrow(`draft.threads must be a positive whole number, got ${threads}.`);
    }
  });

  it("names a clip the EDL needs and has no file for", () => {
    expect(() => buildFootageDraftArgs(argsInput({ clips: { talk: "/clips/talk.mp4" } }))).toThrow('No file for clip "street" of the EDL.');
  });
});

describe("buildFootageDraftCaptions", () => {
  const words = [
    { text: "Hello,", start: 0.1, end: 0.5 },
    { text: "this", start: 0.6, end: 0.8 },
    { text: "is", start: 0.85, end: 1 },
    { text: "{the}", start: 1.05, end: 1.4 },
    { text: "draft.", start: 1.45, end: 1.9 },
  ];
  const caption = getFootageCaptionLayout(film);

  it("shows each phrase for the render's caption span", () => {
    const ass = buildFootageDraftCaptions({ film, edl, words, caption, frame: FRAME }) ?? "";
    const spans = getCaptionSpans(phraseChunks(words), getEdlDuration(edl));
    expect(spans).toEqual([
      { start: 0.05, end: 0.54 },
      { start: 0.55, end: 2.25 },
    ]);
    expect(ass.split("\n").filter((line) => line.startsWith("Dialogue:"))).toEqual([
      "Dialogue: 0,0:00:00.05,0:00:00.54,Caption,,0,0,0,,Hello,",
      "Dialogue: 0,0:00:00.55,0:00:02.25,Caption,,0,0,0,,this is (the) draft.",
    ]);
  });

  it("keeps a word the film's language keeps with the next word across a pause", () => {
    const paused = [
      { text: "Live", start: 0.1, end: 0.4 },
      { text: "w", start: 0.5, end: 0.6 },
      { text: "Lodz.", start: 1.6, end: 2 },
    ];
    const lines = (buildFootageDraftCaptions({ film, edl, words: paused, caption, frame: FRAME }) ?? "").split("\n").filter((line) => line.startsWith("Dialogue:"));
    expect(lines).toEqual(["Dialogue: 0,0:00:00.05,0:00:02.35,Caption,,0,0,0,,Live w Lodz."]);
  });

  it("lays the captions out in the film's frame, in the caption box, with the shipped font", () => {
    const ass = buildFootageDraftCaptions({ film, edl, words, caption: { top: 1470, left: 60, right: 80, fontSize: 50 }, frame: FRAME }) ?? "";
    expect(ass).toContain("PlayResX: 1080\nPlayResY: 1920\n");
    expect(ass).toContain("Style: Caption,DejaVu Sans,50,&H00FFFFFF,&H00FFFFFF,&H8C000000,&H8C000000,-1,0,0,0,100,100,0,0,1,3,2,8,60,80,1470,1\n");
  });

  it("anchors the captions by their foot when the caption box has a bottom edge", () => {
    const ass = buildFootageDraftCaptions({ film, edl, words, caption: { top: 1470, bottom: 400, left: 60, right: 80, fontSize: 50 }, frame: FRAME }) ?? "";
    expect(ass).toContain(",1,3,2,2,60,80,400,1\n");
  });

  it("places a 9:16 film's captions by its caption preset", () => {
    const preset = getFootageCaptionLayout({ ...film, captionPreset: "tiktok" });
    const ass = buildFootageDraftCaptions({ film, edl, words, caption: preset, frame: FRAME }) ?? "";
    expect(preset).not.toEqual(LAYOUTS["9:16"].caption);
    expect(ass).toContain(`,2,${preset.left},${preset.right},${preset.bottom},1\n`);
  });

  it("writes a no-break space inside a word as ASS's hard space and collapses other white space", () => {
    const joined = [
      { text: "pay\u00a035\u00a0kg", start: 0.1, end: 0.5 },
      { text: "now \t\n", start: 0.6, end: 0.8 },
    ];
    const dialogue = (style: "phrase" | "highlight"): string[] =>
      (buildFootageDraftCaptions({ film: { ...film, captionStyle: style }, edl, words: joined, caption, frame: FRAME }) ?? "")
        .split("\n")
        .filter((line) => line.startsWith("Dialogue:"))
        .map((line) => line.split(",,0,0,0,,")[1] as string);
    expect(dialogue("phrase")).toEqual(["pay\\h35\\hkg now"]);
    expect(dialogue("highlight")[0]).toBe("pay\\h35\\hkg now");
    expect(dialogue("highlight").every((text) => !text.includes("\u00a0") && text.includes("pay\\h35\\hkg"))).toBe(true);
  });

  it("draws a highlight film's chunks of up to four words on the brand's box, lighting each word for 0.32 s", () => {
    const colors = { captionBackground: "#0a0b0ccc", captionText: "#fff", captionHighlight: "#ff8800" };
    const highlight = { ...film, captionStyle: "highlight" as const };
    const ass = buildFootageDraftCaptions({ film: highlight, edl, words, caption: { top: 1470, left: 60, right: 80, fontSize: 50 }, frame: FRAME, fontFamily: "Brand Sans", colors }) ?? "";
    expect(ass).toContain("Style: Caption,Brand Sans,50,&H00FFFFFF,&H00FFFFFF,&H330C0B0A,&H330C0B0A,-1,0,0,0,100,100,0,0,3,16,0,8,60,80,1470,1\n");
    const lit = (word: string): string => `{\\1c&H0088FF&}${word}{\\1c&HFFFFFF&}`;
    expect(ass.split("\n").filter((line) => line.startsWith("Dialogue:"))).toEqual([
      "Dialogue: 0,0:00:00.05,0:00:00.10,Caption,,0,0,0,,Hello,",
      `Dialogue: 0,0:00:00.10,0:00:00.42,Caption,,0,0,0,,${lit("Hello,")}`,
      "Dialogue: 0,0:00:00.42,0:00:00.54,Caption,,0,0,0,,Hello,",
      "Dialogue: 0,0:00:00.55,0:00:00.60,Caption,,0,0,0,,this is (the) draft.",
      `Dialogue: 0,0:00:00.60,0:00:00.85,Caption,,0,0,0,,${lit("this")} is (the) draft.`,
      `Dialogue: 0,0:00:00.85,0:00:00.92,Caption,,0,0,0,,${lit("this")} ${lit("is")} (the) draft.`,
      `Dialogue: 0,0:00:00.92,0:00:01.05,Caption,,0,0,0,,this ${lit("is")} (the) draft.`,
      `Dialogue: 0,0:00:01.05,0:00:01.17,Caption,,0,0,0,,this ${lit("is")} ${lit("(the)")} draft.`,
      `Dialogue: 0,0:00:01.17,0:00:01.37,Caption,,0,0,0,,this is ${lit("(the)")} draft.`,
      "Dialogue: 0,0:00:01.37,0:00:01.45,Caption,,0,0,0,,this is (the) draft.",
      `Dialogue: 0,0:00:01.45,0:00:01.77,Caption,,0,0,0,,this is (the) ${lit("draft.")}`,
      "Dialogue: 0,0:00:01.77,0:00:02.25,Caption,,0,0,0,,this is (the) draft.",
    ]);
  });

  it("paints a highlight film without a brand in the draft's own caption colours", () => {
    const ass = buildFootageDraftCaptions({ film: { ...film, captionStyle: "highlight" }, edl, words, caption, frame: FRAME }) ?? "";
    expect(ass).toContain(`,${FOOTAGE_DRAFT_FONT.family},${caption.fontSize},&H00FFFFFF,&H00FFFFFF,&H00111111,&H00111111,-1,`);
    expect(ass).toContain("{\\1c&H00D4FF&}Hello,{\\1c&HFFFFFF&}");
    expect(FOOTAGE_DRAFT_CAPTION_COLORS.captionHighlight).toBe("#ffd400");
  });

  it("keeps a phrase film's white captions whatever the brand's colours, in the brand's font", () => {
    const branded = buildFootageDraftCaptions({ film, edl, words, caption, frame: FRAME, colors: { captionBackground: "#123456", captionText: "#000000", captionHighlight: "#ff0000" } });
    expect(branded).toBe(buildFootageDraftCaptions({ film, edl, words, caption, frame: FRAME }));
    expect(buildFootageDraftCaptions({ film, edl, words, caption, frame: FRAME, fontFamily: "Brand, Sans" })).toContain("Style: Caption,Brand  Sans,");
  });

  it("is null for a film without captions or without words", () => {
    expect(buildFootageDraftCaptions({ film: { captions: false }, edl, words, caption, frame: FRAME })).toBeNull();
    expect(buildFootageDraftCaptions({ film, edl, words: [], caption, frame: FRAME })).toBeNull();
  });
});

describe("toAssColor", () => {
  it("writes blue first and an inverted alpha", () => {
    expect(toAssColor("#ff8800")).toBe("&H000088FF");
    expect(toAssColor("#F80")).toBe("&H000088FF");
    expect(toAssColor("#0a0b0ccc")).toBe("&H330C0B0A");
    expect(toAssColor("#0000")).toBe("&HFF000000");
  });

  it("names a value that is not a hex colour", () => {
    expect(() => toAssColor("red")).toThrow('Not a hex colour: "red".');
  });
});

describe("FOOTAGE_DRAFT_FONT", () => {
  it("ships in the package and draws every Polish letter", () => {
    const map = readCharacterMap(readFileSync(FOOTAGE_DRAFT_FONT.file));
    if (!map.ok) throw new Error(map.error);
    // Every Polish letter, lower and upper case, as code points (the language gate keeps Polish letters out of code).
    const polish = String.fromCodePoint(0x0105, 0x0107, 0x0119, 0x0142, 0x0144, 0x00f3, 0x015b, 0x017a, 0x017c, 0x0104, 0x0106, 0x0118, 0x0141, 0x0143, 0x00d3, 0x015a, 0x0179, 0x017b);
    expect([...polish].filter((letter) => !map.value.has(letter.codePointAt(0) ?? 0))).toEqual([]);
  });
});

const ffmpegFilters = (() => {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return result.status === 0 ? readFfmpegListing(result.stdout) : new Set<string>();
})();
const canDraft = DRAFT_FILTERS.every((filter) => ffmpegFilters.has(filter));

describe.skipIf(!canDraft)("renderFootageDraft with ffmpeg", () => {
  let dir = "";
  afterEach(() => {
    if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
  });

  function makeClip(name: string, source: string): string {
    const file = join(dir, `${name}.mp4`);
    const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `${source}=s=1080x1920:r=30:d=4`, "-f", "lavfi", "-i", "sine=d=4", "-c:v", "libx264", "-preset", "ultrafast", "-g", "15", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file]);
    if (made.status !== 0) throw new Error(`making the test clip ${name} failed: ${made.stderr.toString()}`);
    return file;
  }

  it("passes the draft's machine check", async () => {
    const problems = await checkFootageTools({ needsRender: false, needsDraft: true });
    expect(problems.filter((problem) => problem.includes("the draft needs it"))).toEqual([]);
  });

  it("writes a fast-start draft exactly as long as the cut, at the draft's size, with captions and every transition", async () => {
    dir = mkdtempSync(join(tmpdir(), "footage-draft-"));
    const talk = makeClip("talk", "testsrc2");
    const street = makeClip("street", "smptebars");
    const probe = {} as FootageProbe; // The draft never reads the probe.
    const clip = (id: string, file: string, role: "talk" | "broll"): PreparedClip => ({ clip: { id, source: file, role, fit: "auto", trim: { start: 0, end: null }, script: null }, source: file, probe, file, duration: 4 });
    const cut: Edl = {
      version: 2,
      film: "street",
      segments: [
        { id: "s1", clip: "talk", start: 0.5, end: 1.5, transition: "cut", motion: "none" },
        { id: "s2", clip: "talk", start: 2, end: 3, transition: "zoom", motion: "none" },
        { id: "r1", clip: "street", start: 0, end: 1.2, transition: "fade", motion: "kenburns" },
        // Runs to the clip's end: its fade tail would read past it, so the last frame is held.
        { id: "s3", clip: "talk", start: 3.2, end: 4, transition: "cut", motion: "none" },
      ],
    };
    const progress: number[] = [];
    const drafted = await renderFootageDraft(
      // An eased zoom cut and a cross-faded speech track, so real ffmpeg reads both graphs.
      { ...film, edit: { zoomEaseFrames: 4, cutAudioFadeMs: 40, isCutAudioCrossfade: true } },
      [clip("talk", talk, "talk"), clip("street", street, "broll")],
      { kind: "ready", words: { talk: [{ text: String.fromCodePoint(0x5a, 0x61, 0x17c, 0xf3, 0x142, 0x107), start: 0.6, end: 1 }, { text: "draft.", start: 1.05, end: 1.4 }] }, speech: { talk, street } },
      cut,
      { buildDir: join(dir, "build"), output: join(dir, "out", "draft.mp4"), log: () => undefined, onProgress: (step) => progress.push(step.done / step.total) },
    );
    if (!drafted.ok) throw new Error(drafted.error);
    expect(drafted.value).toMatchObject({ seconds: 4, width: 540, height: 960 });
    expect(existsSync(join(dir, "build", "draft", "captions.ass"))).toBe(true);
    expect(progress.at(-1)).toBe(1);
    const probed = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height,pix_fmt:format=duration", "-of", "json", drafted.value.output], { encoding: "utf8" });
    const facts = JSON.parse(probed.stdout) as { streams: { codec_name: string; width?: number; height?: number; pix_fmt?: string }[]; format: { duration: string } };
    expect(facts.streams.map((stream) => stream.codec_name)).toEqual(["h264", "aac"]);
    expect(facts.streams[0]).toMatchObject({ width: 540, height: 960, pix_fmt: "yuv420p" });
    expect(Math.abs(Number(facts.format.duration) - 4)).toBeLessThan(0.05);
    // Fast start: the movie box comes before the media data.
    const head = readFileSync(drafted.value.output).subarray(0, 4096).toString("latin1");
    expect(head.indexOf("moov")).toBeGreaterThan(-1);
    expect(head.indexOf("moov")).toBeLessThan(head.indexOf("mdat") === -1 ? Infinity : head.indexOf("mdat"));
    expect(drafted.value).toMatchObject({ music: "none", captionFont: "DejaVu Sans" });
  }, 60_000);

  const highlightFilm: FootageFilm = { ...film, captionStyle: "highlight", music: { source: { kind: "prompt", prompt: "calm piano" }, volume: 0.35, duckedVolume: 0.1 } };
  const brand = {
    colors: { captionBackground: "#0a0b0ccc", captionText: "#ffffff", captionHighlight: "#ff8800" },
    // The CSS family differs from the file's own: libass needs the file's.
    fonts: { heading: null, body: { family: "Brand Sans", fallback: "sans-serif", files: [{ path: FOOTAGE_DRAFT_FONT.file, weight: "700", style: "normal" as const, unicodeRange: null }] } },
  };
  const shortCut: Edl = { version: 2, film: "street", segments: [{ id: "s1", clip: "talk", start: 0, end: 2, transition: "cut", motion: "none" }] };

  function draftInputs(): { clips: PreparedClip[]; transcript: { kind: "ready"; words: Record<string, { text: string; start: number; end: number }[]>; speech: Record<string, string> } } {
    const talk = makeClip("talk", "testsrc2");
    const prepared: PreparedClip = { clip: { id: "talk", source: talk, role: "talk", fit: "auto", trim: { start: 0, end: null }, script: null }, source: talk, probe: {} as FootageProbe, file: talk, duration: 4 };
    return { clips: [prepared], transcript: { kind: "ready", words: { talk: [{ text: "Hello", start: 0.2, end: 0.6 }, { text: "draft.", start: 0.7, end: 1.2 }] }, speech: { talk } } };
  }

  function readStreamCodecs(file: string): string[] {
    const probed = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name", "-of", "csv=p=0", file], { encoding: "utf8" });
    return probed.stdout.trim().split("\n");
  }

  it("draws a highlight film in the brand's font and colours and plays its cached music ducked, with no provider call", async () => {
    dir = mkdtempSync(join(tmpdir(), "footage-draft-"));
    const { clips, transcript } = draftInputs();
    const providers = { stt: createFakeSttProvider(), isolation: createFakeIsolationProvider(), music: createFakeMusicProvider() };
    const cacheDir = join(dir, "cache");
    const cached = getPromptMusicCache(highlightFilm, { cacheDir, providers }).path;
    mkdirSync(dirname(cached), { recursive: true });
    const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=220:d=1", "-c:a", "libmp3lame", cached]);
    if (made.status !== 0) throw new Error(`making the cached music failed: ${made.stderr.toString()}`);
    const lines: string[] = [];
    const progress: { item: string; done: number; total: number }[] = [];
    const drafted = await renderFootageDraft(highlightFilm, clips, transcript, shortCut, {
      buildDir: join(dir, "build"),
      output: join(dir, "draft.mp4"),
      brand,
      cacheDir,
      providers,
      log: (line) => lines.push(line),
      onProgress: (step) => progress.push({ item: step.item, done: step.done, total: step.total }),
    });
    if (!drafted.ok) throw new Error(drafted.error);
    expect(drafted.value).toMatchObject({ music: "played", captionFont: "DejaVu Sans", seconds: 2 });
    expect(providers.music.calls).toEqual([]);
    expect([...new Set(progress.map((step) => step.item))]).toEqual(["speech", "music", "film"]);
    expect(progress.at(-1)).toEqual({ item: "film", done: 6, total: 6 });
    const ass = readFileSync(join(dir, "build", "draft", "captions.ass"), "utf8");
    expect(ass).toContain("Style: Caption,DejaVu Sans,");
    expect(ass).toContain(",&H00FFFFFF,&H00FFFFFF,&H330C0B0A,&H330C0B0A,-1,0,0,0,100,100,0,0,3,16,0,");
    expect(ass).toContain("{\\1c&H0088FF&}Hello{\\1c&HFFFFFF&}");
    expect(existsSync(join(dir, "build", "draft", "music.mp3"))).toBe(true);
    expect(readStreamCodecs(drafted.value.output)).toEqual(["h264", "aac"]);
    expect(lines.at(-1)).toContain("captions in DejaVu Sans, music.");
  }, 60_000);

  it("drafts a film whose generated music is not cached without music, and says so", async () => {
    dir = mkdtempSync(join(tmpdir(), "footage-draft-"));
    const { clips, transcript } = draftInputs();
    const providers = { stt: createFakeSttProvider(), isolation: createFakeIsolationProvider(), music: createFakeMusicProvider() };
    const lines: string[] = [];
    const run = { buildDir: join(dir, "build"), output: join(dir, "draft.mp4"), log: (line: string) => lines.push(line) };
    const missing = await renderFootageDraft(highlightFilm, clips, transcript, shortCut, { ...run, cacheDir: join(dir, "cache"), providers });
    if (!missing.ok) throw new Error(missing.error);
    expect(missing.value.music).toBe("not_cached");
    expect(providers.music.calls).toEqual([]);
    expect(lines.some((line) => line.startsWith("draft: no music, the film's generated music is not in the cache yet ("))).toBe(true);
    expect(lines.at(-1)).toContain("music not cached.");
    lines.length = 0;
    const unasked = await renderFootageDraft(highlightFilm, clips, transcript, shortCut, run);
    if (!unasked.ok) throw new Error(unasked.error);
    expect(unasked.value.music).toBe("not_cached");
    expect(lines).toContain("draft: no music, the film's music is generated and the draft was given no cacheDir and providers to find it in the cache.");
  }, 60_000);

  it("hands a failed draft step to onFfmpegFailure, and its kept command.sh fails the same way", async () => {
    dir = mkdtempSync(join(tmpdir(), "footage-draft-"));
    const { clips, transcript } = draftInputs();
    // The speech track reads the real clip; the draft's picture reads a file that is not a video.
    const broken = join(dir, "broken.mp4");
    writeFileSync(broken, "not a video");
    const brokenClips = clips.map((clip) => ({ ...clip, file: broken }));
    const lines: string[] = [];
    const failures: FfmpegFailure[] = [];
    const kept = join(dir, "kept");
    const run = { buildDir: join(dir, "build"), output: join(dir, "draft.mp4"), log: (line: string) => lines.push(line) };
    const failed = renderFootageDraft(film, brokenClips, transcript, shortCut, {
      ...run,
      onFfmpegFailure: async (failure) => {
        failures.push(failure);
        await writeFfmpegFailure(kept, failure);
      },
    });
    const withoutPointers = (text: string): string[] => text.split("\n").filter((line) => line.trim().length > 0).map((line) => line.replace(/ @ 0x[0-9a-f]+/g, ""));
    const readMessage = (error: unknown): string[] => withoutPointers(error instanceof Error ? error.message : String(error));
    const withHook = readMessage(await failed.then(() => null, (error: unknown) => error));
    expect(withHook.join("")).toMatch(/^The footage draft: ffmpeg ended with code \d+ \(signal -\): .*broken\.mp4/);
    // Without the hook the run throws the same text.
    const withoutHook = readMessage(await renderFootageDraft(film, brokenClips, transcript, shortCut, run).then(() => null, (error: unknown) => error));
    expect(withoutHook).toEqual(withHook);
    expect(failures).toHaveLength(1);
    const [failure] = failures;
    if (failure === undefined) throw new Error("no failure was handed over");
    const draftDir = join(dir, "build", "draft");
    expect(failure).toMatchObject({ step: "The footage draft", cwd: draftDir, signal: null, inputs: [broken, join(draftDir, "speech.mp3")] });
    expect(failure.args.slice(0, 3)).toEqual(["-progress", "pipe:1", "-nostats"]);
    expect(failure.args).toContain("-filter_complex");
    expect(failure.args.at(-1)).toBe(join(dir, "draft.mp4"));
    expect(failure.stderr.join("\n")).toContain("broken.mp4");
    expect(lines).toContain(`ffmpeg failed: The footage draft, in ${draftDir}: ${formatFfmpegCommand(failure.args)}`);
    const rerun = spawnSync("sh", [join(kept, "command.sh")], { encoding: "utf8" });
    expect(rerun.status).toBe(failure.code);
    expect(withoutPointers(rerun.stderr)).toEqual(withoutPointers(failure.stderr.join("\n")));
  }, 60_000);

  it("plays a film's own music file and names one that is gone", async () => {
    dir = mkdtempSync(join(tmpdir(), "footage-draft-"));
    const { clips, transcript } = draftInputs();
    const song = join(dir, "song.mp3");
    spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=330:d=1", "-c:a", "libmp3lame", song]);
    const withFile = (path: string): FootageFilm => ({ ...film, music: { source: { kind: "file", path }, volume: 0.35, duckedVolume: 0.1 } });
    const run = { buildDir: join(dir, "build"), output: join(dir, "draft.mp4"), log: () => undefined };
    const played = await renderFootageDraft(withFile(song), clips, transcript, shortCut, run);
    if (!played.ok) throw new Error(played.error);
    expect(played.value.music).toBe("played");
    const gone = await renderFootageDraft(withFile(join(dir, "gone.mp3")), clips, transcript, shortCut, run);
    expect(gone).toEqual({ ok: false, error: `music: no file at ${join(dir, "gone.mp3")}` });
  }, 60_000);
});
