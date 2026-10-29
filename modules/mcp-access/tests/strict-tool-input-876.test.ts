// Strict tool input (#876): zod objects strip unknown keys, so a misspelt field answered as a write that
// worked while its value was dropped. Every call here goes through the SDK's own `tools/call` path, so a
// refusal is measured before the handler runs.
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { McpServerIdentity } from "@softure-ai/mcp-access";
import { createMcpServerFactory, measureToolList, toStrictToolInput, withStrictToolInput, type McpServerFactory, type StrictToolInputOptions } from "@softure-ai/mcp-access/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const WRITER: McpServerIdentity = { userId: "00000000-0000-4000-8000-000000000002", canWrite: true, tokenId: "token-1" };

type ServedServer = Awaited<ReturnType<McpServerFactory>>;

interface ToolAnswer {
  readonly isError: boolean;
  readonly text: string;
}

/** Sends one JSON-RPC request to the server the way the endpoint serves it and returns its `result`. */
async function sendRequest(server: ServedServer, method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const handler = createMcpHandler(() => server, { responseMode: "json" });
  const response = await handler.fetch(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  const body = await response.text();
  const data = body.startsWith("event:") ? (body.split("\n").find((line) => line.startsWith("data: "))?.slice(6) ?? "null") : body;
  const answer = JSON.parse(data) as { result?: Record<string, unknown>; error?: unknown };
  if (answer.result === undefined) throw new Error(`${method} gave no result: ${JSON.stringify(answer.error)}`);
  return answer.result;
}

async function callTool(server: ServedServer, name: string, args: Record<string, unknown>): Promise<ToolAnswer> {
  const result = (await sendRequest(server, "tools/call", { name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  return { isError: result.isError === true, text: result.content.map((item) => item.text).join("\n") };
}

async function listInputSchemas(server: ServedServer): Promise<Record<string, unknown>> {
  const result = (await sendRequest(server, "tools/list", {})) as { tools: { name: string; inputSchema: unknown }[] };
  return Object.fromEntries(result.tools.map((tool) => [tool.name, tool.inputSchema]));
}

/** A strict server with one `save` tool over the schema; the spy sees what the handler received. */
function createStrictServer(inputSchema: z.ZodType, options: StrictToolInputOptions = {}) {
  const handler = vi.fn((args: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(args) }] }));
  const server = withStrictToolInput(new McpServer({ name: "test", version: "1.0.0" }), options);
  server.registerTool("save", { description: "Saves.", inputSchema }, handler);
  return { server, handler };
}

describe("withStrictToolInput: unknown fields", () => {
  const cases: { readonly name: string; readonly schema: z.ZodType; readonly args: Record<string, unknown>; readonly path: string; readonly accepted: string }[] = [
    { name: "the top level", schema: z.object({ note: z.string() }), args: { notes: "x" }, path: "", accepted: '"note"' },
    { name: "a nested object", schema: z.object({ item: z.object({ title: z.string(), done: z.boolean() }) }), args: { item: { title: "a", done: true, color: "red" } }, path: "item: ", accepted: '"title", "done"' },
    { name: "an array item", schema: z.object({ items: z.array(z.object({ title: z.string() })) }), args: { items: [{ title: "a" }, { title: "b", size: 1 }] }, path: "items.1: ", accepted: '"title"' },
    { name: "a record value", schema: z.object({ byId: z.record(z.string(), z.object({ title: z.string() })) }), args: { byId: { a: { title: "a", extra: 1 } } }, path: "byId.a: ", accepted: '"title"' },
    { name: "an optional object", schema: z.object({ meta: z.object({ tag: z.string() }).optional() }), args: { meta: { tag: "a", tags: ["b"] } }, path: "meta: ", accepted: '"tag"' },
    { name: "an object with a default", schema: z.object({ meta: z.object({ tag: z.string() }).default({ tag: "a" }) }), args: { meta: { tag: "a", tags: ["b"] } }, path: "meta: ", accepted: '"tag"' },
    { name: "a nullable object", schema: z.object({ meta: z.object({ tag: z.string() }).nullable() }), args: { meta: { tag: "a", tags: ["b"] } }, path: "meta: ", accepted: '"tag"' },
    { name: "a tuple item", schema: z.object({ pair: z.tuple([z.object({ x: z.number() }), z.string()]) }), args: { pair: [{ x: 1, y: 2 }, "a"] }, path: "pair.0: ", accepted: '"x"' },
    { name: "a union branch", schema: z.object({ target: z.union([z.object({ id: z.string() }), z.object({ slug: z.string(), scope: z.string() })]) }), args: { target: { id: "a", ids: ["b"] } }, path: "target: ", accepted: '"id"' },
    { name: "a discriminated union branch", schema: z.discriminatedUnion("kind", [z.object({ kind: z.literal("note"), text: z.string() }), z.object({ kind: z.literal("task"), due: z.string() })]), args: { kind: "task", due: "2026-10-30", text: "x" }, path: "", accepted: '"kind", "due"' },
    { name: "the input side of a transform", schema: z.object({ range: z.object({ from: z.number(), to: z.number() }).transform((range) => range.to - range.from) }), args: { range: { from: 1, to: 2, step: 1 } }, path: "range: ", accepted: '"from", "to"' },
    { name: "a lazy schema", schema: z.object({ node: z.lazy(() => z.object({ id: z.string() })) }), args: { node: { id: "a", name: "b" } }, path: "node: ", accepted: '"id"' },
  ];

  for (const testCase of cases) {
    it(`refuses an unknown field in ${testCase.name} and names the accepted ones`, async () => {
      const { server, handler } = createStrictServer(testCase.schema);

      const answer = await callTool(server, "save", testCase.args);

      expect(answer.isError).toBe(true);
      expect(answer.text).toContain(`${testCase.path}Unknown fields:`);
      expect(answer.text).toContain(`Accepted fields: ${testCase.accepted}.`);
      expect(handler).not.toHaveBeenCalled();
    });
  }

  it("refuses a field neither side of an intersection knows and keeps the fields each side owns", async () => {
    const { server, handler } = createStrictServer(z.intersection(z.object({ title: z.string() }), z.object({ due: z.string() })));

    const accepted = await callTool(server, "save", { title: "a", due: "b" });
    const refused = await callTool(server, "save", { title: "a", due: "b", owner: "c" });

    expect(accepted.isError).toBe(false);
    expect(JSON.parse(accepted.text)).toEqual({ title: "a", due: "b" });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain('Unknown fields: "owner".');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("names every unknown field of one object and an object with no fields", async () => {
    const { server } = createStrictServer(z.object({ empty: z.object({}).optional(), title: z.string() }));

    const answer = await callTool(server, "save", { title: "a", empty: { x: 1 }, color: "red", size: 2 });

    expect(answer.text).toContain('Unknown fields: "color", "size". Accepted fields: "empty", "title".');
    expect(answer.text).toContain("empty: Unknown fields: \"x\". Accepted fields: none.");
  });

  it("accepts a known call and hands the handler the parsed value", async () => {
    const { server, handler } = createStrictServer(z.object({ title: z.string(), tags: z.array(z.string()).default([]) }));

    const answer = await callTool(server, "save", { title: "a" });

    expect(answer.isError).toBe(false);
    expect(handler.mock.calls[0]?.[0]).toEqual({ title: "a", tags: [] });
  });

  it("keeps an object that accepts extra fields on purpose", async () => {
    const { server } = createStrictServer(z.object({ title: z.string(), extra: z.looseObject({ a: z.string() }) }));

    const answer = await callTool(server, "save", { title: "a", extra: { a: "x", b: "y" } });

    expect(answer.isError).toBe(false);
    expect(JSON.parse(answer.text)).toEqual({ title: "a", extra: { a: "x", b: "y" } });
  });

  it("keeps the object's refinements and its own messages for other issues", async () => {
    const schema = z
      .object({ from: z.number(), to: z.number() }, { error: (issue) => (issue.code === "invalid_type" ? "Send a range." : undefined) })
      .refine((range) => range.from <= range.to, "from must not be after to");
    const { server } = createStrictServer(z.object({ range: schema }));

    const backwards = await callTool(server, "save", { range: { from: 2, to: 1 } });
    const wrongType = await callTool(server, "save", { range: "1-2" });

    expect(backwards.text).toContain("range: from must not be after to");
    expect(wrongType.text).toContain("range: Send a range.");
  });

  it("accepts a raw shape as the input schema", async () => {
    const handler = vi.fn(() => ({ content: [] }));
    const server = withStrictToolInput(new McpServer({ name: "test", version: "1.0.0" }));
    server.registerTool("save", { inputSchema: { title: z.string() } }, handler);

    const answer = await callTool(server, "save", { title: "a", titel: "b" });

    expect(answer.text).toContain('Unknown fields: "titel". Accepted fields: "title".');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withStrictToolInput: renamed fields", () => {
  it("refuses a field under its old name with a stable code that names the new one", async () => {
    const { server, handler } = createStrictServer(z.object({ items: z.array(z.object({ note: z.string() })) }), { renamedFields: { notes: "note" } });

    const answer = await callTool(server, "save", { items: [{ notes: "x" }] });

    expect(answer.isError).toBe(true);
    expect(answer.text).toContain('items.0: input.field_renamed: the field "notes" is now "note". Send it as "note".');
    expect(handler).not.toHaveBeenCalled();
  });

  it("treats the old name as an unknown field where the object does not accept the new one", async () => {
    const { server } = createStrictServer(z.object({ title: z.string() }), { renamedFields: { notes: "note" } });

    const answer = await callTool(server, "save", { title: "a", notes: "x" });

    expect(answer.text).not.toContain("input.field_renamed");
    expect(answer.text).toContain('Unknown fields: "notes". Accepted fields: "title".');
  });

  it("reports a renamed and an unknown field of the same object together", async () => {
    const { server } = createStrictServer(z.object({ note: z.string() }), { renamedFields: { notes: "note" } });

    const answer = await callTool(server, "save", { notes: "x", color: "red" });

    expect(answer.text).toContain('input.field_renamed: the field "notes" is now "note". Send it as "note". Unknown fields: "color". Accepted fields: "note".');
  });
});

describe("withStrictToolInput: text scalars", () => {
  const schema = z.object({ done: z.boolean(), count: z.number().int().min(0), ratio: z.number().optional(), flags: z.array(z.boolean()).optional() });

  it("converts the exact text of a boolean and a number before the field's own rules", async () => {
    const { server, handler } = createStrictServer(schema);

    const answer = await callTool(server, "save", { done: "false", count: "12", ratio: "-0.5e1", flags: ["true", false] });

    expect(answer.isError).toBe(false);
    expect(handler.mock.calls[0]?.[0]).toEqual({ done: false, count: 12, ratio: -5, flags: [true, false] });
  });

  it("refuses any other text and keeps the field's own rules", async () => {
    const { server, handler } = createStrictServer(schema);

    const answers: ToolAnswer[] = [];
    for (const args of [
      { done: "yes", count: 1 },
      { done: "True", count: 1 },
      { done: true, count: " 1" },
      { done: true, count: "" },
      { done: true, count: "0x10" },
      { done: true, count: "1.5" },
      { done: true, count: "-1" },
    ]) {
      answers.push(await callTool(server, "save", args));
    }

    expect(answers.map((answer) => answer.isError)).toEqual([true, true, true, true, true, true, true]);
    expect(answers[0]?.text).toContain("done: Invalid input: expected boolean, received string");
    expect(answers[6]?.text).toContain("count: Too small");
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps boolean and number in the listed schema and adds additionalProperties: false", async () => {
    const { server } = createStrictServer(schema.describe("What to save."));

    const listed = (await listInputSchemas(server)).save;

    expect(listed).toEqual({
      type: "object",
      description: "What to save.",
      properties: {
        done: { type: "boolean" },
        count: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
        ratio: { type: "number" },
        flags: { type: "array", items: { type: "boolean" } },
      },
      required: ["done", "count"],
      additionalProperties: false,
      $schema: "https://json-schema.org/draft/2020-12/schema",
    });
  });

  it("leaves text alone when turned off", async () => {
    const { server, handler } = createStrictServer(schema, { coerceTextScalars: false });

    const answer = await callTool(server, "save", { done: "true", count: 1 });

    expect(answer.isError).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withStrictToolInput: registration", () => {
  it("keeps field descriptions in the listed schema", async () => {
    const { server } = createStrictServer(z.object({ note: z.string().describe("The note's text."), meta: z.object({ tag: z.string() }).describe("Labels.").optional() }));

    const listed = (await listInputSchemas(server)).save as { properties: Record<string, { description?: string; additionalProperties?: boolean }> };

    expect(listed.properties.note?.description).toBe("The note's text.");
    expect(listed.properties.meta?.description).toBe("Labels.");
    expect(listed.properties.meta?.additionalProperties).toBe(false);
  });

  it("makes a tool registered later strict too and wraps a server once", async () => {
    const server = withStrictToolInput(withStrictToolInput(new McpServer({ name: "test", version: "1.0.0" })));
    server.registerTool("first", { inputSchema: z.object({ a: z.string() }) }, () => ({ content: [] }));
    server.registerTool("second", { inputSchema: z.object({ b: z.string() }) }, () => ({ content: [] }));
    server.registerTool("plain", { description: "No input." }, () => ({ content: [{ type: "text", text: "ok" }] }));

    const second = await callTool(server, "second", { b: "x", c: "y" });
    const plain = await callTool(server, "plain", {});

    expect(second.text).toContain('Unknown fields: "c". Accepted fields: "b".');
    expect(second.text.match(/Unknown fields/g)).toHaveLength(1);
    expect(plain).toEqual({ isError: false, text: "ok" });
  });

  it("answers through the app's dictionary", async () => {
    const { server } = createStrictServer(z.object({ note: z.string() }), {
      renamedFields: { notes: "note" },
      messages: { unknownFields: "Nieznane: {fields}; dozwolone: {accepted}.", noFields: "brak", fieldRenamed: "input.field_renamed {field}→{renamed}" },
    });

    const answer = await callTool(server, "save", { notes: "x", color: "red" });

    expect(answer.text).toContain('input.field_renamed notes→note Nieznane: "color"; dozwolone: "note".');
  });

  it("passes a schema that is not zod through unchanged", () => {
    const schema = { "~standard": { version: 1, vendor: "other", validate: (value: unknown) => ({ value }) } };

    expect(toStrictToolInput(schema)).toBe(schema);
  });
});

describe("createMcpServerFactory: strictToolInput", () => {
  function registerSave(server: McpServer): void {
    server.registerTool("save", { inputSchema: z.object({ note: z.string(), pinned: z.boolean().optional() }) }, (args) => ({ content: [{ type: "text", text: JSON.stringify(args) }] }));
  }

  it("serves strict tools and measures the strict listing", async () => {
    const createServer = createMcpServerFactory({ name: "acme", strictToolInput: { renamedFields: { notes: "note" } }, registerTools: (server) => registerSave(server) });
    const loose = await measureToolList((server) => registerSave(server), { name: "acme" });
    const strict = await measureToolList((server) => registerSave(withStrictToolInput(server)), { name: "acme" });

    const server = await createServer(WRITER);
    const refused = await callTool(server, "save", { notes: "x" });
    const coerced = await callTool(server, "save", { note: "x", pinned: "true" });
    const info = (await sendRequest(server, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } })) as { serverInfo: { version: string } };

    expect(refused.text).toContain('input.field_renamed: the field "notes" is now "note".');
    expect(JSON.parse(coerced.text)).toEqual({ note: "x", pinned: true });
    expect(strict.toolListVersion).not.toBe(loose.toolListVersion);
    expect(info.serverInfo.version).toBe(strict.toolListVersion);
  });

  it("keeps tools as they are without the option", async () => {
    const createServer = createMcpServerFactory({ name: "acme", registerTools: (server) => registerSave(server) });

    const answer = await callTool(await createServer(WRITER), "save", { note: "x", color: "red" });

    expect(answer.isError).toBe(false);
  });
});
