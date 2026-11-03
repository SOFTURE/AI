// Issue #953: a priced or irreversible tool call asks the person first. A call without `confirmation` only
// estimates and answers a token bound to the tool, the arguments, the account and access token, the total and an
// expiry; the second call with the same input and the token does the work, once.
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import {
  confirmationInput,
  pruneMcpAccess,
  toCanonicalJson,
  withConfirmation,
  withStrictToolInput,
  type ConfirmationRequest,
  type ToolCallRecord,
  type WithConfirmationOptions,
} from "@softure-ai/mcp-access/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTestMcp, createUser, type TestMcp } from "./support.js";

const SECRET = "s".repeat(32);

interface FilmArgs extends Readonly<Record<string, unknown>> {
  readonly scene: string;
  readonly seconds: number;
}

interface FilmEstimate {
  readonly total: number;
  readonly currency: string;
}

interface Answer {
  readonly isError: boolean;
  readonly text: string;
}

function readAnswer(result: { readonly isError?: boolean; readonly content: readonly unknown[] }): Answer {
  const text = result.content.map((item) => (item as { text: string }).text).join("\n");
  return { isError: result.isError === true, text };
}

function readRequest(answer: Answer): ConfirmationRequest<FilmEstimate> {
  return JSON.parse(answer.text) as ConfirmationRequest<FilmEstimate>;
}

