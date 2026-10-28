import type { ReactNode } from "react";

export interface PageFrameProps {
  children: ReactNode;
}

/**
 * A page outside the app shell (the sign-in and account pages of the packages, the not-found page): the window's
 * height on the Notion background, with the package's `--sft-*` tokens re-pointed at the Notion theme
 * (`src/app/sft-bridge.css`), padded by the screen's safe-area insets for an app drawn under a phone's notch and home
 * indicator (`viewport-fit=cover`; the insets are 0 elsewhere). No `data-slot`: the scoped preflight stays off the package pages.
 */
export function PageFrame({ children }: PageFrameProps) {
  return (
    <div data-page-frame="" className="min-h-dvh bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] font-sans text-ui text-foreground">
      {children}
    </div>
  );
}
