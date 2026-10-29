import { Download, Share, SquarePlus, X } from "lucide-react";

import { cn } from "../lib/utils.js";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert.js";
import { Button } from "../ui/button.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

/** The offer to show, as `useInstallOffer` in `@softure-ai/pwa/react` picks it. */
export type InstallBarOffer = "ios_steps" | "browser_prompt" | "none";

export interface InstallBarProps {
  /** `offer` from `useInstallOffer`: the browser's prompt button, the iOS steps, or nothing. */
  readonly offer: InstallBarOffer;
  readonly title: string;
  readonly description: string;
  /** The prompt button's text. */
  readonly install: string;
  /** The first iOS step, beside the Share icon. */
  readonly shareStep: string;
  /** The second iOS step, beside the Add to Home Screen icon. */
  readonly addStep: string;
  /** The close button's accessible name. */
  readonly close: string;
  /** The prompt button's action (`install` from `useInstallOffer`): the browser's install sheet. */
  readonly onInstall: () => void;
  /** The close button's action (`close` from `useInstallOffer`): the offer stays closed on this device. */
  readonly onClose: () => void;
  readonly className?: string;
}

// The offer to install the app on a phone: a floating alert at the bottom of the screen, inside the safe-area insets
// like UpdatePrompt, with the browser's install button or the two iOS steps (Share, then Add to Home Screen) and a
// close button, both at the touch size on a phone. A polite status: it never interrupts a screen reader. The copy is
// the app's (`pwaMessages.en.install` in `@softure-ai/pwa` has the English text, keyed like these props).
export function InstallBar({ offer, title, description, install, shareStep, addStep, close, onInstall, onClose, className }: InstallBarProps) {
  if (offer === "none") return null;
  return (
    <div
      data-slot="install-bar"
      data-offer={offer}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pt-4 pr-[calc(--spacing(4)+env(safe-area-inset-right))] pb-[calc(--spacing(4)+env(safe-area-inset-bottom))] pl-[calc(--spacing(4)+env(safe-area-inset-left))]",
        className,
      )}
    >
      <Alert role="status" aria-live="polite" className="pointer-events-auto max-w-md pr-14 shadow-menu md:pr-11">
        <Download strokeWidth={ICON_STROKE_WIDTH} />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p>{description}</p>
          {offer === "browser_prompt" ? (
            <Button size="touch" className="mt-1 md:h-7" onClick={onInstall}>
              {install}
            </Button>
          ) : (
            <ol data-slot="install-bar-steps" className="mt-1 grid gap-1.5 text-foreground">
              <li className="flex items-center gap-2">
                <Share aria-hidden="true" className="size-4 shrink-0" strokeWidth={ICON_STROKE_WIDTH} />
                {shareStep}
              </li>
              <li className="flex items-center gap-2">
                <SquarePlus aria-hidden="true" className="size-4 shrink-0" strokeWidth={ICON_STROKE_WIDTH} />
                {addStep}
              </li>
            </ol>
          )}
        </AlertDescription>
        <Button type="button" variant="ghost" size="icon-touch" aria-label={close} className="absolute top-0 right-0 md:top-1 md:right-1 md:size-7" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
        </Button>
      </Alert>
    </div>
  );
}
