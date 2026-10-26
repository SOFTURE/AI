"use client";

import { Button, type ClassNames, createSlotClassGetter, FormError } from "@softure-ai/ui";
import { useActionState, type ReactNode } from "react";
import type { JobRunOutcome, JobsFormState, JobStatus, ScheduleHealth } from "../contract.js";
import { getJobsErrorMessage, type JobsMessages } from "../messages/index.js";
import type { SyncItemStatus } from "../sync.js";

// The jobs admin panel: the queues with their counts and schedule health and a Run now action for a scheduled one;
// the recent failed, cancelled and retrying jobs with Retry or Cancel; the recent runs (when passed); the sync ledger per source with a status filter
// and Retry item. Every action is a form posting to a server action through `useActionState`, with its error shown in
// place. Rows come prepared from the server (`toJobsPanelData`): codes only, never a payload or an error text. Copy
// comes from the module's messages; styling only from @softure-ai/ui classes.

export type JobsPanelAction = (previous: JobsFormState, formData: FormData) => Promise<JobsFormState>;

export interface JobsPanelActions {
  readonly runNow: JobsPanelAction;
  readonly retryJob: JobsPanelAction;
  readonly cancelJob: JobsPanelAction;
  readonly retrySyncItem: JobsPanelAction;
}

export type JobsPanelSlot =
  | "root"
  | "section"
  | "sectionTitle"
  | "lead"
  | "list"
  | "item"
  | "header"
  | "title"
  | "status"
  | "details"
  | "detail"
  | "actions"
  | "notice"
  | "filter"
  | "filterLink"
  | "empty";

/** One queue as the panel renders it. */
export interface JobsPanelQueue {
  readonly queue: string;
  /** Lines under the name, already in the app's copy. */
  readonly details: readonly string[];
  /** The schedule's health; null for a queue without a schedule. */
  readonly health: ScheduleHealth | null;
  readonly healthLabel: string | null;
  /** A scheduled queue gets Run now. */
  readonly isScheduled: boolean;
}

/** One failed, cancelled or retrying job. */
export interface JobsPanelJob {
  readonly id: string;
  readonly queue: string;
  readonly heading: string;
  readonly status: JobStatus;
  readonly statusLabel: string;
  readonly details: readonly string[];
  readonly canRetry: boolean;
  readonly canCancel: boolean;
}

/** One recorded attempt of the run history. */
export interface JobsPanelRun {
  readonly id: string;
  readonly heading: string;
  readonly outcome: JobRunOutcome;
  readonly outcomeLabel: string;
  /** Origin, attempt, summary and error lines, already in the app's copy. */
  readonly details: readonly string[];
}

/** One item of the sync ledger. */
export interface JobsPanelSyncItem {
  readonly source: string;
  readonly itemId: string;
  readonly label: string;
  readonly status: SyncItemStatus;
  readonly statusLabel: string;
  readonly details: readonly string[];
  readonly canRetry: boolean;
}

/** The ledger items of one source. */
export interface JobsPanelSyncSource {
  readonly source: string;
  readonly heading: string;
  readonly items: readonly JobsPanelSyncItem[];
}

/** One choice of the ledger's status filter: a link the page prepared. */
export interface JobsPanelFilterLink {
  readonly label: string;
  readonly href: string;
  readonly isCurrent: boolean;
}

