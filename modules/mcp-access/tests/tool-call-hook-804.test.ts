// Issue #804: a hook around each tool call. `withToolErrors` and `actionTool` hand an optional `onToolCall`
// one record per call (tool, caller, argument names, outcome with its code, start and duration) without
// changing the answer, and `findTokenClientName` resolves the client's name from the token id.
import { err, ok, PublicError } from "@softure-ai/core";
import {
  actionTool,
  findTokenClientName,
  issueAccessToken,
  toolError,
  withToolErrors,
  type ToolCallRecord,
} from "@softure-ai/mcp-access/server";
import { STDIO_TOKEN_ID } from "@softure-ai/mcp-access/stdio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestMcp, createUser, type TestMcp } from "./support.js";

const STARTED_AT = new Date("2026-10-26T12:00:00Z");
const CALLER = { tokenId: "6f1c2a7e-0d3b-4c55-9a8e-2b7f4d1e9c30", clientName: "Laptop" };
const DRIZZLE_FAILURE = 'Failed query: select "id" from "orders" where "email" = $1\nparams: alice@example.com';

const text = (value: string) => ({ content: [{ type: "text", text: value }] });
const errorText = (value: string) => ({ content: [{ type: "text", text: value }], isError: true });

/** Runs `work` 250 ms long under fake timers and returns the answer and every record the hook got. */
async function callTimed(run: (onToolCall: (record: ToolCallRecord) => void) => Promise<unknown>) {
  const records: ToolCallRecord[] = [];
  const answer = run((record) => {
    records.push(record);
  });
  await vi.advanceTimersByTimeAsync(250);
  return { answer: await answer, records };
}

const slowly = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 250));
const slowlyThrow = (error: Error) => new Promise<never>((_, reject) => setTimeout(() => reject(error), 250));

describe("onToolCall in withToolErrors", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: STARTED_AT });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("records a succeeded call with the tool, caller, argument names, item count, start and duration", async () => {
    const { answer, records } = await callTimed((onToolCall) =>
      withToolErrors(() => slowly(ok([1, 2, 3])), {
        label: "list_orders",
        caller: CALLER,
        args: { status: "open", email: "alice@example.com" },
        onToolCall,
      }),
    );
    expect(answer).toEqual(text("[1,2,3]"));
    expect(records).toEqual([
      {
        tool: "list_orders",
        tokenId: CALLER.tokenId,
        clientName: "Laptop",
        argumentNames: ["status", "email"],
        outcome: { kind: "succeeded", itemCount: 3 },
        startedAt: STARTED_AT,
        durationMs: 250,
      },
    ]);
    expect(JSON.stringify(records)).not.toContain("alice@example.com");
  });

  it("counts no items for a value that is not an array, or a tool result", async () => {
    const outcomes: unknown[] = [];
    const onToolCall = (record: ToolCallRecord) => {
      outcomes.push(record.outcome);
    };
    await withToolErrors(() => ({ id: 1 }), { onToolCall });
    await withToolErrors(() => ok("done"), { onToolCall });
    await withToolErrors(() => text("done"), { onToolCall });
    expect(outcomes).toEqual([
      { kind: "succeeded", itemCount: null },
      { kind: "succeeded", itemCount: null },
      { kind: "succeeded", itemCount: null },
    ]);
  });

  it("records a failed result with its code while the answer keeps the hint", async () => {
    const { answer, records } = await callTimed((onToolCall) =>
      withToolErrors(() => slowly(err("orders.not_found")), { hints: { "orders.not_found": "No such order." }, onToolCall }),
    );
    expect(answer).toEqual(errorText("No such order."));
    expect(records.map((record) => [record.tool, record.tokenId, record.clientName, record.argumentNames, record.outcome])).toEqual([
      ["call", null, null, [], { kind: "failed", code: "orders.not_found" }],
    ]);
  });

  it("records a tool error result without a code", async () => {
    const records: ToolCallRecord[] = [];
    await withToolErrors(() => toolError("kept"), { onToolCall: (record) => records.push(record) });
    expect(records.map((record) => record.outcome)).toEqual([{ kind: "failed", code: null }]);
  });

  it("records a thrown failure with its safeError code and a PublicError without one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const thrown = await callTimed((onToolCall) => withToolErrors(() => slowlyThrow(new Error(DRIZZLE_FAILURE)), { onToolCall }));
    expect(thrown.answer).toEqual(errorText("The database could not answer; try again later."));
    expect(thrown.records.map((record) => [record.outcome, record.durationMs])).toEqual([[{ kind: "thrown", code: "core.database_failed" }, 250]]);

    const records: ToolCallRecord[] = [];
    const onToolCall = (record: ToolCallRecord) => records.push(record);
    await withToolErrors(() => {
      throw new Error("boom");
    }, { onToolCall });
    await withToolErrors(() => {
      throw new PublicError("This plan has ended.");
    }, { onToolCall });
    expect(records.map((record) => record.outcome)).toEqual([
      { kind: "thrown", code: "core.unexpected" },
      { kind: "thrown", code: null },
    ]);
  });

  it("keeps the answer when the hook throws or rejects, and logs only the error's kind", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const throwing = () => {
      throw new Error(DRIZZLE_FAILURE);
    };
    const rejecting = () => Promise.reject(new Error(DRIZZLE_FAILURE));
    expect(await withToolErrors(() => ok([1]), { label: "list_orders", onToolCall: throwing })).toEqual(text("[1]"));
    expect(await withToolErrors(() => err("orders.not_found"), { label: "list_orders", onToolCall: rejecting })).toEqual(
      errorText("orders.not_found"),
    );
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0]?.[0]).toMatch(/^@softure-ai\/mcp-access: the onToolCall hook failed for tool list_orders: /);
    expect(JSON.stringify(log.mock.calls)).not.toContain("alice@example.com");
  });

  it("answers exactly as before without a hook", async () => {
    expect(await withToolErrors(() => ok([1]), { caller: CALLER, args: { id: 1 } })).toEqual(text("[1]"));
  });
});

