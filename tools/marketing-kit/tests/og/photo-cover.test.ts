import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 } from "node:zlib";

import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";
import { afterAll, describe, expect, it } from "vitest";

import { getCoverBand, PHOTO_COVER_LAYOUTS, renderPhotoCover, type PhotoCoverInput, type PhotoCoverLayout } from "../../src/og/photo-cover.js";
import { getCoverCrop, getOrientationMatrix, getOrientedSize, readPhotoInfo, readTiffOrientation, type PhotoOrientation } from "../../src/og/photo.js";
import { COLORS, loadInter } from "./helpers.js";

type Rgb = readonly [number, number, number];

const RED: Rgb = [220, 30, 30];
const GREEN: Rgb = [30, 200, 30];
const BLUE: Rgb = [30, 30, 220];
const BLACK: Rgb = [0, 0, 0];

/** A big-endian TIFF block with one IFD0 entry: the orientation. */
function makeTiff(orientation: number): Buffer {
  return Buffer.from([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0]);
}

/** A JPEG painted by `paint`, with an EXIF APP1 segment carrying `orientation` when one is given. */
function makeJpeg(width: number, height: number, paint: (x: number, y: number) => Rgb, orientation?: number): Buffer {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  const encoded = jpeg.encode({ data, width, height }, 95).data;
  if (orientation === undefined) return encoded;
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), makeTiff(orientation)]);
  const header = Buffer.from([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]);
  return Buffer.concat([encoded.subarray(0, 2), header, payload, encoded.subarray(2)]);
}

/** A PNG of `rects` over black, drawn by resvg; an `eXIf` chunk after IHDR when `orientation` is given. */
function makePng(width: number, height: number, rects: string, orientation?: number): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}"><rect width="100%" height="100%" fill="black"/>${rects}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "original" } }).render().asPng();
  if (orientation === undefined) return png;
  const body = Buffer.concat([Buffer.from("eXIf", "latin1"), makeTiff(orientation)]);
  const chunk = Buffer.alloc(body.length + 8);
  chunk.writeUInt32BE(body.length - 4, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), body.length + 4);
  const afterHeader = 8 + 25;
  return Buffer.concat([png.subarray(0, afterHeader), chunk, png.subarray(afterHeader)]);
}

const thirds = (width: number) => (x: number) => (x < width / 3 ? RED : x < (2 * width) / 3 ? GREEN : BLUE);
/** A landscape photo: red, green and blue thirds from left to right. */
const LANDSCAPE = makeJpeg(1600, 900, thirds(1600));
/** A portrait photo: the top half red, the bottom half blue. */
const PORTRAIT = makeJpeg(900, 2000, (_x, y) => (y < 1000 ? RED : BLUE));
/** Stored as landscape (left half red, right half blue); orientations 6 and 8 make it a portrait. */
const turned = (orientation: number) => makeJpeg(2000, 900, (x) => (x < 1000 ? RED : BLUE), orientation);

const fonts = loadInter();

function cover(changes: Partial<PhotoCoverInput>): Promise<Awaited<ReturnType<typeof renderPhotoCover>>> {
  return renderPhotoCover({ photo: LANDSCAPE, colors: COLORS, fonts, ...changes });
}

async function renderPixels(changes: Partial<PhotoCoverInput>): Promise<{ width: number; height: number; data: Uint8Array; bytes: number; jpegLength: number }> {
  const result = await cover(changes);
  if (!result.ok) throw new Error(result.error);
  const decoded = jpeg.decode(result.value.jpeg, { useTArray: true });
  expect([decoded.width, decoded.height]).toEqual([result.value.width, result.value.height]);
  return { width: decoded.width, height: decoded.height, data: decoded.data, bytes: result.value.bytes, jpegLength: result.value.jpeg.length };
}

/** The pure colour (of red, green, blue, black) nearest the decoded pixel at x, y. */
function colourAt(image: { width: number; data: Uint8Array }, x: number, y: number): string {
  const offset = (y * image.width + x) * 4;
  const pixel = [image.data[offset] ?? 0, image.data[offset + 1] ?? 0, image.data[offset + 2] ?? 0];
  const named = { red: RED, green: GREEN, blue: BLUE, black: BLACK };
  const distance = (colour: Rgb) => colour.reduce((sum, channel, index) => sum + (channel - (pixel[index] ?? 0)) ** 2, 0);
  return Object.entries(named).sort(([, a], [, b]) => distance(a) - distance(b))[0]?.[0] ?? "none";
}

