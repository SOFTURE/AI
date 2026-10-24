import { isColorAlias, type ThemeDefinition } from "./theme-definition.js";

const TOKEN_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UNSAFE_VALUE = /[;{}<>\r\n]/;

/** Light by default, and for an element or a page that asks for it. */
const LIGHT_SELECTOR = ':root, .light, [data-theme="light"]';
/** Dark by the system setting, unless the page asks for light. */
const SYSTEM_DARK_SELECTOR = ':root:not(.light, [data-theme="light"])';
/** Dark by choice: `next-themes` (`class="dark"`) or `@softure-ai/ui`'s theme switch (`data-theme="dark"`). */
const DARK_SELECTOR = '.dark, [data-theme="dark"]';

/**
 * Tailwind's `dark:` variant on the same rule as the tokens: the system setting unless the page asks for light, or an
 * explicit dark scope. Without it, `dark:` would follow only the system setting.
 */
const DARK_VARIANT = `@custom-variant dark {
  @media (prefers-color-scheme: dark) {
    &:where(${SYSTEM_DARK_SELECTOR}, ${SYSTEM_DARK_SELECTOR} *) {
      @slot;
    }
  }
  &:where(.dark, .dark *, [data-theme="dark"], [data-theme="dark"] *) {
    @slot;
  }
}`;

function checkName(kind: string, name: string): string {
  if (!TOKEN_NAME.test(name)) throw new Error(`buildThemeCss: ${kind} name "${name}" is not a lowercase kebab-case name`);
  return name;
}

function checkValue(name: string, value: string): string {
  if (value.trim() === "" || UNSAFE_VALUE.test(value)) {
    throw new Error(`buildThemeCss: value of "${name}" is empty or holds one of ; { } < > or a line break`);
  }
  return value;
}

function writeBlock(selector: string, lines: string[], indent = ""): string {
  return [`${indent}${selector} {`, ...lines.map((line) => `${indent}  ${line}`), `${indent}}`].join("\n");
}

function writeSchemeLines(definition: ThemeDefinition, scheme: "light" | "dark"): string[] {
  const colors = Object.entries(definition.colors).flatMap(([name, value]) => {
    checkName("colour", name);
    if (isColorAlias(value)) {
      if (!(value.alias in definition.colors)) {
        throw new Error(`buildThemeCss: colour "${name}" follows "${value.alias}", which the theme does not define`);
      }
      // An alias is a reference, so it follows its target's scheme without a dark line of its own.
      return scheme === "light" ? [`--${name}: var(--${checkName("colour", value.alias)});`] : [];
    }
    return [`--${name}: ${checkValue(name, value[scheme])};`];
  });
  const shadows = Object.entries(definition.shadows).map(
    ([name, value]) => `--shadow-${checkName("shadow", name)}: ${checkValue(`shadow-${name}`, value[scheme])};`,
  );
  return [...colors, ...shadows];
}

function writeThemeLines(definition: ThemeDefinition): string[] {
  const lines: string[] = [];
  if (definition.clearDefaultPalette) lines.push("--color-*: initial;");
  for (const name of Object.keys(definition.colors)) lines.push(`--color-${name}: var(--${name});`);
  for (const [family, stack] of Object.entries(definition.fonts)) {
    lines.push(`--font-${checkName("font", family)}: ${checkValue(`font-${family}`, stack)};`);
  }
  for (const [name, style] of Object.entries(definition.textStyles)) {
    const prefix = `--text-${checkName("text style", name)}`;
    lines.push(`${prefix}: ${checkValue(prefix, style.fontSize)};`);
    lines.push(`${prefix}--line-height: ${checkValue(prefix, style.lineHeight)};`);
    lines.push(`${prefix}--font-weight: ${String(style.fontWeight)};`);
    if (style.letterSpacing !== undefined) lines.push(`${prefix}--letter-spacing: ${checkValue(prefix, style.letterSpacing)};`);
  }
  for (const [step, value] of Object.entries(definition.radii)) {
    lines.push(`--radius-${checkName("radius", step)}: ${checkValue(`radius-${step}`, value)};`);
  }
  // A themed shadow: the utility reads the scheme blocks' value, which the dark blocks switch.
  for (const name of Object.keys(definition.shadows)) lines.push(`--shadow-${name}: var(--shadow-${name});`);
  for (const [name, value] of Object.entries(definition.sizes)) {
    lines.push(`--spacing-${checkName("size", name)}: ${checkValue(`spacing-${name}`, value)};`);
  }
  return lines;
}

/**
 * The theme's CSS for Tailwind CSS v4: the tokens per scheme and the `@theme inline` block that turns them into
 * utilities (`bg-background`, `text-page-title`, `rounded-xl`, `shadow-menu`, `w-sidebar-width`).
 *
 * Schemes: light on `:root` (and on `.light`, `[data-theme="light"]`); dark by the system setting unless the page asks
 * for light, and on `.dark`, `[data-theme="dark"]`, so `next-themes` and `@softure-ai/ui`'s theme switch both work,
 * and a section can take a fixed scheme; Tailwind's `dark:` variant follows the same rule. Throws on a name that is not kebab-case, an unsafe value, or an alias of an
 * undefined colour.
 */
export function buildThemeCss(definition: ThemeDefinition): string {
  const light = writeSchemeLines(definition, "light");
  const dark = writeSchemeLines(definition, "dark");
  return [
    `/* Theme "${definition.name.replace(/\*\//g, "")}", generated by @softure-ai/theme-kit (buildThemeCss). */`,
    DARK_VARIANT,
    writeBlock(LIGHT_SELECTOR, light),
    `@media (prefers-color-scheme: dark) {\n${writeBlock(SYSTEM_DARK_SELECTOR, dark, "  ")}\n}`,
    writeBlock(DARK_SELECTOR, dark),
    writeBlock("@theme inline", writeThemeLines(definition)),
    "",
  ].join("\n\n");
}
