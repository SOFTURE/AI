// The app's public paths (`publicPaths` in its deploy.json, issue #1435) as the default Access bypass list.
import { z } from "zod";
import type { InventoryApp } from "../inventory/index.js";

/** The deploy.json `softure-deploy init` writes at the root of the app's repository. */
export const DEPLOY_JSON_PATH = "deploy.json";

/** The same characters the inventory's bypassPaths take; anything else is left out and named. */
const URL_PATH = /^\/[A-Za-z0-9._~/-]*$/;

const deployJsonSchema = z.looseObject({ publicPaths: z.array(z.string()).optional() });

export type PublicPathsResult = { ok: true; paths: string[] | null } | { ok: false; problem: string };

/** `publicPaths` of a deploy.json text: null when the file or the key is absent, a problem when it cannot be read. */
export function readPublicPaths(text: string | null): PublicPathsResult {
  if (text === null) return { ok: true, paths: null };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, problem: `${DEPLOY_JSON_PATH} is not valid JSON` };
  }
  const parsed = deployJsonSchema.safeParse(json);
  if (!parsed.success) return { ok: false, problem: `${DEPLOY_JSON_PATH} publicPaths is not a list of paths` };
  const paths = parsed.data.publicPaths ?? null;
  const invalid = (paths ?? []).filter((path) => !URL_PATH.test(path));
  if (invalid.length > 0) return { ok: false, problem: `${DEPLOY_JSON_PATH} publicPaths has paths Access cannot match: ${invalid.join(", ")}` };
  return { ok: true, paths };
}

export interface MergedBypass {
  /** The app with its bypass list: the inventory's paths, then the public paths it does not list. */
  app: InventoryApp;
  /** Public paths the inventory did not list, now bypassed. */
  added: string[];
  /** Inventory paths deploy.json does not list as public. */
  notPublic: string[];
}

/** The inventory's bypassPaths plus the app's public paths; the inventory may list more than the app. */
export function mergeBypassPaths(app: InventoryApp, publicPaths: string[]): MergedBypass {
  const listed = app.access.bypassPaths;
  const added = publicPaths.filter((path) => !listed.includes(path));
  const notPublic = listed.filter((path) => !publicPaths.includes(path));
  return { app: { ...app, access: { ...app.access, bypassPaths: [...listed, ...added] } }, added, notPublic };
}
