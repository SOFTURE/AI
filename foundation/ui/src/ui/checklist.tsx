"use client";

import { formatMessage } from "@softure-ai/core";
import type { LinkComponentType } from "./button.js";
import { type ClassNames, createSlotClassGetter, joinClasses } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { CheckIcon } from "./icons.js";
import { useUiLocale } from "./locale.js";

// An onboarding list: what is done and what is left, each open item a link to where it gets done. The state is
// read by screen readers after each name ("(done)", "(to do)"), not only drawn as a check.

export type ChecklistSlot = "root" | "progress" | "list" | "item" | "marker" | "body" | "label" | "link" | "description";

export interface ChecklistItem {
  readonly id: string;
  readonly label: string;
  readonly done: boolean;
  /** Where the item gets done; an open item with `href` is a link. */
  readonly href?: string;
  readonly description?: string;
}

export interface ChecklistProps extends CopyProps<"checklist"> {
  readonly items: readonly ChecklistItem[];
  /** Renders each link (for example Next's `Link`); a plain `<a>` when omitted. */
  readonly LinkComponent?: LinkComponentType;
  /** Shows "2 of 4 done" above the list; `true` by default. */
  readonly showProgress?: boolean;
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
export function Checklist({ items, LinkComponent, showProgress = true, classNames, unstyled, locale, messages }: ChecklistProps) {
  const copy = getCopy("checklist", { locale: useUiLocale(locale), messages });
  const doneCount = items.filter((item) => item.done).length;
  const slot = createSlotClassGetter<ChecklistSlot>({
    defaults: {
      root: "sft:font-sans",
      progress: "sft:mt-0 sft:mb-2 sft:text-xs sft:text-muted",
      list: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-2 sft:p-0",
      item: "sft:flex sft:items-start sft:gap-2.5 sft:text-sm",
      marker: "",
      body: "sft:flex sft:min-w-0 sft:flex-col sft:gap-0.5",
      label: "",
      link: "sft:font-medium sft:text-foreground sft:underline sft:underline-offset-2 sft:hover:text-accent sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus",
      description: "sft:text-xs sft:text-muted",
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
          const isLink = !item.done && item.href !== undefined;
          const text = (
            <>
              {item.label}
              <span className="sft:sr-only"> {item.done ? copy.done : copy.todo}</span>
            </>
          );
          return (
            <li key={item.id} data-done={item.done ? "" : undefined} className={slot("item")}>
              <span aria-hidden="true" className={markerClass(item.done)}>
                {item.done ? <CheckIcon /> : null}
              </span>
              <span className={slot("body")}>
                {isLink && item.href !== undefined ? (
                  LinkComponent === undefined ? (
                    <a href={item.href} className={slot("link")}>
                      {text}
                    </a>
                  ) : (
                    <LinkComponent href={item.href} className={slot("link")}>
                      {text}
                    </LinkComponent>
                  )
                ) : (
                  <span className={labelClass(item.done)}>{text}</span>
                )}
                {item.description === undefined ? null : <span className={slot("description")}>{item.description}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
