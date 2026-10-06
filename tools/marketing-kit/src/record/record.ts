import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Locator } from "playwright";

import { fitScale, getGeometry, unionRect, type Rect } from "../compose/timeline.js";
import type { ColorTheme } from "../config/colors.js";
import { containsPhrase, sceneBeats, type CueName, type Director, type Film } from "../film.js";
import type { BeatVoice } from "../voice/voiceover.js";

/**
 * Recording of the real app **frame by frame**, with the page clock frozen.
 *
 * Why not a screen capture: `Page.startScreencast` always returns CSS pixels whatever the
 * `deviceScaleFactor`, too soft for a 1080 px frame (measured on FIRE's prototype). Here every frame
 * is a screenshot at the device's scale, and between screenshots the page clock (`page.clock`) and every
 * CSS animation move by 1/30 s (the clock in whole ms, without accumulating drift), so counters,
 * bars and fireworks come out smooth and the same on every recording.
 *
 * A phone records with touch (and, unless the device says otherwise, as a mobile browser); a desktop records as a
 * desktop browser and clicks with the mouse. Camera moves are sized from the layout the recording renders in: the 9:16
 * one for a phone (its scales serve every format) and the desktop one for a desktop.
 */

export const FPS = 30;
const DT = 1000 / FPS;
/** Limit of one scene action: longer means the app looks different from what the scene expects. */
const ACTION_TIMEOUT_MS = 5000;

export interface CameraCue {
  f: number;
  kind: "focus" | "wide";
  rect: Rect;
  scale: number;
  whoosh: boolean;
}

export interface RecordingLog {
  /** Voiceover key and scene sentences the recording was made with; the render refuses when the script differs. */
  voiceoverKey: string;
  beatIds: string[];
  fps: number;
  frames: number;
  beats: { id: string; f0: number; f1: number }[];
  taps: { f: number; x: number; y: number }[];
  keys: number[];
  camera: CameraCue[];
  marks: Record<string, { f: number } & Rect>;
  stills: Record<string, number>;
  cues: { f: number; name: CueName }[];
}

/** The screen guard: the screen did not show a phrase the voiceover says. */
export class ScreenGuardError extends Error {}

export interface RecordOptions {
  film: Film;
  url: string;
  /** Recording folder: `frames/` and `log.json`. */
  outDir: string;
  voices: BeatVoice[];
  voiceoverKey: string;
  /** The day the app counts from (`--today` or the video's `today`); the day of the run without one. */
  today?: string;
  /** The file that holds the scene (its module, or marketing.json for actions), named in errors that ask for a scene fix. */
  filmPath: string;
  /** A Chromium to use instead of Playwright's own (`PLAYWRIGHT_CHROMIUM_PATH`). */
  executablePath?: string;
  browser: BrowserSettings;
}

/** How the recording browser presents itself to the app, from `marketing.json`. */
export interface BrowserSettings {
  colorScheme: ColorTheme;
  /** BCP 47, e.g. `en-US`. */
  locale: string;
  /** IANA zone, e.g. `Europe/London`. */
  timezone: string;
  /** Elements hidden while recording (a dev overlay, a floating banner). */
  hideSelectors: string[];
  /** The element whose text the screen guard reads. */
  screenGuardSelector: string;
}

