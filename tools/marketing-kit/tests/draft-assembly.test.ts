import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildFootageDraftArgs,
  buildFootageDraftJoinArgs,
  buildFootageDraftPieceArgs,
  estimateFootageDraftMemory,
  FOOTAGE_DRAFT_ASSEMBLIES,
  FOOTAGE_DRAFT_PIECE_SEGMENTS,
  planFootageDraft,
  planFootageDraftPieces,
  renderFootageDraft,
  type DraftSegmentPlan,
  type FootageDraftAssembly,
} from "../src/footage/draft.js";
import { getEdlDuration, type Edl } from "../src/footage/edl.js";
import type { FootageFilm } from "../src/footage/film.js";
import type { PreparedClip } from "../src/footage/pipeline.js";
import type { FootageProbe } from "../src/footage/probe.js";
import { DRAFT_FILTERS, readFfmpegListing } from "../src/footage/tools.js";
import { ASSEMBLY_EDL, ASSEMBLY_FILM, ASSEMBLY_OVERLAYS, getAssemblyArgsInput } from "./fixtures/draft-assembly/fixtures.js";

const FPS = 30;
const SECONDS = getEdlDuration(ASSEMBLY_EDL);
const PLANS = planFootageDraft(ASSEMBLY_FILM, ASSEMBLY_EDL, ASSEMBLY_OVERLAYS);

function getGraph(args: readonly string[]): string[] {
  return (args[args.indexOf("-filter_complex") + 1] as string).split(";");
}

function getInputs(args: readonly string[]): string[] {
  return args.flatMap((arg, index) => (arg === "-i" ? [args[index + 1] as string] : []));
}

/** A cut of `count` plain segments of `length` seconds over two clips, every third one cross-faded. */
function makeLongCut(count: number, length: number, clipSeconds: number): Edl {
  return {
    version: 2,
    film: "street",
    segments: Array.from({ length: count }, (_, index) => {
      const start = Math.round(((index * 0.37) % (clipSeconds - length - 0.5)) * 100) / 100;
      return { id: `s${String(index)}`, clip: index % 2 === 0 ? "talk" : "street", start, end: Math.round((start + length) * 100) / 100, transition: index % 3 === 2 ? ("fade" as const) : ("cut" as const), motion: "none" as const };
    }),
  };
}

describe("buildFootageDraftArgs (assembly single)", () => {
  it("builds exactly the one-run command it built before the pieces existed", () => {
    const golden = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/draft-assembly/single-args.json"), "utf8")) as Record<string, string[]>;
    expect(buildFootageDraftArgs(getAssemblyArgsInput())).toEqual(golden.plain);
    expect(buildFootageDraftArgs(getAssemblyArgsInput({ threads: 1 }))).toEqual(golden.threads);
    expect(buildFootageDraftArgs(getAssemblyArgsInput({ music: "music.mp3" }))).toEqual(golden.music);
    expect(buildFootageDraftArgs(getAssemblyArgsInput({ mix: "/draft/mix.m4a", captions: null, fontsDir: null, width: 360 }))).toEqual(golden.mix);
    expect(buildFootageDraftArgs(getAssemblyArgsInput({ film: { edit: { zoomEaseFrames: 4, fadeFrames: 12 } } }))).toEqual(golden.eased);
  });

  it("names a split segment that has no layer", () => {
    expect(() => buildFootageDraftArgs(getAssemblyArgsInput({ splitLayers: {} }))).toThrow('No split layer for segment "a9" of the EDL.');
  });
});

