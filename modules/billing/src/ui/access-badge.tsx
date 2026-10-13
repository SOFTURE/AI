// A compact label of where an account stands: "Trial · 5 days left", "Paid · until November 30,
// 2026", "Lifetime access", "Unlimited access" (an end so far away it does not matter, when the app
// sets `unlimitedAfterDays`) or "Read-only". Server-safe: it renders from props, so a server
// component passes the entitlement it read (`CurrentAccessBadge` in `/next` does). An app words
// any kind itself (`texts`), shows a short form (`variant`), prefixes a screen-reader label
// (`srPrefix`) and colours the whole pill (`toneScope`); the root carries `data-kind` and `data-tone`.
import { formatMessage, type Locale } from "@softure-ai/core";
import { type ClassNames, createSlotClassGetter } from "@softure-ai/ui";
import type { Entitlement } from "../contract.js";
import type { BillingMessages } from "../messages/index.js";
import { formatDayCount, formatDaysLeft, formatLastDay, formatShortLastDay } from "./format.js";

export type AccessBadgeSlot = "root" | "status" | "detail" | "full" | "short" | "prefix";

/** What the badge shows, one tone each. */
export type AccessBadgeKind = "trial" | "trial-ending" | "paid" | "paid-ending" | "lifetime" | "unlimited" | "read-only";

export type AccessTone = "neutral" | "success" | "warning" | "danger";

/** What the badge says: the status, an optional detail and an optional short form for narrow places. */
export interface AccessBadgeText {
  readonly status: string;
  readonly detail?: string;
  /** The `short` and `responsive` variants' text; the status when left out. */
  readonly short?: string;
}

/** What an app's own wording of a kind receives. */
export interface AccessBadgeTextInput {
  readonly kind: AccessBadgeKind;
  readonly entitlement: Entitlement;
  /** Whole days of access left; null for lifetime and read-only access. */
  readonly daysLeft: number | null;
  /** The first instant without access; null for lifetime and read-only access. */
  readonly endsAt: Date | null;
  /** The badge's own text for this kind. */
  readonly text: AccessBadgeText;
}

export type AccessBadgeTextFormatter = (input: AccessBadgeTextInput) => AccessBadgeText;

/** `full` (default): status and detail; `short`: the short text; `responsive`: short below `md`, full from it. */
export type AccessBadgeVariant = "full" | "short" | "responsive";

/** What the tone colours: the status text (default) or all the pill's text (`data-tone` keys anything else). */
export type AccessToneScope = "status" | "pill";

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
  /** The app's own text per kind; kinds left out keep the badge's text. */
  readonly texts?: Partial<Record<AccessBadgeKind, AccessBadgeTextFormatter>>;
  readonly variant?: AccessBadgeVariant;
  /** Read by screen readers before the label, e.g. "Access status:"; not shown. */
  readonly srPrefix?: string;
  readonly toneScope?: AccessToneScope;
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

const ROOT_CLASS = "sft:inline-flex sft:items-center sft:gap-1.5 sft:rounded-full sft:border sft:border-border sft:bg-surface sft:px-2.5 sft:py-1 sft:font-sans sft:text-xs";

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

interface DescribeInput {
  readonly entitlement: Entitlement;
  readonly kind: AccessBadgeKind;
  readonly messages: BillingMessages;
  readonly locale: Locale;
  readonly timezone: string;
  readonly isCompact: boolean;
}

function describe({ entitlement, kind, messages, locale, timezone, isCompact }: DescribeInput): AccessBadgeText {
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

function getEnd(entitlement: Entitlement): Pick<AccessBadgeTextInput, "daysLeft" | "endsAt"> {
  if (entitlement.status === "read_only") return { daysLeft: null, endsAt: null };
  return { daysLeft: entitlement.daysLeft, endsAt: entitlement.endsAt };
}

export function AccessBadge({
  entitlement,
  messages,
  locale,
  timezone,
  unlimitedAfterDays,
  compact,
  tones,
  texts,
  variant = "full",
  srPrefix,
  toneScope = "status",
  classNames,
  unstyled,
}: AccessBadgeProps) {
  const kind = getAccessBadgeKind(entitlement, { unlimitedAfterDays });
  const text = describe({ entitlement, kind, messages, locale, timezone, isCompact: compact === true });
  const formatText = texts?.[kind];
  const { status, detail, short } = formatText === undefined ? text : formatText({ kind, entitlement, ...getEnd(entitlement), text });
  const tone = tones?.[kind] ?? DEFAULT_TONES[kind];
  const slot = createSlotClassGetter<AccessBadgeSlot>({
    defaults: {
      root: toneScope === "pill" ? `${ROOT_CLASS} ${TONE[tone]}` : ROOT_CLASS,
      status: toneScope === "pill" ? "sft:font-medium" : `sft:font-medium ${TONE[tone]}`,
      detail: toneScope === "pill" ? "" : "sft:text-muted",
      full: "sft:hidden sft:items-center sft:gap-1.5 sft:md:flex",
      short: `${toneScope === "pill" ? "sft:font-medium" : `sft:font-medium ${TONE[tone]}`}${variant === "responsive" ? " sft:md:hidden" : ""}`,
      prefix: "sft:sr-only",
    },
    classNames,
    unstyled,
  });
  const fullText = (
    <>
      <span className={slot("status")}>{status}</span>
      {detail === undefined ? null : <span className={slot("detail")}>{detail}</span>}
    </>
  );
  const shortText = <span className={slot("short")}>{short ?? status}</span>;
  return (
    <span
      className={slot("root")}
      data-status={entitlement.status}
      data-kind={kind}
      data-tone={tone}
      data-ending={"isEnding" in entitlement && entitlement.isEnding ? "true" : undefined}
      data-unlimited={kind === "unlimited" ? "true" : undefined}
    >
      {srPrefix === undefined ? null : <span className={slot("prefix")}>{`${srPrefix} `}</span>}
      {variant === "full" ? fullText : null}
      {variant === "short" ? shortText : null}
      {variant === "responsive" ? (
        <>
          <span className={slot("full")}>{fullText}</span>
          {shortText}
        </>
      ) : null}
    </span>
  );
}
