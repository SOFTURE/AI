// The jobs adapter: the schedule enqueues the daily cleanup and its handler runs `pruneMcpAccess`.
import { jobs, jobsOptionsSchema } from "@softure-ai/jobs";
import { runDueJobs } from "@softure-ai/jobs/testing";
import { mcpAccessJobHandlers, mcpAccessJobSchedules } from "@softure-ai/mcp-access/jobs";
import { issueAccessToken, listAccessTokens } from "@softure-ai/mcp-access/server";
import { afterEach, describe, expect, it } from "vitest";
import { createConfig, createTestMcp, createUser, OPTIONS, type TestMcp } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("the mcp-access jobs", () => {
  let test: TestMcp | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  it("schedules a handler for every queue it names", () => {
    expect(Object.keys(mcpAccessJobSchedules)).toEqual(Object.keys(mcpAccessJobHandlers));
    expect(jobsOptionsSchema.parse({ schedules: mcpAccessJobSchedules }).schedules).toEqual({
      "mcp-access.prune": { every: "1d", payload: {} },
    });
  });

  it("prunes expired access tokens on its schedule", async () => {
    test = await createTestMcp(createConfig(OPTIONS, "en", [jobs({ schedules: mcpAccessJobSchedules })]));
    const alice = await createUser(test.database, "alice@example.com");
    const issued = await issueAccessToken(test.ctx, { userId: alice, name: "Laptop", canWrite: false });
    if (!issued.ok) throw new Error(issued.error);
    test.clock.advance(91 * DAY_MS);

    expect(await runDueJobs(test.ctx, { handlers: mcpAccessJobHandlers })).toEqual({ succeeded: 1, retried: 0, failed: 0, stale: 0 });
    expect(await listAccessTokens(test.ctx, alice)).toEqual([]);
  });
});
