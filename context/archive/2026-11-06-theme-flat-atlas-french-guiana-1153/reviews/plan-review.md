# Plan review: theme-flat-atlas-french-guiana-1153

Verdict: approved. The split happens at build time, so the runtime and the fit stay as they were; the guard makes a
future world-atlas change that moves the polygon fail loudly instead of silently painting it again.
