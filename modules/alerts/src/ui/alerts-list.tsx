// The admin list of recent alerts: one item per key with its status, severity, counts and times. Rows come prepared
// from the server (`toAlertsListRows`), already in the app's copy; styling only from @softure-ai/ui classes.
import { type ClassNames, createSlotClassGetter } from "@softure-ai/ui";
import type { AlertSeverity } from "../contract.js";
import type { AlertsMessages } from "../messages/index.js";

export type AlertsListSlot = "root" | "list" | "item" | "header" | "title" | "status" | "details" | "detail" | "link" | "empty";

/** One alert as the list renders it. */
export interface AlertsListRow {
  readonly key: string;
  readonly heading: string;
  readonly severity: AlertSeverity;
  readonly isFiring: boolean;
  readonly statusLabel: string;
  /** Lines under the heading, already in the app's copy. */
  readonly details: readonly string[];
  readonly link: string | null;
}

export interface AlertsListProps {
  readonly rows: readonly AlertsListRow[];
  readonly messages: AlertsMessages;
  readonly classNames?: ClassNames<AlertsListSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<AlertsListSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-4 sft:font-sans",
  list: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-4 sft:p-0",
  item: "sft:flex sft:flex-col sft:gap-2",
  header: "sft:flex sft:flex-wrap sft:items-center sft:justify-between sft:gap-2",
  title: "sft:m-0 sft:text-sm sft:font-medium sft:text-foreground",
  status: "sft:text-xs sft:font-medium",
  details: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-1 sft:p-0",
  detail: "sft:m-0 sft:text-xs sft:text-muted",
  link: "sft:text-accent sft:underline",
  empty: "sft:m-0 sft:text-sm sft:text-muted",
};

const FIRING_TONES: Readonly<Record<AlertSeverity, string>> = {
  info: "sft:text-muted",
  warning: "sft:text-warning",
  critical: "sft:text-danger",
};
const RESOLVED_TONE = "sft:text-success";

export function AlertsList({ rows, messages, classNames, unstyled }: AlertsListProps) {
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  if (rows.length === 0) {
    return (
      <div className={slot("root")}>
        <p className={slot("empty")}>{messages.page.empty}</p>
      </div>
    );
  }
  return (
    <div className={slot("root")}>
      <ul className={slot("list")}>
        {rows.map((row) => (
          <li key={row.key} className={slot("item")}>
            <div className={slot("header")}>
              <p className={slot("title")}>{row.heading}</p>
              <span className={[slot("status"), unstyled === true ? undefined : row.isFiring ? FIRING_TONES[row.severity] : RESOLVED_TONE].filter(Boolean).join(" ")}>
                {row.statusLabel}
              </span>
            </div>
            <ul className={slot("details")}>
              {row.details.map((line) => (
                <li key={line} className={slot("detail")}>
                  {line}
                </li>
              ))}
              {row.link !== null && (
                <li className={slot("detail")}>
                  <a href={row.link} className={slot("link")} rel="noreferrer">
                    {messages.open}
                  </a>
                </li>
              )}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
