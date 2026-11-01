// Strict tool input (#919): a text step made a required nullable scalar look optional in the listed schema and
// hid a scalar's default; a tool without an input schema took any arguments; renamed fields were a fixed map only.
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toStrictToolInput, withStrictToolInput } from "@softure-ai/mcp-access/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

type JsonObjectSchema = { readonly required?: readonly string[]; readonly properties: Record<string, Record<string, unknown>>; readonly additionalProperties?: unknown };

function listInput(schema: unknown): JsonObjectSchema {
  return z.toJSONSchema(schema as z.ZodType, { io: "input" }) as unknown as JsonObjectSchema;
}

async function sendRequest(server: McpServer, method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
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

async function callTool(server: McpServer, name: string, args: Record<string, unknown>): Promise<{ isError: boolean; text: string }> {
  const result = (await sendRequest(server, "tools/call", { name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  return { isError: result.isError === true, text: result.content.map((item) => item.text).join("\n") };
}

describe("toStrictToolInput: required nullable scalars (#919)", () => {
  const original = z.object({ a: z.number().nullable(), b: z.number(), c: z.boolean().nullable() });

  it("keeps a required nullable number and boolean in required, as the original lists them", () => {
    const listed = listInput(toStrictToolInput(original));

    expect(listed.required).toEqual(["a", "b", "c"]);
    expect(listed.properties).toEqual(listInput(original).properties);
  });

  it("still refuses the call that leaves them out and takes their text", () => {
    const strict = toStrictToolInput(original) as z.ZodType;

    expect(strict.safeParse({ b: 1 }).success).toBe(false);
    expect(strict.safeParse({ a: null, b: 1, c: null }).data).toEqual({ a: null, b: 1, c: null });
    expect(strict.safeParse({ a: "2.5", b: "1", c: "true" }).data).toEqual({ a: 2.5, b: 1, c: true });
  });

  it("lists a default around a scalar and keeps the field optional, as the original does", () => {
    const withDefaults = z.object({
      count: z.number().default(3),
      limit: z.number().nullable().default(null),
      done: z.boolean().default(false),
      page: z.number().prefault(1),
      size: z.number().optional(),
      kind: z.number().nullable(),
    });

    const listed = listInput(toStrictToolInput(withDefaults));

    expect(listed.required).toEqual(listInput(withDefaults).required);
    expect(listed.required).toEqual(["kind"]);
    expect(listed.properties).toEqual(listInput(withDefaults).properties);
    expect(listed.properties.count).toEqual({ default: 3, type: "number" });
    expect(listed.properties.limit).toEqual({ default: null, type: ["number", "null"] });
  });

  it("parses absent, null and text fields under defaults the same as the original", () => {
    const withDefaults = z.object({ count: z.number().default(3), limit: z.number().nullable().default(null), page: z.number().prefault(1), size: z.number().optional() });
    const strict = toStrictToolInput(withDefaults) as z.ZodType;

    expect(strict.safeParse({}).data).toEqual(withDefaults.parse({}));
    expect(strict.safeParse({}).data).toEqual({ count: 3, limit: null, page: 1 });
    expect(strict.safeParse({ count: "7", limit: null, size: "2" }).data).toEqual({ count: 7, limit: null, page: 1, size: 2 });
    expect(strict.safeParse({ count: "x" }).success).toBe(false);
  });

  it("keeps a required field whose union holds a scalar in required", () => {
    const schema = z.object({ amount: z.union([z.number(), z.string()]), pair: z.tuple([z.number().nullable(), z.boolean()]) });

    const listed = listInput(toStrictToolInput(schema));

    expect(listed.required).toEqual(["amount", "pair"]);
    expect((toStrictToolInput(schema) as z.ZodType).safeParse({ pair: [null, "false"] }).success).toBe(false);
  });

  it("leaves a coercing scalar inside a wrapper as it is", () => {
    const schema = z.object({ n: z.coerce.number().nullable() });

    expect(listInput(toStrictToolInput(schema)).required).toEqual(["n"]);
    expect((toStrictToolInput(schema) as z.ZodType).safeParse({ n: "4" }).data).toEqual({ n: 4 });
  });
});

describe("withStrictToolInput: a tool without an input schema (#919)", () => {
  function createServer() {
    const handler = vi.fn((ctx: unknown) => ({ content: [{ type: "text" as const, text: typeof ctx === "object" && ctx !== null ? "context" : "none" }] }));
    const server = withStrictToolInput(new McpServer({ name: "test", version: "1.0.0" }));
    server.registerTool("ping", { description: "Pings." }, handler);
    return { server, handler };
  }

  it("refuses unknown arguments before the handler runs", async () => {
    const { server, handler } = createServer();

    const answer = await callTool(server, "ping", { force: true });

    expect(answer.isError).toBe(true);
    expect(answer.text).toContain('Unknown fields: "force". Accepted fields: none.');
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls the handler with the request context only", async () => {
    const { server, handler } = createServer();

    const answer = await callTool(server, "ping", {});

    expect(answer).toEqual({ isError: false, text: "context" });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]).toHaveLength(1);
  });

  it("lists the strict empty object", async () => {
    const { server } = createServer();

    const result = (await sendRequest(server, "tools/list", {})) as { tools: { inputSchema: unknown }[] };

    expect(result.tools[0]?.inputSchema).toMatchObject({ type: "object", properties: {}, additionalProperties: false });
  });
});

describe("withStrictToolInput: renamed fields by rule (#919)", () => {
  const renameMoney = (field: string): string | undefined => (field.includes("Pln") ? field.replace("Pln", "Home") : undefined);

  it("refuses an old name the rule maps to a field the object accepts", () => {
    const strict = toStrictToolInput(z.object({ priceHome: z.number(), costHome: z.number().optional() }), { renamedFields: renameMoney }) as z.ZodType;

    const result = strict.safeParse({ priceHome: 1, pricePln: 1, costPln: 2 });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'input.field_renamed: the field "pricePln" is now "priceHome". Send it as "priceHome". input.field_renamed: the field "costPln" is now "costHome". Send it as "costHome".',
    ]);
  });

  it("treats a name the rule leaves alone, or maps to a field the object lacks, as unknown", () => {
    const strict = toStrictToolInput(z.object({ priceHome: z.number() }), { renamedFields: renameMoney }) as z.ZodType;

    const result = strict.safeParse({ priceHome: 1, taxPln: 2, color: "red" });

    expect(result.error?.issues[0]?.message).toBe('Unknown fields: "taxPln", "color". Accepted fields: "priceHome".');
  });
});
