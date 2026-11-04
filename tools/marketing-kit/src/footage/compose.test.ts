import { describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { composeFootage, getFootageFilmSeconds, getSegmentScales, getSegmentZoomEases, type FootageComposeInput } from "./compose.js";
import type { Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";

const COLORS = {
  background: "#0c0c0d",
  foreground: "#f2f3f5",
  muted: "#a3a6ad",
  accent: "#cff26b",
  cta: "#2dd4bf",
  onCta: "#0c0c0d",
  captionBackground: "#ecf1f7",
  captionText: "#0c0c0d",
  captionHighlight: "#059669",
};

const film: FootageFilm = {
  id: "street",
  title: "Street <test>",
  format: "9:16",
  language: "pl",
  clips: [],
  isolateVoice: false,
  cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
  transitions: DEFAULT_TRANSITIONS,
  music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
  captions: true,
  endCard: { headline: "Try it", url: "example.com", note: "" },
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

function input(changes: Partial<FootageComposeInput> = {}): FootageComposeInput {
  return {
    film,
    edl,
    words: [
      { text: "Hello,", start: 0.1, end: 0.5 },
      { text: "to", start: 0.6, end: 0.8 },
    ],
    frame: LAYOUTS["9:16"].frame,
    caption: LAYOUTS["9:16"].caption,
    headlineSize: 96,
    colors: COLORS,
    fonts: { heading: null, body: null },
    assets: { clips: { talk: "clips/talk.mp4", street: "clips/street.mp4" }, speech: "assets/speech.mp3", music: "assets/music.mp3", lastFrame: "assets/last.jpg", logo: null, sfx: { whoosh: "assets/sfx/whoosh.mp3", pop: "assets/sfx/pop.mp3" } },
    brandName: "Acme",
    locale: "pl-PL",
    ...changes,
  };
}

describe("composeFootage", () => {
  const html = composeFootage(input());

  it("places one video clip per segment at its film time and media start", () => {
    expect(html).toContain('<video id="seg0" class="clip shot" src="clips/talk.mp4" data-start="0" data-media-start="0.5" data-duration="2" muted playsinline></video>');
    expect(html).toContain('<video id="seg4" class="clip shot" src="clips/talk.mp4" data-start="7" data-media-start="7" data-duration="1" muted playsinline></video>');
  });

  it("plays the segment before a fade on under the incoming one and fades that one in", () => {
    expect(html).toContain('id="seg2" class="clip shot" src="clips/talk.mp4" data-start="3" data-media-start="5" data-duration="1.333"');
    expect(html).toContain('tl.fromTo("#seg3", { opacity: 0 }, { opacity: 1, duration: 0.333, ease: "none", immediateRender: false }, 4);');
    const slow = composeFootage(input({ film: { ...film, edit: { fadeFrames: 15 } } }));
    expect(slow).toContain('{ opacity: 1, duration: 0.5, ease: "none", immediateRender: false }, 4);');
  });

  it("punches in by zoomPercent and back out on alternate jump cuts, and zooms slowly over a kenburns segment", () => {
    expect(getSegmentScales(edl)).toEqual([1, 1.08, 1, 1, 1]);
    expect(getSegmentScales(edl, 110)).toEqual([1, 1.1, 1, 1, 1]);
    expect(html).toContain('data-duration="1" style="transform:scale(1.08)"');
    // A segment marked by hand zooms 4 % when the film sets no Ken Burns; the film's own percentage wins.
    expect(html).toContain('tl.fromTo("#seg3", { scale: 1 }, { scale: 1.04, duration: 3, ease: "none", immediateRender: false }, 4);');
    const wide = composeFootage(input({ film: { ...film, edit: { kenBurnsPercent: 2 } } }));
    expect(wide).toContain('{ scale: 1.02, duration: 3, ease: "none", immediateRender: false }, 4);');
  });

  it("steps straight to a zoom cut's scale by default", () => {
    expect(getSegmentZoomEases(edl, { zoomPercent: 108, zoomEaseFrames: 0 })).toEqual([0, 0, 0, 0, 0]);
    expect(html).not.toContain("power1.out");
  });

  it("eases a zoom cut in and back out over zoomEaseFrames, from the scale on screen before the cut", () => {
    const eased = composeFootage(input({ film: { ...film, edit: { zoomEaseFrames: 4 } } }));
    expect(getSegmentZoomEases(edl, { zoomPercent: 108, zoomEaseFrames: 4 })).toEqual([0, 4, 4, 0, 0]);
    expect(eased).toContain('tl.fromTo("#seg1", { scale: 1 }, { scale: 1.08, duration: 0.133, ease: "power1.out", immediateRender: false }, 2);');
    expect(eased).toContain('tl.fromTo("#seg2", { scale: 1.08 }, { scale: 1, duration: 0.133, ease: "power1.out", immediateRender: false }, 3);');
    // The segment rests at its scale once the ease is over.
    expect(eased).toContain('data-duration="1" style="transform:scale(1.08)"');
  });

  it("never eases longer than the segment, nor a kenburns segment, nor the first one", () => {
    const short: Edl = {
      ...edl,
      segments: [
        { id: "g1", clip: "talk", start: 0, end: 1, transition: "zoom", motion: "none" },
        { id: "g2", clip: "talk", start: 1, end: 1.1, transition: "zoom", motion: "none" },
        { id: "g3", clip: "talk", start: 2, end: 3, transition: "zoom", motion: "kenburns" },
      ],
    };
    expect(getSegmentZoomEases(short, { zoomPercent: 112, zoomEaseFrames: 5 })).toEqual([0, 3, 0]);
  });

  it("plays a picture in film time as one video, zooming it per segment, with no fade tweens", () => {
    const one = composeFootage(input({ assets: { ...input().assets, picture: "assets/picture.mp4" } }));
    expect(one.match(/<video /g)).toHaveLength(1);
    expect(one).toContain('<video id="picture" class="clip shot" src="assets/picture.mp4" data-start="0" data-media-start="0" data-duration="8" muted playsinline></video>');
    expect(one).not.toContain('id="seg0"');
    expect(one).not.toContain("opacity: 0 }, { opacity: 1");
    // Each segment sets the zoom it starts at; Ken Burns tweens the same video.
    expect(one).toContain('tl.set("#picture", { scale: 1 }, 0);');
    expect(one).toContain('tl.set("#picture", { scale: 1.08 }, 2);');
    expect(one).toContain('tl.set("#picture", { scale: 1 }, 3);');
    expect(one).toContain('tl.fromTo("#picture", { scale: 1 }, { scale: 1.04, duration: 3, ease: "none", immediateRender: false }, 4);');
    // The sound and the end card do not change.
    expect(one).toContain('<audio id="speech" src="assets/speech.mp3" data-start="0" data-duration="8" data-volume="1"></audio>');
    expect(one).toContain('<img id="last" class="clip shot" src="assets/last.jpg" data-start="8" data-duration="3" />');
    // An eased zoom cut tweens the one video from the scale before the cut.
    const eased = composeFootage(input({ film: { ...film, edit: { zoomEaseFrames: 4 } }, assets: { ...input().assets, picture: "assets/picture.mp4" } }));
    expect(eased).toContain('tl.fromTo("#picture", { scale: 1 }, { scale: 1.08, duration: 0.133, ease: "power1.out", immediateRender: false }, 2);');
  });

  it("plays the whoosh on a whoosh cut, and at the end card only when the film asks for it", () => {
    expect(html).toContain('src="assets/sfx/whoosh.mp3" data-start="6.9"');
    expect(html).not.toContain('src="assets/sfx/whoosh.mp3" data-start="8"');
    expect(html).not.toContain("assets/sfx/pop.mp3");
    const loud = composeFootage(input({ film: { ...film, edit: { isEndCardWhoosh: true } } }));
    expect(loud).toContain('src="assets/sfx/whoosh.mp3" data-start="8"');
    expect(loud).toContain('src="assets/sfx/pop.mp3" data-start="8.9"');
  });

  it("lays the cut speech and the ducked music under the film and lasts the cut plus the end card", () => {
    expect(getFootageFilmSeconds(film, edl)).toBe(11);
    expect(html).toContain('data-composition-id="film" data-start="0" data-duration="11" data-width="1080" data-height="1920"');
    expect(html).toContain('<audio id="speech" src="assets/speech.mp3" data-start="0" data-duration="8" data-volume="1"></audio>');
    expect(html).toContain('<audio id="music" src="assets/music.mp3" data-start="0" data-duration="11" data-volume="1"></audio>');
  });

  it("shows the end card over the last frame, escaped, without an empty note", () => {
    expect(html).toContain('<img id="last" class="clip shot" src="assets/last.jpg" data-start="8" data-duration="3" />');
    expect(html).toContain("<title>Street &lt;test&gt;</title>");
    expect(html).not.toContain('id="ec-note"');
  });

  it("captions the words as plain phrases by default, and with the highlight on request", () => {
    // A one-word phrase joins the phrase before it.
    expect(html).toContain('<p class="phrase">Hello, to</p>');
    expect(html).not.toContain('class="pill"');
    expect(html).toContain("const captions = [];");
    const highlight = composeFootage(input({ film: { ...film, captionStyle: "highlight" } }));
    expect(highlight).toContain('<p class="pill"><span id="cw0_0">Hello,</span></p>');
    expect(highlight).toContain("const captions = [[0.1],[0.6]];");
  });

  it("drops captions, music and the end card when the film has none", () => {
    const bare = composeFootage(input({ film: { ...film, captions: false, endCard: null }, assets: { ...input().assets, music: null } }));
    expect(bare).not.toContain('class="clip caption"');
    expect(bare).not.toContain('id="music"');
    expect(bare).not.toContain('id="last"');
    expect(bare).toContain('data-duration="8" data-width="1080"');
  });

  it("refuses an EDL that names a clip without a file", () => {
    expect(() => composeFootage(input({ assets: { ...input().assets, clips: {} } }))).toThrow('The EDL names clip "talk", which the film has no file for.');
  });
});

describe("composeFootage with a caption line limit", () => {
  it("fits no caption without a limit", () => {
    expect(composeFootage(input())).not.toContain("captionMaxLines");
  });

  it("shrinks each caption's font to the limit, down to 70 % of the box's size", () => {
    const html = composeFootage(input({ film: { ...film, captionMaxLines: 2 } }));
    expect(html).toContain("const captionMaxLines = 2, captionMinFontSize = 35;");
  });
});
