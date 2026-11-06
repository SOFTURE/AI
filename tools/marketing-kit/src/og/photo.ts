import { err, ok, type OgResult } from "./result.js";

/**
 * What a photo's header says, read without decoding it: the format, the stored pixel size and the EXIF orientation.
 * resvg draws a JPEG or PNG as stored and ignores EXIF orientation, so a cover applies the orientation itself
 * (`getOrientationMatrix`).
 */

export type PhotoFormat = "jpeg" | "png";

/** EXIF orientation 1-8: 1 is upright, 5-8 swap width and height. */
export type PhotoOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface PhotoInfo {
  format: PhotoFormat;
  /** The stored size, before orientation. */
  width: number;
  height: number;
  orientation: PhotoOrientation;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXIF_HEADER = Buffer.from("Exif\0\0", "latin1");
const ORIENTATION_TAG = 0x0112;
const SHORT_TYPE = 3;

function isOrientation(value: number): value is PhotoOrientation {
  return Number.isInteger(value) && value >= 1 && value <= 8;
}

/** The orientation in a TIFF block (an EXIF payload after `Exif\0\0`, or a PNG `eXIf` chunk); 1 when absent. */
export function readTiffOrientation(tiff: Buffer): PhotoOrientation {
  if (tiff.length < 8) return 1;
  const order = tiff.toString("latin1", 0, 2);
  if (order !== "II" && order !== "MM") return 1;
  const isLittle = order === "II";
  const u16 = (offset: number) => (isLittle ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset));
  const u32 = (offset: number) => (isLittle ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset));
  if (u16(2) !== 42) return 1;
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return 1;
  const count = u16(ifd);
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > tiff.length) return 1;
    if (u16(entry) !== ORIENTATION_TAG) continue;
    if (u16(entry + 2) !== SHORT_TYPE) return 1;
    const value = u16(entry + 8);
    return isOrientation(value) ? value : 1;
  }
  return 1;
}

/** SOFn markers carry the frame size; C4 (DHT), C8 (JPG) and CC (DAC) share the range but are not frames. */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function readJpegInfo(bytes: Buffer): OgResult<PhotoInfo> {
  let orientation: PhotoOrientation = 1;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return err("the JPEG's markers are damaged");
    const marker = bytes[offset + 1] ?? 0;
    // Fill bytes and markers without a length (RSTn, TEM) carry no segment.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset + 2);
    const start = offset + 4;
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) return err("the JPEG ends inside a segment");
    if (marker === 0xe1 && bytes.subarray(start, start + EXIF_HEADER.length).equals(EXIF_HEADER)) {
      orientation = readTiffOrientation(bytes.subarray(start + EXIF_HEADER.length, end));
    }
    if (isStartOfFrame(marker)) {
      if (length < 7) return err("the JPEG's frame header is too short");
      const height = bytes.readUInt16BE(start + 1);
      const width = bytes.readUInt16BE(start + 3);
      if (width === 0 || height === 0) return err("the JPEG has no pixel size");
      return ok({ format: "jpeg", width, height, orientation });
    }
    offset = end;
  }
  return err("the JPEG has no frame header");
}

function readPngInfo(bytes: Buffer): OgResult<PhotoInfo> {
  if (bytes.length < 33 || bytes.toString("latin1", 12, 16) !== "IHDR") return err("the PNG has no IHDR chunk");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width === 0 || height === 0) return err("the PNG has no pixel size");
  let orientation: PhotoOrientation = 1;
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) break;
    if (type === "eXIf") orientation = readTiffOrientation(bytes.subarray(offset + 8, offset + 8 + length));
    if (type === "IDAT" || type === "IEND") break;
    offset = end;
  }
  return ok({ format: "png", width, height, orientation });
}

/** The format, stored size and orientation of a JPEG or PNG; anything else is an error naming what is wrong. */
export function readPhotoInfo(bytes: Buffer): OgResult<PhotoInfo> {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return readJpegInfo(bytes);
  if (bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return readPngInfo(bytes);
  return err("it is neither a JPEG nor a PNG");
}

/** The size a viewer shows: orientations 5-8 turn the photo a quarter, swapping width and height. */
export function getOrientedSize(info: Pick<PhotoInfo, "width" | "height" | "orientation">): { width: number; height: number } {
  return info.orientation >= 5 ? { width: info.height, height: info.width } : { width: info.width, height: info.height };
}

/**
 * The SVG `matrix(a b c d e f)` that maps the stored pixels (`width` × `height`) onto the upright photo, so that
 * `x' = a·x + c·y + e` and `y' = b·x + d·y + f`.
 */
export function getOrientationMatrix(orientation: PhotoOrientation, width: number, height: number): readonly [number, number, number, number, number, number] {
  switch (orientation) {
    case 1:
      return [1, 0, 0, 1, 0, 0];
    case 2:
      return [-1, 0, 0, 1, width, 0];
    case 3:
      return [-1, 0, 0, -1, width, height];
    case 4:
      return [1, 0, 0, -1, 0, height];
    case 5:
      return [0, 1, 1, 0, 0, 0];
    case 6:
      return [0, 1, -1, 0, height, 0];
    case 7:
      return [0, -1, -1, 0, height, width];
    case 8:
      return [0, -1, 1, 0, 0, width];
  }
}

/** A point of the photo as fractions of its upright width and height, 0..1. */
export interface FocusPoint {
  x: number;
  y: number;
}

/** How the upright photo is scaled and shifted to cover the frame. */
export interface CoverCrop {
  scale: number;
  /** The scaled photo's offset from the frame's top-left corner, zero or negative. */
  x: number;
  y: number;
}

/**
 * Scales the upright photo to cover `frame` and shifts it so the focus point sits as near the frame's centre as the
 * photo allows: an edge of the photo never comes inside the frame.
 */
export function getCoverCrop(photo: { width: number; height: number }, frame: readonly [number, number], focus: FocusPoint): CoverCrop {
  const [width, height] = frame;
  const scale = Math.max(width / photo.width, height / photo.height);
  const place = (length: number, target: number, at: number) => {
    const scaled = length * scale;
    const offset = target / 2 - at * scaled;
    return Math.min(0, Math.max(target - scaled, offset));
  };
  return { scale, x: place(photo.width, width, focus.x), y: place(photo.height, height, focus.y) };
}
