import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { Badge } from "../ui/badge.js";

import { DetailTable, type DetailRow } from "./DetailTable.js";
import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
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
    /** Indents the opened content to line up with the title after the chevron; by default it is padded equally. */
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
     * Controls at the right end of the row's bar (a delete button, a menu). They sit beside the `<summary>`, not in
     * it, so clicking them never folds the row, but they share its background: the bar runs under them when the row
     * is open or hovered. Shown whether the row is open or closed, centred on the summary's first line.
     */
    readonly actions?: ReactNode;
  };

const CONTENT_CLASS = "flex flex-col gap-2 p-3 empty:hidden";
const INSET_CONTENT_CLASS = "flex flex-col gap-2 py-2 pr-1 pl-6 empty:hidden";

function FoldRowFixedSummary({
  title,
  facts = [],
  badges,
}: {
  readonly title: ReactNode;
  readonly facts?: readonly ReactNode[];
  readonly badges: readonly FoldRowBadge[];
}) {
  return (
    <>
      {/* The chevron and the title wrap as one: a long title folds onto lines beside its chevron. */}
      <span data-slot="fold-row-heading" className="flex min-w-0 items-center gap-2">
        <FoldRowChevron />
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

function FoldRowChevron() {
  return (
    <ChevronRight
      aria-hidden="true"
      strokeWidth={ICON_STROKE_WIDTH}
      className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open/fold-row:rotate-90"
    />
  );
}

// An item as one folding list row: a native `<details>` that opens in place to its details, with no client state.
export function FoldRow(props: FoldRowProps) {
  const { actions, size = "default" } = props;
  if (actions === undefined || actions === null) {
    return <FoldRowDetails {...props} className="border-b border-border" />;
  }
  // The actions sit beside the `<details>`, not in its `<summary>`: a control inside the summary would fold the row.
  // They carry the summary's background (the details is their peer: open; the wrapper is the hover group), so the
  // summary and the actions read as one bar with the controls at its right end.
  return (
    <div data-slot="fold-row-with-actions" className="group/fold-row-with-actions flex items-start border-b border-border">
      <FoldRowDetails {...props} className="peer/fold-row min-w-0 flex-1" hasActions />
      <div
        data-slot="fold-row-actions"
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-r-md pr-1 transition-colors duration-120 group-hover/fold-row-with-actions:bg-accent peer-open/fold-row:bg-accent",
          size === "touch" ? "min-h-touch-target" : "min-h-row-height",
        )}
      >
        {actions}
      </div>
    </div>
  );
}

function FoldRowDetails(props: FoldRowProps & { readonly className: string; readonly hasActions?: boolean }) {
  const { isInset = false, isOpenInitially = false, size = "default", children, className, hasActions = false } = props;
  return (
    <details data-slot="fold-row" open={isOpenInitially || undefined} className={cn("group/fold-row", className)}>
      <summary
        data-slot="fold-row-summary"
        className={cn(
          "flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-1 py-1 transition-colors duration-120 group-open/fold-row:bg-accent hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden",
          size === "touch" ? "min-h-touch-target" : "min-h-row-height",
          // With actions the bar continues under them: no rounding on the right, and hovering them lights it too.
          hasActions && "rounded-r-none group-hover/fold-row-with-actions:bg-accent",
        )}
      >
        {props.summary === undefined ? (
          <FoldRowFixedSummary title={props.title} facts={props.facts} badges={props.badges ?? []} />
        ) : (
          <>
            <FoldRowChevron />
            <span
              data-slot="fold-row-summary-slot"
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1"
            >
              {props.summary}
            </span>
          </>
        )}
      </summary>
      <div data-slot="fold-row-content" data-inset={isInset} className={isInset ? INSET_CONTENT_CLASS : CONTENT_CLASS}>
        {props.details === undefined ? null : <DetailTable label={props.detailsLabel} rows={props.details} />}
        {children}
      </div>
    </details>
  );
}
