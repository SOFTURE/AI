import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

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
    /** More content under the table when opened. */
    readonly children?: ReactNode;
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
  const { isInset = false, children } = props;
  return (
    <details
      data-slot="fold-row"
      data-inset={isInset ? "true" : undefined}
      className="group/fold-row border-b border-border"
    >
      <summary
        data-slot="fold-row-summary"
        className="flex min-h-row-height cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-1 py-1 transition-colors duration-120 group-open/fold-row:bg-accent hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden"
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
      <div data-slot="fold-row-content" className={isInset ? INSET_CONTENT_CLASS : CONTENT_CLASS}>
        {props.details === undefined ? null : <DetailTable label={props.detailsLabel} rows={props.details} />}
        {children}
      </div>
    </details>
  );
}
