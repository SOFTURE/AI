/**
 * The variables a production compose file reads. Compose fails on `${NAME:?message}` when the variable is unset or
 * empty, and on `${NAME?message}` only when it is unset; `$$` is a literal dollar. `${NAME:-default}` and
 * `${NAME-default}` are optional: the compose file has its own default, and `env render` writes them only when the
 * deploy environment sets them (FIRE_TRACKER's runtime switches). Bare `${NAME}` is left out: it also names what
 * the server script or the shell sets (`${TAG}`, `${HOME}`).
 */
export interface RequiredName {
  name: string;
  /** `${NAME?…}` accepts an empty value; `${NAME:?…}` does not. */
  allowsEmpty: boolean;
}

export interface ComposeNames {
  required: RequiredName[];
  /** Names used only in an optional form; a name required anywhere is required. */
  optional: string[];
}

// `$$` is matched first so an escaped dollar never starts a variable. Group 2 is `:` or empty, group 3 `?` or `-`.
const COMPOSE_VARIABLE = /\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)(:?)([?-])/g;

function byName(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

/** The required and optional names of `composeText`, each sorted and listed once. */
export function findComposeNames(composeText: string): ComposeNames {
  const required = new Map<string, RequiredName>();
  const optional = new Set<string>();
  for (const match of composeText.matchAll(COMPOSE_VARIABLE)) {
    const name = match[1];
    if (name === undefined) continue;
    if (match[3] === "-") {
      optional.add(name);
      continue;
    }
    const allowsEmpty = match[2] === "";
    const known = required.get(name);
    required.set(name, { name, allowsEmpty: (known?.allowsEmpty ?? true) && allowsEmpty });
  }
  return {
    required: [...required.values()].sort((left, right) => byName(left.name, right.name)),
    optional: [...optional].filter((name) => !required.has(name)).sort(byName),
  };
}

/** Every required name in `composeText`, sorted, once each; when a name appears in both forms, the stricter wins. */
export function findRequiredNames(composeText: string): RequiredName[] {
  return findComposeNames(composeText).required;
}
