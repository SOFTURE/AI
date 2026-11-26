import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { Badge } from "../ui/badge.js";

import { DetailTable, type DetailRow } from "./DetailTable.js";
import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import type { SideLayout } from "./List.js";
import { TONE_COLORS, type Tone } from "./tones.js";

export interface FoldRowBadge {
  /** Unique within the row; kept on the badge as `data-badge`. */
  readonly key: string;
  readonly text: string;
  readonly tone?: Tone;
}

/** The row's summary: the fixed title, facts and badges, or a node of the app's own. */
export type FoldRowSummaryProps =
  | {
      readonly title: ReactNode;
      /** Short facts after the title; left out when empty. */
      readonly facts?: readonly ReactNode[];
      /** Badges on the row's right, in order. */
      readonly badges: readonly FoldRowBadge[];
      readonly summary?: never;
    }
  | {
      /** Drawn after the chevron in place of the title, facts and badges, as a wrapping row. */
      readonly summary: ReactNode;
      readonly title?: never;
      readonly facts?: never;
      readonly badges?: never;
    };

/** The details table at the top of the opened content, or none. */
export type FoldRowDetailsProps =
  | {
      /** The details table's accessible name. */
      readonly detailsLabel: string;
      readonly details: readonly DetailRow[];
    }
  | {
      readonly detailsLabel?: never;
      readonly details?: never;
    };

export type FoldRowProps = FoldRowSummaryProps &
  FoldRowDetailsProps & {
    /** Indents the opened content to line up with the title after the chevron; by default it starts under the chevron. */
    readonly isInset?: boolean;
    /** `touch` makes the summary at least the touch target high (44 px) instead of the row height. */
    readonly size?: "default" | "touch";
    /** More content under the table when opened. */
    readonly children?: ReactNode;
    /**
     * Renders the row open (`<details open>`), for a row the address points at; the reader still folds it. Only the
     * first render reads it: the native element keeps its own state afterwards.
     */
    readonly isOpenInitially?: boolean;
    /**
     * Controls in the right column of the row's bar (a delete button, a menu). The column sits beside the `<summary>`,
     * not in it, so clicking a control never folds the row; it spans the summary's full height and lights with it when
     * the row is open or hovered, so the bar reads as one box. On a phone (below `md`) the column falls under the
     * summary and each control is at least the touch target (44 px).
     */
    readonly actions?: ReactNode;
    /** The item's status, drawn in the same column above the actions (with no actions, the column holds only it). */
    readonly status?: ReactNode;
    /**
     * How the bar lines up with a summary of several lines. `center` (default) centres the chevron and the right
     * column vertically; `start` puts the chevron on the summary's first line (one line of `ui` text) and the right
     * column at the top, the status on the first line and the actions under it.
     */
    readonly align?: FoldRowAlign;
    /**
     * How the right column lays out the status and the actions from `md` up. `stack` (default): the status on top,
     * the actions under it. `inline`: the status left of the actions, on one line, right-aligned (centred on the bar
     * with `align="center"`, at its top with `align="start"`). Below `md` the column is one line under the summary
     * either way.
     */
    readonly sideLayout?: SideLayout;
  };

export type FoldRowAlign = "center" | "start";

const ITEMS_CLASS: Record<FoldRowAlign, string> = { center: "items-center", start: "items-start" };

// The right column from `md` up: a column (status over actions) or one line (status, then actions), placed on the bar
// by `align` along whichever axis runs across the bar.
const FOLD_ROW_COLUMN_CLASS: Record<SideLayout, Record<FoldRowAlign, string>> = {
  stack: {
    center: "md:flex-col md:flex-nowrap md:items-end md:justify-center md:gap-1",
    start: "md:flex-col md:flex-nowrap md:items-end md:justify-start md:gap-1",
  },
  inline: {
    center: "md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-2",
    start: "md:flex-row md:flex-wrap md:items-start md:justify-end md:gap-2",
  },
};

// The bar and its opened content share one 8 px horizontal inset, so the details start under the chevron; the inset
// variant starts under the title instead (8 px inset, 16 px chevron, 8 px gap).
const CONTENT_LAYOUT = "flex-col gap-2 px-2 py-3";
const INSET_CONTENT_LAYOUT = "flex-col gap-2 py-2 pr-2 pl-8";

function FoldRowFixedSummary({
  title,
  facts = [],
  badges,
  align,
}: {
  readonly title: ReactNode;
  readonly facts?: readonly ReactNode[];
  readonly badges: readonly FoldRowBadge[];
  readonly align: FoldRowAlign;
}) {
  return (
    <>
      {/* The chevron and the title wrap as one: a long title folds onto lines beside its chevron. */}
      <span data-slot="fold-row-heading" className={cn("flex min-w-0", ITEMS_CLASS[align], "gap-2")}>
        <FoldRowChevron align={align} />
        <span className="min-w-0 text-ui-medium">{title}</span>
      </span>
      {facts.map((fact, index) => (
        // Facts have no identity of their own; their order is fixed for one render.
        <span key={index} data-slot="fold-row-fact" className="text-ui text-muted-foreground">
          {fact}
        </span>
      ))}
      {badges.length === 0 ? null : (
        <span data-slot="fold-row-badges" className="ml-auto inline-flex flex-wrap gap-1">
          {badges.map((badge) => {
            const tone = badge.tone ?? "default";
            return (
              <Badge
                key={badge.key}
                variant="tag"
                color={TONE_COLORS[tone] ?? "default"}
                data-badge={badge.key}
                data-tone={tone}
              >
                {badge.text}
              </Badge>
            );
          })}
        </span>
      )}
    </>
  );
}

