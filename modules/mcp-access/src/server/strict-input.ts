// Strict tool input. zod objects strip unknown keys, so a tool call with a misspelt field (`notes` for
// `note`) or a field of a newer tool list answers as a write that worked while the value was dropped.
// `withStrictToolInput` rewrites every input schema once, at registration: each object refuses a field
// it does not know and names the ones it accepts, a field sent under its old name is refused with the
// stable code `input.field_renamed`, and boolean and number fields also take their exact text (a client
// on an older tool list sends a field it does not know as text). A tool registered without an input schema
// gets the strict empty object. The SDK validates before the handler runs, so a refused call saves nothing.
//
//   const server = withStrictToolInput(new McpServer({ name: "acme", version }), { renamedFields: { notes: "note" } });
import type { McpServer } from "@modelcontextprotocol/server";
import { formatMessage } from "@softure-ai/core";
import { z } from "zod";
import type * as core from "zod/v4/core";
import { en } from "../messages/en.js";

/** The texts of a refused field: `toolInput` of the module dictionary (`getMcpAccessMessages(config).toolInput`). */
export type StrictToolInputMessages = typeof en.toolInput;

/** Old field name → new field name, as a map or a rule (`undefined`: not renamed). */
export type RenamedFields = Readonly<Record<string, string>> | ((field: string) => string | undefined);

export interface StrictToolInputOptions {
  /** Old field name → new field name, refused as `input.field_renamed` wherever an object accepts the new name. */
  readonly renamedFields?: RenamedFields;
  /** Boolean fields also take `"true"`/`"false"` and number fields a number written as text. Default: `true`. */
  readonly coerceTextScalars?: boolean;
  /** Default: the module's English dictionary. */
  readonly messages?: StrictToolInputMessages;
}

/** A JSON number literal: no spaces, no hex, no empty text. */
const NUMBER_TEXT = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

const strictServers = new WeakSet<McpServer>();

type ToolConfig = Readonly<Record<string, unknown>> & { readonly inputSchema?: unknown };
type RegisterTool = (name: string, config: ToolConfig, callback: unknown) => unknown;
type ContextCallback = (ctx: unknown) => unknown;

/** Makes every tool registered on the server from now on strict; wrapping a server twice changes nothing. */
export function withStrictToolInput<Server extends McpServer>(server: Server, options: StrictToolInputOptions = {}): Server {
  if (strictServers.has(server)) return server;
  // The SDK's overloads only differ in how the schema is typed; at runtime it is one method.
  const register = server.registerTool.bind(server) as unknown as RegisterTool;
  const registerStrict: RegisterTool = (name, config, callback) => {
    if (config.inputSchema !== undefined) return register(name, { ...config, inputSchema: toStrictToolInput(config.inputSchema, options) }, callback);
    // Without a schema the SDK skips validation and calls `callback(ctx)`; with the strict empty object it calls
    // `callback(args, ctx)`, so the callback keeps receiving the context only.
    const contextCallback = callback as ContextCallback;
    return register(name, { ...config, inputSchema: toStrictToolInput(z.object({}), options) }, (_args: unknown, ctx: unknown) => contextCallback(ctx));
  };
  Object.defineProperty(server, "registerTool", { value: registerStrict, configurable: true, writable: true });
  strictServers.add(server);
  return server;
}

/** The strict form of a tool's input schema: a zod 4 schema or raw shape is rewritten, anything else passes unchanged. */
export function toStrictToolInput(schema: unknown, options: StrictToolInputOptions = {}): unknown {
  const zodSchema = isZodSchema(schema) ? schema : isRawShape(schema) ? z.object(schema) : null;
  if (zodSchema === null) return schema;
  const rewriter = new StrictRewriter({
    renameField: toRenameRule(options.renamedFields ?? {}),
    coerceTextScalars: options.coerceTextScalars ?? true,
    messages: options.messages ?? en.toolInput,
  });
  return rewriter.rewrite(zodSchema);
}

