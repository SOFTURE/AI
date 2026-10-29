/** What the install offer shows: the iOS steps (Share, then "Add to Home Screen"), the browser's prompt, or nothing. */
export type InstallOffer = "ios_steps" | "browser_prompt" | "none";

export interface InstallOfferFacts {
  /** An iPhone, iPod or iPad (`isIosDevice`). */
  readonly isIos: boolean;
  /** A phone by the browser's own report (`isPhoneDevice`). */
  readonly isPhone: boolean;
  /** Running as the installed app (`isInstalledApp`). */
  readonly isInstalled: boolean;
  /** The user closed the offer on this device (`isInstallOfferClosed`). */
  readonly isClosed: boolean;
  /** The browser's prompt is kept and unused (`installPromptStore`). */
  readonly hasPrompt: boolean;
}

/**
 * The offer for these facts. iOS has no install prompt, so an iOS device gets the steps; an iPad that reports a Mac
 * user agent is not a phone by user agent but installs the same way. Any other device gets the browser's prompt only
 * on a phone, so a desktop never gets an offer.
 */
export function pickInstallOffer({ isIos, isPhone, isInstalled, isClosed, hasPrompt }: InstallOfferFacts): InstallOffer {
  if (isInstalled || isClosed) return "none";
  if (isIos) return "ios_steps";
  if (isPhone && hasPrompt) return "browser_prompt";
  return "none";
}
