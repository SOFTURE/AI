import { cn } from "../lib/utils.js";
import { Progress } from "../ui/progress.js";

export interface LaunchScreenProps {
  /** The app's name, shown under its icon. */
  readonly name: string;
  /** The app's icon, e.g. `${ICONS_PATH}/icon-192.png` from `@softure-ai/pwa`: the manifest's mark. */
  readonly iconSrc: string;
  /** The progress bar's accessible name (`pwaMessages.en.launch.label` in `@softure-ai/pwa`). */
  readonly label: string;
  /** The counter's inline script (`buildLaunchProgressScript()` from `@softure-ai/pwa`); without it the bar stays at 0. */
  readonly script?: string;
  readonly className?: string;
}

// The screen an installed app shows from its first byte until the page arrives, streamed from `app/loading.tsx`: the
// app's icon and name, a progress bar and a percentage on the theme's background, full screen in light and dark. The
// counter script moves the bar, its indicator and the percentage through their `data-slot`s; the percentage is
// hidden from screen readers (the bar reports the value) and keeps the script's text if React hydrates the screen.
export function LaunchScreen({ name, iconSrc, label, script, className }: LaunchScreenProps) {
  return (
    <div
      data-slot="launch-screen"
      className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background p-6 text-foreground", className)}
    >
      <img data-slot="launch-screen-icon" src={iconSrc} alt="" width={64} height={64} className="size-16 rounded-2xl" />
      <p data-slot="launch-screen-name" className="text-lg font-semibold">
        {name}
      </p>
      <Progress value={0} aria-label={label} className="w-48" />
      <p data-slot="launch-screen-percent" aria-hidden="true" suppressHydrationWarning className="text-sm text-muted-foreground tabular-nums">
        0%
      </p>
      {script === undefined ? null : <script dangerouslySetInnerHTML={{ __html: script }} />}
    </div>
  );
}
