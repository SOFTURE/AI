// Quiet hours of a channel: a local time window in which messages below the exempt severities wait for its end.
import { getWallClock, getZonedInstant, isTimeZone, type WallClock } from "@softure-ai/core";
import { z } from "zod";
import { ALERT_SEVERITIES, type AlertSeverity } from "./contract.js";

const TIME_OF_DAY = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

export const quietHoursSchema = z
  .strictObject({
    /** Local start, `HH:MM`. */
    from: z.string().regex(TIME_OF_DAY, "must be HH:MM, 00:00 to 23:59"),
    /** Local end, `HH:MM`; earlier than `from` means the window crosses midnight. */
    to: z.string().regex(TIME_OF_DAY, "must be HH:MM, 00:00 to 23:59"),
    /** The IANA time zone of `from` and `to`, e.g. `Europe/Warsaw`. */
    timeZone: z.string().refine(isTimeZone, "must be an IANA time zone, e.g. Europe/Warsaw or UTC"),
    /** Severities sent at once even inside the window. */
    exceptSeverities: z.array(z.enum(ALERT_SEVERITIES)).default(["critical"]),
  })
  .refine((quiet) => quiet.from !== quiet.to, { message: "from and to must differ", path: ["to"] });

export type QuietHoursInput = z.input<typeof quietHoursSchema>;
export type QuietHours = z.output<typeof quietHoursSchema>;

/**
 * When a message of `severity` produced at `now` may go out: `now` outside the window or for an exempt severity,
 * else the instant the window ends.
 */
export function getQuietHoursRelease(now: Date, quiet: QuietHours | undefined, severity: AlertSeverity): Date {
  if (quiet === undefined || quiet.exceptSeverities.includes(severity)) return now;
  const clock = getWallClock(now, quiet.timeZone);
  const minute = clock.hour * 60 + clock.minute;
  const from = toMinutes(quiet.from);
  const to = toMinutes(quiet.to);
  const crossesMidnight = from > to;
  const isQuiet = crossesMidnight ? minute >= from || minute < to : minute >= from && minute < to;
  if (!isQuiet) return now;
  const endsTomorrow = crossesMidnight && minute >= from;
  // Calendar arithmetic, not 24 hours: the night a DST change shortens has 23.
  const day = new Date(Date.UTC(clock.year, clock.month - 1, clock.day + (endsTomorrow ? 1 : 0)));
  const end: WallClock = { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate(), hour: Math.floor(to / 60), minute: to % 60 };
  return getZonedInstant(end, quiet.timeZone);
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}
