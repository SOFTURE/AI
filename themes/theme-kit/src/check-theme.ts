import { findMissingColorRoles, isColorAlias, type ThemeDefinition } from "./theme-definition.js";

/** A token name: lowercase kebab-case (`primary-hover`, `chart-1`). */
export const TOKEN_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Characters that would end a CSS declaration or block, or open markup. */
export const UNSAFE_VALUE = /[;{}<>\r\n]/;

function findNameProblems(kind: string, names: readonly string[]): string[] {
  return names.filter((name) => !TOKEN_NAME.test(name)).map((name) => `${kind} name "${name}" is not a lowercase kebab-case name`);
}

function findValueProblems(entries: readonly (readonly [string, string])[]): string[] {
  return entries
    .filter(([, value]) => value.trim() === "" || UNSAFE_VALUE.test(value))
    .map(([name]) => `value of "${name}" is empty or holds one of ; { } < > or a line break`);
}

function listValues(definition: ThemeDefinition): (readonly [string, string])[] {
  const colors = Object.entries(definition.colors).flatMap(([name, value]) =>
    isColorAlias(value) ? [] : [[name, value.light] as const, [name, value.dark] as const],
  );
  const shadows = Object.entries(definition.shadows).flatMap(([name, value]) => [
    [`shadow-${name}`, value.light] as const,
    [`shadow-${name}`, value.dark] as const,
  ]);
  const fonts = Object.entries(definition.fonts).map(([family, stack]) => [`font-${family}`, stack] as const);
  const textStyles = Object.entries(definition.textStyles).flatMap(([name, style]) =>
    [style.fontSize, style.lineHeight, ...(style.letterSpacing === undefined ? [] : [style.letterSpacing])].map(
      (value) => [`text-${name}`, value] as const,
    ),
  );
  const radii = Object.entries(definition.radii).map(([step, value]) => [`radius-${step}`, value] as const);
  const sizes = Object.entries(definition.sizes).map(([name, value]) => [`spacing-${name}`, value] as const);
  return [...colors, ...shadows, ...fonts, ...textStyles, ...radii, ...sizes];
}

/**
 * Every way a definition breaks the theme contract, as readable messages; empty when the theme is complete. Checks the
 * shadcn colour roles, that every token name is kebab-case, that no value is empty or could break out of the CSS, and
 * that every alias points at a colour of the same theme.
 */
export function checkTheme(definition: ThemeDefinition): string[] {
  const problems: string[] = [];
  if (definition.name.trim() === "") problems.push("the theme has no name");
  const missing = findMissingColorRoles(definition);
  if (missing.length > 0) problems.push(`missing shadcn colour roles: ${missing.join(", ")}`);
  problems.push(
    ...findNameProblems("colour", Object.keys(definition.colors)),
    ...findNameProblems("shadow", Object.keys(definition.shadows)),
    ...findNameProblems("font", Object.keys(definition.fonts)),
    ...findNameProblems("text style", Object.keys(definition.textStyles)),
    ...findNameProblems("radius", Object.keys(definition.radii)),
    ...findNameProblems("size", Object.keys(definition.sizes)),
    ...findValueProblems(listValues(definition)),
  );
  for (const [name, value] of Object.entries(definition.colors)) {
    if (isColorAlias(value) && !(value.alias in definition.colors)) {
      problems.push(`colour "${name}" follows "${value.alias}", which the theme does not define`);
    }
  }
  return problems;
}