describe("withConfirmation (#953)", () => {
  let test: TestMcp;
  let alice: string;
  let bob: string;
  let price: number;
  let rendered: FilmArgs[];
  let records: ToolCallRecord[];

  function options(overrides: Partial<WithConfirmationOptions<FilmArgs, FilmEstimate>> = {}): WithConfirmationOptions<FilmArgs, FilmEstimate> {
    return {
      ctx: test.ctx,
      identity: { userId: alice, tokenId: "token-a" },
      tool: "render_film",
      estimate: (args) => ({ total: args.seconds * price, currency: "credits" }),
      secret: SECRET,
      onToolCall: (record) => {
        records.push(record);
      },
      ...overrides,
    };
  }

  function film(overrides: Partial<WithConfirmationOptions<FilmArgs, FilmEstimate>> = {}) {
    return withConfirmation((args: FilmArgs) => {
      rendered.push(args);
      return { filmId: `film-${String(rendered.length)}` };
    }, options(overrides));
  }

  async function call(tool: ReturnType<typeof film>, args: FilmArgs & { confirmation?: string }): Promise<Answer> {
    return readAnswer(await tool(args));
  }

  async function estimateOf(tool: ReturnType<typeof film>, args: FilmArgs): Promise<ConfirmationRequest<FilmEstimate>> {
    return readRequest(await call(tool, args));
  }

  beforeEach(async () => {
    test = await createTestMcp();
    alice = await createUser(test.database, "alice@example.com");
    bob = await createUser(test.database, "bob@example.com");
    price = 2;
    rendered = [];
    records = [];
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await test.database.close();
  });

  it("answers the estimate and a token on the first call, and does nothing", async () => {
    const request = await estimateOf(film(), { scene: "beach", seconds: 6 });

    expect(rendered).toEqual([]);
    expect(request).toEqual({
      needsConfirmation: true,
      estimate: { total: 12, currency: "credits" },
      confirmation: expect.stringMatching(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/) as string,
      expiresAt: "2026-09-15T12:15:00.000Z",
      message:
        "Nothing was done yet. Show the person this estimate and ask whether to go ahead. Only after they agree in the chat, call the tool again with the same arguments and \"confirmation\" set to the value above, before 2026-09-15T12:15:00.000Z.",
    });
  });

  it("does the work on the second call with the same arguments and the token, without the token in the arguments", async () => {
    const tool = film();
    const { confirmation } = await estimateOf(tool, { scene: "beach", seconds: 6 });

    const answer = await call(tool, { seconds: 6, scene: "beach", confirmation });

    expect(answer).toEqual({ isError: false, text: JSON.stringify({ filmId: "film-1" }) });
    expect(rendered).toEqual([{ seconds: 6, scene: "beach" }]);
  });

  it("refuses a reused token and does the work only once", async () => {
    const tool = film();
    const { confirmation } = await estimateOf(tool, { scene: "beach", seconds: 6 });
    await call(tool, { scene: "beach", seconds: 6, confirmation });

    const answer = await call(tool, { scene: "beach", seconds: 6, confirmation });

    expect(answer.isError).toBe(true);
    expect(answer.text).toMatch(/^input\.confirmation_used: /);
    expect(rendered).toHaveLength(1);
  });

  it("runs two parallel second calls with one token once", async () => {
    const tool = film();
    const { confirmation } = await estimateOf(tool, { scene: "beach", seconds: 6 });

    const answers = await Promise.all([call(tool, { scene: "beach", seconds: 6, confirmation }), call(tool, { scene: "beach", seconds: 6, confirmation })]);

    expect(answers.map((answer) => answer.isError).sort()).toEqual([false, true]);
    expect(rendered).toHaveLength(1);
  });

  it("refuses changed arguments and keeps the token valid for the agreed ones", async () => {
    const tool = film();
    const { confirmation } = await estimateOf(tool, { scene: "beach", seconds: 6 });

    const changed = await call(tool, { scene: "beach", seconds: 7, confirmation });
    const agreed = await call(tool, { scene: "beach", seconds: 6, confirmation });

    expect(changed.isError).toBe(true);
    expect(changed.text).toMatch(/^input\.confirmation_arguments_changed: /);
    expect(agreed.isError).toBe(false);
    expect(rendered).toEqual([{ scene: "beach", seconds: 6 }]);
  });

  it("refuses a token issued to another account or another access token", async () => {
    const { confirmation } = await estimateOf(film(), { scene: "beach", seconds: 6 });

    const otherAccount = await call(film({ identity: { userId: bob, tokenId: "token-a" } }), { scene: "beach", seconds: 6, confirmation });
    const otherToken = await call(film({ identity: { userId: alice, tokenId: "token-b" } }), { scene: "beach", seconds: 6, confirmation });

    expect(otherAccount.text).toMatch(/^input\.confirmation_other_account: /);
    expect(otherToken.text).toMatch(/^input\.confirmation_other_account: /);
    expect(rendered).toEqual([]);
  });

  it("refuses a token of another tool", async () => {
    const { confirmation } = await estimateOf(film({ tool: "render_trailer" }), { scene: "beach", seconds: 6 });

    const answer = await call(film(), { scene: "beach", seconds: 6, confirmation });

    expect(answer.text).toMatch(/^input\.confirmation_other_tool: /);
    expect(rendered).toEqual([]);
  });

  it("refuses an expired token at the expiry, and accepts it a second before", async () => {
    const tool = film({ ttlSeconds: 60 });
    const late = await estimateOf(tool, { scene: "beach", seconds: 6 });
    const early = await estimateOf(tool, { scene: "beach", seconds: 6 });

    test.clock.advance(59_000);
    const inTime = await call(tool, { scene: "beach", seconds: 6, confirmation: early.confirmation });
    test.clock.advance(1_000);
    const expired = await call(tool, { scene: "beach", seconds: 6, confirmation: late.confirmation });

    expect(inTime.isError).toBe(false);
    expect(expired.text).toMatch(/^input\.confirmation_expired: /);
    expect(rendered).toHaveLength(1);
  });

  it("refuses a token when the estimate's total changed after the yes", async () => {
    const tool = film();
    const { confirmation } = await estimateOf(tool, { scene: "beach", seconds: 6 });
    price = 3;

    const answer = await call(tool, { scene: "beach", seconds: 6, confirmation });

    expect(answer.text).toMatch(/^input\.confirmation_estimate_changed: /);
    expect(rendered).toEqual([]);
  });

  it("refuses a forged, tampered or foreign-key token as invalid", async () => {
    const tool = film();
    const { confirmation } = await estimateOf(tool, { scene: "beach", seconds: 6 });
    const [payload = "", signature = ""] = confirmation.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const tampered = `${Buffer.from(JSON.stringify({ ...decoded, n: 0 })).toString("base64url")}.${signature}`;
    const { confirmation: foreign } = await estimateOf(film({ secret: "x".repeat(32) }), { scene: "beach", seconds: 6 });

    for (const token of ["yes", "", tampered, foreign, `${payload}.${"A".repeat(43)}`, "a".repeat(3000)]) {
      const answer = await call(tool, { scene: "beach", seconds: 6, confirmation: token });
      expect(answer.text, token.slice(0, 20)).toMatch(/^input\.confirmation_invalid: /);
    }
    expect(rendered).toEqual([]);
  });

  it("runs at once without asking when runWithoutConfirmationWhen says so", async () => {
    price = 0;
    const answer = await call(film({ runWithoutConfirmationWhen: (estimate) => estimate.total === 0 }), { scene: "beach", seconds: 6 });

    expect(answer).toEqual({ isError: false, text: JSON.stringify({ filmId: "film-1" }) });
    expect(records.map((record) => record.confirmed)).toEqual([false]);
  });

  it("records confirmed false for the estimate and a refusal, true for the confirmed call, without the confirmation's name", async () => {
    const tool = film();
    const { confirmation } = await estimateOf(tool, { scene: "beach", seconds: 6 });
    await call(tool, { scene: "beach", seconds: 7, confirmation });
    await call(tool, { scene: "beach", seconds: 6, confirmation });

    expect(records.map((record) => ({ tool: record.tool, confirmed: record.confirmed, outcome: record.outcome, argumentNames: record.argumentNames }))).toEqual([
      { tool: "render_film", confirmed: false, outcome: { kind: "succeeded", itemCount: null }, argumentNames: ["scene", "seconds"] },
      { tool: "render_film", confirmed: false, outcome: { kind: "failed", code: "input.confirmation_arguments_changed" }, argumentNames: ["scene", "seconds"] },
      { tool: "render_film", confirmed: true, outcome: { kind: "succeeded", itemCount: null }, argumentNames: ["scene", "seconds"] },
    ]);
  });

  it("answers the app's hint instead of the dictionary's refusal text", async () => {
    const tool = film({ hints: { "input.confirmation_used": "Already rendered." } });
    const { confirmation } = await estimateOf(tool, { scene: "beach", seconds: 6 });
    await call(tool, { scene: "beach", seconds: 6, confirmation });

    expect(await call(tool, { scene: "beach", seconds: 6, confirmation })).toEqual({ isError: true, text: "Already rendered." });
  });

  it("reads MCP_CONFIRMATION_SECRET when no secret is passed, and fails as a bug without one", async () => {
    vi.stubEnv("MCP_CONFIRMATION_SECRET", "e".repeat(32));
    const fromEnv = film({ secret: undefined as unknown as string });
    const { confirmation } = await estimateOf(fromEnv, { scene: "beach", seconds: 6 });
    expect((await call(fromEnv, { scene: "beach", seconds: 6, confirmation })).isError).toBe(false);

    vi.stubEnv("MCP_CONFIRMATION_SECRET", "short");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const answer = await call(fromEnv, { scene: "beach", seconds: 6 });

    expect(answer).toEqual({ isError: true, text: "The tool failed; try again later." });
    expect(error).toHaveBeenCalledWith("@softure-ai/mcp-access: tool render_film needs MCP_CONFIRMATION_SECRET (at least 32 characters)");
    expect(rendered).toHaveLength(1);
  });

  it("binds the arguments by their canonical JSON: key order and undefined fields do not matter", () => {
    expect(toCanonicalJson({ b: 1, a: { d: [1, { f: 2, e: undefined }], c: undefined } })).toBe('{"a":{"d":[1,{"f":2}]},"b":1}');
    expect(toCanonicalJson({ at: new Date("2026-09-15T12:00:00Z") })).toBe('{"at":"2026-09-15T12:00:00.000Z"}');
  });

  it("prunes used tokens once their expiry has passed", async () => {
    const tool = film({ ttlSeconds: 60 });
    const { confirmation } = await estimateOf(tool, { scene: "beach", seconds: 6 });
    await call(tool, { scene: "beach", seconds: 6, confirmation });

    expect((await pruneMcpAccess(test.ctx)).usedConfirmations).toBe(0);
    test.clock.advance(60_000);
    expect(await pruneMcpAccess(test.ctx)).toEqual({ accessTokens: 0, codes: 0, grants: 0, clients: 0, usedConfirmations: 1, operationTasks: 0 });
  });

  it("lists confirmation in a strict tool's schema and accepts it over MCP", async () => {
    const server = withStrictToolInput(new McpServer({ name: "acme", version: "1.0.0" }));
    server.registerTool(
      "render_film",
      { description: "Renders a film.", inputSchema: { scene: z.string(), seconds: z.number(), confirmation: confirmationInput } },
      film(),
    );
    const handler = createMcpHandler(() => server, { responseMode: "json" });
    const send = async (method: string, params: Record<string, unknown>) => {
      const response = await handler.fetch(
        new Request("http://localhost/api/mcp", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        }),
      );
      const body = await response.text();
      const data = body.startsWith("event:") ? (body.split("\n").find((line) => line.startsWith("data: "))?.slice(6) ?? "null") : body;
      return (JSON.parse(data) as { result: Record<string, unknown> }).result;
    };

    const listed = (await send("tools/list", {})) as { tools: { inputSchema: { properties: Record<string, unknown>; required?: string[] } }[] };
    const first = readRequest(readAnswer((await send("tools/call", { name: "render_film", arguments: { scene: "beach", seconds: 6 } })) as never));
    const second = readAnswer(
      (await send("tools/call", { name: "render_film", arguments: { scene: "beach", seconds: "6", confirmation: first.confirmation } })) as never,
    );

    expect(Object.keys(listed.tools[0]?.inputSchema.properties ?? {})).toEqual(["scene", "seconds", "confirmation"]);
    expect(listed.tools[0]?.inputSchema.required).toEqual(["scene", "seconds"]);
    expect(second).toEqual({ isError: false, text: JSON.stringify({ filmId: "film-1" }) });
  });
});
