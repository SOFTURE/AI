import { z } from "zod";

/** One query or expression of a Grafana alert rule (`data[]`), passed to Grafana as written. */
const ruleQuerySchema = z.looseObject({
  refId: z.string().min(1),
  datasourceUid: z.string().min(1),
  model: z.record(z.string(), z.unknown()),
});

/**
 * One Grafana alert rule as the provisioning API takes it. The fields Grafana needs are checked; the rest (`for`,
 * `noDataState`, `execErrState`, `labels`, `annotations`, ...) is passed through. `folderUID`, `ruleGroup`,
 * `notification_settings` and `isPaused` are set by the apply from the file and its flags.
 */
const grafanaRuleSchema = z.looseObject({
  uid: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,40}$/, "a rule uid is 1 to 40 letters, digits, '-' or '_'"),
  title: z.string().min(1),
  condition: z.string().min(1),
  data: z.array(ruleQuerySchema).min(1),
});

/** The rules file an app keeps in its repository: one folder, one contact point, one rule group. */
export const grafanaRulesFileSchema = z
  .object({
    /** The folder the rule group (and the dashboard) lives in; created when missing. */
    folder: z.object({ uid: z.string().min(1), title: z.string().min(1) }),
    /** Name of an existing contact point every rule notifies; never created. */
    receiver: z.string().min(1),
    /** Name of the rule group; the apply replaces the whole group. */
    group: z.string().min(1),
    /** How often the group is evaluated, in seconds (a multiple of 10). Default 60. */
    intervalSeconds: z
      .number()
      .int()
      .positive()
      .refine((value) => value % 10 === 0, "intervalSeconds must be a multiple of 10")
      .default(60),
    rules: z.array(grafanaRuleSchema).min(1),
  })
  .superRefine((file, context) => {
    const seen = new Set<string>();
    for (const [index, rule] of file.rules.entries()) {
      if (seen.has(rule.uid)) {
        context.addIssue({ code: "custom", path: ["rules", index, "uid"], message: `duplicate rule uid "${rule.uid}"` });
      }
      seen.add(rule.uid);
      const refIds = new Set(rule.data.map((query) => query.refId));
      if (!refIds.has(rule.condition)) {
        context.addIssue({
          code: "custom",
          path: ["rules", index, "condition"],
          message: `condition "${rule.condition}" names no refId of the rule's data`,
        });
      }
    }
  });

export type GrafanaRulesFile = z.output<typeof grafanaRulesFileSchema>;
export type GrafanaRule = GrafanaRulesFile["rules"][number];
export type GrafanaRuleQuery = GrafanaRule["data"][number];

/** A dashboard JSON model: `uid` and `title` are checked, the rest is passed to Grafana as written. */
export const grafanaDashboardSchema = z.looseObject({
  uid: z.string().min(1),
  title: z.string().min(1),
});

export type GrafanaDashboard = z.output<typeof grafanaDashboardSchema>;

export type ParseResult<T> = { isValid: true; value: T } | { isValid: false; problems: string[] };

/** Narrows a parsed rules file; the problems name the path of every field that is wrong. */
export function parseGrafanaRulesFile(input: unknown): ParseResult<GrafanaRulesFile> {
  return toResult(grafanaRulesFileSchema.safeParse(input));
}

/** Narrows a parsed dashboard JSON model. */
export function parseGrafanaDashboard(input: unknown): ParseResult<GrafanaDashboard> {
  return toResult(grafanaDashboardSchema.safeParse(input));
}

function toResult<T>(parsed: z.ZodSafeParseResult<T>): ParseResult<T> {
  if (parsed.success) {
    return { isValid: true, value: parsed.data };
  }
  return {
    isValid: false,
    problems: parsed.error.issues.map((issue) => {
      const path = issue.path.map(String).join(".");
      return path === "" ? issue.message : `${path}: ${issue.message}`;
    }),
  };
}
