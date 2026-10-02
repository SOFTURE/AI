import { posix } from "node:path";

export interface LinkTarget {
  target: string;
  line: number;
}

const FENCE = /^\s{0,3}(```|~~~)/;
const INLINE_LINK = /\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const REFERENCE_DEFINITION = /^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function removeCodeSpans(line: string): string {
  return line.replace(/(`+)[^`]*?\1/g, " ");
}

/** Link and image targets of a Markdown document, outside code spans and fenced blocks. */
export function listLinkTargets(text: string): LinkTarget[] {
  const targets: LinkTarget[] = [];
  let fence: string | null = null;
  text.split("\n").forEach((rawLine, index) => {
    const fenceMatch = FENCE.exec(rawLine);
    if (fenceMatch?.[1]) {
      if (fence === null) fence = fenceMatch[1];
      else if (fence === fenceMatch[1]) fence = null;
      return;
    }
    if (fence !== null) return;
    const line = removeCodeSpans(rawLine);
    for (const match of line.matchAll(INLINE_LINK)) {
      if (match[1]) targets.push({ target: match[1], line: index + 1 });
    }
    const reference = REFERENCE_DEFINITION.exec(line);
    if (reference?.[1]) targets.push({ target: reference[1], line: index + 1 });
  });
  return targets;
}

function isFileOrFolder(path: string, files: ReadonlySet<string>): boolean {
  if (files.has(path)) return true;
  const prefix = `${path.replace(/\/$/, "")}/`;
  for (const file of files) if (file.startsWith(prefix)) return true;
  return false;
}

/**
 * Relative links in `path` that do not resolve to a repository file or to a folder holding one.
 * External links (any URL scheme) and same-page anchors are skipped; anchors on file links are
 * not checked.
 * @param files repo-relative POSIX paths of every repository file
 */
export function findBrokenLinks(path: string, text: string, files: ReadonlySet<string>): string[] {
  return listLinkTargets(text).flatMap(({ target, line }) => {
    if (SCHEME.test(target) || target.startsWith("#") || target.startsWith("//")) return [];
    const withoutAnchor = target.split("#")[0]?.split("?")[0] ?? "";
    if (withoutAnchor === "") return [];
    let decoded: string;
    try {
      decoded = decodeURIComponent(withoutAnchor);
    } catch {
      // A stray `%` that is not an escape: the link cannot resolve as written.
      return [`${path}:${line}: link "${target}" is not a valid URL path`];
    }
    const resolved = decoded.startsWith("/")
      ? posix.normalize(decoded.slice(1))
      : posix.normalize(posix.join(posix.dirname(path), decoded));
    if (resolved === ".." || resolved.startsWith("../")) {
      return [`${path}:${line}: link "${target}" leaves the repository`];
    }
    return isFileOrFolder(resolved, files) ? [] : [`${path}:${line}: broken link "${target}"`];
  });
}
