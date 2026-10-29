import { RefreshCw } from "lucide-react";

import { cn } from "../lib/utils.js";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert.js";
import { Button } from "../ui/button.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

export interface UpdatePromptProps {
  /** A new build waits (`isUpdateReady` from `useServiceWorkerUpdate` in `@softure-ai/pwa/react`). */
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  /** The button's text. */
  readonly reload: string;
  /** The button's action (`activate` from `useServiceWorkerUpdate`): the new build takes over and the page reloads. */
  readonly onReload: () => void;
  readonly className?: string;
}

// The offer to reload into a new build: a floating alert at the bottom of the screen, above the home indicator and
// beside a notch (the safe-area insets), with a reload button at the touch height on a phone. It is a polite status,
// not an alert: the offer never interrupts what a screen reader is reading. The copy is the app's
// (`pwaMessages.en.update` in `@softure-ai/pwa` has the English text, keyed like these props).
export function UpdatePrompt({ open, title, description, reload, onReload, className }: UpdatePromptProps) {
  if (!open) return null;
  return (
    <div
      data-slot="update-prompt"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pt-4 pr-[calc(--spacing(4)+env(safe-area-inset-right))] pb-[calc(--spacing(4)+env(safe-area-inset-bottom))] pl-[calc(--spacing(4)+env(safe-area-inset-left))]",
        className,
      )}
    >
      <Alert role="status" aria-live="polite" className="pointer-events-auto max-w-md shadow-menu">
        <RefreshCw strokeWidth={ICON_STROKE_WIDTH} />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p>{description}</p>
          <Button size="touch" className="mt-1 md:h-7" onClick={onReload}>
            {reload}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
