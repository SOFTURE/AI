import { isColorAlias, type ThemeDefinition } from "./theme-definition.js";

export type ColorScheme = "light" | "dark";

/**
 * A colour's value in one scheme, following aliases (`primary` → `accent-fill`), for code that draws outside the page
 * and cannot read the CSS variables (an app icon, an email). Throws on a colour the theme does not define or an alias
 * cycle: a theme declared with `defineTheme` has neither.
 */
export function getThemeColor(theme: Pick<ThemeDefinition, "name" | "colors">, name: string, scheme: ColorScheme = "light"): string {
  const path = [name];
  let value = theme.colors[name];
  while (value !== undefined && isColorAlias(value)) {
    if (path.includes(value.alias)) {
      throw new Error(`getThemeColor: colour "${name}" follows a cycle: ${[...path, value.alias].join(" → ")}`);
    }
    path.push(value.alias);
    value = theme.colors[value.alias];
  }
  if (value === undefined) {
    throw new Error(`getThemeColor: theme "${theme.name}" has no colour "${path.at(-1) ?? name}"`);
  }
  return value[scheme];
}
