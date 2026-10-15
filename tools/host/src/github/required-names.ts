/**
 * The names a compose file requires, `${NAME:?…}` and `${NAME?…}`: the rule `softure-deploy env render` renders
 * `.env.prod` by (`@softure-ai/deploy`'s `findRequiredNames`), so these are the secrets a release needs. `$$` is
 * matched first, so an escaped dollar never starts a variable.
 */
export function findRequiredNames(composeText: string): string[] {
  const names = new Set<string>();
  for (const match of composeText.matchAll(/\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*):?\?/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  return [...names].sort();
}
