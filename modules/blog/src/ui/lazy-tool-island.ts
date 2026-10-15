import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * A tool's island loaded only when the tool is on the page (GitHub issue 509). Call it in the app's own
 * `"use client"` module, so the loader stays on the client: `export const Calculator = lazyToolIsland(() =>
 * import("./calculator").then((module) => module.Calculator))`. The island renders only after hydration, so the
 * import runs after mount; a failed import reaches the nearest error boundary.
 */
export function lazyToolIsland<TProps extends object>(load: () => Promise<ComponentType<TProps>>): LazyExoticComponent<ComponentType<TProps>> {
  return lazy(async () => ({ default: await load() }));
}
