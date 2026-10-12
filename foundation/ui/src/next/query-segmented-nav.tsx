"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { LinkComponentProps } from "../ui/button.js";
import { getQueryHref } from "../ui/query-href.js";
import { SegmentedNav, type SegmentedNavProps } from "../ui/segmented-nav.js";

// `SegmentedNav` for views picked by a query parameter (`?view=chart`): each link sets the parameter and keeps the
// rest of the query string, and Next's `Link` navigates without scrolling to the top, so switching a view keeps
// the reader's place. `useSearchParams` makes a statically rendered route render this part on the client: wrap it
// in `<Suspense>` there, or Next's build stops with "useSearchParams() should be wrapped in a suspense boundary".

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
}

function ScrollKeepingLink(props: LinkComponentProps) {
  return <Link {...props} scroll={false} />;
}

/** Segmented links that switch a view through one query parameter, keeping the others and the scroll. */
export function QuerySegmentedNav<Id extends string>({ param, items, defaultId, ...nav }: QuerySegmentedNavProps<Id>) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const selected = new URLSearchParams(search).get(param);
  const current = items.find((item) => item.id === selected)?.id ?? defaultId;
  return (
    <SegmentedNav
      {...nav}
      current={current}
      LinkComponent={ScrollKeepingLink}
      items={items.map((item) => ({
        id: item.id,
        label: item.label,
        href: getQueryHref({ pathname, search, param, value: item.id === defaultId ? null : item.id }),
      }))}
    />
  );
}
