// @vitest-environment happy-dom
import { jobsMessages, type JobsFormState } from "@softure-ai/jobs";
import { JobsPanel, type JobsPanelAction, type JobsPanelActions, type JobsPanelJob, type JobsPanelQueue, type JobsPanelRun, type JobsPanelSyncSource } from "@softure-ai/jobs/ui";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const en = jobsMessages.en;

const DAILY: JobsPanelQueue = { queue: "reports.daily", details: ["Runs every 1d (UTC periods)"], health: "failing", healthLabel: "Failing", isScheduled: true };
const MAIL: JobsPanelQueue = { queue: "mail.send", details: ["Nothing due"], health: null, healthLabel: null, isScheduled: false };

const FAILED: JobsPanelJob = {
  id: "7",
  queue: "mail.send",
  heading: "mail.send · job 7",
  status: "failed",
  statusLabel: "Failed",
  details: ["Last error: app.bounced"],
  canRetry: true,
  canCancel: false,
};
const RETRYING: JobsPanelJob = { ...FAILED, id: "8", heading: "mail.send · job 8", status: "pending", statusLabel: "Retrying", canRetry: false, canCancel: true };

const RUN: JobsPanelRun = { id: "3", heading: "reports.daily · job 7", outcome: "succeeded", outcomeLabel: "Succeeded", details: ["Started by the schedule", "Items: 3 new · 0 skipped · 0 failed"] };

const INBOX: JobsPanelSyncSource = {
  source: "gmail.inbox",
  heading: "gmail.inbox",
  items: [
    { source: "gmail.inbox", itemId: "m-1", label: "Item m-1", status: "failed", statusLabel: "Failed", details: ["Code: app.unparseable"], canRetry: true },
    { source: "gmail.inbox", itemId: "m-2", label: "Item m-2", status: "done", statusLabel: "Done", details: [], canRetry: false },
  ],
};

function answering(state: JobsFormState) {
  return vi.fn<JobsPanelAction>(() => Promise.resolve(state));
}

function createActions(overrides: Partial<JobsPanelActions> = {}): JobsPanelActions {
  return { runNow: answering({ status: "ok" }), retryJob: answering({ status: "ok" }), cancelJob: answering({ status: "ok" }), retrySyncItem: answering({ status: "ok" }), ...overrides };
}

async function submit(button: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(button);
    await Promise.resolve();
  });
}

function getItem(name: string): HTMLElement {
  const item = screen.getByText(name).closest("li");
  if (item === null) throw new Error(`test: no item for ${name}`);
  return item;
}

