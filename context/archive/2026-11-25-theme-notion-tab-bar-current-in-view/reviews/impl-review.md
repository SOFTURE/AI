# Implementation review: theme-notion-tab-bar-current-in-view

Verdict: approve after one fix. The strip scrolls through its own `scrollLeft` from bounding rects, so the page never
moves (asserted: no `scrollIntoView`, no `window.scrollTo`); the overflow marks follow scroll and resize; the mask is
static and needs no colour. Finding, fixed in this change: scrolling a middle tab exactly to the edge left it under the
32 px end fade, half-hidden, which is what the issue asks to avoid; the scroll now keeps a fade's width of room,
clamped to the strip's range, with a test. The props are unchanged and serialisable, so a Server Component page keeps
rendering `TabBar` after the `"use client"` directive; the built file keeps the directive. README and CHANGELOG
`Unreleased` describe the behaviour and the code an app can drop.
