// A command that never connects (`softure-blog check`) loads the app's config with the database
// optional: `defineSoftureConfig` then reads a missing or empty URL as "no database" instead of
// refusing the config. The flag lives on `globalThis`, so it reaches the copy of core the app's config
// file imports even when that is another instance than the command's.
const DATABASE_OPTIONAL = Symbol.for("softure-ai.core.database-optional");

type FlagHolder = Record<typeof DATABASE_OPTIONAL, boolean | undefined>;

/**
 * Runs `load` (usually the import of the app's config) with the database optional and restores the
 * previous state when it settles. Inside it, `defineSoftureConfig` gives `database: null` for a missing,
 * `null` or empty URL, whatever the modules need; a real URL is kept.
 */
export async function withDatabaseOptional<T>(load: () => Promise<T> | T): Promise<T> {
  const holder = globalThis as unknown as FlagHolder;
  const previous = holder[DATABASE_OPTIONAL];
  holder[DATABASE_OPTIONAL] = true;
  try {
    return await load();
  } finally {
    holder[DATABASE_OPTIONAL] = previous;
  }
}

/** Whether a `withDatabaseOptional` load is running. */
export function isDatabaseOptional(): boolean {
  return (globalThis as unknown as FlagHolder)[DATABASE_OPTIONAL] === true;
}
