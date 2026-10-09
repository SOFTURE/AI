// What every blog component needs besides its own data: the copy, the locale, the paths, the app's
// brand and disclaimer, and the app's look (class slots, a layout). The Next adapter builds it once per
// request from the config; `getPageContext` (`/server`) does the same for any other renderer.
import type { Locale } from "@softure-ai/core";
import type { ReactNode } from "react";
import type { BlogMessages } from "../messages/index.js";
import type { Crumb } from "../pages/listing.js";
import type { BlogRoutes } from "../pages/paths.js";
import type { BlogClassNames } from "./class-names.js";

/** What the app's layout receives: the header's parts and the page's content. */
export interface BlogLayoutSlotProps {
  readonly context: BlogPageContext;
  readonly title: string;
  readonly lead?: string;
  /** Crumbs up to the page itself; render them with `Breadcrumbs` or the app's own. */
  readonly crumbs?: readonly Crumb[];
  /** Under the title: dates, reading time. */
  readonly meta?: ReactNode;
  readonly children: ReactNode;
}

/** The app's page frame in place of the package's `<main>` and header. */
export type BlogLayoutComponent = (props: BlogLayoutSlotProps) => ReactNode;

/** The app's look for the views, all optional; the ready-made pages take it as `view`. */
export interface BlogViewOptions {
  /** The app's class per element, added after the package's (or alone with `unstyled`). */
  readonly classNames?: BlogClassNames;
  /** Drop the package's `blog-*` classes; the app styles every slot itself. */
  readonly unstyled?: boolean;
  readonly layout?: BlogLayoutComponent;
  /** Replaces the configured disclaimer, e.g. a sentence with links. */
  readonly disclaimer?: ReactNode;
}

export interface BlogPageContext {
  readonly messages: BlogMessages;
  readonly locale: Locale;
  readonly routes: BlogRoutes;
  /** The method page's path; `null` when the app does not mount it (nothing links to it then). */
  readonly methodPath: string | null;
  /** The site's name for the signature; `null` without a brand. */
  readonly brand: string | null;
  /** The note under every text in the locale: a string renders in a paragraph, any other node as given; `null` without one. */
  readonly disclaimer: ReactNode;
  /** The listing's cluster anchor prefix (`<prefix>-<cluster>`); `cluster` when left out. */
  readonly clusterAnchorPrefix?: string;
  /** Whether the method page opens with the AI disclosure (`blog({ aiDisclosure: true })`). */
  readonly aiDisclosure?: boolean;
  readonly classNames?: BlogClassNames;
  readonly unstyled?: boolean;
  readonly layout?: BlogLayoutComponent;
}