describe("renderPhotoCover: the crop", () => {
  const directory = mkdtempSync(join(tmpdir(), "photo-cover-"));
  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("covers 1080×1920 from a landscape photo around the focus point", async () => {
    const left = await renderPixels({ focus: { x: 0, y: 0.5 } });
    const middle = await renderPixels({});
    const right = await renderPixels({ focus: { x: 1, y: 0.5 } });
    expect([left.width, left.height, middle.width, middle.height, right.width, right.height]).toEqual([1080, 1920, 1080, 1920, 1080, 1920]);
    expect([colourAt(left, 540, 960), colourAt(middle, 540, 960), colourAt(right, 540, 960)]).toEqual(["red", "green", "blue"]);
    // The landscape photo is cut on both sides: at its centre, the edges of the frame are still the middle third.
    expect([colourAt(middle, 4, 960), colourAt(middle, 1075, 960)]).toEqual(["green", "green"]);
  });

  it("covers 1080×1920 from a portrait photo around the focus point", async () => {
    const top = await renderPixels({ photo: PORTRAIT, focus: { x: 0.5, y: 0 } });
    const bottom = await renderPixels({ photo: PORTRAIT, focus: { x: 0.5, y: 1 } });
    expect([top.width, top.height, bottom.width, bottom.height]).toEqual([1080, 1920, 1080, 1920]);
    expect([colourAt(top, 540, 960), colourAt(bottom, 540, 960)]).toEqual(["red", "blue"]);
  });

  it("returns the cover's facts: its exact size and its byte length", async () => {
    const image = await renderPixels({ size: [720, 1280] });
    expect([image.width, image.height, image.bytes]).toEqual([720, 1280, image.jpegLength]);
  });

  it.each([
    [6, ["red", "blue"]],
    [8, ["blue", "red"]],
  ])("turns a photo with EXIF orientation %i upright before cropping", async (orientation, expected) => {
    const image = await renderPixels({ photo: turned(orientation) });
    expect([colourAt(image, 540, 100), colourAt(image, 540, 1820)]).toEqual(expected);
  });

  it("turns a photo with EXIF orientation 3 (upside down)", async () => {
    const image = await renderPixels({ photo: makeJpeg(900, 2000, (_x, y) => (y < 1000 ? RED : BLUE), 3) });
    expect([colourAt(image, 540, 100), colourAt(image, 540, 1820)]).toEqual(["blue", "red"]);
  });

  it("reads a PNG, its eXIf orientation included", async () => {
    const png = makePng(2000, 900, `<rect width="1000" height="900" fill="rgb(220,30,30)"/><rect x="1000" width="1000" height="900" fill="rgb(30,30,220)"/>`, 6);
    const image = await renderPixels({ photo: png });
    expect([colourAt(image, 540, 100), colourAt(image, 540, 1820)]).toEqual(["red", "blue"]);
  });

  it("reads the photo from a path", async () => {
    const path = join(directory, "photo.jpg");
    writeFileSync(path, PORTRAIT);
    const image = await renderPixels({ photo: path, focus: { x: 0.5, y: 1 } });
    expect(colourAt(image, 540, 960)).toBe("blue");
  });
});

/** The box of the pixels the text lightens on a black photo (the scrim and shadow only darken it), or those `isLit` picks. */
function findLitBox(image: { width: number; height: number; data: Uint8Array }, isLit: (red: number) => boolean = (red) => red > 48): { top: number; bottom: number; left: number; right: number; count: number } {
  let top = image.height;
  let bottom = -1;
  let left = image.width;
  let right = -1;
  let count = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!isLit(image.data[(y * image.width + x) * 4] ?? 0)) continue;
      count += 1;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return { top, bottom, left, right, count };
}


const BLACK_PHOTO = makeJpeg(1080, 1920, () => BLACK);
const GREY_PHOTO = makeJpeg(1080, 1920, () => [128, 128, 128]);

/** The red channel of the decoded pixel at x, y. */
const redAt = (image: { width: number; data: Uint8Array }, x: number, y: number) => image.data[(y * image.width + x) * 4] ?? 0;

