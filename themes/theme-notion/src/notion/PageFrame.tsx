import type { ReactNode } from "react";

export interface PageFrameProps {
  children: ReactNode;
}

/**
 * A page outside the app shell (the sign-in and account pages of the packages, the not-found page): the window's
 * height on the Notion background, with the package's `--sft-*` tokens re-pointed at the Notion theme
 * (`src/app/sft-bridge.css`). No `data-slot`: the scoped preflight stays off the package pages.
 */
export function PageFrame({ children }: PageFrameProps) {
  return (
    <div data-page-frame="" className="min-h-dvh bg-background font-sans text-ui text-foreground">
      {children}
    </div>
  );
}