function isZodSchema(value: unknown): value is core.$ZodType {
  return typeof value === "object" && value !== null && "_zod" in value;
}

function isRawShape(value: unknown): value is Record<string, core.$ZodType> {
  if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every(isZodSchema);
}

function toRenameRule(renamedFields: RenamedFields): (field: string) => string | undefined {
  if (typeof renamedFields === "function") return renamedFields;
  return (field) => (Object.hasOwn(renamedFields, field) ? renamedFields[field] : undefined);
}

interface RewriteSettings {
  readonly renameField: (field: string) => string | undefined;
  readonly coerceTextScalars: boolean;
  readonly messages: StrictToolInputMessages;
}

/** Wrappers that keep the value's kind: a chain of them around a scalar takes the text step around the whole chain. */
const WRAPPER_TYPES = new Set(["optional", "nullable", "default", "prefault", "nonoptional", "readonly", "catch"]);

/** A schema node as the rewriter reads it: its kind and the parts it rewrites. */
type AnyDef = core.$ZodTypeDef & Record<string, unknown>;

class StrictRewriter {
  // The same node (a shared field, a recursive `z.lazy`) is rewritten once.
  private readonly rewritten = new Map<core.$ZodType, core.$ZodType>();

  constructor(private readonly settings: RewriteSettings) {}

  rewrite(schema: core.$ZodType): core.$ZodType {
    const known = this.rewritten.get(schema);
    if (known !== undefined) return known;
    const result = this.rewriteNode(schema);
    this.rewritten.set(schema, result);
    return result;
  }

  private rewriteNode(schema: core.$ZodType): core.$ZodType {
    const def = schema._zod.def as AnyDef;
    switch (def.type) {
      case "object":
        return this.rewriteObject(schema as core.$ZodObject);
      case "array":
        return this.cloneWith(schema, { element: this.rewrite(def.element as core.$ZodType) });
      case "optional":
      case "nullable":
      case "default":
      case "prefault":
      case "nonoptional":
      case "readonly":
      case "catch": {
        // Outside the chain, zod still lists its `default` (it drops one on a transforming node) and the field's
        // optionality is the chain's own; the step passes `undefined` and `null` through to it.
        const reader = this.findTextReader(schema);
        if (reader !== undefined) return withTextStep(reader, schema);
        return this.cloneWith(schema, { innerType: this.rewrite(def.innerType as core.$ZodType) });
      }
      case "union":
        return this.cloneWith(schema, { options: (def.options as core.$ZodType[]).map((option) => this.rewrite(option)) });
      case "intersection":
        return this.cloneWith(schema, { left: this.rewrite(def.left as core.$ZodType), right: this.rewrite(def.right as core.$ZodType) });
      case "record":
        return this.cloneWith(schema, { valueType: this.rewrite(def.valueType as core.$ZodType) });
      case "tuple":
        return this.cloneWith(schema, {
          items: (def.items as core.$ZodType[]).map((item) => this.rewrite(item)),
          rest: def.rest === null ? null : this.rewrite(def.rest as core.$ZodType),
        });
      case "pipe":
        return this.rewritePipe(schema, def);
      case "lazy": {
        const getter = def.getter as () => core.$ZodType;
        return this.cloneWith(schema, { getter: () => this.rewrite(getter()) });
      }
      case "boolean":
      case "number": {
        const reader = this.findTextReader(schema);
        return reader === undefined ? schema : withTextStep(reader, schema);
      }
      default:
        return schema;
    }
  }

  /** The text reader for a boolean or number, seen through its wrapper chain; none when text is not taken. */
  private findTextReader(schema: core.$ZodType): ((value: unknown) => unknown) | undefined {
    if (!this.settings.coerceTextScalars) return undefined;
    let def = schema._zod.def as AnyDef;
    while (WRAPPER_TYPES.has(def.type)) def = (def.innerType as core.$ZodType)._zod.def as AnyDef;
    if (def.coerce === true) return undefined;
    if (def.type === "boolean") return readBooleanText;
    if (def.type === "number") return readNumberText;
    return undefined;
  }