describe("renderPhotoCover: the caption", () => {

  it("keeps the caption inside the lower half of the centre 4:5 band", async () => {
    const band = getCoverBand([1080, 1920]);
    expect(band).toEqual({ left: 0, top: 285, width: 1080, height: 1350 });
    for (const caption of ["Stop working at 49", "Your plan to retire early, counted in one evening with real numbers and no spreadsheet"]) {
      const lit = findLitBox(await renderPixels({ photo: BLACK_PHOTO, caption: caption.slice(0, 80) }));
      expect(lit.count).toBeGreaterThan(2000);
      expect(lit.top).toBeGreaterThanOrEqual(band.top + band.height / 2);
      expect(lit.bottom).toBeLessThan(band.top + band.height);
      expect([lit.left >= 0, lit.right < 1080]).toEqual([true, true]);
    }
  });

  it("draws the caption in the brand's light colour over a scrim that darkens the photo's lower part", async () => {
    const plain = await renderPixels({ photo: GREY_PHOTO });
    const captioned = await renderPixels({ photo: GREY_PHOTO, caption: "Hi" });
    const at = redAt;
    // No caption: the photo alone, no scrim.
    expect(Math.abs(at(plain, 540, 1800) - 128)).toBeLessThanOrEqual(4);
    expect(Math.abs(at(plain, 540, 300) - 128)).toBeLessThanOrEqual(4);
    // With a caption: the frame's foot is darkened, the top is untouched.
    expect(at(captioned, 20, 1800)).toBeLessThan(80);
    expect(Math.abs(at(captioned, 540, 300) - 128)).toBeLessThanOrEqual(4);
    // The text is the brand foreground (#f2f3f5), the lighter of foreground and background.
    const lit = findLitBox(await renderPixels({ photo: BLACK_PHOTO, caption: "Hi" }));
    expect(lit.count).toBeGreaterThan(500);
  });

  it("returns a caption that does not fit the band as an error, not drawn", async () => {
    const result = await cover({ caption: "W".repeat(80) });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('does not fit the lower half of the centre 4:5 band (1080×1350)') as unknown });
  });

  it("returns a caption longer than 80 characters or an empty one as an error", async () => {
    const long = await cover({ caption: "a".repeat(81) });
    const empty = await cover({ caption: "   " });
    expect(long.ok ? "" : long.error).toContain("caption: the caption is longer than 80 characters");
    expect(empty.ok ? "" : empty.error).toContain("caption: the caption is empty");
  });

  it("returns a character the brand fonts cannot draw as an error, not drawn", async () => {
    const result = await cover({ caption: "Cover 猫", id: "reel-1" });
    expect(result.ok ? "" : result.error).toContain('Photo cover "reel-1": the caption "Cover 猫" has characters none of the loaded fonts can draw at its weight: "猫" (U+732B)');
  });
});