describe("planFootageDraftPieces", () => {
  it("lists the assemblies, pieces by default", () => {
    expect(FOOTAGE_DRAFT_ASSEMBLIES).toEqual(["pieces", "single"]);
    expect(FOOTAGE_DRAFT_PIECE_SEGMENTS).toBe(4);
  });

  it("cuts the segments into runs of the given size, the last run what is left", () => {
    expect(planFootageDraftPieces(PLANS, SECONDS, 5).map((piece) => [piece.first, piece.last])).toEqual([
      [0, 4],
      [5, 9],
      [10, 11],
    ]);
    expect(planFootageDraftPieces(PLANS, SECONDS).map((piece) => [piece.first, piece.last])).toEqual([
      [0, 3],
      [4, 7],
      [8, 11],
    ]);
  });

  it("starts a piece's graph one segment early only when its first segment starts on a fade or a drawn transition", () => {
    const pieces = planFootageDraftPieces(PLANS, SECONDS, 1);
    const leads = pieces.map((piece) => piece.first - piece.from);
    // a4 fade, a5 whip, a7 card, a8 paper, a10 fade, a12 fade; a6 stutter and the cuts have no tail to borrow.
    expect(leads).toEqual([0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1]);
    for (const piece of pieces) {
      const lead = PLANS[piece.from] as DraftSegmentPlan;
      expect(piece.skipFrames).toBe(Math.round((PLANS[piece.first] as DraftSegmentPlan).start * FPS) - Math.round(lead.start * FPS));
    }
  });

  it("covers every frame of the cut once, in order, whatever the piece size", () => {
    for (const size of [1, 2, 3, 4, 7, 12, 40]) {
      const pieces = planFootageDraftPieces(PLANS, SECONDS, size);
      expect(pieces[0]?.frame).toBe(0);
      pieces.slice(1).forEach((piece, index) => expect(piece.frame).toBe((pieces[index]?.frame ?? 0) + (pieces[index]?.frames ?? 0)));
      expect(pieces.reduce((sum, piece) => sum + piece.frames, 0)).toBe(Math.round(SECONDS * FPS));
    }
  });

  it("refuses a piece size that is not a positive whole number, and a cut without segments", () => {
    for (const size of [0, -2, 1.5, Number.NaN]) expect(() => planFootageDraftPieces(PLANS, SECONDS, size)).toThrow(`draft.segmentsPerPiece must be a positive whole number, got ${size}.`);
    expect(() => planFootageDraftPieces([], 0)).toThrow("The EDL has no segments.");
  });
});

