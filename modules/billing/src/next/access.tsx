// The badge and the notice for the signed-in account, wired to the registered config: one line in
// any server component (`<CurrentAccessBadge />`, `<CurrentAccessNotice />`). Without a session
// they render nothing.
import { getSoftureConfig } from "@softure-ai/core/next";
import type { ClassNames, LinkComponentType } from "@softure-ai/ui";
import { getBillingMessages, getBillingRoutes } from "../server/options.js";
import { AccessBadge, type AccessBadgeKind, type AccessBadgeSlot, type AccessTone } from "../ui/access-badge.js";
import { AccessNotice, type AccessNoticeSlot, type AccessNoticeTone } from "../ui/access-notice.js";
import { getCurrentEntitlement } from "./current-entitlement.js";

export interface CurrentAccessBadgeProps {
  /** Trial or dated paid access with more days left than this reads "Unlimited access". Unset: never. */
  readonly unlimitedAfterDays?: number;
  /** A shorter detail: "5 days" for a trial, the numeric last day for paid access. */
  readonly compact?: boolean;
  /** The status colour per kind; kinds left out keep their default tone. */
  readonly tones?: Partial<Record<AccessBadgeKind, AccessTone>>;
  readonly classNames?: ClassNames<AccessBadgeSlot>;
  readonly unstyled?: boolean;
}

export async function CurrentAccessBadge({ unlimitedAfterDays, compact, tones, classNames, unstyled }: CurrentAccessBadgeProps) {
  const entitlement = await getCurrentEntitlement();
  if (entitlement === null) return null;
  const config = getSoftureConfig();
  return (
    <AccessBadge
      entitlement={entitlement}
      messages={getBillingMessages(config)}
      locale={config.locale}
      timezone={config.timezone}
      unlimitedAfterDays={unlimitedAfterDays}
      compact={compact}
      tones={tones}
      classNames={classNames}
      unstyled={unstyled}
    />
  );
}

export interface CurrentAccessNoticeProps {
  /** The app's link component, e.g. Next's `Link`; a plain `<a>` when omitted. */
  readonly LinkComponent?: LinkComponentType;
  /** The frame's tone while access is ending (default `neutral`) and once it has ended (default `danger`). */
  readonly tones?: Partial<Record<"ending" | "ended", AccessNoticeTone>>;
  readonly classNames?: ClassNames<AccessNoticeSlot>;
  readonly unstyled?: boolean;
}

export async function CurrentAccessNotice({ LinkComponent, tones, classNames, unstyled }: CurrentAccessNoticeProps) {
  const entitlement = await getCurrentEntitlement();
  if (entitlement === null) return null;
  const config = getSoftureConfig();
  return (
    <AccessNotice
      entitlement={entitlement}
      messages={getBillingMessages(config)}
      locale={config.locale}
      timezone={config.timezone}
      paymentHref={getBillingRoutes(config).payment}
      LinkComponent={LinkComponent}
      tones={tones}
      classNames={classNames}
      unstyled={unstyled}
    />
  );
}
