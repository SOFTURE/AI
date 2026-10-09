// The notice an account sees when its access is about to end or has ended, with a link to pay.
// It renders nothing while access is not in its reminder window. Server-safe and framework-free:
// the link goes through an injected `LinkComponent` (Next's `Link` in `/next`).
import { formatMessage, type Locale } from "@softure-ai/core";
import { ButtonLink, type ClassNames, createSlotClassGetter, type LinkComponentType } from "@softure-ai/ui";
import type { Entitlement } from "../contract.js";
import type { BillingMessages } from "../messages/index.js";
import type { AccessTone } from "./access-badge.js";
import { formatLastDay } from "./format.js";

export type AccessNoticeSlot = "root" | "message" | "actions";

export interface AccessNoticeProps {
  readonly entitlement: Entitlement;
  readonly messages: BillingMessages;
  readonly locale: Locale;
  /** The app's IANA time zone, for the dates shown. */
  readonly timezone: string;
  /** Where to pay or renew (`routes.payment`). */
  readonly paymentHref: string;
  /** Renders the link; a plain `<a>` when omitted. */
  readonly LinkComponent?: LinkComponentType;
  /** The frame's tone while access is ending (default `neutral`) and once it has ended (default `danger`). */
  readonly tones?: Partial<Record<"ending" | "ended", AccessNoticeTone>>;
  readonly classNames?: ClassNames<AccessNoticeSlot>;
  readonly unstyled?: boolean;
}

/** The frames the notice has: the raised surface, or the danger surface of `FormError`. */
export type AccessNoticeTone = Extract<AccessTone, "neutral" | "danger">;

const FRAME: Readonly<Record<AccessNoticeTone, string>> = {
  neutral: "sft:border-border-strong sft:bg-surface-raised",
  danger: "sft:border-danger/50 sft:bg-danger/10",
};

interface NoticeCopy {
  readonly text: string;
  readonly action: string;
  readonly isEnded: boolean;
}

/** The notice for this entitlement, or null when there is nothing to say. */
function getNoticeCopy(entitlement: Entitlement, messages: BillingMessages, locale: Locale, timezone: string): NoticeCopy | null {
  const copy = messages.notice;
  switch (entitlement.status) {
    case "trial":
      if (!entitlement.isEnding) return null;
      return { text: formatMessage(copy.trialEnding, { date: formatLastDay(entitlement.endsAt, locale, timezone) }), action: copy.choosePlan, isEnded: false };
    case "paid":
      if (!entitlement.isEnding || entitlement.endsAt === null) return null;
      return { text: formatMessage(copy.paidEnding, { date: formatLastDay(entitlement.endsAt, locale, timezone) }), action: copy.renew, isEnded: false };
    case "read_only":
      return entitlement.reason === "trial_ended"
        ? { text: copy.trialEnded, action: copy.choosePlan, isEnded: true }
        : { text: copy.paidEnded, action: copy.renew, isEnded: true };
  }
}

export function AccessNotice({ entitlement, messages, locale, timezone, paymentHref, LinkComponent, tones, classNames, unstyled }: AccessNoticeProps) {
  const notice = getNoticeCopy(entitlement, messages, locale, timezone);
  if (notice === null) return null;
  const tone = notice.isEnded ? (tones?.ended ?? "danger") : (tones?.ending ?? "neutral");
  const slot = createSlotClassGetter<AccessNoticeSlot>({
    defaults: {
      root: `sft:flex sft:flex-col sft:gap-3 sft:rounded-control sft:border sft:px-4 sft:py-2.5 sft:font-sans sft:text-sm sft:text-foreground ${FRAME[tone]}`,
      message: "sft:m-0",
      actions: "sft:flex sft:shrink-0",
    },
    classNames,
    unstyled,
  });
  return (
    <div role="status" className={slot("root")} data-status={entitlement.status}>
      <p className={slot("message")}>{notice.text}</p>
      <div className={slot("actions")}>
        <ButtonLink href={paymentHref} LinkComponent={LinkComponent} variant={notice.isEnded ? "primary" : "secondary"} size="sm" unstyled={unstyled}>
          {notice.action}
        </ButtonLink>
      </div>
    </div>
  );
}
