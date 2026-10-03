// The registry: every part of a user's data the app holds, as contributors. The enabled modules
// contribute through `defineModule({ privacy })` (core checks it against their manifest), the app
// through `privacy({ contributors })`. Nothing is listed by hand, so a module enabled in the config
// is in the export and the deletion by being enabled.
import type { PrivacyContributor, SoftureConfig } from "@softure-ai/core";
import { getPrivacyOptions } from "./options.js";

export interface RegisteredContributor extends PrivacyContributor {
  /** A module id or an app contributor id; the key of its part of the export. */
  readonly id: string;
  readonly source: "module" | "app";
}

export type ExportingContributor = RegisteredContributor & Required<Pick<PrivacyContributor, "exportUserData">>;
export type DeletingContributor = RegisteredContributor & Required<Pick<PrivacyContributor, "deleteUserData">>;

const registries = new WeakMap<SoftureConfig, readonly RegisteredContributor[]>();

/**
 * Every contributor in export order: the modules in the config's dependency order (dependencies
 * first), then the app's in the order it lists them. Throws when an app contributor takes the id of
 * an enabled module: both parts would land under one key.
 */
export function getPrivacyContributors(config: SoftureConfig): readonly RegisteredContributor[] {
  const cached = registries.get(config);
  if (cached !== undefined) return cached;

  const modules: RegisteredContributor[] = config.modules.flatMap((module) =>
    module.privacy === null ? [] : [{ ...module.privacy, id: module.id, source: "module" as const }],
  );
  const moduleIds = new Set(config.modules.map((module) => module.id));
  const app: RegisteredContributor[] = getPrivacyOptions(config).contributors.map((contributor) => {
    if (moduleIds.has(contributor.id)) {
      throw new Error(`@softure-ai/privacy: app contributor "${contributor.id}" has the id of an enabled module; give it another id`);
    }
    return { ...contributor, source: "app" as const };
  });

  const registry = Object.freeze([...modules, ...app]);
  registries.set(config, registry);
  return registry;
}

/** The contributors with an export, in export order. */
export function getExportingContributors(config: SoftureConfig): readonly ExportingContributor[] {
  return getPrivacyContributors(config).filter((contributor): contributor is ExportingContributor => contributor.exportUserData !== undefined);
}

/**
 * The contributors with a deletion, in deletion order: the reverse of the export order. The app's
 * own data goes first, then each module before the modules it depends on, so a row is always
 * deleted before the rows it references, whatever the foreign key's ON DELETE action.
 */
export function getDeletingContributors(config: SoftureConfig): readonly DeletingContributor[] {
  return getPrivacyContributors(config)
    .filter((contributor): contributor is DeletingContributor => contributor.deleteUserData !== undefined)
    .toReversed();
}
