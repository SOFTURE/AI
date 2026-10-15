// The jobs adapter: the schedule enqueues the cleanup of unconfirmed sign-ups and its handler runs
// `pruneUnconfirmedSignups`.
import { jobs, jobsOptionsSchema } from "@softure-ai/jobs";
import { runDueJobs } from "@softure-ai/jobs/testing";
import { waitlistJobHandlers, waitlistJobSchedules } from "@softure-ai/waitlist/jobs";
import { getSignup, joinWaitlist } from "@softure-ai/waitlist/server";
import { afterEach, describe, expect, it } from "vitest";
import { CLIENT, createTestWaitlist, NOW, OPTIONS, type TestWaitlist } from "./support.js";

const HOUR_MS = 60 * 60 * 1000;

describe("the waitlist jobs", () => {
  let test: TestWaitlist | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  it("schedules a handler for every queue it names", () => {
    expect(Object.keys(waitlistJobSchedules)).toEqual(Object.keys(waitlistJobHandlers));
    expect(jobsOptionsSchema.parse({ schedules: waitlistJobSchedules }).schedules).toEqual({
      "waitlist.prune-unconfirmed-signups": { every: "1h", payload: {} },
    });
  });

  it("deletes sign-ups whose link expired unused on its schedule", async () => {
    test = await createTestWaitlist({ waitlist: { ...OPTIONS, doubleOptIn: true }, modules: [jobs({ schedules: waitlistJobSchedules })] });
    const joined = await joinWaitlist(test.ctx, { email: "bob@example.com", scopes: ["launch"], placement: "hero", clientKey: CLIENT });
    expect(joined).toMatchObject({ ok: true, value: { status: "confirmation_required" } });
    test.clock.set(new Date(NOW.getTime() + 168 * HOUR_MS));

    expect(await runDueJobs(test.ctx, { handlers: waitlistJobHandlers })).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect(await getSignup(test.ctx, "bob@example.com")).toBeNull();
  });
});