function FoldRowChevron({ align }: { readonly align: FoldRowAlign }) {
  const chevron = (
    <ChevronRight
      aria-hidden="true"
      strokeWidth={ICON_STROKE_WIDTH}
      className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open/fold-row:rotate-90"
    />
  );
  if (align === "center") {
    return chevron;
  }
  // A box one line of `ui` text high, so the chevron sits in the middle of the summary's first line.
  return (
    <span data-slot="fold-row-chevron" className="flex h-lh shrink-0 items-center text-ui">
      {chevron}
    </span>
  );
}

function isDrawn(node: ReactNode): boolean {
  return node !== undefined && node !== null;
}

// An item as one folding list row: a native `<details>` that opens in place to its details, with no client state.
export function FoldRow(props: FoldRowProps) {
  const { actions, status, isInset = false, align = "center", sideLayout = "stack" } = props;
  if (!isDrawn(actions) && !isDrawn(status)) {
    return (
      <FoldRowDetails
        {...props}
        className="border-b border-border"
        content={<FoldRowContent {...props} className={cn("flex", isInset ? INSET_CONTENT_LAYOUT : CONTENT_LAYOUT, "empty:hidden")} />}
      />
    );
  }
  // The right column sits beside the `<details>`, not in its `<summary>`: a control inside the summary would fold the
  // row. To make the column exactly as high as the summary, the `<details>` holds only its summary and shares a grid
  // row with the column (grid items stretch to their row); the opened content is the next row, shown while the
  // details is open (`peer-open`). The details and the column carry the bar's light together, so they read as one box.
  return (
    <div
      data-slot="fold-row-with-actions"
      className="group/fold-row-with-actions grid grid-cols-1 border-b border-border md:grid-cols-[minmax(0,1fr)_auto]"
    >
      <FoldRowDetails
        {...props}
        className="peer/fold-row min-w-0 rounded-md transition-colors duration-120 group-hover/fold-row-with-actions:bg-accent open:bg-accent max-md:rounded-b-none md:rounded-r-none"
        isLitByRow
      />
      <div
        data-slot="fold-row-actions"
        data-side-layout={sideLayout}
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-b-md pr-2 pb-1 pl-8 transition-colors duration-120 group-hover/fold-row-with-actions:bg-accent peer-open/fold-row:bg-accent",
          FOLD_ROW_COLUMN_CLASS[sideLayout][align],
          "md:rounded-b-none md:rounded-r-md md:py-1 md:pl-0",
        )}
      >
        {isDrawn(status) ? (
          <div data-slot="fold-row-status" className="flex items-center">
            {status}
          </div>
        ) : null}
        {isDrawn(actions) ? (
          <div
            data-slot="fold-row-action-list"
            className="flex items-center gap-1 max-md:*:min-h-touch-target max-md:*:min-w-touch-target"
          >
            {actions}
          </div>
        ) : null}
      </div>
      <FoldRowContent
        {...props}
        className={cn("col-span-full hidden", isInset ? INSET_CONTENT_LAYOUT : CONTENT_LAYOUT, "peer-open/fold-row:not-empty:flex")}
      />
    </div>
  );
}

function FoldRowContent(props: FoldRowProps & { readonly className: string }) {
  const { isInset = false, children, className } = props;
  return (
    <div data-slot="fold-row-content" data-inset={isInset} className={className}>
      {props.details === undefined ? null : <DetailTable label={props.detailsLabel} rows={props.details} />}
      {children}
    </div>
  );
}

function FoldRowDetails(
  props: FoldRowProps & {
    readonly className: string;
    /** The summary lights on its own, or the wrapper lights the whole details (with the right column). */
    readonly isLitByRow?: boolean;
    /** The opened content, when it lives inside the details. */
    readonly content?: ReactNode;
  },
) {
  const { isOpenInitially = false, size = "default", align = "center", className, isLitByRow = false, content } = props;
  return (
    <details data-slot="fold-row" open={isOpenInitially || undefined} className={cn("group/fold-row", className)}>
      <summary
        data-slot="fold-row-summary"
        className={cn(
          "flex cursor-pointer list-none flex-wrap",
          ITEMS_CLASS[align],
          "gap-x-2 gap-y-1 rounded-md px-2 py-1",
          !isLitByRow && "transition-colors duration-120 group-open/fold-row:bg-accent hover:bg-accent",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden",
          size === "touch" ? "min-h-touch-target" : "min-h-row-height",
        )}
      >
        {props.summary === undefined ? (
          <FoldRowFixedSummary title={props.title} facts={props.facts} badges={props.badges ?? []} align={align} />
        ) : (
          <>
            <FoldRowChevron align={align} />
            <span
              data-slot="fold-row-summary-slot"
              className={cn("flex min-w-0 flex-1 flex-wrap", ITEMS_CLASS[align], "gap-x-2 gap-y-1")}
            >
              {props.summary}
            </span>
          </>
        )}
      </summary>
      {content}
    </details>
  );
}
