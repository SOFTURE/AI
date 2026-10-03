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

/** The part of a zod issue `expandUnionIssues` reads; zod's own issues fit it. */
export interface SchemaIssue {
  readonly code: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
  readonly errors?: readonly (readonly SchemaIssue[])[];
}

/** A branch whose only problem is that the input has another type (a string where an object goes). */
function isTypeMismatch(branch: readonly SchemaIssue[]): boolean {
  return branch.length > 0 && branch.every((issue) => issue.code === "invalid_type" && issue.path.length === 0);
}

/**
 * zod reports a value that fits no branch of a union as "Invalid input" at the union. When every
 * branch but one failed only on the input's type, that branch is the one the author meant: its issues
 * replace the union's, with full paths, so the error names the key to fix.
 */
export function expandUnionIssues(issues: readonly SchemaIssue[]): ConfigIssue[] {
  return issues.flatMap((issue): ConfigIssue[] => {
    if (issue.code === "invalid_union" && issue.errors !== undefined) {
      const meant = issue.errors.filter((branch) => !isTypeMismatch(branch));
      if (meant.length === 1 && meant[0] !== undefined) {
        return expandUnionIssues(meant[0].map((inner) => ({ ...inner, path: [...issue.path, ...inner.path] })));
      }
    }
    return [{ path: issue.path, message: issue.message }];
  });
}
