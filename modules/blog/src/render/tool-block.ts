// Tool blocks (GitHub issues 413, 509): an interactive tool in an article, written as a leaf directive
// (`::calculator{rate="5"}`, or `::tool{type="calculator" rate="5"}` for several tools behind one directive). The
// definitions build a directive block plugin from the app's schema and static renderer. The plugin returns data, a
// `BlogToolNode` with the parsed props and the static HTML, so the config that registers it imports no React; the
// page renders the node with the app's client islands (`renderToolNode`, `@softure-ai/blog/ui`). The Markdown answer
// carries the static version; the quality gate refuses attributes the schema does not accept. The static HTML is
// the app's own trusted output, as with every block plugin: escape what goes into it.
import type { ArticleBlock, BlockAttributes, BlockOutput, BlockPlugin } from "./render-article.js";

/** One problem of a schema check, as zod reports it. */
export interface ToolBlockIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** The part of a zod schema a tool block uses; typed structurally, so the app's own zod copy fits. */
export interface ToolBlockSchema<TProps> {
  safeParse(input: unknown):
    | { readonly success: true; readonly data: TProps }
    | { readonly success: false; readonly error: { readonly issues: readonly ToolBlockIssue[] } };
}

/**
 * How the island meets the static HTML once the page is hydrated: `replace` swaps the static HTML for the island;
 * `append` keeps it and mounts the island in an element right after it (empty on the server).
 */
export type ToolBlockMode = "replace" | "append";

export const TOOL_BLOCK_MODES = ["replace", "append"] as const satisfies readonly ToolBlockMode[];

/** One tool: how its attributes are read and what it shows without JavaScript. */
export interface ToolDefinition<TProps extends object> {
  /**
   * Reads the directive's attributes (all strings: use `z.coerce` for numbers) into the island's props. The props
   * travel to the browser, so they must be serializable (strings, numbers, booleans, arrays, plain objects).
   */
  readonly schema: ToolBlockSchema<TProps>;
  /** The tool without JavaScript: HTML for bots, readers without scripts and the Markdown answer. */
  readonly renderStatic: (props: TProps, block: ArticleBlock) => string;
  /** Default: `replace`. */
  readonly mode?: ToolBlockMode;
  /** The tool as Markdown for agents; the static HTML by default. */
  readonly markdown?: (props: TProps, block: ArticleBlock) => string;
  /** The numbers the tool shows, for the quality gate's `block-numbers`. */
  readonly numbers?: (props: TProps, block: ArticleBlock) => readonly (number | string)[];
}

/** What a tool block plugin's page node holds: plain data, rendered by `renderToolNode` (`/ui`). */
export interface BlogToolNode {
  readonly kind: "blog-tool";
  /** The directive's name (`calculator`, or `tool` for a shared directive), set as `data-blog-tool`. */
  readonly directive: string;
  /** The tool's name: the key of the app's island. The directive's name for `defineToolBlock`. */
  readonly tool: string;
  /** The parsed props, passed to the island. */
  readonly props: object;
  /** The static HTML (the app's trusted output of `renderStatic`). */
  readonly html: string;
  readonly mode: ToolBlockMode;
  /** The mount point's class. */
  readonly className: string;
}

interface ToolBlockCommon {
  /** The directive's name, lower-case kebab-case: `calculator` for `::calculator{…}`. */
  readonly name: string;
  /** The frontmatter keys the tool reads, for the quality gate (`block-requires`). */
  readonly requires?: readonly string[];
  /**
   * The page's HTML for attributes the schema refuses (the gate refuses them before a publish, so a reader
   * meets this only on an unchecked text). Nothing by default.
   */
  readonly renderInvalid?: (block: ArticleBlock) => string;
  /** The mount point's class. Default: `blog-tool`. */
  readonly className?: string;
}

/** One tool behind its own directive: `::calculator{rate="5"}`. */
export interface ToolBlockDefinition<TProps extends object> extends ToolDefinition<TProps>, ToolBlockCommon {}

/** Several tools behind one directive: `::tool{type="calculator" rate="5"}`; `type` picks the tool. */
export interface ToolBlocksDefinition<TTools extends Readonly<Record<string, object>>> extends ToolBlockCommon {
  /** The tools by their `type` value; the other attributes go to that tool's schema. */
  readonly tools: { readonly [TType in keyof TTools]: ToolDefinition<TTools[TType]> };
}

/** The attribute that picks the tool of a shared directive. */
export const TOOL_TYPE_ATTRIBUTE = "type";

const DIRECTIVE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const DEFAULT_CLASS = "blog-tool";