const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function recordFilm(options: RecordOptions): Promise<RecordingLog> {
  const { film, url, outDir, voices, filmPath, browser: settings } = options;
  const viewport = film.device.viewport;
  const isDesktop = film.device.kind === "desktop";
  const geometry = getGeometry(viewport, isDesktop ? "desktop" : "9:16");
  const framesDir = join(outDir, "frames");
  rmSync(framesDir, { recursive: true, force: true });
  // An old log next to new (or partial) frames would give a render with wrong times.
  rmSync(join(outDir, "log.json"), { force: true });
  mkdirSync(framesDir, { recursive: true });

  const voiceById = new Map(voices.map((voice) => [voice.id, voice]));
  const expectedBeats = sceneBeats(film).map((beat) => beat.id);
  const log: RecordingLog = {
    voiceoverKey: options.voiceoverKey,
    beatIds: expectedBeats,
    fps: FPS,
    frames: 0,
    beats: [],
    taps: [],
    keys: [],
    camera: [],
    marks: {},
    stills: {},
    cues: [],
  };

  const browser = await chromium.launch(options.executablePath === undefined ? {} : { executablePath: options.executablePath });
  try {
    const context = await browser.newContext({
      viewport: { ...viewport },
      deviceScaleFactor: film.device.scale,
      isMobile: film.device.kind === "phone" && film.device.isMobile,
      hasTouch: !isDesktop,
      colorScheme: settings.colorScheme,
      locale: settings.locale,
      timezoneId: settings.timezone,
    });
    const page = await context.newPage();
    // Limit of every Playwright action: taps, typing and reading the screen too.
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    // Noon UTC is the same calendar day in every zone from UTC-11 to UTC+11.
    const start = options.today === undefined ? new Date() : new Date(`${options.today}T12:00:00Z`);
    await page.clock.install({ time: start });
    await page.goto(url, { waitUntil: "networkidle" });
    // While recording: the configured elements hidden (a dev indicator, a floating banner that covers
    // the screen); instant scrolling, because the browser's "smooth" runs in real time. One tag per
    // selector, so a selector the browser cannot parse (an unclosed quote) drops only its own rule.
    for (const content of [...settings.hideSelectors.map((selector) => `${selector}{display:none!important}`), "html{scroll-behavior:auto!important}"]) {
      await page.addStyleTag({ content });
    }
    await page.evaluate(() => document.fonts.ready);
    // A slow load (a fresh next dev) can pass a fixed "+5 s" and then pauseAt throws "Cannot
    // fast-forward to the past", so the pause counts from the page's time.
    const pageNow = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(new Date(pageNow + 1000));
    // CSS animations: paused and set by hand to "now - the moment they appeared". Scroll-driven
    // animations (timeline !== document.timeline) stay with the browser: `currentTime` in ms throws
    // for progress-based animations.
    await page.evaluate(() => {
      const seen = new WeakMap<Animation, number>();
      (window as unknown as { __syncAnimations: (now: number) => void }).__syncAnimations = (now) => {
        for (const animation of document.getAnimations()) {
          if (animation.timeline !== document.timeline) continue;
          if (!seen.has(animation)) seen.set(animation, now);
          animation.pause();
          animation.currentTime = now - (seen.get(animation) ?? now);
        }
      };
    });

    let virtualMs = 0;
    let frame = 0;
    let current: { id: string; f0: number } | null = null;
    let guardChecked = false;

    const where = (): string => (current === null ? "before the first sentence" : `sentence "${current.id}"`);
    const failLocator = (target: Locator, error: unknown): never => {
      // Playwright's strict mode: the locator found several elements, not none.
      if (String(error).includes("strict mode violation")) {
        throw new Error(
          `${where()}: ${String(target)} matches more than one element; pick one with nth or narrow the locator. ` +
            `Fix the scene: ${filmPath} (${String(error).split("\n")[0]})`,
        );
      }
      throw new Error(
        `${where()}: ${String(target)} did not appear within ${ACTION_TIMEOUT_MS / 1000} s. Did the app change? ` +
          `Fix the scene: ${filmPath} (${String(error).split("\n")[0]})`,
      );
    };

    async function shoot(): Promise<void> {
      // Playwright rounds runFor up (33.33 -> 34 ms, +2%); a step in whole ms counted from the start
      // keeps the page clock level with the frames.
      await page.clock.runFor(Math.round((frame + 1) * DT) - Math.round(frame * DT));
      virtualMs = Math.round((frame + 1) * DT);
      await page.evaluate(
        (now) => (window as unknown as { __syncAnimations: (n: number) => void }).__syncAnimations(now),
        virtualMs,
      );
      await page.screenshot({
        path: join(framesDir, `f${String(frame).padStart(5, "0")}.jpg`),
        type: "jpeg",
        quality: 93,
      });
      frame += 1;
    }

    async function hold(seconds: number): Promise<void> {
      for (let i = 0, count = Math.round(seconds * FPS); i < count; i += 1) await shoot();
    }

    async function rectOf(target: Locator): Promise<Rect> {
      try {
        // "visible", not "attached": a hidden element has a 0×0 rectangle and a tap would miss.
        await target.waitFor({ state: "visible", timeout: ACTION_TIMEOUT_MS });
      } catch (error) {
        failLocator(target, error);
      }
      return target.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, w: box.width, h: box.height };
      });
    }

    async function rectOfAll(targets: Locator | Locator[]): Promise<Rect> {
      const list = Array.isArray(targets) ? targets : [targets];
      return unionRect(await Promise.all(list.map(rectOf)));
    }

    async function scrollTo(y: number, seconds: number): Promise<void> {
      const from = await page.evaluate(() => window.scrollY);
      const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      const to = Math.max(0, Math.min(max, Math.round(y)));
      if (Math.abs(to - from) < 2) return;
      const steps = Math.max(1, Math.round(seconds * FPS));
      for (let i = 1; i <= steps; i += 1) {
        await page.evaluate((value) => window.scrollTo(0, value), from + (to - from) * ease(i / steps));
        await shoot();
      }
    }

    async function bring(target: Locator, top = 140, seconds = 0.5): Promise<void> {
      const rect = await rectOf(target);
      const scrollY = await page.evaluate(() => window.scrollY);
      await scrollTo(scrollY + rect.y - top, seconds);
    }

    /** Tap only a visible point: off screen a touch (or a click) hits nothing. */
    async function ensureVisible(target: Locator): Promise<void> {
      const rect = await rectOf(target);
      if (rect.y < 70 || rect.y + rect.h > viewport.height - 40) await bring(target, 180, 0.45);
    }

    const director: Director = {
      page,

      async beat(id, actions, beatOptions) {
        const expected = expectedBeats[log.beats.length];
        if (id !== expected) {
          throw new Error(
            `The scene records sentence "${id}" and the script expects "${expected ?? "(end)"}": check the order in ${filmPath}.`,
          );
        }
        const voice = voiceById.get(id);
        if (voice === undefined) throw new Error(`No voiceover for sentence "${id}".`);
        current = { id, f0: frame };
        await actions();
        const minFrames = Math.round((voice.end - voice.start + (beatOptions?.pad ?? 0.35)) * FPS);
        const missing = minFrames - (frame - current.f0);
        if (missing > 0) await hold(missing / FPS);
        log.beats.push({ id, f0: current.f0, f1: frame });
      },

      async until(word) {
        if (current === null) throw new Error(`until("${word}") outside a sentence.`);
        const voice = voiceById.get(current.id);
        const spoken = voice?.words.find((w) => w.text.replace(/[.,?!:;]/g, "") === word);
        if (spoken === undefined) {
          throw new Error(`Sentence "${current.id}" has no word "${word}": the scene waits for something the voiceover does not say.`);
        }
        const missing = current.f0 + Math.round(spoken.start * FPS) - frame;
        if (missing > 0) await hold(missing / FPS);
      },

      hold,

      async bring(target, bringOptions) {
        await bring(target, bringOptions?.top ?? 140, bringOptions?.seconds ?? 0.5);
      },

      async tap(target, tapOptions) {
        await ensureVisible(target);
        const rect = await rectOf(target);
        const x = rect.x + rect.w / 2;
        const y = rect.y + rect.h / 2;
        log.taps.push({ f: frame, x, y });
        if (isDesktop) await page.mouse.click(x, y);
        else await page.touchscreen.tap(x, y);
        await hold(tapOptions?.after ?? 0.35);
      },

      async type(text, typeOptions) {
        for (const character of text) {
          log.keys.push(frame);
          await page.keyboard.type(character);
          await hold(typeOptions?.perChar ?? 0.13);
        }
      },

      async fill(name, value) {
        const input = page.locator(`input[name=${name}]`);
        await ensureVisible(input);
        const rect = await rectOf(input);
        // A desktop field can span the page: zoom only as far as it still fits the frame.
        const scale = isDesktop ? Math.min(1.55, fitScale(geometry, rect)) : 1.55;
        log.camera.push({ f: frame, kind: "focus", rect, scale, whoosh: false });
        await director.tap(input, { after: 0.2 });
        await director.type(value);
      },

      async blur() {
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      },

      async focus(target, focusOptions) {
        const rect = await rectOfAll(target);
        if (focusOptions?.height !== undefined) rect.h = focusOptions.height;
        log.camera.push({ f: frame, kind: "focus", rect, scale: focusOptions?.scale ?? fitScale(geometry, rect), whoosh: false });
      },

      wide(wideOptions) {
        log.camera.push({
          f: frame,
          kind: "wide",
          rect: { x: 0, y: 0, w: viewport.width, h: viewport.height },
          scale: wideOptions?.scale ?? 1,
          whoosh: wideOptions?.whoosh ?? false,
        });
        return Promise.resolve();
      },

      async mark(name, target) {
        log.marks[name] = { f: frame, ...(await rectOfAll(target)) };
      },

      still(name) {
        log.stills[name] = frame;
        return Promise.resolve();
      },

      cue(name) {
        log.cues.push({ f: frame, name });
        return Promise.resolve();
      },

      async checkScreen() {
        const text = (await page.locator(settings.screenGuardSelector).first().innerText()).replace(/\s+/g, " ");
        const missing = film.screenGuard.filter((phrase) => !containsPhrase(text, phrase));
        if (missing.length > 0) {
          throw new ScreenGuardError(
            `The screen does not say what the voiceover says: missing ${missing.map((p) => `"${p}"`).join(", ")}. ` +
              `The app counts from the recording day: if the voiceover was paid for on another day, pin that day in the video's ` +
              `"today" (or pass --today=YYYY-MM-DD); otherwise fix the sentences and phrases in ${filmPath}.`,
          );
        }
        guardChecked = true;
      },
    };

    await hold(0.2);
    await film.scene(director);

    if (log.beats.length !== expectedBeats.length) {
      throw new Error(
        `The scene recorded ${log.beats.length} of ${expectedBeats.length} sentences; "${expectedBeats[log.beats.length]}" is missing.`,
      );
    }
    if (!guardChecked) throw new Error("The scene never called checkScreen(): a film without the screen guard could say what the screen does not show.");
    if (log.stills[film.hook.still] === undefined) {
      throw new Error(`The scene did not save the opening frame "${film.hook.still}" (still).`);
    }
    for (const shot of film.hook.shots) {
      if (log.marks[shot.mark] === undefined) throw new Error(`No mark "${shot.mark}" for the opening shot.`);
    }

    log.frames = frame;
    writeFileSync(join(outDir, "log.json"), `${JSON.stringify(log, null, 1)}\n`);
    return log;
  } finally {
    await browser.close();
  }
}

