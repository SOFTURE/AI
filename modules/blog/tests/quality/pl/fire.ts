// FIRE_TRACKER's settings and domain rules, written against the plugin API: the baseline of BL-6.
// FIRE keeps its real rules (`rules-facts.ts` over its engine's tables, `rules-chart.ts` over its
// chart engine); these stand-ins hold the 2025 and 2026 values its fixtures use.
import { qualityOptionsSchema, resolveQualitySettings, toProse, splitSentences, findSignificantNumbers, normalizeNumber, parseNumber, type Block, type QualityFinding, type QualityOptionsInput, type QualityPlugin, type QualitySettings } from "@softure-ai/blog/server";

const L = "\\p{L}*";
const GAP = "(?:[^.!?\\d]|\\b20\\d\\d\\b){0,60}?";
const AMOUNT = "(\\d{1,3}(?:[\\u00a0\\u202f ]\\d{3})+(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?)\\s?(?:zł|złotych|PLN)";
const PERCENT = "(\\d+(?:,\\d+)?)\\s?(?:%|proc)";
const re = (source: string) => new RegExp(source, "giu");

interface FactRule {
  readonly id: string;
  readonly label: string;
  readonly unit: "cents" | "bps";
  readonly patterns: readonly RegExp[];
  readonly allowed: (year: number) => readonly number[] | null;
}

const IKE: Readonly<Record<number, number>> = { 2025: 2_601_900, 2026: 2_826_000 };
const IKZE: Readonly<Record<number, readonly number[]>> = { 2025: [1_040_760, 1_561_140], 2026: [1_130_400, 1_695_600] };

const FACT_RULES: readonly FactRule[] = [
  {
    id: "fact-ike-limit",
    label: "limit wpłat na IKE",
    unit: "cents",
    patterns: [re(`limit${L}${GAP}\\bIKE\\b(?!Z)${GAP}${AMOUNT}`), re(`\\bIKE\\b(?!Z)${GAP}limit${L}${GAP}${AMOUNT}`), re(`na \\bIKE\\b(?!Z)${GAP}(?:najwyżej|maksymalnie|maksimum)${GAP}${AMOUNT}`)],
    allowed: (year) => (IKE[year] === undefined ? null : [IKE[year]]),
  },
  {
    id: "fact-ikze-limit",
    label: "limit wpłat na IKZE (etat albo działalność)",
    unit: "cents",
    patterns: [re(`limit${L}${GAP}\\bIKZE\\b${GAP}${AMOUNT}`), re(`\\bIKZE\\b${GAP}limit${L}${GAP}${AMOUNT}`)],
    allowed: (year) => IKZE[year] ?? null,
  },
  {
    id: "fact-capital-gains-tax",
    label: "podatek od zysków kapitałowych (Belka)",
    unit: "bps",
    patterns: [re(`(?:podat${L} Belki|Belk${L}|podat${L} od zysków kapitałowych)${GAP}${PERCENT}`)],
    allowed: () => [1900],
  },
  {
    id: "fact-ikze-withdrawal-tax",
    label: "zryczałtowany podatek przy wypłacie z IKZE",
    unit: "bps",
    patterns: [re(`zryczałtowan${L} podat${L}${GAP}\\bIKZE\\b${GAP}${PERCENT}`), re(`\\bIKZE\\b${GAP}zryczałtowan${L} podat${L}${GAP}${PERCENT}`)],
    allowed: () => [1000],
  },
];

