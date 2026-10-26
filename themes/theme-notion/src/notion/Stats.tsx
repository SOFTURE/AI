import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "../ui/badge.js";
import { Progress } from "../ui/progress.js";
import { cn } from "../lib/utils.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import { TONE_COLORS, TONE_FILL, TONE_TEXT, type Tone } from "./tones.js";

export interface StatsFoldProps {
  /** The section's heading. */
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}

// A screen's summary figures folded under a heading, closed by default: the design system's collapsible (a ghost row
// with a chevron that turns when open, the content indented under it), on native `<details>` so it needs no client.
export function StatsFold({ title, children, className }: StatsFoldProps) {
  return (
    <details data-slot="stats-fold" className={cn("group/stats-fold", className)}>
      <summary
        data-slot="stats-fold-summary"
        className="flex h-row-height cursor-pointer list-none items-center gap-1 rounded-md px-1 text-foreground transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden"
      >
        <ChevronRight
          aria-hidden="true"
          strokeWidth={ICON_STROKE_WIDTH}
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open/stats-fold:rotate-90"
        />
        <h2 className="text-ui-medium">{title}</h2>
      </summary>
      <div data-slot="stats-fold-content" className="flex flex-col gap-3 pt-2 pb-1 pl-6">
        {children}
      </div>
    </details>
  );
}

export interface StatCardAside {
  readonly text: string;
  readonly tone?: Tone;
}

export interface StatCard {
  /** Unique within the row; kept as `data-stat`. */
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: Tone;
  readonly aside?: StatCardAside;
  /** A bar under the figure, 0–100 (clamped); in the card's `tone` when it has one, primary otherwise. */
  readonly progress?: number;
  /** The bar's accessible name; defaults to `label`. */
  readonly progressLabel?: string;
}

export interface StatCardsProps {
  /** The list's accessible name. */
  readonly label: string;
  readonly cards: readonly StatCard[];
  /** The cards stretch across the column (min 14rem) instead of the narrow grid (min 10rem). */
  readonly isFullWidth?: boolean;
  /** Every card in one row from `sm` up, wrapping only on a phone. */
  readonly isOneRow?: boolean;
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

function getStatCardsLayout(isFullWidth: boolean, isOneRow: boolean): "row" | "full" | "grid" {
  if (isOneRow) return "row";
  return isFullWidth ? "full" : "grid";
}

// Summary figures as a row of cards wrapping on a narrow screen: the label, the figure in its tone's colour (never
// broken, tabular numbers), an optional bar under it, an optional note and an optional short figure on its right as a
// tag.
export function StatCards({ label, cards, isFullWidth = false, isOneRow = false }: StatCardsProps) {
  return (
    <ul
      aria-label={label}
      data-slot="stat-cards"
      data-layout={getStatCardsLayout(isFullWidth, isOneRow)}
      className={cn(
        "grid gap-2",
        isFullWidth
          ? "grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))]"
          : "grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))]",
        isOneRow && "sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none",
      )}
    >
      {cards.map((card) => {
        const tone = card.tone ?? "default";
        return (
          <li
            key={card.key}
            data-stat={card.key}
            className="flex min-w-0 items-start justify-between gap-2 rounded-lg bg-card p-3 text-card-foreground shadow-card"
          >
            <div className={cn("min-w-0", card.progress !== undefined && "flex-1")}>
              <div className="text-section-label text-muted-foreground">{card.label}</div>
              <div data-tone={tone} className={cn("mt-1 text-heading-3 whitespace-nowrap tabular-nums", TONE_TEXT[tone])}>
                {card.value}
              </div>
              {card.progress === undefined ? null : (
                <Progress
                  value={clampProgress(card.progress)}
                  aria-label={card.progressLabel ?? card.label}
                  data-slot="stat-card-progress"
                  className="mt-2"
                  indicatorClassName={card.tone === undefined ? undefined : TONE_FILL[card.tone]}
                />
              )}
              {card.hint === undefined ? null : <div className="mt-1 text-small text-muted-foreground">{card.hint}</div>}
            </div>
            {card.aside === undefined ? null : (
              <Badge
                variant="tag"
                color={TONE_COLORS[card.aside.tone ?? "default"] ?? "default"}
                data-slot="stat-card-aside"
                data-tone={card.aside.tone ?? "default"}
                className="text-small"
              >
                {card.aside.text}
              </Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface StatPill {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly tone?: Tone;
}

export interface StatPillsProps {
  /** The list's accessible name. */
  readonly label: string;
  readonly pills: readonly StatPill[];
}

// Small counts as "label **value**" tags in one row, wrapping only on a phone, each in its tone's colour.
export function StatPills({ label, pills }: StatPillsProps) {
  return (
    <ul aria-label={label} data-slot="stat-pills" className="flex flex-wrap gap-1.5 sm:flex-nowrap sm:overflow-x-auto">
      {pills.map((pill) => (
        <li key={pill.key} data-stat={pill.key} data-tone={pill.tone ?? "default"}>
          <Badge variant="tag" color={TONE_COLORS[pill.tone ?? "default"] ?? "default"}>
            {pill.label} <strong className="font-medium tabular-nums">{pill.value}</strong>
          </Badge>
        </li>
      ))}
    </ul>
  );
}