/** Whether a node segment is a tool block's node. */
export function isBlogToolNode(value: unknown): value is BlogToolNode {
  return typeof value === "object" && value !== null && (value as { readonly kind?: unknown }).kind === "blog-tool";
}

type ParsedTool =
  | { readonly ok: true; readonly tool: string; readonly definition: ToolDefinition<object>; readonly props: object }
  | { readonly ok: false; readonly problem: string };

/** Picks the tool of a block and reads its attributes. */
type ToolResolver = (block: ArticleBlock) => ParsedTool;

function describeIssue(issue: ToolBlockIssue): string {
  const path = issue.path.map(String).join(".");
  return path === "" ? issue.message : `${path}: ${issue.message}`;
}

function parseTool(tool: string, definition: ToolDefinition<object>, attributes: BlockAttributes): ParsedTool {
  const result = definition.schema.safeParse(attributes);
  return result.success
    ? { ok: true, tool, definition, props: result.data }
    : { ok: false, problem: result.error.issues.map(describeIssue).join("; ") };
}

function assertDirectiveName(name: string): void {
  if (!DIRECTIVE_NAME.test(name)) {
    throw new Error(`Tool block name "${name}" must be lower-case kebab-case, e.g. "calculator".`);
  }
}

function buildPlugin(common: ToolBlockCommon, tools: readonly ToolDefinition<object>[], resolve: ToolResolver): BlockPlugin<BlogToolNode> {
  const hasNumbers = tools.some((tool) => tool.numbers !== undefined);
  const { name, renderInvalid } = common;
  const className = common.className ?? DEFAULT_CLASS;
  return {
    type: name,
    syntax: "directive",
    requires: common.requires ?? [],
    render: (block): BlockOutput<BlogToolNode> => {
      const parsed = resolve(block);
      if (!parsed.ok) return { kind: "html", html: renderInvalid?.(block) ?? "" };
      const { tool, definition, props } = parsed;
      return {
        kind: "node",
        node: { kind: "blog-tool", directive: name, tool, props, html: definition.renderStatic(props, block), mode: definition.mode ?? "replace", className },
      };
    },
    markdown: (block) => {
      const parsed = resolve(block);
      if (!parsed.ok) return block.content;
      const toMarkdown = parsed.definition.markdown ?? parsed.definition.renderStatic;
      return toMarkdown(parsed.props, block);
    },
    validate: (block) => {
      const parsed = resolve(block);
      return parsed.ok ? null : parsed.problem;
    },
    ...(hasNumbers
      ? {
          // `null` (no check) for a tool without `numbers` on a shared directive, and for attributes the gate
          // already refuses as `block-directive`.
          numbers: (block: ArticleBlock) => {
            const parsed = resolve(block);
            return parsed.ok ? (parsed.definition.numbers?.(parsed.props, block) ?? null) : null;
          },
        }
      : {}),
  };
}

/** A directive block plugin for one tool; its page node is a `BlogToolNode` whose `tool` is the directive's name. */
export function defineToolBlock<TProps extends object>(definition: ToolBlockDefinition<TProps>): BlockPlugin<BlogToolNode> {
  assertDirectiveName(definition.name);
  // A tool's props are its own type only on the config side; the plugin carries them as plain objects.
  const tool = definition as unknown as ToolDefinition<object>;
  return buildPlugin(definition, [tool], (block) =>
    block.attributes === null ? { ok: false, problem: "the attributes cannot be read" } : parseTool(definition.name, tool, block.attributes),
  );
}

/**
 * A directive block plugin for several tools behind one directive: `type` picks the tool and the other attributes go
 * to its schema. `requires` is the directive's: the keys every tool on it reads.
 */
export function defineToolBlocks<TTools extends Readonly<Record<string, object>>>(definition: ToolBlocksDefinition<TTools>): BlockPlugin<BlogToolNode> {
  assertDirectiveName(definition.name);
  // Each tool's props are its own type only on the config side; the plugin carries them as plain objects.
  const tools = new Map(Object.entries(definition.tools as unknown as Readonly<Record<string, ToolDefinition<object>>>));
  if (tools.size === 0) throw new Error(`Tool block "${definition.name}" needs at least one tool.`);
  const typeList = [...tools.keys()].join(", ");
  return buildPlugin(definition, [...tools.values()], (block) => {
    if (block.attributes === null) return { ok: false, problem: "the attributes cannot be read" };
    const { [TOOL_TYPE_ATTRIBUTE]: type, ...rest } = block.attributes;
    const tool = type === undefined ? undefined : tools.get(type);
    if (type === undefined || tool === undefined) return { ok: false, problem: `${TOOL_TYPE_ATTRIBUTE} must be one of: ${typeList}` };
    return parseTool(type, tool, rest);
  });
}
