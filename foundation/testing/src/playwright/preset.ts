import type { PlaywrightWorkerOptions } from "@playwright/test";

export interface SofturePlaywrightOptions {
  /**
   * Hosts the browser must never reach, e.g. the production domain: the tests of a copied config or a
   * link built on the wrong origin fail with `ERR_NAME_NOT_RESOLVED` instead of writing to production.
   * `*.example.com` blocks the subdomains.
   */
  blockHosts?: readonly string[];
  /** The Chromium to launch. Default: `PLAYWRIGHT_CHROMIUM_PATH`, else Playwright's own build. */
  chromiumPath?: string;
}

export type SofturePlaywrightUse = Pick<PlaywrightWorkerOptions, "launchOptions">;

/**
 * The `use` block a SOFTURE app's `playwright.config.ts` spreads: blocked hosts and the Chromium a
 * cloud session or CI ships (`PLAYWRIGHT_CHROMIUM_PATH`).
 *
 *   use: { ...softurePlaywrightUse({ blockHosts: ["example.com", "*.example.com"] }), baseURL }
 */
export function softurePlaywrightUse(options: SofturePlaywrightOptions = {}): SofturePlaywrightUse {
  const executablePath = options.chromiumPath ?? (process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined);
  const args = options.blockHosts?.length ? [hostResolverRules(options.blockHosts)] : [];
  return { launchOptions: { ...(executablePath ? { executablePath } : {}), args } };
}

/** The Chromium flag that makes the hosts unresolvable. */
export function hostResolverRules(hosts: readonly string[]): string {
  for (const host of hosts) {
    if (!/^(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*$/i.test(host)) throw new RangeError(`blockHosts takes host names such as example.com or *.example.com, got "${host}"`);
  }
  return `--host-resolver-rules=${hosts.map((host) => `MAP ${host} ~NOTFOUND`).join(", ")}`;
}

