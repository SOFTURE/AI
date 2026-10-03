import type { Film } from "../film.js";
import { formatMessage, type MarketingLocale, type MarketingMessages } from "../messages/index.js";
import type { RecordingLog } from "../record/record.js";
import type { SiteTokens } from "./site-tokens.js";
import {
  FRAME,
  SCREEN,
  SCREEN_HEIGHT,
  SCREEN_SCALE,
  cameraPose,
  captionChunks,
  widePose,
  type CameraPose,
} from "./timeline.js";
import type { BeatVoice } from "../voice/voiceover.js";

/**
 * HyperFrames composition from the recording: the phone with the real screen, a camera that follows
 * the thumb, a touch marker, captions in one place, the persona card, an opening from the result
 * frame with a rewind, the end card and sounds.
 *
 * HyperFrames 0.8.85 contract: a root with `data-composition-id`, clips with
 * `data-start`/`data-duration`, `<audio>` with an `id`, a GSAP timeline `{ paused: true }` under
 * `window.__timelines[<id>]`. Tweens that set the start state have `immediateRender: false`;
 * without it the rings of every tap show from the first frame (measured on the prototype preview).
 */

const COMPOSITION_ID = "film";
/** Pause before the first word of the opening. */
const HOOK_LEAD = 0.3;
const HOOK_MIN = 3.8;
const REWIND = 0.8;
const END_TAIL = 1.6;
/** The end card enters this long after the start of the last sentence. */
const END_CARD_DELAY = 0.9;
/** Green of the spoken word in a caption: darker than `--accessible`, because it sits on a light pill. */
const CAPTION_HIGHLIGHT = "#059669";

export interface ComposeAssets {
  /** Screen recording (mp4 from frames), the rewind clip, the opening frame, the last frame, the tempo-shifted voiceover. */
  screen: string;
  rewind: string;
  hookStill: string;
  lastFrame: string;
  voiceover: string;
}

export interface ComposeInput {
  film: Film;
  log: RecordingLog;
  voices: BeatVoice[];
  tokens: SiteTokens;
  assets: ComposeAssets;
  /** The brand name on the end card. */
  brandName: string;
  /** The composition's language and its copy (the persona card). */
  locale: MarketingLocale;
  messages: MarketingMessages;
}

export interface CameraTween {
  t: number;
  pose: CameraPose;
  dur: number;
  ease: string;
}

export interface ResolvedTween extends CameraTween {
  from: CameraPose;
}

/** A shorter camera move is not a move but a jerk, so it is dropped. */
const MIN_TWEEN = 0.15;

/**
 * Camera moves without overlaps and with an explicit start point.
 *
 * `tl.to` takes its start state lazily, at the first render; with overlapping moves the preview
 * (linear) and the render (jumps, several processes) can start from different places. Here: moves
 * sorted (on an equal start the later entry wins), each one cut to the start of the next, a too
 * short one dropped, and each gets `from` = the pose the previous one ended on.
 */
