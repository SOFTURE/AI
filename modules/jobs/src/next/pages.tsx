// The admin page, ready to mount with one line: `export { JobsPage as default } from "@softure-ai/jobs/next"`.
// A server component: anyone without the panel role, signed in or not, gets Next's "not found", and so does everyone
// while the app has not passed `panelGuard`. It renders its own `<main>` and title; an app with its own page shell
// composes the same parts (README): the reads, `toJobsPanelData`, `JobsPanel` and the four actions.
import { getSoftureConfig } from "@softure-ai/core/next";
import { Card } from "@softure-ai/ui";
import { notFound } from "next/navigation";
import { SYNC_ITEM_STATUSES, type SyncItemStatus } from "../sync.js";
import { listRecentJobs } from "../server/admin.js";
import { getQueueStats } from "../server/maintenance.js";
import { getJobsOptions, getJobsRoutes } from "../server/options.js";
import { listJobRuns } from "../server/runs.js";
import { listSyncItems } from "../server/sync-items.js";
import { JobsPanel, type JobsPanelFilterLink } from "../ui/jobs-panel.js";
import { cancelJobAction, retryJobAction, retrySyncItemAction, runScheduleNowAction } from "./actions.js";
import { getJobsContext } from "./context.js";
import { getJobsMessages } from "./messages.js";
import { toJobsPanelData } from "./panel-rows.js";

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-3xl sft:px-4 sft:py-4";
/** The query parameter of the ledger's status filter. */
export const SYNC_FILTER_PARAM = "sync";
const RECENT_JOBS_LIMIT = 50;
const RECENT_RUNS_LIMIT = 50;
const SYNC_ITEMS_LIMIT = 100;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface JobsPageProps {
  readonly searchParams?: SearchParams;
}

/** The ledger status the query asks for; null for all, also for a value that is not a status. */
export function readSyncFilter(params: Record<string, string | string[] | undefined> | undefined): SyncItemStatus | null {
  const raw = params?.[SYNC_FILTER_PARAM];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return SYNC_ITEM_STATUSES.find((status) => status === value) ?? null;
}

export async function JobsPage({ searchParams }: JobsPageProps = {}) {
  const config = getSoftureConfig();
  const options = getJobsOptions(config);
  if (options.panelGuard === undefined) notFound();
  await options.panelGuard.requireRole(options.panelRole);

  const messages = getJobsMessages(config);
  const ctx = await getJobsContext(config);
  const filter = readSyncFilter(await searchParams);
  const [stats, jobs, runs, syncItems] = await Promise.all([
    getQueueStats(ctx),
    listRecentJobs(ctx, { statuses: ["failed", "cancelled", "retrying"], limit: RECENT_JOBS_LIMIT }),
    listJobRuns(ctx, { limit: RECENT_RUNS_LIMIT }),
    listSyncItems(ctx, { ...(filter === null ? {} : { status: filter }), limit: SYNC_ITEMS_LIMIT }),
  ]);
  const data = toJobsPanelData({ stats, jobs, runs, syncItems }, messages, config);
  const panel = getJobsRoutes(config).panel;
  const syncFilter: JobsPanelFilterLink[] = [
    { label: messages.sync.filterAll, href: panel, isCurrent: filter === null },
    ...SYNC_ITEM_STATUSES.map((status) => ({ label: messages.sync.status[status], href: `${panel}?${SYNC_FILTER_PARAM}=${status}`, isCurrent: filter === status })),
  ];
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={messages.page.title} subtitle={messages.page.lead}>
        <JobsPanel
          {...data}
          syncFilter={syncFilter}
          actions={{ runNow: runScheduleNowAction, retryJob: retryJobAction, cancelJob: cancelJobAction, retrySyncItem: retrySyncItemAction }}
          messages={messages}
        />
      </Card>
    </main>
  );
}
