// The badge and the notice for the signed-in account, wired to the registered config: one line in
// any server component (`<CurrentAccessBadge />`, `<CurrentAccessNotice />`). Without a session
// they render nothing.
import { getSoftureConfig } from "@softure-ai/core/next";
import type { ClassNames, LinkComponentType } from "@softure-ai/ui";
import { getBillingMessages, getBillingRoutes } from "../server/options.js";
import { AccessBadge, type AccessBadgeSlot } from "../ui/access-badge.js";
import { AccessNotice, type AccessNoticeSlot } from "../ui/access-notice.js";
import { getCurrentEntitlement } from "./current-entitlement.js";

export interface CurrentAccessBadgeProps {
  readonly classNames?: ClassNames<AccessBadgeSlot>;
  readonly unstyled?: boolean;
}

export async function CurrentAccessBadge({ classNames, unstyled }: CurrentAccessBadgeProps) {
  const entitlement = await getCurrentEntitlement();
  if (entitlement === null) return null;
  const config = getSoftureConfig();
  return (
    <AccessBadge
      entitlement={entitlement}
      messages={getBillingMessages(config)}
      locale={config.locale}
      timezone={config.timezone}
      classNames={classNames}
      unstyled={unstyled}
    />
  );
}

export interface CurrentAccessNoticeProps {
  /** The app's link component, e.g. Next's `Link`; a plain `<a>` when omitted. */
  readonly LinkComponent?: LinkComponentType;
  readonly classNames?: ClassNames<AccessNoticeSlot>;
  readonly unstyled?: boolean;
}

export async function CurrentAccessNotice({ LinkComponent, classNames, unstyled }: CurrentAccessNoticeProps) {
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
      classNames={classNames}
      unstyled={unstyled}
    />
  );
}
