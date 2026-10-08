// Agent Skills Discovery v0.2.0: an index at `/.well-known/agent-skills/index.json` and one `SKILL.md` per skill.
// The index carries the SHA-256 of each artifact's exact bytes, and clients check it, so both routes render the same
// text from the same function; a hand-kept digest would go stale with the first edited sentence.
import { createHash } from "node:crypto";
import type { AgentDocumentContext } from "./context.js";
import { skillPath } from "./paths.js";

/** The index schema (v0.2.0, "Versioning"). */
export const AGENT_SKILLS_SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";

/** The media type of a `SKILL.md` (the spec allows `text/markdown` or `text/plain`). */
export const SKILL_MD_CONTENT_TYPE = "text/markdown; charset=utf-8";

export interface AgentSkill {
  readonly name: string;
  readonly description: string;
  /** The whole `SKILL.md`: frontmatter and body, the bytes the digest covers. */
  readonly markdown: string;
}

export interface AgentSkillsIndex {
  readonly $schema: string;
  readonly skills: ReadonlyArray<{
    readonly name: string;
    readonly type: "skill-md";
    readonly description: string;
    readonly url: string;
    readonly digest: string;
  }>;
}

/** `sha256:<hex>` of the exact UTF-8 bytes: the index's `digest` format. */
export function digestOf(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

/** YAML frontmatter with `name` and a JSON-quoted `description`: colons and commas read the same in every parser. */
export function frontmatter(name: string, description: string): string {
  return `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n`;
}

/** A skill from its parts; the body starts after the frontmatter. */
export function createAgentSkill(name: string, description: string, body: string): AgentSkill {
  return { name, description, markdown: frontmatter(name, description) + body };
}

/** The app's own skills for the request's origins, in configuration order. */
export function renderAppSkills(context: AgentDocumentContext): AgentSkill[] {
  return context.options.skills.map((skill) => createAgentSkill(skill.name, skill.description, skill.body(context.origins)));
}

/**
 * The index. `url` is an absolute path: it resolves against the index's host (RFC 3986), so one index is right on the
 * apex, on the app host and locally.
 */
export function buildAgentSkillsIndex(skills: readonly AgentSkill[]): AgentSkillsIndex {
  return {
    $schema: AGENT_SKILLS_SCHEMA,
    skills: skills.map((skill) => ({
      name: skill.name,
      type: "skill-md",
      description: skill.description,
      url: skillPath(skill.name),
      digest: digestOf(skill.markdown),
    })),
  };
}

/** One skill by name, or undefined (the route answers 404). */
export function findAgentSkill(skills: readonly AgentSkill[], name: string): AgentSkill | undefined {
  return skills.find((skill) => skill.name === name);
}