function format(value: number, unit: FactRule["unit"]): string {
  const whole = String(Math.trunc(value / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fraction = value % 100;
  const number = fraction === 0 ? whole : `${whole},${String(fraction).padStart(2, "0")}`;
  return unit === "bps" ? `${number}%` : `${number} zł`;
}

/** FIRE `rules-facts.ts`: the first number after the keyword in the sentence equals the engine's; the year from the sentence, else from current_as_of. */
export const factsPlugin: QualityPlugin = {
  name: "fire-facts",
  rules: FACT_RULES.map((rule) => ({ id: rule.id, severity: "error", description: `${rule.label} equals the engine's table` })),
  check: ({ article, blocks, ruleset }) => {
    const findings: QualityFinding[] = [];
    const asOfYear = Number(article.currentAsOf.slice(0, 4));
    for (const block of blocks) {
      if (block.kind === "footnote" || block.kind === "directive") continue;
      for (const sentence of splitSentences(toProse(block.text))) {
        const years = [...sentence.matchAll(/\b(20\d\d)\b/g)].map((match) => Number(match[1]));
        const candidates = years.length > 0 ? years : [asOfYear];
        for (const rule of FACT_RULES) {
          for (const pattern of rule.patterns) {
            for (const match of sentence.matchAll(new RegExp(pattern.source, pattern.flags))) {
              const stated = Math.round(parseNumber(match[1] ?? "", ruleset.notation) * 100);
              const known = candidates.flatMap((year) => {
                const values = rule.allowed(year);
                return values === null ? [] : [{ year, values }];
              });
              if (known.length === 0) {
                findings.push({ rule: rule.id, severity: "warning", message: `${rule.label}: the engine has no value for ${candidates.join(", ")}; "${match[1] ?? ""}" not checked`, line: block.line });
              } else if (!known.some((entry) => entry.values.includes(stated))) {
                const expected = known.map((entry) => `${String(entry.year)}: ${entry.values.map((value) => format(value, rule.unit)).join(" or ")}`).join("; ");
                findings.push({ rule: rule.id, severity: "error", message: `${rule.label}: the text says ${format(stated, rule.unit)}, the engine ${expected}`, line: block.line });
              }
            }
          }
        }
      }
    }
    return findings;
  },
};

/** FIRE `rules-chart.ts`: a significant number in the paragraph right before or after `::wykres{…}` stands in the chart's table. */
export function createChartPlugin(resolve: (directive: string) => readonly string[] | null): QualityPlugin {
  return {
    name: "fire-chart",
    rules: [{ id: "chart-matches-text", severity: "error", description: "numbers next to a chart stand in its table" }],
    check: ({ blocks, ruleset }) => {
      const findings: QualityFinding[] = [];
      for (const [index, block] of blocks.entries()) {
        if (block.kind !== "directive" || !block.text.startsWith("::wykres")) continue;
        const table = resolve(block.text);
        if (table === null) {
          findings.push({ rule: "chart-matches-text", severity: "error", message: `the chart cannot be computed: ${block.text}`, line: block.line });
          continue;
        }
        const inTable = new Set(table.flatMap((number) => findSignificantNumbers(number, ruleset.notation).map((raw) => normalizeNumber(raw, ruleset.notation))));
        const neighbours = [blocks[index - 1], blocks[index + 1]].filter((neighbour): neighbour is Block => neighbour?.kind === "paragraph");
        for (const neighbour of neighbours) {
          const missing = findSignificantNumbers(toProse(neighbour.text), ruleset.notation)
            .map((raw) => normalizeNumber(raw, ruleset.notation))
            .filter((number) => !inTable.has(number));
          if (missing.length > 0) {
            findings.push({ rule: "chart-matches-text", severity: "error", message: `numbers next to the chart are not in its table: ${missing.join(", ")}`, line: neighbour.line });
          }
        }
      }
      return findings;
    },
  };
}

/** FIRE's gate: Polish, YMYL with its calculation footnote, editorial "we", its own domain. */
export const FIRE_QUALITY: QualityOptionsInput = {
  language: "pl",
  ymyl: { ownCalculationMark: "wyliczenie Plan Majątku" },
  voice: {
    forbidFirstPersonSingular: true,
    phrases: [{ id: "finance-world", pattern: "w świecie (?:finansów|inwestycji|inwestowania|oszczędzania)", message: "an empty phrase about \"the world of finance\"; replace it with a fact" }],
  },
  ownOrigins: ["https://www.planmajatku.pl", "https://app.planmajatku.pl"],
  privateRouteSegments: ["api", "(app)"],
};

export function createFireSettings(overrides: Partial<QualityOptionsInput> = {}): QualitySettings {
  const options = qualityOptionsSchema.parse({ ...FIRE_QUALITY, plugins: [factsPlugin], ...overrides });
  return resolveQualitySettings(options, { appOrigin: "https://planmajatku.pl", timezone: "Europe/Warsaw" });
}
