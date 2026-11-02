import { cn } from "../lib/utils.js";
import { Progress } from "../ui/progress.js";

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
  readonly className?: string;
}

// A thin bar along the top edge while a route loads on a wide screen: 2 px, square, on a transparent track, above the
// page and never in the way of a pointer, so the page under it stays usable. `LaunchScreen` is its full-screen
// counterpart for a phone or an installed app; `RouteLoading` picks one of the two in the browser.
export function TopLoadingBar({ label, value, script, className }: TopLoadingBarProps) {
  return (
    <div data-slot="top-loading-bar" className={cn("pointer-events-none fixed inset-x-0 top-0 z-50", className)}>
      <Progress value={value} aria-label={label} className="h-0.5 rounded-none bg-transparent" />
      {script === undefined ? null : <script dangerouslySetInnerHTML={{ __html: script }} />}
    </div>
  );
}