describe("buildFootageDraftPieceArgs", () => {
  const pieces = planFootageDraftPieces(PLANS, SECONDS, 2);
  const pieceArgs = (index: number, changes: Parameters<typeof getAssemblyArgsInput>[0] = {}): string[] => buildFootageDraftPieceArgs({ ...getAssemblyArgsInput(changes), piece: pieces[index] as (typeof pieces)[number], output: `pieces/p${String(index)}.mp4` });

  it("decodes only its own segments and a lead segment's tail", () => {
    expect(getInputs(pieceArgs(0))).toEqual(["/clips/talk.mp4", "/clips/talk.mp4"]);
    // a3 starts on a zoom cut: no lead; a4's fade is inside the piece.
    expect(getInputs(pieceArgs(1))).toEqual(["/clips/talk.mp4", "/clips/street.mp4"]);
    // a5 starts on a whip: a4 leads with its tail.
    expect(getInputs(pieceArgs(2))).toEqual(["/clips/street.mp4", "/clips/talk.mp4", "/clips/talk.mp4"]);
    // a9 is a split screen: three bands and its layer.
    expect(getInputs(pieceArgs(4))).toEqual(["/clips/north.mp4", "/clips/harbour.mp4", "/clips/hill.mp4", "/draft/split-a9.png", "/clips/talk.mp4"]);
  });

  it("draws its segments with the one-run draft's filters, offsets counted from the piece's own start", () => {
    const single = getGraph(buildFootageDraftArgs(getAssemblyArgsInput()));
    const graph = getGraph(pieceArgs(1));
    // a3 and a4 are drawn as in the one run, from their own input numbers.
    expect(graph[0]).toBe((single[2] as string).replace("[2:v]", "[0:v]"));
    expect(graph[1]).toBe((single[3] as string).replace("[3:v]", "[1:v]"));
    const a4 = PLANS[3] as DraftSegmentPlan;
    const a3 = PLANS[2] as DraftSegmentPlan;
    expect(graph[2]).toBe(`[v2][v3]xfade=transition=fade:duration=${String(a4.fade)}:offset=${String(Math.round((a4.start - a3.start) * 1000) / 1000)}[j3]`);
    expect(graph.some((part) => part.includes("ass="))).toBe(false);
  });

  it("splits a drawn transition at the frame the incoming segment starts, counted in film frames", () => {
    const graph = getGraph(pieceArgs(2));
    const a5 = PLANS[4] as DraftSegmentPlan;
    const a4 = PLANS[3] as DraftSegmentPlan;
    const at = Math.round(a5.start * FPS) - Math.round(a4.start * FPS);
    expect(at).toBe(90);
    expect(graph.filter((part) => part.startsWith(`[d4a]trim=end_frame=${String(at)},`))).toHaveLength(1);
    expect(graph.filter((part) => part.startsWith(`[d4b]trim=start_frame=${String(at)}:end_frame=${String(at + 14)},`))).toHaveLength(1);
  });

  it("cuts the lead segment away and writes exactly the piece's frames, without sound", () => {
    const piece = pieces[1] as (typeof pieces)[number];
    const args = pieceArgs(1);
    expect(getGraph(args).at(-1)).toBe(`[j3]trim=start_frame=${String(piece.skipFrames)}:end_frame=${String(piece.skipFrames + piece.frames)},setpts=PTS-STARTPTS[picture]`);
    expect(args.slice(args.indexOf("-map"))).toEqual(["-map", "[picture]", "-an", "-frames:v", String(piece.frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "pieces/p1.mp4"]);
  });

  it("caps every decoder, the graph and the encoder at the given threads", () => {
    const args = pieceArgs(0, { threads: 2 });
    expect(args.slice(3, 5)).toEqual(["-filter_complex_threads", "2"]);
    expect(args.filter((arg) => arg === "-threads")).toHaveLength(3);
    expect(args.slice(-3)).toEqual(["-threads", "2", "pieces/p0.mp4"]);
  });
});

describe("buildFootageDraftJoinArgs", () => {
  const base = { speech: "/draft/speech.wav", captions: "captions.ass", fontsDir: "fonts", list: "pieces/pieces.txt", seconds: 12.5, output: "/out/draft.mp4" };

  it("reads the pieces with the concat demuxer, burns the captions in once and muxes the speech", () => {
    const args = buildFootageDraftJoinArgs(base);
    expect(args.slice(0, 10)).toEqual(["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "pieces/pieces.txt", "-i"]);
    expect(getGraph(args)).toEqual(["[0:v]ass=filename=captions.ass:fontsdir=fonts[draft]"]);
    expect(args.slice(args.indexOf("-map"))).toEqual(["-map", "[draft]", "-map", "1:a", "-t", "12.5", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "/out/draft.mp4"]);
  });

  it("passes the picture through without captions, mixes music under the speech, or copies a prepared mix", () => {
    expect(getGraph(buildFootageDraftJoinArgs({ ...base, captions: null, fontsDir: null }))).toEqual(["[0:v]null[draft]"]);
    expect(getGraph(buildFootageDraftJoinArgs({ ...base, fontsDir: null }))).toEqual(["[0:v]ass=filename=captions.ass[draft]"]);
    const music = buildFootageDraftJoinArgs({ ...base, music: "music.mp3" });
    expect(getInputs(music)).toEqual(["pieces/pieces.txt", "/draft/speech.wav", "music.mp3"]);
    expect(getGraph(music).at(-1)).toBe("[1:a][2:a]amix=inputs=2:duration=first:normalize=0[sound]");
    const mixed = buildFootageDraftJoinArgs({ ...base, music: "music.mp3", mix: "/draft/mix.m4a" });
    expect(getInputs(mixed)).toEqual(["pieces/pieces.txt", "/draft/mix.m4a"]);
    expect(mixed.slice(mixed.indexOf("-c:a"), mixed.indexOf("-c:a") + 2)).toEqual(["-c:a", "copy"]);
  });

  it("caps the demuxer's decoder, the graph and the encoder at the given threads", () => {
    const args = buildFootageDraftJoinArgs({ ...base, threads: 1 });
    expect(args.slice(3, 7)).toEqual(["-filter_complex_threads", "1", "-threads", "1"]);
    expect(args.slice(-3)).toEqual(["-threads", "1", "/out/draft.mp4"]);
  });
});

describe("estimateFootageDraftMemory", () => {
  const full = { width: 1080, height: 1920 };

  it("grows with every cut in one run and stays one piece's in pieces", () => {
    const at = (count: number, assembly: FootageDraftAssembly): number => estimateFootageDraftMemory({ edl: makeLongCut(count, 0.5, 20), frame: full, assembly }).peakMb;
    expect(at(18, "single")).toBe(1510);
    expect(at(51, "single")).toBe(3820);
    expect(at(150, "single")).toBe(10750);
    expect(at(51, "pieces")).toBe(600);
    expect(at(150, "pieces")).toBe(600);
    expect(at(3, "pieces")).toBe(460);
    expect(estimateFootageDraftMemory({ edl: makeLongCut(51, 0.5, 20), frame: full, assembly: "pieces", segmentsPerPiece: 1 })).toEqual({ decoders: 2, peakMb: 390 });
  });

  it("counts a split screen's three bands and scales a decoder by its pixels", () => {
    expect(estimateFootageDraftMemory({ edl: ASSEMBLY_EDL, frame: full, assembly: "single" })).toEqual({ decoders: 14, peakMb: 1230 });
    expect(estimateFootageDraftMemory({ edl: ASSEMBLY_EDL, frame: { width: 540, height: 960 }, assembly: "single" })).toEqual({ decoders: 14, peakMb: 495 });
    expect(estimateFootageDraftMemory({ edl: ASSEMBLY_EDL, frame: full, assembly: "pieces" })).toEqual({ decoders: 7, peakMb: 740 });
  });

  it("refuses a piece size that is not a positive whole number", () => {
    expect(() => estimateFootageDraftMemory({ edl: ASSEMBLY_EDL, frame: full, assembly: "pieces", segmentsPerPiece: 0 })).toThrow("draft.segmentsPerPiece must be a positive whole number, got 0.");
  });
});

const ffmpegFilters = (() => {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return result.status === 0 ? readFfmpegListing(result.stdout) : new Set<string>();
})();
const canDraft = DRAFT_FILTERS.every((filter) => ffmpegFilters.has(filter));
const realFfmpeg = spawnSync("sh", ["-c", "command -v ffmpeg"], { encoding: "utf8" }).stdout.trim();
const hasPython = spawnSync("python3", ["--version"]).status === 0;

describe.skipIf(!canDraft)("renderFootageDraft in pieces and in one run, with ffmpeg", () => {
  let dir = "";
  const path = process.env.PATH;
  afterEach(() => {
    process.env.PATH = path;
    if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
  });

  function makeClip(name: string, source: string, seconds: number, size: string): string {
    const file = join(dir, `${name}.mp4`);
    const made = spawnSync(realFfmpeg, ["-v", "error", "-y", "-f", "lavfi", "-i", `${source}=s=${size}:r=30:d=${String(seconds)}`, "-f", "lavfi", "-i", `sine=d=${String(seconds)}`, "-c:v", "libx264", "-preset", "ultrafast", "-g", "15", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file]);
    if (made.status !== 0) throw new Error(`making the test clip ${name} failed: ${made.stderr.toString()}`);
    return file;
  }

  function prepare(id: string, file: string, seconds: number): PreparedClip {
    return { clip: { id, source: file, role: id === "talk" ? "talk" : "broll", fit: "auto", trim: { start: 0, end: null }, script: null }, source: file, probe: {} as FootageProbe, file, duration: seconds };
  }

  /** Every frame of a video as gray bytes at `width` x `height`. */
  function readFrames(file: string, width: number, height: number): Buffer[] {
    const read = spawnSync(realFfmpeg, ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 30 });
    if (read.status !== 0) throw new Error(read.stderr.toString());
    const size = width * height;
    return Array.from({ length: read.stdout.length / size }, (_, index) => read.stdout.subarray(index * size, (index + 1) * size));
  }

  function getMeanDifference(a: Buffer, b: Buffer): number {
    let sum = 0;
    for (let index = 0; index < a.length; index += 1) sum += Math.abs((a[index] ?? 0) - (b[index] ?? 0));
    return sum / a.length;
  }

  const film: FootageFilm = { ...ASSEMBLY_FILM, captions: true };
  const transcript = (speech: Record<string, string>) => ({ kind: "ready" as const, words: { talk: [{ text: "Hello", start: 0.6, end: 1 }, { text: "draft.", start: 3.1, end: 3.6 }, { text: "Again.", start: 12.6, end: 13 }] }, speech });

  it("draws the same frames in pieces as in one run, at every segment border and transition", async () => {
    dir = mkdtempSync(join(tmpdir(), "draft-assembly-"));
    const size = "360x640";
    const clips = { talk: makeClip("talk", "testsrc2", 16, size), street: makeClip("street", "smptebars", 7, size), north: makeClip("north", "testsrc", 4, size), harbour: makeClip("harbour", "rgbtestsrc", 4, size), hill: makeClip("hill", "testsrc2", 4, size) };
    const prepared = Object.entries(clips).map(([id, file]) => prepare(id, file, id === "talk" ? 16 : id === "street" ? 7 : 4));
    const draw = async (assembly: FootageDraftAssembly): Promise<string> => {
      const drafted = await renderFootageDraft({ ...film, clips: [] }, prepared, transcript(clips), ASSEMBLY_EDL, { buildDir: join(dir, assembly), output: join(dir, `${assembly}.mp4`), width: 180, log: () => undefined, assembly, segmentsPerPiece: 2 });
      if (!drafted.ok) throw new Error(drafted.error);
      expect(drafted.value).toMatchObject({ assembly, pieces: assembly === "single" ? 1 : 6, seconds: SECONDS });
      return drafted.value.output;
    };
    const single = readFrames(await draw("single"), 180, 320);
    const pieces = readFrames(await draw("pieces"), 180, 320);
    expect(pieces.length).toBe(single.length);
    expect(Math.abs(single.length - Math.round(SECONDS * FPS))).toBeLessThanOrEqual(1);
    const differences = pieces.map((frame, index) => getMeanDifference(frame, single[index] as Buffer));
    // Two encodes instead of one, nothing else: every frame within a few grey levels, borders and transitions included.
    const borders = PLANS.map((plan) => Math.round(plan.start * FPS));
    for (const border of borders) for (const at of [border - 1, border, border + 1, border + 5]) if (at >= 0 && at < differences.length) expect(differences[at]).toBeLessThan(6);
    expect(Math.max(...differences)).toBeLessThan(6);
    // The pieces are gone once joined.
    expect(existsSync(join(dir, "pieces", "draft", "pieces"))).toBe(false);
  }, 180_000);

  it.skipIf(!hasPython)("keeps a 51 and a 150 cut draft in pieces under one piece's memory, where one run grows with the cuts", async () => {
    dir = mkdtempSync(join(tmpdir(), "draft-memory-"));
    // A wrapper first in PATH runs the real ffmpeg and writes each run's peak resident memory (KiB) to a log.
    const bin = join(dir, "bin");
    mkdirSync(bin);
    const log = join(dir, "peaks.log");
    const wrapper = join(bin, "ffmpeg");
    writeFileSync(
      wrapper,
      [
        "#!/usr/bin/env python3",
        "import resource, subprocess, sys",
        `run = subprocess.run([${JSON.stringify(realFfmpeg)}] + sys.argv[1:])`,
        "peak = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss",
        "kib = peak // 1024 if sys.platform == 'darwin' else peak",
        `open(${JSON.stringify(log)}, 'a').write(str(kib) + '\\n')`,
        "sys.exit(run.returncode if run.returncode >= 0 else 1)",
        "",
      ].join("\n"),
    );
    chmodSync(wrapper, 0o755);
    const size = "720x1280";
    const clips = { talk: makeClip("talk", "testsrc2", 12, size), street: makeClip("street", "testsrc", 12, size) };
    const prepared = [prepare("talk", clips.talk, 12), prepare("street", clips.street, 12)];
    // The speech chain reads the clips' extracted sound, as the transcript gives it to a real draft.
    const speech = Object.fromEntries(
      Object.keys(clips).map((id) => {
        const file = join(dir, `${id}.wav`);
        spawnSync(realFfmpeg, ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=d=12", "-ar", "48000", "-ac", "2", file]);
        return [id, file];
      }),
    );
    process.env.PATH = `${bin}:${path ?? ""}`;
    const peakOf = async (count: number, assembly: FootageDraftAssembly): Promise<number> => {
      rmSync(log, { force: true });
      const cut = makeLongCut(count, 0.3, 12);
      const drafted = await renderFootageDraft({ ...film, captions: false }, prepared, transcript(speech), cut, { buildDir: join(dir, `${assembly}-${String(count)}`), output: join(dir, `${assembly}-${String(count)}.mp4`), width: 180, log: () => undefined, assembly });
      if (!drafted.ok) throw new Error(drafted.error);
      return Math.max(...readFileSync(log, "utf8").trim().split("\n").map(Number)) / 1024;
    };
    const pieces51 = await peakOf(51, "pieces");
    const pieces150 = await peakOf(150, "pieces");
    const single51 = await peakOf(51, "single");
    // In pieces the peak is one piece's, whatever the cut: 150 cuts cost what 51 do.
    expect(pieces150).toBeLessThan(pieces51 * 1.25);
    // A fixed bound for a 720x1280 piece of four segments and a lead, far under a 1.5 GB worker.
    expect(pieces150).toBeLessThan(400);
    // One run holds every decoder at once.
    expect(single51).toBeGreaterThan(pieces51 * 2);
    expect(readdirSync(dir).filter((name) => name.endsWith(".mp4") && name.startsWith("pieces"))).toHaveLength(2);
  }, 600_000);
});
