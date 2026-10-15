"use client";

import { formatMessage } from "@softure-ai/core";
import type { ReactNode } from "react";
import type { LinkComponentType } from "./button.js";
import { type ClassNames, createSlotClassGetter, joinClasses } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { CheckIcon } from "./icons.js";
import { useUiCopyProps } from "./locale.js";

// An onboarding list: what is done and what is left, each open item a link to where it gets done. The state is
// read by screen readers after each name ("(done)", "(to do)"), not only drawn as a check. With `rowLink` the whole row
// (marker, label, description and the trailing node) is one link, a bigger target on a phone.

export type ChecklistSlot =
  | "root"
  | "progress"
  | "list"
  | "item"
  | "row"
  | "marker"
  | "body"
  | "label"
  | "link"
  | "description"
  | "trailing";

export interface ChecklistItem {
  readonly id: string;
  readonly label: string;
  readonly done: boolean;
  /** Where the item gets done; an open item with `href` is a link (a done one too with `linkDone`). */
  readonly href?: string;
  readonly description?: string;
}

/** Draws the node after an item's body; `isLink` says whether the row opens something. */
export type ChecklistTrailingRenderer = (item: ChecklistItem, context: { readonly isLink: boolean }) => ReactNode;

export interface ChecklistProps extends CopyProps<"checklist"> {
  readonly items: readonly ChecklistItem[];
  /** Renders each link (for example Next's `Link`); a plain `<a>` when omitted. */
  readonly LinkComponent?: LinkComponentType;
  /** Shows "2 of 4 done" above the list; `true` by default. */
  readonly showProgress?: boolean;
  /** Makes the whole row the link (marker, body and `trailing` inside it); `false` links only the label. */
  readonly rowLink?: boolean;
  /** Shown after each item's body, e.g. an `aria-hidden` chevron; a function draws it per item. */
  readonly trailing?: ReactNode | ChecklistTrailingRenderer;
  /** A done item with `href` is a link too (to revisit the step); `false` by default. */
  readonly linkDone?: boolean;
  readonly classNames?: ClassNames<ChecklistSlot>;
  readonly unstyled?: boolean;
}

const MARKER_BASE =
  "sft:mt-px sft:inline-flex sft:size-5 sft:shrink-0 sft:items-center sft:justify-center sft:rounded-full sft:border sft:[&>svg]:size-3";

const MARKER_DONE = "sft:border-accent-fill sft:bg-accent-fill sft:text-on-accent";
const MARKER_OPEN = "sft:border-border-strong";
const LABEL_DONE = "sft:text-muted";
const LABEL_OPEN = "sft:text-foreground";

/** An onboarding checklist of done and open items. */
export function Checklist({
  items,
  LinkComponent,
  showProgress = true,
  rowLink = false,
  trailing,
  linkDone = false,
  classNames,
  unstyled,
  locale,
  messages,
}: ChecklistProps) {
  const copy = getCopy("checklist", useUiCopyProps("checklist", { locale, messages }));
  const doneCount = items.filter((item) => item.done).length;
  const slot = createSlotClassGetter<ChecklistSlot>({
    defaults: {
      root: "sft:font-sans",
      progress: "sft:mt-0 sft:mb-2 sft:text-xs sft:text-muted",
      list: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-2 sft:p-0",
      item: "sft:flex sft:items-start sft:gap-2.5 sft:text-sm",
      row: "sft:-mx-2 sft:flex sft:min-w-0 sft:flex-1 sft:items-start sft:gap-2.5 sft:rounded-control sft:px-2 sft:py-1.5 sft:no-underline sft:hover:bg-surface-raised sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus",
      marker: "",
      body: "sft:flex sft:min-w-0 sft:flex-col sft:gap-0.5",
      label: "",
      link: "sft:font-medium sft:text-foreground sft:underline sft:underline-offset-2 sft:hover:text-accent sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus",
      description: "sft:text-xs sft:text-muted",
      trailing: "sft:ml-auto sft:inline-flex sft:shrink-0 sft:self-center sft:text-muted",
    },
    classNames,
    unstyled,
  });
  // The marker and the label look follow the item's state; `unstyled` keeps only the app's classes.
  const markerClass = (done: boolean) =>
    joinClasses(unstyled === true ? undefined : `${MARKER_BASE} ${done ? MARKER_DONE : MARKER_OPEN}`, slot("marker"));
  const labelClass = (done: boolean) => joinClasses(unstyled === true ? undefined : done ? LABEL_DONE : LABEL_OPEN, slot("label"));
  return (
    <div className={slot("root")}>
      {showProgress ? <p className={slot("progress")}>{formatMessage(copy.progress, { done: doneCount, total: items.length })}</p> : null}
      <ul className={slot("list")}>
        {items.map((item) => {
          const href = item.done && !linkDone ? undefined : item.href;
          const isLink = href !== undefined;
          const text = (
            <>
              {item.label}
              <span className="sft:sr-only"> {item.done ? copy.done : copy.todo}</span>
            </>
          );
          const after = typeof trailing === "function" ? trailing(item, { isLink }) : trailing;
          const isRowLink = rowLink && isLink;
          const content = (
            <>
              <span aria-hidden="true" className={markerClass(item.done)}>
                {item.done ? <CheckIcon /> : null}
              </span>
              <span className={slot("body")}>
                {isLink && !isRowLink ? (
                  LinkComponent === undefined ? (
                    <a href={href} className={slot("link")}>
                      {text}
                    </a>
                  ) : (
                    <LinkComponent href={href} className={slot("link")}>
                      {text}
                    </LinkComponent>
                  )
                ) : (
                  <span className={labelClass(item.done)}>{text}</span>
                )}
                {item.description === undefined ? null : <span className={slot("description")}>{item.description}</span>}
              </span>
              {after === undefined || after === null ? null : <span className={slot("trailing")}>{after}</span>}
            </>
          );
          return (
            <li key={item.id} data-done={item.done ? "" : undefined} className={slot("item")}>
              {isRowLink ? (
                LinkComponent === undefined ? (
                  <a href={href} className={slot("row")}>
                    {content}
                  </a>
                ) : (
                  <LinkComponent href={href} className={slot("row")}>
                    {content}
                  </LinkComponent>
                )
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
