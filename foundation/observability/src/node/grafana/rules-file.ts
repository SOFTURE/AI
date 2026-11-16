import { z } from "zod";

/** One query or expression of a Grafana alert rule (`data[]`), passed to Grafana as written. */
const ruleQuerySchema = z.looseObject({
  refId: z.string().min(1),
  datasourceUid: z.string().min(1),
  model: z.record(z.string(), z.unknown()),
});

/** A Prometheus duration as Grafana parses it: `30s`, `5m`, `4h`, `1h30m`. */
const DURATION_PATTERN = /^(\d+(ms|s|m|h|d|w|y))+$/;

/** The keys a rule may set in its `notification_settings`; the receiver always comes from the file. */
export const RULE_NOTIFICATION_KEYS = ["group_by", "group_wait", "group_interval", "repeat_interval"] as const;

const durationSchema = z
  .string()
  .refine((value) => DURATION_PATTERN.test(value), { error: (issue) => `${JSON.stringify(issue.input)} is not a duration like 30s, 5m or 4h` });

const groupBySchema = z
  .array(z.string().min(1))
  .min(1, "group_by names at least one label")
  .superRefine((labels, context) => {
    const repeated = labels.filter((label, index) => labels.indexOf(label) !== index);
    for (const label of new Set(repeated)) {
      context.addIssue({ code: "custom", message: `label "${label}" is listed twice` });
    }
  });

/**
 * A rule's own notification grouping and timings, merged under the file's receiver by the apply. Grafana keeps
 * `alertname` and `grafana_folder` in every grouping itself; `["..."]` groups by every label.
 */
const ruleNotificationSettingsSchema = z
  .looseObject({
    group_by: groupBySchema.optional(),
    group_wait: durationSchema.optional(),
    group_interval: durationSchema.optional(),
    repeat_interval: durationSchema.optional(),
  })
  .superRefine((settings, context) => {
    const allowed: readonly string[] = RULE_NOTIFICATION_KEYS;
    for (const key of Object.keys(settings)) {
      if (key === "receiver") {
        context.addIssue({ code: "custom", message: "the file's receiver notifies every rule; a rule cannot name its own receiver" });
      } else if (!allowed.includes(key)) {
        context.addIssue({
          code: "custom",
          message: `unknown key "${key}"; a rule takes group_by, group_wait, group_interval and repeat_interval`,
        });
      }
    }
  })
  .transform((settings): RuleNotificationSettings => {
    const picked: RuleNotificationSettings = {};
    if (settings.group_by !== undefined) picked.group_by = settings.group_by;
    if (settings.group_wait !== undefined) picked.group_wait = settings.group_wait;
    if (settings.group_interval !== undefined) picked.group_interval = settings.group_interval;
    if (settings.repeat_interval !== undefined) picked.repeat_interval = settings.repeat_interval;
    return picked;
  });

/** A rule's own notification grouping and timings (Prometheus durations); the receiver comes from the file. */
export type RuleNotificationSettings = {
  group_by?: string[];
  group_wait?: string;
  group_interval?: string;
  repeat_interval?: string;
};

/**
 * One Grafana alert rule as the provisioning API takes it. The fields Grafana needs are checked; the rest (`for`,
 * `noDataState`, `execErrState`, `labels`, `annotations`, ...) is passed through. `folderUID`, `ruleGroup` and
 * `isPaused` are set by the apply from the file and its flags; `notification_settings` may carry the rule's own
 * grouping and timings, and the apply adds the file's receiver.
 */
const grafanaRuleSchema = z.looseObject({
  uid: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,40}$/, "a rule uid is 1 to 40 letters, digits, '-' or '_'"),
  title: z.string().min(1),
  condition: z.string().min(1),
  data: z.array(ruleQuerySchema).min(1),
  notification_settings: ruleNotificationSettingsSchema.optional(),
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
