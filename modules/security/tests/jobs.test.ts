// The jobs adapter: the schedule enqueues the rate limit cleanup and its handler runs `pruneRateLimits`.
import { jobs, jobsOptionsSchema } from "@softure-ai/jobs";
import { runDueJobs } from "@softure-ai/jobs/testing";
import { securityJobHandlers, securityJobSchedules } from "@softure-ai/security/jobs";
import { consumeRateLimit } from "@softure-ai/security/server";
import { afterEach, describe, expect, it } from "vitest";
import { createTestSecurity, MINUTE_MS, type TestSecurity } from "./support.js";

const IP = "ip:203.0.113.9";

describe("the security jobs", () => {
  let test: TestSecurity | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  it("schedules a handler for every queue it names", () => {
    expect(Object.keys(securityJobSchedules)).toEqual(Object.keys(securityJobHandlers));
    expect(jobsOptionsSchema.parse({ schedules: securityJobSchedules }).schedules).toEqual({
      "security.prune-rate-limits": { every: "1h", payload: {} },
    });
  });

  it("prunes long-expired rate limit rows on its schedule", async () => {
    test = await createTestSecurity({}, [jobs({ schedules: securityJobSchedules })]);
    await consumeRateLimit(test.ctx, { bucket: "register", key: "ip:198.51.100.4" });
    test.clock.advance(60 * MINUTE_MS);
    await consumeRateLimit(test.ctx, { bucket: "register", key: IP });

    expect(await runDueJobs(test.ctx, { handlers: securityJobHandlers })).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    const rows = await test.database.client.query<{ identifier: string }>("SELECT identifier FROM security.rate_limits");
    expect(rows.rows).toEqual([{ identifier: IP }]);
  });
});
