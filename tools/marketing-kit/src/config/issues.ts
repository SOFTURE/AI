/** A problem in `marketing.json`, at the JSON path of the key to fix. */
export interface ConfigIssue {
  path: readonly PropertyKey[];
  message: string;
}

/** `["videos", 0, "beats", 2, "id"]` → `videos[0].beats[2].id`; the root is `(root)`. */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  let text = "";
  for (const key of path) {
    if (typeof key === "number") text += `[${key}]`;
    else text += text.length === 0 ? String(key) : `.${String(key)}`;
  }
  return text.length === 0 ? "(root)" : text;
}

export function formatIssues(file: string, issues: readonly ConfigIssue[]): string {
  const lines = issues.map((issue) => `  ${formatIssuePath(issue.path)}: ${issue.message}`);
  return `${file} is not a valid marketing config:\n${lines.join("\n")}`;
}
