import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtraVars } from "./vars.js";

/** The playbooks shipped in the package (`ansible/` next to `src/` and `dist/`). */
export const ANSIBLE_DIR = fileURLToPath(new URL("../../ansible/", import.meta.url));

export interface AnsiblePaths {
  ansibleDir: string;
  /** Where the pinned collections are installed, one folder per package version. */
  collectionsDir: string;
}

export interface CommandLine {
  program: string;
  args: string[];
  env: Record<string, string>;
}

/** The collections folder under the user's cache: `$XDG_CACHE_HOME/softure-host/<version>/collections`. */
export function findCollectionsDir(env: Readonly<Record<string, string | undefined>>, version: string): string {
  const cacheHome = env.XDG_CACHE_HOME ?? join(env.HOME ?? homedir(), ".cache");
  return join(cacheHome, "softure-host", version, "collections");
}

/** Installs requirements.yml into the package's own folder, so the pinned collection is the one that runs. */
export function buildCollectionInstall(paths: AnsiblePaths): CommandLine {
  return {
    program: "ansible-galaxy",
    args: ["collection", "install", "-r", join(paths.ansibleDir, "requirements.yml"), "-p", paths.collectionsDir],
    env: {},
  };
}

export interface PlaybookRun {
  playbook: "server.yml" | "app.yml";
  vars: ExtraVars;
  /** Ansible's check mode with a diff: reports what would change, changes nothing. */
  check: boolean;
}

/**
 * One playbook against the one server. The inventory is inline (`server,`) and the address comes from
 * `ansible_host`; every variable goes as one JSON argument, which keeps a key line's spaces and never reads a value
 * as a flag. Nothing is written to disk.
 */
export function buildPlaybookRun(paths: AnsiblePaths, run: PlaybookRun): CommandLine {
  return {
    program: "ansible-playbook",
    args: [
      join(paths.ansibleDir, run.playbook),
      "-i",
      "server,",
      "-e",
      JSON.stringify(run.vars),
      ...(run.check ? ["--check", "--diff"] : []),
    ],
    env: { ANSIBLE_COLLECTIONS_PATH: paths.collectionsDir },
  };
}
