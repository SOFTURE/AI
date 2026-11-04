# Fonts

`DejaVuSans-Bold-Latin.ttf` draws the captions of a footage draft (`renderFootageDraft`). It is DejaVu Sans Bold
([dejavu-fonts.github.io](https://dejavu-fonts.github.io/)) subset to Basic Latin, Latin-1, Latin Extended-A (every
Polish letter) and common punctuation:

```bash
pyftsubset DejaVuSans-Bold.ttf --unicodes="U+0020-007E,U+00A0-017F,U+2010-2027,U+2030-203A,U+20AC,U+2122" \
  --layout-features='kern,liga' --output-file=DejaVuSans-Bold-Latin.ttf
```

Licence: [LICENSE-DejaVu.txt](LICENSE-DejaVu.txt) (the Bitstream Vera licence; DejaVu changes are in the public domain).