describe("onToolCall in actionTool", () => {
  it("records the action's error code, the argument names and the caller", async () => {
    const records: ToolCallRecord[] = [];
    const tool = actionTool(() => ({ status: "error", error: "orders.out_of_stock" }), {
      label: "place_order",
      hints: { "orders.out_of_stock": "That item is out of stock." },
      caller: CALLER,
      onToolCall: (record) => records.push(record),
    });
    expect(await tool({ sku: "A-1", quantity: 2 })).toEqual(errorText("That item is out of stock."));
    expect(records.map((record) => [record.tool, record.clientName, record.argumentNames, record.outcome])).toEqual([
      ["place_order", "Laptop", ["sku", "quantity"], { kind: "failed", code: "orders.out_of_stock" }],
    ]);
  });

  it("records a succeeded action and keeps the error answer without hints", async () => {
    const records: ToolCallRecord[] = [];
    const onToolCall = (record: ToolCallRecord) => records.push(record);
    expect(await actionTool(() => ({ status: "success" }), { message: "Order placed.", onToolCall })({ sku: "A-1" })).toEqual(
      text("Order placed."),
    );
    expect(await actionTool(() => err("orders.locked"))({ sku: "A-1" })).toEqual(errorText("orders.locked"));
    expect(records.map((record) => record.outcome)).toEqual([{ kind: "succeeded", itemCount: null }]);
  });
});

describe("findTokenClientName", () => {
  let test: TestMcp;

  beforeEach(async () => {
    test = await createTestMcp();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("returns the name of a stored token", async () => {
    const alice = await createUser(test.database, "alice@example.com");
    const issued = await issueAccessToken(test.ctx, { userId: alice, name: "Laptop", canWrite: false });
    if (!issued.ok) throw new Error(`issue failed: ${issued.error}`);
    expect(await findTokenClientName(test.ctx, issued.value.id)).toBe("Laptop");
  });

  it("returns null for an unknown id and for the stdio id", async () => {
    expect(await findTokenClientName(test.ctx, CALLER.tokenId)).toBeNull();
    expect(await findTokenClientName(test.ctx, STDIO_TOKEN_ID)).toBeNull();
  });
});
