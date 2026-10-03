// A compact label of where an account stands: "Trial · 5 days left", "Paid · until November 30,
// 2026", "Lifetime access" or "Read-only". Server-safe: it renders from props, so a server
// component passes the entitlement it read (`CurrentAccessBadge` in `/next` does).
import { formatMessage, type Locale } from "@softure-ai/core";
import { type ClassNames, createSlotClassGetter } from "@softure-ai/ui";
import type { Entitlement } from "../contract.js";
import type { BillingMessages } from "../messages/index.js";
import { formatDaysLeft, formatLastDay } from "./format.js";

export type AccessBadgeSlot = "root" | "status" | "detail";

export interface AccessBadgeProps {
  readonly entitlement: Entitlement;
  readonly messages: BillingMessages;
  readonly locale: Locale;
  /** The app's IANA time zone, for the dates shown. */
  readonly timezone: string;
  readonly classNames?: ClassNames<AccessBadgeSlot>;
  readonly unstyled?: boolean;
}

type Tone = "neutral" | "success" | "warning" | "danger";

const TONE: Readonly<Record<Tone, string>> = {
  neutral: "sft:text-foreground",
  success: "sft:text-success",
  warning: "sft:text-warning",
  danger: "sft:text-danger",
};

function describe(entitlement: Entitlement, messages: BillingMessages, locale: Locale, timezone: string): { status: string; detail?: string; tone: Tone } {
  switch (entitlement.status) {
    case "trial":
      return { status: messages.badge.trial, detail: formatDaysLeft(entitlement.daysLeft, locale, messages), tone: entitlement.isEnding ? "warning" : "neutral" };
    case "paid":
      if (entitlement.endsAt === null) return { status: messages.badge.lifetime, tone: "success" };
      return {
        status: messages.badge.paid,
        detail: formatMessage(messages.badge.until, { date: formatLastDay(entitlement.endsAt, locale, timezone) }),
        tone: entitlement.isEnding ? "warning" : "success",
      };
    case "read_only":
      return { status: messages.badge.readOnly, tone: "danger" };
  }
}

export function AccessBadge({ entitlement, messages, locale, timezone, classNames, unstyled }: AccessBadgeProps) {
  const { status, detail, tone } = describe(entitlement, messages, locale, timezone);
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
    <span className={slot("root")} data-status={entitlement.status} data-ending={"isEnding" in entitlement && entitlement.isEnding ? "true" : undefined}>
      <span className={slot("status")}>{status}</span>
      {detail === undefined ? null : <span className={slot("detail")}>{detail}</span>}
    </span>
  );
}
