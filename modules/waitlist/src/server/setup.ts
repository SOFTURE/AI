// What the waitlist needs from the app's other modules, checked once per config before the first
// sign-up: its rate limit buckets in `security({ buckets })`, every scope's legal document in
// `privacy({ documents })`, and mailing's unsubscribe secret when the success answer carries the link. A setup mistake then fails with one clear error, not on each sign-up.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import { readUnsubscribeSecrets } from "@softure-ai/mailing/server";
import { findLegalDocument } from "@softure-ai/privacy/server";
import { getWaitlistOptions } from "./options.js";

export const BUCKETS = {
  client: "waitlist",
  email: "waitlist-email",
} as const;

const checkedConfigs = new WeakSet<SoftureConfig>();

export function assertWaitlistSetup(config: SoftureConfig): void {
  if (checkedConfigs.has(config)) return;
  const problems: string[] = [];

  const security = getModule(config, "security")?.options as { buckets?: Readonly<Record<string, unknown>> } | undefined;
  const missing = Object.values(BUCKETS).filter((name) => !Object.hasOwn(security?.buckets ?? {}, name));
  if (missing.length > 0) {
    problems.push(`security({ buckets }) lacks ${missing.map((name) => `"${name}"`).join(", ")}; spread WAITLIST_RATE_LIMIT_BUCKETS into it`);
  }
  const options = getWaitlistOptions(config);
  if (options.unsubscribeLinkOnSuccess && readUnsubscribeSecrets().current === null) {
    problems.push("unsubscribeLinkOnSuccess needs MAILING_UNSUBSCRIBE_SECRET (at least 32 characters) to sign the link");
  }
  for (const scope of options.scopes) {
    if (scope.document !== undefined && findLegalDocument(config, scope.document) === undefined) {
      problems.push(`scope "${scope.id}" names the document "${scope.document}", which privacy({ documents }) does not declare`);
    }
  }

  if (problems.length > 0) throw new Error(`@softure-ai/waitlist: ${problems.join("; ")}`);
  checkedConfigs.add(config);
}
