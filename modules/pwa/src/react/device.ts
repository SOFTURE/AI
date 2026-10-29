/** The parts of `navigator` the device facts read; the browser's own by default. */
export interface DeviceNavigator {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** Chromium's client hints: `mobile` is the browser's own phone flag. */
  readonly userAgentData?: { readonly mobile: boolean };
  /** iOS Safari: `true` inside an app started from the home screen. */
  readonly standalone?: boolean;
}

/** The parts of `window` `isInstalledApp` reads. */
export interface DeviceWindow {
  readonly navigator: DeviceNavigator;
  readonly matchMedia: (query: string) => { readonly matches: boolean };
}

const IOS_USER_AGENT = /iPhone|iPad|iPod/;
const MAC_USER_AGENT = /Macintosh/;
const PHONE_USER_AGENT = /Mobi|Android/;

/** An iPhone, iPod or iPad, including an iPad that reports a Mac user agent (a Mac has no multi-touch screen). */
export function isIosDevice(nav: DeviceNavigator = navigator): boolean {
  if (IOS_USER_AGENT.test(nav.userAgent)) return true;
  return MAC_USER_AGENT.test(nav.userAgent) && nav.maxTouchPoints > 1;
}

/** A phone: the browser's `userAgentData.mobile` where it has one, else `Mobi` or `Android` in the user agent. */
export function isPhoneDevice(nav: DeviceNavigator = navigator): boolean {
  if (nav.userAgentData !== undefined) return nav.userAgentData.mobile;
  return PHONE_USER_AGENT.test(nav.userAgent);
}

/** Running as the installed app: `display-mode: standalone`, or iOS Safari's `navigator.standalone`. */
export function isInstalledApp(win: DeviceWindow = window): boolean {
  return win.matchMedia("(display-mode: standalone)").matches || win.navigator.standalone === true;
}
