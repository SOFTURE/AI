/** Counts of a JUnit XML report: Vitest (`--reporter=junit`) and Playwright (`junit` reporter) both write one. */
export interface JunitCounts {
  /** Test cases that ran and neither failed nor errored. */
  passed: number;
  /** Test cases that ran (skipped ones are left out). */
  total: number;
  /** `<classname> › <name>` of each failed or errored case, in report order. */
  red: string[];
}

const TEST_CASE = /<testcase\b((?:"[^"]*"|'[^']*'|[^'">])*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
const ATTRIBUTE = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z]+);/g, (whole, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return NAMED_ENTITIES[entity] ?? whole;
  });
}

function readAttributes(text: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of text.matchAll(ATTRIBUTE)) {
    attributes.set(match[1] ?? "", decodeEntities(match[2] ?? match[3] ?? ""));
  }
  return attributes;
}

/**
 * Reads the test cases of a JUnit report without a full XML parser: the format is flat enough (`<testcase>` elements
 * with an optional `<failure>`, `<error>` or `<skipped>` child) and the report is the app's own output.
 */
export function readJunitCounts(xml: string): JunitCounts {
  const counts: JunitCounts = { passed: 0, total: 0, red: [] };
  for (const match of xml.matchAll(TEST_CASE)) {
    const body = match[3] ?? "";
    if (/<skipped\b/.test(body)) continue;
    counts.total += 1;
    if (!/<(failure|error)\b/.test(body)) {
      counts.passed += 1;
      continue;
    }
    const attributes = readAttributes(match[1] ?? "");
    const name = attributes.get("name") ?? "";
    const className = attributes.get("classname") ?? "";
    counts.red.push(className === "" ? name : `${className} › ${name}`);
  }
  return counts;
}