describe("renderPhotoCover: layouts", () => {
  const band = getCoverBand([1080, 1920]);
  const half = band.height / 2;
  const third = band.height / 3;
  /** The rows each layout's text must keep to: [first row, the row after the last]. */
  const regions: Record<Exclude<PhotoCoverLayout, "photo">, readonly [number, number]> = {
    "title-bottom": [band.top + half, band.top + band.height],
    "title-center": [band.top + third, band.top + 2 * third],
    "title-top": [band.top, band.top + half],
    "kicker-title": [band.top + half, band.top + band.height],
    pill: [band.top + half, band.top + band.height],
  };
  const texts: Record<Exclude<PhotoCoverLayout, "photo">, Partial<PhotoCoverInput>> = {
    "title-bottom": { caption: "Stop working at 49" },
    "title-center": { caption: "Stop working at 49" },
    "title-top": { caption: "Stop working at 49" },
    "kicker-title": { kicker: "Episode 3", caption: "Retire early, counted in one evening" },
    pill: { caption: "Lisbon, Portugal" },
  };

  it("lists the six layouts", () => {
    expect(PHOTO_COVER_LAYOUTS).toEqual(["photo", "title-bottom", "title-center", "title-top", "kicker-title", "pill"]);
  });

  it.each(Object.keys(regions) as Exclude<PhotoCoverLayout, "photo">[])("draws every text pixel of %s inside the 4:5 band, in its named part", async (layout) => {
    const [top, bottom] = regions[layout];
    const lit = findLitBox(await renderPixels({ photo: BLACK_PHOTO, layout, ...texts[layout] }));
    expect(lit.count).toBeGreaterThan(1000);
    expect([lit.top >= top, lit.bottom < bottom, lit.left >= band.left, lit.right < band.left + band.width]).toEqual([true, true, true, true]);
  });

  it("draws the kicker above the title", async () => {
    const titleOnly = findLitBox(await renderPixels({ photo: BLACK_PHOTO, caption: "Retire early, counted in one evening" }));
    const withKicker = findLitBox(await renderPixels({ photo: BLACK_PHOTO, layout: "kicker-title", ...texts["kicker-title"] }));
    // The title keeps its foot; the kicker adds lit rows above it.
    expect(Math.abs(withKicker.bottom - titleOnly.bottom)).toBeLessThanOrEqual(2);
    expect(withKicker.top).toBeLessThan(titleOnly.top - 30);
  });

  it("draws nothing over the photo with the layout photo", async () => {
    const image = await renderPixels({ photo: GREY_PHOTO, layout: "photo" });
    expect([redAt(image, 540, 300), redAt(image, 540, 960), redAt(image, 20, 1800)].map((value) => Math.abs(value - 128) <= 4)).toEqual([true, true, true]);
  });

  it("moves the scrim with the text: the top for title-top, a band behind the text for title-center", async () => {
    const top = await renderPixels({ photo: GREY_PHOTO, layout: "title-top", caption: "Hi" });
    expect(redAt(top, 20, 100)).toBeLessThan(80);
    expect(Math.abs(redAt(top, 20, 1800) - 128)).toBeLessThanOrEqual(4);
    const centre = await renderPixels({ photo: GREY_PHOTO, layout: "title-center", caption: "Hi" });
    expect(redAt(centre, 20, 960)).toBeLessThan(80);
    expect([Math.abs(redAt(centre, 20, 300) - 128) <= 4, Math.abs(redAt(centre, 20, 1800) - 128) <= 4]).toEqual([true, true]);
  });

  it("sets the pill label in a box of the dark colour, with no scrim over the rest of the photo", async () => {
    const image = await renderPixels({ photo: GREY_PHOTO, layout: "pill", caption: "Lisbon" });
    const lit = findLitBox(await renderPixels({ photo: BLACK_PHOTO, layout: "pill", caption: "Lisbon" }));
    // Beside the label, inside the box, the photo is darkened; outside the box it is untouched.
    expect(redAt(image, lit.left - 10, Math.round((lit.top + lit.bottom) / 2))).toBeLessThan(50);
    expect([Math.abs(redAt(image, 20, 1800) - 128) <= 4, Math.abs(redAt(image, 20, lit.top) - 128) <= 4]).toEqual([true, true]);
  });

  it("draws dark text over a light scrim with the tone dark", async () => {
    const white = makeJpeg(1080, 1920, () => [255, 255, 255]);
    const dark = findLitBox(await renderPixels({ photo: white, caption: "Stop working at 49", tone: "dark" }), (red) => red < 80);
    expect(dark.count).toBeGreaterThan(1000);
    expect([dark.top >= band.top + half, dark.bottom < band.top + band.height]).toEqual([true, true]);
    const grey = await renderPixels({ photo: GREY_PHOTO, caption: "Hi", tone: "dark" });
    expect(redAt(grey, 20, 1800)).toBeGreaterThan(170);
    // The tone light is today's default.
    const light = await renderPixels({ photo: GREY_PHOTO, caption: "Hi", tone: "light" });
    const plain = await renderPixels({ photo: GREY_PHOTO, caption: "Hi" });
    expect(redAt(light, 20, 1800)).toBe(redAt(plain, 20, 1800));
  });

  it("returns text that does not fit its part of the band as an error, not drawn", async () => {
    const centre = await cover({ layout: "title-center", caption: "W".repeat(60) });
    expect(centre.ok ? "" : centre.error).toContain("does not fit the middle third of the centre 4:5 band (1080×1350)");
    const kicker = await cover({ layout: "kicker-title", kicker: "Episode 3", caption: "W".repeat(64) });
    expect(kicker.ok ? "" : kicker.error).toContain(`the kicker "Episode 3" and the caption "${"W".repeat(64)}" do not fit the lower half`);
  });

  it("returns an overlong kicker or pill label as an error", async () => {
    const kicker = await cover({ layout: "kicker-title", kicker: "k".repeat(41), caption: "Lisbon" });
    const pill = await cover({ layout: "pill", caption: "p".repeat(33) });
    expect(kicker.ok ? "" : kicker.error).toContain("kicker: the kicker is longer than 40 characters");
    expect(pill.ok ? "" : pill.error).toBe(`Photo cover: the pill label "${"p".repeat(33)}" is longer than 32 characters.`);
  });

  it("returns a kicker or pill character the fonts cannot draw as an error, naming the text", async () => {
    const kicker = await cover({ layout: "kicker-title", kicker: "Episode 猫", caption: "Lisbon" });
    const pill = await cover({ layout: "pill", caption: "Tokyo 猫" });
    expect(kicker.ok ? "" : kicker.error).toBe(
      'Photo cover: the kicker "Episode 猫" has characters none of the loaded fonts can draw at its weight: "猫" (U+732B). Use font files that cover them.',
    );
    expect(pill.ok ? "" : pill.error).toContain('the pill label "Tokyo 猫" has characters none of the loaded fonts can draw');
  });

  it.each<[Partial<PhotoCoverInput>, string]>([
    [{ layout: "title-center" }, 'the layout "title-center" needs a caption'],
    [{ layout: "kicker-title", caption: "Lisbon" }, 'the layout "kicker-title" needs a kicker'],
    [{ layout: "photo", caption: "Lisbon" }, 'the layout "photo" draws no text; leave the caption out or pick a text layout'],
    [{ kicker: "Episode 3", caption: "Lisbon" }, 'the kicker is drawn only by the layout "kicker-title", not "title-bottom"; leave it out'],
  ])("refuses texts the layout does not take: %j", async (changes, message) => {
    const result = await cover(changes);
    expect(result).toEqual({ ok: false, error: `Photo cover: ${message}.` });
  });

  it("refuses an unknown layout or tone", async () => {
    const result = await cover({ layout: "side" as PhotoCoverLayout, tone: "grey" as "light" });
    expect(result.ok ? [] : result.error.split("\n").slice(1).map((line) => line.split(":")[0]?.trim())).toEqual(["layout", "tone"]);
  });
});

