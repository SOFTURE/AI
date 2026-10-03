/**
 * An expected failure of a command: printed as one line without a stack, with its exit code. Any
 * other error is a bug and is printed with its stack.
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

export function fail(message: string, exitCode = 1): never {
  throw new CliFailure(message, exitCode);
}
