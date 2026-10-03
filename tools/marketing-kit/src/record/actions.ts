import type { Locator, Page } from "playwright";

import type { LocatorDescriptor, SceneAction, TextMatch } from "../config/actions-schema.js";
import type { ActionBeat } from "../config/config.js";
import { formatIssuePath } from "../config/issues.js";
import type { Director, Scene } from "../film.js";
import { ScreenGuardError } from "./record.js";

/**
 * Beat `actions` from `marketing.json`, played on the Director: each descriptor becomes a Playwright
 * locator and each action the Director call of the same name. An action that fails names its JSON
 * path, so the author knows which entry of the config to fix.
 */

/** The part of a page that builds locators. */
export type LocatorSource = Pick<Page, "getByRole" | "getByText" | "getByLabel" | "getByTestId" | "locator">;

function toMatcher(match: TextMatch): string | RegExp {
  return typeof match === "string" ? match : new RegExp(match.regex, match.flags);
}

export function getLocator(page: LocatorSource, descriptor: LocatorDescriptor): Locator {
  const locator = buildLocator(page, descriptor);
  return descriptor.nth === null ? locator : locator.nth(descriptor.nth);
}

function buildLocator(page: LocatorSource, descriptor: LocatorDescriptor): Locator {
  switch (descriptor.kind) {
    case "role":
      return descriptor.name === null
        ? page.getByRole(descriptor.role)
        : page.getByRole(descriptor.role, { name: toMatcher(descriptor.name), ...(descriptor.exact ? { exact: true } : {}) });
    case "text":
      return page.getByText(toMatcher(descriptor.text), descriptor.exact ? { exact: true } : undefined);
    case "label":
      return page.getByLabel(toMatcher(descriptor.label), descriptor.exact ? { exact: true } : undefined);
    case "testId":
      return page.getByTestId(descriptor.testId);
    case "css":
      return descriptor.hasText === null ? page.locator(descriptor.css) : page.locator(descriptor.css, { hasText: toMatcher(descriptor.hasText) });
  }
}

function getLocators(page: LocatorSource, target: LocatorDescriptor | LocatorDescriptor[]): Locator | Locator[] {
  return Array.isArray(target) ? target.map((descriptor) => getLocator(page, descriptor)) : getLocator(page, target);
}

/** Plays one action on the Director; options the action leaves out keep the Director's defaults. */
export async function runAction(director: Director, action: SceneAction): Promise<void> {
  const { page } = director;
  switch (action.do) {
    case "wide":
      return director.wide({ ...(action.scale === undefined ? {} : { scale: action.scale }), ...(action.whoosh === undefined ? {} : { whoosh: action.whoosh }) });
    case "tap":
      return director.tap(getLocator(page, action.target), action.after === undefined ? undefined : { after: action.after });
    case "type":
      return director.type(action.text, action.perChar === undefined ? undefined : { perChar: action.perChar });
    case "fill":
      return director.fill(action.input, action.value);
    case "blur":
      return director.blur();
    case "focus":
      return director.focus(getLocators(page, action.target), {
        ...(action.scale === undefined ? {} : { scale: action.scale }),
        ...(action.height === undefined ? {} : { height: action.height }),
      });
    case "bring":
      return director.bring(getLocator(page, action.target), {
        ...(action.top === undefined ? {} : { top: action.top }),
        ...(action.seconds === undefined ? {} : { seconds: action.seconds }),
      });
    case "mark":
      return director.mark(action.name, getLocators(page, action.target));
    case "still":
      return director.still(action.name);
    case "cue":
      return director.cue(action.name);
    case "hold":
      return director.hold(action.seconds);
    case "until":
      return director.until(action.word);
    case "checkScreen":
      return director.checkScreen();
  }
}

/** The same error with the action's JSON path in front; the screen guard keeps its own class (exit code 2). */
function withPath(error: unknown, where: string): Error {
  const message = `${where}: ${error instanceof Error ? error.message : String(error)}`;
  if (error instanceof ScreenGuardError) return new ScreenGuardError(message, { cause: error });
  return new Error(message, { cause: error });
}

/** The scene of a video described by beat `actions`; `videoIndex` is its position in `videos`. */
export function createActionScene(beats: readonly ActionBeat[], videoIndex: number): Scene {
  return async (director) => {
    for (const beat of beats) {
      await director.beat(
        beat.id,
        async () => {
          for (const [actionIndex, action] of beat.actions.entries()) {
            try {
              await runAction(director, action);
            } catch (error) {
              throw withPath(error, `${formatIssuePath(["videos", videoIndex, "beats", beat.index, "actions", actionIndex])} (${action.do})`);
            }
          }
        },
        beat.pad === null ? undefined : { pad: beat.pad },
      );
    }
  };
}
