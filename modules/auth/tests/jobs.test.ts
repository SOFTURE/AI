// The jobs adapter: the schedules enqueue the session and reset link cleanups and their handlers run the prunes.
import { authJobHandlers, authJobSchedules } from "@softure-ai/auth/jobs";
import { createSession, issuePasswordReset, registerUser } from "@softure-ai/auth/server";
import { jobs, jobsOptionsSchema } from "@softure-ai/jobs";
import { runDueJobs } from "@softure-ai/jobs/testing";
import { afterEach, describe, expect, it } from "vitest";
import { CLIENT, countRows, createTestAuth, DAY_MS, PASSWORD, type TestAuth } from "./support.js";

describe("the auth jobs", () => {
  let test: TestAuth | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  it("schedules a handler for every queue it names", () => {
    expect(Object.keys(authJobSchedules)).toEqual(Object.keys(authJobHandlers));
    expect(jobsOptionsSchema.parse({ schedules: authJobSchedules }).schedules).toEqual({
      "auth.prune-sessions": { every: "1h", payload: {} },
      "auth.prune-password-resets": { every: "1d", payload: {} },
    });
  });

  it("prunes expired sessions and reset links on their schedules", async () => {
    test = await createTestAuth({ auth: { session: { ttlDays: 7 } }, modules: [jobs({ schedules: authJobSchedules })] });
    const registered = await registerUser(test.ctx, { email: "ada@example.com", password: PASSWORD, hasConsented: true, clientKey: CLIENT });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    await issuePasswordReset(test.ctx, registered.value.user.id);
    expect(await countRows(test.database, "password_resets")).toBe(1);
    test.clock.advance(7 * DAY_MS);
    await createSession(test.ctx, registered.value.user.id);

    expect(await runDueJobs(test.ctx, { handlers: authJobHandlers })).toEqual({ succeeded: 2, retried: 0, failed: 0, stale: 0 });
    expect(await countRows(test.database, "sessions")).toBe(1);
    expect(await countRows(test.database, "password_resets")).toBe(0);
  });
});
