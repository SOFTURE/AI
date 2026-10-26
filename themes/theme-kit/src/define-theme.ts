import { checkTheme } from "./check-theme.js";
import type { ThemeDefinition } from "./theme-definition.js";

/**
 * Declares a theme: checks it against the contract (`checkTheme`) and returns it unchanged, with its literal types, so
 * a broken theme fails where it is written, at import time, not when its CSS is generated. Throws with every problem
 * listed.
 */
export function defineTheme<const T extends ThemeDefinition>(definition: T): T {
  const problems = checkTheme(definition);
  if (problems.length > 0) {
    throw new Error(`defineTheme: theme "${definition.name}" breaks the theme contract:\n- ${problems.join("\n- ")}`);
  }
  return definition;
}