export interface JobsPanelProps {
  readonly queues: readonly JobsPanelQueue[];
  readonly jobs: readonly JobsPanelJob[];
  /** The run history's newest rows; the section is left out when omitted. */
  readonly runs?: readonly JobsPanelRun[];
  readonly syncSources: readonly JobsPanelSyncSource[];
  /** The ledger's status filter; nothing is shown when empty or omitted. */
  readonly syncFilter?: readonly JobsPanelFilterLink[];
  readonly actions: JobsPanelActions;
  readonly messages: JobsMessages;
  readonly classNames?: ClassNames<JobsPanelSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<JobsPanelSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-4 sft:font-sans",
  section: "sft:flex sft:flex-col sft:gap-3",
  sectionTitle: "sft:m-0 sft:text-base sft:font-semibold sft:text-foreground",
  lead: "sft:m-0 sft:text-xs sft:text-muted",
  list: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-4 sft:p-0",
  item: "sft:flex sft:flex-col sft:gap-2",
  header: "sft:flex sft:flex-wrap sft:items-center sft:justify-between sft:gap-2",
  title: "sft:m-0 sft:text-sm sft:font-medium sft:text-foreground",
  status: "sft:text-xs sft:font-medium",
  details: "sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-1 sft:p-0",
  detail: "sft:m-0 sft:text-xs sft:text-muted",
  actions: "sft:flex sft:flex-wrap sft:items-end sft:gap-2",
  notice: "sft:m-0 sft:text-xs sft:text-muted",
  filter: "sft:flex sft:flex-wrap sft:items-center sft:gap-2 sft:text-xs sft:text-muted",
  filterLink: "sft:text-accent sft:underline",
  empty: "sft:m-0 sft:text-sm sft:text-muted",
};

const HEALTH_TONES: Readonly<Record<ScheduleHealth, string>> = {
  healthy: "sft:text-success",
  failing: "sft:text-danger",
  late: "sft:text-warning",
};

const JOB_TONES: Readonly<Record<JobStatus, string>> = {
  pending: "sft:text-warning",
  running: "sft:text-muted",
  succeeded: "sft:text-success",
  failed: "sft:text-danger",
  cancelled: "sft:text-muted",
};

const RUN_TONES: Readonly<Record<JobRunOutcome, string>> = {
  succeeded: "sft:text-success",
  retried: "sft:text-warning",
  failed: "sft:text-danger",
};

const SYNC_TONES: Readonly<Record<SyncItemStatus, string>> = {
  pending: "sft:text-warning",
  done: "sft:text-success",
  skipped: "sft:text-muted",
  failed: "sft:text-danger",
};

const IDLE: JobsFormState = { status: "idle" };

type Slot = (part: JobsPanelSlot) => string | undefined;

interface ActionFormProps {
  readonly action: JobsPanelAction;
  readonly fields: Readonly<Record<string, string>>;
  readonly label: string;
  readonly pendingLabel: string;
  readonly messages: JobsMessages;
  readonly slot: Slot;
  readonly unstyled: boolean | undefined;
}

function ActionForm({ action, fields, label, pendingLabel, messages, slot, unstyled }: ActionFormProps) {
  const [state, dispatch, isPending] = useActionState(action, IDLE);
  let notice: string | null = null;
  if (state.notice === "run_enqueued") notice = messages.queues.runEnqueued;
  if (state.notice === "run_joined") notice = messages.queues.runJoined;
  return (
    <form action={dispatch} className={slot("actions")}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant="secondary" size="sm" pending={isPending} pendingLabel={pendingLabel} unstyled={unstyled}>
        {label}
      </Button>
      {notice !== null && (
        <p role="status" className={slot("notice")}>
          {notice}
        </p>
      )}
      <FormError message={state.error === undefined ? undefined : getJobsErrorMessage(messages, state.error)} unstyled={unstyled} />
    </form>
  );
}

function Details({ lines, slot }: { lines: readonly string[]; slot: Slot }) {
  if (lines.length === 0) return null;
  return (
    <ul className={slot("details")}>
      {lines.map((line) => (
        <li key={line} className={slot("detail")}>
          {line}
        </li>
      ))}
    </ul>
  );
}

function Header({ title, status, tone, slot, unstyled }: { title: string; status: string | null; tone: string; slot: Slot; unstyled: boolean | undefined }) {
  return (
    <div className={slot("header")}>
      <p className={slot("title")}>{title}</p>
      {status !== null && <span className={unstyled === true ? slot("status") : `${slot("status") ?? ""} ${tone}`}>{status}</span>}
    </div>
  );
}

function Section({ title, lead, children, slot }: { title: string; lead?: string; children: ReactNode; slot: Slot }) {
  return (
    <section className={slot("section")} aria-label={title}>
      <h3 className={slot("sectionTitle")}>{title}</h3>
      {lead !== undefined && <p className={slot("lead")}>{lead}</p>}
      {children}
    </section>
  );
}

