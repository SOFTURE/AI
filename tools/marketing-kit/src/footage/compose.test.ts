import { describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { composeFootage, getFootageFilmSeconds, getFootageSfxCues, getLogoCardBox, getSegmentScales, getSegmentZoomEases, type FootageComposeInput } from "./compose.js";
import type { Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, getEndCardSeconds, getEndCardTexts, type FootageFilm } from "./film.js";

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

  it("never ends a highlight card on a word the film's language keeps with the next", () => {
    const words = ["Here", "we", "live", "w", "Lodz."].map((text, index) => ({ text, start: index / 2, end: index / 2 + 0.3 }));
    const highlight = composeFootage(input({ film: { ...film, captionStyle: "highlight" }, words }));
    expect(highlight).toContain("const captions = [[0,0.5,1],[1.5,2]];");
    expect(highlight).toContain('<p class="pill"><span id="cw1_0">w</span> <span id="cw1_1">Lodz.</span></p>');
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

describe("composeFootage with the end card's length and the logo card", () => {
  const logoCard = { layout: "logo" as const, line: "Follow <for> more" };

  it("takes each layout's default length, or the card's own seconds", () => {
    expect(getEndCardSeconds(null)).toBe(0);
    expect(getEndCardSeconds({ headline: "H", url: "u", note: "" })).toBe(3);
    expect(getEndCardSeconds({ headline: "H", url: "u", note: "", seconds: 2 })).toBe(2);
    expect(getEndCardSeconds(logoCard)).toBe(1.5);
    expect(getEndCardSeconds({ ...logoCard, seconds: 1 })).toBe(1);
    expect(getFootageFilmSeconds({ endCard: { ...logoCard, seconds: 1.2 } }, edl)).toBe(9.2);
  });

  it("plays a shorter full card's entrances faster, so the note is on screen before the end", () => {
    const short = composeFootage(input({ film: { ...film, endCard: { headline: "Try it", url: "example.com", note: "Free", seconds: 1.5 } } }));
    expect(short).toContain('data-start="8" data-duration="1.5" />');
    expect(short).toContain('tl.fromTo("#ec-note", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" }, 8.65);');
    expect(short).toContain('tl.fromTo("#shade", { opacity: 0 }, { opacity: 0.82, duration: 0.225, ease: "power2.out" }, 8);');
  });

  it("draws the logo card over the last frame: the brand background fading in over 0.2 s, the logo and the escaped line", () => {
    const html = composeFootage(input({ film: { ...film, endCard: logoCard }, assets: { ...input().assets, logo: "assets/logo.png" } }));
    expect(html).toContain('<img id="last" class="clip shot" src="assets/last.jpg" data-start="8" data-duration="1.5" />');
    expect(html).toContain('<div class="logocard" id="ec-logo-card"><div class="logobox"><img class="mark" src="assets/logo.png" alt="" /><p class="logoline">Follow &lt;for&gt; more</p></div></div>');
    expect(html).toContain('tl.fromTo("#ec-logo-card", { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" }, 8);');
    expect(html).toContain(".logocard{position:absolute;inset:0;background:#0c0c0d;opacity:0}");
    expect(html).not.toContain('id="shade"');
    expect(html).not.toContain('id="ec-headline"');
    expect(html).toContain('<audio id="speech" src="assets/speech.mp3" data-start="0" data-duration="8" data-volume="1"></audio>');
    expect(html).toContain('<audio id="music" src="assets/music.mp3" data-start="0" data-duration="9.5" data-volume="1"></audio>');
  });

  it("fills the logo box with an SVG, names the brand without a logo, drops an empty line and takes its own fade", () => {
    const svg = composeFootage(input({ film: { ...film, endCard: { layout: "logo", line: " ", fadeSeconds: 0.4 } }, assets: { ...input().assets, logo: "assets/logo.svg" } }));
    expect(svg).toContain('<div class="logobox"><img class="mark vector" src="assets/logo.svg" alt="" /></div>');
    expect(svg).toContain("{ opacity: 1, duration: 0.4, ease: \"none\" }");
    const named = composeFootage(input({ film: { ...film, endCard: logoCard } }));
    expect(named).toContain('<div class="logobox"><span class="markname">Acme</span><p class="logoline">');
  });

  it("keeps the logo card inside the 9:16 platform safe zone, the film's caption preset or every platform's", () => {
    const frame = LAYOUTS["9:16"].frame;
    expect(getLogoCardBox({ format: "9:16" }, frame)).toEqual({ top: 220, bottom: 480, left: 150, right: 150 });
    expect(getLogoCardBox({ format: "9:16", captionPreset: "reels" }, frame)).toEqual({ top: 220, bottom: 420, left: 120, right: 120 });
    expect(getLogoCardBox({ format: "1:1" }, LAYOUTS["1:1"].frame)).toEqual({ top: 80, bottom: 80, left: 80, right: 80 });
    const html = composeFootage(input({ film: { ...film, endCard: logoCard } }));
    expect(html).toContain(".logobox{position:absolute;top:220px;bottom:480px;left:150px;right:150px;");
  });

  it("plays the end card's pop only when it starts before the film's end", () => {
    const sfx = { whoosh: "w.mp3", pop: "p.mp3" };
    const loud = (seconds: number) => getFootageSfxCues({ ...film, edit: { isEndCardWhoosh: true }, endCard: { ...logoCard, seconds } }, edl, sfx).map((cue) => `${cue.src}@${cue.t}`);
    expect(loud(1)).toEqual(["w.mp3@6.9", "w.mp3@8", "p.mp3@8.9"]);
    // A card set in code shorter than the schema allows still never plays a sound past the film's end.
    expect(loud(0.8)).toEqual(["w.mp3@6.9", "w.mp3@8"]);
  });

  it("hands the glyph check the logo card's line as the heading font's text", () => {
    expect(getEndCardTexts(logoCard)).toEqual({ headline: "Follow <for> more", url: "", note: "" });
    expect(getEndCardTexts({ headline: "H", url: "u", note: "n", seconds: 2 })).toEqual({ headline: "H", url: "u", note: "n" });
    expect(getEndCardTexts(null)).toBeNull();
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

describe("composeFootage with a segment's own caption box", () => {
  const moved: Edl = { ...edl, segments: edl.segments.map((segment) => (segment.id === "g2" ? { ...segment, caption: { bottom: 1150 } } : segment)) };
  const words = [
    { text: "Hello,", start: 0.1, end: 0.5 },
    { text: "this", start: 2.1, end: 2.3 },
    { text: "moves.", start: 2.4, end: 2.7 },
    { text: "Spans", start: 2.8, end: 2.95 },
    { text: "the", start: 3.05, end: 3.2 },
    { text: "cut.", start: 3.25, end: 3.5 },
    { text: "Back.", start: 4.2, end: 4.5 },
  ];
  const html = composeFootage(input({ edl: moved, words }));
  const captionDivs = html.split("\n").filter((line) => line.includes('class="clip caption"'));

  it("draws that segment's chunks at its foot and every other chunk in the film's box", () => {
    expect(captionDivs).toHaveLength(4);
    expect(captionDivs[0]).not.toContain("style=");
    expect(captionDivs[1]).toContain('style="top:auto;bottom:1150px"');
    expect(captionDivs[3]).not.toContain("style=");
  });

  it("keeps a chunk that spans a cut in the box of the segment where its first word starts", () => {
    expect(captionDivs[2]).toContain("Spans");
    expect(captionDivs[2]).toContain("cut.");
    expect(captionDivs[2]).toContain('style="top:auto;bottom:1150px"');
  });

  it("hangs a chunk from a segment's top when it gives only a top", () => {
    const hung: Edl = { ...edl, segments: edl.segments.map((segment) => (segment.id === "g2" ? { ...segment, caption: { top: 300 } } : segment)) };
    const footed = composeFootage(input({ edl: hung, words, caption: { ...LAYOUTS["9:16"].caption, bottom: 420 } }));
    expect(footed).toContain('style="bottom:auto;top:300px"');
  });

  it("draws a chunk that starts in a caption range at the range's foot, over its segment's box", () => {
    const ranged = composeFootage(input({ edl: { ...moved, captionRanges: [{ from: 2, to: 2.6, bottom: 700 }] }, words }));
    const divs = ranged.split("\n").filter((line) => line.includes('class="clip caption"'));
    expect(divs[0]).not.toContain("style=");
    expect(divs[1]).toContain('style="top:auto;bottom:700px"');
    expect(divs[2]).toContain('style="top:auto;bottom:1150px"');
  });

  it("writes the same page for an EDL without the field", () => {
    expect(composeFootage(input({ edl: { ...edl, segments: edl.segments.map((segment) => ({ ...segment, caption: {} })) }, words }))).toBe(composeFootage(input({ words })));
    expect(composeFootage(input({ words }))).not.toContain('class="clip caption" data-start="0.05" data-duration="0.45" style=');
  });
});

describe("composeFootage with a remote asset", () => {
  it("refuses a clip given as an https URL, so hyperframes never downloads anything", () => {
    const remote = input({ assets: { ...input().assets, clips: { talk: "https://cdn.example.com/talk.mp4", street: "clips/street.mp4" } } });
    expect(() => composeFootage(remote)).toThrow(
      'The composition names a remote file (https://cdn.example.com/talk.mp4); every asset must be a local file in the build folder.',
    );
  });

  it("refuses a logo given as an http URL", () => {
    expect(() => composeFootage(input({ assets: { ...input().assets, logo: "http://cdn.example.com/logo.png" } }))).toThrow(/remote file \(http:\/\/cdn\.example\.com\/logo\.png\)/);
  });
});
