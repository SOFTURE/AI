// What every blog component needs besides its own data: the copy, the locale, the paths and the
// app's brand and disclaimer. The Next adapter builds it once per request from the config.
import type { Locale } from "@softure-ai/core";
import type { BlogMessages } from "../messages/index.js";
import type { BlogRoutes } from "../pages/paths.js";

export interface BlogPageContext {
  readonly messages: BlogMessages;
  readonly locale: Locale;
  readonly routes: BlogRoutes;
  /** The method page's path; `null` when the app does not mount it (nothing links to it then). */
  readonly methodPath: string | null;
  /** The site's name for the signature; `null` without a brand. */
  readonly brand: string | null;
  /** The note under every text in the locale; `null` without one. */
  readonly disclaimer: string | null;
  /** The listing's cluster anchor prefix (`<prefix>-<cluster>`); `cluster` when left out. */
  readonly clusterAnchorPrefix?: string;
}
