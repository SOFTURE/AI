// The campaign content file of `softure-mail campaign`: a frontmatter block and a plain-text body.
//
//   ---
//   id: 2026-10-launch
//   kind: newsletter
//   subject: Something new in Plan
//   html: launch.html
//   ---
//   Hello,
//   ...
//
// `html` is optional and names a file next to the content file, rendered however the operator
// likes. There is no markdown: the text body is sent as written.
import type { SoftureConfig } from "@softure-ai/core";
import { isMailKind, MAX_SUBJECT_LENGTH } from "../address.js";
import { TRANSACTIONAL_KIND } from "../contract.js";
import type { MailingMessages } from "../messages/index.js";
import { getMailingModule, getMailingRoutes } from "./options.js";
import { RECIPIENT_PARAM, SIGNATURE_PARAM } from "./unsubscribe-link.js";

/** A campaign's content, as `sendCampaign` sends it. */
export interface CampaignContent {
  /** Kebab-case, at most 64 characters, e.g. `2026-10-launch`. Never reuse an id for other content. */
  readonly id: string;
  /** The list it belongs to, e.g. `newsletter`; never `transactional`. */
  readonly kind: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string | null;
}

/** A parsed content file: the HTML body is still a path relative to the file. */
export interface CampaignFile extends Omit<CampaignContent, "html"> {
  readonly htmlPath: string | null;
}

export type CampaignFileResult = { readonly ok: true; readonly value: CampaignFile } | { readonly ok: false; readonly problems: readonly string[] };

const FENCE = "---";
const KEYS = new Set(["id", "kind", "subject", "html"]);
const CAMPAIGN_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CAMPAIGN_ID_LENGTH = 64;

/** Parses a content file, listing every problem at once. */
export function parseCampaignFile(source: string): CampaignFileResult {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== FENCE) return { ok: false, problems: ["the file must start with a --- line opening the frontmatter"] };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
  if (end === -1) return { ok: false, problems: ["the frontmatter has no closing --- line"] };

  const problems: string[] = [];
  const fields = new Map<string, string>();
  lines.slice(1, end).forEach((line, index) => {
    if (line.trim() === "" || line.trimStart().startsWith("#")) return;
    const match = /^([a-z]+):(.*)$/.exec(line);
    const key = match?.[1];
    const value = match?.[2]?.trim();
    if (key === undefined || value === undefined) {
      problems.push(`frontmatter line ${String(index + 2)} must read "key: value"`);
    } else if (!KEYS.has(key)) {
      problems.push(`unknown frontmatter key "${key}"; use ${[...KEYS].join(", ")}`);
    } else if (fields.has(key)) {
      problems.push(`frontmatter key "${key}" appears twice`);
    } else {
      fields.set(key, value);
    }
  });

  const text = lines.slice(end + 1).join("\n").trim();
  const file: CampaignFile = {
    id: fields.get("id") ?? "",
    kind: fields.get("kind") ?? "",
    subject: fields.get("subject") ?? "",
    text,
    htmlPath: fields.get("html") ?? null,
  };
  problems.push(...getCampaignProblems({ ...file, html: null }));
  if (file.htmlPath === "") problems.push("html: give a file name or leave the key out");
  return problems.length === 0 ? { ok: true, value: file } : { ok: false, problems };
}

/**
 * What makes `content` unsendable as a campaign; empty when it is fine. With the app's config it also refuses a
 * body that carries an unsubscribe link or footer pasted from a sent mail: the module adds its own to every mail,
 * and a pasted link is a credential that would let every recipient unsubscribe the person it was signed for.
 */
export function getCampaignProblems(content: CampaignContent, config?: SoftureConfig): string[] {
  const problems: string[] = [];
  if (content.id.length > MAX_CAMPAIGN_ID_LENGTH || !CAMPAIGN_ID.test(content.id)) {
    problems.push("id: kebab-case, at most 64 characters, e.g. 2026-10-launch");
  }
  if (!isMailKind(content.kind) || content.kind === TRANSACTIONAL_KIND) {
    problems.push("kind: a kebab-case list name such as newsletter; campaigns are never transactional");
  }
  if (content.subject.trim() === "" || content.subject.length > MAX_SUBJECT_LENGTH || /[\r\n]/.test(content.subject)) {
    problems.push(`subject: one line, 1 to ${String(MAX_SUBJECT_LENGTH)} characters`);
  }
  if (content.text.trim() === "") problems.push("the text body under the frontmatter is empty");
  if (content.html?.trim() === "") problems.push("the HTML body is empty");
  if (config !== undefined) problems.push(...getPastedFooterProblems(content, config));
  return problems;
}

/** A signed pair of link parameters, raw or HTML-escaped (`&amp;`). */
const SIGNED_LINK = new RegExp(`[?&](?:amp;)?${RECIPIENT_PARAM}=[A-Za-z0-9_-]{43}&(?:amp;)?${SIGNATURE_PARAM}=`);

function getPastedFooterProblems(content: CampaignContent, config: SoftureConfig): string[] {
  const routes = getMailingRoutes(config);
  // The app's own links only: a link to another site's unsubscribe page is the author's business.
  const linkMarkers = [`${config.appOrigin}${routes.unsubscribe}?`, `${config.appOrigin}${routes.oneClick}?`];
  // Every locale's footer copy, the app's overrides included: a mail pasted from another locale counts too.
  const footers = Object.values(getMailingModule(config).messages).map((messages) => (messages as MailingMessages).footer);
  const bodies: [string, string | null][] = [
    ["the text body", content.text],
    ["the HTML body", content.html],
  ];
  const problems: string[] = [];
  for (const [name, body] of bodies) {
    if (body === null) continue;
    if (SIGNED_LINK.test(body) || linkMarkers.some((marker) => body.includes(marker))) {
      problems.push(`${name} carries an unsubscribe link; the module adds a link signed for each recipient, remove the pasted one`);
    } else if (footers.some((footer) => body.includes(footer.text) || body.includes(`${footer.htmlLead} <a `))) {
      problems.push(`${name} carries the unsubscribe footer; the module adds it to every mail, remove the pasted one`);
    }
  }
  return problems;
}

/** The addresses of a recipients file: one per line; blank lines and `#` comments are skipped. */
export function parseRecipientList(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}
