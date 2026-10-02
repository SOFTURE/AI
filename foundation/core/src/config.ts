// The app configuration (docs/02-module-standard.md §7). Phase 3 adds `defineSoftureConfig`.
import type { Locale } from "./i18n.js";
import type { AnySoftureModule } from "./module.js";

export interface SoftureConfig {
  /** `null` when the app has no database; required as soon as a module has a `dbSchema`. */
  readonly database: { readonly url: string } | null;
  readonly locale: Locale;
  /** IANA time zone used for every date shown or computed per calendar day. */
  readonly timezone: string;
  /** Scheme, host and port of the app, without a path: `https://app.example.com`. */
  readonly appOrigin: string;
  /** Enabled modules, in the order the app listed them. */
  readonly modules: readonly AnySoftureModule[];
}
