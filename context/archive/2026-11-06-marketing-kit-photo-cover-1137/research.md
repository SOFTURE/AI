---
change_id: marketing-kit-photo-cover-1137
---

# Research: a photo cover for vertical video (issue #1137)

## 1. What the kit has

- `src/og/render.ts`: satori lays an `OgNode` tree out to SVG (text as paths), resvg rasterises it to PNG with
  `loadSystemFonts: false`. `findMissingGlyphs` (glyphs.ts) refuses characters the loaded fonts cannot draw.
- `OgFonts` (`loadOgFonts`) carries the brand's heading (display) and body families; `pickWeight` picks the nearest
  loaded weight; `toFontFamilyCss` lists subset families.
- No template takes a photo; every template paints the brand background.
- No JPEG encoder in the tree (no sharp, jimp, jpeg-js); resvg-js writes PNG only (`asPng`), but exposes raw RGBA
  `pixels`.

## 2. Measurements (spike on this container)

- resvg decodes JPEG and PNG inside `<image href="data:…">` and **ignores EXIF orientation**: a 40×20 red|blue JPEG
  with an APP1 orientation 6 tag drew unrotated (top-left red, top-right blue). So orientation is applied in the SVG
  as a transform on the image, read from the file's EXIF ourselves.
- `jpeg-js` 0.4.4 (MIT, no dependencies, 0 advisories since 0.4.4) encodes a 1080×1920 RGBA buffer at quality 90 in
  about 150 ms. It writes baseline JFIF with no ICC profile, which viewers take as sRGB.

## 3. Approach

- Read the photo (path or Buffer), sniff JPEG (FF D8) or PNG (signature); read its pixel size (JPEG SOFn, PNG IHDR)
  and its orientation (JPEG APP1 Exif IFD0 tag 0x0112; PNG `eXIf` chunk). Anything else is an error.
- The oriented size swaps width and height for orientations 5 to 8. Cover scale `max(W/w, H/h)`; the crop offset
  centres the focus point and is clamped to the photo.
- One SVG: the photo as `<image>` under `translate · scale · orientation matrix`, a soft linear-gradient scrim under
  the caption, and the caption as satori's SVG (transparent background, text-shadow) nested as an image.
- The caption is laid out by satori inside the 4:5 band (full width × width·5/4, centred), anchored to the band's
  lower edge with padding. Whether it fits is **measured**: the caption layer alone is rasterised and the box of its
  painted pixels must lie inside the band's safe area; otherwise the caption is too long (an error). This holds for
  any brand font, unlike a character count alone. A schema cap (80 characters) stops absurd input early.
- Text colour: the lighter of the brand's foreground and background; scrim and shadow: the darker. High contrast over
  any photo without a sticker box.
- Output: `{ jpeg, width, height, bytes }`, JPEG at quality 90 (option), exactly the requested size.

## 4. Limits

- Embedded ICC profiles (e.g. Display P3 phone photos) are not converted; pixel values are taken as sRGB. Noted in
  the README.
