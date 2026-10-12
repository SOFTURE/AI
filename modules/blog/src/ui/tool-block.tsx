// Tool blocks (GitHub issue 413): an interactive tool in an article, written as a leaf directive
// (`::calculator{rate="5"}`). `defineToolBlock` turns the app's schema, static renderer and client component into
// a directive block plugin: the page's server HTML holds the static version inside a mount point and the browser
// swaps in the island with the parsed props; the Markdown answer carries the static version; the quality gate
// refuses attributes the schema does not accept. The static HTML is the app's own trusted output, as with every
// block plugin: escape what goes into it.
import type { ComponentType, ReactNode } from "react";
import type { ArticleBlock, BlockOutput, BlockPlugin } from "../render/render-article.js";
import { BlogToolIsland } from "./tool-island.js";

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

export interface ToolBlockDefinition<TProps extends object> {
  /** The directive's name, lower-case kebab-case: `calculator` for `::calculator{…}`. */
  readonly name: string;
  /**
   * Reads the directive's attributes (all strings: use `z.coerce` for numbers) into the island's props. The props
   * travel to the browser, so they must be serializable (strings, numbers, booleans, arrays, plain objects).
   */
  readonly schema: ToolBlockSchema<TProps>;
  /** The tool without JavaScript: HTML for bots, readers without scripts and the Markdown answer. */
  readonly renderStatic: (props: TProps, block: ArticleBlock) => string;
  /** The client component (a `"use client"` module) mounted in place of the static HTML. */
  readonly Island: ComponentType<TProps>;
  /** The frontmatter keys the tool reads, for the quality gate (`block-requires`). */
  readonly requires?: readonly string[];
  /** The tool as Markdown for agents; the static HTML by default. */
  readonly markdown?: (props: TProps, block: ArticleBlock) => string;
  /** The numbers the tool shows, for the quality gate's `block-numbers`. */
  readonly numbers?: (props: TProps, block: ArticleBlock) => readonly (number | string)[];
  /**
   * The page's HTML for attributes the schema refuses (the gate refuses them before a publish, so a reader
   * meets this only on an unchecked text). Nothing by default.
   */
  readonly renderInvalid?: (block: ArticleBlock) => string;
  /** The mount point's class. Default: `blog-tool`. */
  readonly className?: string;
}

const DIRECTIVE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const DEFAULT_CLASS = "blog-tool";

type ParsedProps<TProps> = { readonly ok: true; readonly props: TProps } | { readonly ok: false; readonly problem: string };

function describeIssue(issue: ToolBlockIssue): string {
  const path = issue.path.map(String).join(".");
  return path === "" ? issue.message : `${path}: ${issue.message}`;
}

function parseProps<TProps>(schema: ToolBlockSchema<TProps>, block: ArticleBlock): ParsedProps<TProps> {
  if (block.attributes === null) return { ok: false, problem: "the attributes cannot be read" };
  const result = schema.safeParse(block.attributes);
  return result.success ? { ok: true, props: result.data } : { ok: false, problem: result.error.issues.map(describeIssue).join("; ") };
}

export function defineToolBlock<TProps extends object>(definition: ToolBlockDefinition<TProps>): BlockPlugin<ReactNode> {
  const { name, schema, renderStatic, Island } = definition;
  if (!DIRECTIVE_NAME.test(name)) {
    throw new Error(`Tool block name "${name}" must be lower-case kebab-case, e.g. "calculator".`);
  }
  const className = definition.className ?? DEFAULT_CLASS;
  const toMarkdown = definition.markdown ?? renderStatic;
  const { numbers, renderInvalid } = definition;
  return {
    type: name,
    syntax: "directive",
    requires: definition.requires ?? [],
    render: (block): BlockOutput<ReactNode> => {
      const parsed = parseProps(schema, block);
      if (!parsed.ok) return { kind: "html", html: renderInvalid?.(block) ?? "" };
      return {
        kind: "node",
        node: (
          <BlogToolIsland name={name} className={className} html={renderStatic(parsed.props, block)}>
            <Island {...parsed.props} />
          </BlogToolIsland>
        ),
      };
    },
    markdown: (block) => {
      const parsed = parseProps(schema, block);
      return parsed.ok ? toMarkdown(parsed.props, block) : block.content;
    },
    validate: (block) => {
      const parsed = parseProps(schema, block);
      return parsed.ok ? null : parsed.problem;
    },
    ...(numbers === undefined
      ? {}
      : {
          numbers: (block: ArticleBlock) => {
            const parsed = parseProps(schema, block);
            return parsed.ok ? numbers(parsed.props, block) : [];
          },
        }),
  };
}
