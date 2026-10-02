// A configuration that cannot work: an invalid module manifest, invalid module options or an
// invalid app config. It is thrown at startup (docs/02-module-standard.md §7), because the app
// cannot run with it; every issue is listed at once so one restart shows all of them.

export class SoftureConfigError extends Error {
  override readonly name = "SoftureConfigError";

  /** One line per problem: `<path>: <what is wrong>`. */
  readonly issues: readonly string[];

  constructor(subject: string, issues: readonly string[]) {
    super(`Invalid SOFTURE configuration in ${subject}:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.issues = issues;
  }
}

/** Formats zod issues as `<path>: <message>` lines, with an optional path prefix. */
export function formatIssues(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
  prefix?: string,
): string[] {
  return issues.map((issue) => {
    const path = [prefix, ...issue.path.map(String)].filter((part) => part !== undefined && part !== "").join(".");
    return path === "" ? issue.message : `${path}: ${issue.message}`;
  });
}