describe("renderPhotoCover: input errors", () => {
  it("names a photo it cannot read", async () => {
    const result = await cover({ photo: "/no/such/photo.jpg" });
    expect(result).toEqual({ ok: false, error: "Photo cover: reading the photo /no/such/photo.jpg: ENOENT." });
  });

  it("refuses bytes that are neither a JPEG nor a PNG", async () => {
    const result = await cover({ photo: Buffer.from("GIF89a") });
    expect(result).toEqual({ ok: false, error: "Photo cover: the photo cannot be used: it is neither a JPEG nor a PNG." });
  });

  it("refuses a focus point outside 0..1 and a size out of range", async () => {
    const result = await cover({ focus: { x: 1.5, y: 0 }, size: [10, 1920] });
    expect(result.ok ? "" : result.error.split("\n").slice(1)).toEqual([
      "  size.0: Too small: expected number to be >=64",
      "  focus.x: Too big: expected number to be <=1",
    ]);
  });
});

describe("photo headers and the crop", () => {
  it("reads a JPEG's size and orientation, and a PNG's", () => {
    expect(readPhotoInfo(turned(6))).toEqual({ ok: true, value: { format: "jpeg", width: 2000, height: 900, orientation: 6 } });
    expect(readPhotoInfo(LANDSCAPE)).toEqual({ ok: true, value: { format: "jpeg", width: 1600, height: 900, orientation: 1 } });
    expect(readPhotoInfo(makePng(30, 20, ""))).toEqual({ ok: true, value: { format: "png", width: 30, height: 20, orientation: 1 } });
  });

  it("refuses a JPEG cut before its frame header", () => {
    expect(readPhotoInfo(LANDSCAPE.subarray(0, 12))).toEqual({ ok: false, error: "the JPEG ends inside a segment" });
  });

  it("reads a little-endian orientation and ignores an out-of-range one", () => {
    const little = Buffer.from([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0]);
    expect(readTiffOrientation(little)).toBe(8);
    expect(readTiffOrientation(makeTiff(9))).toBe(1);
    expect(readTiffOrientation(Buffer.alloc(4))).toBe(1);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8] as PhotoOrientation[])("orientation %i maps the stored corners onto the upright frame", (orientation) => {
    const [a, b, c, d, e, f] = getOrientationMatrix(orientation, 4, 2);
    const upright = getOrientedSize({ width: 4, height: 2, orientation });
    const corners = [[0, 0], [4, 0], [0, 2], [4, 2]].map(([x = 0, y = 0]) => [a * x + c * y + e, b * x + d * y + f]);
    expect(corners.map(([x]) => x).sort()).toEqual([0, 0, upright.width, upright.width]);
    expect(corners.map(([, y]) => y).sort()).toEqual([0, 0, upright.height, upright.height]);
  });

  it("centres the focus point and never brings an edge of the photo into the frame", () => {
    expect(getCoverCrop({ width: 1600, height: 900 }, [1080, 1920], { x: 0.5, y: 0.5 })).toEqual({ scale: 1920 / 900, x: 540 - 800 * (1920 / 900), y: 0 });
    expect(getCoverCrop({ width: 1600, height: 900 }, [1080, 1920], { x: 0, y: 0 })).toEqual({ scale: 1920 / 900, x: 0, y: 0 });
    expect(getCoverCrop({ width: 1600, height: 900 }, [1080, 1920], { x: 1, y: 1 })).toEqual({ scale: 1920 / 900, x: 1080 - 1600 * (1920 / 900), y: 0 });
  });
});