export function resolveCameraTweens(tweens: CameraTween[]): ResolvedTween[] {
  const sorted = tweens.map((tween, index) => ({ tween, index })).sort((a, b) => a.tween.t - b.tween.t || a.index - b.index);
  const deduped: CameraTween[] = [];
  for (const { tween } of sorted) {
    if (deduped.at(-1)?.t === tween.t) deduped.pop();
    deduped.push({ ...tween });
  }
  const kept: CameraTween[] = [];
  deduped.forEach((tween, i) => {
    const next = deduped[i + 1];
    if (next !== undefined && tween.t + tween.dur > next.t) tween.dur = r3(next.t - tween.t);
    if (tween.dur > 0 && tween.dur < MIN_TWEEN) return;
    kept.push(tween);
  });
  const resolved: ResolvedTween[] = [];
  for (const tween of kept) {
    const from = resolved.at(-1)?.pose ?? tween.pose;
    resolved.push({ ...tween, from });
  }
  return resolved;
}

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/** The opening sentence; `validateFilm` guarantees a film has one. */
function getHookBeat(film: Film): Film["beats"][number] {
  const beat = film.beats[0];
  if (beat === undefined) throw new Error(`Film ${film.id} has no sentences.`);
  return beat;
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** The film's timeline derived from the recording and the voiceover: one place for every time. */
export function filmTimes(film: Film, log: RecordingLog, voices: BeatVoice[]) {
  const voice = new Map(voices.map((v) => [v.id, v]));
  const hookBeat = getHookBeat(film);
  const hookVoice = voice.get(hookBeat.id);
  if (hookVoice === undefined) throw new Error("No voiceover for the opening sentence.");
  const hook = r3(Math.max(HOOK_MIN, HOOK_LEAD + (hookVoice.end - hookVoice.start) + 0.1));
  const firstBeat = log.beats[0];
  const last = log.beats.at(-1);
  if (firstBeat === undefined || last === undefined) throw new Error("The recording has no sentences: record the film again (softure-marketing record).");
  const firstFrame = firstBeat.f0;
  const offset = hook + REWIND - firstFrame / log.fps;
  const at = (frame: number): number => r3(frame / log.fps + offset);
  const lastVoice = voice.get(last.id);
  if (lastVoice === undefined) throw new Error(`No voiceover for sentence "${last.id}".`);
  const endCard = r3(at(last.f0) + END_CARD_DELAY);
  const end = r3(at(last.f0) + (lastVoice.end - lastVoice.start) + END_TAIL);
  const voiceStart: Record<string, number> = { [hookBeat.id]: HOOK_LEAD };
  for (const beat of log.beats) voiceStart[beat.id] = at(beat.f0);
  const unplaced = film.beats.filter((beat) => voiceStart[beat.id] === undefined).map((beat) => beat.id);
  if (unplaced.length > 0) {
    throw new Error(`The recording has no sentences ${unplaced.join(", ")}: record the film again (softure-marketing record).`);
  }
  return { hook, rewind: REWIND, firstFrame, at, endCard, end, screenEnd: at(log.frames), voiceStart };
}

export function composeFilm(input: ComposeInput): string {
  const { film, log, voices, tokens, assets, brandName, locale, messages } = input;
  const times = filmTimes(film, log, voices);
  const { at } = times;
  // `filmTimes` refuses a recording that leaves any sentence without a start.
  const startOf = (id: string): number => times.voiceStart[id] as number;
  const voice = new Map(voices.map((v) => [v.id, v]));
  const hookVoice = voice.get(getHookBeat(film).id);
  if (hookVoice === undefined) throw new Error("No voiceover for the opening sentence.");

  if (!/^#[0-9a-f]{6}$/i.test(tokens.background)) {
    // The vignette appends an alpha channel ("cc"), which works only on #rrggbb.
    throw new Error(`Background colour ${tokens.background} must have the form #rrggbb.`);
  }

  // --- Camera ---
  const camera: CameraTween[] = [];
  film.hook.shots.forEach((shot, index) => {
    const mark = log.marks[shot.mark];
    if (mark === undefined) throw new Error(`No mark "${shot.mark}" for the opening shot: record the film again (softure-marketing record).`);
    const pose = cameraPose(mark, shot.scale);
    if (index === 0) {
      camera.push({ t: 0, pose, dur: 0, ease: "none" });
      camera.push({ t: 0.2, pose: cameraPose(mark, r3(shot.scale * 0.93)), dur: 1.3, ease: "sine.inOut" });
      return;
    }
    const word = hookVoice.words.find((w) => w.text.replace(/[.,?!:;]/g, "") === shot.word);
    if (word === undefined) {
      throw new Error(`Opening shot "${shot.mark}" waits for the word "${shot.word ?? ""}", which the voiceover does not say.`);
    }
    camera.push({ t: r3(HOOK_LEAD + word.start - 0.1), pose, dur: 1.1, ease: "power3.inOut" });
  });
  camera.push({ t: r3(times.hook - 1.05), pose: widePose(1), dur: 0.9, ease: "power3.inOut" });
  for (const cue of log.camera) {
    if (cue.kind === "wide") {
      camera.push({ t: r3(at(cue.f) - 0.1), pose: widePose(cue.scale), dur: 0.5, ease: "power3.inOut" });
    } else {
      camera.push({ t: r3(at(cue.f) - 0.3), pose: cameraPose(cue.rect, cue.scale), dur: 0.6, ease: "power3.inOut" });
    }
  }
  const endScale = 0.58;
  camera.push({
    t: times.endCard,
    pose: {
      scale: endScale,
      x: r3(FRAME.width / 2 - endScale * (SCREEN.left + SCREEN.width / 2)),
      y: r3(640 - endScale * (SCREEN.top + SCREEN_HEIGHT / 2)),
    },
    dur: 0.9,
    ease: "power3.inOut",
  });
  const cameraPlan = resolveCameraTweens(camera);

  // --- Taps ---
  const taps = log.taps.map((tap, i) => ({ i, t: at(tap.f), x: r3(tap.x * SCREEN_SCALE), y: r3(tap.y * SCREEN_SCALE) }));

  // --- Captions: every sentence but the last (the end card says the same) ---
  const lastId = film.beats.at(-1)?.id;
  const caption = film.beats
    .filter((beat) => beat.id !== lastId)
    .flatMap((beat) => {
      const v = voice.get(beat.id);
      if (v === undefined) return [];
      const base = startOf(beat.id);
      return captionChunks(v.words).map((chunk) => ({
        words: chunk.words.map((w) => ({ text: w.text, t: r3(base + w.start) })),
        start: r3(base + chunk.start),
        end: r3(base + chunk.end),
      }));
    });
  const captionHtml = caption
    .map((chunk, i) => {
      const next = caption[i + 1];
      const start = r3(chunk.start - 0.05);
      const stop = Math.min(chunk.end + 0.35, next === undefined ? times.end : next.start - 0.06);
      const words = chunk.words.map((w, j) => `<span id="cw${i}_${j}">${escapeHtml(w.text)}</span>`).join(" ");
      return `<div id="cap${i}" class="clip caption" data-start="${start}" data-duration="${r3(stop - start)}"><p class="pill">${words}</p></div>`;
    })
    .join("\n  ");

  // --- Sound ---
  const sfx: { src: string; t: number; volume: number; dur: number }[] = [];
  for (const tap of taps) sfx.push({ src: "click-soft.mp3", t: tap.t, volume: 0.55, dur: 0.37 });
  for (const key of log.keys) sfx.push({ src: "key-press.mp3", t: at(key), volume: 0.22, dur: 0.4 });
  for (const cue of log.camera) if (cue.whoosh) sfx.push({ src: "whoosh.mp3", t: at(cue.f), volume: 0.22, dur: 0.57 });
  for (const cue of log.cues) if (cue.name === "sparkle") sfx.push({ src: "sparkle.mp3", t: at(cue.f), volume: 0.5, dur: 1.8 });
  sfx.push({ src: "whoosh.mp3", t: r3(times.hook - 0.1), volume: 0.5, dur: 0.57 });
  sfx.push({ src: "whoosh.mp3", t: times.endCard, volume: 0.3, dur: 0.57 });
  sfx.push({ src: "pop.mp3", t: r3(times.endCard + 0.9), volume: 0.35, dur: 0.72 });

  const voiceHtml = film.beats
    .map((beat, index) => {
      const v = voice.get(beat.id);
      if (v === undefined) throw new Error(`No voiceover for sentence "${beat.id}".`);
      const start = startOf(beat.id);
      const next = film.beats[index + 1];
      // A 0.25 s tail, but not past the next sentence; otherwise its start would play twice
      // (a sentence with pad 0).
      const limit = next === undefined ? Infinity : startOf(next.id) - start - 0.02;
      const duration = Math.min(v.end - v.start + 0.25, limit);
      return `<audio id="vo-${beat.id}" src="${assets.voiceover}" data-start="${r3(start)}" data-media-start="${r3(Math.max(0, v.start - 0.05))}" data-duration="${r3(duration)}" data-volume="1"></audio>`;
    })
    .join("\n  ");
  const sfxHtml = sfx
    .map((s, i) => `<audio id="sfx${i}" src="assets/sfx/${s.src}" data-start="${r3(s.t)}" data-duration="${s.dur}" data-volume="${s.volume}"></audio>`)
    .join("\n  ");

  const personaOut = log.cues.find((cue) => cue.name === "persona-out");
  const screenStart = r3(times.hook + times.rewind);
  const screenDuration = r3(times.screenEnd - screenStart);
  const tail = r3(Math.max(0.04, times.end - times.screenEnd));
  const c = tokens;
  // The plan always starts with the first opening shot at t = 0.
  const firstPose = (cameraPlan[0] as ResolvedTween).pose;

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${FRAME.width}, height=${FRAME.height}" />
<title>${escapeHtml(film.title)}</title>
<script src="assets/gsap.min.js"></script>
<style>
@font-face{font-family:"Geist";src:url("assets/fonts/geist-latin-wght-normal.woff2") format("woff2");font-weight:100 900;unicode-range:U+0000-00FF,U+2000-206F,U+20AC}
@font-face{font-family:"Geist";src:url("assets/fonts/geist-latin-ext-wght-normal.woff2") format("woff2");font-weight:100 900;unicode-range:U+0100-02AF,U+1E00-1EFF}
@font-face{font-family:"Newsreader";src:url("assets/fonts/newsreader-latin-wght-normal.woff2") format("woff2");font-weight:200 800;unicode-range:U+0000-00FF,U+2000-206F,U+20AC}
@font-face{font-family:"Newsreader";src:url("assets/fonts/newsreader-latin-ext-wght-normal.woff2") format("woff2");font-weight:200 800;unicode-range:U+0100-02AF,U+1E00-1EFF}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${FRAME.width}px;height:${FRAME.height}px;overflow:hidden;background:${c.background}}
#root{position:relative;width:${FRAME.width}px;height:${FRAME.height}px;overflow:hidden;background:${c.background};font-family:Geist,sans-serif;color:${c.foreground}}
.backdrop{position:absolute;inset:0;overflow:hidden}
.blur{position:absolute;left:-15%;top:-10%;width:130%;height:120%;object-fit:cover;filter:blur(70px) saturate(1.4);opacity:.38}
.vignette{position:absolute;inset:0;background:radial-gradient(90% 60% at 50% 45%, transparent 0%, ${c.background}cc 70%, ${c.background} 100%)}
#camera{position:absolute;left:0;top:0;width:${FRAME.width}px;height:${FRAME.height}px;transform-origin:0 0}
.phone{position:absolute;left:${SCREEN.left - 14}px;top:${SCREEN.top - 14}px;width:${SCREEN.width + 28}px;height:${SCREEN_HEIGHT + 28}px;border-radius:66px;background:linear-gradient(160deg,#2a3441,#0e131a 40%,#1b232d);box-shadow:0 0 0 2px #3a4655 inset,0 60px 140px rgba(0,0,0,.65),0 0 0 1px #05070a}
.screen{position:absolute;left:14px;top:14px;width:${SCREEN.width}px;height:${SCREEN_HEIGHT}px;border-radius:52px;overflow:hidden;background:${c.background}}
.screen img,.screen video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.touch{position:absolute;width:0;height:0}
.touch .dot{position:absolute;left:-34px;top:-34px;width:68px;height:68px;border-radius:50%;background:rgba(232,238,245,.34);border:2px solid rgba(232,238,245,.75);opacity:0}
.touch .ring{position:absolute;left:-34px;top:-34px;width:68px;height:68px;border-radius:50%;border:3px solid ${c.accent};opacity:0}
.caption{position:absolute;left:60px;right:60px;top:1470px;display:flex;justify-content:center}
.pill{font-weight:650;font-size:50px;line-height:1.18;letter-spacing:-.01em;text-align:center;padding:16px 28px;border-radius:22px;background:rgba(236,241,247,.97);box-shadow:0 14px 44px rgba(0,0,0,.5);color:${c.background}}
.pill span{display:inline-block}
.persona{position:absolute;left:0;right:0;top:78px;display:flex;justify-content:center}
.persona .card{display:flex;align-items:center;gap:20px;padding:14px 30px 14px 14px;border-radius:999px;background:rgba(19,26,35,.9);border:1px solid rgba(130,150,173,.28)}
.avatar{width:66px;height:66px;border-radius:50%;display:grid;place-items:center;font-family:Newsreader,serif;font-size:38px;font-weight:600;color:${c.background};background:linear-gradient(135deg,${c.accessible},${c.accent})}
.persona b{display:block;font-size:34px;font-weight:650}
.persona span{display:block;font-size:25px;color:${c.muted};margin-top:2px}
.endcard{position:absolute;left:0;right:0;top:1180px;text-align:center}
.brand{display:flex;justify-content:center;align-items:center;gap:18px;font-family:Newsreader,serif;font-size:46px}
.headline{font-family:Newsreader,serif;font-weight:500;font-size:96px;letter-spacing:-.025em;line-height:1.02;margin-top:44px}
.url{display:inline-block;margin-top:40px;padding:20px 38px;border-radius:999px;font-size:44px;font-weight:600;color:${c.background};background:${c.accessible}}
.note{margin-top:26px;font-size:30px;color:${c.muted}}
</style>
</head>
<body>
<div id="root" data-composition-id="${COMPOSITION_ID}" data-start="0" data-duration="${times.end}" data-width="${FRAME.width}" data-height="${FRAME.height}">
  <div class="backdrop">
    <img id="bg-hook" class="clip blur" src="${assets.hookStill}" data-start="0" data-duration="${screenStart}" />
    <video id="bg-screen" class="clip blur" src="${assets.screen}" data-start="${screenStart}" data-media-start="${r3(times.firstFrame / log.fps)}" data-duration="${screenDuration}" muted playsinline></video>
    <img id="bg-last" class="clip blur" src="${assets.lastFrame}" data-start="${times.screenEnd}" data-duration="${tail}" />
    <div class="vignette"></div>
  </div>
  <div id="camera">
    <div class="phone">
      <div class="screen">
        <img id="hook" class="clip" src="${assets.hookStill}" data-start="0" data-duration="${times.hook}" />
        <video id="rewind" class="clip" src="${assets.rewind}" data-start="${times.hook}" data-duration="${times.rewind}" muted playsinline></video>
        <video id="recording" class="clip" src="${assets.screen}" data-start="${screenStart}" data-media-start="${r3(times.firstFrame / log.fps)}" data-duration="${screenDuration}" muted playsinline></video>
        <img id="last" class="clip" src="${assets.lastFrame}" data-start="${times.screenEnd}" data-duration="${tail}" />
        ${taps.map((tap) => `<div class="touch" style="left:${tap.x}px;top:${tap.y}px"><div class="dot" id="td${tap.i}"></div><div class="ring" id="tr${tap.i}"></div></div>`).join("\n        ")}
      </div>
    </div>
  </div>
  <div class="persona"><div class="card" id="persona"><div class="avatar">${escapeHtml(film.persona.name.slice(0, 1))}</div><div><b>${escapeHtml(formatMessage(messages.film.persona, { name: film.persona.name, age: film.persona.age }))}</b><span>${escapeHtml(film.persona.tagline)}</span></div></div></div>
  ${captionHtml}
  <div class="endcard">
    <div class="brand" id="ec-brand"><svg viewBox="0 0 40 26" width="92" height="60"><defs><linearGradient id="arc" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${c.locked}"/><stop offset="48%" stop-color="${c.locked}"/><stop offset="100%" stop-color="${c.accessible}"/></linearGradient></defs><path d="M2 23C2 12.5 8 4 20 4s18 8.5 18 19" fill="none" stroke="url(#arc)" stroke-width="2.4" stroke-linecap="round"/><path d="M2 21v3.5M38 21v3.5" stroke="${c.muted}" stroke-width="2.4" stroke-linecap="round" opacity=".42"/><circle cx="20" cy="4" r="4" fill="${c.background}"/><circle cx="20" cy="4" r="2.6" fill="${c.accessible}"/></svg><span>${escapeHtml(brandName)}</span></div>
    <p class="headline" id="ec-headline">${escapeHtml(film.endCard.headline)}</p>
    <p class="url" id="ec-url">${escapeHtml(film.endCard.url)}</p>
    <p class="note" id="ec-note">${escapeHtml(film.endCard.note)}</p>
  </div>
  ${voiceHtml}
  ${sfxHtml}
</div>
<script>
const tl = gsap.timeline({ paused: true });
const camera = ${JSON.stringify(cameraPlan)};
gsap.set("#camera", { scale: ${firstPose.scale}, x: ${firstPose.x}, y: ${firstPose.y} });
for (const c of camera) if (c.dur > 0) tl.fromTo("#camera", { scale: c.from.scale, x: c.from.x, y: c.from.y }, { scale: c.pose.scale, x: c.pose.x, y: c.pose.y, duration: c.dur, ease: c.ease, immediateRender: false }, c.t);
for (const t of ${JSON.stringify(taps.map((tap) => ({ i: tap.i, t: tap.t })))}) {
  tl.fromTo("#td" + t.i, { opacity: 0, scale: 1.45 }, { opacity: 1, scale: 1, duration: 0.14, ease: "power2.out", immediateRender: false }, t.t - 0.16);
  tl.to("#td" + t.i, { scale: 0.82, duration: 0.07, ease: "power2.in" }, t.t - 0.02);
  tl.to("#td" + t.i, { scale: 1, opacity: 0, duration: 0.3, ease: "power2.out" }, t.t + 0.06);
  tl.fromTo("#tr" + t.i, { opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 2.3, duration: 0.5, ease: "power3.out", immediateRender: false }, t.t);
}
const captions = ${JSON.stringify(caption.map((chunk) => chunk.words.map((w) => w.t)))};
captions.forEach((words, i) => {
  tl.fromTo("#cap" + i + " .pill", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.16, ease: "power3.out" }, words[0] - 0.05);
  words.forEach((t, j) => tl.fromTo("#cw" + i + "_" + j, { color: "${c.background}" }, { color: "${CAPTION_HIGHLIGHT}", duration: 0.06, immediateRender: false }, t).to("#cw" + i + "_" + j, { color: "${c.background}", duration: 0.2 }, t + 0.32));
});
tl.fromTo("#persona", { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${r3(screenStart + 0.05)});
tl.to("#persona", { y: -30, opacity: 0, duration: 0.35, ease: "power2.in" }, ${personaOut === undefined ? times.endCard : r3(at(personaOut.f) - 0.1)});
tl.fromTo("#ec-brand", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${r3(times.endCard + 0.35)});
tl.fromTo("#ec-headline", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, ${r3(times.endCard + 0.5)});
tl.fromTo("#ec-url", { y: 30, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "power3.out" }, ${r3(times.endCard + 0.9)});
tl.fromTo("#ec-note", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, ${r3(times.endCard + 1.3)});
tl.set({}, {}, ${times.end});
window.__timelines = window.__timelines || {};
window.__timelines["${COMPOSITION_ID}"] = tl;
</script>
</body>
</html>
`;
}
