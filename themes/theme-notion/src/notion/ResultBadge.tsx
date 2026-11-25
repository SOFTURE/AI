import { Circle, CircleCheck, CircleMinus, CircleX, LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { Badge } from "../ui/badge.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import { TONE_COLORS, type Tone } from "./tones.js";

/** The icon a result badge draws for each tone when the app passes none. */
export const RESULT_BADGE_ICONS: Readonly<Record<Tone, LucideIcon>> = {
  default: Circle,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
  muted: CircleMinus,
};

export interface ResultBadgeProps {
  /** What the result means; the theme owns its colour (`TONE_COLORS`), so one result reads alike in every list. */
  readonly tone: Tone;
  /** The app's own icon in place of the tone's default (a spinning run defaults to a loader). */
  readonly icon?: LucideIcon;
  /** A run still in progress: the icon spins, unless the reader asked for reduced motion. */
  readonly isSpinning?: boolean;
  /** The word: a result always carries one, so results read apart without telling colours apart. */
  readonly children: ReactNode;
  /** The full word on hover; defaults to the word itself when it is a string or a number. */
  readonly title?: string;
  readonly className?: string;
}

/** The word as plain text, or undefined when it is any other node. */
function getPlainText(children: ReactNode): string | undefined {
  return typeof children === "string" || typeof children === "number" ? String(children) : undefined;
}

// A result (passed, failed, skipped, running): a filled tag in its tone's colour, with an icon and a word. The filled
// counterpart of `Status`, for a list whose rows each end in a result.
export function ResultBadge({ tone, icon, isSpinning = false, children, title, className }: ResultBadgeProps) {
  const Icon = icon ?? (isSpinning ? LoaderCircle : RESULT_BADGE_ICONS[tone]);
  return (
    <Badge
      variant="tag"
      color={TONE_COLORS[tone] ?? "default"}
      data-slot="result-badge"
      data-tone={tone}
      data-color={TONE_COLORS[tone] ?? "default"}
      data-spinning={isSpinning || undefined}
      title={title ?? getPlainText(children)}
      className={cn("gap-1 [&>svg]:size-3.5 [&>svg]:shrink-0", className)}
    >
      <Icon aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} className={isSpinning ? "motion-safe:animate-spin" : undefined} />
      <span data-slot="result-badge-label" className="min-w-0 truncate">
        {children}
      </span>
    </Badge>
  );
}
