import { parseArgs, type ParseArgsConfig } from "node:util";
import { fail, USAGE_EXIT_CODE } from "./failure.js";

type OptionsConfig = NonNullable<ParseArgsConfig["options"]>;

/**
 * Parses a command's flags; an unknown flag or a stray argument is a usage error, never ignored (a typo in
 * `--compose` would otherwise render the wrong file).
 */
export function readFlags<T extends OptionsConfig>(command: string, args: string[], options: T) {
  try {
    return parseArgs({ args, options, strict: true, allowPositionals: false }).values;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(`${command}: ${reason}`, USAGE_EXIT_CODE);
  }
}
