import { LaunchScreen } from "./LaunchScreen.js";
import { TopLoadingBar } from "./TopLoadingBar.js";

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
}

// The loading state for `app/loading.tsx`, picked by the browser so the page stays static: the full-screen
// `LaunchScreen` below the `md` breakpoint or in an installed app (`display-mode: standalone`), the thin
// `TopLoadingBar` on a wide screen in a browser tab (`display-mode: browser`). Both are streamed; CSS hides the other,
// so screen readers meet one. The wrapper draws no box (`contents`). Each rule is one stacked media query, so no two display rules compete on order.
export function RouteLoading({ name, iconSrc, label, launchScript, barScript }: RouteLoadingProps) {
  return (
    <div data-slot="route-loading" className="contents">
      <LaunchScreen
        name={name}
        iconSrc={iconSrc}
        label={label}
        script={launchScript}
        className="md:[@media(display-mode:browser)]:hidden"
      />
      <TopLoadingBar label={label} script={barScript} className="hidden md:[@media(display-mode:browser)]:block" />
    </div>
  );
}
