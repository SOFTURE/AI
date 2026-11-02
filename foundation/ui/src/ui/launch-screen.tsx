import { type ClassNames, createSlotClassGetter, joinClasses } from "./class-names.js";
import { ProgressBar } from "./progress-bar.js";

// Server-safe. The loading states of an app's `app/loading.tsx`, streamed before any script of the app runs. Their
// `data-slot`s are the contract of `@softure-ai/pwa`'s launch counter (`buildLaunchProgressScript`), which finds its
// root from the inline script and moves the bar, its indicator and the percentage.

export type LaunchScreenSlot = "root" | "icon" | "name" | "bar" | "indicator" | "percent";

export interface LaunchScreenProps {
  /** The app's name, shown under its icon. */
  readonly name: string;
  /** The app's icon, e.g. `${ICONS_PATH}/icon-192.png` from `@softure-ai/pwa`: the manifest's mark. */
  readonly iconSrc: string;
  /** The progress bar's accessible name (`pwaMessages.en.launch.label` in `@softure-ai/pwa`). */
  readonly label: string;
  /** The counter's inline script (`buildLaunchProgressScript()` from `@softure-ai/pwa`); without it the bar stays at 0. */
  readonly script?: string;
  readonly classNames?: ClassNames<LaunchScreenSlot>;
  readonly unstyled?: boolean;
}

const LAUNCH_SCREEN_CLASSES: Readonly<Record<LaunchScreenSlot, string>> = {
  root: "sft:fixed sft:inset-0 sft:z-50 sft:flex sft:flex-col sft:items-center sft:justify-center sft:gap-4 sft:bg-background sft:p-6 sft:font-sans sft:text-foreground",
  icon: "sft:size-16 sft:rounded-card",
  name: "sft:m-0 sft:text-lg sft:font-semibold",
  bar: "sft:w-48",
  indicator: "",
  percent: "sft:m-0 sft:text-sm sft:text-muted sft:tabular-nums",
};

/**
 * The screen an installed app shows from its first byte until the page arrives: the app's icon and name, a progress
 * bar and a percentage on the theme's background, full screen. The percentage is hidden from screen readers (the
 * bar reports the value) and keeps the counter's text if React hydrates the screen.
 */
export function LaunchScreen({ name, iconSrc, label, script, classNames, unstyled }: LaunchScreenProps) {
  const slot = createSlotClassGetter({ defaults: LAUNCH_SCREEN_CLASSES, classNames, unstyled });
  return (
    <div data-slot="launch-screen" className={slot("root")}>
      <img data-slot="launch-screen-icon" src={iconSrc} alt="" width={64} height={64} className={slot("icon")} />
      <p data-slot="launch-screen-name" className={slot("name")}>
        {name}
      </p>
      <ProgressBar
        value={0}
        label={label}
        classNames={{ root: slot("bar"), indicator: slot("indicator") }}
        unstyled={unstyled}
      />
      <p data-slot="launch-screen-percent" aria-hidden="true" suppressHydrationWarning className={slot("percent")}>
        0%
      </p>
      {script === undefined ? null : <script dangerouslySetInnerHTML={{ __html: script }} />}
    </div>
  );
}

export type TopLoadingBarSlot = "root" | "bar" | "indicator";

export interface TopLoadingBarProps {
  /** The progress bar's accessible name (`pwaMessages.en.launch.label` in `@softure-ai/pwa`). */
  readonly label: string;
  /** 0–100 when the app knows the progress; left out, the bar slides indeterminately. */
  readonly value?: number;
  /**
   * The counter's inline script (`buildLaunchProgressScript({ rootSlot: "top-loading-bar" })` from `@softure-ai/pwa`).
   * Where the browser runs it (a streamed first load) its first value makes the bar determinate; where it does not
   * (a client-side navigation) the bar keeps sliding.
   */
  readonly script?: string;
  readonly classNames?: ClassNames<TopLoadingBarSlot>;
  readonly unstyled?: boolean;
}

const TOP_LOADING_BAR_CLASSES: Readonly<Record<TopLoadingBarSlot, string>> = {
  root: "sft:pointer-events-none sft:fixed sft:inset-x-0 sft:top-0 sft:z-50",
  bar: "",
  indicator: "",
};

/**
 * A thin bar along the top edge while a route loads on a wide screen: 2 px, square, on a transparent track, above the
 * page and never in the way of a pointer. `LaunchScreen` is its full-screen counterpart; `RouteLoading` picks one.
 */
export function TopLoadingBar({ label, value, script, classNames, unstyled }: TopLoadingBarProps) {
  const slot = createSlotClassGetter({ defaults: TOP_LOADING_BAR_CLASSES, classNames, unstyled });
  return (
    <div data-slot="top-loading-bar" className={slot("root")}>
      <ProgressBar
        value={value}
        label={label}
        size="hairline"
        classNames={{ root: slot("bar"), indicator: slot("indicator") }}
        unstyled={unstyled}
      />
      {script === undefined ? null : <script dangerouslySetInnerHTML={{ __html: script }} />}
    </div>
  );
}

export interface RouteLoadingProps {
  /** The app's name, on the launch screen. */
  readonly name: string;
  /** The app's icon, on the launch screen. */
  readonly iconSrc: string;
  /** Both bars' accessible name (`pwaMessages.en.launch.label` in `@softure-ai/pwa`). */
  readonly label: string;
  /** The launch screen's counter: `buildLaunchProgressScript()`. */
  readonly launchScript?: string;
  /** The top bar's counter: `buildLaunchProgressScript({ rootSlot: "top-loading-bar" })`. */
  readonly barScript?: string;
  readonly classNames?: {
    readonly launchScreen?: ClassNames<LaunchScreenSlot>;
    readonly topLoadingBar?: ClassNames<TopLoadingBarSlot>;
  };
  readonly unstyled?: boolean;
}

// Which screen shows is behaviour, so these stay under `unstyled` too: the launch screen below `md` or in an
// installed app (`display-mode: standalone`), the top bar on a wide screen in a browser tab. Each is one stacked
// media query, so no two display rules compete on order.
const LAUNCH_SCREEN_DISPLAY = "sft:md:[@media(display-mode:browser)]:hidden";
const TOP_LOADING_BAR_DISPLAY = "sft:hidden sft:md:[@media(display-mode:browser)]:block";

/**
 * The loading state for `app/loading.tsx`, picked by the browser so the page stays static: `LaunchScreen` on a phone
 * or in an installed app, `TopLoadingBar` on a wide screen in a browser tab. Both are streamed; CSS hides the other,
 * so screen readers meet one. The wrapper draws no box (`display: contents`).
 */
export function RouteLoading({ name, iconSrc, label, launchScript, barScript, classNames, unstyled }: RouteLoadingProps) {
  const launchScreen = classNames?.launchScreen;
  const topLoadingBar = classNames?.topLoadingBar;
  return (
    <div data-slot="route-loading" className="sft:contents">
      <LaunchScreen
        name={name}
        iconSrc={iconSrc}
        label={label}
        script={launchScript}
        classNames={{ ...launchScreen, root: joinClasses(launchScreen?.root, LAUNCH_SCREEN_DISPLAY) }}
        unstyled={unstyled}
      />
      <TopLoadingBar
        label={label}
        script={barScript}
        classNames={{ ...topLoadingBar, root: joinClasses(topLoadingBar?.root, TOP_LOADING_BAR_DISPLAY) }}
        unstyled={unstyled}
      />
    </div>
  );
}
