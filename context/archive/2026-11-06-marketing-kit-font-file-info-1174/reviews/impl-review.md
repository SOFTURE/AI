# Implementation review

Verdict: approved.

- Hostile input: every table read is bounds-checked (`OutOfBounds` becomes an error value), table counts above 512
  are refused, WOFF inflate and WOFF2 Brotli output are capped (`maxOutputLength`, 64 MB), a decompress failure is
  an error value. Tests cover garbage, empty, truncated, corrupt Brotli, a collection, a cut `name` table and a
  65535-table header.
- WOFF2: the directory honours the transform rules (`glyf`/`loca` version 0 and other tables version non-0 carry a
  transform length), so tables after a transformed `glyf` sit at the right offset; real Inter `.woff2` files read the
  same family, weight and style as their `.woff` twins, and the same character map.
- `loadOgFonts` and the photo cover are unchanged (still refuse `.woff2` by extension); no file of #1172 is touched.
- The `og` entry still loads no Playwright (imports test green). Polish test letters live in `tests/og/pl/`.