describe("JobsPanel", () => {
  it("shows every queue with its details, and Run now and the health only for a scheduled one", () => {
    render(<JobsPanel queues={[DAILY, MAIL]} jobs={[]} syncSources={[]} actions={createActions()} messages={en} />);
    expect(within(getItem("reports.daily")).getByText("Failing")).toBeTruthy();
    expect(within(getItem("reports.daily")).getByRole("button", { name: "Run now" })).toBeTruthy();
    expect(within(getItem("mail.send")).queryByRole("button")).toBeNull();
    expect(screen.getByText("Runs every 1d (UTC periods)")).toBeTruthy();
  });

  it("posts the queue to Run now and says whether the run is new or joined a pending one", async () => {
    const runNow = answering({ status: "ok", notice: "run_joined" });
    render(<JobsPanel queues={[DAILY]} jobs={[]} syncSources={[]} actions={createActions({ runNow })} messages={en} />);
    await submit(screen.getByRole("button", { name: "Run now" }));
    expect(runNow).toHaveBeenCalledTimes(1);
    expect(runNow.mock.calls[0]?.[1].get("queue")).toBe("reports.daily");
    expect(screen.getByRole("status").textContent).toBe(en.queues.runJoined);
  });

  it("offers Retry for a failed job and Cancel for a retrying one, posting the job id", async () => {
    const retryJob = answering({ status: "ok" });
    const cancelJob = answering({ status: "error", error: "jobs.not_cancellable" });
    render(<JobsPanel queues={[]} jobs={[FAILED, RETRYING]} syncSources={[]} actions={createActions({ retryJob, cancelJob })} messages={en} />);
    expect(within(getItem("mail.send · job 7")).queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(within(getItem("mail.send · job 8")).queryByRole("button", { name: "Retry" })).toBeNull();

    await submit(within(getItem("mail.send · job 7")).getByRole("button", { name: "Retry" }));
    expect(retryJob.mock.calls[0]?.[1].get("id")).toBe("7");
    await submit(within(getItem("mail.send · job 8")).getByRole("button", { name: "Cancel" }));
    expect(cancelJob.mock.calls[0]?.[1].get("id")).toBe("8");
    expect(screen.getByText(en.errors.not_cancellable)).toBeTruthy();
  });

  it("shows the recent runs with their outcome and details only when runs are passed", () => {
    const { rerender } = render(<JobsPanel queues={[]} jobs={[]} syncSources={[]} actions={createActions()} messages={en} />);
    expect(screen.queryByRole("region", { name: "Recent runs" })).toBeNull();

    rerender(<JobsPanel queues={[]} jobs={[]} runs={[RUN]} syncSources={[]} actions={createActions()} messages={en} />);
    const item = getItem("reports.daily · job 7");
    expect(item.getAttribute("data-outcome")).toBe("succeeded");
    expect(within(item).getByText("Succeeded")).toBeTruthy();
    expect(within(item).getByText("Items: 3 new · 0 skipped · 0 failed")).toBeTruthy();

    rerender(<JobsPanel queues={[]} jobs={[]} runs={[]} syncSources={[]} actions={createActions()} messages={en} />);
    expect(within(screen.getByRole("region", { name: "Recent runs" })).getByText("No runs yet.")).toBeTruthy();
  });

  it("lists the ledger per source with Retry item for a failed item only", async () => {
    const retrySyncItem = answering({ status: "error", error: "auth.forbidden" });
    render(<JobsPanel queues={[]} jobs={[]} syncSources={[INBOX]} actions={createActions({ retrySyncItem })} messages={en} />);
    expect(screen.getByText("gmail.inbox")).toBeTruthy();
    expect(within(getItem("Item m-2")).queryByRole("button")).toBeNull();
    await submit(within(getItem("Item m-1")).getByRole("button", { name: "Retry item" }));
    const form = retrySyncItem.mock.calls[0]?.[1];
    expect([form?.get("source"), form?.get("itemId")]).toEqual(["gmail.inbox", "m-1"]);
    expect(screen.getByText(en.errors.forbidden)).toBeTruthy();
  });

  it("shows the ledger filter links with the current one marked", () => {
    const filter = [
      { label: "All", href: "/admin/jobs", isCurrent: false },
      { label: "Failed", href: "/admin/jobs?sync=failed", isCurrent: true },
    ];
    render(<JobsPanel queues={[]} jobs={[]} syncSources={[]} syncFilter={filter} actions={createActions()} messages={en} />);
    const nav = screen.getByRole("navigation", { name: en.sync.filterLabel });
    expect(within(nav).getByRole("link", { name: "Failed" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "All" }).getAttribute("href")).toBe("/admin/jobs");
  });

  it("shows an empty state for each part that has nothing", () => {
    render(<JobsPanel queues={[]} jobs={[]} syncSources={[]} actions={createActions()} messages={en} />);
    expect(screen.getByText(en.queues.empty)).toBeTruthy();
    expect(screen.getByText(en.jobs.empty)).toBeTruthy();
    expect(screen.getByText(en.sync.empty)).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("drops the default classes when unstyled", () => {
    const { container } = render(<JobsPanel queues={[DAILY]} jobs={[]} syncSources={[]} actions={createActions()} messages={en} unstyled />);
    expect(container.querySelector("[class*='sft:']")).toBeNull();
  });
});
