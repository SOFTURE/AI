# Plan review: theme-notion-side-layout-inline

Verdict: approve. An optional prop with today's layout as the default keeps every adopting row where it is, and the
same name on both components keeps the API small. The `data-row-wide` case is handled by keeping the column direction
for it, which the existing wide fit test guards. The geometry tests measure exactly the issue's acceptance (the badge's
right edge before the control's left edge, one line) at both viewports; the phone checks keep the 44 px targets and the
wrap under the identity. `FoldRow`'s `align` maps to the cross axis once the column is a row, so `start` still puts the
state on the summary's first line. New gallery cases need new baselines on all four projects; the existing baselines
must not change, which the gallery run proves.
