"use client";

import Link from "next/link";
import { type ReadonlyURLSearchParams, usePathname, useSearchParams } from "next/navigation";
import type { LinkComponentProps } from "../ui/button.js";
import { getQueryHref, type QueryHrefOptions } from "../ui/query-href.js";
import { SegmentedNav, type SegmentedNavProps } from "../ui/segmented-nav.js";

// `SegmentedNav` for views picked by a query parameter (`?view=chart`): each link sets the parameter and keeps the
// rest of the query string, and Next's `Link` navigates without scrolling to the top, so switching a view keeps
// the reader's place. `useSearchParams` makes a statically rendered route render this part on the client: wrap it
// in `<Suspense>` there, or Next's build stops with "useSearchParams() should be wrapped in a suspense boundary".
// Outside the App Router (the Pages Router, a static render in a unit test) both hooks return `null` although
// their types say otherwise: the query then counts as empty and the links are query-only (`?view=chart`).

export interface QuerySegmentedNavItem<Id extends string> {
  readonly id: Id;
  readonly label: string;
}

export interface QuerySegmentedNavProps<Id extends string> extends Omit<SegmentedNavProps<Id>, "items" | "current" | "LinkComponent"> {
  /** The query parameter that holds the view. */
  readonly param: string;
  readonly items: readonly QuerySegmentedNavItem<Id>[];
  /** The view without the parameter (and with a value no item has); its link removes the parameter. */
  readonly defaultId: Id;
  /** The view the server rendered (its own parsing of the query); when given it wins over the address. */
  readonly active?: Id;
}

/** `getQueryHref`, or a query-only address without a pathname; `?` rather than an empty href that keeps the query. */
function getItemHref({ pathname, ...query }: Omit<QueryHrefOptions, "pathname"> & { readonly pathname: string | null }): string {
  const href = getQueryHref({ pathname: pathname ?? "", ...query });
  return href === "" ? "?" : href;
}

function ScrollKeepingLink(props: LinkComponentProps) {
  return <Link {...props} scroll={false} />;
}

/** Segmented links that switch a view through one query parameter, keeping the others and the scroll. */
export function QuerySegmentedNav<Id extends string>({ param, items, defaultId, active, ...nav }: QuerySegmentedNavProps<Id>) {
  // Widened on purpose: next types both hooks as non-null, but they return `null` outside the App Router.
  const pathname: string | null = usePathname();
  const searchParams: ReadonlyURLSearchParams | null = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const selected = new URLSearchParams(search).get(param);
  const current = active ?? items.find((item) => item.id === selected)?.id ?? defaultId;
  return (
    <SegmentedNav
      {...nav}
      current={current}
      LinkComponent={ScrollKeepingLink}
      items={items.map((item) => ({
        id: item.id,
        label: item.label,
        href: getItemHref({ pathname, search, param, value: item.id === defaultId ? null : item.id }),
      }))}
    />
  );
}
