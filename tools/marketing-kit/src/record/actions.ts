import type { Locator } from "playwright";

import type { LocatorDescriptor, SceneAction } from "../config/actions-schema.js";
import type { ActionBeat } from "../config/config.js";
import { formatIssuePath } from "../config/issues.js";
import type { Director, Scene } from "../film.js";
import { getLocator, type LocatorSource } from "./locator.js";
import { ScreenGuardError } from "./record.js";

export { getLocator, type LocatorSource };

/**
 * Beat `actions` from `marketing.json`, played on the Director: each descriptor becomes a Playwright
 * locator and each action the Director call of the same name. An action that fails names its JSON
 * path, so the author knows which entry of the config to fix.
 */

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
    case "press":
      return director.press(action.key, {
        ...(action.times === undefined ? {} : { times: action.times }),
        ...(action.perKey === undefined ? {} : { perKey: action.perKey }),
      });
    case "fill":
      return director.fill(action.input, action.value, action.clear === undefined ? undefined : { clear: action.clear });
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
