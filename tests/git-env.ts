/**
 * The variables that tie git to one repository, as `git rev-parse --local-env-vars` prints them (git 2.43). Git
 * exports some of them to hooks (`GIT_DIR` in a worktree's `pre-push`), and a test that runs `git` in a temporary
 * repository with them set acts on the real repository instead (issue #1292). Identity variables such as
 * `GIT_AUTHOR_NAME` do not locate a repository and stay.
 */
export const REPOSITORY_GIT_VARIABLES = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CONFIG",
  "GIT_CONFIG_PARAMETERS",
  "GIT_CONFIG_COUNT",
  "GIT_OBJECT_DIRECTORY",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_GRAFT_FILE",
  "GIT_INDEX_FILE",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_REPLACE_REF_BASE",
  "GIT_PREFIX",
  "GIT_SHALLOW_FILE",
  "GIT_COMMON_DIR",
] as const;

/** Deletes the repository-locating git variables from `env` in place and returns it. */
export function removeRepositoryGitVariables<Env extends Record<string, string | undefined>>(env: Env): Env {
  for (const name of REPOSITORY_GIT_VARIABLES) delete env[name];
  return env;
}
