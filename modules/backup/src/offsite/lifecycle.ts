// Remote retention is the bucket's: a lifecycle rule on the prefix expires objects after N days. The nightly run
// never deletes (its token cannot), so a compromised server cannot wipe the history either.
export const DEFAULT_LIFECYCLE_DAYS = 30;
export const MIN_LIFECYCLE_DAYS = 1;
export const MAX_LIFECYCLE_DAYS = 3650;

export type LifecycleDaysResult = { ok: true; days: number } | { ok: false; problem: string };

/** Whole days from 1 to 3650 (ten years). */
export function parseLifecycleDays(text: string | undefined): LifecycleDaysResult {
  if (text === undefined) return { ok: true, days: DEFAULT_LIFECYCLE_DAYS };
  if (!/^\d{1,4}$/.test(text)) return { ok: false, problem: `--days is a whole number of days, not ${JSON.stringify(text)}` };
  const days = Number(text);
  if (days < MIN_LIFECYCLE_DAYS || days > MAX_LIFECYCLE_DAYS) {
    return { ok: false, problem: `--days is from ${String(MIN_LIFECYCLE_DAYS)} to ${String(MAX_LIFECYCLE_DAYS)}, not ${String(days)}` };
  }
  return { ok: true, days };
}

/** The S3 `LifecycleConfiguration` (XML, for PutBucketLifecycleConfiguration) expiring `<prefix>/` after `days`. */
export function buildLifecycleXml(prefix: string, days: number): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<LifecycleConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">',
    "  <Rule>",
    `    <ID>softure-backup-${prefix.replace(/[^a-z0-9-]/g, "-")}</ID>`,
    "    <Status>Enabled</Status>",
    `    <Filter><Prefix>${prefix}/</Prefix></Filter>`,
    `    <Expiration><Days>${String(days)}</Days></Expiration>`,
    "    <AbortIncompleteMultipartUpload><DaysAfterInitiation>1</DaysAfterInitiation></AbortIncompleteMultipartUpload>",
    "  </Rule>",
    "</LifecycleConfiguration>",
    "",
  ].join("\n");
}

/** The same rule as JSON for `aws s3api put-bucket-lifecycle-configuration --lifecycle-configuration file://…`. */
export function buildLifecycleJson(prefix: string, days: number): string {
  const rule = {
    ID: `softure-backup-${prefix.replace(/[^a-z0-9-]/g, "-")}`,
    Status: "Enabled",
    Filter: { Prefix: `${prefix}/` },
    Expiration: { Days: days },
    AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
  };
  return `${JSON.stringify({ Rules: [rule] }, null, 2)}\n`;
}
