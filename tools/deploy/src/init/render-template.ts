/** What a template may read: text for `{{key}}`, a boolean for `{{#key}}…{{/key}}` and `{{^key}}…{{/key}}`. */
export type TemplateValues = Readonly<Record<string, string | boolean>>;

const SECTION_LINE = /^\s*\{\{([#^/])([a-zA-Z][a-zA-Z0-9]*)\}\}\s*$/;
const VALUE_TAG = /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g;

interface OpenSection {
  key: string;
  isShown: boolean;
  line: number;
}

function readFlag(values: TemplateValues, key: string, line: number): boolean {
  const value = values[key];
  if (typeof value !== "boolean") throw new Error(`template line ${line}: section "${key}" needs a boolean value`);
  return value;
}

function fillValues(text: string, values: TemplateValues, line: number): string {
  return text.replace(VALUE_TAG, (_tag, key: string) => {
    const value = values[key];
    if (typeof value !== "string") throw new Error(`template line ${line}: "{{${key}}}" has no text value`);
    return value;
  });
}

/**
 * Renders a template of the init files. A section tag stands alone on its line, and that line never reaches the
 * output; `{{#key}}` keeps the lines up to `{{/key}}` when the key is true, `{{^key}}` when it is false. Templates
 * ship with the package, so an unknown key or an unbalanced section is a bug and throws.
 */
export function renderTemplate(template: string, values: TemplateValues): string {
  const output: string[] = [];
  const open: OpenSection[] = [];
  const lines = template.split("\n");
  lines.forEach((text, index) => {
    const line = index + 1;
    const section = SECTION_LINE.exec(text);
    if (section) {
      const [, kind, key = ""] = section;
      if (kind === "/") {
        const last = open.pop();
        if (last?.key !== key) throw new Error(`template line ${line}: "{{/${key}}}" closes no open "${key}" section`);
        return;
      }
      const flag = readFlag(values, key, line);
      open.push({ key, isShown: kind === "#" ? flag : !flag, line });
      return;
    }
    if (open.every((candidate) => candidate.isShown)) output.push(fillValues(text, values, line));
  });
  const unclosed = open.at(-1);
  if (unclosed) throw new Error(`template line ${unclosed.line}: section "${unclosed.key}" is never closed`);
  return output.join("\n");
}
