// Where a token stands on its expiry, for the owner's list, in the app's time zone. Expiry compares instants
// with the same boundary as verification (valid while `expires_at > now`), so the list never calls
// a token active that the endpoint already refuses; the distance counts calendar days, as people do.
import { toCalendarDay } from "@softure-ai/core";
import type { AccessTokenStatus } from "./contract.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AccessTokenStatusOptions {
  /** The app's IANA time zone: calendar days are counted there. */
  readonly timezone: string;
  /** From how many days before the expiry the token counts as expiring. */
  readonly warningDays: number;
}

export function getAccessTokenStatus(expiresAt: Date, now: Date, options: AccessTokenStatusOptions): AccessTokenStatus {
  if (expiresAt.getTime() <= now.getTime()) return { kind: "expired" };
  const daysLeft = getDayNumber(expiresAt, options.timezone) - getDayNumber(now, options.timezone);
  return daysLeft <= options.warningDays ? { kind: "expiring", daysLeft } : { kind: "active" };
}

/** The calendar day of an instant in a time zone, as a day count; two of them subtract to days. */
function getDayNumber(instant: Date, timezone: string): number {
  return Date.parse(`${toCalendarDay(instant, timezone)}T00:00:00Z`) / DAY_MS;
}
