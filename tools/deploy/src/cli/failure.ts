/**
 * An expected failure of a command: printed as one line without a stack, with its exit code. Any other error is a
 * bug and is printed with its stack.
 */
export class CliFailure extends Error {
  constructor(
    message: string,
    readonly exitCode = 1,
  ) {
    super(message);
    this.name = "CliFailure";
  }
}

/** Exit code of a wrong command line (unknown command or option, bad value). */
export const USAGE_EXIT_CODE = 2;

export function fail(message: string, exitCode = 1): never {
  throw new CliFailure(message, exitCode);
}
