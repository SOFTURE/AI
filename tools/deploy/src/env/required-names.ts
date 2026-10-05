/**
 * The variables a production compose file cannot start without. Compose fails on `${NAME:?message}` when the
 * variable is unset or empty, and on `${NAME?message}` only when it is unset; `$$` is a literal dollar. Optional
 * forms (`${NAME}`, `${NAME:-default}`) are left to the compose file's own defaults.
 */
export interface RequiredName {
  name: string;
  /** `${NAME?…}` accepts an empty value; `${NAME:?…}` does not. */
  allowsEmpty: boolean;
}

// `$$` is matched first so an escaped dollar never starts a variable.
const REQUIRED_VARIABLE = /\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)(:?)\?/g;

/** Every required name in `composeText`, sorted, once each; when a name appears in both forms, the stricter wins. */
export function findRequiredNames(composeText: string): RequiredName[] {
  const byName = new Map<string, RequiredName>();
  for (const match of composeText.matchAll(REQUIRED_VARIABLE)) {
    const name = match[1];
    if (name === undefined) continue;
    const allowsEmpty = match[2] === "";
    const known = byName.get(name);
    byName.set(name, { name, allowsEmpty: (known?.allowsEmpty ?? true) && allowsEmpty });
  }
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name, "en"));
}
