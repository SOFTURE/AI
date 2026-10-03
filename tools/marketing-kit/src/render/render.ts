import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { composeFilm, filmTimes } from "../compose/compose.js";
import { readSiteTokens } from "../compose/site-tokens.js";
import { rewindFrames } from "../compose/timeline.js";
import type { Film } from "../film.js";
import type { MarketingLocale, MarketingMessages } from "../messages/index.js";
import type { RecordingLog } from "../record/record.js";
import type { BeatVoice } from "../voice/voiceover.js";
import { runHyperframes } from "./hyperframes.js";

const require = createRequire(import.meta.url);

export interface RenderInput {
  film: Film;
  log: RecordingLog;
  voices: BeatVoice[];
  /** The film's build folder: `frames/` and `log.json` from the recording; the composition goes here. */
  buildDir: string;
  /** The cached voiceover recording (before the tempo change). */
  voiceoverAudio: string;
  /** The project's font and SFX folders, copied next to the composition. */
  fontsDir: string;
  sfxDir: string;
  /** The app's stylesheet the colours are read from. */
  siteCss: string;
  brandName: string;
  locale: MarketingLocale;
  messages: MarketingMessages;
  quality: string;
  /** The finished MP4. */
  output: string;
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit" });
  const label = `${command} ${args.slice(0, 3).join(" ")}...`;
  if (result.error !== undefined) throw new Error(`${label} did not start: ${result.error.message}.`);
  if (result.signal !== null) throw new Error(`${label} was stopped by signal ${result.signal}.`);
  if (result.status !== 0) throw new Error(`${label} ended with code ${String(result.status)}.`);
}

function getFramePath(dir: string, index: number): string {
  return join(dir, "frames", `f${String(index).padStart(5, "0")}.jpg`);
}

/** The composition (`<build>/index.html`) and its assets, from the recording. Returns the HTML path. */
export function buildComposition(input: RenderInput): string {
  const { film, log, buildDir: dir } = input;
  const assetsDir = join(dir, "assets");
  mkdirSync(assetsDir, { recursive: true });

  const ff = (args: string[]) => run("ffmpeg", ["-v", "error", "-y", ...args]);
  ff(["-framerate", String(log.fps), "-i", join(dir, "frames", "f%05d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", join(assetsDir, "screen.mp4")]);
  // Rewind: 24 frames from the opening frame back to the start of the scene (0.8 s), with motion blur.
  const still = log.stills[film.hook.still];
  const firstBeat = log.beats[0];
  if (still === undefined || firstBeat === undefined) throw new Error(`The recording of ${film.id} has no opening frame or no sentences: record it again.`);
  const rewindDir = join(dir, "rewind");
  rmSync(rewindDir, { recursive: true, force: true });
  mkdirSync(rewindDir, { recursive: true });
  rewindFrames(firstBeat.f0, still).forEach((index, k) => {
    cpSync(getFramePath(dir, index), join(rewindDir, `r${String(k).padStart(5, "0")}.jpg`));
  });
  ff(["-framerate", String(log.fps), "-i", join(rewindDir, "r%05d.jpg"), "-vf", "tmix=frames=3", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", join(assetsDir, "rewind.mp4")]);
  cpSync(getFramePath(dir, still), join(assetsDir, "hook.jpg"));
  cpSync(getFramePath(dir, log.frames - 1), join(assetsDir, "last.jpg"));
  ff(["-i", input.voiceoverAudio, "-filter:a", `atempo=${film.voice.tempo}`, "-c:a", "libmp3lame", "-q:a", "2", join(assetsDir, "voiceover.mp3")]);
  cpSync(input.fontsDir, join(assetsDir, "fonts"), { recursive: true });
  cpSync(input.sfxDir, join(assetsDir, "sfx"), { recursive: true });
  // GSAP comes from its own npm package at render time; no third-party file ships inside this package.
  cpSync(require.resolve("gsap/dist/gsap.min.js"), join(assetsDir, "gsap.min.js"));

  const tokens = readSiteTokens(readFileSync(input.siteCss, "utf8"));
  const html = join(dir, "index.html");
  writeFileSync(
    html,
    composeFilm({
      film,
      log,
      voices: input.voices,
      tokens,
      assets: {
        screen: "assets/screen.mp4",
        rewind: "assets/rewind.mp4",
        hookStill: "assets/hook.jpg",
        lastFrame: "assets/last.jpg",
        voiceover: "assets/voiceover.mp3",
      },
      brandName: input.brandName,
      locale: input.locale,
      messages: input.messages,
    }),
  );
  return html;
}

/** Builds the composition and renders it with hyperframes. Returns the film's length in seconds. */
export function renderFilm(input: RenderInput): number {
  buildComposition(input);
  mkdirSync(join(input.output, ".."), { recursive: true });
  const result = runHyperframes(["render", "--quality", input.quality, "-o", input.output], { cwd: input.buildDir, stdio: "inherit" });
  if (result.error !== undefined) throw new Error(`hyperframes render did not start: ${result.error.message}.`);
  if (result.status !== 0) throw new Error(`hyperframes render ended with code ${String(result.status)} (signal ${result.signal ?? "-"}).`);
  return filmTimes(input.film, input.log, input.voices).end;
}
