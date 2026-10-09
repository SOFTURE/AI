// A compact label of where an account stands: "Trial · 5 days left", "Paid · until November 30,
// 2026", "Lifetime access", "Unlimited access" (an end so far away it does not matter, when the app
// sets `unlimitedAfterDays`) or "Read-only". Server-safe: it renders from props, so a server
// component passes the entitlement it read (`CurrentAccessBadge` in `/next` does).
import { formatMessage, type Locale } from "@softure-ai/core";
import { type ClassNames, createSlotClassGetter } from "@softure-ai/ui";
import type { Entitlement } from "../contract.js";
import type { BillingMessages } from "../messages/index.js";
import { formatDayCount, formatDaysLeft, formatLastDay, formatShortLastDay } from "./format.js";

export type AccessBadgeSlot = "root" | "status" | "detail";

/** What the badge shows, one tone each. */
export type AccessBadgeKind = "trial" | "trial-ending" | "paid" | "paid-ending" | "lifetime" | "unlimited" | "read-only";

export type AccessTone = "neutral" | "success" | "warning" | "danger";

export interface AccessBadgeKindOptions {
  /** Trial or dated paid access with more days left than this reads as unlimited. Unset: never. */
  readonly unlimitedAfterDays?: number;
}

export interface AccessBadgeProps {
  readonly entitlement: Entitlement;
  readonly messages: BillingMessages;
  readonly locale: Locale;
  /** The app's IANA time zone, for the dates shown. */
  readonly timezone: string;
  /** Trial or dated paid access with more days left than this reads "Unlimited access". Unset: never. */
  readonly unlimitedAfterDays?: number;
  /** A shorter detail: "5 days" for a trial, the numeric last day for paid access. */
  readonly compact?: boolean;
  /** The status colour per kind; kinds left out keep their default tone. */
  readonly tones?: Partial<Record<AccessBadgeKind, AccessTone>>;
  readonly classNames?: ClassNames<AccessBadgeSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_TONES: Readonly<Record<AccessBadgeKind, AccessTone>> = {
  trial: "neutral",
  "trial-ending": "warning",
  paid: "success",
  "paid-ending": "warning",
  lifetime: "success",
  unlimited: "success",
  "read-only": "danger",
};

const TONE: Readonly<Record<AccessTone, string>> = {
  neutral: "sft:text-foreground",
  success: "sft:text-success",
  warning: "sft:text-warning",
  danger: "sft:text-danger",
};

/** The kind of badge an entitlement reads as: what it says and its default tone. */
export function getAccessBadgeKind(entitlement: Entitlement, options: AccessBadgeKindOptions = {}): AccessBadgeKind {
  const { unlimitedAfterDays } = options;
  switch (entitlement.status) {
    case "trial":
      if (unlimitedAfterDays !== undefined && entitlement.daysLeft > unlimitedAfterDays) return "unlimited";
      return entitlement.isEnding ? "trial-ending" : "trial";
    case "paid":
      if (entitlement.endsAt === null) return "lifetime";
      if (unlimitedAfterDays !== undefined && entitlement.daysLeft !== null && entitlement.daysLeft > unlimitedAfterDays) return "unlimited";
      return entitlement.isEnding ? "paid-ending" : "paid";
    case "read_only":
      return "read-only";
  }
}

interface BadgeCopy {
  readonly status: string;
  readonly detail?: string;
}

interface DescribeInput {
  readonly entitlement: Entitlement;
  readonly kind: AccessBadgeKind;
  readonly messages: BillingMessages;
  readonly locale: Locale;
  readonly timezone: string;
  readonly isCompact: boolean;
}

function describe({ entitlement, kind, messages, locale, timezone, isCompact }: DescribeInput): BadgeCopy {
  if (kind === "unlimited") return { status: messages.badge.unlimited };
  switch (entitlement.status) {
    case "trial":
      return {
        status: messages.badge.trial,
        detail: isCompact ? formatDayCount(entitlement.daysLeft, locale, messages) : formatDaysLeft(entitlement.daysLeft, locale, messages),
      };
    case "paid": {
      if (entitlement.endsAt === null) return { status: messages.badge.lifetime };
      const date = isCompact ? formatShortLastDay(entitlement.endsAt, locale, timezone) : formatLastDay(entitlement.endsAt, locale, timezone);
      return { status: messages.badge.paid, detail: formatMessage(messages.badge.until, { date }) };
    }
    case "read_only":
      return { status: messages.badge.readOnly };
  }
}

export function AccessBadge({ entitlement, messages, locale, timezone, unlimitedAfterDays, compact, tones, classNames, unstyled }: AccessBadgeProps) {
  const kind = getAccessBadgeKind(entitlement, { unlimitedAfterDays });
  const { status, detail } = describe({ entitlement, kind, messages, locale, timezone, isCompact: compact === true });
  const tone = tones?.[kind] ?? DEFAULT_TONES[kind];
  const slot = createSlotClassGetter<AccessBadgeSlot>({
    defaults: {
      root: "sft:inline-flex sft:items-center sft:gap-1.5 sft:rounded-full sft:border sft:border-border sft:bg-surface sft:px-2.5 sft:py-1 sft:font-sans sft:text-xs",
      status: `sft:font-medium ${TONE[tone]}`,
      detail: "sft:text-muted",
    },
    classNames,
    unstyled,
  });
  return (
    <span
      className={slot("root")}
      data-status={entitlement.status}
      data-ending={"isEnding" in entitlement && entitlement.isEnding ? "true" : undefined}
      data-unlimited={kind === "unlimited" ? "true" : undefined}
    >
      <span className={slot("status")}>{status}</span>
      {detail === undefined ? null : <span className={slot("detail")}>{detail}</span>}
    </span>
  );
}
