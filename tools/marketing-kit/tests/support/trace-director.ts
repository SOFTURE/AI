import type { Page } from "playwright";

import type { Director, Scene } from "../../src/film.js";

/**
 * A Director and a page without a browser: the page builds locators that only describe how they were
 * built, and the Director records every call with its arguments. Two scenes that leave the same trace
 * make the same calls with the same locators, so the recorder (deterministic for equal calls) writes
 * the same log for both.
 */

export interface TraceCall {
  method: string;
  args: unknown[];
}

function describe(value: unknown): string {
  if (value === undefined) return "";
  if (value instanceof RegExp) return String(value);
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
  return `{${entries.map(([key, entry]) => `${key}:${describe(entry)}`).join(",")}}`;
}

class TraceLocator {
  constructor(readonly description: string) {}

  nth(index: number): TraceLocator {
    return new TraceLocator(`${this.description}.nth(${index})`);
  }

  /** Playwright's `first()` is `nth(0)`; both resolve to the same element. */
  first(): TraceLocator {
    return this.nth(0);
  }

  toString(): string {
    return this.description;
  }
}

const call = (method: string, ...args: unknown[]) => new TraceLocator(`${method}(${args.map(describe).filter((text) => text.length > 0).join(", ")})`);

/** A stand-in for a Playwright page: only the locator builders a scene uses. */
export function createTracePage(): Page {
  const page = {
    getByRole: (role: string, options?: object) => call("getByRole", role, options),
    getByText: (text: string | RegExp, options?: object) => call("getByText", text, options),
    getByLabel: (text: string | RegExp, options?: object) => call("getByLabel", text, options),
    getByTestId: (id: string) => call("getByTestId", id),
    locator: (selector: string, options?: object) => call("locator", selector, options),
  };
  // A test double: the scenes under test only build locators and hand them to the Director.
  return page as unknown as Page;
}

/** Options objects: an absent one and an empty one mean the Director's defaults alike. */
function normalize(value: unknown): unknown {
  if (value instanceof TraceLocator) return value.description;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
    return entries.length === 0 ? undefined : Object.fromEntries(entries.map(([key, entry]) => [key, normalize(entry)]));
  }
  return value;
}

export function createTraceDirector(page: Page = createTracePage()): { director: Director; calls: TraceCall[] } {
  const calls: TraceCall[] = [];
  const record = (method: string, ...args: unknown[]) => {
    const normalized = args.map(normalize);
    while (normalized.length > 0 && normalized.at(-1) === undefined) normalized.pop();
    calls.push({ method, args: normalized });
    return Promise.resolve();
  };
  const director: Director = {
    page,
    async beat(id, actions, options) {
      calls.push({ method: "beat", args: options === undefined ? [id] : [id, normalize(options)] });
      await actions();
      calls.push({ method: "end", args: [id] });
    },
    until: (word) => record("until", word),
    hold: (seconds) => record("hold", seconds),
    bring: (target, options) => record("bring", target, options),
    tap: (target, options) => record("tap", target, options),
    type: (text, options) => record("type", text, options),
    press: (key, options) => record("press", key, options),
    fill: (name, value, options) => record("fill", name, value, options),
    blur: () => record("blur"),
    focus: (target, options) => record("focus", target, options),
    wide: (options) => record("wide", options),
    mark: (name, target) => record("mark", name, target),
    still: (name) => record("still", name),
    cue: (name) => record("cue", name),
    checkScreen: () => record("checkScreen"),
  };
  return { director, calls };
}

/** The calls a scene makes, run against the trace page and Director. */
export async function traceScene(scene: Scene): Promise<TraceCall[]> {
  const { director, calls } = createTraceDirector();
  await scene(director);
  return calls;
}