  /** Only the input side: `in`, or `out` after a preprocess (whose `in` is the transform). */
  private rewritePipe(schema: core.$ZodType, def: AnyDef): core.$ZodType {
    const input = def.in as core.$ZodType;
    if (input._zod.traits.has("$ZodTransform")) return this.cloneWith(schema, { out: this.rewrite(def.out as core.$ZodType) });
    return this.cloneWith(schema, { in: this.rewrite(input) });
  }

  private rewriteObject(schema: core.$ZodObject): core.$ZodType {
    const def = schema._zod.def;
    const shape = Object.fromEntries(Object.entries(def.shape).map(([name, field]) => [name, this.rewrite(field)]));
    // An object with its own catchall (`looseObject`, `.catchall(x)`) accepts extra fields on purpose.
    if (def.catchall !== undefined && def.catchall._zod.def.type !== "never") return this.cloneWith(schema, { shape });
    // The object's own map, read for any issue: its parameter type is narrowed to the issues an object raises.
    const ownError = def.error as core.$ZodErrorMap | undefined;
    const describe = (issue: core.$ZodRawIssue): string | undefined => describeUnknownFields(issue, Object.keys(shape), this.settings);
    const error: core.$ZodErrorMap = (issue) => describe(issue) ?? ownError?.(issue);
    return this.cloneWith(schema, { shape, catchall: z.never(), error });
  }

  /** A copy of the node with some parts replaced; its description and other metadata stay with it. */
  private cloneWith(schema: core.$ZodType, parts: Record<string, unknown>): core.$ZodType {
    const copy = (schema as unknown as z.ZodType).clone({ ...schema._zod.def, ...parts });
    const meta = z.globalRegistry.get(schema);
    if (meta !== undefined) {
      // An id names one schema in the JSON Schema output; the copy replaces the original, so it may not carry it twice.
      const rest = { ...meta };
      delete rest.id;
      z.globalRegistry.add(copy, rest);
    }
    return copy;
  }
}

/** The text for an object's unknown fields: renamed ones first, then the rest with the fields it accepts. */
function describeUnknownFields(issue: core.$ZodRawIssue, accepted: readonly string[], settings: RewriteSettings): string | undefined {
  if (issue.code !== "unrecognized_keys") return undefined;
  const { messages, renameField } = settings;
  const renamed: string[] = [];
  const unknown: string[] = [];
  for (const field of issue.keys) {
    const newName = renameField(field);
    if (newName !== undefined && accepted.includes(newName)) renamed.push(formatMessage(messages.fieldRenamed, { field, renamed: newName }));
    else unknown.push(field);
  }
  if (unknown.length > 0) {
    renamed.push(formatMessage(messages.unknownFields, { fields: quoteAll(unknown), accepted: accepted.length > 0 ? quoteAll(accepted) : messages.noFields }));
  }
  return renamed.join(" ");
}

function quoteAll(names: readonly string[]): string {
  return names.map((name) => JSON.stringify(name)).join(", ");
}

/**
 * `schema` behind a text step. zod gives every transform an optional input, so a step would make a required field
 * look optional in the listed JSON Schema inside `nullable` or a union; it takes the optionality of the schema it
 * wraps instead. That changes no parse: the step passes `undefined` on, and the schema refuses it as before.
 */
function withTextStep(reader: (value: unknown) => unknown, schema: core.$ZodType): core.$ZodType {
  const step = z.preprocess(reader, schema as z.ZodType);
  Object.defineProperty(step._zod, "optin", { value: schema._zod.optin, configurable: true, writable: true });
  return step;
}

function readBooleanText(value: unknown): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function readNumberText(value: unknown): unknown {
  return typeof value === "string" && NUMBER_TEXT.test(value) ? Number(value) : value;
}
