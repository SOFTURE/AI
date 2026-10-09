// Issue #324, point 2: `countSignupsByChannel(ctx, { splitSuppressed: true })` splits each channel's
// confirmed sign-ups into active ones and the ones whose address is on mailing's suppression list, so a
// go/no-go report no longer reads mailing's table and hashes addresses itself.
import { suppressRecipient } from "@softure-ai/mailing/server";
import { countSignupsByChannel, joinWaitlist } from "@softure-ai/waitlist/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, createTestWaitlist, NOW, type TestWaitlist } from "./support.js";

describe("countSignupsByChannel({ splitSuppressed: true })", () => {
  let test: TestWaitlist;

  beforeEach(async () => {
    test = await createTestWaitlist();
  });
  afterEach(() => test.database.close());

  async function join(email: string, channel: string | undefined): Promise<void> {
    const result = await joinWaitlist(test.ctx, { email, channel, scopes: ["launch"], placement: "hero", clientKey: CLIENT });
    if (!result.ok) throw new Error(`joining with ${email} failed: ${String(result.error)}`);
  }

  it("counts active and suppressed sign-ups per channel, the address matched however it was typed", async () => {
    const joins: [string, string | undefined][] = [
      ["ada@example.com", "ads"],
      ["bob@example.com", "ads"],
      ["cyd@example.com", "blog"],
      ["dan@example.com", undefined],
      ["eve@example.com", "ads"],
    ];
    for (const [index, [email, channel]] of joins.entries()) {
      test.clock.set(new Date(NOW.getTime() + index * 1000));
      await join(email, channel);
    }
    await suppressRecipient(test.ctx, " Bob@Example.com ");
    await suppressRecipient(test.ctx, "dan@example.com", "one-click");
    await suppressRecipient(test.ctx, "nobody@example.com");

    expect(await countSignupsByChannel(test.ctx, { splitSuppressed: true })).toEqual([
      { channel: "ads", signups: 3, active: 2, suppressed: 1 },
      { channel: "blog", signups: 1, active: 1, suppressed: 0 },
      { channel: null, signups: 1, active: 0, suppressed: 1 },
    ]);
    expect(await countSignupsByChannel(test.ctx)).toEqual([
      { channel: "ads", signups: 3 },
      { channel: "blog", signups: 1 },
      { channel: null, signups: 1 },
    ]);
  });

  it("returns an empty list for an empty waitlist", async () => {
    expect(await countSignupsByChannel(test.ctx, { splitSuppressed: true })).toEqual([]);
  });
});