/**
 * Queues, recent problem jobs, recent runs (when `runs` is passed) and the sync ledger, each with its actions; an
 * empty state for each when it has none.
 */
export function JobsPanel({ queues, jobs, runs, syncSources, syncFilter = [], actions, messages, classNames, unstyled }: JobsPanelProps) {
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const form = { messages, slot, unstyled };
  return (
    <div className={slot("root")}>
      <Section title={messages.queues.title} slot={slot}>
        {queues.length === 0 ? (
          <p className={slot("empty")}>{messages.queues.empty}</p>
        ) : (
          <ul className={slot("list")}>
            {queues.map((queue) => (
              <li key={queue.queue} className={slot("item")} data-health={queue.health ?? undefined}>
                <Header title={queue.queue} status={queue.healthLabel} tone={queue.health === null ? "" : HEALTH_TONES[queue.health]} slot={slot} unstyled={unstyled} />
                <Details lines={queue.details} slot={slot} />
                {queue.isScheduled && (
                  <ActionForm action={actions.runNow} fields={{ queue: queue.queue }} label={messages.queues.runNow} pendingLabel={messages.queues.running} {...form} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={messages.jobs.title} lead={messages.jobs.lead} slot={slot}>
        {jobs.length === 0 ? (
          <p className={slot("empty")}>{messages.jobs.empty}</p>
        ) : (
          <ul className={slot("list")}>
            {jobs.map((job) => (
              <li key={job.id} className={slot("item")} data-status={job.status}>
                <Header title={job.heading} status={job.statusLabel} tone={JOB_TONES[job.status]} slot={slot} unstyled={unstyled} />
                <Details lines={job.details} slot={slot} />
                {job.canRetry && <ActionForm action={actions.retryJob} fields={{ id: job.id }} label={messages.jobs.retry} pendingLabel={messages.jobs.retrying} {...form} />}
                {job.canCancel && <ActionForm action={actions.cancelJob} fields={{ id: job.id }} label={messages.jobs.cancel} pendingLabel={messages.jobs.cancelling} {...form} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {runs !== undefined && (
        <Section title={messages.runs.title} lead={messages.runs.lead} slot={slot}>
          {runs.length === 0 ? (
            <p className={slot("empty")}>{messages.runs.empty}</p>
          ) : (
            <ul className={slot("list")}>
              {runs.map((run) => (
                <li key={run.id} className={slot("item")} data-outcome={run.outcome}>
                  <Header title={run.heading} status={run.outcomeLabel} tone={RUN_TONES[run.outcome]} slot={slot} unstyled={unstyled} />
                  <Details lines={run.details} slot={slot} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
      <Section title={messages.sync.title} lead={messages.sync.lead} slot={slot}>
        {syncFilter.length > 0 && (
          <nav className={slot("filter")} aria-label={messages.sync.filterLabel}>
            <span>{messages.sync.filterLabel}</span>
            {syncFilter.map((link) => (
              <a key={link.href} href={link.href} className={slot("filterLink")} aria-current={link.isCurrent ? "page" : undefined}>
                {link.label}
              </a>
            ))}
          </nav>
        )}
        {syncSources.length === 0 ? (
          <p className={slot("empty")}>{messages.sync.empty}</p>
        ) : (
          syncSources.map((source) => (
            <div key={source.source} className={slot("section")}>
              <p className={slot("title")}>{source.heading}</p>
              <ul className={slot("list")}>
                {source.items.map((item) => (
                  <li key={item.itemId} className={slot("item")} data-status={item.status}>
                    <Header title={item.label} status={item.statusLabel} tone={SYNC_TONES[item.status]} slot={slot} unstyled={unstyled} />
                    <Details lines={item.details} slot={slot} />
                    {item.canRetry && (
                      <ActionForm
                        action={actions.retrySyncItem}
                        fields={{ source: item.source, itemId: item.itemId }}
                        label={messages.sync.retry}
                        pendingLabel={messages.sync.retrying}
                        {...form}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}
