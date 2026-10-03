/**
 * The site's colours for films, read from the app's stylesheet at every build rather than copied
 * by hand.
 *
 * A copy of the palette in the film would drift from the landing page at the first colour change
 * and nobody would notice, because a film has no visual tests. So the parser **refuses** instead of
 * guessing: a missing token, or a value that is not a colour literal (`color-mix(…)`), fails the
 * build with the token's name.
 *
 * It reads the **dark theme**: the top-level `[data-theme="dark"]` block, because the film lives in
 * the brand's world, not in the viewer's system theme. Roles point at the palette there through
 * `var(--…)`, so references resolve through that block and the first `:root` block. A stylesheet
 * without themes is read from `:root` alone. Overrides in `@media (prefers-contrast: more)` are for
 * the site visitor's browser, not for the film.
 */

export const SITE_COLOR_TOKENS = [
  "background",
  "surface",
  "surface-raised",
  "border",
  "foreground",
  "muted",
  "accessible",
  "locked",
  "debt",
  "accent",
] as const;

export type SiteColorToken = (typeof SITE_COLOR_TOKENS)[number];

export type SiteTokens = Record<SiteColorToken, string>;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function findTopLevelBlock(css: string, selectorStart: string): string | null {
  let depth = 0;
  let ruleStart = 0;
  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    if (char === "{") {
      if (depth === 0 && css.slice(ruleStart, i).trim().startsWith(selectorStart)) {
        let inner = 0;
        for (let j = i; j < css.length; j += 1) {
          if (css[j] === "{") inner += 1;
          if (css[j] === "}") inner -= 1;
          if (inner === 0) {
            return css.slice(i + 1, j);
          }
        }
        return null;
      }
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) ruleStart = i + 1;
      continue;
    }
    if (char === ";" && depth === 0) {
      ruleStart = i + 1;
    }
  }
  return null;
}

function readDeclaration(block: string, name: string): string | null {
  const match = new RegExp(`(?:^|[;{\\s])--${name}\\s*:\\s*([^;]+);`).exec(block);
  return match?.[1] === undefined ? null : match[1].trim();
}

export function readSiteTokens(css: string): SiteTokens {
  const clean = stripComments(css);
  const root = findTopLevelBlock(clean, ":root");
  if (root === null) {
    throw new Error("Site tokens: the stylesheet has no top-level :root block.");
  }
  const dark = findTopLevelBlock(clean, '[data-theme="dark"]');
  const blocks = dark === null ? [root] : [dark, root];
  const lookup = (name: string): string | null => {
    for (const block of blocks) {
      const value = readDeclaration(block, name);
      if (value !== null) return value;
    }
    return null;
  };
  const tokens = {} as SiteTokens;

  for (const name of SITE_COLOR_TOKENS) {
    let value = lookup(name);
    const seen = new Set<string>();
    while (value !== null) {
      const reference = /^var\(--([a-z0-9-]+)\)$/.exec(value)?.[1];
      if (reference === undefined || seen.has(reference)) break;
      seen.add(reference);
      value = lookup(reference);
    }
    if (value === null) {
      throw new Error(`Site tokens: no --${name} in :root.`);
    }
    if (!HEX_COLOR.test(value)) {
      throw new Error(`Site tokens: --${name} is "${value}", and the film needs a colour literal (#rrggbb).`);
    }
    tokens[name] = value.toLowerCase();
  }

  return tokens;
}
