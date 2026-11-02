import type { ReactNode } from "react";

import { Button, IconButton } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { CloseIcon, DownloadIcon, RefreshIcon, ShareIcon, SquarePlusIcon } from "./icons.js";

// Server-safe. The prompts of an installed app (`@softure-ai/pwa`): a floating panel at the bottom of the screen,
// inside the safe-area insets (above the home indicator, beside a notch), never covering the page around it. Each is
// a polite status: the offer never interrupts what a screen reader is reading. The copy is the app's
// (`pwaMessages.en` in `@softure-ai/pwa` has the English text, keyed like these props).

export type AppPromptSlot = "root" | "panel" | "icon" | "title" | "body" | "description" | "action";

const APP_PROMPT_CLASSES: Readonly<Record<AppPromptSlot, string>> = {
  root: "sft:pointer-events-none sft:fixed sft:inset-x-0 sft:bottom-0 sft:z-50 sft:flex sft:justify-center sft:pt-4 sft:pr-[calc(1rem+env(safe-area-inset-right))] sft:pb-[calc(1rem+env(safe-area-inset-bottom))] sft:pl-[calc(1rem+env(safe-area-inset-left))]",
  panel:
    "sft:pointer-events-auto sft:relative sft:box-border sft:grid sft:w-full sft:max-w-md sft:grid-cols-[auto_1fr] sft:items-start sft:gap-x-3 sft:gap-y-1 sft:rounded-card sft:border sft:border-border sft:bg-surface-raised sft:p-4 sft:font-sans sft:text-foreground sft:shadow-2",
  icon: "sft:row-span-2 sft:flex sft:pt-0.5",
  title: "sft:m-0 sft:text-sm sft:font-semibold",
  body: "sft:col-start-2 sft:grid sft:justify-items-start sft:gap-2 sft:text-sm sft:text-muted",
  description: "sft:m-0",
  // At least the 44 px touch target on a phone; `min-height`, so it never fights the button's own height.
  action: "sft:min-h-11 sft:md:min-h-0",
};

interface AppPromptFrameProps {
  readonly dataSlot: string;
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly classNames: ClassNames<AppPromptSlot> | undefined;
  readonly unstyled: boolean | undefined;
  readonly panelClass?: string;
  readonly dataOffer?: string;
  readonly children: ReactNode;
  readonly after?: ReactNode;
}

function AppPromptFrame({ dataSlot, icon, title, description, classNames, unstyled, panelClass, dataOffer, children, after }: AppPromptFrameProps) {
  const slot = createSlotClassGetter({ defaults: APP_PROMPT_CLASSES, classNames, unstyled });
  const panel = [slot("panel"), unstyled === true ? undefined : panelClass].filter((part) => part !== undefined).join(" ");
  return (
    <div data-slot={dataSlot} data-offer={dataOffer} className={slot("root")}>
      <div role="status" aria-live="polite" data-slot={`${dataSlot}-panel`} className={panel === "" ? undefined : panel}>
        <span className={slot("icon")}>{icon}</span>
        <p className={slot("title")}>{title}</p>
        <div className={slot("body")}>
          <p className={slot("description")}>{description}</p>
          {children}
        </div>
        {after}
      </div>
    </div>
  );
}

export interface UpdatePromptProps {
  /** A new build waits (`isUpdateReady` from `useServiceWorkerUpdate` in `@softure-ai/pwa/react`). */
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  /** The button's text. */
  readonly reload: string;
  /** The button's action (`activate` from `useServiceWorkerUpdate`): the new build takes over and the page reloads. */
  readonly onReload: () => void;
  readonly classNames?: ClassNames<AppPromptSlot>;
  readonly unstyled?: boolean;
}

/** The offer to reload into a new build, with a reload button. Nothing renders while `open` is false. */
export function UpdatePrompt({ open, title, description, reload, onReload, classNames, unstyled }: UpdatePromptProps) {
  if (!open) return null;
  return (
    <AppPromptFrame
      dataSlot="update-prompt"
      icon={<RefreshIcon size={20} />}
      title={title}
      description={description}
      classNames={classNames}
      unstyled={unstyled}
    >
      <Button variant="primary" classNames={{ root: getActionClass(classNames, unstyled) }} unstyled={unstyled} onClick={onReload}>
        {reload}
      </Button>
    </AppPromptFrame>
  );
}

/** The offer to show, as `useInstallOffer` in `@softure-ai/pwa/react` picks it. */
export type InstallBarOffer = "ios_steps" | "browser_prompt" | "none";

export type InstallBarSlot = AppPromptSlot | "steps" | "step" | "close";

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
  readonly classNames?: ClassNames<InstallBarSlot>;
  readonly unstyled?: boolean;
}

const INSTALL_BAR_CLASSES: Readonly<Record<"steps" | "step" | "close", string>> = {
  steps: "sft:m-0 sft:grid sft:list-none sft:gap-1.5 sft:p-0 sft:text-foreground",
  step: "sft:flex sft:items-center sft:gap-2",
  close: "sft:absolute sft:top-1 sft:right-1",
};

/**
 * The offer to install the app on a phone: the browser's install button, or the two iOS steps (Share, then Add to
 * Home Screen), and a close button at the 44 px touch size. Nothing renders for the offer `none`.
 */
export function InstallBar({ offer, title, description, install, shareStep, addStep, close, onInstall, onClose, classNames, unstyled }: InstallBarProps) {
  if (offer === "none") return null;
  const slot = createSlotClassGetter({ defaults: INSTALL_BAR_CLASSES, classNames, unstyled });
  return (
    <AppPromptFrame
      dataSlot="install-bar"
      dataOffer={offer}
      icon={<DownloadIcon size={20} />}
      title={title}
      description={description}
      classNames={classNames}
      unstyled={unstyled}
      panelClass="sft:pr-14"
      after={
        <IconButton label={close} size="lg" classNames={{ root: slot("close") }} unstyled={unstyled} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      }
    >
      {offer === "browser_prompt" ? (
        <Button variant="primary" classNames={{ root: getActionClass(classNames, unstyled) }} unstyled={unstyled} onClick={onInstall}>
          {install}
        </Button>
      ) : (
        <ol data-slot="install-bar-steps" className={slot("steps")}>
          <li className={slot("step")}>
            <ShareIcon />
            {shareStep}
          </li>
          <li className={slot("step")}>
            <SquarePlusIcon />
            {addStep}
          </li>
        </ol>
      )}
    </AppPromptFrame>
  );
}

function getActionClass(classNames: ClassNames<AppPromptSlot> | undefined, unstyled: boolean | undefined): string | undefined {
  return createSlotClassGetter({ defaults: APP_PROMPT_CLASSES, classNames, unstyled })("action");
}
