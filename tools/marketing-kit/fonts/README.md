# Fonts

`DejaVuSans-Bold-Latin.ttf` draws the captions of a footage draft (`renderFootageDraft`). It is DejaVu Sans Bold
([dejavu-fonts.github.io](https://dejavu-fonts.github.io/)) subset to Basic Latin, Latin-1, Latin Extended-A (every
Polish letter) and common punctuation:

```bash
pyftsubset DejaVuSans-Bold.ttf --unicodes="U+0020-007E,U+00A0-017F,U+2010-2027,U+2030-203A,U+20AC,U+2122" \
  --layout-features='kern,liga' --output-file=DejaVuSans-Bold-Latin.ttf
```

Licence: [LICENSE-DejaVu.txt](LICENSE-DejaVu.txt) (the Bitstream Vera licence; DejaVu changes are in the public domain).

`Caveat-SemiBold-Latin.ttf` is the kit's handwriting (`HAND_FONT`): a note card and an end word are written in it. It
is [Caveat](https://github.com/googlefonts/caveat) as a static SemiBold instance (weight 600 of the variable font,
named back to family `Caveat`, style `Regular`) subset to the same characters as the caption font, with its contextual
alternates kept:

```bash
fonttools varLib.instancer Caveat[wght].ttf wght=600 --output Caveat-SemiBold.ttf
# then set name IDs 1, 2, 4 and 6 to Caveat / Regular / Caveat / Caveat-Regular
pyftsubset Caveat-SemiBold.ttf --unicodes="U+0020-007E,U+00A0-017F,U+2010-2027,U+2030-203A,U+20AC,U+2122" \
  --layout-features='kern,liga,calt' --output-file=Caveat-SemiBold-Latin.ttf
```

Licence: [LICENSE-Caveat.txt](LICENSE-Caveat.txt) (SIL Open Font License 1.1).
